import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock, Sparkles } from 'lucide-react';
import { hexToRgb } from '../utils/aggregate';
import { useGestures } from '../utils/useGestures';

// A phyllotaxis-style spiral whose pattern depends on the zoom. Digit i sits at
// radius sqrt(i) and angle i * turn, where `turn` (the fraction of a full turn
// between consecutive digits) slides along a ladder of notable values as you
// zoom in. Near a rational turn such as 1/3 the digits line up in straight arms;
// near an irrational one such as the golden ratio they form interlocking spirals.
// Zooming therefore both magnifies and reshapes the picture.

const MAX_DOTS = 400_000;
const OCTAVES = 7; // zoom range above "fit", in doublings (one ladder step each)
const BG = (255 << 24) | (0x12 << 16) | (0x07 << 8) | 0x03; // #030712
const DIM = [30, 41, 59];
const TWO_PI = Math.PI * 2;

// Exact fractions would put every digit on a few thin rays, so the "arms" stops are nudged
const NUDGE = 0.003;
const LADDER = [
  { name: 'Golden sunflower', turn: 0.3819660113 },
  { name: 'Three arms', turn: 1 / 3 + NUDGE },
  { name: 'Silver spiral', turn: Math.SQRT2 - 1 },
  { name: 'Four arms', turn: 1 / 4 + NUDGE },
  { name: 'Plastic spiral', turn: 0.3247179572 },
  { name: 'Five arms', turn: 1 / 5 + NUDGE },
  { name: 'Pi spiral', turn: Math.PI - 3 },
  { name: 'Golden sunflower', turn: 0.3819660113 },
];

const smooth = (u) => u * u * (3 - 2 * u);

// p in [0, OCTAVES]: where we are on the ladder
function patternAt(p) {
  const s = Math.min(LADDER.length - 2, Math.floor(p));
  const u = smooth(Math.min(1, p - s));
  const a = LADDER[s];
  const b = LADDER[s + 1];
  return { turn: a.turn + (b.turn - a.turn) * u, name: (u < 0.5 ? a : b).name };
}

