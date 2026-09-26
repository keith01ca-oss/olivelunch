import { StandardLabelData } from './labels-shared';

export interface ParsedLabelItem extends StandardLabelData {
  id: string;
  sourceSheet: number;
  sourceCol: number;
  sourceRow: number;
  rawLines: string[];
  notes?: string;
}

export interface ParseResult {
  success: boolean;
  labels: ParsedLabelItem[];
  totalPages: number;
  totalLabels: number;
  detectedSchools: string[];
  detectedDivisions: string[];
  error?: string;
}

// Common school lunch keywords
const SCHOOL_KEYWORDS = [
  'elementary', 'school', 'academy', 'secondary', 'middle', 'high', 
  'collegiate', 'ecole', 'campus', 'institute', 'ecs', 'rcs', 'wowk', 'westwind'
];

const DIVISION_REGEX = /(?:\b(?:div(?:ision)?|gr(?:ade)?|rm|room)\.?\s*([a-z0-9\-_]+)\b)|(?:\b(?:k(?:indergarten)?|gr\s*\d+)\b)/i;
const LARGE_REGEX = /(?:\(|\b)(?:large|lg)(?:\)|\b)/i;
const TIME_REGEX = /\b(?:\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i;
const DATE_REGEX = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;

/**
 * Parses Avery 5160 30-per-page labels from a PDF buffer using pdfjs-dist.
 */
export async function parseAvery5160Pdf(pdfBuffer: Buffer): Promise<ParseResult> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    const lib = (pdfjs as any).default || pdfjs;

    const loadingTask = lib.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableFontFace: true,
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const labels: ParsedLabelItem[] = [];
    const schoolsSet = new Set<string>();
    const divisionsSet = new Set<string>();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const pageHeight = viewport.height || 792;
      const pageWidth = viewport.width || 612;

      // 3 cols x 10 rows grid accumulator
      const cells: { str: string; x: number; y: number; yFromTop: number }[][][] = Array.from(
        { length: 10 },
        () => Array.from({ length: 3 }, () => [])
      );

      for (const item of textContent.items as any[]) {
        const text = (item.str || '').trim();
        if (!text) continue;

        const x = item.transform[4];
        const y = item.transform[5];
        const yFromTop = pageHeight - y;

        // Determine column (0, 1, 2)
        // Standard Avery 5160: col width 189pt, gap 9pt, side margin ~13.7pt
        let col = 0;
        if (x >= 405) {
          col = 2;
        } else if (x >= 205) {
          col = 1;
        } else {
          col = 0;
        }

        // Determine row (0..9)
        // Top margin is approx 36pt (0.5"), row height is 72pt (1.0")
        const row = Math.min(9, Math.max(0, Math.floor((yFromTop - 30) / 72)));

        cells[row][col].push({ str: text, x, y, yFromTop });
      }

      // Process each cell on this page
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 3; c++) {
          const items = cells[r][c];
          if (items.length === 0) continue;

          // Group into lines by vertical tolerance (~3.5 pt)
          items.sort((a, b) => a.yFromTop - b.yFromTop);

          const lines: { y: number; items: typeof items }[] = [];
          for (const it of items) {
            const lastLine = lines[lines.length - 1];
            if (lastLine && Math.abs(lastLine.y - it.yFromTop) <= 3.8) {
              lastLine.items.push(it);
            } else {
              lines.push({ y: it.yFromTop, items: [it] });
            }
          }

          // Build string for each line by sorting items horizontally
          const rawLines: string[] = [];
          for (const line of lines) {
            line.items.sort((a, b) => a.x - b.x);
            const lineStr = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
            if (lineStr) rawLines.push(lineStr);
          }

          if (rawLines.length === 0) continue;

          // Parse label fields
          const parsed = extractFieldsFromLines(rawLines);

          if (parsed.division) divisionsSet.add(parsed.division);
          if (parsed.schoolName) schoolsSet.add(parsed.schoolName);

          labels.push({
            id: `lbl-${pageNum}-${r}-${c}-${Math.random().toString(36).substring(2, 7)}`,
            sourceSheet: pageNum,
            sourceRow: r + 1,
            sourceCol: c + 1,
            rawLines,
            ...parsed,
          });
        }
      }
    }

    return {
      success: true,
      labels,
      totalPages: numPages,
      totalLabels: labels.length,
      detectedSchools: Array.from(schoolsSet).filter(Boolean),
      detectedDivisions: Array.from(divisionsSet).filter(Boolean),
    };
  } catch (err: any) {
    console.error('parseAvery5160Pdf error:', err);
    return {
      success: false,
      labels: [],
      totalPages: 0,
      totalLabels: 0,
      detectedSchools: [],
      detectedDivisions: [],
      error: err.message || 'Failed to parse PDF',
    };
  }
}

