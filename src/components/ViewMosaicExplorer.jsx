import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, Layers } from 'lucide-react';
import { hexToRgb } from '../utils/aggregate';
import { HEADER_BYTES } from '../data/piParse.js';

// One cube per digit across the whole store, with no window: the canvas is the
// size of the viewport and only the cubes in view are drawn (a screen holds a
// few hundred thousand at most), so a billion-digit grid costs the same as a
// small one. The grid is `columns` wide and as tall as it needs to be.

const MIN_PX = 1;
const MAX_PX = 64;
const DIM = [30, 41, 59]; // dimmed color for isolated digits, as in the overview
const REPORT_DELAY_MS = 200;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function ViewMosaicExplorer({
  store,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
  jump,
  center, // digit index to start on
  onMove, // ({ center, first, last }) as the view settles
  onOverview, // switch to the zoomed-out overview
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gridRef = useRef(null); // offscreen 1px-per-cell canvas, scaled up when drawing

  const [columns, setColumns] = useState(200);
  const [cellPx, setCellPx] = useState(6); // label only; the live value is in viewRef
  const [shape, setShape] = useState('square');
  const [showDigits, setShowDigits] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [scroll, setScroll] = useState({ top: 0, size: 0 }); // scrubber thumb, 0-1
  const [isDragging, setIsDragging] = useState(false);

  // The live view lives in refs: panning and zooming redraw the canvas every
  // frame and must not go through React renders.
  const viewRef = useRef({ x: 0, y: 0, px: 6 }); // top-left in cell units; screen px per cell
  const sizeRef = useRef({ w: 0, h: 0 });
  const dragRef = useRef(null);
  const rafRef = useRef(0);
  const reportTimerRef = useRef(0);
  const pendingCenterRef = useRef(center ?? 0);

  // Everything the draw function reads, kept current without re-subscribing handlers
  const live = useRef({});
  live.current = { store, colors, isolatedDigit, searchResult, activeMatchIndex, columns, shape, showDigits, showGridLines, onMove };

  const rowsOf = (cols) => Math.max(1, Math.ceil(store.length / cols));

  const clampView = useCallback(() => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const { columns: cols, store: st } = live.current;
    const rows = Math.max(1, Math.ceil(st.length / cols));
    // Let the edges reach the middle of the screen, but not drift away
    v.x = clamp(v.x, -(w / v.px) * 0.5, cols - (w / v.px) * 0.5);
    v.y = clamp(v.y, -(h / v.px) * 0.5, rows - (h / v.px) * 0.5);
  }, []);

  const centerIndex = useCallback(() => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const { columns: cols, store: st } = live.current;
    const col = Math.floor(v.x + w / (2 * v.px));
    const row = Math.floor(v.y + h / (2 * v.px));
    return clamp(row * cols + clamp(col, 0, cols - 1), 0, st.length - 1);
  }, []);

  const reportSoon = useCallback(() => {
    clearTimeout(reportTimerRef.current);
    reportTimerRef.current = setTimeout(() => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const { columns: cols, store: st, onMove: move } = live.current;
      if (!move || !w) return;
      const firstRow = Math.max(0, Math.floor(v.y));
      const lastRow = Math.floor(v.y + h / v.px);
      move({
        center: centerIndex(),
        first: clamp(firstRow * cols, 0, st.length - 1),
        last: clamp((lastRow + 1) * cols - 1, 0, st.length - 1),
      });
    }, REPORT_DELAY_MS);
  }, [centerIndex]);

  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!canvas || !w || !h) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const { store: st, colors: pal, isolatedDigit: iso, searchResult: result, activeMatchIndex: active, columns: cols, shape: shp, showDigits: digits, showGridLines: lines } = live.current;
    const { x, y, px } = viewRef.current;
    const total = st.length;
    const rows = Math.max(1, Math.ceil(total / cols));

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const c0 = Math.max(0, Math.floor(x));
    const c1 = Math.min(cols, Math.ceil(x + w / px));
    const r0 = Math.max(0, Math.floor(y));
    const r1 = Math.min(rows, Math.ceil(y + h / px));
    const nCols = c1 - c0;
    const nRows = r1 - r0;

    if (nCols > 0 && nRows > 0) {
      const lut = new Uint32Array(10);
      pal.forEach((hex, d) => {
        let [r, g, b] = hexToRgb(hex);
        if (iso !== null && iso !== d) [r, g, b] = DIM;
        lut[d] = (255 << 24) | (b << 16) | (g << 8) | r;
      });

      const drawText = digits && px >= 12;
      const bytes = st.bytes;

      if (shp === 'square' && !drawText) {
        let grid = gridRef.current;
        if (!grid) grid = gridRef.current = document.createElement('canvas');
        if (grid.width !== nCols || grid.height !== nRows) {
          grid.width = nCols;
          grid.height = nRows;
        }
        const gctx = grid.getContext('2d');
        const image = gctx.createImageData(nCols, nRows);
        const buf = new Uint32Array(image.data.buffer);
        for (let r = 0; r < nRows; r++) {
          const rowStart = (r0 + r) * cols + c0;
          const out = r * nCols;
          for (let c = 0; c < nCols; c++) {
            const idx = rowStart + c;
            if (idx >= total) break;
            const v = bytes[HEADER_BYTES + (idx >> 1)];
            buf[out + c] = lut[idx & 1 ? v & 15 : v >> 4];
          }
        }
        gctx.putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(grid, (c0 - x) * px, (r0 - y) * px, nCols * px, nRows * px);
      } else {
        // Shapes and labels cost a draw call per cube, which is fine at the
        // few thousand cubes that fit on screen at these sizes.
        const radius = shp === 'circle' ? px / 2 : shp === 'rounded' ? Math.max(1, px * 0.25) : 0;
        if (drawText) {
          ctx.font = `bold ${Math.floor(px * 0.55)}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
        }
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const idx = r * cols + c;
            if (idx >= total) break;
            const v = bytes[HEADER_BYTES + (idx >> 1)];
            const d = idx & 1 ? v & 15 : v >> 4;
            const sx = (c - x) * px;
            const sy = (r - y) * px;
            const dimmed = iso !== null && iso !== d;
            ctx.fillStyle = dimmed ? '#1e293b' : pal[d];
            if (shp === 'square') {
              ctx.fillRect(sx, sy, px, px);
            } else if (shp === 'circle') {
              ctx.beginPath();
              ctx.arc(sx + radius, sy + radius, radius * 0.9, 0, Math.PI * 2);
              ctx.fill();
            } else {
              roundedRect(ctx, sx + 0.5, sy + 0.5, px - 1, px - 1, radius);
              ctx.fill();
            }
            if (drawText && !dimmed) {
              ctx.fillStyle = contrastColor(pal[d]);
              ctx.fillText(String(d), sx + px / 2, sy + px / 2);
            }
          }
        }
      }

      if (lines && px >= 4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let c = c0; c <= c1; c++) {
          ctx.moveTo((c - x) * px, 0);
          ctx.lineTo((c - x) * px, h);
        }
        for (let r = r0; r <= r1; r++) {
          ctx.moveTo(0, (r - y) * px);
          ctx.lineTo(w, (r - y) * px);
        }
        ctx.stroke();
      }
    }

    // Search matches in view. Small cubes get a ring so they stay findable.
    if (result && result.pattern && result.matches.length > 0) {
      const pLen = result.pattern.length;
      result.matches.forEach((match, idx) => {
        const isActive = idx === active;
        const firstRow = Math.floor(match.index / cols);
        const lastRow = Math.floor((match.index + pLen - 1) / cols);
        if (lastRow < y - 2 || firstRow > y + h / px + 2) return;

        ctx.strokeStyle = isActive ? '#FFFFFF' : '#EC4899';
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : 'rgba(236, 72, 153, 0.25)';
        ctx.lineWidth = Math.max(1, Math.min(2, px * 0.3));
        for (let k = 0; k < pLen; k++) {
          const i = match.index + k;
          const sx = ((i % cols) - x) * px;
          const sy = (Math.floor(i / cols) - y) * px;
          if (sx < -px || sy < -px || sx > w || sy > h) continue;
          ctx.fillRect(sx, sy, px, px);
          ctx.strokeRect(sx, sy, px, px);
        }

        const sx = ((match.index % cols) - x) * px + px / 2;
        const sy = (firstRow - y) * px + px / 2;
        if (px < 8 || isActive) {
          ctx.save();
          ctx.lineWidth = isActive ? 3 : 2;
          ctx.strokeStyle = isActive ? '#FDE047' : '#EC4899';
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(isActive ? 14 : 8, px * 1.2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    const top = clamp(y / rows, 0, 1);
    const size = clamp(h / px / rows, 0, 1);
    setScroll((prev) => (prev.top === top && prev.size === size ? prev : { top, size }));
  }, []);

  const scheduleDraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const centerOn = useCallback(
    (index) => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const { columns: cols } = live.current;
      v.x = (index % cols) + 0.5 - w / (2 * v.px);
      v.y = Math.floor(index / cols) + 0.5 - h / (2 * v.px);
      clampView();
      scheduleDraw();
      reportSoon();
    },
    [clampView, scheduleDraw, reportSoon]
  );

  // Size the canvas to its container, and place the view on first layout
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      sizeRef.current = { w, h };
      canvas.width = w;
      canvas.height = h;
      if (pendingCenterRef.current !== null) {
        const index = pendingCenterRef.current;
        pendingCenterRef.current = null;
        centerOn(index);
      } else {
        scheduleDraw();
      }
      reportSoon();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0; // a stale id would stop scheduleDraw after a remount
      clearTimeout(reportTimerRef.current);
    };
  }, [centerOn, scheduleDraw, reportSoon]);

  // Redraw when anything that changes the picture changes
  useEffect(() => {
    scheduleDraw();
  }, [store, colors, isolatedDigit, searchResult, activeMatchIndex, columns, shape, showDigits, showGridLines, scheduleDraw]);

  // Changing the grid width keeps the same digit in the middle
  const columnsChangeRef = useRef(null);
  useEffect(() => {
    if (columnsChangeRef.current !== null) {
      centerOn(columnsChangeRef.current);
      columnsChangeRef.current = null;
    }
  }, [columns, centerOn]);

  // Jumps from outside (search results, "Go to digit"); not on first mount
  const seenSeqRef = useRef(jump?.seq);
  useEffect(() => {
    if (jump && jump.seq !== seenSeqRef.current) {
      seenSeqRef.current = jump.seq;
      if (jump.index !== null) centerOn(jump.index);
    }
  }, [jump, centerOn]);

  // Wheel zoom around the cursor. Native listener so it can preventDefault
  // (React's wheel handlers are passive).
  useEffect(() => {
    const container = containerRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = viewRef.current;
      const next = clamp(v.px * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_PX, MAX_PX);
      const wx = v.x + mx / v.px;
      const wy = v.y + my / v.px;
      v.px = next;
      v.x = wx - mx / next;
      v.y = wy - my / next;
      clampView();
      setCellPx(next);
      scheduleDraw();
      reportSoon();
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [clampView, scheduleDraw, reportSoon]);

  const zoomBy = (factor) => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const next = clamp(v.px * factor, MIN_PX, MAX_PX);
    const wx = v.x + w / (2 * v.px);
    const wy = v.y + h / (2 * v.px);
    v.px = next;
    v.x = wx - w / (2 * next);
    v.y = wy - h / (2 * next);
    clampView();
    setCellPx(next);
    scheduleDraw();
    reportSoon();
  };

  const setPxExactly = (px) => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const wx = v.x + w / (2 * v.px);
    const wy = v.y + h / (2 * v.px);
    v.px = px;
    v.x = wx - w / (2 * px);
    v.y = wy - h / (2 * px);
    clampView();
    setCellPx(px);
    scheduleDraw();
    reportSoon();
  };

  // Drag to pan
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };
  useEffect(() => {
    if (!isDragging) return undefined;
    const move = (e) => {
      const v = viewRef.current;
      const d = dragRef.current;
      v.x -= (e.clientX - d.x) / v.px;
      v.y -= (e.clientY - d.y) / v.px;
      dragRef.current = { x: e.clientX, y: e.clientY };
      clampView();
      scheduleDraw();
      reportSoon();
    };
    const up = () => setIsDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDragging, clampView, scheduleDraw, reportSoon]);

  const handleMouseMove = (e) => {
    if (isDragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const col = Math.floor(v.x + (e.clientX - rect.left) / v.px);
    const row = Math.floor(v.y + (e.clientY - rect.top) / v.px);
    const index = row * columns + col;
    if (col >= 0 && col < columns && row >= 0 && index < store.length) {
      setHovered({ index, digit: store.charAt(index), clientX: e.clientX, clientY: e.clientY });
    } else {
      setHovered(null);
    }
  };

  // Scrubber: drag the thumb (or click the track) to move through every row
  const scrubTo = (clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const frac = clamp((clientY - rect.top) / rect.height, 0, 1);
    const v = viewRef.current;
    const { h } = sizeRef.current;
    v.y = frac * rowsOf(columns) - h / (2 * v.px);
    clampView();
    scheduleDraw();
    reportSoon();
  };
  const handleScrubDown = (e) => {
    e.stopPropagation();
    scrubTo(e.clientY);
    const move = (ev) => scrubTo(ev.clientY);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const rows = rowsOf(columns);
  const thumbTop = `${scroll.top * 100}%`;
  const thumbHeight = `max(6px, ${scroll.size * 100}%)`;

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Grid Width:</span>
            <select
              value={columns}
              onChange={(e) => {
                columnsChangeRef.current = centerIndex();
                setColumns(Number(e.target.value));
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={50}>50 cols</option>
              <option value={100}>100 cols</option>
              <option value={200}>200 cols</option>
              <option value={314}>314 cols (π!)</option>
              <option value={500}>500 cols</option>
              <option value={1000}>1,000 cols</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Cube Size:</span>
            <select
              value={[1, 2, 4, 6, 8, 12, 16, 24, 32].includes(Math.round(cellPx)) ? Math.round(cellPx) : ''}
              onChange={(e) => e.target.value && setPxExactly(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="" disabled>
                {cellPx.toFixed(1)}px
              </option>
              {[1, 2, 4, 6, 8, 12, 16, 24, 32].map((n) => (
                <option key={n} value={n}>
                  {n}px{n === 1 ? ' (Dense)' : n === 6 ? ' (Standard)' : n === 16 ? ' (Readable)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Shape:</span>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
              <option value="circle">Dots</option>
            </select>
          </div>

          {cellPx >= 12 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showDigits}
                onChange={(e) => setShowDigits(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
              />
              <span>Show Digit Labels</span>
            </label>
          )}

          {cellPx >= 4 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showGridLines}
                onChange={(e) => setShowGridLines(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
              />
              <span>Grid Lines</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button onClick={() => zoomBy(1 / 1.3)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[52px] text-center">{cellPx.toFixed(1)}px</span>
            <button onClick={() => zoomBy(1.3)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onOverview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Zoom out past one pixel per cube: see every digit at once, many digits per cube"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        className={`relative w-full h-[580px] bg-slate-950 overflow-hidden select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <canvas ref={canvasRef} className="block absolute inset-0" />

        {/* Scrubber over every row of the grid */}
        <div
          onMouseDown={handleScrubDown}
          className="absolute top-0 bottom-0 right-0 w-3.5 bg-slate-900/70 border-l border-slate-800 cursor-pointer"
          title="Drag to move through every digit"
        >
          <div className="absolute left-0.5 right-0.5 rounded bg-purple-500/80" style={{ top: thumbTop, height: thumbHeight }} />
        </div>

        {hovered && !isDragging && (
          <div
            className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl text-xs font-mono"
            style={{ left: `${hovered.clientX + 16}px`, top: `${hovered.clientY + 16}px` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                style={{ backgroundColor: colors[Number(hovered.digit)] }}
              >
                {hovered.digit}
              </span>
              <span className="font-bold text-slate-100">Digit: {hovered.digit}</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Index: <span className="text-purple-300 font-bold">#{hovered.index.toLocaleString()}</span>{' '}
              {hovered.index === 0 ? '(Integer 3)' : `(Decimal #${hovered.index.toLocaleString()})`}
            </div>
            <div className="text-slate-500 text-[10px]">
              Row {Math.floor(hovered.index / columns).toLocaleString()}, column {hovered.index % columns}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Move className="w-3 h-3 text-purple-400" />
          <span>Drag to pan • Scroll to zoom • Right edge scrubs all {store.length.toLocaleString()} digits</span>
        </div>

        <div className="absolute bottom-3 right-6 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>
            {columns.toLocaleString()} × {rows.toLocaleString()} grid ({store.length.toLocaleString()} cubes)
          </span>
        </div>
      </div>
    </div>
  );
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function contrastColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#0f172a' : '#ffffff';
}
