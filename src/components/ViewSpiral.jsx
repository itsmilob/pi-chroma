import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, Disc } from 'lucide-react';

export default function ViewSpiral({
  piDigits,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [digitCount, setDigitCount] = useState(25000); // 5000, 10000, 25000, 50000, 100000
  const [dotSize, setDotSize] = useState(3.5);
  const [spacing, setSpacing] = useState(1.8);
  const [spiralType, setSpiralType] = useState('archimedes'); // 'archimedes' or 'fermat' (sunflower)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [hoveredDot, setHoveredDot] = useState(null);

  // Store coordinates of dots for hover detection
  const dotCoordsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 800;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const count = Math.min(digitCount, piDigits.length);

    const coords = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees for Fermat spiral

    // Set of match indices
    const matchIndicesMap = new Set();
    let activeMatchFirstIdx = -1;
    let activeMatchLength = 0;

    if (searchResult && searchResult.pattern && searchResult.matches.length > 0) {
      activeMatchLength = searchResult.pattern.length;
      searchResult.matches.forEach((m, idx) => {
        if (idx === activeMatchIndex) {
          activeMatchFirstIdx = m.index;
        }
        for (let s = 0; s < activeMatchLength; s++) {
          matchIndicesMap.add(m.index + s);
        }
      });
    }

    for (let i = 0; i < count; i++) {
      let x, y;
      if (spiralType === 'fermat') {
        const theta = i * goldenAngle;
        const r = spacing * 2.8 * Math.sqrt(i);
        x = centerX + r * Math.cos(theta);
        y = centerY + r * Math.sin(theta);
      } else {
        // Archimedean spiral: r = b * theta
        const theta = Math.sqrt(i) * spacing * 1.5;
        const r = theta * (spacing * 1.2);
        x = centerX + r * Math.cos(theta);
        y = centerY + r * Math.sin(theta);
      }

      // Check boundary
      if (x < -50 || x > width + 50 || y < -50 || y > height + 50) {
        // Still store coordinate for index calculation
        coords.push({ x, y, index: i });
        continue;
      }

      coords.push({ x, y, index: i });

      const d = piDigits.charCodeAt(i) - 48;
      if (d < 0 || d > 9) continue;

      const isDimmed = isolatedDigit !== null && isolatedDigit !== d;
      const isMatch = matchIndicesMap.has(i);
      const isActiveMatch = i >= activeMatchFirstIdx && i < activeMatchFirstIdx + activeMatchLength;

      ctx.beginPath();
      if (isActiveMatch) {
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(x, y, Math.max(dotSize * 2, 5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isMatch) {
        ctx.fillStyle = '#EC4899';
        ctx.arc(x, y, dotSize * 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isDimmed ? '#1e293b' : colors[d];
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    dotCoordsRef.current = coords;

    // Draw center indicator for 3.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [
    piDigits,
    colors,
    isolatedDigit,
    digitCount,
    dotSize,
    spacing,
    spiralType,
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
      const threshold = Math.max(8, dotSize * 2);
      let found = null;

      // Find nearest dot in radius
      for (let i = 0; i < coords.length; i++) {
        const dot = coords[i];
        const dx = dot.x - clientX;
        const dy = dot.y - clientY;
        if (dx * dx + dy * dy < threshold * threshold) {
          const digit = piDigits[dot.index];
          found = {
            index: dot.index,
            digit,
            color: colors[parseInt(digit, 10)],
            clientX: e.clientX,
            clientY: e.clientY,
          };
          break;
        }
      }
      setHoveredDot(found);
    },
    [isDragging, zoom, dotSize, piDigits, colors]
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
            <span className="text-slate-400 font-medium">Digits:</span>
            <select
              value={digitCount}
              onChange={(e) => setDigitCount(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              <option value={25000}>25,000</option>
              <option value={50000}>50,000</option>
              <option value={100000}>100,000</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Spacing:</span>
            <input
              type="range"
              min="0.8"
              max="3.5"
              step="0.1"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Dot Size:</span>
            <input
              type="range"
              min="1"
              max="8"
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
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
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
        className={`relative w-full h-[580px] bg-slate-950 overflow-hidden flex items-center justify-center cursor-${
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
            style={{ width: 800, height: 800 }}
            className="block rounded-full shadow-2xl"
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
              Spiral Position: <span className="text-purple-300 font-bold">#{hoveredDot.index}</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
          <Disc className="w-3 h-3 text-purple-400" />
          <span>Starting at center (3.) and coiling outward into infinity</span>
        </div>
      </div>
    </div>
  );
}
