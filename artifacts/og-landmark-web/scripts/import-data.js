/* Import supplied data into the Supabase JSON document store. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'og-landmark-data.json'), 'utf8'));
  for (const user of data.users || []) {
    if (!String(user.password).startsWith('pbkdf2:')) {
      const salt = crypto.randomBytes(16).toString('hex');
      user.password = `pbkdf2:${salt}:${crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha512').toString('hex')}`;
    }
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from('app_data').upsert({ id: 1, data }, { onConflict: 'id' });
  if (error) throw new Error(`Supabase import failed: ${error.message}`);
  console.log('Imported OG Landmark data into Supabase.');
}

main().catch(err => { console.error(err.message); process.exit(1); });