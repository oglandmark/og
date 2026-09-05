/* One-time migration for an existing OG Landmark MySQL app_data document. */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'MYSQL_PASSWORD'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is required for the source database`);
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  const mysqlConnection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  try {
    const [rows] = await mysqlConnection.execute('SELECT data FROM app_data WHERE id = 1 LIMIT 1');
    if (!rows.length) throw new Error('The source MySQL app_data row was not found.');
    const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.from('app_data').upsert({ id: 1, data }, { onConflict: 'id' });
    if (error) throw new Error(`Supabase migration failed: ${error.message}`);
    console.log('Migrated the current MySQL app_data document into Supabase.');
  } finally {
    await mysqlConnection.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });