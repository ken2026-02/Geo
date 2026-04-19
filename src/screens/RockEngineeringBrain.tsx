import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { getEngineeringSummary, EngineeringSummary } from '../engineering/rockEngineeringBrain';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Loader2, Brain } from 'lucide-react';

export const RockEngineeringBrain: React.FC = () => {
  const [summary, setSummary] = useState<EngineeringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    if (projectId && locationId) {
      setLoading(true);
      getEngineeringSummary(projectId, locationId).then(data => {
        setSummary(data);
        setLoading(false);
      });
    } else {
      setSummary(null);
      setLoading(false);
    }
  }, [projectId, locationId]);

  return (
    <div className="theme-rock-engineering-brain flex flex-col h-screen bg-gray-50">
      <PageHeader title="Rock Engineering Brain" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 flex flex-col gap-4">
            <ProjectSelector
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                setLocationId('');
              }}
            />
            <LocationSelector
              value={locationId}
              onChange={(id) => setLocationId(id)}
            />
          </div>

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        ) : summary ? (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Brain className="text-[var(--module-accent)]" size={24} />
                <h2 className="text-lg font-bold text-zinc-800">Engineering Summary</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Rock Mass Quality</span>
                  <div className="text-sm font-bold text-zinc-800">
                    {summary.rmrValue !== null && <div>RMR: {summary.rmrValue}</div>}
                    {summary.qValue !== null && <div>Q: {summary.qValue}</div>}
                    {summary.gsiValue !== null && <div>GSI: {summary.gsiValue}</div>}
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Structural Hazard</span>
                  <div className="text-sm font-bold text-zinc-800">
                    <div>Failure Mechanism: {summary.structuralHazard.failureMode}</div>
                    <div>Hazard Level: {summary.structuralHazard.failureMode === 'None observed' ? 'Low' : summary.structuralHazard.hazardLevel}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--module-accent-bg)] p-3 border border-[var(--module-accent)] border-opacity-20">
                <span className="text-[10px] font-bold uppercase text-[var(--module-accent)]">Indicative Support (Engineering Assessment)</span>
                <p className="text-sm font-bold text-zinc-800">{summary.indicativeSupport}</p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase text-emerald-600">Monitoring Suggestion</span>
                <ul className="text-sm font-bold text-emerald-900 list-disc list-inside">
                  {summary.monitoring.map(m => <li key={m}>{m}</li>)}
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-100 p-3">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Interpretation</span>
                <p className="text-sm text-zinc-700">{summary.interpretation}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-zinc-500">No data available for the selected project/location.</div>
        )}
        </div>
      </div>
    </div>
  );
};
