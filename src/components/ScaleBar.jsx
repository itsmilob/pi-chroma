import React from 'react';

// Real-world units for the mosaic's scale bar. `m` is meters per unit.
export const UNITS = {
  mm: { label: 'mm', name: 'millimeters', m: 0.001, imperial: false },
  cm: { label: 'cm', name: 'centimeters', m: 0.01, imperial: false },
  in: { label: 'in', name: 'inches', m: 0.0254, imperial: true },
  ft: { label: 'ft', name: 'feet', m: 0.3048, imperial: true },
  yd: { label: 'yd', name: 'yards', m: 0.9144, imperial: true },
  m: { label: 'm', name: 'meters', m: 1, imperial: false },
  km: { label: 'km', name: 'kilometers', m: 1000, imperial: false },
  mi: { label: 'mi', name: 'miles', m: 1609.344, imperial: true },
};

const IMPERIAL_LADDER = ['in', 'ft', 'mi'];
const METRIC_LADDER = ['mm', 'm', 'km'];

// 1, 2 or 5 times a power of ten, the largest that is <= max
export function niceLength(max) {
  if (!(max > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(max));
  for (const n of [5, 2, 1]) if (n * base <= max) return n * base;
  return base;
}

export function formatNumber(v) {
  if (v >= 100) return Math.round(v).toLocaleString();
  return Number(v.toPrecision(3)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// A length in meters, written in the most readable unit of the same system
export function friendlyLength(meters, imperial) {
  const ladder = (imperial ? IMPERIAL_LADDER : METRIC_LADDER).map((k) => UNITS[k]);
  let pick = ladder[0];
  for (const unit of ladder) if (meters / unit.m >= 1) pick = unit;
  return `${formatNumber(meters / pick.m)} ${pick.label}`;
}

// Scale bar for a view where one unit of `unit` is `pxPerUnit` screen pixels wide.
export default function ScaleBar({ pxPerUnit, unit }) {
  if (!(pxPerUnit > 0)) return null;
  const u = UNITS[unit];
  const value = niceLength(120 / pxPerUnit);
  const width = value * pxPerUnit;
  const alt = friendlyLength(value * u.m, u.imperial);
  const main = `${formatNumber(value)} ${u.label}`;

  return (
    <div className="flex flex-col items-start gap-0.5 text-[11px] font-mono text-slate-200 pointer-events-none select-none">
      <div className="flex items-baseline gap-2">
        <span className="font-bold">{main}</span>
        {alt !== main && <span className="text-slate-400">≈ {alt}</span>}
      </div>
      <div className="relative h-2" style={{ width }}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200" />
        <div className="absolute left-0 bottom-0 w-px h-2 bg-slate-200" />
        <div className="absolute right-0 bottom-0 w-px h-2 bg-slate-200" />
      </div>
    </div>
  );
}
