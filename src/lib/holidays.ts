import { supabaseAdmin } from './supabase';

function getEasterSunday(y: number) {
  const f = Math.floor;
  const a = y % 19;
  const b = f(y / 100);
  const c = y % 100;
  const d = f(b / 4);
  const e = b % 4;
  const g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 19 * l) / 433);
  const month = f((h + l - 7 * m + 90) / 25);
  const day = (h + l - 7 * m + 33 * month + 19) % 32;
  return { month, day };
}

export function getBCHolidays(year: number) {
  const holidays: { date: string; name: string }[] = [];

  // 1. New Year's Day - Jan 1
  holidays.push({ date: `${year}-01-01`, name: "New Year's Day" });

  // 2. Family Day - 3rd Monday in Feb
  const feb1 = new Date(Date.UTC(year, 1, 1));
  const feb1Day = feb1.getUTCDay();
  const firstMonOffset = (1 - feb1Day + 7) % 7;
  const familyDayDate = 1 + firstMonOffset + 14;
  holidays.push({ date: `${year}-02-${String(familyDayDate).padStart(2, '0')}`, name: "Family Day" });

  // 3. Good Friday - Friday before Easter
  const easter = getEasterSunday(year);
  const easterSunday = new Date(Date.UTC(year, easter.month - 1, easter.day));
  const goodFriday = new Date(easterSunday.getTime() - 2 * 24 * 60 * 60 * 1000);
  const gfMonth = goodFriday.getUTCMonth() + 1;
  const gfDay = goodFriday.getUTCDate();
  holidays.push({ date: `${year}-${String(gfMonth).padStart(2, '0')}-${String(gfDay).padStart(2, '0')}`, name: "Good Friday" });

  // Easter Monday
  const easterMonday = new Date(easterSunday.getTime() + 1 * 24 * 60 * 60 * 1000);
  const emMonth = easterMonday.getUTCMonth() + 1;
  const emDay = easterMonday.getUTCDate();
  holidays.push({ date: `${year}-${String(emMonth).padStart(2, '0')}-${String(emDay).padStart(2, '0')}`, name: "Easter Monday (School Holiday)" });

  // 4. Victoria Day - Monday preceding May 25
  const may25 = new Date(Date.UTC(year, 4, 25));
  const may25Day = may25.getUTCDay();
  const daysToSubtract = may25Day === 1 ? 7 : (may25Day - 1 + 7) % 7;
  const vicDay = new Date(may25.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
  const vicMonth = vicDay.getUTCMonth() + 1;
  const vicDate = vicDay.getUTCDate();
  holidays.push({ date: `${year}-${String(vicMonth).padStart(2, '0')}-${String(vicDate).padStart(2, '0')}`, name: "Victoria Day" });

  // 5. Canada Day - July 1
  holidays.push({ date: `${year}-07-01`, name: "Canada Day" });

  // 6. BC Day - 1st Monday in August
  const aug1 = new Date(Date.UTC(year, 7, 1));
  const aug1Day = aug1.getUTCDay();
  const augOffset = (1 - aug1Day + 7) % 7;
  const bcDayDate = 1 + augOffset;
  holidays.push({ date: `${year}-08-${String(bcDayDate).padStart(2, '0')}`, name: "British Columbia Day" });

  // 7. Labour Day - 1st Monday in September
  const sept1 = new Date(Date.UTC(year, 8, 1));
  const sept1Day = sept1.getUTCDay();
  const septOffset = (1 - sept1Day + 7) % 7;
  const labourDayDate = 1 + septOffset;
  holidays.push({ date: `${year}-09-${String(labourDayDate).padStart(2, '0')}`, name: "Labour Day" });

  // 8. National Day for Truth and Reconciliation - Sept 30
  holidays.push({ date: `${year}-09-30`, name: "National Day for Truth and Reconciliation" });

  // 9. Thanksgiving Day - 2nd Monday in October
  const oct1 = new Date(Date.UTC(year, 9, 1));
  const oct1Day = oct1.getUTCDay();
  const octOffset = (1 - oct1Day + 7) % 7;
  const thanksgivingDate = 1 + octOffset + 7;
  holidays.push({ date: `${year}-10-${String(thanksgivingDate).padStart(2, '0')}`, name: "Thanksgiving Day" });

  // 10. Remembrance Day - Nov 11
  holidays.push({ date: `${year}-11-11`, name: "Remembrance Day" });

  // 11. Christmas Day - Dec 25
  holidays.push({ date: `${year}-12-25`, name: "Christmas Day" });

  // 12. Boxing Day - Dec 26
  holidays.push({ date: `${year}-12-26`, name: "Boxing Day (School Holiday)" });

  return holidays;
}

export async function syncBCHolidays() {
  try {
    const today = new Date();
    // Resolve year/month safely using timezone-independent getters
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Get holidays for current and next year
    const holidays = [
      ...getBCHolidays(currentYear),
      ...getBCHolidays(currentYear + 1)
    ];

    // 1. Upsert holidays to database
    const { error: upsertError } = await supabaseAdmin
      .from('blocked_dates')
      .upsert(
        holidays.map(h => ({ date: h.date, reason: h.name })),
        { onConflict: 'date' } as any
      );

    if (upsertError) {
      console.error('syncBCHolidays: DB upsert error:', upsertError);
      return { error: upsertError };
    }

    // 2. Delete old blocked dates where month has passed
    const startOfCurrentMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const { error: deleteError } = await supabaseAdmin
      .from('blocked_dates')
      .delete()
      .lt('date', startOfCurrentMonth);

    if (deleteError) {
      console.error('syncBCHolidays: DB delete old dates error:', deleteError);
    }

    return { success: true };
  } catch (err) {
    console.error('syncBCHolidays: unexpected error:', err);
    return { error: err };
  }
}
