// Fast substring pattern search and analysis across Pi digits

export function searchPattern(piString, pattern, maxMatches = 500) {
  if (!pattern || typeof pattern !== 'string') {
    return {
      pattern: '',
      matches: [],
      totalMatches: 0,
      firstIndex: -1,
      expectedCount: 0,
      rarity: 0,
      searchTimeMs: 0
    };
  }

  const cleanPattern = pattern.trim().replace(/[^0-9]/g, '');
  if (cleanPattern.length === 0) {
    return {
      pattern: '',
      matches: [],
      totalMatches: 0,
      firstIndex: -1,
      expectedCount: 0,
      rarity: 0,
      searchTimeMs: 0
    };
  }

  const startTime = performance.now();
  const matches = [];
  let totalMatches = 0;
  let pos = 0;
  const pLen = cleanPattern.length;
  const strLen = piString.length;

  while (pos < strLen) {
    const idx = piString.indexOf(cleanPattern, pos);
    if (idx === -1) break;

    totalMatches++;
    if (matches.length < maxMatches) {
      matches.push({
        index: idx,
        // In Pi convention: index 0 is '3', index 1 is decimal 1 ('1'), index 2 is decimal 2 ('4')
        decimalPosition: idx === 0 ? 'Integer 3' : idx,
        context: getSurroundingContext(piString, idx, pLen, 8)
      });
    }

    pos = idx + 1; // overlapping matches allowed, e.g. '999' in '9999'
  }

  const searchTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
  const expectedCount = Math.round((strLen / Math.pow(10, pLen)) * 100) / 100;
  const firstIndex = matches.length > 0 ? matches[0].index : -1;
  const rarity = totalMatches > 0 && expectedCount > 0 ? Math.round((totalMatches / expectedCount) * 100) / 100 : 0;

  return {
    pattern: cleanPattern,
    matches,
    totalMatches,
    firstIndex,
    expectedCount,
    rarity,
    searchTimeMs
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

// Compute frequency statistics for digits 0-9
export function computeDigitStats(piString, limit = null) {
  const str = limit ? piString.slice(0, limit) : piString;
  const total = str.length;
  const counts = new Array(10).fill(0);

  for (let i = 0; i < total; i++) {
    const d = parseInt(str[i], 10);
    if (!isNaN(d)) {
      counts[d]++;
    }
  }

  // Expected count under uniform distribution
  const expected = total / 10;
  let chiSquare = 0;

  const frequencies = counts.map((count, digit) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const diff = count - expected;
    chiSquare += (diff * diff) / (expected || 1);
    return {
      digit,
      count,
      percentage: Math.round(percentage * 1000) / 1000,
      diff: Math.round(diff)
    };
  });

  return {
    totalDigits: total,
    frequencies,
    chiSquare: Math.round(chiSquare * 100) / 100, // Chi-square statistic (df=9, critical value at p=0.05 is ~16.92)
    isStatisticallyNormal: chiSquare < 16.92
  };
}
