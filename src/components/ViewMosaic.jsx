import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, Layers, Maximize2, Loader2, Crosshair } from 'lucide-react';
import { aggregateCounts, cellCount, colorizeCells, hexToRgb, packedToCss } from '../utils/aggregate';
import { useGestures } from '../utils/useGestures';
import { HEADER_BYTES } from '../data/piParse.js';

// The mosaic is a grid of cells on a canvas the size of the viewport; only the
// cells in view are drawn, so panning and zooming cost the same whether the
// grid holds a million cells or a billion.
//
//   perCell 1   every digit is a cube, read straight from the store (the whole
//               billion is scrollable; `center` says where to start)
//   perCell > 1 each cell stands for a block of digits (counted once for the
//               current window, then recolored from the counts)
//
// Zoom always goes around the center of the view.

const MAX_PX = 64;
const DIM = [30, 41, 59]; // dimmed color for isolated digits, as in the overview
const REPORT_DELAY_MS = 200;
const PX_CHOICES = [1, 2, 4, 6, 8, 12, 16, 24, 32];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function ViewMosaic({
  store,
  start,
  windowSize,
  perCell,
  colorMode,
  enhance,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
  jump,
  center, // 1:1 only: digit index to start on
  onMove, // 1:1 only: ({ center, first, last }) as the view settles
  onOverview, // switch to the zoomed-out overview
  onZoomInto, // from the overview, zoom in to individual cubes at a digit
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gridRef = useRef(null); // offscreen 1px-per-cell canvas, scaled up when drawing
  const tooltipRef = useRef(null);

  const isDigits = perCell === 1;
  const minPx = isDigits ? 1 : 0.05;

  const [digitColumns, setDigitColumns] = useState(200);
  const [overviewColumns, setOverviewColumns] = useState(1000);
  const columns = isDigits ? digitColumns : overviewColumns;
  const [uiPx, setUiPx] = useState(6); // label only; the live value is in viewRef
  const [shape, setShape] = useState('square');
  const [showDigits, setShowDigits] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [scroll, setScroll] = useState({ top: 0, size: 0 }); // scrubber thumb, 0-1
  const [isDragging, setIsDragging] = useState(false);

  // Zoomed out: digit counts per cell for the current window and scale. Counting
  // is the slow part (a billion digits take ~2s), so it runs once per
  // window/scale; palette, isolation and color mode just recolor the counts.
  const cellsWanted = cellCount(start, start + windowSize, perCell);
  const [agg, setAgg] = useState(null); // { counts, cells, start, perCell }
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    if (isDigits) {
      setAgg(null);
      setIsCounting(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setIsCounting(true);
    aggregateCounts(store, start, perCell, cellsWanted, { signal: ctrl.signal }).then((counts) => {
      if (counts && !ctrl.signal.aborted) {
        setAgg({ counts, cells: cellsWanted, start, perCell });
        setIsCounting(false);
      }
    });
    return () => ctrl.abort();
  }, [store, start, perCell, cellsWanted, isDigits]);

  const cellData = useMemo(() => {
    if (!agg) return null;
    return colorizeCells(agg.counts, agg.cells, colors, { mode: colorMode, enhance, isolated: isolatedDigit });
  }, [agg, colors, colorMode, enhance, isolatedDigit]);

  // What the grid is made of right now
  const source = useMemo(() => {
    if (isDigits) return { kind: 'digits', total: store.length, perCell: 1, base: 0 };
    if (!agg || !cellData) return null;
    return { kind: 'agg', total: agg.cells, perCell: agg.perCell, base: agg.start, agg, cellData };
  }, [isDigits, store, agg, cellData]);

  // The live view lives in refs: panning and zooming redraw the canvas every
  // frame and must not go through React renders.
  const viewRef = useRef({ x: 0, y: 0, px: 6 }); // top-left in cell units; screen px per cell
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const reportTimerRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pendingCenterRef = useRef(isDigits ? center ?? 0 : null);
  const fitKeyRef = useRef('');

  // Everything the draw function reads, kept current without re-subscribing handlers
  const live = useRef({});
  live.current = { source, store, colors, isolatedDigit, searchResult, activeMatchIndex, columns, shape, showDigits, showGridLines, onMove, minPx };

  const totalOf = () => live.current.source?.total ?? 0;
  const rowsOf = (cols, total) => Math.max(1, Math.ceil(total / cols));

  const clampView = useCallback(() => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const { columns: cols } = live.current;
    const rows = rowsOf(cols, totalOf());
    // Let the edges reach the middle of the screen, but not drift away
    v.x = clamp(v.x, -(w / v.px) * 0.5, cols - (w / v.px) * 0.5);
    v.y = clamp(v.y, -(h / v.px) * 0.5, rows - (h / v.px) * 0.5);
  }, []);

  const centerCell = useCallback(() => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    const { columns: cols } = live.current;
    const col = Math.floor(v.x + w / (2 * v.px));
    const row = Math.floor(v.y + h / (2 * v.px));
    return clamp(row * cols + clamp(col, 0, cols - 1), 0, Math.max(0, totalOf() - 1));
  }, []);

  const reportSoon = useCallback(() => {
    clearTimeout(reportTimerRef.current);
    reportTimerRef.current = setTimeout(() => {
      const { source: src, columns: cols, store: st, onMove: move } = live.current;
      const { w, h } = sizeRef.current;
      if (!move || !w || !src || src.kind !== 'digits') return;
      const v = viewRef.current;
      const firstRow = Math.max(0, Math.floor(v.y));
      const lastRow = Math.floor(v.y + h / v.px);
      move({
        center: centerCell(),
        first: clamp(firstRow * cols, 0, st.length - 1),
        last: clamp((lastRow + 1) * cols - 1, 0, st.length - 1),
      });
    }, REPORT_DELAY_MS);
  }, [centerCell]);

  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!canvas || !w || !h) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const { source: src, store: st, colors: pal, isolatedDigit: iso, searchResult: result, activeMatchIndex: active, columns: cols, shape: shp, showDigits: digits, showGridLines: lines } = live.current;
    const { x, y, px } = viewRef.current;

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);
    setUiPx((prev) => (Math.abs(prev - px) < 0.005 ? prev : px));
    if (!src) return;

    const total = src.total;
    const rows = rowsOf(cols, total);
    const c0 = Math.max(0, Math.floor(x));
    const c1 = Math.min(cols, Math.ceil(x + w / px));
    const r0 = Math.max(0, Math.floor(y));
    const r1 = Math.min(rows, Math.ceil(y + h / px));
    const nCols = c1 - c0;
    const nRows = r1 - r0;

    if (nCols > 0 && nRows > 0) {
      const isDigitSrc = src.kind === 'digits';
      const bytes = st.bytes;
      const lut = new Uint32Array(10);
      pal.forEach((hex, d) => {
        let [r, g, b] = hexToRgb(hex);
        if (iso !== null && iso !== d) [r, g, b] = DIM;
        lut[d] = (255 << 24) | (b << 16) | (g << 8) | r;
      });
      const drawText = isDigitSrc && digits && px >= 12;

      if (shp === 'square' && !drawText) {
        // One pixel per cell in an ImageData, scaled to the screen. A draw call
        // per cell would take seconds at a million cells.
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
          if (rowStart >= total) break;
          const out = r * nCols;
          const len = Math.min(nCols, total - rowStart);
          if (isDigitSrc) {
            for (let c = 0; c < len; c++) {
              const idx = rowStart + c;
              const v = bytes[HEADER_BYTES + (idx >> 1)];
              buf[out + c] = lut[idx & 1 ? v & 15 : v >> 4];
            }
          } else {
            buf.set(src.cellData.colors.subarray(rowStart, rowStart + len), out);
          }
        }
        gctx.putImageData(image, 0, 0);
        // Sharp cubes when magnified; smoothed when zoomed out past a cell per pixel
        ctx.imageSmoothingEnabled = px < 1;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(grid, (c0 - x) * px, (r0 - y) * px, nCols * px, nRows * px);
      } else {
        // Shapes and labels cost a draw call per cell; only the cells in view
        const radius = shp === 'circle' ? px / 2 : shp === 'rounded' ? Math.max(1, px * 0.25) : 0;
        if (drawText) {
          ctx.font = `bold ${Math.floor(px * 0.55)}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
        }
        const cssCache = new Map();
        for (let r = r0; r < r1; r++) {
          for (let c = c0; c < c1; c++) {
            const idx = r * cols + c;
            if (idx >= total) break;
            let d = 0;
            let css;
            let dimmed = false;
            if (isDigitSrc) {
              const v = bytes[HEADER_BYTES + (idx >> 1)];
              d = idx & 1 ? v & 15 : v >> 4;
              dimmed = iso !== null && iso !== d;
              css = dimmed ? '#1e293b' : pal[d];
            } else {
              const packed = src.cellData.colors[idx];
              css = cssCache.get(packed);
              if (css === undefined) {
                css = packedToCss(packed);
                cssCache.set(packed, css);
              }
            }
            const sx = (c - x) * px;
            const sy = (r - y) * px;
            ctx.fillStyle = css;
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

    // Search matches. Small cells get a ring so they stay findable.
    if (result && result.pattern && result.matches.length > 0) {
      const pLen = result.pattern.length;
      result.matches.forEach((match, idx) => {
        const isActive = idx === active;
        const first = Math.floor((match.index - src.base) / src.perCell);
        const last = Math.floor((match.index + pLen - 1 - src.base) / src.perCell);
        if (last < 0 || first >= total) return;
        const firstRow = Math.floor(first / cols);
        if (Math.floor(last / cols) < y - 2 || firstRow > y + h / px + 2) return;

        ctx.strokeStyle = isActive ? '#FFFFFF' : '#EC4899';
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : 'rgba(236, 72, 153, 0.25)';
        ctx.lineWidth = Math.max(1, Math.min(2, px * 0.3));
        for (let cell = Math.max(0, first); cell <= Math.min(total - 1, last); cell++) {
          const sx = ((cell % cols) - x) * px;
          const sy = (Math.floor(cell / cols) - y) * px;
          if (sx < -px || sy < -px || sx > w || sy > h) continue;
          ctx.fillRect(sx, sy, px, px);
          ctx.strokeRect(sx, sy, px, px);
        }

        if (px < 8 || isActive) {
          const sx = ((first % cols) - x) * px + px / 2;
          const sy = (firstRow - y) * px + px / 2;
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
    (cell) => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const { columns: cols } = live.current;
      v.x = (cell % cols) + 0.5 - w / (2 * v.px);
      v.y = Math.floor(cell / cols) + 0.5 - h / (2 * v.px);
      clampView();
      scheduleDraw();
      reportSoon();
    },
    [clampView, scheduleDraw, reportSoon]
  );

  // Zoom around the center of the view, whatever the input
  const zoomBy = useCallback(
    (factor) => {
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const next = clamp(v.px * factor, live.current.minPx, MAX_PX);
      const wx = v.x + w / (2 * v.px);
      const wy = v.y + h / (2 * v.px);
      v.px = next;
      v.x = wx - w / (2 * next);
      v.y = wy - h / (2 * next);
      clampView();
      scheduleDraw();
      reportSoon();
    },
    [clampView, scheduleDraw, reportSoon]
  );

  const setPxExactly = (px) => zoomBy(clamp(px, minPx, MAX_PX) / viewRef.current.px);

  // Zoom out until the whole grid fits, centered
  const fitView = useCallback(() => {
    const { w, h } = sizeRef.current;
    const { columns: cols } = live.current;
    const total = totalOf();
    if (!w || !h || !total) return;
    const rows = rowsOf(cols, total);
    const v = viewRef.current;
    v.px = clamp(Math.min(w / cols, h / rows), live.current.minPx, MAX_PX);
    v.x = cols / 2 - w / (2 * v.px);
    v.y = rows / 2 - h / (2 * v.px);
    clampView();
    scheduleDraw();
  }, [clampView, scheduleDraw]);

  // Pan and pinch/wheel zoom, for mouse and touch, without scrolling the page
  useGestures(containerRef, {
    onPan: (dx, dy) => {
      const v = viewRef.current;
      v.x -= dx / v.px;
      v.y -= dy / v.px;
      clampView();
      scheduleDraw();
      reportSoon();
    },
    onZoom: zoomBy,
    onDragChange: setIsDragging,
  });

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
        const cell = pendingCenterRef.current;
        pendingCenterRef.current = null;
        centerOn(cell);
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

  // Fit the whole grid when a zoomed-out view first arrives or changes scale
  useEffect(() => {
    if (!source || source.kind !== 'agg') return;
    const key = `${source.perCell}:${columns}`;
    if (fitKeyRef.current !== key) {
      fitKeyRef.current = key;
      fitView();
    }
  }, [source, columns, fitView]);
  useEffect(() => {
    if (isDigits) fitKeyRef.current = '';
  }, [isDigits]);

  // Redraw when anything that changes the picture changes
  useEffect(() => {
    scheduleDraw();
  }, [source, store, colors, isolatedDigit, searchResult, activeMatchIndex, columns, shape, showDigits, showGridLines, scheduleDraw]);

  // Changing the grid width keeps the same cell in the middle
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
      if (jump.index === null) return;
      const base = source?.base ?? start;
      const cell = Math.floor((jump.index - base) / (source?.perCell ?? perCell));
      if (cell >= 0 && cell < (source?.total ?? cellsWanted)) centerOn(cell);
    }
  }, [jump, centerOn, source, start, perCell, cellsWanted]);

  const handlePointerMove = (e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + 16}px`;
      tooltipRef.current.style.top = `${e.clientY + 16}px`;
    }
    if (isDragging || !source) return;
    const rect = containerRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const col = Math.floor(v.x + (e.clientX - rect.left) / v.px);
    const row = Math.floor(v.y + (e.clientY - rect.top) / v.px);
    const index = row * columns + col;
    if (col < 0 || col >= columns || row < 0 || index >= source.total) {
      setHovered((prev) => (prev === null ? prev : null));
      return;
    }
    setHovered((prev) => (prev && prev.index === index && prev.source === source ? prev : { index, source }));
  };

  // Scrubber: drag the thumb (or tap the track) to move through every row
  const scrubTo = (clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const frac = clamp((clientY - rect.top) / rect.height, 0, 1);
    const v = viewRef.current;
    const { h } = sizeRef.current;
    v.y = frac * rowsOf(columns, totalOf()) - h / (2 * v.px);
    clampView();
    scheduleDraw();
    reportSoon();
  };
  const handleScrubDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubTo(e.clientY);
  };
  const handleScrubMove = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) scrubTo(e.clientY);
  };

  const total = source?.total ?? 0;
  const rows = rowsOf(columns, total);

  // Tooltip content for the hovered cell
  const tip = hovered && hovered.source === source && source ? describeCell(hovered.index, source, store) : null;

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Grid Width:</span>
            <select
              value={columns}
              onChange={(e) => {
                columnsChangeRef.current = centerCell();
                (isDigits ? setDigitColumns : setOverviewColumns)(Number(e.target.value));
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
              value={PX_CHOICES.includes(Math.round(uiPx)) && Math.abs(uiPx - Math.round(uiPx)) < 0.05 ? Math.round(uiPx) : ''}
              onChange={(e) => e.target.value && setPxExactly(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="" disabled>
                {uiPx.toFixed(uiPx < 1 ? 2 : 1)}px
              </option>
              {PX_CHOICES.map((n) => (
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

          {isDigits && uiPx >= 12 && (
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

          {uiPx >= 4 && (
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
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[52px] text-center">
              {uiPx.toFixed(uiPx < 1 ? 2 : 1)}px
            </span>
            <button onClick={() => zoomBy(1.3)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          {isDigits ? (
            <button
              onClick={onOverview}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Zoom out past one pixel per cube: see every digit at once, many digits per cell"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
          ) : (
            <>
              <button
                onClick={fitView}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                title="Fit the whole grid on screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fit</span>
              </button>
              <button
                onClick={() => source && onZoomInto?.(source.base + centerCell() * source.perCell)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                title="Zoom in to individual cubes at the middle of the view (or double-click a cell)"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Zoom to cubes</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* touch-none: the browser must not scroll or zoom the page from touches here */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
        onDoubleClick={() => {
          if (!isDigits && tip) onZoomInto?.(tip.digitStart);
        }}
        className={`relative w-full h-[580px] bg-slate-950 overflow-hidden select-none touch-none overscroll-contain ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <canvas ref={canvasRef} className="block absolute inset-0" />

        {/* Scrubber over every row of the grid */}
        <div
          data-no-gesture
          onPointerDown={handleScrubDown}
          onPointerMove={handleScrubMove}
          className="absolute top-0 bottom-0 right-0 w-4 bg-slate-900/70 border-l border-slate-800 cursor-pointer touch-none"
          title="Drag to move through every row"
        >
          <div
            className="absolute left-0.5 right-0.5 rounded bg-purple-500/80"
            style={{ top: `${scroll.top * 100}%`, height: `max(6px, ${scroll.size * 100}%)` }}
          />
        </div>

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
                  Index: <span className="text-purple-300 font-bold">#{tip.digitStart.toLocaleString()}</span>{' '}
                  {tip.digitStart === 0 ? '(Integer 3)' : `(Decimal #${tip.digitStart.toLocaleString()})`}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: tip.color }} />
                  <span className="font-bold text-slate-100">{tip.count.toLocaleString()} digits</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <span className="text-purple-300 font-bold">#{tip.digitStart.toLocaleString()}</span> to{' '}
                  <span className="text-purple-300 font-bold">#{tip.digitEnd.toLocaleString()}</span>
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
            <div className="text-slate-500 text-[10px]">
              Row {Math.floor(hovered.index / columns).toLocaleString()}, column {hovered.index % columns}
            </div>
          </div>
        )}

        {isCounting && (
          <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
            <span>Counting digits...</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 max-w-[70%] bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Move className="w-3 h-3 shrink-0 text-purple-400" />
          <span>
            Drag to pan • Scroll or pinch to zoom • Right edge scrubs every {isDigits ? 'digit' : 'cell'}
          </span>
        </div>

        <div className="absolute bottom-3 right-7 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>
            {columns.toLocaleString()} × {rows.toLocaleString()} grid ({total.toLocaleString()} {isDigits ? 'cubes' : 'cells'}
            {isDigits ? '' : `, ${(total * (source?.perCell ?? 1)).toLocaleString()} digits`})
          </span>
        </div>
      </div>
    </div>
  );
}

// What the tooltip says about cell `index` of the current source
function describeCell(index, source, store) {
  if (source.kind === 'digits') {
    return { single: true, digit: Number(store.charAt(index)), digitStart: index };
  }
  const { agg, cellData, perCell } = source;
  const digitStart = agg.start + index * perCell;
  const digitEnd = Math.min(store.length, digitStart + perCell);
  const counts = Array.from(agg.counts.subarray(index * 10, index * 10 + 10));
  const count = digitEnd - digitStart;
  if (count === 1) {
    return { single: true, digit: cellData.dominant[index], digitStart };
  }
  return { single: false, digitStart, digitEnd: digitEnd - 1, count, counts, color: packedToCss(cellData.colors[index]) };
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
