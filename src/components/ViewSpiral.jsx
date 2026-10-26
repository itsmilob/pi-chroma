import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Disc, Move, Loader2 } from 'lucide-react';
import { aggregateCounts, colorizeCells, hexToRgb, packedToCss } from '../utils/aggregate';
import { useGestures } from '../utils/useGestures';
import { HEADER_BYTES } from '../data/piParse.js';

// The spiral is redrawn from the digits at every zoom level, at the screen's
// real resolution, so zooming in reveals detail instead of magnifying pixels:
//
//   zoomed out   a dot stands for a block of consecutive digits (colored by a
//                blend or the most common digit), as many as the screen can show
//   zoomed in    one dot per digit, then labeled digits
//
// The geometry is fixed (consecutive digits are 1 world unit apart along the
// coil), so a digit never moves when the zoom changes. Only the dots in view
// are computed and drawn, so a billion-digit spiral costs about what a small
// one does.

const BASE = 1000; // block size of the whole-store count cache
const DIRECT_BUDGET = 8_000_000; // digits read straight from the store per frame
const BLOCK_CAP = 200_000; // dots per frame when blocks are used, at rest
const MOVING_BLOCK_CAP = 50_000; // ...while panning or zooming, so it stays smooth
const MOVING_FERMAT_POINTS = 250_000; // Fermat candidates tested per frame while moving
const SETTLE_MS = 160; // idle time before redrawing at full detail
const CANDIDATE_CAP = 1_500_000;
const FERMAT_MAX = 2_000_000; // blocks of consecutive digits are not spatial on a Fermat spiral
const MIN_SPACING_PX = 2.2; // closest dots may get, in CSS pixels
const MAX_ZOOM = 120; // CSS pixels per world unit
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;
const DIM = [30, 41, 59];
const BG = (255 << 24) | (0x12 << 16) | (0x07 << 8) | 0x03; // #030712

// Digit counts for the whole store in blocks of BASE, plus coarser levels (4x,
// 16x and 64x), computed once per store and shared by every frame that is zoomed out
// too far to read digits directly. The coarse levels keep a big dot from having
// to add up thousands of base blocks. (64 * BASE = 64,000 digits still fits the
// 16-bit counts.)
const LEVELS = [64, 16, 4, 1];
const baseCaches = new WeakMap();

function coarsen(src, cells, factor) {
  const outCells = Math.ceil(cells / factor);
  const out = new Uint16Array(outCells * 10);
  for (let c = 0; c < cells; c++) {
    const o = Math.floor(c / factor) * 10;
    for (let d = 0; d < 10; d++) out[o + d] += src[c * 10 + d];
  }
  return { counts: out, cells: outCells };
}

// Returns { 1: {counts, cells}, 4: ..., 16: ..., 64: ... } once counted, else null
function getLevels(store, onReady) {
  let entry = baseCaches.get(store);
  if (!entry) {
    entry = { levels: null, promise: null };
    const cells = Math.ceil(store.length / BASE);
    entry.promise = aggregateCounts(store, 0, BASE, cells).then((counts) => {
      entry.levels = { 1: { counts, cells }, 4: coarsen(counts, cells, 4), 16: coarsen(counts, cells, 16), 64: coarsen(counts, cells, 64) };
    });
    baseCaches.set(store, entry);
  }
  if (!entry.levels) entry.promise.then(onReady);
  return entry.levels;
}

function makeGeometry(type, pitch, total) {
  if (type === 'fermat') {
    const n = Math.min(total, FERMAT_MAX);
    const c = Math.sqrt(pitch / Math.PI); // one digit takes `pitch` square units
    return {
      type,
      n,
      c,
      radius: c * Math.sqrt(n),
      pos: (i) => {
        const r = c * Math.sqrt(i);
        const t = i * GOLDEN;
        return [r * Math.cos(t), r * Math.sin(t)];
      },
    };
  }
  // r = b * theta, with digits 1 unit apart along the curve: i = b * theta^2 / 2
  const b = pitch / TWO_PI;
  return {
    type: 'archimedes',
    n: total,
    b,
    radius: Math.sqrt(2 * b * total),
    pos: (i) => {
      const t = Math.sqrt((2 * i) / b);
      return [b * t * Math.cos(t), b * t * Math.sin(t)];
    },
  };
}

