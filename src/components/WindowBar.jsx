import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Loader2, Navigation } from 'lucide-react';

const SCALE_OPTIONS = [
  { value: 1, label: '1:1', title: 'One cell per digit' },
  { value: 10, label: '1:10', title: '10 digits per cell' },
  { value: 100, label: '1:100', title: '100 digits per cell' },
  { value: 1000, label: '1:1,000', title: '1,000 digits per cell' },
  { value: 'fit', label: 'Fit all', title: 'Smallest scale that shows every loaded digit at once' },
];

// Moves the visible window across all loaded digits and loads digit files.
export default function WindowBar({
  totalDigits,
  windowStart,
  windowSize,
  step,
  onChangeStart,
  onLoadFile,
  load,
  explorerRange,
  onGoTo,
  perCell,
  scaleOption,
  onScaleChange,
  colorMode,
  onColorModeChange,
  enhance,
  onEnhanceChange,
}) {
  const fileInputRef = useRef(null);
  const [gotoInput, setGotoInput] = useState('');

  const explorer = explorerRange !== null && explorerRange !== undefined;
  const canMove = totalDigits > windowSize && !explorer;
  const maxStart = Math.max(0, totalDigits - windowSize);
  const sliderMax = Math.floor(maxStart / step) * step;
  const windowEnd = windowStart + windowSize;

  const handleGoto = (e) => {
    e.preventDefault();
    const val = parseInt(gotoInput.replace(/[,\s]/g, ''), 10);
    if (!isNaN(val) && val >= 0 && val < totalDigits) {
      onGoTo(val);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onLoadFile(file);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-lg mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-purple-400" />
          <span>
            {explorer ? 'In view' : 'Showing'} #
            <strong className="text-white">{(explorer ? explorerRange.first : windowStart).toLocaleString()}</strong> to #
            <strong className="text-white">{(explorer ? explorerRange.last : windowEnd - 1).toLocaleString()}</strong>
          </span>
          <span className="text-slate-500">of {totalDigits.toLocaleString()} digits loaded</span>
        </div>

        <div className="flex items-center gap-2">
          {canMove && (
            <>
              <button
                onClick={() => onChangeStart(windowStart - windowSize)}
                disabled={windowStart <= 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                title="Previous window"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeStart(windowStart + windowSize)}
                disabled={windowStart >= maxStart}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                title="Next window"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {(canMove || explorer) && (
            <>
              <form onSubmit={handleGoto} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={gotoInput}
                  onChange={(e) => setGotoInput(e.target.value)}
                  placeholder="Go to digit #"
                  className="w-36 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-purple-400"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  Go
                </button>
              </form>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pi4,.txt,text/plain"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={load.active}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700"
            title="Load a packed .pi4 file or a text file of pi digits (for example y-cruncher output)"
          >
            {load.active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5 text-sky-400" />}
            <span>{load.active ? `Loading ${Math.min(100, Math.round(load.progress * 100))}%` : 'Load digits file'}</span>
          </button>
        </div>
      </div>

      {canMove && (
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={step}
          value={Math.min(windowStart, sliderMax)}
          onChange={(e) => {
            // The slider steps in whole `step`s; its far end snaps to the true last window.
            const v = Number(e.target.value);
            onChangeStart(v >= sliderMax ? maxStart : v);
          }}
          className="w-full mt-3 accent-purple-500"
          aria-label="Window position"
        />
      )}

      {/* Zoom-out scale: how many digits one cell/pixel stands for */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Zoom out:</span>
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onScaleChange(opt.value)}
              className={`px-2.5 py-1 rounded-lg border font-mono transition-all ${
                scaleOption === opt.value
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60'
              }`}
              title={opt.title}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-slate-500 font-mono">
          1 cell = {perCell.toLocaleString()} digit{perCell === 1 ? '' : 's'}
        </span>
        {perCell > 1 && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Cell color:</span>
              <select
                value={colorMode}
                onChange={(e) => onColorModeChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="blend">Blend of its digits</option>
                <option value="dominant">Most common digit</option>
              </select>
            </div>
            {colorMode === 'blend' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={(e) => onEnhanceChange(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
                />
                <span title="Blended colors of many digits are all near the same gray; this exaggerates the differences">
                  Enhance contrast
                </span>
              </label>
            )}
          </>
        )}
      </div>

      {load.error && <div className="mt-2 text-xs text-rose-400">Could not load file: {load.error}</div>}

      {totalDigits <= 1_500_000 && !load.active && !load.error && (
        <div className="mt-2 text-[11px] text-slate-500">
          Showing the bundled 1,000,000 digits. Load a larger file (packed .pi4, or text digits such as
          y-cruncher output) to explore up to 1,000,000,000 digits. See the README.
        </div>
      )}
    </div>
  );
}
