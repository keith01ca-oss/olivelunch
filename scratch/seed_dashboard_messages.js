const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log('Seeding dashboard messages...');

  // Get first organization
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs || orgs.length === 0) {
    console.error('No organization found to attach messages to.');
    process.exit(1);
  }

  const orgId = orgs[0].id;

  const messages = [
    {
      org_id: orgId,
      message: 'Welcome to the new school term! Order your lunches ahead of time. Note that VIP members save up to 50% on all main items.',
      type: 'info',
      is_active: true,
    },
    {
      org_id: orgId,
      message: 'Attention Parents: Order cutoff is strictly at 1:00 PM the day before delivery. Kitchen cannot make exceptions.',
      type: 'warning',
      is_active: true,
    }
  ];

  const { error } = await supabase.from('dashboard_messages').insert(messages);
  if (error) {
    console.error('Failed to seed dashboard messages:', error);
    process.exit(1);
  }

  console.log('Seeding successful!');
}

seed();
