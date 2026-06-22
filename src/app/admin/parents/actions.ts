'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function addManualCredit(parentId: string, amount: number, note: string) {
  if (!parentId || !amount || amount === 0) return { error: 'Parent and amount are required' };

  const { error } = await supabaseAdmin.from('credits').insert({
    parent_id: parentId,
    amount,
    source: 'manual',
    order_id: null,
  });

  if (error) {
    console.error('Failed to add manual credit:', error);
    return { error: 'Failed to add credit' };
  }

  revalidatePath('/admin/parents');
  return { success: true };
}

export async function toggleVipStatus(parentId: string, isVip: boolean) {
  const { error } = await supabaseAdmin
    .from('parents')
    .update({ is_vip: isVip })
    .eq('id', parentId);

  if (error) {
    console.error('Failed to toggle VIP:', error);
    return { error: 'Failed to update VIP status' };
  }

  revalidatePath('/admin/parents');
  return { success: true };
}

export async function broadcastEmail(
  recipientIds: string[],  // empty = all parents
  subject: string,
  htmlBody: string,
) {
  if (!subject.trim() || !htmlBody.trim()) return { error: 'Subject and message are required' };

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);

  // Fetch recipients
  let query = supabaseAdmin.from('parents').select('name, email');
  if (recipientIds.length > 0) {
    query = query.in('id', recipientIds);
  }
  const { data: recipients, error: fetchErr } = await query;
  if (fetchErr || !recipients || recipients.length === 0) {
    return { error: 'No recipients found' };
  }

  // Send in batches of 50 (Resend free tier limit)
  const BATCH = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        const res = await resend.emails.send({
          from: 'Olive Lunch <hello@olivelunch.com>', // Note: This domain must be verified in Resend, otherwise use 'onboarding@resend.dev'
          to: r.email,
          subject,
          html: htmlBody.replace(/\{name\}/g, r.name),
        });
        if (res.error) throw new Error(res.error.message);
        return res.data;
      })
    );
    results.forEach(r => {
      if (r.status === 'fulfilled') sent++;
      else {
        failed++;
        console.error('Resend error:', r.reason);
      }
    });
  }

  return { success: true, sent, failed };
}
