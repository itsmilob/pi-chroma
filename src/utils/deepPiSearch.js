// Online deep search of Pi digits (angio.net index)

export async function searchDeepPiIndex(pattern) {
  const clean = pattern.trim().replace(/[^0-9]/g, '');
  if (!clean) return null;

  try {
    // Query angio's piquery
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
