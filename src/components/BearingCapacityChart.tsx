import React from 'react';
import type { BearingChartSeries } from '../engineering/bearingCapacitySpreadsheet';

interface BearingCapacityChartProps {
  chart: BearingChartSeries;
}

const colors = {
  linear: '#6b7280',
  westergaard: '#f97316',
  boussinesq: '#2563eb',
  allowable: '#facc15',
};

// Excel's default "category axis" spaces points evenly regardless of x value.
// To visually match the spreadsheet report, we intentionally plot by index.
const buildPolyline = (depths: number[], values: number[], width: number, height: number, maxValue: number) => {
  const count = Math.max(1, depths.length);
  return depths
    .map((_, index) => {
      const x = 48 + (index / Math.max(1, count - 1)) * (width - 72);
      const y = 12 + (1 - (values[index] ?? 0) / Math.max(1, maxValue)) * (height - 32);
      return `${x},${y}`;
    })
    .join(' ');
};

const buildStepPath = (depths: number[], values: number[], width: number, height: number, maxValue: number) => {
  const count = Math.max(1, depths.length);
  if (!count) return '';
  const xAt = (index: number) => 48 + (index / Math.max(1, count - 1)) * (width - 72);
  const yAt = (index: number) => 12 + (1 - (values[index] ?? 0) / Math.max(1, maxValue)) * (height - 32);
  let path = `M ${xAt(0).toFixed(2)} ${yAt(0).toFixed(2)}`;
  for (let i = 1; i < count; i += 1) {
    // horizontal to next x at previous y
    path += ` H ${xAt(i).toFixed(2)}`;
    // vertical to next y
    path += ` V ${yAt(i).toFixed(2)}`;
  }
  return path;
};

export const BearingCapacityChart: React.FC<BearingCapacityChartProps> = ({ chart }) => {
  if (!chart.depths.length) return null;

  const width = 640;
  const height = 320;
  const maxValue = Math.max(
    ...chart.pressureLinear,
    ...chart.pressureWestergaard,
    ...chart.pressureBoussinesq,
    ...chart.allowableStep,
    1
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-sm font-semibold text-slate-800">Pressure / Bearing Capacity Profile</div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full">
          <line x1="48" y1="12" x2="48" y2={height - 20} stroke="#cbd5e1" strokeWidth="1" />
          <line x1="48" y1={height - 20} x2={width - 12} y2={height - 20} stroke="#cbd5e1" strokeWidth="1" />

          {[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((ratio) => {
            const y = 12 + (1 - ratio) * (height - 32);
            const value = (maxValue * ratio).toFixed(0);
            return (
              <g key={ratio}>
                <line x1="48" y1={y} x2={width - 12} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x="8" y={y + 4} fontSize="11" fill="#64748b">{value}</text>
              </g>
            );
          })}

          {chart.depths
            .map((depth, index) => ({ depth, index }))
            .filter((item) => item.index % 4 === 0)
            .map((item) => {
              const x = 48 + (item.index / Math.max(1, chart.depths.length - 1)) * (width - 72);
            return (
              <g key={item.depth}>
                <line x1={x} y1="12" x2={x} y2={height - 20} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x - 8} y={height - 4} fontSize="10" fill="#64748b">{item.depth.toFixed(2)}</text>
              </g>
            );
          })}

          <polyline fill="none" stroke={colors.linear} strokeWidth="2" points={buildPolyline(chart.depths, chart.pressureLinear, width, height, maxValue)} />
          <polyline fill="none" stroke={colors.westergaard} strokeWidth="2" points={buildPolyline(chart.depths, chart.pressureWestergaard, width, height, maxValue)} />
          <polyline fill="none" stroke={colors.boussinesq} strokeWidth="2" points={buildPolyline(chart.depths, chart.pressureBoussinesq, width, height, maxValue)} />
          <path d={buildStepPath(chart.depths, chart.allowableStep, width, height, maxValue)} fill="none" stroke={colors.allowable} strokeWidth="2.5" />

          <text x={width / 2 - 24} y={height - 4} fontSize="11" fill="#64748b">Depth (m)</text>
          <text x="6" y="10" fontSize="11" fill="#64748b">Pressure / Bearing Capacity (kPa)</text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4" style={{ backgroundColor: colors.linear }} /> Linear</span>
        <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4" style={{ backgroundColor: colors.westergaard }} /> Westergaard</span>
        <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4" style={{ backgroundColor: colors.boussinesq }} /> Boussinesq</span>
        <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4" style={{ backgroundColor: colors.allowable }} /> Allowable</span>
      </div>
    </div>
  );
};
