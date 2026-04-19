import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import StereonetRocscience from '../components/StereonetRocscience';
import { PageHeader } from '../components/PageHeader';
import { engineeringStore } from '../state/engineeringStore';
import { structuralAssessmentStore } from '../state/structuralAssessmentStore';
import { normalizeStructuralInput } from '../utils/structuralInput';

export default function StereonetView() {
  const location = useLocation();
  const [data, setData] = useState<any>(null);
  const [dataSource, setDataSource] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (location.state) {
        setData(location.state);
        setDataSource('Using current unsaved Structural Assessment inputs');
        return;
      }

      const state = engineeringStore.getState();
      if (state.jointSets.length > 0 && state.kinematicResult) {
        setData(state);
        setDataSource('Using current engineering state');
        return;
      }

      const draft = structuralAssessmentStore.loadDraft();
      if (draft) {
        setData(draft);
        setDataSource('Using current unsaved Structural Assessment inputs');
        return;
      }

      setDataSource('No Structural Assessment data available');
    };
    loadData();
  }, [location.state]);

  const analysis = useMemo(() => normalizeStructuralInput(data, {
    defaultEngineeringNote: 'Structural kinematic interpretation from the current assessment.'
  }), [data]);

  const jointSets = analysis?.jointSets ?? [];


  if (!analysis) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Stereonet View" />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            No structural assessment data found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Stereonet View" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-4xl mx-auto">
          {dataSource && (
            <div className={`mb-4 p-2 rounded text-xs font-bold text-center ${dataSource.includes('No') ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {dataSource}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col items-center">
                <div className="w-full mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Markland Kinematic Plot</h3>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase bg-zinc-50 px-2 py-1 rounded border border-zinc-100">
                    Lower Hemisphere Equal Angle
                  </div>
                </div>
                <StereonetRocscience
                  slopeDip={analysis.slopeDip}
                  slopeDipDir={analysis.slopeDipDir}
                  jointSets={jointSets.map((j) => ({ dip: j.dip, dipDir: j.dipDirection, id: j.id }))}
                  size={360}
                  frictionAngle={analysis.frictionAngle}
                  planarPossible={analysis.planarPossible}
                  wedgePossible={analysis.wedgePossible}
                  topplingPossible={analysis.topplingPossible}
                  controllingSet={analysis.controllingSet}
                  controllingPair={analysis.controllingPair}
                  wedgeTrend={analysis.wedgeTrend}
                  wedgePlunge={analysis.wedgePlunge}
                />
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm h-full">
                <div className="flex items-center gap-2 mb-4 text-zinc-800">
                  <Info className="text-indigo-600" size={20} />
                  <h2 className="text-sm font-bold uppercase tracking-wider">Engineering Interpretation</h2>
                </div>

                {!analysis.planarPossible && !analysis.wedgePossible && !analysis.topplingPossible ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
                      <p className="text-sm text-zinc-600 font-medium">No planar, wedge, or toppling mechanism is identified from the current structural assessment.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-600 leading-relaxed">
                      {analysis.engineeringNote}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysis.planarPossible && (
                      <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                        <div className="flex items-center gap-2 text-orange-700 mb-1">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-tight">Planar Sliding</span>
                        </div>
                        <p className="text-[11px] text-orange-800 leading-relaxed">
                          Structural assessment indicates planar release on {analysis.controllingSet || 'the controlling joint set'}.
                        </p>
                      </div>
                    )}

                    {analysis.wedgePossible && (
                      <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                        <div className="flex items-center gap-2 text-indigo-700 mb-1">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-tight">Wedge Sliding</span>
                        </div>
                        <p className="text-[11px] text-indigo-800 leading-relaxed">
                          Controlling pair {analysis.controllingPair || 'not recorded'} with wedge trend/plunge {analysis.wedgeTrend != null ? Math.round(Number(analysis.wedgeTrend)) : 'n/a'} / {analysis.wedgePlunge != null ? Math.round(Number(analysis.wedgePlunge)) : 'n/a'}.
                        </p>
                      </div>
                    )}

                    {analysis.topplingPossible && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-2 text-emerald-700 mb-1">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-tight">Toppling</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          Structural assessment indicates toppling control on {analysis.controllingSet || 'the controlling joint set'}.
                        </p>
                      </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-zinc-100">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Assessment Notes</h4>
                      <div className="space-y-2 text-[11px] text-zinc-600">
                        <p><strong>Friction angle:</strong> {analysis.frictionAngle} deg</p>
                        <p><strong>Confidence:</strong> {analysis.confidenceLevel}</p>
                        <p>{analysis.engineeringNote}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
