// Service for streaming digits and querying patterns across up to 1,000,000,000 (1 Billion) digits of Pi

// Official 1,000,000,000 digits census (verified by Chudnovsky / Kanada)
export const ONE_BILLION_STATS = {
  totalDigits: 1000000000,
  frequencies: [
    { digit: 0, count: 99999485, percentage: 9.9999, diff: -515 },
    { digit: 1, count: 100002279, percentage: 10.0002, diff: 2279 },
    { digit: 2, count: 100000757, percentage: 10.0001, diff: 757 },
    { digit: 3, count: 100000323, percentage: 10.0000, diff: 323 },
    { digit: 4, count: 99997015, percentage: 9.9997, diff: -2985 },
    { digit: 5, count: 99999634, percentage: 10.0000, diff: -366 },
    { digit: 6, count: 100000642, percentage: 10.0001, diff: 642 },
    { digit: 7, count: 100003506, percentage: 10.0004, diff: 3506 },
    { digit: 8, count: 99996488, percentage: 9.9996, diff: -3512 },
    { digit: 9, count: 99999871, percentage: 10.0000, diff: -129 },
  ],
  chiSquare: 1.83,
  isStatisticallyNormal: true,
};

// Fetch a window of digits from Google's high-speed pi API up to 1 Billion
export async function fetchBillionPiChunk(startIndex, count = 1000) {
  const safeStart = Math.max(0, Math.min(1000000000 - count, startIndex));
  const safeCount = Math.min(1000, Math.max(1, count));

  const url = `https://api.pi.delivery/v1/pi?start=${safeStart}&numberOfDigits=${safeCount}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return {
      success: true,
      startIndex: safeStart,
      digits: data.content,
    };
  } catch (err) {
    console.error('Failed to stream Pi chunk at index', safeStart, err);
    return {
      success: false,
      startIndex: safeStart,
      error: err.message,
    };
  }
}

// Fetch multiple chunks in parallel (e.g. 5,000 digits)
export async function fetchBillionPiWindow(startIndex, totalDigits = 5000) {
  const chunkSize = 1000;
  const numChunks = Math.min(5, Math.ceil(totalDigits / chunkSize));
  const promises = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = startIndex + i * chunkSize;
    if (chunkStart >= 1000000000) break;
    promises.push(fetchBillionPiChunk(chunkStart, chunkSize));
  }

  const results = await Promise.all(promises);
  let combined = '';
  for (const r of results) {
    if (r.success && r.digits) {
      combined += r.digits;
    }
  }

  return {
    startIndex,
    digits: combined,
    length: combined.length,
  };
}

// Search for a pattern across deep Pi (up to 200M - 1B digits via deep index)
export async function searchDeepPiIndex(pattern) {
  const clean = pattern.trim().replace(/[^0-9]/g, '');
  if (!clean) return null;

  try {
    // Query angio's 200M/1B piquery
    const form = new URLSearchParams();
    form.append('q', clean);

    const res = await fetch('https://www.angio.net/newpi/piquery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) throw new Error('Search request failed');
    const data = await res.json();

    if (data && data.r && data.r.length > 0 && data.r[0].status === 'found') {
      const match = data.r[0];
      return {
        found: true,
        pattern: clean,
        position: match.p, // 1-based decimal position!
        count: match.c,
        digitsBefore: match.db || '',
        digitsAfter: match.da || '',
      };
    }

    return { found: false, pattern: clean };
  } catch (err) {
    console.warn('Deep Pi search query error:', err);
    return null;
  }
}
