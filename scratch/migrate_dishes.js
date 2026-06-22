const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  console.log('Running migration...');
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE dishes ADD COLUMN IF NOT EXISTS pack_time_seconds INTEGER DEFAULT 0;'
  });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  console.log('Migration successful!');
}

migrate();
