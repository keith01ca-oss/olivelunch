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
    const { getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(pdfBuffer));
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
export function extractFieldsFromLines(rawLines: string[]): {
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

  const lines = rawLines.map(l => l.trim()).filter(Boolean);

  // 1. Check for Large indicator
  for (let i = 0; i < lines.length; i++) {
    if (/(?:\(|\b)(?:large|lg)(?:\)|\b)/i.test(lines[i])) {
      isLarge = true;
      lines[i] = lines[i].replace(/(?:\(|\b)(?:large|lg)(?:\)|\b)/gi, '').trim();
    }
  }

  // 2. Check Date
  const dateIdx = lines.findIndex(l => 
    /\b(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/.test(l) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b/i.test(l)
  );
  if (dateIdx !== -1) {
    orderDate = lines[dateIdx].trim();
    lines.splice(dateIdx, 1);
  }

  // 3. Check Lunch Time
  const timeIdx = lines.findIndex(l => /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i.test(l));
  if (timeIdx !== -1) {
    lunchTime = lines[timeIdx].trim();
    lines.splice(timeIdx, 1);
  }

  // 4. Check Division & Child Name
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const divMatch = l.match(/(?:div(?:ision)?|gr(?:ade)?|rm|room)[:\.\s]*([a-z0-9\-_]+)/i);
    if (divMatch) {
      division = 'DIV ' + divMatch[1].toUpperCase();
      // Remove div tag to see if student name is on the same line (e.g. DIV: 14 || KAEDEN REVALDE)
      const cleaned = l.replace(/(?:div(?:ision)?|gr(?:ade)?|rm|room)[:\.\s]*[a-z0-9\-_]+/gi, '')
                       .replace(/\|\||\||[-–—:]/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
      if (cleaned) {
        if (!childName) childName = cleaned;
        lines.splice(i, 1);
      } else {
        lines.splice(i, 1);
      }
      break;
    }
  }

  // Fallback division check for Kindergarten or Grade
  if (!division) {
    for (let i = 0; i < lines.length; i++) {
      const kMatch = lines[i].match(/\b(?:k(?:indergarten)?|gr\s*\d+)\b/i);
      if (kMatch) {
        division = kMatch[0].toUpperCase();
        const cleaned = lines[i].replace(kMatch[0], '').replace(/\|\||\||[-–—:]/g, ' ').trim();
        if (cleaned && !childName) childName = cleaned;
        lines.splice(i, 1);
        break;
      }
    }
  }

  // If childName not yet set, the first remaining line is the child name
  if (!childName && lines.length > 0) {
    childName = lines.shift() || '';
  }

  // 5. Dish vs School Identification
  // Check which line has dish characteristics (e.g., '( 1 )' prefix or food keywords)
  const foodIdx = lines.findIndex(l => 
    /^\s*\(\s*\d+\s*\)/.test(l) ||
    /\b(?:pasta|lasagna|nuggets|nugget|pizza|burger|chicken|meatball|meatballs|rice|wrap|salad|sandwich|bowl|sushi|beef|pork|cheese|macaroni|roll|fries|fruit|combo|soup|meal|lunch)\b/i.test(l)
  );

  if (foodIdx !== -1) {
    dishName = lines[foodIdx];
    lines.splice(foodIdx, 1);
    if (lines.length > 0) {
      schoolName = lines.shift() || '';
    }
  } else {
    // If one line matches known school keywords
    const schoolIdx = lines.findIndex(l => 
      SCHOOL_KEYWORDS.some(kw => l.toLowerCase().includes(kw))
    );

    if (schoolIdx !== -1) {
      schoolName = lines[schoolIdx];
      lines.splice(schoolIdx, 1);
      if (lines.length > 0) {
        dishName = lines.shift() || '';
      }
    } else {
      if (lines.length >= 2) {
        schoolName = lines[0];
        dishName = lines[1];
        lines.splice(0, 2);
      } else if (lines.length === 1) {
        dishName = lines[0];
        lines.splice(0, 1);
      }
    }
  }

  // Any remaining lines become notes
  if (lines.length > 0) {
    notes = lines.join(' • ');
  }

  if (!dishName && childName && !schoolName) {
    dishName = 'Lunch Meal';
  }

  return {
    childName: childName.trim(),
    division: division.trim(),
    dishName: dishName.trim(),
    schoolName: schoolName.trim(),
    orderDate: orderDate.trim(),
    lunchTime: lunchTime.trim(),
    notes: notes.trim(),
    isLarge,
  };
}
