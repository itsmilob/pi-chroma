import React, { useState } from 'react';
import { Download, X, Image as ImageIcon, Check } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, piDigits, colors, activePaletteName }) {
  const [resolution, setResolution] = useState(1000); // 500, 1000, 2000
  const [includeLegend, setIncludeLegend] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);

    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const size = resolution;
        const legendHeight = includeLegend ? 80 : 0;
        canvas.width = size;
        canvas.height = size + legendHeight;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render pixel grid
        const cols = resolution === 2000 ? 1000 : resolution === 1000 ? 500 : 250;
        const rows = cols;
        const pixelW = size / cols;
        const totalPoints = Math.min(piDigits.length, cols * rows);

        for (let i = 0; i < totalPoints; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const d = piDigits.charCodeAt(i) - 48;
          if (d >= 0 && d <= 9) {
            ctx.fillStyle = colors[d];
            ctx.fillRect(col * pixelW, row * pixelW, pixelW, pixelW);
          }
        }

        // Render Legend / Header footer
        if (includeLegend) {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, size, size, legendHeight);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 18px "JetBrains Mono", sans-serif';
          ctx.fillText(`π Chroma — ${totalPoints.toLocaleString()} Digits`, 24, size + 35);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px "JetBrains Mono", sans-serif';
          ctx.fillText(`Palette: ${activePaletteName || 'Custom'}`, 24, size + 58);

          // Draw swatches
          const swatchW = 20;
          const swatchGap = 8;
          const swatchesTotalW = 10 * swatchW + 9 * swatchGap;
          let startX = size - swatchesTotalW - 24;

          for (let d = 0; d < 10; d++) {
            ctx.fillStyle = colors[d];
            ctx.fillRect(startX + d * (swatchW + swatchGap), size + 24, swatchW, swatchW);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.toString(), startX + d * (swatchW + swatchGap) + swatchW / 2, size + 38);
          }
        }

        // Create download link
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `pi-chroma-${totalPoints}-digits.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setIsExporting(false);
        onClose();
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Export Pi Artwork</h3>
            <p className="text-xs text-slate-400">Download high-res PNG image of your color Pi matrix</p>
          </div>
        </div>

        <div className="space-y-4 mb-6 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Canvas Resolution:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Standard (500px)', val: 500 },
                { label: 'HD (1000px)', val: 1000 },
                { label: 'Ultra HD (2000px)', val: 2000 },
              ].map((res) => (
                <button
                  key={res.val}
                  onClick={() => setResolution(res.val)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    resolution === res.val
                      ? 'bg-purple-600/30 text-purple-200 border-purple-500 font-bold'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={includeLegend}
              onChange={(e) => setIncludeLegend(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
            />
            <span>Include Pi title and color palette legend at bottom</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating...' : 'Download PNG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
