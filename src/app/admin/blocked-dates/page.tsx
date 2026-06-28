import { supabaseAdmin } from '@/lib/supabase';
import BlockedDatesClient from '@/components/admin/BlockedDatesClient';
import { syncBCHolidays } from '@/lib/holidays';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminBlockedDatesPage() {
  // Automatically sync public holidays and clear old months on page load
  try {
    await syncBCHolidays();
  } catch (err) {
    console.error('Failed to sync holidays on page load:', err);
  }

  const [blockedDatesRes, prodRangesRes, dateWarningsRes] = await Promise.all([
    supabaseAdmin.from('blocked_dates').select('*').order('date'),
    supabaseAdmin.from('pro_d_ranges').select('*').order('start_date'),
    supabaseAdmin.from('date_warnings').select('*').order('date'),
  ]);

  if (blockedDatesRes.error) console.error('Error fetching blocked dates:', blockedDatesRes.error);
  if (prodRangesRes.error) console.error('Error fetching pro-d ranges:', prodRangesRes.error);
  if (dateWarningsRes.error) console.error('Error fetching date warnings:', dateWarningsRes.error);

  return (
    <BlockedDatesClient
      initialBlockedDates={blockedDatesRes.data || []}
      initialProDRanges={prodRangesRes.data || []}
      initialDateWarnings={dateWarningsRes.data || []}
    />
  );
}
