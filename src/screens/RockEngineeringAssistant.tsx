import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { getEngineeringSummary, EngineeringSummary } from '../engineering/rockEngineeringBrain';
import { projectRepo } from '../repositories/projectRepo';
import { locationRepo } from '../repositories/locationRepo';
import { Loader2, Brain, Activity, AlertTriangle, Hammer } from 'lucide-react';

export default function RockEngineeringAssistant() {
  const [summary, setSummary] = useState<EngineeringSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string>(projectRepo.getAll()[0]?.id || '');
  const [locationId, setLocationId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>(projectRepo.getAll());
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    setLocations(projectId ? locationRepo.listLocationsForProject(projectId) : []);
  }, [projectId]);

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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PageHeader title="Rock Engineering Assistant" />

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Project</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setLocationId('');
                }}
                className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm"
              >
                <option value="">Select Project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm"
                disabled={!projectId}
              >
                <option value="">Select Location...</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.chainage_start != null ? `CH ${l.chainage_start}` : 'No CH'} 
                    {l.side ? ` ${l.side}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-full items-center justify-center py-10">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
          ) : summary ? (
            <div className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Activity size={20} className="text-blue-600" />
                  Rock Mass Quality
                </h2>
                <div className="flex gap-4 text-sm font-bold text-zinc-800">
                  {summary.rmrValue !== null && <div>RMR: {summary.rmrValue}</div>}
                  {summary.qValue !== null && <div>Q: {summary.qValue}</div>}
                  {summary.gsiValue !== null && <div>GSI: {summary.gsiValue}</div>}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-orange-600" />
                  Structural Hazard
                </h2>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-zinc-500 uppercase">Failure Mechanism</span>
                  <span className="text-lg font-bold text-zinc-900">{summary.structuralHazard.failureMode}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-sm font-bold text-zinc-500 uppercase">Hazard Level</span>
                  <span className={`text-lg font-bold ${
                    summary.structuralHazard.failureMode === 'None observed' ? 'text-emerald-600' :
                    summary.structuralHazard.hazardLevel === 'Critical' ? 'text-red-600' :
                    summary.structuralHazard.hazardLevel === 'High' ? 'text-orange-600' :
                    summary.structuralHazard.hazardLevel === 'Moderate' ? 'text-yellow-600' :
                    'text-emerald-600'
                  }`}>
                    {summary.structuralHazard.failureMode === 'None observed' ? 'Low (default – no structural control)' : summary.structuralHazard.hazardLevel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 shadow-sm flex flex-col gap-4">
                <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                  <Hammer size={20} className="text-emerald-600" />
                  Recommendations
                </h2>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-emerald-700 uppercase">Support</span>
                  <span className="text-base font-bold text-emerald-950">{summary.indicativeSupport}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-sm font-bold text-emerald-700 uppercase">Monitoring</span>
                  <ul className="text-sm font-bold text-emerald-900 list-disc list-inside">
                    {summary.monitoring.map(m => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center text-sm text-zinc-500 py-10">
              Select a project and location to view recommendations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
