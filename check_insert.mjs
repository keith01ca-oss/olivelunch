import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: order } = await supabase.from('orders').select('id').limit(1).single();
  const { data: dish } = await supabase.from('dishes').select('id').limit(1).single();
  
  const testItem = {
    order_id: order.id,
    dish_id: dish.id,
    quantity: 1,
    unit_price: 1,
    total_price: 1,
    delivery_area: 'classroom'
  };
  
  console.log('Testing insert with delivery_area...');
  const res1 = await supabase.from('order_items').insert([testItem]);
  console.log('Error 1:', res1.error);
}

check();
