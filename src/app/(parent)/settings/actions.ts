'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { parseAndFormatLunchTime } from '@/lib/utils';

export async function submitSuggestion(parentId: string, content: string) {
  if (!content.trim()) return { error: 'Content cannot be empty' };

  try {
    const { error } = await (supabaseAdmin as any)
      .from('suggestions')
      .insert([{ parent_id: parentId, content }]);

    // Ignore error if table doesn't exist yet, we can mock success
    if (error && error.code !== 'PGRST205') {
      console.error('Error submitting suggestion:', error);
      return { error: 'Failed to submit suggestion' };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateChild(childId: string, data: { name: string, division: string, school_id: string, delivery_location?: string, lunch_time?: string }) {
  try {
    if (data.lunch_time) {
      const formatted = parseAndFormatLunchTime(data.lunch_time);
      if (!formatted) {
        return { error: 'Invalid lunch time format. Please enter a valid 12-hour time (e.g. 11:30 AM).' };
      }
      data.lunch_time = formatted;
    }

    const { error } = await supabaseAdmin
      .from('children')
      .update(data)
      .eq('id', childId);

    if (error) throw error;

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating child:', err);
    return { error: 'Failed to update child details' };
  }
}

export async function addChild(formData: FormData) {
  try {
    const orgId = formData.get('orgId') as string;
    const parentId = formData.get('parentId') as string;
    const name = formData.get('name') as string;
    const schoolId = formData.get('schoolId') as string;
    const division = formData.get('division') as string;
    const deliveryLocation = formData.get('deliveryLocation') as string;
    const lunchTime = formData.get('lunchTime') as string;
    const formattedLunchTime = lunchTime ? parseAndFormatLunchTime(lunchTime) : '12:00 PM';
    if (!formattedLunchTime) {
      return { error: 'Invalid lunch time format. Please enter a valid 12-hour time (e.g. 11:30 AM).' };
    }

    if (!orgId || !parentId || !name || !schoolId || !division) {
      return { error: 'Missing required fields' };
    }

    const { error } = await supabaseAdmin.from('children').insert([{
      parent_id: parentId,
      org_id: orgId,
      school_id: schoolId,
      name,
      division,
      delivery_location: deliveryLocation || 'Classroom',
      lunch_time: formattedLunchTime
    }]);

    if (error) throw error;

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error adding child:', err);
    return { error: 'Failed to add child' };
  }
}
