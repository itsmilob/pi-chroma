import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, Eye, Info, Sparkles } from 'lucide-react';

export default function ViewMosaic({
  piDigits,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
  onSelectDigitAt,
  jumpTargetIndex,
  offset = 0,
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

  // Pre-parse hex colors to 32-bit uint integers for high-speed direct canvas buffer drawing
  const parsedUint32Colors = useMemo(() => {
    return colors.map((hex) => {
      // #RRGGBB -> little endian 0xAABBGGRR
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (255 << 24) | (b << 16) | (g << 8) | r;
    });
  }, [colors]);

  const dimmedUint32Colors = useMemo(() => {
    return colors.map((hex, digit) => {
      if (isolatedDigit !== null && isolatedDigit !== digit) {
        // Dimmed version (dark desaturated)
        return (255 << 24) | (30 << 16) | (30 << 8) | 30;
      }
      return parsedUint32Colors[digit];
    });
  }, [colors, isolatedDigit, parsedUint32Colors]);

  const totalDigits = piDigits.length;
  const rows = Math.ceil(totalDigits / columns);
  const canvasWidth = columns * pixelSize;
  const canvasHeight = rows * pixelSize;

  // React to jumpTargetIndex
  useEffect(() => {
    if (jumpTargetIndex !== null && jumpTargetIndex >= 0 && jumpTargetIndex < totalDigits) {
      const col = jumpTargetIndex % columns;
      const row = Math.floor(jumpTargetIndex / columns);
      const targetX = col * pixelSize;
      const targetY = row * pixelSize;

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setPan({
          x: -(targetX * zoom - containerRect.width / 2 + (pixelSize * zoom) / 2),
          y: -(targetY * zoom - containerRect.height / 2 + (pixelSize * zoom) / 2),
        });
      }
    }
  }, [jumpTargetIndex, columns, pixelSize, zoom, totalDigits]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fast path: if 1px square pixels, use direct ImageData Uint32Array buffer (sub-millisecond for 1M pixels!)
    if (pixelSize === 1 && shape === 'square') {
      const imgData = ctx.createImageData(canvasWidth, canvasHeight);
      const buf = new Uint32Array(imgData.data.buffer);
      const colorsMap = isolatedDigit !== null ? dimmedUint32Colors : parsedUint32Colors;

      for (let i = 0; i < totalDigits; i++) {
        const d = piDigits.charCodeAt(i) - 48; // '0' is 48
        if (d >= 0 && d <= 9) {
          buf[i] = colorsMap[d];
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Standard path with shapes / cell sizing
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const radius = shape === 'circle' ? pixelSize / 2 : shape === 'rounded' ? Math.max(1, pixelSize * 0.25) : 0;
      const drawText = showDigitsOnCells && pixelSize >= 12;

      if (drawText) {
        ctx.font = `bold ${Math.floor(pixelSize * 0.55)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }

      for (let i = 0; i < totalDigits; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * pixelSize;
        const y = row * pixelSize;

        const d = piDigits.charCodeAt(i) - 48;
        if (d < 0 || d > 9) continue;

        const isDimmed = isolatedDigit !== null && isolatedDigit !== d;
        const color = isDimmed ? '#1e293b' : colors[d];

        ctx.fillStyle = color;

        if (shape === 'square') {
          ctx.fillRect(x, y, pixelSize, pixelSize);
        } else if (shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x + radius, y + radius, radius * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 'rounded') {
          drawRoundedRect(ctx, x + 0.5, y + 0.5, pixelSize - 1, pixelSize - 1, radius);
          ctx.fill();
        }

        if (drawText && !isDimmed) {
          ctx.fillStyle = getContrastColor(colors[d]);
          ctx.fillText(d.toString(), x + pixelSize / 2, y + pixelSize / 2);
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
    }

    // Highlight search pattern matches directly on canvas!
    if (searchResult && searchResult.pattern && searchResult.matches.length > 0) {
      const pLen = searchResult.pattern.length;

      // Draw bounding box / outlines for all matches
      ctx.lineWidth = Math.max(2, pixelSize * 0.3);

      searchResult.matches.forEach((match, idx) => {
        const isActive = idx === activeMatchIndex;
        ctx.strokeStyle = isActive ? '#FFFFFF' : '#EC4899';
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : 'rgba(236, 72, 153, 0.25)';

        for (let step = 0; step < pLen; step++) {
          const charIdx = match.index + step;
          if (charIdx >= totalDigits) break;

          const col = charIdx % columns;
          const row = Math.floor(charIdx / columns);
          const x = col * pixelSize;
          const y = row * pixelSize;

          ctx.fillRect(x, y, pixelSize, pixelSize);
          ctx.strokeRect(x, y, pixelSize, pixelSize);
        }

        // If it's the active match, draw a prominent spotlight target
        if (isActive) {
          const firstCol = match.index % columns;
          const firstRow = Math.floor(match.index / columns);
          const fx = firstCol * pixelSize;
          const fy = firstRow * pixelSize;

          ctx.save();
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = Math.max(3, pixelSize * 0.4);
          ctx.strokeRect(
            fx - 2,
            fy - 2,
            Math.min(pLen, columns - firstCol) * pixelSize + 4,
            pixelSize + 4
          );
          ctx.restore();
        }
      });
    }
  }, [
    piDigits,
    colors,
    columns,
    pixelSize,
    shape,
    showDigitsOnCells,
    showGridLines,
    isolatedDigit,
    searchResult,
    activeMatchIndex,
    dimmedUint32Colors,
    parsedUint32Colors,
    canvasWidth,
    canvasHeight,
    totalDigits,
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
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = (e.clientX - rect.left) / zoom;
      const clientY = (e.clientY - rect.top) / zoom;

      const col = Math.floor(clientX / pixelSize);
      const row = Math.floor(clientY / pixelSize);

      if (col >= 0 && col < columns && row >= 0 && row < rows) {
        const index = row * columns + col;
        if (index < totalDigits) {
          const digit = piDigits[index];
          setHoveredCell({
            index,
            digit,
            color: colors[parseInt(digit, 10)],
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
    [isDragging, zoom, pixelSize, columns, rows, totalDigits, piDigits, colors]
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
    setZoom((z) => Math.min(5, Math.max(0.2, z * zoomFactor)));
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
              onClick={() => setZoom((z) => Math.max(0.2, z * 0.85))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-400 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
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
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                style={{ backgroundColor: hoveredCell.color }}
              >
                {hoveredCell.digit}
              </span>
              <span className="font-bold text-slate-100">
                Digit: {hoveredCell.digit}
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Index:{' '}
              <span className="text-purple-300 font-bold">
                #{(hoveredCell.index + offset).toLocaleString()}
              </span>{' '}
              {hoveredCell.index + offset === 0
                ? '(Integer 3)'
                : `(Decimal #${(hoveredCell.index + offset).toLocaleString()})`}
            </div>
            <div className="text-slate-500 text-[10px]">
              Grid: ({hoveredCell.col}, {hoveredCell.row})
            </div>
          </div>
        )}

        {/* Overlay instructions / indicator */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Move className="w-3 h-3 text-purple-400" />
          <span>Click & Drag to pan • Scroll to zoom • Hover pixel for details</span>
        </div>

        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 font-mono pointer-events-none">
          <span>
            Canvas: {canvasWidth}×{canvasHeight}px ({totalDigits.toLocaleString()} digits)
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
