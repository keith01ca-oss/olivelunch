import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import SettingsClient from '@/components/parent/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function UserSettingsPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { parentId } = authContext;
  const orgId = await getOrResolveOrgId();

  // Fetch Parent Data
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, name, email, is_vip, referral_code')
    .eq('id', parentId)
    .single();

  // Fetch Children
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, name, division, school_id, delivery_location, lunch_time, schools(name)')
    .eq('parent_id', parentId)
    .is('deleted_at', null);

  // Fetch Schools for the add/edit child form
  const { data: schools } = await supabaseAdmin
    .from('schools')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name');

  // Fetch Credits History
  const { data: credits } = await supabaseAdmin
    .from('credits')
    .select('id, amount, source, created_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  // Fetch Org Contact Info
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  return (
    <SettingsClient
      parent={parent}
      childrenList={children || []}
      schools={schools || []}
      credits={credits || []}
      orgId={orgId!}
      contactPhone={org?.settings?.contact_phone || ''}
      contactEmail={org?.settings?.contact_email || ''}
      contactWhatsapp={org?.settings?.contact_whatsapp || ''}
    />
  );
}
