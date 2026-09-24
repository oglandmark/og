require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { provider, rawPool, closePool } = require('../database/connection');

async function main() {
  if (provider !== 'postgres' || !rawPool) {
    throw new Error('Set DATABASE_URL to the Supabase PostgreSQL connection string before running this migration.');
  }

  const schemaFile = path.join(__dirname, '..', 'database', 'schema.postgres.sql');
  const schema = fs.readFileSync(schemaFile, 'utf8');
  await rawPool.query(schema);
  console.log('Supabase PostgreSQL schema is ready.');
}

main()
  .catch(error => {
    console.error(`PostgreSQL schema setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);