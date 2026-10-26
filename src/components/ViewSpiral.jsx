import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Disc, Eye, Sparkles, Sliders, Loader2 } from 'lucide-react';
import { MAX_CELLS, aggregateCounts, cellCount, colorizeCells, packedToCss } from '../utils/aggregate';

export default function ViewSpiral({
  store,
  start,
  perCell,
  colorMode,
  enhance,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [digitCount, setDigitCount] = useState(25000); // points; 0 = every point of the window
  const [dotSize, setDotSize] = useState(3.5);
  const [spacing, setSpacing] = useState(1.8);
  const [spiralType, setSpiralType] = useState('archimedes'); // 'archimedes' or 'fermat'
  const [autoFit, setAutoFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [hoveredDot, setHoveredDot] = useState(null);

  // Store coordinates of dots for hover detection
  const dotCoordsRef = useRef([]);

  // Each point stands for `perCell` digits. Counting runs once per
  // start/scale/point count; recoloring (palette, isolation) reuses the counts.
  const available = Math.min(MAX_CELLS, cellCount(start, store.length, perCell));
  const pointsWanted = digitCount === 0 ? available : Math.min(digitCount, available);
  const [agg, setAgg] = useState(null); // { counts, cells, start, perCell }
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setIsCounting(true);
    aggregateCounts(store, start, perCell, pointsWanted, { signal: ctrl.signal }).then((counts) => {
      if (counts && !ctrl.signal.aborted) {
        setAgg({ counts, cells: pointsWanted, start, perCell });
        setIsCounting(false);
      }
    });
    return () => ctrl.abort();
  }, [store, start, perCell, pointsWanted]);

  const cellData = useMemo(() => {
    if (!agg) return null;
    return colorizeCells(agg.counts, agg.cells, colors, {
      mode: agg.perCell > 1 ? colorMode : 'blend',
      enhance: agg.perCell > 1 && enhance,
      isolated: isolatedDigit,
    });
  }, [agg, colors, colorMode, enhance, isolatedDigit]);

  // Calculate auto-scale factor so spiral NEVER cuts off
  const autoScaleFactor = useMemo(() => {
    const count = agg?.cells ?? 0;
    if (count <= 0) return 1;

    let maxR = 100;
    if (spiralType === 'fermat') {
      maxR = spacing * 2.8 * Math.sqrt(count);
    } else {
      const maxTheta = Math.sqrt(count) * spacing * 1.5;
      maxR = maxTheta * (spacing * 1.2);
    }
    // Canvas viewport radius is ~440px
    return maxR > 0 ? 440 / maxR : 1;
  }, [agg, spacing, spiralType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !agg || !cellData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 960;
    const height = 960;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const count = agg.cells;

    const coords = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees

    // Points that hold part of a match (a point may cover many digits)
    const matchIndicesMap = new Set();
    let activeFirstPoint = -1;
    let activeLastPoint = -2;

    if (searchResult && searchResult.pattern && searchResult.matches.length > 0) {
      const pLen = searchResult.pattern.length;
      searchResult.matches.forEach((m, idx) => {
        const first = Math.floor((m.index - agg.start) / agg.perCell);
        const last = Math.floor((m.index + pLen - 1 - agg.start) / agg.perCell);
        if (idx === activeMatchIndex) {
          activeFirstPoint = first;
          activeLastPoint = last;
        }
        for (let c = Math.max(0, first); c <= Math.min(count - 1, last); c++) matchIndicesMap.add(c);
      });
    }

    const scale = autoFit ? autoScaleFactor : 1;
    // Adjust dot size dynamically for high counts so points remain distinct
    const effectiveDotSize = Math.max(
      1,
      dotSize * (autoFit ? Math.min(1.2, Math.max(0.4, scale * 1.8)) : 1)
    );

    const cssCache = new Map();
    for (let i = 0; i < count; i++) {
      let r, theta;
      if (spiralType === 'fermat') {
        theta = i * goldenAngle;
        r = spacing * 2.8 * Math.sqrt(i) * scale;
      } else {
        // Archimedean spiral: r = b * theta
        theta = Math.sqrt(i) * spacing * 1.5;
        r = theta * (spacing * 1.2) * scale;
      }

      const x = centerX + r * Math.cos(theta);
      const y = centerY + r * Math.sin(theta);

      coords.push({ x, y, index: i });

      const isMatch = matchIndicesMap.has(i);
      const isActiveMatch = i >= activeFirstPoint && i <= activeLastPoint;

      ctx.beginPath();
      if (isActiveMatch) {
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(x, y, Math.max(effectiveDotSize * 2.5, 6), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isMatch) {
        ctx.fillStyle = '#EC4899';
        ctx.arc(x, y, effectiveDotSize * 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const packed = cellData.colors[i];
        let css = cssCache.get(packed);
        if (css === undefined) {
          css = packedToCss(packed);
          cssCache.set(packed, css);
        }
        ctx.fillStyle = css;
        ctx.arc(x, y, effectiveDotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    dotCoordsRef.current = coords;

    // Center circular badge for integer 3
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#C084FC';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3.', centerX, centerY);
    ctx.restore();
  }, [
    agg,
    cellData,
    dotSize,
    spacing,
    spiralType,
    autoFit,
    autoScaleFactor,
    searchResult,
    activeMatchIndex,
  ]);

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
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = (e.clientX - rect.left) / zoom;
      const clientY = (e.clientY - rect.top) / zoom;

      const coords = dotCoordsRef.current;
      const threshold = Math.max(9, dotSize * 2.5);
      let found = null;

      for (let i = 0; i < coords.length; i++) {
        const dot = coords[i];
        const dx = dot.x - clientX;
        const dy = dot.y - clientY;
        if (dx * dx + dy * dy < threshold * threshold) {
          const digitStart = agg.start + dot.index * agg.perCell;
          found = {
            index: dot.index,
            digitStart,
            digitEnd: Math.min(store.length, digitStart + agg.perCell),
            digit: cellData.dominant[dot.index],
            color: packedToCss(cellData.colors[dot.index]),
            clientX: e.clientX,
            clientY: e.clientY,
          };
          break;
        }
      }
      setHoveredDot(found);
    },
    [isDragging, zoom, dotSize, agg, cellData, store]
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
    setZoom((z) => Math.min(8, Math.max(0.15, z * zoomFactor)));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAutoFit(true);
  };

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      {/* Spiral Toolbar */}
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
            <span className="text-slate-400 font-medium">Points:</span>
            <select
              value={digitCount}
              onChange={(e) => setDigitCount(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500 font-mono"
            >
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              <option value={25000}>25,000</option>
              <option value={50000}>50,000</option>
              <option value={100000}>100,000</option>
              <option value={200000}>200,000</option>
              <option value={500000}>500,000</option>
              <option value={0}>Whole window (up to 1M)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={autoFit}
              onChange={(e) => setAutoFit(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
            />
            <span className="font-medium text-purple-300">Auto-Fit View</span>
          </label>

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

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.15, z * 0.85))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(8, z * 1.15))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Spiral Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        className={`relative w-full h-[620px] bg-slate-950 overflow-hidden flex items-center justify-center cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
          }}
          className="inline-block"
        >
          <canvas
            ref={canvasRef}
            style={{ width: 960, height: 960 }}
            className="block shadow-2xl"
          />
        </div>

        {/* Tooltip on hover */}
        {hoveredDot && !isDragging && (
          <div
            className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl text-xs font-mono"
            style={{
              left: `${hoveredDot.clientX + 16}px`,
              top: `${hoveredDot.clientY + 16}px`,
            }}
          >
            {hoveredDot.digitEnd - hoveredDot.digitStart === 1 ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                    style={{ backgroundColor: hoveredDot.color }}
                  >
                    {hoveredDot.digit}
                  </span>
                  <span className="font-bold text-slate-100">Digit: {hoveredDot.digit}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Spiral Position:{' '}
                  <span className="text-purple-300 font-bold">#{hoveredDot.digitStart.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: hoveredDot.color }} />
                  <span className="font-bold text-slate-100">
                    {(hoveredDot.digitEnd - hoveredDot.digitStart).toLocaleString()} digits
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <span className="text-purple-300 font-bold">#{hoveredDot.digitStart.toLocaleString()}</span> to{' '}
                  <span className="text-purple-300 font-bold">#{(hoveredDot.digitEnd - 1).toLocaleString()}</span>
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

        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Disc className="w-3 h-3 text-purple-400" />
          <span>Complete uninterrupted coil with auto-fit geometry • Scroll to zoom • Drag to pan</span>
        </div>

        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>
            {(agg?.cells ?? 0).toLocaleString()} points rendered
            {agg && agg.perCell > 1 ? ` (${agg.perCell.toLocaleString()} digits each)` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
