import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import NewChildForm from '@/components/parent/NewChildForm';

export default async function NewChildPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { parentId } = authContext;
  const orgId = await getOrResolveOrgId();

  // Fetch available schools for this org
  const schoolQuery = supabaseAdmin
    .from('schools')
    .select('id, name, is_active')
    .order('name')
    .eq('org_id', orgId);
  const { data: schools } = await schoolQuery;

  return (
    <NewChildForm
      schools={schools || []}
      parentId={parentId!}
      orgId={orgId}
    />
  );
}

