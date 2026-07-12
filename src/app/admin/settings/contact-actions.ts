'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export async function resolveContactMessage(messageId: string) {
  try {
    const authContext = await requireAdmin();
    if ('error' in authContext) return { error: authContext.error };

    const { error } = await supabaseAdmin
      .from('contact_messages')
      .update({ status: 'resolved' })
      .eq('id', messageId);

    if (error) {
      console.error('Error resolving contact message:', error);
      return { error: 'Failed to resolve message' };
    }

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
