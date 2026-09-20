require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

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
    const migrationIds = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort()
      .map((name) => name.replace(/\.sql$/, ''));
    for (const migrationId of migrationIds) {
      const [rows] = await connection.execute(
        'SELECT id FROM schema_migrations WHERE id = ? LIMIT 1',
        [migrationId],
      );
      if (rows.length > 0) {
        console.log(`MySQL migration already applied: ${migrationId}`);
        continue;
      }
      const migration = fs.readFileSync(path.join(MIGRATIONS_DIR, `${migrationId}.sql`), 'utf8');
      for (const statement of migration.split(';').map((item) => item.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute('INSERT INTO schema_migrations (id) VALUES (?)', [migrationId]);
      console.log(`Applied MySQL migration: ${migrationId}`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`MySQL migration failed: ${error.message}`);
  process.exit(1);
});