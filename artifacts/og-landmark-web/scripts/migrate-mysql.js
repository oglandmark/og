require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATION_ID = '0001_initial_mysql';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!/^(mysql|mariadb):\/\//i.test(databaseUrl || '')) {
    throw new Error('DATABASE_URL must be a mysql:// or mariadb:// connection string');
  }

  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [rows] = await connection.execute(
      'SELECT id FROM schema_migrations WHERE id = ? LIMIT 1',
      [MIGRATION_ID],
    );
    if (rows.length > 0) {
      console.log(`MySQL migration already applied: ${MIGRATION_ID}`);
      return;
    }

    const migration = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'migrations', `${MIGRATION_ID}.sql`),
      'utf8',
    );
    for (const statement of migration.split(';').map((item) => item.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.execute('INSERT INTO schema_migrations (id) VALUES (?)', [MIGRATION_ID]);
    console.log(`Applied MySQL migration: ${MIGRATION_ID}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`MySQL migration failed: ${error.message}`);
  process.exit(1);
});