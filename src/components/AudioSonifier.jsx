import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Music, Sliders, FastForward } from 'lucide-react';
import { piSynth } from '../utils/soundSynth';

export default function AudioSonifier({ piDigits, colors, activeMatchIndex, searchResult }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(12); // notes per second
  const [scale, setScale] = useState('pentatonic');
  const [volume, setVolume] = useState(0.4);
  const [currentPlayState, setCurrentPlayState] = useState({ index: 0, digit: '3' });

  useEffect(() => {
    piSynth.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    piSynth.setScale(scale);
  }, [scale]);

  useEffect(() => {
    piSynth.setVolume(volume);
  }, [volume]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      piSynth.stop();
    };
  }, []);

  const handleTogglePlay = () => {
    if (isPlaying) {
      piSynth.stop();
      setIsPlaying(false);
    } else {
      let startIdx = 0;
      if (searchResult && searchResult.matches.length > 0 && activeMatchIndex >= 0) {
        startIdx = searchResult.matches[activeMatchIndex].index;
      }
      piSynth.start(piDigits, startIdx, (index, digit) => {
        setCurrentPlayState({ index, digit });
      });
      setIsPlaying(true);
    }
  };

  const currentDigitNum = parseInt(currentPlayState.digit, 10);
  const currentColor = !isNaN(currentDigitNum) ? colors[currentDigitNum] : '#ffffff';

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl mb-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Play & Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePlay}
            className={`flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold shadow-lg transition-transform transform active:scale-95 ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 ring-2 ring-amber-400/50'
                : 'bg-purple-600 hover:bg-purple-500 ring-2 ring-purple-400/50'
            }`}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">
                Pi Audio Sonification
              </span>
              {isPlaying && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Listen to the mathematical melody of Pi digits mapped to musical pitches
            </p>
          </div>
        </div>

        {/* Live Playing Badge */}
        {isPlaying && (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-md animate-pulse"
              style={{ backgroundColor: currentColor }}
            >
              {currentPlayState.digit}
            </div>
            <div className="text-xs font-mono">
              <div className="text-slate-300 font-bold">
                Digit: {currentPlayState.digit}
              </div>
              <div className="text-slate-500 text-[10px]">
                Index: #{currentPlayState.index}
              </div>
            </div>
          </div>
        )}

        {/* Audio Controls */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Scale */}
          <div className="flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="pentatonic">Zen Pentatonic</option>
              <option value="ambient">Ambient Sine</option>
              <option value="minor">Minor Mystery</option>
              <option value="chiptune">8-Bit Arcade</option>
            </select>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-2">
            <FastForward className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">{speed} notes/s</span>
            <input
              type="range"
              min="2"
              max="40"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 accent-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
