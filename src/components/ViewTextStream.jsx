import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Hash, Copy, Check, Sparkles } from 'lucide-react';

export default function ViewTextStream({
  store,
  colors,
  isolatedDigit,
  searchResult,
  activeMatchIndex,
  jump,
  onJumpToIndex,
}) {
  const [pageSize, setPageSize] = useState(1000); // 500, 1000, 2500, 5000
  const [currentPage, setCurrentPage] = useState(0);
  const [displayStyle, setDisplayStyle] = useState('badges'); // 'badges' or 'text'
  const [groupSize, setGroupSize] = useState(10); // 5, 10, or none
  const [copied, setCopied] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  const totalDigits = store.length;
  const totalPages = Math.ceil(totalDigits / pageSize);

  // Follow jumps from outside (search results, "Go to digit")
  useEffect(() => {
    if (jump && jump.index !== null && jump.index >= 0) {
      setCurrentPage(Math.floor(jump.index / pageSize));
    }
    // Only an actual jump should move the page, not a page-size change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  // Keep the same digits on screen when the page size changes
  const pageSizeRef = useRef(pageSize);
  useEffect(() => {
    if (pageSizeRef.current !== pageSize) {
      setCurrentPage((page) => Math.floor((page * pageSizeRef.current) / pageSize));
      pageSizeRef.current = pageSize;
    }
  }, [pageSize]);

  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(totalDigits, startIndex + pageSize);
  const pageDigits = useMemo(() => store.slice(startIndex, endIndex), [store, startIndex, endIndex]);

  // Extract matches that fall in this current page
  const pageMatches = useMemo(() => {
    if (!searchResult || !searchResult.pattern || searchResult.matches.length === 0) return [];
    const pLen = searchResult.pattern.length;
    return searchResult.matches.filter(
      (m) => m.index + pLen > startIndex && m.index < endIndex
    );
  }, [searchResult, startIndex, endIndex]);

  const handleCopyPage = () => {
    navigator.clipboard.writeText(pageDigits);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(jumpInput, 10);
    if (isNaN(val) || val < 0 || val >= totalDigits) return;
    // Jumping through the app also moves the mosaic; this page follows via `jump`
    if (onJumpToIndex) onJumpToIndex(val);
    else setCurrentPage(Math.floor(val / pageSize));
  };

  // Group the page into lines of 50 digits
  const lines = useMemo(() => {
    const result = [];
    const lineSize = 50;
    for (let i = 0; i < pageDigits.length; i += lineSize) {
      result.push({
        lineStartIdx: startIndex + i,
        digits: pageDigits.slice(i, i + lineSize),
      });
    }
    return result;
  }, [pageDigits, startIndex]);

  const gutterWidth = Math.max(6, String(totalDigits).length);

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6">
      {/* Stream Toolbar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Style & Chunking */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Style:</span>
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setDisplayStyle('badges')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  displayStyle === 'badges'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Color Badges
              </button>
              <button
                onClick={() => setDisplayStyle('text')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  displayStyle === 'text'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Color Text
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Group by:</span>
            <select
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={5}>5 digits</option>
              <option value={10}>10 digits</option>
              <option value={0}>No spaces</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={500}>500 digits</option>
              <option value={1000}>1,000 digits</option>
              <option value={2500}>2,500 digits</option>
              <option value={5000}>5,000 digits</option>
            </select>
          </div>
        </div>

        {/* Page Nav & Jump */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1">
            <input
              type="number"
              placeholder="Jump to index..."
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="w-28 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Go
            </button>
          </form>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-2 text-slate-300">
              Page {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleCopyPage}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors"
            title="Copy current digits to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Main Digits Stream Display */}
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[580px] font-mono text-sm leading-relaxed bg-slate-950/70 select-text">
        <div className="space-y-2">
          {lines.map((line) => {
            const lineStartIndex = line.lineStartIdx;
            const digitChars = line.digits.split('');

            return (
              <div key={lineStartIndex} className="flex items-start gap-4 hover:bg-slate-900/40 p-1 rounded-lg transition-colors">
                {/* Gutter Line Index */}
                <div className="w-24 sm:w-28 shrink-0 text-right text-[11px] text-slate-600 select-none pt-0.5 font-bold">
                  {lineStartIndex === 0
                    ? 'π = 3.'
                    : `#${lineStartIndex.toString().padStart(gutterWidth, '0')}`}
                </div>

                {/* Digits content */}
                <div className="flex flex-wrap items-center gap-y-1">
                  {digitChars.map((char, charOffset) => {
                    const globalIdx = lineStartIndex + charOffset;
                    const d = parseInt(char, 10);
                    const color = colors[d] || '#ffffff';
                    const isIsolated = isolatedDigit !== null && isolatedDigit === d;
                    const isDimmed = isolatedDigit !== null && isolatedDigit !== d;

                    // Check if this digit belongs to a search match
                    let isMatch = false;
                    let isMatchActive = false;
                    if (searchResult && searchResult.pattern) {
                      const pLen = searchResult.pattern.length;
                      for (let mIdx = 0; mIdx < pageMatches.length; mIdx++) {
                        const m = pageMatches[mIdx];
                        if (globalIdx >= m.index && globalIdx < m.index + pLen) {
                          isMatch = true;
                          if (searchResult.matches[activeMatchIndex]?.index === m.index) {
                            isMatchActive = true;
                          }
                          break;
                        }
                      }
                    }

                    // Spacer between groups
                    const addSpace = groupSize > 0 && (charOffset + 1) % groupSize === 0 && charOffset < digitChars.length - 1;

                    return (
                      <React.Fragment key={globalIdx}>
                        {displayStyle === 'badges' ? (
                          <span
                            title={`Digit ${char} (Index #${globalIdx.toLocaleString()})`}
                            style={{
                              backgroundColor: isDimmed ? '#1e293b' : `${color}25`,
                              borderColor: isDimmed ? '#334155' : color,
                              color: isDimmed ? '#64748b' : color,
                            }}
                            className={`inline-flex items-center justify-center w-6 h-6 m-0.5 text-xs font-bold rounded-md border transition-all cursor-pointer hover:scale-110 ${
                              isMatchActive
                                ? 'ring-2 ring-yellow-400 bg-yellow-400/30 scale-110 shadow-lg'
                                : isMatch
                                ? 'ring-2 ring-pink-500 bg-pink-500/30 font-extrabold'
                                : ''
                            } ${isIsolated ? 'ring-2 ring-purple-400 scale-105' : ''}`}
                          >
                            {char}
                          </span>
                        ) : (
                          <span
                            title={`Digit ${char} (Index #${globalIdx.toLocaleString()})`}
                            style={{
                              color: isDimmed ? '#334155' : color,
                              textShadow: !isDimmed ? `0 0 8px ${color}55` : 'none',
                            }}
                            className={`inline-block font-bold px-0.5 text-base transition-all hover:scale-125 cursor-pointer ${
                              isMatchActive
                                ? 'bg-yellow-400/40 text-white underline decoration-yellow-400 decoration-2 ring-1 ring-yellow-400 rounded'
                                : isMatch
                                ? 'bg-pink-500/30 text-white font-extrabold underline rounded'
                                : ''
                            } ${isIsolated ? 'underline font-extrabold' : ''}`}
                          >
                            {char}
                          </span>
                        )}

                        {addSpace && (
                          <span className="inline-block w-2 sm:w-3 select-none" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
