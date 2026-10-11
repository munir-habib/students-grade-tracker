// xlsx-lite.mjs
//
// Shared zero-dependency .xlsx reader + course-sheet extractor + SQL helpers,
// used by onboard-student.mjs. Zero dependencies on purpose: it does not use
// the `xlsx` (SheetJS) package.

import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const VALID_STATUSES = new Set(['Completed', 'Pending', 'Planned']);
export const STATUS_MAP = { Completed: 'completed', Pending: 'pending', Planned: 'planned' };

// ============================================================================
// Minimal zero-dependency ZIP reader (handles the "stored" and "deflate"
// methods that OOXML/xlsx packages use).
// ============================================================================

function unzipToMap(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Not a valid zip/xlsx file (EOCD record not found)');

  const cdEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const map = new Map();
  let ptr = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    const sig = buf.readUInt32LE(ptr);
    if (sig !== 0x02014b50) throw new Error(`Bad central directory signature at offset ${ptr}`);
    const compMethod = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    ptr += 46 + nameLen + extraLen + commentLen;

    const lsig = buf.readUInt32LE(localHeaderOffset);
    if (lsig !== 0x04034b50) throw new Error(`Bad local file header signature for ${name}`);
    const lNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let data;
    if (compMethod === 0) data = compData;
    else if (compMethod === 8) data = zlib.inflateRawSync(compData);
    else throw new Error(`Unsupported zip compression method ${compMethod} for ${name}`);

    map.set(name, data);
  }
  return map;
}

// ============================================================================
// OOXML parsing helpers
// ============================================================================

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function loadSharedStrings(zipMap) {
  const buf = zipMap.get('xl/sharedStrings.xml');
  if (!buf) return [];
  const xml = buf.toString('utf8');
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) || [];
  return items.map((si) => {
    const runs = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    return decodeXmlEntities(runs.map((t) => t.replace(/<[^>]+>/g, '')).join(''));
  });
}

function loadWorkbookSheets(zipMap) {
  const wbXml = zipMap.get('xl/workbook.xml').toString('utf8');
  const relsXml = zipMap.get('xl/_rels/workbook.xml.rels').toString('utf8');

  const relMap = {};
  for (const m of relsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    relMap[m[1]] = m[2];
  }

  const sheets = [];
  const sheetRe = /<sheet name="([^"]+)" sheetId="(\d+)"(?: state="(\w+)")? r:id="(rId\d+)"\/>/g;
  let m;
  while ((m = sheetRe.exec(wbXml))) {
    sheets.push({
      name: decodeXmlEntities(m[1]),
      state: m[3] || 'visible',
      rid: m[4],
      target: relMap[m[4]],
    });
  }
  return sheets;
}

// Parses a worksheet XML into { rowNumber: { colLetter: value } }, decoding
// shared-string cells via `ss` and leaving numeric/inline cells as raw strings.
function parseWorksheetRows(zipMap, target, ss) {
  const buf = zipMap.get('xl/' + target);
  if (!buf) throw new Error(`Worksheet part xl/${target} not found in zip`);
  const xml = buf.toString('utf8');

  const rows = {};
  const rowRe = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowNum = parseInt(rm[1], 10);
    const rowXml = rm[2];
    const cells = {};
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rowXml))) {
      const col = cm[1];
      const attrs = cm[2];
      const inner = cm[3] || '';
      const typeMatch = attrs.match(/t="(\w+)"/);
      const type = typeMatch ? typeMatch[1] : null;
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      let value = null;
      if (vMatch) {
        value = type === 's' ? ss[parseInt(vMatch[1], 10)] : decodeXmlEntities(vMatch[1]);
      } else if (type === 'inlineStr') {
        const isMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        value = isMatch ? decodeXmlEntities(isMatch[1]) : null;
      }
      cells[col] = value;
    }
    rows[rowNum] = cells;
  }
  return rows;
}

