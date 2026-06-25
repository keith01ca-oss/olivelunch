import { createClient } from '@supabase/supabase-js';

export type Database = any;

// The Supabase Admin Client using the service_role key.
// This bypasses RLS and should ONLY be used server-side, 
// when we have explicitly verified the user's permissions.
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
