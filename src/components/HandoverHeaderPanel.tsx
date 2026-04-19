import React from 'react';
import { Copy, FileText, Save } from 'lucide-react';
import { ReviewSurfaceHeader } from './ReviewSurfaceHeader';

interface HandoverHeaderPanelProps {
  date: string;
  isSaving: boolean;
  processedCount: number;
  locationCount: number;
  highRiskCount: number;
  openActionCount: number;
  onDateChange: (value: string) => void;
  onSave: () => void;
  onCopy: () => void;
  onExport: () => void;
}

export const HandoverHeaderPanel: React.FC<HandoverHeaderPanelProps> = ({
  date,
  isSaving,
  processedCount,
  locationCount,
  highRiskCount,
  openActionCount,
  onDateChange,
  onSave,
  onCopy,
  onExport,
}) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm print:hidden">
      <ReviewSurfaceHeader
        badge="Shift handover"
        title="Daily field and engineering handover pack"
        subtitle="Use this pack to review key field observations, engineering summaries and shift actions before issue."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-500">Review key items, reorder as needed, then save or export the handover pack.</div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-zinc-200 p-2 text-sm font-bold text-zinc-800"
          />
          <div className="flex gap-2">
            <button onClick={onSave} disabled={isSaving} className="rounded-lg bg-zinc-100 p-2 text-zinc-600 hover:bg-zinc-200"><Save size={20} /></button>
            <button onClick={onCopy} className="rounded-lg bg-emerald-100 p-2 text-emerald-600 hover:bg-emerald-200"><Copy size={20} /></button>
            <button onClick={onExport} className="rounded-lg bg-zinc-900 p-2 text-white hover:bg-zinc-800"><FileText size={20} /></button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">Key items</div><div className="mt-1 text-lg font-bold text-zinc-900">{processedCount}</div></div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">Locations</div><div className="mt-1 text-lg font-bold text-zinc-900">{locationCount}</div></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3"><div className="text-[10px] font-bold uppercase text-orange-700">High risks</div><div className="mt-1 text-lg font-bold text-orange-900">{highRiskCount}</div></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="text-[10px] font-bold uppercase text-emerald-700">Open actions</div><div className="mt-1 text-lg font-bold text-emerald-900">{openActionCount}</div></div>
      </div>
    </div>
  );
};
