/* Import supplied data into the Neon PostgreSQL document store. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'og-landmark-data.json'), 'utf8'));
  for (const user of data.users || []) {
    if (!String(user.password).startsWith('pbkdf2:')) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha512').toString('hex')}`;
    }
  }

  const sql = neon(url);
  await sql`
    INSERT INTO app_data (id, data)
    VALUES (1, ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  console.log('Imported OG Landmark data into Neon PostgreSQL.');
}

main().catch(err => { console.error(err.message); process.exit(1); });