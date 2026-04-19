import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { getSoilEngineeringSummary, SoilEngineeringSummary } from '../engineering/soilEngineeringBrain';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Loader2, Brain, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const SoilEngineeringBrain: React.FC = () => {
  const [summary, setSummary] = useState<SoilEngineeringSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    if (projectId && locationId) {
      setLoading(true);
      getSoilEngineeringSummary(projectId, locationId).then(data => {
        setSummary(data);
        setLoading(false);
      });
    } else {
      setSummary(null);
      setLoading(false);
    }
  }, [projectId, locationId]);

  return (
    <div className="theme-soil-engineering-brain flex flex-col h-screen bg-gray-50">
      <PageHeader title="Soil Engineering Brain" />
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
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <Brain className="text-[var(--module-accent)]" size={24} />
                <h2 className="text-lg font-bold text-zinc-800">Soil Engineering Brain</h2>
              </div>
              
              {/* 1. Soil Condition Summary */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">1. Soil Condition Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>Group: {summary.soilCondition.group}</p>
                  <p>Consistency: {summary.soilCondition.consistency}</p>
                  <p>Moisture: {summary.soilCondition.moisture}</p>
                  <p>Compressibility: {summary.soilCondition.compressibility}</p>
                </div>
              </section>

              {/* 2. Bearing Suitability */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">2. Bearing Suitability</h3>
                <div className="text-sm">
                  <p>Allowable Bearing: {summary.bearingSuitability.allowable || 'Not available'} kPa</p>
                  <p>Suitability: <span className="font-bold">{summary.bearingSuitability.status}</span></p>
                  <p className="text-xs text-zinc-500">{summary.bearingSuitability.note}</p>
                </div>
              </section>

              {/* 3. Lateral Pressure Concern */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">3. Lateral Pressure Concern</h3>
                <div className="text-sm">
                  <p>Pressure State: {summary.lateralPressure.state}</p>
                  <p>Coefficient: {summary.lateralPressure.coefficient}</p>
                  <p>Loading Concern: <span className="font-bold">{summary.lateralPressure.loadingConcern}</span></p>
                </div>
              </section>

              {/* 4. Settlement Concern */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">4. Settlement Concern</h3>
                <div className="text-sm">
                  <p>Concern: <span className="font-bold">{summary.settlement.concern}</span></p>
                  <p>Differential Concern: {summary.settlement.differentialConcern}</p>
                  <p className="text-xs text-zinc-500">{summary.settlement.explanation}</p>
                </div>
              </section>

              {/* 5. Slope / Wall Stability Concern */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">5. Slope / Wall Stability Concern</h3>
                <div className="text-sm">
                  <p>Retaining Wall Result: {summary.stability.wallResult}</p>
                  <p>Slope Concern: {summary.stability.slopeConcern}</p>
                  <p>Controlling Issue: {summary.stability.controllingIssue}</p>
                </div>
              </section>

              {/* 6. Monitoring / Review Suggestion */}
              <section>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-2">6. Monitoring / Review Suggestion</h3>
                <ul className="text-sm list-disc list-inside">
                  {summary.monitoring.map(m => <li key={m}>{m}</li>)}
                </ul>
              </section>

              {/* 7. Engineering Interpretation */}
              <section className="rounded-xl bg-[var(--module-accent-bg)] p-4 border border-[var(--module-accent)] border-opacity-20">
                <h3 className="text-xs font-bold uppercase text-[var(--module-accent)] mb-2">7. Engineering Interpretation</h3>
                <p className="text-sm font-medium text-zinc-800">{summary.interpretation}</p>
                <p className="text-[10px] text-zinc-600 opacity-80 mt-2 italic">Indicative / preliminary assessment only. Final design requires engineering verification.</p>
              </section>
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
