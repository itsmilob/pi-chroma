// Zoomed-out views: a cell stands for `perCell` consecutive digits, so a
// billion digits fit in about a million cells. Counting is done once per
// (store, start, perCell); recoloring from the counts is instant, so palette
// edits and digit isolation never re-scan the digits.

import { HEADER_BYTES } from '../data/piParse.js';

// Most cells any view draws at once (a 1000x1000 grid, with a little spare so
// 1,000,000,001 digits fit at 1,000 digits per cell).
export const MAX_CELLS = 1_002_000;

const DIM = [30, 41, 59]; // matches the dimmed color used for isolated digits
const WORK_PER_YIELD = 4_000_000;
const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

export function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// How many cells cover [start, end) at `perCell` digits each.
export function cellCount(start, end, perCell) {
  return Math.max(0, Math.ceil((end - start) / perCell));
}

// Digit counts for `cells` consecutive cells beginning at digit `start`.
// Returns a Uint16Array of cells * 10 (perCell must stay below 65,536), or
// null if aborted. A final cell that runs past the store counts what exists.
export async function aggregateCounts(store, start, perCell, cells, { signal } = {}) {
  const counts = new Uint16Array(cells * 10);
  const bytes = store.bytes;
  const base = HEADER_BYTES;
  const end = store.length;
  const cellsPerSlice = Math.max(1, Math.floor(WORK_PER_YIELD / perCell));

  for (let c0 = 0; c0 < cells; c0 += cellsPerSlice) {
    if (signal?.aborted) return null;
    const c1 = Math.min(cells, c0 + cellsPerSlice);
    for (let c = c0; c < c1; c++) {
      const a = start + c * perCell;
      const b = Math.min(end, a + perCell);
      const o = c * 10;
      let i = a;
      if (i & 1 && i < b) {
        counts[o + (bytes[base + (i >> 1)] & 15)]++;
        i++;
      }
      const pairsEnd = i + ((b - i) & ~1);
      for (; i < pairsEnd; i += 2) {
        const v = bytes[base + (i >> 1)];
        counts[o + (v >> 4)]++;
        counts[o + (v & 15)]++;
      }
      if (i < b) counts[o + (bytes[base + (i >> 1)] >> 4)]++;
    }
    await yieldToUi();
  }
  return counts;
}

// Turns counts into canvas colors.
//   mode 'blend'    average of the palette colors, weighted by digit counts
//   mode 'dominant' the palette color of the most common digit
//   enhance         amplify blend deviations around the mean color (a blend of
//                   many digits is otherwise close to one flat gray)
//   isolated        digit 0-9 or null; cells fade to dark by how little of that
//                   digit they hold
// Returns { colors: Uint32Array (0xAABBGGRR, as ImageData wants), dominant: Uint8Array }.
export function colorizeCells(counts, cells, palette, { mode = 'blend', enhance = false, isolated = null } = {}) {
  const rgb = palette.map(hexToRgb);
  const colors = new Uint32Array(cells);
  const dominant = new Uint8Array(cells);
  const red = new Float32Array(cells);
  const green = new Float32Array(cells);
  const blue = new Float32Array(cells);

  for (let c = 0; c < cells; c++) {
    const o = c * 10;
    let total = 0;
    let best = 0;
    let bestCount = -1;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let d = 0; d < 10; d++) {
      const n = counts[o + d];
      total += n;
      if (n > bestCount) {
        bestCount = n;
        best = d;
      }
      r += n * rgb[d][0];
      g += n * rgb[d][1];
      b += n * rgb[d][2];
    }
    dominant[c] = best;
    if (mode === 'dominant') {
      [red[c], green[c], blue[c]] = rgb[best];
    } else if (total > 0) {
      red[c] = r / total;
      green[c] = g / total;
      blue[c] = b / total;
    }
  }

  if (mode !== 'dominant' && enhance && cells > 1) {
    // One gain for all channels keeps hues from drifting apart.
    const mean = [0, 0, 0];
    for (let c = 0; c < cells; c++) {
      mean[0] += red[c];
      mean[1] += green[c];
      mean[2] += blue[c];
    }
    for (let k = 0; k < 3; k++) mean[k] /= cells;
    const variance = [0, 0, 0];
    for (let c = 0; c < cells; c++) {
      variance[0] += (red[c] - mean[0]) ** 2;
      variance[1] += (green[c] - mean[1]) ** 2;
      variance[2] += (blue[c] - mean[2]) ** 2;
    }
    const std = Math.max(...variance.map((v) => Math.sqrt(v / cells)));
    const gain = std > 0.01 ? Math.max(1, 90 / std) : 1;
    for (let c = 0; c < cells; c++) {
      red[c] = mean[0] + (red[c] - mean[0]) * gain;
      green[c] = mean[1] + (green[c] - mean[1]) * gain;
      blue[c] = mean[2] + (blue[c] - mean[2]) * gain;
    }
  }

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  for (let c = 0; c < cells; c++) {
    let r = red[c];
    let g = green[c];
    let b = blue[c];
    if (isolated !== null) {
      const o = c * 10;
      let total = 0;
      for (let d = 0; d < 10; d++) total += counts[o + d];
      // 10% of a cell is what chance gives; 20% or more shows at full strength
      const t = total > 0 ? Math.min(1, counts[o + isolated] / total / 0.2) : 0;
      const target = rgb[isolated];
      r = DIM[0] + (target[0] - DIM[0]) * t;
      g = DIM[1] + (target[1] - DIM[1]) * t;
      b = DIM[2] + (target[2] - DIM[2]) * t;
    }
    colors[c] = (255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r);
  }

  return { colors, dominant };
}

// 0xAABBGGRR -> "rgb(r, g, b)" for canvas fillStyle
export function packedToCss(packed) {
  return `rgb(${packed & 255}, ${(packed >> 8) & 255}, ${(packed >> 16) & 255})`;
}
