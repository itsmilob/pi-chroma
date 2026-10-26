import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, Loader2 } from 'lucide-react';
import { aggregateCounts, cellCount, colorizeCells, packedToCss } from '../utils/aggregate';

// A 1M-cell grid at the default 200 columns is ~30,000px tall, so the zoom
// floor has to be low enough to fit all of it on screen.
const MIN_ZOOM = 0.01;

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
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Canvas settings
  const [columns, setColumns] = useState(200); // 50, 100, 200, 400, 500, 1000
  const [pixelSize, setPixelSize] = useState(6); // 1 to 24 px
  const [shape, setShape] = useState('square'); // 'square', 'rounded', 'circle'
  const [showDigitsOnCells, setShowDigitsOnCells] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Zoom and Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Digit counts per cell for the current window and scale. Counting is the
  // slow part (a billion digits take ~2s), so it runs once per window/scale and
  // everything else (palette, isolation, color mode) recolors from the counts.
  const cellsWanted = cellCount(start, start + windowSize, perCell);
  const [agg, setAgg] = useState(null); // { counts, cells, start, perCell }
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setIsCounting(true);
    aggregateCounts(store, start, perCell, cellsWanted, { signal: ctrl.signal }).then((counts) => {
      if (counts && !ctrl.signal.aborted) {
        setAgg({ counts, cells: cellsWanted, start, perCell });
        setIsCounting(false);
      }
    });
    return () => ctrl.abort();
  }, [store, start, perCell, cellsWanted]);

  const aggPerCell = agg?.perCell ?? perCell;
  const cellData = useMemo(() => {
    if (!agg) return null;
    return colorizeCells(agg.counts, agg.cells, colors, {
      mode: agg.perCell > 1 ? colorMode : 'blend',
      enhance: agg.perCell > 1 && enhance,
      isolated: isolatedDigit,
    });
  }, [agg, colors, colorMode, enhance, isolatedDigit]);

  const cells = agg?.cells ?? 0;
  const rows = Math.ceil(cells / columns);
  const canvasWidth = columns * pixelSize;
  const canvasHeight = rows * pixelSize;

  // Scroll to a cell when asked to jump (search results, "Go to digit")
  useEffect(() => {
    if (!jump || jump.index === null || !containerRef.current) return;
    const cell = Math.floor((jump.index - start) / perCell);
    if (cell < 0 || cell >= cellsWanted) return;
    const targetX = (cell % columns) * pixelSize;
    const targetY = Math.floor(cell / columns) * pixelSize;
    const containerRect = containerRef.current.getBoundingClientRect();
    setPan({
      x: -(targetX * zoom - containerRect.width / 2 + (pixelSize * zoom) / 2),
      y: -(targetY * zoom - containerRect.height / 2 + (pixelSize * zoom) / 2),
    });
    // Only an actual jump should move the view, not zoom or window changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !agg || !cellData) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const drawText = showDigitsOnCells && pixelSize >= 12 && agg.perCell === 1;

    if (shape === 'square' && !drawText) {
      // Fast path: one pixel per cell in an ImageData, scaled up without
      // smoothing. A million fillRect calls would take seconds.
      const grid = document.createElement('canvas');
      grid.width = columns;
      grid.height = Math.max(1, rows);
      const gctx = grid.getContext('2d');
      const image = gctx.createImageData(grid.width, grid.height);
      new Uint32Array(image.data.buffer).set(cellData.colors);
      gctx.putImageData(image, 0, 0);
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(grid, 0, 0, canvasWidth, grid.height * pixelSize);
    } else {
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const radius = shape === 'circle' ? pixelSize / 2 : shape === 'rounded' ? Math.max(1, pixelSize * 0.25) : 0;
      if (drawText) {
        ctx.font = `bold ${Math.floor(pixelSize * 0.55)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }

      const cssCache = new Map();
      for (let i = 0; i < cells; i++) {
        const x = (i % columns) * pixelSize;
        const y = Math.floor(i / columns) * pixelSize;
        const packed = cellData.colors[i];
        let css = cssCache.get(packed);
        if (css === undefined) {
          css = packedToCss(packed);
          cssCache.set(packed, css);
        }
        ctx.fillStyle = css;

        if (shape === 'square') {
          ctx.fillRect(x, y, pixelSize, pixelSize);
        } else if (shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x + radius, y + radius, radius * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawRoundedRect(ctx, x + 0.5, y + 0.5, pixelSize - 1, pixelSize - 1, radius);
          ctx.fill();
        }

        if (drawText) {
          const d = cellData.dominant[i];
          if (isolatedDigit === null || isolatedDigit === d) {
            ctx.fillStyle = getContrastColor(colors[d]);
            ctx.fillText(d.toString(), x + pixelSize / 2, y + pixelSize / 2);
          }
        }
      }
    }

    if (showGridLines && pixelSize >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let c = 0; c <= columns; c++) {
        ctx.moveTo(c * pixelSize, 0);
        ctx.lineTo(c * pixelSize, canvasHeight);
      }
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(0, r * pixelSize);
        ctx.lineTo(canvasWidth, r * pixelSize);
      }
      ctx.stroke();
    }

    // Highlight search matches. Zoomed out, a match is smaller than a cell, so
    // it gets a ring around its cell to stay visible.
    if (searchResult && searchResult.pattern && searchResult.matches.length > 0) {
      const pLen = searchResult.pattern.length;
      const zoomedOut = agg.perCell > 1;
      ctx.lineWidth = Math.max(2, pixelSize * 0.3);

      searchResult.matches.forEach((match, idx) => {
        const isActive = idx === activeMatchIndex;
        const first = Math.floor((match.index - agg.start) / agg.perCell);
        const last = Math.floor((match.index + pLen - 1 - agg.start) / agg.perCell);
        if (last < 0 || first >= cells) return;

        ctx.strokeStyle = isActive ? '#FFFFFF' : '#EC4899';
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : 'rgba(236, 72, 153, 0.25)';

        for (let c = Math.max(0, first); c <= Math.min(cells - 1, last); c++) {
          const x = (c % columns) * pixelSize;
          const y = Math.floor(c / columns) * pixelSize;
          ctx.fillRect(x, y, pixelSize, pixelSize);
          ctx.strokeRect(x, y, pixelSize, pixelSize);
        }

        if (zoomedOut && first >= 0 && first < cells) {
          const cx = (first % columns) * pixelSize + pixelSize / 2;
          const cy = Math.floor(first / columns) * pixelSize + pixelSize / 2;
          ctx.save();
          ctx.lineWidth = isActive ? 4 : 2;
          ctx.strokeStyle = isActive ? '#FDE047' : '#EC4899';
          ctx.beginPath();
          ctx.arc(cx, cy, isActive ? 18 : 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (isActive && first >= 0 && first < cells) {
          // Spotlight the first digit of the active match
          const firstCol = first % columns;
          ctx.save();
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = Math.max(3, pixelSize * 0.4);
          ctx.strokeRect(
            firstCol * pixelSize - 2,
            Math.floor(first / columns) * pixelSize - 2,
            Math.min(pLen, columns - firstCol) * pixelSize + 4,
            pixelSize + 4
          );
          ctx.restore();
        }
      });
    }
  }, [
    agg,
    cellData,
    colors,
    columns,
    rows,
    cells,
    pixelSize,
    shape,
    showDigitsOnCells,
    showGridLines,
    isolatedDigit,
    searchResult,
    activeMatchIndex,
    canvasWidth,
    canvasHeight,
  ]);

  // Mouse interaction: Hover inspection & tooltip
  const handleMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        setPan((prev) => ({
          x: prev.x + (e.clientX - dragStartRef.current.x),
          y: prev.y + (e.clientY - dragStartRef.current.y),
        }));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas || !agg || !cellData) return;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / zoom / pixelSize);
      const row = Math.floor((e.clientY - rect.top) / zoom / pixelSize);

      if (col >= 0 && col < columns && row >= 0 && row < rows) {
        const index = row * columns + col;
        if (index < agg.cells) {
          const digitStart = agg.start + index * agg.perCell;
          const digitEnd = Math.min(store.length, digitStart + agg.perCell);
          setHoveredCell({
            index,
            digitStart,
            digitEnd,
            digit: cellData.dominant[index],
            counts: Array.from(agg.counts.subarray(index * 10, index * 10 + 10)),
            color: packedToCss(cellData.colors[index]),
            col,
            row,
            clientX: e.clientX,
            clientY: e.clientY,
          });
          return;
        }
      }
      setHoveredCell(null);
    },
    [isDragging, zoom, pixelSize, columns, rows, agg, cellData, store]
  );

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.min(5, Math.max(MIN_ZOOM, z * zoomFactor)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      {/* Top Toolbar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Dimensions & Pixels */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Grid Width:</span>
            <select
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={50}>50 cols</option>
              <option value={100}>100 cols</option>
              <option value={200}>200 cols</option>
              <option value={314}>314 cols (π!)</option>
              <option value={500}>500 cols</option>
              <option value={1000}>1,000 cols (1M Matrix)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Pixel Size:</span>
            <select
              value={pixelSize}
              onChange={(e) => setPixelSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={1}>1px (Dense)</option>
              <option value={2}>2px</option>
              <option value={4}>4px</option>
              <option value={6}>6px (Standard)</option>
              <option value={8}>8px</option>
              <option value={12}>12px</option>
              <option value={16}>16px (Readable)</option>
              <option value={20}>20px</option>
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

          {pixelSize >= 12 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showDigitsOnCells}
                onChange={(e) => setShowDigitsOnCells(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
              />
              <span>Show Digit Labels</span>
            </label>
          )}

          {pixelSize >= 4 && (
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

        {/* Pan & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.85))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[42px] text-center">
              {zoom < 0.1 ? (zoom * 100).toFixed(1) : Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(5, z * 1.15))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Reset Pan & Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        className={`relative w-full h-[580px] bg-slate-950 overflow-hidden select-none cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
          }}
          className="inline-block"
        >
          <canvas ref={canvasRef} className="block shadow-2xl" />
        </div>

        {/* Dynamic Tooltip on hover */}
        {hoveredCell && !isDragging && (
          <div
            className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl text-xs font-mono transition-transform"
            style={{
              left: `${hoveredCell.clientX + 16}px`,
              top: `${hoveredCell.clientY + 16}px`,
            }}
          >
            {hoveredCell.digitEnd - hoveredCell.digitStart === 1 ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                    style={{ backgroundColor: hoveredCell.color }}
                  >
                    {hoveredCell.digit}
                  </span>
                  <span className="font-bold text-slate-100">Digit: {hoveredCell.digit}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Index:{' '}
                  <span className="text-purple-300 font-bold">#{hoveredCell.digitStart.toLocaleString()}</span>{' '}
                  {hoveredCell.digitStart === 0
                    ? '(Integer 3)'
                    : `(Decimal #${hoveredCell.digitStart.toLocaleString()})`}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: hoveredCell.color }} />
                  <span className="font-bold text-slate-100">
                    {(hoveredCell.digitEnd - hoveredCell.digitStart).toLocaleString()} digits
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <span className="text-purple-300 font-bold">#{hoveredCell.digitStart.toLocaleString()}</span> to{' '}
                  <span className="text-purple-300 font-bold">#{(hoveredCell.digitEnd - 1).toLocaleString()}</span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1 grid grid-cols-5 gap-x-2">
                  {hoveredCell.counts.map((count, d) => (
                    <span key={d}>
                      <span style={{ color: colors[d] }}>{d}</span>{' '}
                      {((count / (hoveredCell.digitEnd - hoveredCell.digitStart)) * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="text-slate-500 text-[10px]">
              Grid: ({hoveredCell.col}, {hoveredCell.row})
            </div>
          </div>
        )}

        {isCounting && (
          <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
            <span>Counting digits...</span>
          </div>
        )}

        {/* Overlay instructions / indicator */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Move className="w-3 h-3 text-purple-400" />
          <span>Click & Drag to pan • Scroll to zoom • Hover pixel for details</span>
        </div>

        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>
            Canvas: {canvasWidth}×{canvasHeight}px ({cells.toLocaleString()} cells, {(cells * aggPerCell).toLocaleString()} digits)
          </span>
        </div>
      </div>
    </div>
  );
}

// Rounded rectangle helper
function drawRoundedRect(ctx, x, y, width, height, radius) {
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

// Check contrast for text over color
function getContrastColor(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  // YIQ formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}
