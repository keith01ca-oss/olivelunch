// Avery 5160 specs (all in points: 1 inch = 72pt)
export const PT = 72; // points per inch
export const PAGE_W = 8.5 * PT;   // 612pt
export const PAGE_H = 11 * PT;    // 792pt
export const TOP_MARGIN = 0.5 * PT;    // 36pt
export const SIDE_MARGIN = 0.19 * PT;  // 13.68pt
export const LABEL_W = 2.625 * PT;    // 189pt
export const LABEL_H = 1.0 * PT;      // 72pt
export const COL_GAP = 0.125 * PT;    // 9pt
export const ROW_GAP = 0;
export const COLS = 3;
export const ROWS = 10;
export const LABELS_PER_PAGE = 30;

export const COLOR_PALETTE = [
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

export const ICON_ORDER = [
  'heart', 'star', 'crown',
  'lightning', 'moon', 'leaf', 'shield', 'flower', 'cloud',
  'snowflake', 'bell', 'arrow', 'fish', 'owl', 'elephant', 'dolphin',
  'horse', 'swan', 'panda', 'cat',
];

export function getStringHash(str: string): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getSchoolIconName(schoolName: string): string {
  if (!schoolName) return 'heart';
  const schoolUpper = schoolName.toUpperCase();
  if (schoolUpper.includes('ECS') || schoolUpper.includes('RCS')) {
    return 'cross';
  } else if (schoolUpper.includes('WESTWIND')) {
    return 'wind';
  } else {
    const hash = getStringHash(schoolName);
    return ICON_ORDER[hash % ICON_ORDER.length];
  }
}

export interface StandardLabelData {
  childName: string;
  division: string;
  dishName: string;
  schoolName: string;
  orderDate?: string;
  deliveryLocation?: string;
  lunchTime?: string;
  routeNumber?: string;
  stopOrder?: number;
  itemNum?: number;
  totalQty?: number;
  color?: string;
  isLarge?: boolean;
  schoolIcon?: string;
  componentIndex?: number;
  componentTotal?: number;
}

/**
 * Renders a single Avery 5160 label into a PDFDocument (pdfkit).
 */
export function drawAvery5160Label(doc: any, label: StandardLabelData, col: number, row: number) {
  const x = SIDE_MARGIN + col * (LABEL_W + COL_GAP);
  const y = TOP_MARGIN + row * (LABEL_H + ROW_GAP);

  const stripW = 4;
  const padL = 20; // Left padding to clear color strip
  const padR = 12; // Right padding
  const textW = LABEL_W - padL - padR;

  const color = label.color || '#3b6fd4';

  // 1. Left color strip
  doc.save();
  try {
    doc.roundedRect(x + 10, y + 7, stripW, LABEL_H - 14, 2).fill(color);
  } catch { /* ignore color errors */ }
  doc.restore();

  // 2. LINE 1: Child Name (left), Lunch Time, Division Badge (right)
  const badgeW = 26;
  const badgeH = 9;
  const badgeX = x + LABEL_W - padR - badgeW;
  const line1Y = y + 7.5;

  // Division badge (far right)
  if (label.division) {
    doc.save()
      .roundedRect(badgeX, line1Y - 1, badgeW, badgeH, 1.5)
      .stroke(color)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor('black')
      .text(label.division, badgeX, line1Y + 0.5, { width: badgeW, align: 'center', lineBreak: false })
      .restore();
  }

  // Lunch Time (immediately to the left of division badge)
  const lunchTime = label.lunchTime || '';
  const timeW = lunchTime ? 38 : 0;
  const timeX = badgeX - timeW - 4;
  if (lunchTime) {
    doc.save()
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor('black')
      .text(lunchTime, timeX, line1Y, { width: timeW, align: 'right', lineBreak: false })
      .restore();
  }

  // Child Name (left of Time)
  const nameMaxW = textW - (label.division ? badgeW : 0) - (timeW ? timeW + 8 : 4);
  doc.save()
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('black')
    .text(
      (label.childName || '').toUpperCase(),
      x + padL,
      line1Y,
      { width: Math.max(20, nameMaxW), ellipsis: true, lineBreak: false }
    )
    .restore();

  // 3. LINES 2 & 3: Menu / Dish Name (wrapped up to 2 lines)
  let finalDishName = label.dishName || '';
  if (label.componentTotal && label.componentTotal > 1) {
    finalDishName += ` [${label.componentIndex || 1}/${label.componentTotal}]`;
  }
  const dishText = (label.totalQty && label.totalQty > 1)
    ? `${finalDishName}  (${label.itemNum || 1}/${label.totalQty})`
    : finalDishName;

  const line2Y = y + 18.5;
  doc.save()
    .font('Helvetica-Bold')
    .fontSize(7.2);

  if (label.isLarge) {
    doc.fillColor('black')
       .text(dishText + ' ', x + padL, line2Y, {
         width: textW,
         height: 19,
         lineGap: 1,
         ellipsis: true,
         continued: true
       })
       .fillColor('#d43b3b') // red color
       .text('( Lg )');
  } else {
    doc.fillColor('black')
       .text(dishText, x + padL, line2Y, {
         width: textW,
         height: 19,
         lineGap: 1,
         ellipsis: true
       });
  }
  doc.restore();

  // 4. LINE 4: School Icon + School Name ONLY
  const symSz = 3.5;
  const symCX = x + padL + symSz + 1;
  const iconRowY = y + 42.5;
  const schoolIconW = symSz * 2 + 5;
  const schoolNameW = textW - schoolIconW;

  const icon = label.schoolIcon || getSchoolIconName(label.schoolName);
  doc.save().fillColor('#000000');
  switch (icon) {
    case 'cross': // ✚ physical cross sticker
      doc.rect(symCX - 1.3, iconRowY - symSz, 2.6, symSz * 2).fill();
      doc.rect(symCX - symSz, iconRowY - 1.2, symSz * 2, 2.4).fill();
      break;
    case 'wind': { // 🌀 swirl/wind
      doc.save().strokeColor('#000000').lineWidth(1.5).lineCap('round');
      let prevX = symCX;
      let prevY = iconRowY;
      for (let i = 1; i <= 30; i++) {
        const t = i * 0.4;
        const a = 0.5;
        const r = a * t;
        const px = symCX + r * Math.cos(t);
        const py = iconRowY + r * Math.sin(t);
        if (r > symSz * 1.1) break;
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
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? symSz : symSz * 0.4;
        pts.push([symCX + r * Math.cos(a), iconRowY + r * Math.sin(a)]);
      }
      doc.polygon(...pts).fill();
      break;
    }
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
    case 'arrow': // ↑
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
    case 'fish': // 🐟
      doc.ellipse(symCX + symSz * 0.1, iconRowY, symSz * 0.75, symSz * 0.45).fill();
      doc.polygon([symCX - symSz * 0.7, iconRowY - symSz * 0.5], [symCX - symSz, iconRowY], [symCX - symSz * 0.7, iconRowY + symSz * 0.5]).fill();
      break;
    case 'owl': // 🦉
      doc.ellipse(symCX, iconRowY + symSz * 0.15, symSz * 0.85, symSz).fill();
      doc.save().fillColor('white').circle(symCX - symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.28).fill();
      doc.circle(symCX + symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.28).fill().restore().fillColor('#000000');
      doc.circle(symCX - symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.14).fill();
      doc.circle(symCX + symSz * 0.32, iconRowY - symSz * 0.1, symSz * 0.14).fill();
      doc.polygon([symCX - symSz * 0.55, iconRowY - symSz * 0.75], [symCX - symSz * 0.7, iconRowY - symSz], [symCX - symSz * 0.3, iconRowY - symSz * 0.65]).fill();
      doc.polygon([symCX + symSz * 0.55, iconRowY - symSz * 0.75], [symCX + symSz * 0.7, iconRowY - symSz], [symCX + symSz * 0.3, iconRowY - symSz * 0.65]).fill();
      break;
    case 'elephant': // 🐘
      doc.ellipse(symCX + symSz * 0.1, iconRowY - symSz * 0.15, symSz, symSz * 0.75).fill();
      doc.circle(symCX - symSz * 0.45, iconRowY - symSz * 0.65, symSz * 0.45).fill();
      doc.polygon([symCX - symSz * 0.75, iconRowY - symSz * 0.35], [symCX - symSz * 0.9, iconRowY + symSz * 0.5], [symCX - symSz * 0.65, iconRowY + symSz * 0.5], [symCX - symSz * 0.55, iconRowY - symSz * 0.35]).fill();
      break;
    case 'dolphin': // 🐬
      doc.ellipse(symCX, iconRowY + symSz * 0.1, symSz * 0.9, symSz * 0.45).fill();
      doc.polygon([symCX + symSz * 0.75, iconRowY - symSz * 0.1], [symCX + symSz, iconRowY - symSz * 0.6], [symCX + symSz * 0.55, iconRowY]).fill();
      doc.polygon([symCX - symSz * 0.8, iconRowY], [symCX - symSz, iconRowY - symSz * 0.4], [symCX - symSz, iconRowY + symSz * 0.4]).fill();
      break;
    case 'horse': // 🐴
      doc.ellipse(symCX, iconRowY + symSz * 0.2, symSz * 0.75, symSz * 0.6).fill();
      doc.ellipse(symCX - symSz * 0.4, iconRowY - symSz * 0.55, symSz * 0.38, symSz * 0.5).fill();
      doc.rect(symCX - symSz * 0.45, iconRowY + symSz * 0.65, symSz * 0.18, symSz * 0.4).fill();
      doc.rect(symCX + symSz * 0.27, iconRowY + symSz * 0.65, symSz * 0.18, symSz * 0.4).fill();
      break;
    case 'swan': // 🦢
      doc.ellipse(symCX + symSz * 0.15, iconRowY + symSz * 0.3, symSz * 0.9, symSz * 0.5).fill();
      doc.ellipse(symCX - symSz * 0.35, iconRowY - symSz * 0.3, symSz * 0.28, symSz * 0.6).fill();
      doc.circle(symCX - symSz * 0.5, iconRowY - symSz * 0.75, symSz * 0.22).fill();
      break;
    case 'panda': // 🐼
      doc.circle(symCX, iconRowY + symSz * 0.1, symSz * 0.75).fill();
      doc.save().fillColor('white').circle(symCX, iconRowY + symSz * 0.1, symSz * 0.55).fill().restore().fillColor('#000000');
      doc.circle(symCX, iconRowY - symSz * 0.55, symSz * 0.42).fill();
      doc.circle(symCX - symSz * 0.25, iconRowY - symSz * 0.62, symSz * 0.22).fill();
      doc.circle(symCX + symSz * 0.25, iconRowY - symSz * 0.62, symSz * 0.22).fill();
      break;
    case 'cat': // 🐱
      doc.circle(symCX, iconRowY - symSz * 0.05, symSz * 0.72).fill();
      doc.polygon([symCX - symSz * 0.55, iconRowY - symSz * 0.6], [symCX - symSz * 0.8, iconRowY - symSz], [symCX - symSz * 0.3, iconRowY - symSz * 0.7]).fill();
      doc.polygon([symCX + symSz * 0.55, iconRowY - symSz * 0.6], [symCX + symSz * 0.8, iconRowY - symSz], [symCX + symSz * 0.3, iconRowY - symSz * 0.7]).fill();
      break;
    default:
      doc.circle(symCX, iconRowY, symSz).fill();
  }
  doc.restore();

  // LINE 4: School Name
  if (label.schoolName) {
    doc.save()
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor('black')
      .text(
        label.schoolName.toUpperCase(),
        x + padL + schoolIconW, iconRowY - 3.2,
        { width: schoolNameW, ellipsis: true, lineBreak: false }
      )
      .restore();
  }

  // 5. LINE 5: Route (left), Delivery Location (center), Date (right)
  let routeText = '';
  if (label.routeNumber) routeText += `Rt ${label.routeNumber}`;
  if (label.stopOrder && label.stopOrder > 0) {
    routeText += (routeText ? ` - Stop ${label.stopOrder}` : `Stop ${label.stopOrder}`);
  }

  const line5Y = y + 54;
  doc.save()
    .font('Helvetica-Bold')
    .fontSize(6)
    .fillColor('black');

  const printDate = label.orderDate || '';
  const routeW = routeText ? doc.widthOfString(routeText) + 4 : 0;
  const dateW = printDate ? doc.widthOfString(printDate) + 4 : 0;
  const midX = x + padL + routeW;
  const midW = Math.max(0, textW - routeW - dateW);

  if (routeText) {
    doc.text(routeText, x + padL, line5Y, { width: routeW, ellipsis: true, lineBreak: false });
  }

  if (printDate) {
    doc.text(printDate, x + LABEL_W - padR - dateW, line5Y, { width: dateW, align: 'right', lineBreak: false });
  }

  if (label.deliveryLocation && midW > 12) {
    doc.fontSize(5)
       .text(label.deliveryLocation.toUpperCase(), midX + 2, line5Y + 0.5, {
         width: midW - 4,
         align: 'center',
         ellipsis: true,
         lineBreak: false
       });
  }

  doc.restore();
}
