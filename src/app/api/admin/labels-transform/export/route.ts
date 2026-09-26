import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRoute } from '@/lib/auth';
import PDFDocument from 'pdfkit';
import { 
  PAGE_W, PAGE_H, COLS, ROWS, COLOR_PALETTE, 
  getSchoolIconName, drawAvery5160Label, StandardLabelData 
} from '@/lib/labels-shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authErr = await verifyAdminRoute();
  if (authErr) {
    return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  }

  try {
    const body = await req.json();
    const rawLabels: any[] = body.labels || [];
    const sortFields: string[] = body.sortFields || ['school', 'division', 'dish'];
    const customDate: string = body.date || '';

    if (!Array.isArray(rawLabels) || rawLabels.length === 0) {
      return NextResponse.json({ error: 'No labels to export' }, { status: 400 });
    }

    // 1. Division Color Mapping (within same school, each division gets unique color)
    const schoolDivMap: Record<string, string[]> = {};
    rawLabels.forEach((lbl: any) => {
      const school = lbl.schoolName || '__default__';
      const div = lbl.division || '';
      if (!div) return;
      if (!schoolDivMap[school]) schoolDivMap[school] = [];
      if (!schoolDivMap[school].includes(div)) schoolDivMap[school].push(div);
    });

    const divColorMap: Record<string, string> = {};
    Object.entries(schoolDivMap).forEach(([school, divs]) => {
      divs.forEach((div, idx) => {
        divColorMap[`${school}::${div}`] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      });
    });

    // 2. Prepare labels with colors & school icons
    const labels: StandardLabelData[] = rawLabels.map((lbl: any) => {
      const schoolName = lbl.schoolName || '';
      const division = lbl.division || '';
      const divKey = `${schoolName}::${division}`;
      const assignedColor = lbl.color || divColorMap[divKey] || '#3b6fd4';
      const icon = lbl.schoolIcon || getSchoolIconName(schoolName);

      return {
        childName: (lbl.childName || '').trim(),
        division: (lbl.division || '').trim(),
        dishName: (lbl.dishName || '').trim(),
        schoolName: (lbl.schoolName || '').trim(),
        orderDate: (lbl.orderDate || customDate || '').trim(),
        deliveryLocation: (lbl.deliveryLocation || '').trim(),
        lunchTime: (lbl.lunchTime || '').trim(),
        routeNumber: (lbl.routeNumber || '').trim(),
        stopOrder: Number(lbl.stopOrder) || 0,
        itemNum: Number(lbl.itemNum) || 1,
        totalQty: Number(lbl.totalQty) || 1,
        color: assignedColor,
        isLarge: Boolean(lbl.isLarge),
        schoolIcon: icon,
        componentIndex: lbl.componentIndex,
        componentTotal: lbl.componentTotal,
      };
    });

    // 3. Sorting
    const getSortVal = (label: StandardLabelData, field: string): string => {
      if (field === 'school') return label.schoolName || '';
      if (field === 'division') return label.division || '';
      if (field === 'dish') return label.dishName || '';
      if (field === 'childName') return label.childName || '';
      if (field === 'date') return label.orderDate || '';
      return '';
    };

    if (sortFields.length > 0) {
      labels.sort((a, b) => {
        for (const sf of sortFields) {
          const cmp = getSortVal(a, sf).localeCompare(getSortVal(b, sf), undefined, { numeric: true, sensitivity: 'base' });
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    // 4. Generate PDF
    const buffers: Buffer[] = [];
    const doc = new PDFDocument({
      size: [PAGE_W, PAGE_H],
      margin: 0,
      autoFirstPage: true,
      info: { Title: 'Transformed Labels - Avery 5160', Author: 'Olive Lunch' },
    });

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    labels.forEach((label, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS) % ROWS;

      if (i > 0 && col === 0 && row === 0) {
        doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      }

      drawAvery5160Label(doc, label, col, row);
    });

    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    const filename = customDate ? `labels-formatted-${customDate}.pdf` : `labels-formatted-${Date.now()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Labels export error:', err);
    return NextResponse.json({ error: err.message || 'Server error generating PDF' }, { status: 500 });
  }
}
