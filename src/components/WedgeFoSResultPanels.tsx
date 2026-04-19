import React from 'react';
import { Save } from 'lucide-react';

interface Breakdown {
  driving: number;
  resisting: number;
  shotcrete: number;
  bolt: number;
  anchor: number;
}

interface DecisionSummary {
  actionLevel: string;
  supportRecommendation: string;
  confidenceNote: string;
  reviewRequired: boolean;
}

interface AnalysisSummary {
  fos: number | null;
  fosShotcrete: number | null;
  fosBolt: number | null;
  fosAnchor: number | null;
  fosCombined: number | null;
  stabilityClass: string;
  interpretation: string;
  breakdown: Breakdown;
  decision: DecisionSummary;
}

interface WedgeFoSResultPanelsProps {
  analysis: AnalysisSummary;
  riskClass?: string | null;
  onSave: () => void;
}

const formatFos = (value: number | null) => value !== null ? value.toFixed(2) : 'Invalid geometry';

export const WedgeFoSResultPanels: React.FC<WedgeFoSResultPanelsProps> = ({ analysis, riskClass, onSave }) => {
  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2">FoS Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-zinc-500">Driving Force:</div>
          <div className="font-mono font-bold text-zinc-700">{analysis.breakdown.driving.toFixed(1)} kN</div>
          <div className="text-zinc-500">Shear Resistance:</div>
          <div className="font-mono font-bold text-zinc-700">{analysis.breakdown.resisting.toFixed(1)} kN</div>
          <div className="text-zinc-500">Shotcrete Contrib:</div>
          <div className="font-mono font-bold text-zinc-700">{analysis.breakdown.shotcrete.toFixed(1)} kN</div>
          <div className="text-zinc-500">Bolt Contrib:</div>
          <div className="font-mono font-bold text-zinc-700">{analysis.breakdown.bolt.toFixed(1)} kN</div>
          <div className="text-zinc-500">Anchor Contrib:</div>
          <div className="font-mono font-bold text-zinc-700">{analysis.breakdown.anchor.toFixed(1)} kN</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold text-zinc-500 uppercase">FoS (Unsupported)</div>
          <div className="text-xl font-bold text-zinc-800">{formatFos(analysis.fos)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold text-zinc-500 uppercase">FoS (+ Shotcrete)</div>
          <div className="text-xl font-bold text-zinc-800">{formatFos(analysis.fosShotcrete)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold text-zinc-500 uppercase">FoS (+ Bolt)</div>
          <div className="text-xl font-bold text-zinc-800">{formatFos(analysis.fosBolt)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-bold text-zinc-500 uppercase">FoS (+ Anchor)</div>
          <div className="text-xl font-bold text-zinc-800">{formatFos(analysis.fosAnchor)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm col-span-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase">FoS (Combined)</div>
          <div className="text-2xl font-bold text-zinc-900">{formatFos(analysis.fosCombined)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-200 pb-2">Result Summary</h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div className="text-zinc-500">Stability Class:</div>
          <div className="font-bold text-zinc-800">{analysis.stabilityClass}</div>

          <div className="text-zinc-500">Risk Class:</div>
          <div className="font-bold text-zinc-800">{riskClass || 'N/A'}</div>

          <div className="text-zinc-500">Action Level:</div>
          <div className="font-bold text-zinc-800">{analysis.decision.actionLevel}</div>

          <div className="text-zinc-500">Support Rec:</div>
          <div className="font-bold text-zinc-800">{analysis.decision.supportRecommendation}</div>

          <div className="text-zinc-500">Confidence:</div>
          <div className="font-bold text-zinc-800">{analysis.decision.confidenceNote}</div>

          <div className="text-zinc-500">Review Required:</div>
          <div className={`font-bold ${analysis.decision.reviewRequired ? 'text-red-600' : 'text-emerald-600'}`}>{analysis.decision.reviewRequired ? 'Yes' : 'No'}</div>

          <div className="text-zinc-500 col-span-2 mt-2 border-t border-zinc-200 pt-2">Engineering Interpretation:</div>
          <div className="font-medium text-zinc-700 col-span-2 italic text-sm">{analysis.interpretation}</div>
        </div>
      </div>

      <button
        onClick={onSave}
        className="w-full bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-zinc-900 flex items-center justify-center gap-2"
      >
        <Save className="w-5 h-5" />
        Save Analysis
      </button>
    </>
  );
};
