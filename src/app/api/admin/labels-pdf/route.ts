import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import PDFDocument from 'pdfkit';

// Avery 5160 specs (all in points: 1 inch = 72pt)
const PT = 72; // points per inch
const PAGE_W = 8.5 * PT;   // 612pt
const PAGE_H = 11 * PT;    // 792pt
const TOP_MARGIN = 0.5 * PT;    // 36pt
const SIDE_MARGIN = 0.19 * PT;  // 13.68pt
const LABEL_W = 2.625 * PT;    // 189pt
const LABEL_H = 1.0 * PT;      // 72pt
const COL_GAP = 0.125 * PT;    // 9pt
const ROW_GAP = 0;
const COLS = 3;
const ROWS = 10;

// String hash function for consistent icon shape per school
function getStringHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Golden angle color palette for divisions, using hash for consistency
function getDivisionColor(div: string): string {
  const hash = getStringHash(div);
  const hue = (hash * 137.5) % 360;
  const h = hue / 360;
  const s = 0.85;
  const l = 0.45;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const r = Math.round(hue2rgb(h + 1/3) * 255);
  const g = Math.round(hue2rgb(h) * 255);
  const b = Math.round(hue2rgb(h - 1/3) * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Unique BLACK shape index (0-10) per school — no color
function getSchoolShapeIdx(schoolName: string): number {
  if (!schoolName) return 0;
  return getStringHash(schoolName) % 11; // 11 distinct shapes
}

export const dynamic = 'force-dynamic';

import { getOrResolveOrgId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const orgId = await getOrResolveOrgId();

  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 });
  }

  const sortParam = searchParams.get('sort') || '';
  const sortFields = sortParam.split(',').filter(Boolean);

  // Fetch orders
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_date,
      order_items (dish_id, quantity, is_large),
      children (name, division, delivery_location, lunch_time, schools(name, school_routes(stop_order, routes(route_number))))
    `)
    .eq('order_date', date)
    .eq('status', 'paid')
    .eq('org_id', orgId);

  if (error || !orders) {
    return NextResponse.json({ error: error?.message || 'No data' }, { status: 500 });
  }

  // Fetch dishes
  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('id, name, has_large, large_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('org_id', orgId);

  const dishMap: Record<string, { name: string; has_large: boolean; large_name: string | null }> = {};
  (dishes || []).forEach((d: any) => {
    dishMap[d.id] = {
      name: d.name,
      has_large: !!d.has_large,
      large_name: d.large_name
    };
  });

  // --- Per-school division color map ---
  // Rule: within the SAME school, every division gets a distinct color.
  // Different schools independently restart the palette, so they may share colors.
  const COLOR_PALETTE = [
    '#3b6fd4', // blue
    '#d43b3b', // red-orange
    '#2e8b57', // green
    '#c8900a', // yellow
    '#7b3bd4', // purple
    '#1a9e8e', // teal
    '#c43b8a', // pink
    '#d4703b', // orange
    '#1a7fa0', // cyan
    '#5a8a1e', // lime
    '#3b3bd4', // indigo
    '#888888', // gray fallback
  ];
  const schoolDivMap: Record<string, string[]> = {};
  orders.forEach((o: any) => {
    const school = (o.children?.schools as any)?.name || '__unknown__';
    const div = o.children?.division || '';
    if (!div) return;
    if (!schoolDivMap[school]) schoolDivMap[school] = [];
    if (!schoolDivMap[school].includes(div)) schoolDivMap[school].push(div);
  });
  const divColorMap: Record<string, string> = {}; // key: "school::div"
  Object.entries(schoolDivMap).forEach(([school, divs]) => {
    divs.forEach((div, i) => {
      divColorMap[`${school}::${div}`] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
  });

  // --- Sequential school icon map — named pictographic icons matching physical sticker sheet ---
  // ECS EC is reserved for 'cross'. All others get sequential from ICON_ORDER.
  const ICON_ORDER = [
    'heart','star','anchor','crown',
    'lightning','moon','leaf','shield','flower','cloud',
    'snowflake','bell','arrow','fish','owl','elephant','dolphin',
    'horse','swan','panda','cat',
  ];
  const schoolIconMap: Record<string, string> = {};
  let schoolIconIdx = 0;
  orders.forEach((o: any) => {
    const school = (o.children?.schools as any)?.name || '';
    if (school && !(school in schoolIconMap)) {
      if (school === 'ECS EC') {
        schoolIconMap[school] = 'cross';
      } else if (school.toUpperCase().includes('WESTWIND')) {
        schoolIconMap[school] = 'wind';
      } else {
        schoolIconMap[school] = ICON_ORDER[schoolIconIdx % ICON_ORDER.length];
        schoolIconIdx++;
      }
    }
  });

  // Flatten: 1 label per item per quantity
  const labels: any[] = [];
  orders.forEach((order: any) => {
    const schoolName = (order.children?.schools as any)?.name || '';
    const division = order.children?.division || '';
    const divKey = `${schoolName}::${division}`;
    order.order_items.forEach((item: any) => {
      const dishInfo = dishMap[item.dish_id];
      const isLarge = !!item.is_large && !!dishInfo?.has_large;
      const finalDishName = isLarge && dishInfo?.large_name ? dishInfo.large_name : (dishInfo?.name || '');

      for (let q = 0; q < item.quantity; q++) {
        labels.push({
          childName: order.children?.name || '',
          division,
          divKey,
          deliveryLocation: order.children?.delivery_location || '',
          lunchTime: order.children?.lunch_time || '',
          schoolName,
          schoolIcon: schoolIconMap[schoolName] || 'heart',
          stopOrder: (order.children?.schools as any)?.school_routes?.[0]?.stop_order || 0,
          routeNumber: (order.children?.schools as any)?.school_routes?.[0]?.routes?.route_number || '',
          dishName: finalDishName,
          itemNum: q + 1,
          totalQty: item.quantity,
          color: divColorMap[divKey] || '#888888',
        });
      }
    });
  });

  // Sort by cascading sort fields
  const getSortVal = (label: any, field: string): string => {
    if (field === 'dish') return label.dishName || '';
    if (field === 'school') return label.schoolName || '';
    if (field === 'division') return label.division || '';
    if (field === 'childName') return label.childName || '';
    return '';
  };
  const activeSorts = sortFields.length > 0 ? sortFields : ['dish'];
  labels.sort((a, b) => {
    for (const sf of activeSorts) {
      const cmp = getSortVal(a, sf).localeCompare(getSortVal(b, sf));
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  // Format date
  const printDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Build PDF
  const buffers: Buffer[] = [];
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    autoFirstPage: true,
    info: { Title: `Packing Labels - ${date}`, Author: 'Olive Lunch' },
  });

  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const drawLabel = (label: any, col: number, row: number) => {
    const x = SIDE_MARGIN + col * (LABEL_W + COL_GAP);
    const y = TOP_MARGIN + row * (LABEL_H + ROW_GAP);

    const stripW = 4;
    const padL = 24; // Massive left padding to push column 1 right
    const padT = 14; // Massive top padding to push row 1 down
    const padR = 16; // Massive right padding to push column 3 left
    const textW = LABEL_W - padL - padR;

    // Left color strip (pulled inward to x+12 and padded top/bottom)
    doc.save();
    try {
      doc.roundedRect(x + 12, y + padT, stripW, LABEL_H - (padT * 2), 2).fill(label.color);
    } catch { /* ignore color errors */ }
    doc.restore();

    // ROW 1: Name + Division badge
    doc.save()
      .font('Helvetica-Bold')
      .fontSize(7.5) // slightly smaller to fit compressed width
      .fillColor('black')
      .text(
        label.childName.toUpperCase(),
        x + padL,
        y + padT,
        { width: textW - 32, ellipsis: true, lineBreak: false }
      )
      .restore();

    // format time helper
    const formatTimeWithAmPm = (timeStr?: string) => {
      if (!timeStr) return '';
      const lower = timeStr.trim().toLowerCase();
      if (lower.includes('am') || lower.includes('pm')) return lower;
      const parts = lower.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        if (!isNaN(h)) {
          const ampm = h >= 12 ? 'pm' : 'am';
          h = h % 12;
          if (h === 0) h = 12;
          return `${h}:${m}${ampm}`;
        }
      }
      return lower;
    };

    // Division badge (right of name)
    doc.save()
      .roundedRect(x + LABEL_W - padR - 30, y + padT - 1, 30, 9, 1)
      .stroke(label.color)
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor('black')
      .text(label.division, x + LABEL_W - padR - 30, y + padT + 0.5, { width: 30, align: 'center', lineBreak: false })
      .restore();

    // ROW 2: Dish Name + Time
    const dishText = label.totalQty > 1
      ? `${label.dishName}  (${label.itemNum}/${label.totalQty})`
      : label.dishName;

    const lunchTime = formatTimeWithAmPm(label.lunchTime);

    doc.save()
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('black')
      .text(dishText, x + padL, y + padT + 11.5, { width: textW - 25, ellipsis: true, lineBreak: false })
      .restore();

    doc.save()
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor('#222222')
      .text(lunchTime, x + padL + textW - 35, y + padT + 12, { width: 35, align: 'right', lineBreak: false })
      .restore();

    // Dashed divider line
    doc.save()
      .moveTo(x + padL, y + padT + 22)
      .lineTo(x + LABEL_W - padR, y + padT + 22)
      .dash(2, { space: 2 })
      .strokeColor('#888888')
      .lineWidth(0.4)
      .stroke()
      .restore();



    // ROW 4a: School icon (named, always black) + School name on same line
    const symSz = 3.8;
    const symCX = x + padL + symSz + 1;
    const iconRowY = y + LABEL_H - 24;
    const schoolIconW = symSz * 2 + 7;
    const schoolNameW = textW - schoolIconW - 24;

    // Shared helper: draw the correct sticker-matching icon shape in black
    const icon = label.schoolIcon as string;
    doc.save().fillColor('#000000');
    switch (icon) {
      case 'cross': // ✚ physical cross sticker
        doc.rect(symCX - 1.3, iconRowY - symSz, 2.6, symSz * 2).fill();
        doc.rect(symCX - symSz, iconRowY - 1.2, symSz * 2, 2.4).fill();
        break;
      case 'wind': { // 🌀 swirl/wind
        doc.save().strokeColor('#000000').lineWidth(1.5).lineCap('round');
        // draw an archimedean spiral
        let prevX = symCX;
        let prevY = iconRowY;
        for (let i = 1; i <= 30; i++) {
          const t = i * 0.4;
          const a = 0.5; // spiral gap
          const r = a * t;
          const px = symCX + r * Math.cos(t);
          const py = iconRowY + r * Math.sin(t);
          if (r > symSz * 1.1) break; // constrain size
          doc.moveTo(prevX, prevY).lineTo(px, py);
          prevX = px;
          prevY = py;
        }
        doc.stroke().restore().fillColor('#000000');
        break;
      }
      case 'heart': // ♥
        doc.circle(symCX - symSz * 0.5, iconRowY - symSz * 0.2, symSz * 0.62).fill();
        doc.circle(symCX + symSz * 0.5, iconRowY - symSz * 0.2, symSz * 0.62).fill();
        doc.polygon([symCX - symSz * 1.0, iconRowY + symSz * 0.1], [symCX + symSz * 1.0, iconRowY + symSz * 0.1], [symCX, iconRowY + symSz]).fill();
        break;
      case 'star': { // ★ 5-pointed
        const pts: [number,number][] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI / 5) - Math.PI / 2;
          const r = i % 2 === 0 ? symSz : symSz * 0.4;
          pts.push([symCX + r * Math.cos(a), iconRowY + r * Math.sin(a)]);
        }
        doc.polygon(...pts).fill();
        break;
      }
      case 'anchor': // ⚓
        doc.circle(symCX, iconRowY - symSz * 0.65, symSz * 0.4).fill();
        doc.rect(symCX - 1.3, iconRowY - symSz * 0.65, 2.6, symSz * 1.7).fill(); // stem
        doc.rect(symCX - symSz * 0.85, iconRowY - symSz * 0.05, symSz * 1.7, 2.2).fill(); // crossbar
        doc.polygon([symCX - symSz * 0.75, iconRowY + symSz * 0.65], [symCX, iconRowY + symSz], [symCX + symSz * 0.75, iconRowY + symSz * 0.65]).fill(); // base
        break;
      case 'crown': // ♛
        doc.polygon(
          [symCX - symSz, iconRowY + symSz * 0.4],
          [symCX - symSz, iconRowY - symSz * 0.2],
          [symCX - symSz * 0.35, iconRowY + symSz * 0.1],
          [symCX, iconRowY - symSz],
          [symCX + symSz * 0.35, iconRowY + symSz * 0.1],
          [symCX + symSz, iconRowY - symSz * 0.2],
          [symCX + symSz, iconRowY + symSz * 0.4],
        ).fill();
        break;

      case 'lightning': // ⚡
        doc.polygon(
          [symCX + symSz * 0.3, iconRowY - symSz],
          [symCX - symSz * 0.2, iconRowY + symSz * 0.05],
          [symCX + symSz * 0.3, iconRowY + symSz * 0.05],
          [symCX - symSz * 0.3, iconRowY + symSz],
          [symCX + symSz * 0.2, iconRowY - symSz * 0.05],
          [symCX - symSz * 0.3, iconRowY - symSz * 0.05],
        ).fill();
        break;
      case 'moon': // ☽ crescent
        doc.circle(symCX - symSz * 0.1, iconRowY, symSz).fill();
        doc.save().fillColor('white');
        doc.circle(symCX + symSz * 0.38, iconRowY - symSz * 0.12, symSz * 0.78).fill();
        doc.restore().fillColor('#000000');
        break;
      case 'leaf': // 🍃
        doc.polygon(
          [symCX, iconRowY - symSz],
          [symCX + symSz * 0.8, iconRowY + symSz * 0.1],
          [symCX + symSz * 0.5, iconRowY + symSz * 0.7],
          [symCX, iconRowY + symSz],
          [symCX - symSz * 0.5, iconRowY + symSz * 0.7],
          [symCX - symSz * 0.8, iconRowY + symSz * 0.1],
        ).fill();
        break;
      case 'shield': // 🛡
        doc.polygon(
          [symCX - symSz, iconRowY - symSz],
          [symCX + symSz, iconRowY - symSz],
          [symCX + symSz, iconRowY + symSz * 0.2],
          [symCX, iconRowY + symSz],
          [symCX - symSz, iconRowY + symSz * 0.2],
        ).fill();
        break;
      case 'flower': // ✿ 5 petals + centre
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
          doc.circle(symCX + Math.cos(a) * symSz * 0.62, iconRowY + Math.sin(a) * symSz * 0.62, symSz * 0.5).fill();
        }
        doc.save().fillColor('white').circle(symCX, iconRowY, symSz * 0.32).fill().restore().fillColor('#000000');
        break;
      case 'cloud': // ☁
        doc.circle(symCX - symSz * 0.45, iconRowY, symSz * 0.58).fill();
        doc.circle(symCX + symSz * 0.45, iconRowY, symSz * 0.58).fill();
        doc.circle(symCX, iconRowY - symSz * 0.4, symSz * 0.65).fill();
        doc.rect(symCX - symSz, iconRowY, symSz * 2, symSz * 0.58).fill();
        break;
      case 'snowflake': { // ❄ 6 arms
        doc.save().strokeColor('#000000').lineWidth(1.3);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          doc.moveTo(symCX, iconRowY)
             .lineTo(symCX + Math.cos(a) * symSz, iconRowY + Math.sin(a) * symSz);
          const mx = symCX + Math.cos(a) * symSz * 0.5;
          const my = iconRowY + Math.sin(a) * symSz * 0.5;
          const ba = a + Math.PI / 2;
          doc.moveTo(mx + Math.cos(ba) * symSz * 0.3, my + Math.sin(ba) * symSz * 0.3)
             .lineTo(mx - Math.cos(ba) * symSz * 0.3, my - Math.sin(ba) * symSz * 0.3);
        }
        doc.stroke().restore().fillColor('#000000');
        doc.circle(symCX, iconRowY, symSz * 0.2).fill();
        break;
      }
      case 'bell': // 🔔
        doc.polygon(
          [symCX - symSz * 0.2, iconRowY - symSz * 0.85],
          [symCX + symSz * 0.2, iconRowY - symSz * 0.85],
          [symCX + symSz * 0.85, iconRowY + symSz * 0.5],
          [symCX + symSz * 0.95, iconRowY + symSz * 0.65],
          [symCX - symSz * 0.95, iconRowY + symSz * 0.65],
          [symCX - symSz * 0.85, iconRowY + symSz * 0.5],
        ).fill();
        doc.circle(symCX, iconRowY + symSz * 0.82, symSz * 0.22).fill();
        break;
      case 'arrow': // ↑ arrow up
        doc.polygon(
          [symCX, iconRowY - symSz],
          [symCX + symSz * 0.6, iconRowY - symSz * 0.1],
          [symCX + symSz * 0.28, iconRowY - symSz * 0.1],
          [symCX + symSz * 0.28, iconRowY + symSz],
          [symCX - symSz * 0.28, iconRowY + symSz],
          [symCX - symSz * 0.28, iconRowY - symSz * 0.1],
          [symCX - symSz * 0.6, iconRowY - symSz * 0.1],
        ).fill();
        break;
      case 'fish': // 🐟 simplified body + tail
        doc.ellipse(symCX + symSz * 0.1, iconRowY, symSz * 0.75, symSz * 0.45).fill();
        doc.polygon([symCX - symSz * 0.7, iconRowY - symSz * 0.5], [symCX - symSz, iconRowY], [symCX - symSz * 0.7, iconRowY + symSz * 0.5]).fill();
        break;
      case 'owl': // 🦉 two circles + ears
        doc.ellipse(symCX, iconRowY + symSz * 0.15, symSz * 0.85, symSz).fill(); // body
        doc.save().fillColor('white').circle(symCX - symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.28).fill(); // left eye
        doc.circle(symCX + symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.28).fill().restore().fillColor('#000000'); // right eye
        doc.circle(symCX - symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.14).fill();
        doc.circle(symCX + symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.14).fill();
        doc.polygon([symCX - symSz * 0.55, iconRowY - symSz * 0.75], [symCX - symSz * 0.7, iconRowY - symSz], [symCX - symSz * 0.3, iconRowY - symSz * 0.65]).fill(); // ear L
        doc.polygon([symCX + symSz * 0.55, iconRowY - symSz * 0.75], [symCX + symSz * 0.7, iconRowY - symSz], [symCX + symSz * 0.3, iconRowY - symSz * 0.65]).fill(); // ear R
        break;
      case 'elephant': // 🐘 simplified
        doc.ellipse(symCX + symSz * 0.1, iconRowY - symSz * 0.15, symSz, symSz * 0.75).fill(); // body
        doc.circle(symCX - symSz * 0.45, iconRowY - symSz * 0.65, symSz * 0.45).fill(); // head
        // trunk curves down
        doc.polygon([symCX - symSz * 0.75, iconRowY - symSz * 0.35], [symCX - symSz * 0.9, iconRowY + symSz * 0.5], [symCX - symSz * 0.65, iconRowY + symSz * 0.5], [symCX - symSz * 0.55, iconRowY - symSz * 0.35]).fill();
        break;
      case 'dolphin': // 🐬 simplified
        doc.ellipse(symCX, iconRowY + symSz * 0.1, symSz * 0.9, symSz * 0.45).fill(); // body
        doc.polygon([symCX + symSz * 0.75, iconRowY - symSz * 0.1], [symCX + symSz, iconRowY - symSz * 0.6], [symCX + symSz * 0.55, iconRowY]).fill(); // dorsal fin
        doc.polygon([symCX - symSz * 0.8, iconRowY], [symCX - symSz, iconRowY - symSz * 0.4], [symCX - symSz, iconRowY + symSz * 0.4]).fill(); // tail
        break;
      case 'horse': // 🐴 simplified body + head
        doc.ellipse(symCX, iconRowY + symSz * 0.2, symSz * 0.75, symSz * 0.6).fill(); // body
        doc.ellipse(symCX - symSz * 0.4, iconRowY - symSz * 0.55, symSz * 0.38, symSz * 0.5).fill(); // neck+head
        // legs
        doc.rect(symCX - symSz * 0.45, iconRowY + symSz * 0.65, symSz * 0.18, symSz * 0.4).fill();
        doc.rect(symCX + symSz * 0.27, iconRowY + symSz * 0.65, symSz * 0.18, symSz * 0.4).fill();
        break;
      case 'swan': // 🦢 simplified
        doc.ellipse(symCX + symSz * 0.15, iconRowY + symSz * 0.3, symSz * 0.9, symSz * 0.5).fill(); // body
        doc.ellipse(symCX - symSz * 0.35, iconRowY - symSz * 0.3, symSz * 0.28, symSz * 0.6).fill(); // neck
        doc.circle(symCX - symSz * 0.5, iconRowY - symSz * 0.75, symSz * 0.22).fill(); // head
        break;
      case 'panda': // 🐼 simplified
        doc.circle(symCX, iconRowY + symSz * 0.1, symSz * 0.75).fill(); // body (black)
        doc.save().fillColor('white').circle(symCX, iconRowY + symSz * 0.1, symSz * 0.55).fill().restore().fillColor('#000000'); // white tummy
        doc.circle(symCX, iconRowY - symSz * 0.55, symSz * 0.42).fill(); // head
        doc.circle(symCX - symSz * 0.25, iconRowY - symSz * 0.62, symSz * 0.22).fill(); // eye patch L
        doc.circle(symCX + symSz * 0.25, iconRowY - symSz * 0.62, symSz * 0.22).fill(); // eye patch R
        break;
      case 'cat': // 🐱 simplified
        doc.circle(symCX, iconRowY - symSz * 0.05, symSz * 0.72).fill(); // head
        doc.polygon([symCX - symSz * 0.55, iconRowY - symSz * 0.6], [symCX - symSz * 0.8, iconRowY - symSz], [symCX - symSz * 0.3, iconRowY - symSz * 0.7]).fill(); // ear L
        doc.polygon([symCX + symSz * 0.55, iconRowY - symSz * 0.6], [symCX + symSz * 0.8, iconRowY - symSz], [symCX + symSz * 0.3, iconRowY - symSz * 0.7]).fill(); // ear R
        break;
      default: // fallback: circle
        doc.circle(symCX, iconRowY, symSz).fill();
    }
    doc.restore();

    // School Name + Delivery Location — same Y as icon, single line, no wrap
    const schoolDelivText = label.deliveryLocation 
      ? `${label.schoolName.toUpperCase()} - ${label.deliveryLocation.toUpperCase()}`
      : label.schoolName.toUpperCase();

    doc.save()
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor('black')
      .text(
        schoolDelivText,
        x + padL + schoolIconW, iconRowY - 3.2,
        { width: schoolNameW, ellipsis: true, lineBreak: false }
      )
      .restore();

    // ROW 4b: Route + Stop + Date
    let routeText = '';
    if (label.routeNumber) routeText += `Rt ${label.routeNumber}`;
    if (label.stopOrder > 0) routeText += (routeText ? ` - Stop ${label.stopOrder}` : `Stop ${label.stopOrder}`);

    doc.save()
      .font('Helvetica-Bold')
      .fontSize(5)
      .fillColor('#666666')
      .text(routeText, x + padL, y + LABEL_H - 14, { width: textW * 0.6, ellipsis: true, lineBreak: false })
      .fontSize(5)
      .fillColor('#888888')
      .text(printDate, x + padL + textW * 0.6, y + LABEL_H - 14, { width: textW * 0.4, align: 'right', lineBreak: false })
      .restore();
  };

  // Draw all labels
  labels.forEach((label, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS) % ROWS;
    const pageIndex = Math.floor(i / (COLS * ROWS));

    if (i > 0 && col === 0 && row === 0) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    }

    drawLabel(label, col, row);
  });

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="labels-${date}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  });
}