// Finds the header row: the row containing a cell === 'Status' AND a cell === 'Category'.
function findHeaderRow(rows) {
  for (const [rn, cells] of Object.entries(rows)) {
    const vals = Object.values(cells);
    if (vals.includes('Status') && vals.includes('Category')) {
      return parseInt(rn, 10);
    }
  }
  return null;
}

function toNumberOrNull(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // Kill Excel floating-point noise (e.g. 2.2332999999999998) without losing
  // legitimate precision for these small point values.
  return Number(n.toFixed(6));
}

function toStringOrNull(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

// Strips the manual "✅ - <letter>" annotation some Spring sheet tab names carry,
// e.g. "MA II ✅ - B" -> "MA II". No-op for names without a checkmark.
function cleanCourseName(rawName) {
  return rawName.split('✅')[0].trim();
}

// ============================================================================
// SQL generation helpers
// ============================================================================

export function sqlEscape(str) {
  return String(str).replace(/'/g, "''");
}

export function sqlStr(value) {
  return value === null || value === undefined ? 'null' : `'${sqlEscape(value)}'`;
}

export function sqlNum(value) {
  if (value === null || value === undefined) return 'null';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : 'null';
}

export function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// Extraction
// ============================================================================

// mode: 'syllabus' -> sheet's column F is "Points Possible (Syllabus)" (numeric)
// mode: 'notes'    -> sheet's column F is free-text "Notes" -> assessments.comment
export function extractCourseSheet(zipMap, ss, sheet, mode) {
  const rows = parseWorksheetRows(zipMap, sheet.target, ss);
  const headerRow = findHeaderRow(rows);
  if (headerRow === null) {
    console.warn(`  !! WARNING: no header row (Status/Category) found in sheet "${sheet.name}" — skipping`);
    return null;
  }

  const dropLowestQuizzes = (() => {
    const raw = rows[6] ? rows[6]['B'] : null;
    const n = toNumberOrNull(raw);
    return n !== null && Number.isInteger(n) && n >= 0 ? n : 0;
  })();

  const assessments = [];
  const categoryOrder = [];
  const categorySet = new Set();

  let r = headerRow + 1;
  let consecutiveMisses = 0;
  const HARD_CAP = headerRow + 400;
  while (r < HARD_CAP) {
    const cells = rows[r] || {};
    const status = toStringOrNull(cells['A']);
    const name = toStringOrNull(cells['C']);

    if (status && VALID_STATUSES.has(status) && name) {
      const category = toStringOrNull(cells['B']) || 'Uncategorized';
      if (!categorySet.has(category)) {
        categorySet.add(category);
        categoryOrder.push(category);
      }

      const pointsEarned = toNumberOrNull(cells['D']);
      const pointsPossibleActual = toNumberOrNull(cells['E']);
      const pointsPossibleSyllabus = mode === 'syllabus' ? toNumberOrNull(cells['F']) : null;
      const comment = mode === 'notes' ? toStringOrNull(cells['F']) : null;

      assessments.push({
        name,
        category,
        status: STATUS_MAP[status],
        pointsEarned,
        pointsPossibleActual,
        pointsPossibleSyllabus,
        comment,
      });
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      // Once we've started hitting real data, allow a small gap (blank spacer
      // rows) but stop once we clearly run past the table into stray notes/
      // totals cells below it (e.g. "Ended Class with an B", leftover totals).
      if (consecutiveMisses > 3 && assessments.length > 0) break;
    }
    r++;
  }

  return {
    courseName: cleanCourseName(sheet.name),
    dropLowestQuizzes,
    categories: categoryOrder,
    assessments,
  };
}

export function extractWorkbook(filePath, mode, skipSheets = new Set(['TIPS'])) {
  const buf = fs.readFileSync(filePath);
  const zipMap = unzipToMap(buf);
  const ss = loadSharedStrings(zipMap);
  const sheets = loadWorkbookSheets(zipMap);

  const courses = [];
  for (const sheet of sheets) {
    if (skipSheets.has(sheet.name)) continue;
    const course = extractCourseSheet(zipMap, ss, sheet, mode);
    if (course) courses.push(course);
  }
  return courses;
}
