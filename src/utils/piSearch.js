import { HEADER_BYTES } from '../data/piParse.js';

// Substring search and analysis across Pi digits held in a PiStore.
// Scans run in chunks and yield to the event loop between them, so a full
// pass over a billion digits keeps the UI responsive.

const SCAN_CHUNK = 4_000_000;

export const EMPTY_RESULT = {
  pattern: '',
  matches: [],
  totalMatches: 0,
  firstIndex: -1,
  expectedCount: 0,
  rarity: 0,
  searchTimeMs: 0,
  truncated: false,
};

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

// Resolves to null if `signal` is aborted mid-scan.
export async function searchStore(store, pattern, { maxMatches = 500, maxCount = 100_000, signal } = {}) {
  const cleanPattern = typeof pattern === 'string' ? pattern.trim().replace(/[^0-9]/g, '') : '';
  if (!cleanPattern) return EMPTY_RESULT;

  const startTime = performance.now();
  const matches = [];
  let totalMatches = 0;
  let scanned = 0;
  let truncated = false;
  const pLen = cleanPattern.length;

  for (let start = 0; start < store.length && !truncated; start += SCAN_CHUNK) {
    if (signal?.aborted) return null;
    // Read pLen - 1 extra digits so matches straddling a chunk edge are found;
    // only matches that begin inside this chunk are counted here.
    const text = store.slice(start, Math.min(store.length, start + SCAN_CHUNK + pLen - 1));
    let pos = 0;
    for (;;) {
      const idx = text.indexOf(cleanPattern, pos);
      if (idx === -1 || idx >= SCAN_CHUNK) break;

      totalMatches++;
      if (matches.length < maxMatches) {
        const index = start + idx;
        matches.push({
          index,
          // In Pi convention: index 0 is '3', index 1 is decimal 1 ('1'), index 2 is decimal 2 ('4')
          decimalPosition: index === 0 ? 'Integer 3' : index,
          context: getSurroundingContext(store, index, pLen, 8),
        });
      }
      if (totalMatches >= maxCount) {
        truncated = true;
        break;
      }
      pos = idx + 1; // overlapping matches allowed, e.g. '999' in '9999'
    }
    scanned = Math.min(store.length, start + SCAN_CHUNK);
    await yieldToUi();
  }

  const searchTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
  const expectedCount = Math.round((scanned / Math.pow(10, pLen)) * 100) / 100;
  const rarity =
    totalMatches > 0 && expectedCount > 0 ? Math.round((totalMatches / expectedCount) * 100) / 100 : 0;

  return {
    pattern: cleanPattern,
    matches,
    totalMatches,
    firstIndex: matches.length > 0 ? matches[0].index : -1,
    expectedCount,
    rarity,
    searchTimeMs,
    truncated,
  };
}

export function getSurroundingContext(str, index, length, padding = 8) {
  const start = Math.max(0, index - padding);
  const end = Math.min(str.length, index + length + padding);
  const before = str.slice(start, index);
  const matched = str.slice(index, index + length);
  const after = str.slice(index + length, end);

  return {
    start,
    end,
    before: (start > 0 ? '...' : '') + before,
    matched,
    after: after + (end < str.length ? '...' : '')
  };
}

// Convert a date to common search patterns
export function formatDatePatterns(dateStr) {
  if (!dateStr) return [];
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return [];

  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');
  const yyyy = year;
  const yy = year.slice(-2);

  return [
    { label: `MMDDYYYY (${mm}${dd}${yyyy})`, value: `${mm}${dd}${yyyy}` },
    { label: `YYYYMMDD (${yyyy}${mm}${dd})`, value: `${yyyy}${mm}${dd}` },
    { label: `DDMMYYYY (${dd}${mm}${yyyy})`, value: `${dd}${mm}${yyyy}` },
    { label: `MMDDYY (${mm}${dd}${yy})`, value: `${mm}${dd}${yy}` },
    { label: `MMDD (${mm}${dd})`, value: `${mm}${dd}` },
    { label: `DDMM (${dd}${mm})`, value: `${dd}${mm}` },
  ];
}

// Digit frequencies (and the 10x10 digit-to-next-digit transition counts) over
// the first `limit` digits, in one pass. Resolves to null if aborted.
export async function computeStoreStats(store, limit = store.length, { signal } = {}) {
  const total = Math.min(limit, store.length);
  const counts = new Float64Array(10);
  const trans = new Float64Array(100);
  const bytes = store.bytes;
  const base = HEADER_BYTES;
  const CHUNK = 8_000_000; // even, so chunks start on a byte boundary
  let prev = -1;

  for (let start = 0; start < total; start += CHUNK) {
    if (signal?.aborted) return null;
    const end = Math.min(total, start + CHUNK);
    // Per-chunk accumulators stay far below 2^32; Float64 totals never overflow.
    const c = new Uint32Array(10);
    const t = new Uint32Array(100);
    let i = start;
    for (; i + 1 < end; i += 2) {
      const v = bytes[base + (i >> 1)];
      const hi = v >> 4;
      const lo = v & 15;
      c[hi]++;
      c[lo]++;
      if (prev >= 0) t[prev * 10 + hi]++;
      t[hi * 10 + lo]++;
      prev = lo;
    }
    if (i < end) {
      const hi = bytes[base + (i >> 1)] >> 4;
      c[hi]++;
      if (prev >= 0) t[prev * 10 + hi]++;
      prev = hi;
    }
    for (let k = 0; k < 10; k++) counts[k] += c[k];
    for (let k = 0; k < 100; k++) trans[k] += t[k];
    await yieldToUi();
  }

  const expected = total / 10;
  let chiSquare = 0;
  const frequencies = Array.from(counts, (count, digit) => {
    const diff = count - expected;
    chiSquare += (diff * diff) / (expected || 1);
    return {
      digit,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 1000) / 1000 : 0,
      diff: Math.round(diff),
    };
  });

  const transitions = Array.from({ length: 10 }, (_, r) => Array.from(trans.subarray(r * 10, r * 10 + 10)));

  return {
    stats: {
      totalDigits: total,
      frequencies,
      chiSquare: Math.round(chiSquare * 100) / 100, // df=9, critical value at p=0.05 is ~16.92
      isStatisticallyNormal: chiSquare < 16.92,
    },
    transitions,
  };
}
