import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { entryRepo } from '../repositories/entryRepo';
import { locationRepo, Location } from '../repositories/locationRepo';
import { getActiveProjectId } from '../state/activeProject';
import { ChevronRight, Calendar, Camera, MapPin, Clock, Briefcase, AlertCircle, CheckCircle2, Camera as CameraIcon, Loader2, Edit2, Trash2, GitMerge, Activity, Hammer, FileText } from 'lucide-react';
import { getEntryTypeLabel } from '../utils/entryTypes';
import { actionRepo } from '../repositories/actionRepo';
import { mediaRepo } from '../repositories/mediaRepo';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { formatLocationShort } from '../utils/formatters';
import { engineeringDataService, EngineeringSnapshot } from '../services/engineeringDataService';
import { getSoilEngineeringSummary, SoilEngineeringSummary } from '../engineering/soilEngineeringBrain';

export const LocationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeProjectId = getActiveProjectId();

  const [location, setLocation] = useState<Location | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [openActionCount, setOpenActionCount] = useState(0);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [allLocations, setAllLocations] = useState<Location[]>([]);

  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);
  const [soilSummary, setSoilSummary] = useState<SoilEngineeringSummary | null>(null);

  const loadData = async () => {
    if (!activeProjectId || !id) return;
    setLoading(true);
    setTimedOut(false);
    
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const loc = locationRepo.getById(id);
      if (loc) {
        setLocation(loc);
      }
      
      const results = entryRepo.listByLocation(activeProjectId, id);
      setEntries(results);
      setOpenActionCount(actionRepo.listOpenByLocation(id).length);

      // Fetch Engineering Summaries via Service
      setSnapshot(engineeringDataService.getEngineeringSnapshotByLocation(id));
      setSoilSummary(await getSoilEngineeringSummary(activeProjectId, id));

    } catch (err) {
      console.error(err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProjectId, id]);

  const handleDelete = async () => {
    if (!id) return;
    if (entries.length > 0) {
      setShowDeleteModal(true);
    } else {
      if (window.confirm('Are you sure you want to delete this location?')) {
        await locationRepo.softDeleteLocation(id);
        window.dispatchEvent(new Event('entries-changed'));
        navigate('/locations');
      }
    }
  };

  const handleMergeClick = () => {
    setAllLocations(locationRepo.getAll().filter(l => l.id !== id));
    setShowMergeModal(true);
  };

  const executeMerge = async () => {
    if (!id || !mergeTargetId) return;
    await locationRepo.mergeLocation(id, mergeTargetId);
    window.dispatchEvent(new Event('entries-changed'));
    setShowMergeModal(false);
    navigate(`/location/${mergeTargetId}`);
  };

  const formatQ = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `Q = ${val.toFixed(2)}`;
  };

  const formatRMR = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `RMR = ${val}`;
  };

  const formatGSI = (val: number | null, range: { min: number; max: number } | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `GSI = ${val}${range ? ` (Range: ${range.min}â€?{range.max})` : ''}`;
  };

  const latestRisk = entries.length > 0 ? entries[0].risk_label : 'N/A';
  const totalPhotos = id ? mediaRepo.countByLocation(id) : 0;

  if (timedOut) {
    return (
      <Layout title="Timeout" showBack>
        <div className="p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </Layout>
    );
  }

  if (!activeProjectId) {
    return (
      <Layout title="Location Detail" showBack>
        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400">
            <Briefcase size={40} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-zinc-800">No Active Project</h2>
            <p className="max-w-xs text-sm text-zinc-500">
              Please select or create a project to view its locations.
            </p>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="rounded-xl bg-zinc-900 px-8 py-3 font-bold text-white shadow-lg"
          >
            Go to Projects
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Location Detail" showBack>
      <div className="flex flex-col gap-6">
        {/* Header Info */}
        <div className="flex flex-col gap-1 rounded-2xl bg-white p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Location</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`/location-overview/${id}`)}
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100"
              >
                <FileText size={12} />
                Overview
              </button>
              <button 
                onClick={() => navigate(`/location/edit/${id}`)}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-200"
              >
                <Edit2 size={12} />
                Edit
              </button>
              <button 
                onClick={handleMergeClick}
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100"
              >
                <GitMerge size={12} />
                Merge
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
          <h2 className="text-lg font-bold text-zinc-800">{location ? formatLocationShort(location) : 'Unknown Location'}</h2>
          {location?.description && (
            <p className="text-sm text-zinc-500">{location.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500">
              {entries.length} Record{entries.length !== 1 ? 's' : ''} in this project
            </span>
          </div>
        </div>

        {/* Location Summary Panel */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white p-3 shadow-sm border border-zinc-100">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Latest Risk</span>
            <span className={`text-xs font-bold ${
              latestRisk === 'Critical' ? 'text-red-600' :
              latestRisk === 'High' ? 'text-orange-600' :
              latestRisk === 'Medium' ? 'text-yellow-600' :
              'text-zinc-600'
            }`}>
              {latestRisk}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white p-3 shadow-sm border border-zinc-100">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Open Actions</span>
            <div className="flex items-center gap-1">
              <AlertCircle size={10} className={openActionCount > 0 ? 'text-orange-500' : 'text-zinc-300'} />
              <span className="text-xs font-bold text-zinc-800">{openActionCount}</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white p-3 shadow-sm border border-zinc-100">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Photos</span>
            <div className="flex items-center gap-1">
              <CameraIcon size={10} className="text-indigo-500" />
              <span className="text-xs font-bold text-zinc-800">{totalPhotos}</span>
            </div>
          </div>
        </div>


        {/* Latest Field Observation / Hazard */}
        <div className="flex flex-col gap-4">
          <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <AlertCircle size={12} /> Latest Field Observation / Hazard
          </h3>
          {!snapshot?.quick_log_summary ? (
            <div className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-center text-xs text-zinc-400 italic">
              No latest quick hazard log recorded.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Latest field observation / hazard</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                  {snapshot.quick_log_risk_level || 'Risk not set'}
                </span>
              </div>
              {snapshot.quick_log_trigger && (
                <div className="text-xs text-amber-900"><span className="font-bold">Trigger:</span> {snapshot.quick_log_trigger}</div>
              )}
              <p className="text-sm text-amber-950">{snapshot.quick_log_summary}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-amber-800">
                  {snapshot.quick_log_review_required ? 'Engineering review flagged on latest shift.' : 'No additional review flag on latest shift.'}
                </span>
                {snapshot.quick_log_entry_id && (
                  <button
                    onClick={() => navigate(`/entry/${snapshot.quick_log_entry_id}`)}
                    className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-amber-700 border border-amber-200 hover:bg-amber-100"
                  >
                    View log
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Soil Engineering Summary */}
        <div className="flex flex-col gap-4">
          <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <FileText size={12} /> Soil Engineering Summary
          </h3>
          {!soilSummary ? (
            <div className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-center text-xs text-zinc-400 italic">
              No soil engineering summary available.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Ground Model</span>
                  <span className="text-sm font-bold text-zinc-800">{soilSummary.soilCondition.group}</span>
                  <span className="text-[11px] text-zinc-500">{soilSummary.soilCondition.moisture} / {soilSummary.soilCondition.compressibility}</span>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Bearing</span>
                  <span className="text-sm font-bold text-zinc-800">{soilSummary.bearingSuitability.status}</span>
                  <span className="text-[11px] text-zinc-500">{soilSummary.bearingSuitability.allowable != null ? `${soilSummary.bearingSuitability.allowable.toFixed(0)} kPa` : 'No allowable value'}</span>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Settlement</span>
                  <span className="text-sm font-bold text-zinc-800">{soilSummary.settlement.concern}</span>
                  <span className="text-[11px] text-zinc-500">{soilSummary.settlement.differentialConcern}</span>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Soil Stability</span>
                  <span className="text-sm font-bold text-zinc-800">{soilSummary.stability.slopeConcern}</span>
                  <span className="text-[11px] text-zinc-500">{soilSummary.stability.controllingIssue}</span>
                </div>
              </div>
              <div className="rounded-xl bg-stone-50 p-4 shadow-sm border border-stone-100 flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">Field interpretation</span>
                <p className="text-sm text-stone-800">{soilSummary.interpretation}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {soilSummary.monitoring.map((item) => (
                    <span key={item} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-stone-700 border border-stone-200">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rock Engineering Summary */}
        <div className="flex flex-col gap-4">
          <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <Activity size={12} /> Rock Engineering Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Q-System</span>
              <span className="text-sm font-bold text-zinc-800">{snapshot ? formatQ(snapshot.q) : <span className="text-xs text-zinc-400 italic">No data</span>}</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">RMR</span>
              <span className="text-sm font-bold text-zinc-800">{snapshot ? formatRMR(snapshot.rmr) : <span className="text-xs text-zinc-400 italic">No data</span>}</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">GSI</span>
              <span className="text-sm font-bold text-zinc-800">{snapshot ? formatGSI(snapshot.gsi_mid, snapshot.gsi_range) : <span className="text-xs text-zinc-400 italic">No data</span>}</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm border border-zinc-100 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Structural</span>
              {snapshot?.structural_mode ? (
                <span className="text-sm font-bold text-zinc-800">{snapshot.structural_mode} <span className="text-[10px] font-normal text-zinc-500">({snapshot.structural_hazard} Hz)</span></span>
              ) : <span className="text-xs text-zinc-400 italic">No data</span>}
            </div>
          </div>
        </div>

        {/* Ground Support Summary */}
        <div className="flex flex-col gap-4">
          <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <Hammer size={12} /> Ground Support Summary
          </h3>
          {!snapshot?.support_class ? (
            <div className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100 text-center text-xs text-zinc-400 italic">
              No support design recorded.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 shadow-sm border border-emerald-100 flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Latest Support Summary</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-emerald-900">
                  <div><span className="font-bold">Class:</span> {snapshot.support_class}</div>
                  <div><span className="font-bold">Source:</span> Latest ET16 / ET17 entry</div>
                  {snapshot.wedge_support_recommendation && (
                    <div className="col-span-2"><span className="font-bold">Wedge Support:</span> {snapshot.wedge_support_recommendation}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-4">
          <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Timeline</h3>
          {loading ? (
            <div className="py-10 text-center text-zinc-400">Loading timeline...</div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-10 text-center text-zinc-400">
              No records found for this location in the current project.
            </div>
          ) : (
            <div className="relative flex flex-col gap-4 pl-4">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-zinc-100" />
              
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/entry/${entry.id}`)}
                  className="relative flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
                >
                  {/* Dot */}
                  <div className="absolute -left-[21px] top-5 h-2 w-2 rounded-full border-2 border-white bg-zinc-300 ring-4 ring-zinc-50" />
                  
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      entry.risk_label === 'Critical' ? 'bg-red-100 text-red-600' :
                      entry.risk_label === 'High' ? 'bg-orange-100 text-orange-600' :
                      entry.risk_label === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {entry.risk_label}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
                      <Clock size={12} />
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-800">
                      {getEntryTypeLabel(entry.entry_type_id)}
                    </span>
                    {entry.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {entry.summary}
                      </p>
                    )}
                  </div>

                  {entry.media_count > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <Camera size={12} />
                      {entry.media_count} Photo{entry.media_count > 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-zinc-900">Cannot Delete Location</h3>
            <p className="mb-6 text-sm text-zinc-500">
              This location contains existing records. Merge into another location or soft delete.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  handleMergeClick();
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Merge Location
              </button>
              <button
                onClick={async () => {
                  setShowDeleteModal(false);
                  if (window.confirm('Are you sure you want to soft delete this location? Its records will still exist but the location will be hidden.')) {
                    await locationRepo.softDeleteLocation(id!);
                    window.dispatchEvent(new Event('entries-changed'));
                    navigate('/locations');
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Soft Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-zinc-900">Merge Location</h3>
            <p className="mb-4 text-sm text-zinc-500">
              Select a target location to merge all records into. This location will be deleted.
            </p>
            <div className="mb-6 flex flex-col gap-2">
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select target location...</option>
                {allLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationShort(loc)} {loc.description ? `(${loc.description})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMergeModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={executeMerge}
                disabled={!mergeTargetId}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};