/**
 * Heuristic field extractor from text lines of an individual label.
 */
export function extractFieldsFromLines(lines: string[]): {
  childName: string;
  division: string;
  dishName: string;
  schoolName: string;
  orderDate?: string;
  lunchTime?: string;
  notes?: string;
  isLarge: boolean;
} {
  let childName = '';
  let division = '';
  let dishName = '';
  let schoolName = '';
  let orderDate = '';
  let lunchTime = '';
  let notes = '';
  let isLarge = false;

  const remainingLines: string[] = [...lines];

  // 1. Check for Large indicator
  for (let i = 0; i < remainingLines.length; i++) {
    if (LARGE_REGEX.test(remainingLines[i])) {
      isLarge = true;
      remainingLines[i] = remainingLines[i].replace(LARGE_REGEX, '').trim();
    }
  }

  // 2. Find Division / Class
  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];
    const match = line.match(DIVISION_REGEX);
    if (match) {
      division = match[0].trim();
      // Remove division from this line
      const cleaned = line.replace(match[0], '').replace(/[-–—,:|]/g, ' ').replace(/\s+/g, ' ').trim();
      remainingLines[i] = cleaned;
      break;
    }
  }

  // 3. Find Lunch Time
  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];
    const match = line.match(TIME_REGEX);
    if (match) {
      lunchTime = match[0].trim();
      remainingLines[i] = line.replace(match[0], '').trim();
      break;
    }
  }

  // 4. Find Date
  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];
    const match = line.match(DATE_REGEX);
    if (match) {
      orderDate = match[0].trim();
      remainingLines[i] = line.replace(match[0], '').trim();
      break;
    }
  }

  // 5. Find School Name (look for school keywords)
  for (let i = 0; i < remainingLines.length; i++) {
    const lineLower = remainingLines[i].toLowerCase();
    if (SCHOOL_KEYWORDS.some(kw => lineLower.includes(kw))) {
      schoolName = remainingLines[i];
      remainingLines.splice(i, 1);
      break;
    }
  }

  // Filter out empty lines after removals
  const activeLines = remainingLines.filter(l => l.length > 0);

  // 6. Child Name: Usually line 0
  if (activeLines.length > 0) {
    childName = activeLines[0];
  }

  // 7. Dish Name: Usually line 1
  if (activeLines.length > 1) {
    dishName = activeLines[1];
  }

  // 8. If school wasn't found by keyword, check remaining lines
  if (!schoolName && activeLines.length > 2) {
    schoolName = activeLines[2];
  }

  // Remaining lines become notes
  if (activeLines.length > 3) {
    notes = activeLines.slice(3).join(' • ');
  }

  // Fallbacks if only 1 line
  if (!dishName && childName && activeLines.length === 1) {
    dishName = 'Lunch Meal';
  }

  return {
    childName: childName.trim(),
    division: division.toUpperCase().replace(/\s+/g, ' ').trim(),
    dishName: dishName.trim(),
    schoolName: schoolName.trim(),
    orderDate: orderDate.trim(),
    lunchTime: lunchTime.trim(),
    notes: notes.trim(),
    isLarge,
  };
}
