import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import PaletteBar from './components/PaletteBar';
import SearchPanel from './components/SearchPanel';
import ViewMosaic from './components/ViewMosaic';
import ViewTextStream from './components/ViewTextStream';
import ViewSpiral from './components/ViewSpiral';
import ViewStats from './components/ViewStats';
import AudioSonifier from './components/AudioSonifier';
import ExportModal from './components/ExportModal';
import AboutModal from './components/AboutModal';
import { COLOR_PALETTES } from './constants/palettes';
import { INITIAL_PI } from './constants/initialPi';
import { searchPattern } from './utils/piSearch';

export default function App() {
  // Pi Digits data (starts with 10k pre-bundled digits, async loads 1M digits)
  const [piDigits, setPiDigits] = useState(INITIAL_PI);
  const [isLoadingFullPi, setIsLoadingFullPi] = useState(true);

  // Active view mode: 'mosaic' | 'stream' | 'spiral' | 'stats'
  const [activeMode, setActiveMode] = useState('mosaic');

  // Palette & Color Customization
  const [activePaletteId, setActivePaletteId] = useState('spectral');
  const [colors, setColors] = useState(() => COLOR_PALETTES[0].colors);
  const [isolatedDigit, setIsolatedDigit] = useState(null); // null or 0-9

  // Search & Pattern Discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [jumpTargetIndex, setJumpTargetIndex] = useState(null);

  // Modals & Panels
  const [isAudioVisible, setIsAudioVisible] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Fetch full 1,000,000 digits from public folder on mount
  useEffect(() => {
    let cancelled = false;

    async function loadFullPi() {
      // Try multiple path candidates for local dev, GitHub Pages, and relative subpaths
      const candidates = [
        `${import.meta.env.BASE_URL}pi1000000.txt`,
        './pi1000000.txt',
        'pi1000000.txt',
        '/pi-chroma/pi1000000.txt',
        '/pi1000000.txt',
      ];

      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            if (!cancelled && text && text.length > 50000) {
              setPiDigits(text);
              setIsLoadingFullPi(false);
              return;
            }
          }
        } catch {
          // try next candidate
        }
      }

      if (!cancelled) {
        setIsLoadingFullPi(false);
      }
    }

    loadFullPi();

    return () => {
      cancelled = true;
    };
  }, []);

  // Update a single digit's color
  const handleColorChange = useCallback((digit, newColor) => {
    setColors((prev) => {
      const next = [...prev];
      next[digit] = newColor;
      return next;
    });
    setActivePaletteId('custom');
  }, []);

  // Select a preset palette
  const handleSelectPalette = useCallback((paletteId, newColors) => {
    setActivePaletteId(paletteId);
    setColors(newColors);
  }, []);

  // Toggle isolate digit
  const handleToggleIsolateDigit = useCallback((digit) => {
    setIsolatedDigit((prev) => (prev === digit ? null : digit));
  }, []);

  // Search calculation
  const searchResult = useMemo(() => {
    if (!searchQuery.trim()) {
      return {
        pattern: '',
        matches: [],
        totalMatches: 0,
        firstIndex: -1,
        expectedCount: 0,
        rarity: 0,
        searchTimeMs: 0,
      };
    }
    return searchPattern(piDigits, searchQuery);
  }, [piDigits, searchQuery]);

  // Reset active match index on search change
  useEffect(() => {
    setActiveMatchIndex(0);
    if (searchResult.matches.length > 0) {
      setJumpTargetIndex(searchResult.matches[0].index);
    }
  }, [searchResult]);

  const handleNavigateMatch = useCallback(
    (delta) => {
      if (searchResult.matches.length === 0) return;
      const nextIdx = Math.max(
        0,
        Math.min(searchResult.matches.length - 1, activeMatchIndex + delta)
      );
      setActiveMatchIndex(nextIdx);
      setJumpTargetIndex(searchResult.matches[nextIdx].index);
    },
    [searchResult, activeMatchIndex]
  );

  const handleJumpToMatch = useCallback((index) => {
    setJumpTargetIndex(index);
  }, []);

  const activePaletteObj = COLOR_PALETTES.find((p) => p.id === activePaletteId);
  const activePaletteName = activePaletteObj ? activePaletteObj.name : 'Custom';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

      <div className="relative z-10 max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col">
        {/* Navigation & Brand Header */}
        <Header
          activeMode={activeMode}
          setActiveMode={setActiveMode}
          totalDigits={piDigits.length}
          isLoadingFullPi={isLoadingFullPi}
          onOpenExport={() => setIsExportOpen(true)}
          isAudioVisible={isAudioVisible}
          setIsAudioVisible={setIsAudioVisible}
          onOpenAbout={() => setIsAboutOpen(true)}
        />

        {/* Audio Synthesizer Panel (collapsible) */}
        {isAudioVisible && (
          <AudioSonifier
            piDigits={piDigits}
            colors={colors}
            activeMatchIndex={activeMatchIndex}
            searchResult={searchResult}
          />
        )}

        {/* Color Palette Customizer Bar */}
        <PaletteBar
          colors={colors}
          onColorChange={handleColorChange}
          onSelectPalette={handleSelectPalette}
          activePaletteId={activePaletteId}
          isolatedDigit={isolatedDigit}
          onToggleIsolateDigit={handleToggleIsolateDigit}
        />

        {/* Search & Pattern Finder */}
        <SearchPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResult={searchResult}
          activeMatchIndex={activeMatchIndex}
          onNavigateMatch={handleNavigateMatch}
          onJumpToMatch={handleJumpToMatch}
          colors={colors}
        />

        {/* Main View Area based on Mode */}
        <main className="flex-1">
          {activeMode === 'mosaic' && (
            <ViewMosaic
              piDigits={piDigits}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
              jumpTargetIndex={jumpTargetIndex}
            />
          )}

          {activeMode === 'stream' && (
            <ViewTextStream
              piDigits={piDigits}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
              jumpTargetIndex={jumpTargetIndex}
            />
          )}

          {activeMode === 'spiral' && (
            <ViewSpiral
              piDigits={piDigits}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
            />
          )}

          {activeMode === 'stats' && (
            <ViewStats
              piDigits={piDigits}
              colors={colors}
              isLoadingFullPi={isLoadingFullPi}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-slate-900 text-slate-500 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>π Chroma</span>
            <span>•</span>
            <span>1,000,001 Digits Verified</span>
            <span>•</span>
            <span className="font-mono text-purple-400">3.1415926535...</span>
          </div>
          <div>
            Built with React, HTML5 Canvas & Web Audio API
          </div>
        </footer>
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        piDigits={piDigits}
        colors={colors}
        activePaletteName={activePaletteName}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