export default function ViewMorphSpiral({ store, colors, isolatedDigit }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const viewRef = useRef({ o: 0, px: 0, py: 0 }); // octaves above fit, world point at screen center
  const bufRef = useRef(null);
  const bucketRef = useRef(null);
  const live = useRef({});
  const [o, setO] = useState(0);
  const [locked, setLocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  live.current = { store, colors, isolatedDigit, locked, lockedP: live.current.lockedP ?? 0 };

  const fitZoom = () => {
    const { w, h } = sizeRef.current;
    const n = Math.min(live.current.store.length, MAX_DOTS);
    return (0.46 * Math.min(w, h)) / Math.sqrt(Math.max(1, n));
  };

  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const { w, h, dpr } = sizeRef.current;
    if (!canvas || !w || !h) return;
    const L = live.current;
    const v = viewRef.current;
    const n = Math.min(L.store.length, MAX_DOTS);
    const p = L.locked ? L.lockedP : v.o;
    const { turn } = patternAt(p);
    const zd = fitZoom() * 2 ** v.o * dpr; // device px per world unit
    const W = canvas.width;
    const H = canvas.height;
    const ox = W / 2 - v.px * zd;
    const oy = H / 2 - v.py * zd;
    const dia = zd * 1.5;

    const pal = (L.colors || []).map((hex, d) => (L.isolatedDigit !== null && L.isolatedDigit !== d ? DIM : hexToRgb(hex)));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (dia < 3) {
      const packed = pal.map(([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r);
      if (!bufRef.current || bufRef.current.w !== W || bufRef.current.h !== H) {
        const img = ctx.createImageData(W, H);
        bufRef.current = { w: W, h: H, img, u32: new Uint32Array(img.data.buffer) };
      }
      const { img, u32 } = bufRef.current;
      u32.fill(BG);
      const size = dia >= 1.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = (i * turn) % 1 * TWO_PI;
        const r = Math.sqrt(i + 0.5) * zd;
        const x = (ox + r * Math.cos(a)) | 0;
        const y = (oy + r * Math.sin(a)) | 0;
        if (x < 0 || y < 0 || x + size > W || y + size > H) continue;
        const c = packed[L.store.digit(i)];
        u32[y * W + x] = c;
        if (size === 2) {
          u32[y * W + x + 1] = c;
          u32[(y + 1) * W + x] = c;
          u32[(y + 1) * W + x + 1] = c;
        }
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // Big dots: bucket the visible ones by digit and fill each color in one path
    if (!bucketRef.current) {
      bucketRef.current = Array.from({ length: 10 }, () => ({ x: new Float32Array(MAX_DOTS), y: new Float32Array(MAX_DOTS), n: 0 }));
    }
    const buckets = bucketRef.current;
    for (const b of buckets) b.n = 0;
    const pad = dia;
    for (let i = 0; i < n; i++) {
      const a = (i * turn) % 1 * TWO_PI;
      const r = Math.sqrt(i + 0.5) * zd;
      const x = ox + r * Math.cos(a);
      const y = oy + r * Math.sin(a);
      if (x < -pad || y < -pad || x > W + pad || y > H + pad) continue;
      const b = buckets[L.store.digit(i)];
      b.x[b.n] = x;
      b.y[b.n] = y;
      b.n++;
    }
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);
    const rad = dia / 2;
    for (let d = 0; d < 10; d++) {
      const b = buckets[d];
      if (!b.n) continue;
      const [r, g, bl] = pal[d];
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      ctx.beginPath();
      if (dia < 6) {
        for (let k = 0; k < b.n; k++) ctx.rect(b.x[k] - rad, b.y[k] - rad, dia, dia);
      } else {
        for (let k = 0; k < b.n; k++) {
          ctx.moveTo(b.x[k] + rad, b.y[k]);
          ctx.arc(b.x[k], b.y[k], rad, 0, TWO_PI);
        }
      }
      ctx.fill();
      if (dia >= 18) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.round(rad)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let k = 0; k < b.n; k++) ctx.fillText(String(d), b.x[k], b.y[k] + 1);
      }
    }
  }, []);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const setOctaves = useCallback(
    (next) => {
      viewRef.current.o = Math.min(OCTAVES, Math.max(0, next));
      setO(viewRef.current.o);
      schedule();
    },
    [schedule]
  );

  useGestures(containerRef, {
    onPan: (dx, dy) => {
      const zoom = (fitZoom() * 2 ** viewRef.current.o);
      viewRef.current.px -= dx / zoom;
      viewRef.current.py -= dy / zoom;
      schedule();
    },
    onZoom: (f) => setOctaves(viewRef.current.o + Math.log2(f)),
    onDragChange: setIsDragging,
  });

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      bufRef.current = null;
      schedule();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [schedule]);

  useEffect(schedule, [store, colors, isolatedDigit, locked, schedule]);

  const toggleLock = () => {
    live.current.lockedP = viewRef.current.o;
    setLocked((l) => !l);
  };
  const fit = () => {
    viewRef.current.px = 0;
    viewRef.current.py = 0;
    setOctaves(0);
  };

  const pattern = patternAt(locked ? live.current.lockedP : o);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-100">{pattern.name}</span>
          <span className="font-mono text-slate-400">{(pattern.turn * 360).toFixed(2)}° per digit</span>
          <button
            onClick={toggleLock}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${
              locked ? 'bg-purple-600/30 border-purple-500 text-purple-200' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
            }`}
            title="Keep the current pattern while zooming"
          >
            {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{locked ? 'Pattern locked' : 'Lock pattern'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button onClick={() => setOctaves(o - 0.4)} className="p-1 rounded hover:bg-slate-800" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="0"
              max={OCTAVES}
              step="0.01"
              value={o}
              onChange={(e) => setOctaves(Number(e.target.value))}
              className="w-28 sm:w-48 accent-purple-500"
              aria-label="Zoom"
              title="Zoom: the pattern changes as you go"
            />
            <button onClick={() => setOctaves(o + 0.4)} className="p-1 rounded hover:bg-slate-800" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={fit} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`relative w-full h-[620px] bg-slate-950 overflow-hidden select-none touch-none overscroll-contain ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <canvas ref={canvasRef} className="block absolute inset-0 w-full h-full" />
        <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 pointer-events-none">
          Zoom to morph the pattern • drag to pan • first {Math.min(store.length, MAX_DOTS).toLocaleString()} digits
        </div>
      </div>
    </div>
  );
}
