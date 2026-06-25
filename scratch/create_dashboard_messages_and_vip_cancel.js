const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  console.log('Running migration...');
  
  // 1. Create dashboard_messages table
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS dashboard_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `;
  
  // 2. Add columns to parents to track cancellation and stripe subscriptions
  const alterParentsSql = `
    ALTER TABLE parents 
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS vip_cancel_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS vip_cancel_at_period_end BOOLEAN DEFAULT FALSE;
  `;

  const { error: err1 } = await supabase.rpc('exec_sql', { sql: createTableSql });
  if (err1) {
    console.error('Failed to create dashboard_messages:', err1);
    process.exit(1);
  }
  
  const { error: err2 } = await supabase.rpc('exec_sql', { sql: alterParentsSql });
  if (err2) {
    console.error('Failed to alter parents table:', err2);
    process.exit(1);
  }

  console.log('Migration successful!');
}

migrate();
