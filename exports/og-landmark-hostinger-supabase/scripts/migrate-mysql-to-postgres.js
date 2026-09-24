require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { provider, rawPool, closePool } = require('../database/connection');
const { stableStringify, sha256Json } = require('./json-parity');

function parseSourceData(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!data || typeof data !== 'object' || !Array.isArray(data.users) || !Array.isArray(data.properties)) {
    throw new Error('The source app_data row is not a valid OG Landmark data export.');
  }
  for (const user of data.users) {
    if (typeof user.password !== 'string' || !user.password || user.password.startsWith('pbkdf2:')) continue;
    const salt = crypto.randomBytes(16).toString('hex');
    user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha512').toString('hex')}`;
  }
  return data;
}

async function main() {
  const sourceUrl = process.env.SOURCE_MYSQL_DATABASE_URL || '';
  if (!/^(mysql|mariadb):\/\//i.test(sourceUrl)) {
    throw new Error('Set SOURCE_MYSQL_DATABASE_URL to the current Hostinger MySQL connection string.');
  }
  if (provider !== 'postgres' || !rawPool) {
    throw new Error('Set DATABASE_URL to the new Supabase PostgreSQL connection string.');
  }

  const source = await mysql.createConnection(sourceUrl);
  const targetClient = await rawPool.connect();
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'schema.postgres.sql'),
      'utf8',
    );
    await targetClient.query(schema);

    const [sourceRows] = await source.execute('SELECT data FROM app_data WHERE id = 1 LIMIT 1');
    if (!sourceRows.length) {
      throw new Error('The current MySQL database has no app_data row to migrate.');
    }
    const data = parseSourceData(sourceRows[0].data);

    const targetRows = await targetClient.query(
      'SELECT id FROM app_data LIMIT 1',
    );
    const targetSessions = await targetClient.query(
      'SELECT token_hash FROM auth_sessions LIMIT 1',
    );
    const targetChallenges = await targetClient.query(
      'SELECT email FROM auth_challenges LIMIT 1',
    );
    if (targetRows.rowCount || targetSessions.rowCount || targetChallenges.rowCount) {
      throw new Error('The Supabase target already contains app or auth data; refusing to overwrite or merge it.');
    }

    const [sessionRows] = await source.execute(
      `SELECT token_hash, user_id, expires_at, created_at
       FROM auth_sessions
       WHERE expires_at > CURRENT_TIMESTAMP`,
    );

    await targetClient.query('BEGIN');
    await targetClient.query(
      'INSERT INTO app_data (id, data) VALUES (1, $1::jsonb)',
      [JSON.stringify(data)],
    );
    for (let start = 0; start < sessionRows.length; start += 250) {
      const batch = sessionRows.slice(start, start + 250);
      const values = [];
      const placeholders = batch.map((session, rowIndex) => {
        const offset = rowIndex * 4;
        values.push(session.token_hash, session.user_id, session.expires_at, session.created_at);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      });
      await targetClient.query(
        `INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
    const copiedData = await targetClient.query('SELECT data FROM app_data WHERE id = 1');
    if (stableStringify(copiedData.rows[0]?.data) !== stableStringify(data)) {
      throw new Error('The PostgreSQL app_data verification did not match the source snapshot; the import was rolled back.');
    }
    const copiedSessions = await targetClient.query('SELECT COUNT(*) AS total FROM auth_sessions');
    if (Number(copiedSessions.rows[0]?.total) !== sessionRows.length) {
      throw new Error('The PostgreSQL session count did not match the source snapshot; the import was rolled back.');
    }
    await targetClient.query('COMMIT');
    console.log(`Migrated OG Landmark data (${data.users.length} users, ${data.properties.length} properties, JSON SHA-256 ${sha256Json(data)}) and ${sessionRows.length} active sessions. OTP challenges were not copied.`);
  } catch (error) {
    try { await targetClient.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    targetClient.release();
    await source.end();
    await closePool();
  }
}

main().catch(error => {
  console.error(`MySQL-to-PostgreSQL migration failed: ${error.message}`);
  process.exitCode = 1;
});