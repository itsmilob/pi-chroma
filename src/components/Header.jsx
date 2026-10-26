import React from 'react';
import {
  LayoutGrid,
  Binary,
  Disc,
  BarChart3,
  Volume2,
  VolumeX,
  Download,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function Header({
  activeMode,
  setActiveMode,
  totalDigits,
  isLoadingFullPi,
  onOpenExport,
  isAudioVisible,
  setIsAudioVisible,
  onOpenAbout,
  isBillionMode,
  onToggleBillionMode,
}) {
  const modes = [
    { id: 'mosaic', label: 'Color Mosaic', icon: LayoutGrid, desc: 'Visual 2D pixel canvas' },
    { id: 'stream', label: 'Digits Stream', icon: Binary, desc: 'Readable numbers & tiles' },
    { id: 'spiral', label: 'Circle Spiral', icon: Disc, desc: 'Archimedean mandala' },
    { id: 'stats', label: 'Distribution', icon: BarChart3, desc: 'Frequency & randomness' },
  ];

  return (
    <header className="mb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 p-[2px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <span className="font-mono text-2xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-purple-400 via-pink-400 to-amber-300">
                π
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Pi <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400">Chroma</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                1M Digits
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive pattern discovery & color spectrum visualization of the circle constant
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Digits Loaded Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <div
              className={`w-2 h-2 rounded-full ${
                isLoadingFullPi ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="font-mono font-medium">
              {totalDigits.toLocaleString()} Digits
            </span>
            {isLoadingFullPi && (
              <span className="text-[10px] text-amber-400">(Loading 1M...)</span>
            )}
          </div>

          {/* 1 Billion Digits Telescope Toggle */}
          <button
            onClick={onToggleBillionMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isBillionMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400 shadow-md shadow-purple-500/30 ring-1 ring-purple-300'
                : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-purple-900/60 hover:border-purple-700'
            }`}
            title="Explore up to 1,000,000,000 digits of Pi"
          >
            <span>🔭 1 Billion Mode</span>
          </button>

          {/* Toggle Audio */}
          <button
            onClick={() => setIsAudioVisible(!isAudioVisible)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isAudioVisible
                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-sm shadow-purple-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Toggle Audio Sonifier"
          >
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Sound</span>
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors"
            title="Export High-Res Image"
          >
            <Download className="w-3.5 h-3.5 text-pink-400" />
            <span>Export</span>
          </button>

          {/* About / Info */}
          <button
            onClick={onOpenAbout}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="About Pi Chroma"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Nav */}
      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25 ring-1 ring-purple-400/30'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
