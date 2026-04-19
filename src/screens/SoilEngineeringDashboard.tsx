import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { getSoilEngineeringSummary, SoilEngineeringSummary } from '../engineering/soilEngineeringBrain';
import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { Loader2, Brain, Camera, AlertTriangle } from 'lucide-react';

export const SoilEngineeringDashboard: React.FC = () => {
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [summary, setSummary] = useState<SoilEngineeringSummary | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [openActions, setOpenActions] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (locationId) {
      setLoading(true);
      const fetchData = async () => {
        const summaryData = await getSoilEngineeringSummary(projectId, locationId);
        setSummary(summaryData);
        setPhotoCount(soilEngineeringDataService.getPhotoCount(locationId));
        setOpenActions(soilEngineeringDataService.getOpenActions(locationId));
        setLoading(false);
      };
      fetchData();
    }
  }, [projectId, locationId]);

  return (
    <div className="theme-soil-engineering-dashboard flex flex-col h-screen bg-gray-50">
      <PageHeader title="Soil Engineering Dashboard" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
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
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Soil Condition */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Soil Condition</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <p>Group: {summary.soilCondition.group}</p>
                  <p>Consistency: {summary.soilCondition.consistency}</p>
                  <p>Moisture: {summary.soilCondition.moisture}</p>
                  <p>Compressibility: {summary.soilCondition.compressibility}</p>
                </div>
              </div>

              {/* Bearing */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Bearing</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Allowable: {summary.bearingSuitability.allowable || 'Not available'} kPa</p>
                  <p>Suitability: <span className="font-bold">{summary.bearingSuitability.status}</span></p>
                </div>
              </div>

              {/* Earth Pressure */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Earth Pressure</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>State: {summary.lateralPressure.state}</p>
                  <p>Coefficient: {summary.lateralPressure.coefficient}</p>
                  <p>Loading Concern: <span className="font-bold">{summary.lateralPressure.loadingConcern}</span></p>
                </div>
              </div>

              {/* Settlement */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Settlement</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Concern: <span className="font-bold">{summary.settlement.concern}</span></p>
                  <p>Differential: {summary.settlement.differentialConcern}</p>
                </div>
              </div>

              {/* Slope / Wall */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Slope / Wall</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Wall Result: {summary.stability.wallResult}</p>
                  <p>Slope Concern: {summary.stability.slopeConcern}</p>
                </div>
              </div>

              {/* Monitoring / Next Steps */}
              <div className="bg-emerald-50 p-6 rounded-xl shadow-sm border border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-800 mb-4 uppercase tracking-wider">Recommended Next Step</h3>
                <ul className="text-sm text-emerald-900 list-disc list-inside">
                  {summary.monitoring.map(m => <li key={m}>{m}</li>)}
                </ul>
              </div>

              {/* Engineering Interpretation */}
              <div className="bg-[var(--module-accent-bg)] p-6 rounded-xl shadow-sm border border-[var(--module-accent)] border-opacity-20 md:col-span-2">
                <h3 className="text-sm font-bold text-[var(--module-accent)] mb-4 uppercase tracking-wider">Engineering Interpretation</h3>
                <p className="text-sm text-zinc-800 italic">{summary.interpretation}</p>
              </div>

              {/* Stats */}
              <div className="col-span-2 flex gap-4">
                <div className="flex-1 rounded-xl bg-orange-50 p-4 flex items-center gap-3 border border-orange-100">
                  <AlertTriangle className="text-orange-600" size={24} />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-orange-900">{openActions}</span>
                    <span className="text-xs font-bold text-orange-700 uppercase">Open Actions</span>
                  </div>
                </div>
                <div className="flex-1 rounded-xl bg-blue-50 p-4 flex items-center gap-3 border border-blue-100">
                  <Camera className="text-blue-600" size={24} />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-blue-900">{photoCount}</span>
                    <span className="text-xs font-bold text-blue-700 uppercase">Photos</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-slate-500">Select a location to view soil engineering data.</div>
          )}
        </div>
      </div>
    </div>
  );
};
