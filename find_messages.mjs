import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bnjcasmptngkkmtmrnrv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuamNhc21wdG5na2ttdG1ybnJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjI3MCwiZXhwIjoyMDkyNzAyMjcwfQ.Q0DmA0yqwtbzxdVaZo2ipH7rmeX8gvgmezpulP_e6Ao'
);

// Check for announcements/messages tables
const tables = ['announcements', 'messages', 'banners', 'notifications', 'settings', 'site_settings'];
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(5);
  if (!error) {
    console.log(`\n✅ TABLE: ${table}`);
    console.log(JSON.stringify(data, null, 2));
  }
}
