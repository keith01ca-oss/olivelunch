'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// -- BLOCKED SINGLE DATES --

export async function createBlockedDate(date: string, reason: string) {
  if (!date || !reason.trim()) return { error: 'Date and reason are required' };

  const { error } = await supabaseAdmin
    .from('blocked_dates')
    .insert([{ date, reason: reason.trim() }]);

  if (error) {
    if (error.code === '23505') return { error: 'This date is already blocked.' };
    console.error('Error blocking date:', error);
    return { error: 'Failed to block date' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}

export async function deleteBlockedDate(id: string) {
  const { error } = await supabaseAdmin
    .from('blocked_dates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting blocked date:', error);
    return { error: 'Failed to delete blocked date' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}

// -- PRO-D / HOLIDAY RANGES --

export async function createProDRange(startDate: string, endDate: string, message: string) {
  if (!startDate || !endDate || !message.trim()) return { error: 'All fields are required' };
  if (startDate > endDate) return { error: 'Start date must be before end date' };

  const { error } = await supabaseAdmin
    .from('pro_d_ranges')
    .insert([{ start_date: startDate, end_date: endDate, message: message.trim() }]);

  if (error) {
    console.error('Error creating Pro-D range:', error);
    return { error: 'Failed to create range' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}

export async function deleteProDRange(id: string) {
  const { error } = await supabaseAdmin
    .from('pro_d_ranges')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting Pro-D range:', error);
    return { error: 'Failed to delete range' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}

// -- DATE WARNINGS (non-blocking notices) --

export async function createDateWarning(date: string, message: string) {
  if (!date || !message.trim()) return { error: 'Date and message are required' };

  const { error } = await supabaseAdmin
    .from('date_warnings')
    .insert([{ date, message: message.trim() }]);

  if (error) {
    if (error.code === '23505') return { error: 'A warning for this date already exists.' };
    console.error('Error creating date warning:', error);
    return { error: 'Failed to create warning' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}

export async function deleteDateWarning(id: string) {
  const { error } = await supabaseAdmin
    .from('date_warnings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting date warning:', error);
    return { error: 'Failed to delete warning' };
  }

  revalidatePath('/admin/blocked-dates');
  revalidatePath('/menu');
  return { success: true };
}
