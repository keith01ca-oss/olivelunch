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

  // Fetch parent suggestions/feedback
  const { data: suggestions } = await supabaseAdmin
    .from('suggestions')
    .select(`
      id,
      content,
      created_at,
      parents (
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  // Fetch active messages
  const { data: dbMessages } = await supabaseAdmin
    .from('dashboard_messages')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);

  const infoMessage = dbMessages?.find((m: any) => m.type === 'info')?.message || '';
  const warningMessage = dbMessages?.find((m: any) => m.type === 'warning')?.message || '';

  return (
    <SettingsClient
      org={org}
      initialSuggestions={(suggestions as any) || []}
      initialInfoMessage={infoMessage}
      initialWarningMessage={warningMessage}
    />
  );
}
