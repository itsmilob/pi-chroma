import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Calendar, Sparkles, X, Target, Telescope, Loader2, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FAMOUS_PATTERNS } from '../constants/palettes';
import { formatDatePatterns } from '../utils/piSearch';
import { searchDeepPiIndex } from '../utils/billionPiService';

export default function SearchPanel({
  searchQuery,
  onSearchChange,
  searchResult,
  activeMatchIndex,
  onNavigateMatch,
  onJumpToMatch,
  colors,
  onJumpToBillionIndex,
}) {
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [isSearchingDeep, setIsSearchingDeep] = useState(false);
  const [deepSearchResult, setDeepSearchResult] = useState(null);

  const handleApplyPattern = (pattern, label) => {
    onSearchChange(pattern);
    setDeepSearchResult(null);
    if (pattern === '999999') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setDeepSearchResult(null);
    if (date) {
      const patterns = formatDatePatterns(date);
      if (patterns.length > 0) {
        onSearchChange(patterns[0].value);
      }
    }
  };

  const handleDeepSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingDeep(true);
    setDeepSearchResult(null);

    const result = await searchDeepPiIndex(searchQuery);
    setIsSearchingDeep(false);
    setDeepSearchResult(result);

    if (result && result.found) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const currentMatch =
    searchResult.matches.length > 0 && activeMatchIndex >= 0
      ? searchResult.matches[activeMatchIndex]
      : null;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl mb-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Pi Pattern Search & Digit Finder
            </h3>
            <p className="text-xs text-slate-400">
              Locate birthdays, repeating sequences, or any digit combo in up to 1,000,000,000 digits
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowBirthdayPicker(!showBirthdayPicker)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            showBirthdayPicker
              ? 'bg-pink-600/30 text-pink-200 border-pink-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-pink-400" />
          <span>Birthday Finder</span>
        </button>
      </div>

      {/* Birthday Picker Row */}
      {showBirthdayPicker && (
        <div className="p-3 mb-3 rounded-xl bg-pink-950/20 border border-pink-800/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-pink-200 font-medium">Select Birthday:</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-pink-500"
            />
            {selectedDate && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Try format:</span>
                {formatDatePatterns(selectedDate).map((pat) => (
                  <button
                    key={pat.label}
                    onClick={() => {
                      onSearchChange(pat.value);
                      setDeepSearchResult(null);
                    }}
                    className={`text-[11px] px-2 py-1 rounded font-mono transition-colors ${
                      searchQuery === pat.value
                        ? 'bg-pink-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Search Input */}
      <div className="relative mb-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setDeepSearchResult(null);
            }}
            placeholder="Type any digits (e.g., 999999, 123456, 777, your phone/bday)..."
            className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-slate-100 placeholder-slate-500 font-mono text-sm rounded-xl pl-10 pr-24 py-2.5 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                setDeepSearchResult(null);
              }}
              className="absolute right-3 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preset Famous Sequences */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Famous:
        </span>
        {FAMOUS_PATTERNS.map((item) => (
          <button
            key={item.pattern}
            onClick={() => handleApplyPattern(item.pattern, item.label)}
            title={item.description}
            className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
              searchQuery === item.pattern
                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-sm shadow-purple-500/20'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
            }`}
          >
            <span>{item.label}</span>
            <span className="ml-1.5 opacity-60 text-[10px]">({item.pattern})</span>
          </button>
        ))}
      </div>

      {/* Search Results Summary & Match Navigator */}
      {searchQuery && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                searchResult.totalMatches > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs text-slate-300">
              {searchResult.totalMatches > 0 ? (
                <>
                  Found <strong className="text-white font-mono">{searchResult.totalMatches.toLocaleString()}</strong>{' '}
                  occurrences
                  {searchResult.firstIndex !== -1 && (
                    <span className="text-slate-400 ml-1">
                      (First at index <span className="text-purple-300 font-mono">#{searchResult.firstIndex}</span>)
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px] ml-1">
                    [{searchResult.searchTimeMs}ms]
                  </span>
                </>
              ) : (
                <span className="text-rose-400">
                  No match found in local 1,000,000 digits
                </span>
              )}
            </span>
          </div>

          {/* Deep 1-Billion Search Trigger */}
          {searchResult.totalMatches === 0 && !deepSearchResult && (
            <button
              onClick={handleDeepSearch}
              disabled={isSearchingDeep}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              {isSearchingDeep ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Telescope className="w-3.5 h-3.5" />
              )}
              <span>Search in 1 Billion Digits</span>
            </button>
          )}

          {searchResult.matches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Match <span className="text-white font-mono">{activeMatchIndex + 1}</span> of{' '}
                <span className="text-white font-mono">{searchResult.matches.length}</span>
                {searchResult.totalMatches > searchResult.matches.length && (
                  <span className="text-slate-500 text-[10px]"> (showing first {searchResult.matches.length})</span>
                )}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavigateMatch(-1)}
                  disabled={activeMatchIndex <= 0}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                  title="Previous match"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigateMatch(1)}
                  disabled={activeMatchIndex >= searchResult.matches.length - 1}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                  title="Next match"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {currentMatch && (
                  <button
                    onClick={() => onJumpToMatch(currentMatch.index)}
                    className="flex items-center gap-1 ml-1 px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-sm transition-colors"
                  >
                    <Target className="w-3 h-3" />
                    <span>Jump</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deep Search Results Card */}
      {deepSearchResult && (
        <div className="mt-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs">
          {deepSearchResult.found ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-purple-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Found in Deep Pi at decimal position #{deepSearchResult.position.toLocaleString()}!</span>
                </div>
                <div className="font-mono text-[11px] text-slate-400 mt-1">
                  Context: ...{deepSearchResult.digitsBefore}
                  <span className="text-white font-bold bg-purple-600/40 px-1 py-0.5 rounded">
                    {deepSearchResult.pattern}
                  </span>
                  {deepSearchResult.digitsAfter}...
                </div>
              </div>
              {onJumpToBillionIndex && (
                <button
                  onClick={() => onJumpToBillionIndex(Math.max(0, deepSearchResult.position - 50))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md transition-colors"
                >
                  <Telescope className="w-3.5 h-3.5" />
                  <span>Stream & View in Colors</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-rose-400">
              Pattern "{deepSearchResult.pattern}" was not found within the searched 1 Billion digit index.
            </div>
          )}
        </div>
      )}

      {/* Match Detail Card */}
      {currentMatch && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
            <span className="text-purple-400 font-bold shrink-0">
              #{currentMatch.index}:
            </span>
            <span className="text-slate-500 select-none">
              {currentMatch.context.before}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-600/30 border border-purple-400 text-white font-bold tracking-wider">
              {currentMatch.context.matched}
            </span>
            <span className="text-slate-500 select-none">
              {currentMatch.context.after}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0 ml-3">
            Expected in uniform stream: ~{searchResult.expectedCount}
          </span>
        </div>
      )}
    </div>
  );
}
