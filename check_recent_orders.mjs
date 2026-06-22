import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('orders').select('id, order_date, status, order_items(id)').order('created_at', { ascending: false }).limit(20);
  console.log('Data:', JSON.stringify(data, null, 2));
}

check();
