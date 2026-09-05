/* Import supplied data into the durable MySQL document store. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
async function main() {
  for (const key of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE']) if (!process.env[key]) throw new Error(`${key} is required`);
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'og-landmark-data.json'), 'utf8'));
  for (const user of data.users || []) {
    if (!String(user.password).startsWith('pbkdf2:')) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha512').toString('hex')}`;
    }
  }
  const db = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
  for (const statement of fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8').split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) await db.query(statement);
  }
  await db.execute('INSERT INTO app_data (id,data) VALUES (1,?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [JSON.stringify(data)]);
  await db.end();
  console.log('Imported OG Landmark data.');
}
main().catch(err => { console.error(err.message); process.exit(1); });