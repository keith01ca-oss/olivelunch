const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabaseAdmin
    .from('menus')
    .select('*, dishes(name, category, price_regular)')
    .limit(1);
    
  if (error) {
    console.error('SUPABASE ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

test();