// Writes the dots of the digit blocks inside [x0,x1]x[y0,y1] (world units) into
// out.j (block numbers) / out.x / out.y (world positions). Returns the count,
// or -1 if more than `cap` candidates would have to be tested.
function enumerateBlocks(g, k, rect, out, cap, moving) {
  const { x0, x1, y0, y1 } = rect;
  const nBlocks = Math.ceil(g.n / k);
  const midOf = (j) => (j + 1) * k > g.n ? (j * k + g.n) / 2 : j * k + k / 2;
  let count = 0;
  let tested = 0;
  const dx = x0 > 0 ? x0 : x1 < 0 ? -x1 : 0;
  const dy = y0 > 0 ? y0 : y1 < 0 ? -y1 : 0;
  const rmin = Math.hypot(dx, dy);
  if (rmin > g.radius) return 0;
  const rmax = Math.min(
    g.radius,
    Math.max(Math.hypot(x0, y0), Math.hypot(x0, y1), Math.hypot(x1, y0), Math.hypot(x1, y1))
  );

  if (g.type === 'fermat') {
    const iLo = Math.max(0, Math.floor((rmin / g.c) ** 2));
    const iHi = Math.min(g.n - 1, Math.ceil((rmax / g.c) ** 2));
    if (iHi - iLo > cap) return -1;
    // While moving, test every few-th digit (each at its true position) to stay smooth
    const stride = moving ? Math.max(1, Math.ceil((iHi - iLo + 1) / MOVING_FERMAT_POINTS)) : 1;
    for (let i = iLo; i <= iHi; i += stride) {
      const r = g.c * Math.sqrt(i + 0.5);
      const t = (i + 0.5) * GOLDEN;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      out.j[count] = i;
      out.x[count] = x;
      out.y[count] = y;
      count++;
    }
    return count;
  }

  // Archimedean: for each turn, only the angles the rectangle subtends
  const thLo = rmin / g.b;
  const thHi = rmax / g.b;
  let a = 0;
  let bb = TWO_PI;
  const contains = x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0;
  if (!contains) {
    const dir = Math.atan2((y0 + y1) / 2, (x0 + x1) / 2);
    let dmin = Infinity;
    let dmax = -Infinity;
    for (const [cx, cy] of [[x0, y0], [x0, y1], [x1, y0], [x1, y1]]) {
      let d = Math.atan2(cy, cx) - dir;
      if (d > Math.PI) d -= TWO_PI;
      if (d < -Math.PI) d += TWO_PI;
      if (d < dmin) dmin = d;
      if (d > dmax) dmax = d;
    }
    a = dir + dmin;
    bb = dir + dmax;
  }
  const nLo = Math.floor((thLo - bb) / TWO_PI);
  const nHi = Math.ceil((thHi - a) / TWO_PI);
  for (let n = nLo; n <= nHi; n++) {
    const ta = Math.max(thLo, a + TWO_PI * n);
    const tb = Math.min(thHi, bb + TWO_PI * n);
    if (tb <= ta) continue;
    const jLo = Math.max(0, Math.floor((g.b * ta * ta) / 2 / k));
    const jHi = Math.min(nBlocks - 1, Math.ceil((g.b * tb * tb) / 2 / k));
    tested += jHi - jLo + 1;
    if (tested > cap) return -1;
    for (let j = jLo; j <= jHi; j++) {
      const t = Math.sqrt((2 * midOf(j)) / g.b);
      const r = g.b * t;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      out.j[count] = j;
      out.x[count] = x;
      out.y[count] = y;
      count++;
    }
  }
  return count;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Dot radius in world units. A single digit is a bead with gaps around it; a
// block of digits fills (nearly) the area its digits take, so a zoomed-out
// spiral reads as a solid disc rather than scattered specks.
const dotRadius = (k, pitch, dotUnit) => (k === 1 ? 0.6 : 0.95) * dotUnit * Math.sqrt((k * pitch) / Math.PI);

export default function ViewSpiral({
  store,
  colorMode,
  enhance,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
  jump,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);

  const [spiralType, setSpiralType] = useState('archimedes'); // 'archimedes' | 'fermat'
  const [spacing, setSpacing] = useState(1.8); // distance between turns, in digit spacings
  const [dotSize, setDotSize] = useState(3.5);
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [info, setInfo] = useState({ k: 1, dots: 0, mode: 'direct', zoom: 1 });
  const [isCounting, setIsCounting] = useState(false);

  const geom = useMemo(() => makeGeometry(spiralType, spacing, store.length), [spiralType, spacing, store.length]);

  const viewRef = useRef({ cx: 0, cy: 0, z: 1 }); // world point at the center; CSS px per world unit
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef(0);
  const dotsRef = useRef({ n: 0, k: 1, sx: null, sy: null, j: null, rr: 0 });
  const bufRef = useRef(null);
  const workRef = useRef({ image: null, packed: null, counts: null, sx: null, sy: null });
  const movingUntilRef = useRef(0);
  const settleTimerRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  const live = useRef({});
  live.current = { store, geom, colors, colorMode, enhance, isolatedDigit, searchResult, activeMatchIndex, dotSize, spacing };

  const dotUnit = dotSize / 3.5;
  const fitZoom = (g, w, h) => (0.5 * Math.min(w, h) * 0.96) / Math.max(1, g.radius);

  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const { w, h, dpr } = sizeRef.current;
    if (!canvas || !w || !h) return;
    const L = live.current;
    const g = L.geom;
    const { store: st, colors: pal } = L;
    const Wd = canvas.width;
    const Hd = canvas.height;
    const zd = viewRef.current.z * dpr; // device px per world unit
    const { cx, cy } = viewRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // World rectangle on screen
    const hw = Wd / (2 * zd);
    const hh = Hd / (2 * zd);
    const area = Math.min(4 * hw * hh, Math.PI * g.radius * g.radius);
    const pitch = L.spacing;
    const dotUnit = L.dotSize / 3.5;
    const visible = Math.min(g.n, area / pitch);

    // While moving, draw fewer, larger dots; the full detail comes back once still
    const moving = performance.now() < movingUntilRef.current;
    const blockCap = moving ? MOVING_BLOCK_CAP : BLOCK_CAP;

    // How to draw: digits straight from the store, or blocks of digits
    let k = 1;
    let mode = 'direct'; // 'direct' | 'cache' | 'sample'
    let levels = null;
    let factor = 1; // which cache level the blocks are summed from
    if (g.type === 'archimedes') {
      if (g.n >= 4 * BASE && visible > DIRECT_BUDGET) {
        levels = getLevels(st, () => {
          setIsCounting(false);
          scheduleDraw();
        });
        mode = levels ? 'cache' : 'sample';
        if (!levels) setIsCounting(true);
        // Blocks are whole multiples of a cache level, so they can be summed from it
        const m = Math.max(1, Math.ceil(visible / BASE / blockCap - 1e-6));
        factor = LEVELS.find((f) => m >= f) ?? 1;
        k = BASE * Math.ceil(m / factor) * factor;
      } else {
        k = Math.max(1, Math.ceil((MIN_SPACING_PX * dpr) / zd), Math.ceil(visible / blockCap));
      }
    }

    // Enumerate the blocks in view (coarsen if too many candidates)
    if (!bufRef.current) {
      const size = Math.max(CANDIDATE_CAP, FERMAT_MAX) + 16;
      bufRef.current = { j: new Int32Array(size), x: new Float32Array(size), y: new Float32Array(size) };
    }
    const out = bufRef.current;
    let n = -1;
    for (let tries = 0; tries < 8 && n < 0; tries++) {
      const rWorld = dotRadius(k, pitch, dotUnit) + 0.5;
      const cap = g.type === 'fermat' ? FERMAT_MAX + 1 : CANDIDATE_CAP;
      n = enumerateBlocks(g, k, { x0: cx - hw - rWorld, x1: cx + hw + rWorld, y0: cy - hh - rWorld, y1: cy + hh + rWorld }, out, cap, moving);
      if (n < 0) k = mode === 'cache' ? k + BASE * factor : k * 2;
    }
    if (n < 0) n = 0;

    // Colors
    const lut = new Uint32Array(10);
    pal.forEach((hex, d) => {
      let [r, gg, b] = hexToRgb(hex);
      if (L.isolatedDigit !== null && L.isolatedDigit !== d) [r, gg, b] = DIM;
      lut[d] = (255 << 24) | (b << 16) | (gg << 8) | r;
    });
    const work = workRef.current;
    if (!work.packed || work.packed.length < n) {
      work.packed = new Uint32Array(Math.max(n, 1024) * 2);
      work.sx = new Float32Array(work.packed.length);
      work.sy = new Float32Array(work.packed.length);
    }
    const packed = work.packed;
    const bytes = st.bytes;
    if (k === 1 || mode === 'sample') {
      for (let i = 0; i < n; i++) {
        const idx = Math.min(st.length - 1, Math.floor(out.j[i] * k + k / 2));
        const v = bytes[HEADER_BYTES + (idx >> 1)];
        packed[i] = lut[idx & 1 ? v & 15 : v >> 4];
      }
    } else {
      if (!work.counts || work.counts.length < n * 10) work.counts = new Uint16Array(Math.max(n, 1024) * 20);
      const counts = work.counts;
      counts.fill(0, 0, n * 10);
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        const a = out.j[i] * k;
        const e = Math.min(g.n, a + k);
        if (mode === 'cache') {
          const lvl = levels[factor];
          const unit = BASE * factor;
          const b1 = Math.min(lvl.cells, Math.ceil(e / unit));
          for (let q = a / unit; q < b1; q++) for (let d = 0; d < 10; d++) counts[o + d] += lvl.counts[q * 10 + d];
        } else {
          for (let idx = a; idx < e; idx++) {
            const v = bytes[HEADER_BYTES + (idx >> 1)];
            counts[o + (idx & 1 ? v & 15 : v >> 4)]++;
          }
        }
      }
      packed.set(colorizeCells(counts, n, pal, { mode: L.colorMode, enhance: L.enhance, isolated: L.isolatedDigit }).colors.subarray(0, n));
    }

    // Raster the small dots into an ImageData (device pixels); big ones are
    // drawn as antialiased arcs afterwards
    if (!work.image || work.image.width !== Wd || work.image.height !== Hd) work.image = ctx.createImageData(Wd, Hd);
    const image = work.image;
    const buf = new Uint32Array(image.data.buffer);
    buf.fill(BG);
    const rr = Math.max(0.5, dotRadius(k, pitch, dotUnit) * zd); // dot radius, device px
    const sx = work.sx;
    const sy = work.sy;
    const big = rr >= 4 * dpr;
    for (let i = 0; i < n; i++) {
      const x = (out.x[i] - cx) * zd + Wd / 2;
      const y = (out.y[i] - cy) * zd + Hd / 2;
      sx[i] = x;
      sy[i] = y;
      if (big) continue;
      if (rr <= 0.9) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix >= 0 && ix < Wd && iy >= 0 && iy < Hd) buf[iy * Wd + ix] = packed[i];
      } else {
        const x0 = Math.max(0, Math.floor(x - rr));
        const x1 = Math.min(Wd - 1, Math.ceil(x + rr));
        const y0 = Math.max(0, Math.floor(y - rr));
        const y1 = Math.min(Hd - 1, Math.ceil(y + rr));
        const r2 = rr * rr;
        for (let yy = y0; yy <= y1; yy++) {
          const ddy = yy + 0.5 - y;
          for (let xx = x0; xx <= x1; xx++) {
            const ddx = xx + 0.5 - x;
            if (ddx * ddx + ddy * ddy <= r2) buf[yy * Wd + xx] = packed[i];
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0);

    if (big) {
      const cssCache = new Map();
      const label = k === 1 && rr >= 9 * dpr;
      if (label) {
        ctx.font = `bold ${Math.floor(rr * 1.05)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      for (let i = 0; i < n; i++) {
        const x = sx[i];
        const y = sy[i];
        if (x < -rr || x > Wd + rr || y < -rr || y > Hd + rr) continue;
        let css = cssCache.get(packed[i]);
        if (css === undefined) {
          css = packedToCss(packed[i]);
          cssCache.set(packed[i], css);
        }
        ctx.fillStyle = css;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TWO_PI);
        ctx.fill();
        if (label) {
          const idx = out.j[i];
          const d = st.digit(idx);
          if (L.isolatedDigit === null || L.isolatedDigit === d) {
            const [r, gg, b] = hexToRgb(pal[d]);
            ctx.fillStyle = (r * 299 + gg * 587 + b * 114) / 1000 >= 140 ? '#0f172a' : '#ffffff';
            ctx.fillText(String(d), x, y + rr * 0.05);
          }
        }
      }
    }

    // Search matches
    const result = L.searchResult;
    if (result && result.pattern && result.matches.length > 0) {
      const pLen = result.pattern.length;
      result.matches.forEach((match, idx) => {
        const isActive = idx === L.activeMatchIndex;
        for (let q = 0; q < pLen; q++) {
          const i = match.index + q;
          if (i >= g.n) break;
          const [wx, wy] = g.pos(i + 0.5);
          const x = (wx - cx) * zd + Wd / 2;
          const y = (wy - cy) * zd + Hd / 2;
          if (x < -40 || x > Wd + 40 || y < -40 || y > Hd + 40) continue;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(rr * 1.6, 5 * dpr), 0, TWO_PI);
          ctx.fillStyle = isActive ? 'rgba(255,255,255,0.35)' : 'rgba(236,72,153,0.35)';
          ctx.fill();
          ctx.lineWidth = (isActive ? 2.5 : 1.5) * dpr;
          ctx.strokeStyle = isActive ? '#FDE047' : '#EC4899';
          ctx.stroke();
        }
      });
    }

    dotsRef.current = { n, k, sx, sy, j: out.j, rr };
    setInfo((prev) =>
      prev.k === k && prev.dots === n && prev.mode === mode && Math.abs(prev.zoom - viewRef.current.z) < 1e-9
        ? prev
        : { k, dots: n, mode, zoom: viewRef.current.z }
    );
  }, []);

  const scheduleDraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Mark the view as moving; once it has been still for a moment, redraw at full detail
  const markMoving = useCallback(() => {
    movingUntilRef.current = performance.now() + SETTLE_MS;
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(scheduleDraw, SETTLE_MS + 20);
  }, [scheduleDraw]);

  const minZoom = () => fitZoom(live.current.geom, sizeRef.current.w, sizeRef.current.h);

  const zoomBy = useCallback(
    (factor) => {
      const v = viewRef.current;
      v.z = clamp(v.z * factor, minZoom(), MAX_ZOOM);
      setHovered(null);
      markMoving();
      scheduleDraw();
    },
    [scheduleDraw, markMoving]
  );

  const fit = useCallback(() => {
    const v = viewRef.current;
    v.cx = 0;
    v.cy = 0;
    v.z = minZoom();
    setHovered(null);
    scheduleDraw();
  }, [scheduleDraw]);

  useGestures(containerRef, {
    onPan: (dx, dy) => {
      const v = viewRef.current;
      v.cx -= dx / v.z;
      v.cy -= dy / v.z;
      setHovered(null);
      markMoving();
      scheduleDraw();
    },
    onZoom: zoomBy,
    onDragChange: setIsDragging,
  });

  // Size the canvas to its container at the screen's real resolution
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    let first = true;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (first) {
        first = false;
        fit();
      } else {
        const v = viewRef.current;
        v.z = clamp(v.z, minZoom(), MAX_ZOOM);
        scheduleDraw();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      clearTimeout(settleTimerRef.current);
      rafRef.current = 0; // a stale id would stop scheduleDraw after a remount
    };
  }, [fit, scheduleDraw]);

  // A different spiral shape means different positions: start from the whole thing
  useEffect(() => {
    fit();
  }, [geom, fit]);

  useEffect(() => {
    scheduleDraw();
  }, [store, colors, colorMode, enhance, isolatedDigit, searchResult, activeMatchIndex, dotSize, scheduleDraw]);

  // Jumps from outside (search results, "Go to digit"); not on first mount
  const seenSeqRef = useRef(jump?.seq);
  useEffect(() => {
    if (!jump || jump.seq === seenSeqRef.current) return;
    seenSeqRef.current = jump.seq;
    if (jump.index === null || jump.index >= geom.n) return;
    const [x, y] = geom.pos(jump.index + 0.5);
    const v = viewRef.current;
    v.cx = x;
    v.cy = y;
    v.z = clamp(Math.max(v.z, 14 / dotRadius(1, spacing, dotUnit)), minZoom(), MAX_ZOOM); // zoom in far enough to read digits
    scheduleDraw();
  }, [jump, geom, dotUnit, spacing, scheduleDraw]);

  const handlePointerMove = (e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + 16}px`;
      tooltipRef.current.style.top = `${e.clientY + 16}px`;
    }
    if (isDragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { dpr } = sizeRef.current;
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const d = dotsRef.current;
    const reach = Math.max(6 * dpr, d.rr + 3 * dpr);
    let best = -1;
    let bestDist = reach * reach;
    for (let i = 0; i < d.n; i++) {
      const dx = d.sx[i] - mx;
      const dy = d.sy[i] - my;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (best < 0) {
      setHovered((prev) => (prev === null ? prev : null));
      return;
    }
    const j = d.j[best];
    setHovered((prev) => (prev && prev.j === j && prev.k === d.k ? prev : { j, k: d.k }));
  };

  const tip = useMemo(() => {
    if (!hovered) return null;
    const { j, k } = hovered;
    const start = j * k;
    const end = Math.min(geom.n, start + k) - 1;
    if (end <= start) return { single: true, digit: store.digit(start), start };
    const counts = new Array(10).fill(0);
    for (let i = start; i <= end; i++) counts[store.digit(i)]++;
    return { single: false, start, end, count: end - start + 1, counts };
  }, [hovered, geom, store]);

  const digitsPerDot = info.k;

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Type:</span>
            <select
              value={spiralType}
              onChange={(e) => setSpiralType(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="archimedes">Archimedean Coil</option>
              <option value="fermat">Fermat (Sunflower)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Tightness:</span>
            <input
              type="range"
              min="0.5"
              max="3.5"
              step="0.1"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Point Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={dotSize}
              onChange={(e) => setDotSize(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button onClick={() => zoomBy(1 / 1.3)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[64px] text-center">
              {Math.round((info.zoom / Math.max(1e-9, minZoom())) * 100).toLocaleString()}%
            </span>
            <button onClick={() => zoomBy(1.3)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={fit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Show the whole spiral"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* touch-none: the browser must not scroll or zoom the page from touches here */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
        className={`relative w-full h-[620px] bg-slate-950 overflow-hidden select-none touch-none overscroll-contain ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <canvas ref={canvasRef} className="block absolute inset-0 w-full h-full" />

        {tip && !isDragging && (
          <div
            ref={tooltipRef}
            className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl text-xs font-mono"
            style={{ left: `${pointerRef.current.x + 16}px`, top: `${pointerRef.current.y + 16}px` }}
          >
            {tip.single ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                    style={{ backgroundColor: colors[tip.digit] }}
                  >
                    {tip.digit}
                  </span>
                  <span className="font-bold text-slate-100">Digit: {tip.digit}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Spiral Position: <span className="text-purple-300 font-bold">#{tip.start.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-slate-100 mb-1">{tip.count.toLocaleString()} digits</div>
                <div className="text-slate-400 text-[11px]">
                  <span className="text-purple-300 font-bold">#{tip.start.toLocaleString()}</span> to{' '}
                  <span className="text-purple-300 font-bold">#{tip.end.toLocaleString()}</span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1 grid grid-cols-5 gap-x-2">
                  {tip.counts.map((n, d) => (
                    <span key={d}>
                      <span style={{ color: colors[d] }}>{d}</span> {((n / tip.count) * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isCounting && (
          <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
            <span>Counting digits...</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 max-w-[70%] bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          {digitsPerDot > 1 ? <Disc className="w-3 h-3 shrink-0 text-purple-400" /> : <Move className="w-3 h-3 shrink-0 text-purple-400" />}
          <span>
            Drag to pan • Scroll or pinch to zoom •{' '}
            {digitsPerDot > 1 ? `each dot is ${digitsPerDot.toLocaleString()} digits` : 'one dot per digit'}
            {spiralType === 'fermat' && store.length > FERMAT_MAX ? ` • Fermat shows the first ${FERMAT_MAX.toLocaleString()} digits` : ''}
          </span>
        </div>

        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>{info.dots.toLocaleString()} dots in view • {geom.n.toLocaleString()} digits</span>
        </div>
      </div>
    </div>
  );
}
