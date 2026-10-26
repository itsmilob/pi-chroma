import React, { useState } from 'react';
import { Palette, Shuffle, RotateCcw, Eye, Sparkles, Sliders } from 'lucide-react';
import { COLOR_PALETTES } from '../constants/palettes';

export default function PaletteBar({
  colors,
  onColorChange,
  onSelectPalette,
  activePaletteId,
  isolatedDigit,
  onToggleIsolateDigit,
  viewStyle,
  onViewStyleChange, // 'fill', 'outline', 'glow'
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Generate random harmonious palette
  const handleRandomize = () => {
    const randomColors = [];
    const baseHue = Math.floor(Math.random() * 360);
    for (let i = 0; i < 10; i++) {
      // Spread across color wheel with pleasant saturation and lightness
      const hue = (baseHue + i * 36) % 360;
      randomColors.push(hslToHex(hue, 75, 55));
    }
    onSelectPalette('custom', randomColors);
  };

  // Reset to default spectral
  const handleReset = () => {
    const spectral = COLOR_PALETTES.find((p) => p.id === 'spectral');
    if (spectral) {
      onSelectPalette(spectral.id, spectral.colors);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl mb-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Digit Color Assignment (0 – 9)
            </h3>
            <p className="text-xs text-slate-400">
              Click any digit to customize its hue, or choose a curated palette
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets: {COLOR_PALETTES.find((p) => p.id === activePaletteId)?.name || 'Custom'}</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
                  Color Themes
                </div>
                {COLOR_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    onClick={() => {
                      onSelectPalette(pal.id, pal.colors);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs flex flex-col gap-1 transition-colors ${
                      activePaletteId === pal.id
                        ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{pal.name}</span>
                    </div>
                    {/* Color Swatch Strip */}
                    <div className="flex h-2.5 rounded-full overflow-hidden w-full border border-slate-700/50">
                      {pal.colors.map((c, idx) => (
                        <div key={idx} className="flex-1 h-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleRandomize}
            title="Randomize harmonious palette"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shuffle</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset to Spectral Rainbow"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Digit Swatches 0 to 9 */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {colors.map((color, digit) => {
          const isIsolated = isolatedDigit === digit;
          const isDimmed = isolatedDigit !== null && isolatedDigit !== digit;

          return (
            <div
              key={digit}
              className={`relative flex flex-col items-center p-2 rounded-xl border transition-all ${
                isIsolated
                  ? 'border-purple-400 bg-purple-500/10 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/50'
                  : isDimmed
                  ? 'border-slate-800/60 bg-slate-900/40 opacity-40'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              {/* Digit Title & Solo Isolate Button */}
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">
                  {digit}
                </span>
                <button
                  onClick={() => onToggleIsolateDigit(digit)}
                  title={isIsolated ? "Show all digits" : `Isolate digit ${digit} only`}
                  className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                    isIsolated ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                </button>
              </div>

              {/* Color Circular Swatch with embedded native color input */}
              <div className="relative w-8 h-8 rounded-full shadow-inner border border-white/20 transition-transform transform hover:scale-110 overflow-hidden cursor-pointer">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColorChange(digit, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title={`Change color for digit ${digit}`}
                />
                <div
                  className="w-full h-full rounded-full transition-colors pointer-events-none"
                  style={{ backgroundColor: color }}
                />
              </div>

              {/* Hex Code */}
              <span className="font-mono text-[10px] text-slate-400 mt-1 uppercase select-all">
                {color}
              </span>
            </div>
          );
        })}
      </div>

      {isolatedDigit !== null && (
        <div className="mt-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-xs text-purple-300">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colors[isolatedDigit] }}
            />
            Filtering view: Highlighting only digit <strong>{isolatedDigit}</strong> (all other digits dimmed)
          </span>
          <button
            onClick={() => onToggleIsolateDigit(null)}
            className="underline hover:text-purple-100 font-medium"
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  );
}

// Helper: HSL to Hex
function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
