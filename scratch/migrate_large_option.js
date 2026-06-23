const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  console.log('Running large option migration...');
  
  const sql = `
    ALTER TABLE dishes ADD COLUMN IF NOT EXISTS has_large BOOLEAN DEFAULT FALSE;
    ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_name VARCHAR;
    ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_price_regular NUMERIC(10,2);
    ALTER TABLE dishes ADD COLUMN IF NOT EXISTS large_price_vip NUMERIC(10,2);
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_large BOOLEAN DEFAULT FALSE;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  console.log('Migration successful!');
}

migrate();
