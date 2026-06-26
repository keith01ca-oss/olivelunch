import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bnjcasmptngkkmtmrnrv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuamNhc21wdG5na2ttdG1ybnJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjI3MCwiZXhwIjoyMDkyNzAyMjcwfQ.Q0DmA0yqwtbzxdVaZo2ipH7rmeX8gvgmezpulP_e6Ao'
);

// Step 1: Show all parents in the database
const { data: parents, error } = await supabase
  .from('parents')
  .select('id, clerk_user_id, email, name, created_at')
  .order('created_at', { ascending: false });

if (error) {
  console.error('Error fetching parents:', error);
  process.exit(1);
}

console.log('\n=== ALL PARENTS IN DATABASE ===');
parents.forEach(p => {
  console.log(`ID: ${p.id}`);
  console.log(`  Email: ${p.email}`);
  console.log(`  Name: ${p.name}`);
  console.log(`  Clerk ID: ${p.clerk_user_id}`);
  console.log(`  Created: ${p.created_at}`);
  console.log('---');
});

// Step 2: Check what Clerk User ID is the current production admin
const adminClerkId = 'user_3CrNlD3MciY6GagIGaCT9KkdmC3';
console.log(`\n=== CHECKING ADMIN CLERK ID: ${adminClerkId} ===`);

const adminParent = parents.find(p => p.clerk_user_id === adminClerkId);
if (adminParent) {
  console.log('Admin parent found:', adminParent.email);
} else {
  console.log('Admin clerk ID not found in parents table.');
  console.log('Looking for parent that might need updating...');
}
