import React, { useState, useMemo } from 'react';
import { BarChart3, CheckCircle2, TrendingUp, Grid } from 'lucide-react';
import { computeDigitStats } from '../utils/piSearch';

export default function ViewStats({ piDigits, colors }) {
  const [sampleLimit, setSampleLimit] = useState(1000000); // 1000, 10000, 100000, 1000000

  const stats = useMemo(() => {
    return computeDigitStats(piDigits, Math.min(sampleLimit, piDigits.length));
  }, [piDigits, sampleLimit]);

  // Compute 10x10 transition matrix: count how often digit A is followed by digit B
  const transitionMatrix = useMemo(() => {
    const matrix = Array.from({ length: 10 }, () => new Array(10).fill(0));
    const limit = Math.min(sampleLimit, piDigits.length - 1);

    for (let i = 0; i < limit; i++) {
      const from = piDigits.charCodeAt(i) - 48;
      const to = piDigits.charCodeAt(i + 1) - 48;
      if (from >= 0 && from <= 9 && to >= 0 && to <= 9) {
        matrix[from][to]++;
      }
    }
    return matrix;
  }, [piDigits, sampleLimit]);

  const maxFreq = Math.max(...stats.frequencies.map((f) => f.count), 1);

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden mb-6 p-4 sm:p-6">
      {/* Header & Sample Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Pi Statistical Distribution & Uniformity
            </h3>
            <p className="text-xs text-slate-400">
              Examining frequency balance and randomness across {stats.totalDigits.toLocaleString()} digits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Sample Digits:</span>
          <select
            value={sampleLimit}
            onChange={(e) => setSampleLimit(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value={1000}>First 1,000</option>
            <option value={10000}>First 10,000</option>
            <option value={100000}>First 100,000</option>
            <option value={1000000}>Full 1,000,000</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Total Analyzed</span>
            <div className="text-xl font-bold font-mono text-slate-100">
              {stats.totalDigits.toLocaleString()}
            </div>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Expected: {(stats.totalDigits / 10).toLocaleString()} / digit
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Chi-Square Test (df=9)</span>
            <div className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <span>{stats.chiSquare}</span>
              {stats.isStatisticallyNormal ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Normal
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                  Deviating
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-slate-500">Critical: 16.92</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Normal Number Conjecture</span>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Evenly Distributed</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500">Base 10</span>
        </div>
      </div>

      {/* Digit Bars */}
      <div className="space-y-3 mb-8">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Frequency by Digit (0 – 9)
        </h4>

        <div className="space-y-2">
          {stats.frequencies.map(({ digit, count, percentage, diff }) => {
            const barWidth = `${Math.min(100, (count / maxFreq) * 100)}%`;
            const color = colors[digit];

            return (
              <div key={digit} className="flex items-center gap-3 text-xs font-mono">
                {/* Digit Badge */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {digit}
                </div>

                {/* Bar */}
                <div className="flex-1 h-5 bg-slate-950 rounded-md overflow-hidden relative border border-slate-800/80">
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: barWidth,
                      backgroundColor: color,
                      opacity: 0.85,
                    }}
                  />
                  {/* Ideal 10% line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/40 dashed z-10"
                    style={{ left: `${(stats.totalDigits / 10 / maxFreq) * 100}%` }}
                    title="Expected 10.00% mark"
                  />
                </div>

                {/* Counts & Percentage */}
                <div className="w-24 text-right text-slate-200 font-bold">
                  {count.toLocaleString()}
                </div>
                <div className="w-16 text-right text-slate-400">
                  {percentage.toFixed(2)}%
                </div>
                <div
                  className={`w-16 text-right text-[11px] font-semibold ${
                    diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500'
                  }`}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transition Matrix Grid */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Grid className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-slate-200">
            Digit Transition Heatmap (Row Followed By Column)
          </h4>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          Shows how many times digit row $A$ is immediately followed by digit column $B$. In a truly random stream, all cells are roughly equal.
        </p>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-[320px]">
            {/* Top header row */}
            <div className="flex items-center">
              <div className="w-8 h-8 text-[11px] font-bold text-slate-500 flex items-center justify-center">
                A\B
              </div>
              {Array.from({ length: 10 }).map((_, c) => (
                <div
                  key={c}
                  className="w-8 h-8 text-[11px] font-bold text-center flex items-center justify-center font-mono"
                  style={{ color: colors[c] }}
                >
                  {c}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            {transitionMatrix.map((row, r) => (
              <div key={r} className="flex items-center">
                <div
                  className="w-8 h-8 text-[11px] font-bold text-center flex items-center justify-center font-mono"
                  style={{ color: colors[r] }}
                >
                  {r}
                </div>
                {row.map((val, c) => {
                  const expectedCell = stats.totalDigits / 100;
                  const ratio = expectedCell > 0 ? val / expectedCell : 1;
                  // Color intensity based on ratio around 1.0
                  const isHigh = ratio > 1.0;
                  const intensity = Math.min(1, Math.abs(ratio - 1) * 8);

                  return (
                    <div
                      key={c}
                      title={`Digit ${r} -> Digit ${c}: ${val.toLocaleString()} times (${(ratio * 100).toFixed(1)}% of expected)`}
                      className="w-8 h-8 m-0.5 rounded flex items-center justify-center text-[10px] font-mono cursor-pointer transition-transform hover:scale-125 border border-slate-800"
                      style={{
                        backgroundColor: isHigh
                          ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`
                          : `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`,
                        color: isHigh ? '#a7f3d0' : '#fecaca',
                      }}
                    >
                      {Math.round(ratio * 100)}%
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
