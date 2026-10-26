import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Loader2, Navigation } from 'lucide-react';

// Moves the visible window across all loaded digits and loads digit files.
export default function WindowBar({
  totalDigits,
  windowStart,
  windowSize,
  step,
  onChangeStart,
  onLoadFile,
  load,
}) {
  const fileInputRef = useRef(null);
  const [gotoInput, setGotoInput] = useState('');

  const canMove = totalDigits > windowSize;
  const maxStart = Math.max(0, totalDigits - windowSize);
  const sliderMax = Math.floor(maxStart / step) * step;
  const windowEnd = windowStart + windowSize;

  const handleGoto = (e) => {
    e.preventDefault();
    const val = parseInt(gotoInput.replace(/[,\s]/g, ''), 10);
    if (!isNaN(val) && val >= 0 && val < totalDigits) {
      onChangeStart(Math.floor((val - windowSize / 2) / step) * step);
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
            Showing #<strong className="text-white">{windowStart.toLocaleString()}</strong> to #
            <strong className="text-white">{(windowEnd - 1).toLocaleString()}</strong>
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
            <span>{load.active ? `Loading ${Math.round(load.progress * 100)}%` : 'Load digits file'}</span>
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

      {load.error && <div className="mt-2 text-xs text-rose-400">Could not load file: {load.error}</div>}

      {!canMove && !load.active && !load.error && (
        <div className="mt-2 text-[11px] text-slate-500">
          Showing the bundled 1,000,000 digits. Load a larger file (packed .pi4, or text digits such as
          y-cruncher output) to explore up to 1,000,000,000 digits. See the README.
        </div>
      )}
    </div>
  );
}
