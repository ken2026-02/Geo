import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { query } from '../db/db';
import { Camera, AlertTriangle } from 'lucide-react';
import { engineeringDataService, EngineeringSnapshot } from '../services/engineeringDataService';
import { getEngineeringSummary, EngineeringSummary } from '../engineering/rockEngineeringBrain';
import { ReviewSurfaceHeader } from '../components/ReviewSurfaceHeader';

export default function RockEngineeringDashboard() {
  const [projectId, setProjectId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');

  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);
  const [summary, setSummary] = useState<EngineeringSummary | null>(null);
  const [actionCount, setActionCount] = useState<number>(0);
  const [photoCount, setPhotoCount] = useState<number>(0);

  useEffect(() => {
    if (!projectId || !locationId) {
      setSnapshot(null);
      setSummary(null);
      setActionCount(0);
      setPhotoCount(0);
      return;
    }

    const data = engineeringDataService.getEngineeringSnapshotByLocation(locationId);
    setSnapshot(data);
    getEngineeringSummary(projectId, locationId).then(setSummary);

    const actions = query<any>(`
      SELECT COUNT(*) as count FROM actions a
      JOIN entries e ON a.entry_id = e.id
      WHERE e.project_id = ? AND e.location_id = ? AND a.is_closed = 0 AND e.is_deleted = 0
    `, [projectId, locationId]);
    setActionCount(actions[0]?.count || 0);

    const photos = query<any>(`
      SELECT COUNT(*) as count FROM media_metadata m
      JOIN entries e ON m.entry_id = e.id
      WHERE e.project_id = ? AND e.location_id = ? AND e.is_deleted = 0
    `, [projectId, locationId]);
    setPhotoCount(photos[0]?.count || 0);
  }, [projectId, locationId]);

  const formatQ = (val: number | null) => {
    if (val === null || isNaN(val)) return 'Not available';
    return `Q = ${val.toFixed(2)}`;
  };

  const formatRMR = (val: number | null) => {
    if (val === null || isNaN(val)) return 'Not available';
    return `RMR = ${val}`;
  };

  const formatGSI = (val: number | null, range: { min: number; max: number } | null) => {
    if (val === null || isNaN(val)) return 'Not available';
    return (
      <div className="flex flex-col">
        <span>GSI = {val}</span>
        {range && <span className="text-[10px] text-zinc-500">Range: {range.min}-{range.max}</span>}
      </div>
    );
  };

  return (
    <div className="theme-rock-engineering-dashboard flex min-h-screen flex-col bg-gray-50">
      <PageHeader title="Rock Engineering Dashboard" />

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
            <ProjectSelector
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                setLocationId('');
              }}
            />
            <LocationSelector value={locationId} onChange={(id) => setLocationId(id)} />
          </div>

          {!projectId || !locationId ? (
            <div className="text-center text-sm text-zinc-500 py-10">
              Select a project and location to view the dashboard.
            </div>
          ) : (
            <>
              <ReviewSurfaceHeader
                badge="Location review"
                title="Shift-ready engineering status for the selected location"
                subtitle="Use this page for location review, support checks and shift follow-up."
              />

              <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">Q-System</span>
                <span className="text-lg font-bold text-zinc-900">{formatQ(snapshot?.q || null)}</span>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">RMR</span>
                <span className="text-lg font-bold text-zinc-900">{formatRMR(snapshot?.rmr || null)}</span>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">GSI</span>
                <div className="text-lg font-bold text-zinc-900">{formatGSI(snapshot?.gsi_mid || null, snapshot?.gsi_range || null)}</div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">Structural Hazard</span>
                <span className="text-sm font-bold text-zinc-900">{summary?.structuralHazard.failureMode || snapshot?.structural_mode || 'Not available'}</span>
                <span className="text-xs text-zinc-500">Hazard: {summary?.structuralHazard.hazardLevel || snapshot?.structural_hazard || 'Not available'}</span>
                {summary?.latestWedge && (
                  <span className="text-xs text-zinc-500">{summary.latestWedge}</span>
                )}
              </div>

              <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2 border-l-4 border-red-500">
                <span className="text-xs font-bold text-zinc-500 uppercase">Latest Wedge Screening</span>
                <span className="text-lg font-bold text-zinc-900">
                  {snapshot?.wedge_stability_class || 'No wedge FoS saved'}
                </span>
                {snapshot?.wedge_controlling_pair && (
                  <span className="text-sm text-zinc-700">{snapshot.wedge_controlling_pair}</span>
                )}
                {(snapshot?.wedge_trend != null || snapshot?.wedge_plunge != null) && (
                  <span className="text-xs text-zinc-500">
                    Trend / Plunge: {snapshot?.wedge_trend != null ? Math.round(snapshot.wedge_trend) : '-'} / {snapshot?.wedge_plunge != null ? Math.round(snapshot.wedge_plunge) : '-'}
                  </span>
                )}
                {snapshot?.wedge_risk_class && <span className="text-xs text-zinc-500">Risk: {snapshot.wedge_risk_class}</span>}
                {snapshot?.wedge_action_level && <span className="text-xs text-zinc-500">Action: {snapshot.wedge_action_level}</span>}
                {snapshot?.wedge_support_recommendation && <span className="text-xs text-zinc-500">Support: {snapshot.wedge_support_recommendation}</span>}
                {snapshot?.wedge_review_required && <span className="text-xs font-bold text-red-600">Geotechnical review required</span>}
              </div>

              <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2 border-l-4 border-emerald-500">
                <span className="text-xs font-bold text-zinc-500 uppercase">Field Support</span>
                <span className="text-lg font-bold text-zinc-900">{summary?.indicativeSupport || snapshot?.wedge_support_recommendation || snapshot?.support_class || 'Not available'}</span>
                {snapshot?.support_class && summary?.indicativeSupport && snapshot.support_class !== summary.indicativeSupport && (
                  <span className="text-xs text-zinc-500">Latest saved support entry: {snapshot.support_class}</span>
                )}
              </div>


              {(snapshot?.quick_log_summary || snapshot?.quick_log_review_required) && (
                <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2 border-l-4 border-amber-500">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Latest field observation / hazard</span>
                  <span className="text-sm font-bold text-zinc-900">{snapshot?.quick_log_trigger || 'Field observation requiring review'}</span>
                  {snapshot?.quick_log_risk_level && (
                    <span className="text-xs text-zinc-500">Risk: {snapshot.quick_log_risk_level}</span>
                  )}
                  {snapshot?.quick_log_summary && (
                    <p className="text-sm text-zinc-700 leading-relaxed">{snapshot.quick_log_summary}</p>
                  )}
                  {snapshot?.quick_log_review_required && (
                    <span className="text-xs font-bold text-amber-700">Engineering review flagged from the latest field observation</span>
                  )}
                </div>
              )}

              {summary && (
                <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Engineering Summary</span>
                  <p className="text-sm text-zinc-700 leading-relaxed">{summary.interpretation}</p>
                </div>
              )}

              {summary && (
                <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100 col-span-2">
                  <h3 className="text-sm font-bold text-emerald-800 mb-4 uppercase tracking-wider">Shift actions</h3>
                  <div className="text-sm font-bold text-emerald-900 mb-3">{summary.fieldAction}</div>
                  <ul className="text-sm text-emerald-900 list-disc list-inside">
                    {summary.monitoring.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              )}

              <div className="col-span-2 flex gap-4 mt-2">
                <div className="flex-1 rounded-xl bg-orange-50 p-4 flex items-center gap-3">
                  <AlertTriangle className="text-orange-600" size={24} />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-orange-900">{actionCount}</span>
                    <span className="text-xs font-bold text-orange-700 uppercase">Open Actions</span>
                  </div>
                </div>
                <div className="flex-1 rounded-xl bg-blue-50 p-4 flex items-center gap-3">
                  <Camera className="text-blue-600" size={24} />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-blue-900">{photoCount}</span>
                    <span className="text-xs font-bold text-blue-700 uppercase">Photos</span>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
