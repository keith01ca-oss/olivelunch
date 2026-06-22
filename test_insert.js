const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const inserts = [
    {
      org_id: '8896d3a4-b7c5-41aa-888c-3e08c1ceaa61', // assuming this from earlier
      date: '2026-06-01',
      dish_id: '188bf8a1-b7be-4ea8-92ef-20d6f832c171' // assuming this from earlier
    }
  ];

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert(inserts)
    .select('*, dishes(name, category, price_regular)');
    
  if (error) {
    console.error('SUPABASE ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

test();
