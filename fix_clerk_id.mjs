import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bnjcasmptngkkmtmrnrv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuamNhc21wdG5na2ttdG1ybnJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjI3MCwiZXhwIjoyMDkyNzAyMjcwfQ.Q0DmA0yqwtbzxdVaZo2ipH7rmeX8gvgmezpulP_e6Ao'
);

const OLD_CLERK_ID = 'user_3CrNlD3MciY6GagIGaCT9KkdmC3';
const NEW_CLERK_ID = 'user_3FeOdg9ZrzojuKOvmZ2iKC1cmdd';
const EMAIL = 'keith01.ca@gmail.com';

console.log(`Updating clerk_user_id for ${EMAIL}...`);
console.log(`  Old: ${OLD_CLERK_ID}`);
console.log(`  New: ${NEW_CLERK_ID}`);

const { data, error } = await supabase
  .from('parents')
  .update({ clerk_user_id: NEW_CLERK_ID })
  .eq('email', EMAIL)
  .select('id, email, clerk_user_id, name');

if (error) {
  console.error('❌ Update failed:', error);
  process.exit(1);
}

console.log('\n✅ Update successful!');
console.log('Updated record:', data);
