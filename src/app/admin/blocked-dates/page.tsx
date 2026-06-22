import { supabaseAdmin } from '@/lib/supabase';
import BlockedDatesClient from '@/components/admin/BlockedDatesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminBlockedDatesPage() {
  const [{ data: blockedDates }, { data: prodRanges }, { data: dateWarnings }] = await Promise.all([
    supabaseAdmin.from('blocked_dates').select('*').order('date'),
    supabaseAdmin.from('pro_d_ranges').select('*').order('start_date'),
    supabaseAdmin.from('date_warnings').select('*').order('date'),
  ]);

  return (
    <BlockedDatesClient
      initialBlockedDates={blockedDates || []}
      initialProDRanges={prodRanges || []}
      initialDateWarnings={dateWarnings || []}
    />
  );
}
