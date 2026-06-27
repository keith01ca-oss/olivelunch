'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getResolvedParent } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function verifyAdmin() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) throw new Error('Unauthorized');
  
  const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  const isSuperAdmin = allowedIds.length > 0 && allowedIds.includes(authContext.clerkUserId);
  if (!isSuperAdmin) {
    throw new Error('Forbidden');
  }
  return authContext;
}

export async function saveDashboardMessages(orgId: string, messages: { info: string; warning: string }) {
  await verifyAdmin();

  // Handle Info Message
  const { data: existingInfo } = await supabaseAdmin
    .from('dashboard_messages')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', 'info')
    .eq('is_active', true)
    .limit(1);

  if (existingInfo && existingInfo.length > 0) {
    await supabaseAdmin
      .from('dashboard_messages')
      .update({ message: messages.info.trim() } as any)
      .eq('id', existingInfo[0].id);
  } else {
    await supabaseAdmin
      .from('dashboard_messages')
      .insert({ org_id: orgId, message: messages.info.trim(), type: 'info', is_active: true } as any);
  }

  // Handle Warning Message
  const { data: existingWarning } = await supabaseAdmin
    .from('dashboard_messages')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', 'warning')
    .eq('is_active', true)
    .limit(1);

  if (existingWarning && existingWarning.length > 0) {
    await supabaseAdmin
      .from('dashboard_messages')
      .update({ message: messages.warning.trim() } as any)
      .eq('id', existingWarning[0].id);
  } else {
    await supabaseAdmin
      .from('dashboard_messages')
      .insert({ org_id: orgId, message: messages.warning.trim(), type: 'warning', is_active: true } as any);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteSuggestion(id: string) {
  await verifyAdmin();

  const { error } = await supabaseAdmin
    .from('suggestions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error('Failed to delete suggestion');
  }

  revalidatePath('/admin/settings');
  return { success: true };
}
