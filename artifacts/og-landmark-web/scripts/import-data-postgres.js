require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { provider, rawPool, closePool } = require('../database/connection');
const { stableStringify, sha256Json } = require('./json-parity');

function hashPlaintextPasswords(data) {
  for (const user of data.users || []) {
    if (typeof user.password === 'string' && user.password && !user.password.startsWith('pbkdf2:')) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password || '', salt, 100000, 64, 'sha512').toString('hex')}`;
    }
  }
}

async function main() {
  if (provider !== 'postgres' || !rawPool) {
    throw new Error('Set DATABASE_URL to the Supabase PostgreSQL connection string before importing data.');
  }
  if (!process.argv[2]) {
    throw new Error('Pass the path to a verified OG Landmark JSON export; the bundled demo data is not a production backup.');
  }
  const input = path.resolve(process.argv[2]);
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!data || !Array.isArray(data.users) || !Array.isArray(data.properties)) {
    throw new Error('The selected JSON file is not a valid OG Landmark data export.');
  }
  hashPlaintextPasswords(data);

  const client = await rawPool.connect();
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'schema.postgres.sql'),
      'utf8',
    );
    await client.query(schema);
    const [appData, sessions, challenges] = await Promise.all([
      client.query('SELECT id FROM app_data LIMIT 1'),
      client.query('SELECT token_hash FROM auth_sessions LIMIT 1'),
      client.query('SELECT email FROM auth_challenges LIMIT 1'),
    ]);
    if (appData.rowCount || sessions.rowCount || challenges.rowCount) {
      throw new Error('The Supabase target already contains app or auth data; refusing to overwrite or merge it.');
    }
    await client.query('BEGIN');
    await client.query('INSERT INTO app_data (id, data) VALUES (1, $1::jsonb)', [JSON.stringify(data)]);
    const copiedData = await client.query('SELECT data FROM app_data WHERE id = 1');
    if (stableStringify(copiedData.rows[0]?.data) !== stableStringify(data)) {
      throw new Error('The PostgreSQL app_data verification did not match the selected export; the import was rolled back.');
    }
    await client.query('COMMIT');
    console.log(`Imported verified OG Landmark data (${data.users.length} users, ${data.properties.length} properties, JSON SHA-256 ${sha256Json(data)}) from ${input}.`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(error => {
  console.error(`PostgreSQL data import failed: ${error.message}`);
  process.exitCode = 1;
});