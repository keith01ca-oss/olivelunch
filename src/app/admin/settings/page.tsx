import { supabaseAdmin } from '@/lib/supabase';
import SettingsClient from '@/components/admin/SettingsClient';
import { redirect } from 'next/navigation';
import { getOrResolveOrgId } from '@/lib/auth';

export default async function AdminSettingsPage() {
  const orgId = await getOrResolveOrgId();

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org) redirect('/admin');

  return <SettingsClient org={org} />;
}
