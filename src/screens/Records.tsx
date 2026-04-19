import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { entryRepo } from '../repositories/entryRepo';
import { projectRepo, Project } from '../repositories/projectRepo';
import { refRepo } from '../repositories/refRepo';
import { getActiveProjectId } from '../state/activeProject';
import { Search, Filter, ChevronRight, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { formatLocationShort } from '../utils/formatters';
import { getEntryTypeLabel } from '../utils/entryTypes';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { entryDetailRoute, locationOverviewRoute, locationTimelineRoute } from '../routes';

export const Records: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entryTypes, setEntryTypes] = useState<{ id: string, label: string }[]>([]);
  const [riskLevels, setRiskLevels] = useState<{ id: string, label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string, label: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const [filters, setFilters] = useState({
    projectId: getActiveProjectId() || '',
    query: '',
    entryTypeId: '',
    riskLevelId: '',
    statusId: '',
    dateFrom: '',
    dateTo: ''
  });

  const [sortBy, setSortBy] = useState<'latest' | 'risk'>('latest');

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const [projs, types, risks, stats] = await Promise.all([
        projectRepo.list(),
        refRepo.getRefList('ref_entry_type'),
        refRepo.getRefList('ref_risk_level'),
        refRepo.getRefList('ref_status')
      ]);

      setProjects(projs);
      setEntryTypes(types);
      setRiskLevels(risks);
      setStatuses(stats);

      if (filters.projectId) {
        const results = entryRepo.listPaged({
          projectId: filters.projectId,
          limit: 100,
          offset: 0,
          query: filters.query,
          entryTypeId: filters.entryTypeId,
          riskLevelId: filters.riskLevelId,
          statusId: filters.statusId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo
        });
        setEntries(results);
      }
    } catch (err) {
      console.error('Error loading records:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } else {
      // Risk weight sort (assuming R4 > R3 > R2 > R1)
      const weight = (id: string) => parseInt(id.replace('R', '')) || 0;
      return weight(b.risk_level_id) - weight(a.risk_level_id);
    }
  });

  if (timedOut) {
    return (
      <Layout title="Timeout" showBack>
        <div className="p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Project Records" showBack>
      <div className="flex flex-col gap-4 p-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Search summary or chainage..."
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              className="w-full rounded-xl bg-zinc-50 py-3 pl-10 pr-4 text-sm font-medium text-zinc-800 border border-zinc-100"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 border-none"
            >
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <select
              value={filters.entryTypeId}
              onChange={(e) => setFilters({ ...filters, entryTypeId: e.target.value })}
              className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 border-none"
            >
              <option value="">All Types</option>
              {entryTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            <select
              value={filters.riskLevelId}
              onChange={(e) => setFilters({ ...filters, riskLevelId: e.target.value })}
              className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 border-none"
            >
              <option value="">All Risks</option>
              {riskLevels.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>

            <select
              value={filters.statusId}
              onChange={(e) => setFilters({ ...filters, statusId: e.target.value })}
              className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 border-none"
            >
              <option value="">All Status</option>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-50 pt-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSortBy('latest')}
                className={`text-[10px] font-bold uppercase ${sortBy === 'latest' ? 'text-emerald-600' : 'text-zinc-400'}`}
              >
                Latest
              </button>
              <button
                onClick={() => setSortBy('risk')}
                className={`text-[10px] font-bold uppercase ${sortBy === 'risk' ? 'text-emerald-600' : 'text-zinc-400'}`}
              >
                Risk
              </button>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase">{sortedEntries.length} Records</span>
          </div>
        </div>

        {/* Records List */}
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
              <AlertTriangle className="mx-auto text-zinc-300 mb-2" size={32} />
              <p className="text-sm font-bold text-zinc-400">No records found matching filters.</p>
            </div>
          ) : (
            sortedEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-white p-4 text-left shadow-sm border border-zinc-100">
                <button
                  onClick={() => navigate(entryDetailRoute(entry.id))}
                  className="flex w-full items-center justify-between transition-transform active:scale-[0.98]"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{formatLocationShort(entry)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        entry.risk_level_id === 'R4' ? 'bg-red-100 text-red-600' :
                        entry.risk_level_id === 'R3' ? 'bg-orange-100 text-orange-600' :
                        entry.risk_level_id === 'R2' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {entry.risk_label}
                      </span>
                    </div>
                    <span className="font-bold text-zinc-800 leading-tight">
                      {getEntryTypeLabel(entry.entry_type_id)}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(entry.timestamp).toLocaleDateString()}</span>
                      {entry.media_count > 0 && <span className="font-bold text-emerald-600">{entry.media_count} Photos</span>}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-zinc-300" />
                </button>
                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
                  <button
                    onClick={() => navigate(entryDetailRoute(entry.id))}
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    Open Entry
                  </button>
                  <button
                    onClick={() => navigate(locationOverviewRoute(entry.location_id))}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-700 hover:bg-emerald-100"
                  >
                    Location Review
                  </button>
                  <button
                    onClick={() => navigate(locationTimelineRoute(entry.location_id))}
                    className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase text-indigo-700 hover:bg-indigo-100"
                  >
                    Timeline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};
