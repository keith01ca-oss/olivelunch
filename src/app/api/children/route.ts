import { NextRequest, NextResponse } from 'next/server';
import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { parseAndFormatLunchTime } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const schoolId = formData.get('schoolId') as string;
    const division = formData.get('division') as string;
    const deliveryLocation = formData.get('deliveryLocation') as string;
    const lunchTime = formData.get('lunchTime') as string;

    if (!name || !schoolId || !division) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const formattedLunchTime = lunchTime ? parseAndFormatLunchTime(lunchTime) : null;
    if (lunchTime && !formattedLunchTime) {
      return NextResponse.json({ error: 'Invalid lunch time format. Please enter a valid 12-hour time (e.g. 11:30 AM).' }, { status: 400 });
    }

    // Count existing children for this parent
    const { count, error: countErr } = await supabaseAdmin
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', authContext.parentId)
      .is('deleted_at', null);

    if (countErr) throw countErr;

    if (count !== null && count >= 4) {
      return NextResponse.json({ error: 'each account max 4 child' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('children')
      .insert({
        parent_id: authContext.parentId,
        name,
        school_id: schoolId,
        division,
        delivery_location: deliveryLocation || null,
        lunch_time: formattedLunchTime || null
      });

    if (error) throw error;

    // Redirect back to dashboard on success
    return NextResponse.redirect(new URL('/dashboard', req.url), 303);
  } catch (error) {
    console.error('Error adding child:', error);
    return NextResponse.json({ error: 'Failed to add child' }, { status: 500 });
  }
}

