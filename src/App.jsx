import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import WindowBar from './components/WindowBar';
import { COLOR_PALETTES } from './constants/palettes';
import { INITIAL_PI } from './constants/initialPi';
import { PiStore } from './data/piStore';
import { searchStore, EMPTY_RESULT } from './utils/piSearch';
import { MAX_CELLS } from './utils/aggregate';

// The visual views draw at most MAX_CELLS cells at a time, each standing for
// `perCell` digits, so a window spans MAX_CELLS * perCell digits. The store
// behind them (search, stats, audio) always covers every loaded digit.
const WINDOW_STEP = 1000;

export default function App() {
  // Pi digits: starts with the 10k pre-bundled digits, then the 1M text file,
  // then (if available) a packed billion-digit file.
  const [store, setStore] = useState(() => PiStore.fromString(INITIAL_PI));
  const [isLoadingFullPi, setIsLoadingFullPi] = useState(true);
  const [bigLoad, setBigLoad] = useState({ active: false, progress: 0, error: null });

  // Zoom-out scale: digits per cell ('fit' picks the smallest that fits the
  // whole store in one window), how a cell is colored, and which slice of the
  // store the views are showing.
  const [scaleOption, setScaleOption] = useState('fit');
  const [colorMode, setColorMode] = useState('blend');
  const [enhance, setEnhance] = useState(true);
  const [windowStart, setWindowStart] = useState(0);
  // The 1:1 mosaic scrolls freely over every digit; these track where it is
  const [explorerCenter, setExplorerCenter] = useState(0);
  const [visibleRange, setVisibleRange] = useState(null);
  const perCell = scaleOption === 'fit' ? Math.max(1, Math.ceil(store.length / MAX_CELLS)) : scaleOption;
  const windowSize = Math.min(store.length, MAX_CELLS * perCell);
  const maxWindowStart = Math.max(0, store.length - windowSize);
  const start = Math.min(windowStart, maxWindowStart);

  // Active view mode: 'mosaic' | 'stream' | 'spiral' | 'stats'
  const [activeMode, setActiveMode] = useState('mosaic');

  // Palette & Color Customization
  const [activePaletteId, setActivePaletteId] = useState('spectral');
  const [colors, setColors] = useState(() => COLOR_PALETTES[0].colors);
  const [isolatedDigit, setIsolatedDigit] = useState(null); // null or 0-9

  // Search & Pattern Discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [searchResult, setSearchResult] = useState(EMPTY_RESULT);
  const [isSearching, setIsSearching] = useState(false);
  const [jump, setJump] = useState({ index: null, seq: 0 }); // global digit index to scroll to

  // Modals & Panels
  const [isAudioVisible, setIsAudioVisible] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Fetch full 1,000,000 digits from public folder on mount
  useEffect(() => {
    let cancelled = false;

    async function loadFullPi() {
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
              // Never replace a bigger store (loaded meanwhile) with the 1M file
              setStore((prev) => (prev.length > text.length ? prev : PiStore.fromString(text)));
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

  // Use a packed billion-digit file if one is served next to the app
  // (public/pi-1b.pi4); otherwise the user can load one from disk.
  useEffect(() => {
    const ctrl = new AbortController();
    PiStore.fromUrl(
      `${import.meta.env.BASE_URL}pi-1b.pi4`,
      (progress) => setBigLoad({ active: true, progress, error: null }),
      ctrl.signal
    )
      .then((loaded) => {
        if (loaded) setStore(loaded);
        setBigLoad({ active: false, progress: 0, error: null });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setBigLoad({ active: false, progress: 0, error: null });
      });
    return () => ctrl.abort();
  }, []);

  const handleLoadFile = useCallback(async (file) => {
    setBigLoad({ active: true, progress: 0, error: null });
    try {
      const loaded = await PiStore.fromFile(file, (progress) =>
        setBigLoad({ active: true, progress, error: null })
      );
      setStore(loaded);
      setWindowStart(0);
      setJump({ index: null, seq: 0 });
      setBigLoad({ active: false, progress: 0, error: null });
    } catch (err) {
      setBigLoad({ active: false, progress: 0, error: err.message });
    }
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

  // Search the whole store (debounced, cancellable)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResult(EMPTY_RESULT);
      setIsSearching(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const result = await searchStore(store, searchQuery, { signal: ctrl.signal });
      if (result && !ctrl.signal.aborted) {
        setSearchResult(result);
        setIsSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [store, searchQuery]);

  // Jump to a global digit index, moving the window if it is not already visible
  const windowStartRef = useRef(0);
  windowStartRef.current = start;
  const handleJumpToIndex = useCallback(
    (index) => {
      const current = windowStartRef.current;
      const margin = Math.min(WINDOW_STEP, windowSize / 10);
      let next = current;
      if (index < current + margin || index >= current + windowSize - margin) {
        const centered = Math.floor((index - windowSize / 2) / WINDOW_STEP) * WINDOW_STEP;
        next = Math.max(0, Math.min(maxWindowStart, centered));
      }
      setWindowStart(next);
      setExplorerCenter(index);
      setJump((prev) => ({ index, seq: prev.seq + 1 }));
    },
    [windowSize, maxWindowStart]
  );

  // The 1:1 mosaic reports where it settled; other views start from there
  const handleExplorerMove = useCallback(
    ({ center, first, last }) => {
      setExplorerCenter(center);
      setVisibleRange({ first, last });
      setWindowStart(Math.max(0, Math.floor((center - windowSize / 2) / WINDOW_STEP) * WINDOW_STEP));
    },
    [windowSize]
  );

  // From the overview, zoom in to individual cubes at a digit
  const handleZoomInto = useCallback(
    (index) => {
      setScaleOption(1);
      handleJumpToIndex(index);
    },
    [handleJumpToIndex]
  );

  // Reset active match index on search change
  useEffect(() => {
    setActiveMatchIndex(0);
    if (searchResult.matches.length > 0) {
      handleJumpToIndex(searchResult.matches[0].index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult]);

  const handleNavigateMatch = useCallback(
    (delta) => {
      if (searchResult.matches.length === 0) return;
      const nextIdx = Math.max(
        0,
        Math.min(searchResult.matches.length - 1, activeMatchIndex + delta)
      );
      setActiveMatchIndex(nextIdx);
      handleJumpToIndex(searchResult.matches[nextIdx].index);
    },
    [searchResult, activeMatchIndex, handleJumpToIndex]
  );

  const handleJumpToMatch = useCallback(
    (index) => handleJumpToIndex(index),
    [handleJumpToIndex]
  );

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
          totalDigits={store.length}
          isLoadingFullPi={isLoadingFullPi}
          onOpenExport={() => setIsExportOpen(true)}
          isAudioVisible={isAudioVisible}
          setIsAudioVisible={setIsAudioVisible}
          onOpenAbout={() => setIsAboutOpen(true)}
        />

        {/* Audio Synthesizer Panel (collapsible) */}
        {isAudioVisible && (
          <AudioSonifier
            piDigits={store}
            defaultStartIndex={start}
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
          isSearching={isSearching}
          totalDigits={store.length}
        />

        {/* Which slice of the loaded digits the views show, and loading more */}
        <WindowBar
          totalDigits={store.length}
          windowStart={start}
          windowSize={windowSize}
          step={WINDOW_STEP}
          onChangeStart={(next) => setWindowStart(Math.max(0, Math.min(maxWindowStart, next)))}
          onLoadFile={handleLoadFile}
          load={bigLoad}
          explorerRange={activeMode === 'mosaic' && perCell === 1 ? visibleRange ?? { first: 0, last: 0 } : null}
          onGoTo={handleJumpToIndex}
          perCell={perCell}
          scaleOption={scaleOption}
          onScaleChange={setScaleOption}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          enhance={enhance}
          onEnhanceChange={setEnhance}
        />

        {/* Main View Area based on Mode */}
        <main className="flex-1">
          {activeMode === 'mosaic' && (
            <ViewMosaic
              store={store}
              start={start}
              windowSize={windowSize}
              perCell={perCell}
              colorMode={colorMode}
              enhance={enhance}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
              jump={jump}
              center={explorerCenter}
              onMove={handleExplorerMove}
              onOverview={() => setScaleOption('fit')}
              onZoomInto={handleZoomInto}
            />
          )}

          {activeMode === 'stream' && (
            <ViewTextStream
              store={store}
              onJumpToIndex={handleJumpToIndex}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
              jump={jump}
            />
          )}

          {activeMode === 'spiral' && (
            <ViewSpiral
              store={store}
              colorMode={colorMode}
              enhance={enhance}
              colors={colors}
              isolatedDigit={isolatedDigit}
              searchResult={searchResult}
              activeMatchIndex={activeMatchIndex}
              jump={jump}
            />
          )}

          {activeMode === 'stats' && (
            <ViewStats
              store={store}
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
            <span>{store.length.toLocaleString()} digits loaded</span>
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
        store={store}
        start={start}
        perCell={perCell}
        colorMode={colorMode}
        enhance={enhance}
        colors={colors}
        isolatedDigit={isolatedDigit}
        activePaletteName={activePaletteName}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
