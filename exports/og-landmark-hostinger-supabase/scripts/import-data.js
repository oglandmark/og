/* Import a verified OG Landmark JSON export into an empty MySQL database. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!/^(mysql|mariadb):\/\//i.test(url || '')) {
    throw new Error('DATABASE_URL must be a mysql:// or mariadb:// connection string');
  }

  const input = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '..', 'og-landmark-data.json');
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  for (const user of data.users || []) {
    if (!String(user.password).startsWith('pbkdf2:')) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha512').toString('hex')}`;
    }
  }

  const connection = await mysql.createConnection(url);
  try {
    const [rows] = await connection.execute('SELECT id FROM app_data WHERE id = 1 LIMIT 1');
    if (rows.length > 0) {
      throw new Error('app_data already contains data; refusing to overwrite it. Back up the target and clear it manually only if you explicitly intend to replace it.');
    }
    await connection.execute(
      'INSERT INTO app_data (id, data) VALUES (?, ?)',
      [1, JSON.stringify(data)],
    );
    console.log(`Imported OG Landmark data into MySQL from ${input}.`);
  } finally {
    await connection.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });