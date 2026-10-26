import React, { useState } from 'react';
import { Telescope, ArrowRight, RotateCcw, Loader2, Sparkles, Navigation } from 'lucide-react';

export default function BillionNavigator({
  isBillionMode,
  onToggleBillionMode,
  currentBillionIndex,
  onJumpToBillionIndex,
  isLoadingWindow,
  windowLength,
}) {
  const [customInput, setCustomInput] = useState('999999000');

  const milestones = [
    { label: '1M', value: 1000000 },
    { label: '10M', value: 10000000 },
    { label: '100M', value: 100000000 },
    { label: '500M', value: 500000000 },
    { label: '999.9M', value: 999999000 },
    { label: '1 Billion', value: 1000000000 - 5000 },
  ];

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const clean = customInput.replace(/,/g, '').trim();
    const val = parseInt(clean, 10);
    if (!isNaN(val) && val >= 0 && val <= 1000000000) {
      onJumpToBillionIndex(val);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 rounded-2xl p-4 shadow-xl mb-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Telescope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide">
                1 Billion Digits ($10^9$) Deep Space Telescope
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-200 border border-purple-400/30">
                1,000,000,000 Limit
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Stream, explore, and visualize live decimal windows anywhere up to the 1 Billionth digit
            </p>
          </div>
        </div>

        <button
          onClick={onToggleBillionMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Exit Telescope (Back to 1M)</span>
        </button>
      </div>

      {/* Navigator Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-purple-900/40">
        {/* Quick Milestones */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Milestones:
          </span>
          {milestones.map((m) => (
            <button
              key={m.label}
              onClick={() => {
                setCustomInput(m.value.toString());
                onJumpToBillionIndex(m.value);
              }}
              disabled={isLoadingWindow}
              className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
                Math.abs(currentBillionIndex - m.value) < 1000
                  ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-md'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Position:</span>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="0 – 1,000,000,000"
            className="w-36 bg-slate-950 border border-purple-500/40 text-purple-200 text-xs rounded-xl px-2.5 py-1.5 font-mono outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            disabled={isLoadingWindow}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors"
          >
            {isLoadingWindow ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            <span>Stream</span>
          </button>
        </form>
      </div>

      {/* Current Window Status */}
      <div className="mt-2 text-xs font-mono text-purple-300/80 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-purple-400" />
          Live Telescope Window: #
          <strong className="text-white">
            {currentBillionIndex.toLocaleString()}
          </strong>{' '}
          to #
          <strong className="text-white">
            {(currentBillionIndex + windowLength).toLocaleString()}
          </strong>{' '}
          ({windowLength.toLocaleString()} digits rendered in current mode)
        </span>
        <span className="text-[11px] text-slate-500">
          Source: Google Cloud Pi API (100T verified)
        </span>
      </div>
    </div>
  );
}
