import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { locationRepo, Location } from '../repositories/locationRepo';
import { engineeringDataService, EngineeringSnapshot } from '../services/engineeringDataService';
import { actionRepo } from '../repositories/actionRepo';
import { mediaRepo } from '../repositories/mediaRepo';
import { getSoilEngineeringSummary, SoilEngineeringSummary } from '../engineering/soilEngineeringBrain';
import { getActiveProjectId } from '../state/activeProject';
import { locationJudgementRepo, LocationJudgement } from '../repositories/locationJudgementRepo';
import { Loader2, Brain, Camera, AlertCircle, FileText, Waves, Save } from 'lucide-react';
import { formatLocationShort } from '../utils/formatters';
import { ReviewSurfaceHeader } from '../components/ReviewSurfaceHeader';
import { ROUTES, locationTimelineRoute } from '../routes';

export const LocationOverview: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const activeProjectId = getActiveProjectId();
  const [location, setLocation] = useState<Location | null>(null);
  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);
  const [soilSummary, setSoilSummary] = useState<SoilEngineeringSummary | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [judgement, setJudgement] = useState<Partial<LocationJudgement>>({
    status: 'Normal',
    concern_note: '',
    recommended_step: '',
    include_in_handover: 0
  });

  useEffect(() => {
    if (locationId && activeProjectId) {
      const loc = locationRepo.getById(locationId);
      if (loc) {
        setLocation(loc);
        setSnapshot(engineeringDataService.getEngineeringSnapshotByLocation(locationId));
        getSoilEngineeringSummary(activeProjectId, locationId).then(setSoilSummary);

        setActions(actionRepo.listOpenByLocation(locationId));
        setPhotoCount(mediaRepo.countByLocation(locationId));

        const savedJudgement = locationJudgementRepo.getByLocationId(locationId);
        if (savedJudgement) {
          setJudgement(savedJudgement);
        }
      }
      setLoading(false);
    }
  }, [locationId, activeProjectId]);

  const handleSaveJudgement = async () => {
    if (!locationId) return;
    await locationJudgementRepo.upsert({
      location_id: locationId,
      status: judgement.status as any,
      concern_note: judgement.concern_note || '',
      recommended_step: judgement.recommended_step || '',
      include_in_handover: judgement.include_in_handover ? 1 : 0
    });
    alert('Judgement saved.');
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;
  if (!location) return <div className="p-4">Location not found.</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title={`Overview: ${formatLocationShort(location)}`} />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          
          {/* Header Section */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h1 className="text-2xl font-bold text-zinc-900">{formatLocationShort(location)}</h1>
            <p className="text-sm text-zinc-500">{location.description || 'No description available'}</p>
          </div>

          <ReviewSurfaceHeader
            badge="Location review"
            title="Combined field logging and engineering review for this location"
            subtitle="Use this page to review current observations, engineering summaries and next-step judgement before handover."
          />

          {/* Rock Engineering Summary */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2"><Brain size={20} /> Rock engineering status</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Q-Value</span>
                <div className="text-sm font-bold text-zinc-800">{snapshot?.q?.toFixed(2) || 'Not available'}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">RMR</span>
                <div className="text-sm font-bold text-zinc-800">{snapshot?.rmr || 'Not available'}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">GSI</span>
                <div className="text-sm font-bold text-zinc-800">{snapshot?.gsi_mid || 'Not available'}</div>
              </div>
            </div>
          </div>

          {/* Soil Engineering Summary */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2"><Waves size={20} /> Soil engineering status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bearing Capacity</span>
                <div className="text-sm font-bold text-zinc-800">{soilSummary?.bearingSuitability.allowable != null ? `${soilSummary.bearingSuitability.allowable.toFixed(0)} kPa` : 'Not available'}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Earth Pressure</span>
                <div className="text-sm font-bold text-zinc-800">{soilSummary?.lateralPressure.state || 'Not available'}</div>
              </div>
            </div>
          </div>

          {(snapshot?.quick_log_summary || snapshot?.quick_log_review_required) && (
            <div className="rounded-2xl bg-amber-50 p-6 shadow-sm border border-amber-100">
              <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2"><AlertCircle size={20} /> Latest field observation / hazard</h2>
              <div className="flex flex-col gap-2 text-sm text-amber-950">
                <div><span className="font-bold">Trigger:</span> {snapshot?.quick_log_trigger || 'Field observation'}</div>
                {snapshot?.quick_log_risk_level && <div><span className="font-bold">Risk:</span> {snapshot.quick_log_risk_level}</div>}
                {snapshot?.quick_log_summary && <p>{snapshot.quick_log_summary}</p>}
                {snapshot?.quick_log_review_required && <div className="font-bold text-amber-800">Engineering review flagged from latest ET7 log.</div>}
                {snapshot?.quick_log_entry_id && (
                  <button onClick={() => navigate(`/entry/${snapshot.quick_log_entry_id}`)} className="mt-1 w-fit rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-700 border border-amber-200 hover:bg-amber-100">
                    Open latest hazard log
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Engineer Judgement Panel */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-indigo-100">
            <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2"><FileText size={20} /> Engineer judgement</h2>
            <div className="flex flex-col gap-4">
              <select 
                value={judgement.status} 
                onChange={(e) => setJudgement(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
              >
                <option value="Normal">Normal</option>
                <option value="Monitor">Monitor</option>
                <option value="Review Required">Review Required</option>
                <option value="Action Required">Action Required</option>
              </select>
              <textarea 
                value={judgement.concern_note}
                onChange={(e) => setJudgement(prev => ({ ...prev, concern_note: e.target.value }))}
                placeholder="Concern note..."
                className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
              />
              <textarea 
                value={judgement.recommended_step}
                onChange={(e) => setJudgement(prev => ({ ...prev, recommended_step: e.target.value }))}
                placeholder="Recommended next step..."
                className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                <input 
                  type="checkbox" 
                  checked={!!judgement.include_in_handover}
                  onChange={(e) => setJudgement(prev => ({ ...prev, include_in_handover: e.target.checked ? 1 : 0 }))}
                />
                Include in Handover
              </label>
              <button onClick={handleSaveJudgement} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-white font-bold text-sm">
                <Save size={16} /> Save Judgement
              </button>
              {judgement.updated_at && <span className="text-[10px] text-zinc-400">Last updated: {new Date(judgement.updated_at).toLocaleString()}</span>}
            </div>
          </div>

          {/* Actions & Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2"><AlertCircle size={20} /> Open Actions ({actions.length})</h2>
              {actions.length > 0 ? (
                <ul className="space-y-2">
                  {actions.slice(0, 3).map(action => (
                    <li key={action.id} className="text-sm text-zinc-700 bg-zinc-50 p-2 rounded">{action.description}</li>
                  ))}
                </ul>
              ) : <div className="text-sm text-zinc-500">No open actions.</div>}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2"><Camera size={20} /> Photos ({photoCount})</h2>
              <button onClick={() => navigate('/photo-gallery')} className="text-sm text-emerald-600 font-bold">View Gallery</button>
            </div>
          </div>

            {/* Navigation Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => navigate(locationTimelineRoute(locationId!))} className="col-span-2 md:col-span-4 rounded-xl bg-emerald-600 p-4 shadow-sm border border-emerald-700 text-sm font-bold text-white hover:bg-emerald-700">Open location timeline</button>
            <button onClick={() => navigate(ROUTES.quickLog, { state: { projectId: activeProjectId, locationId } })} className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-sm font-bold text-zinc-800 hover:bg-zinc-50">New quick log</button>
            <button onClick={() => navigate(ROUTES.mapping, { state: { projectId: activeProjectId, locationId } })} className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-sm font-bold text-zinc-800 hover:bg-zinc-50">New mapping</button>
            <button onClick={() => navigate(ROUTES.investigationLog, { state: { projectId: activeProjectId, locationId } })} className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-sm font-bold text-zinc-800 hover:bg-zinc-50">New investigation</button>
            <button onClick={() => navigate(ROUTES.records)} className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-sm font-bold text-zinc-800 hover:bg-zinc-50">Open records</button>
          </div>

        </div>
      </div>
    </div>
  );
};

