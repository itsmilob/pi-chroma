import React from 'react';
import { X, Sparkles, BookOpen, HelpCircle, ExternalLink } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">About Pi Chroma</h3>
            <p className="text-xs text-slate-400">The circle constant visualized through mathematics and color</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              What is Pi ($\pi$)?
            </h4>
            <p className="text-slate-400">
              $\pi$ is the ratio of a circle's circumference to its diameter ($\approx 3.14159265...$). It is an irrational and transcendental number, meaning its decimal representation never ends and never enters a repeating loop.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-1">Seeing Numbers as Colors</h4>
            <p className="text-slate-400">
              When numbers 0 through 9 are each assigned a distinct hue, infinite number sequences become visual tapestries. Because Pi is believed to be a "normal number" (every sequence of digits appears with uniform frequency), the visual pattern resembles balanced chromatic noise, yet hidden symmetries and streaks frequently emerge.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-1">Famous Landmarks</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-200">The Feynman Point:</strong> Decimal positions 762 to 767 contain six consecutive nines (<code className="text-purple-300">999999</code>). Physicist Richard Feynman playfully said he'd like to memorize Pi to that point and recite "...999999 and so on!"
              </li>
              <li>
                <strong className="text-slate-200">Your Birthday:</strong> In 1,000,000 digits of Pi, virtually every 4-digit and 6-digit date can be found!
              </li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30">
            <h4 className="font-semibold text-purple-200 mb-1 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              Interactive Tips
            </h4>
            <ul className="space-y-1 text-purple-300/80">
              <li>• Click any digit circle in the top bar to customize its exact color.</li>
              <li>• Click the eye icon next to any digit to isolate it and dim the rest.</li>
              <li>• Pan around the mosaic with drag and zoom with your scroll wheel.</li>
              <li>• Switch between Color Mosaic, Digits Stream, Archimedean Spiral, and Stats.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-colors"
          >
            Got it, explore!
          </button>
        </div>
      </div>
    </div>
  );
}
