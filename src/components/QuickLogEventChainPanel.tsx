import React from 'react';

interface QuickLogEventChainPanelProps {
  triggerCategories: readonly string[];
  triggerCategory: string;
  immediateAction: string;
  reviewRequired: number;
  onTriggerChange: (value: string) => void;
  onImmediateActionChange: (value: string) => void;
  onToggleReviewRequired: () => void;
}

export const QuickLogEventChainPanel: React.FC<QuickLogEventChainPanelProps> = ({
  triggerCategories,
  triggerCategory,
  immediateAction,
  reviewRequired,
  onTriggerChange,
  onImmediateActionChange,
  onToggleReviewRequired,
}) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Event Chain</h2>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Trigger Category</label>
        <select
          value={triggerCategory}
          onChange={(e) => onTriggerChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {triggerCategories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Immediate Action Taken</label>
        <textarea
          value={immediateAction}
          onChange={(e) => onImmediateActionChange(e.target.value)}
          className="min-h-[80px] w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="Record any scaling, barricading, drainage clearing, cleanup, or other controls completed on site..."
        />
      </div>
      <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-100">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-zinc-800">Further Review Required</span>
          <span className="text-[10px] text-zinc-400">Flag for engineering follow-up or supervisor review</span>
        </div>
        <button
          type="button"
          onClick={onToggleReviewRequired}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${reviewRequired ? 'bg-amber-500' : 'bg-zinc-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reviewRequired ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  );
};
