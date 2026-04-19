import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { locationRepo } from '../repositories/locationRepo';
import { getActiveProjectId } from '../state/activeProject';
import { Search, ChevronRight, MapPin, Clock, Camera, Briefcase } from 'lucide-react';
import { formatLocationShort } from '../utils/formatters';

export const Locations: React.FC = () => {
  const navigate = useNavigate();
  const activeProjectId = getActiveProjectId();

  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const results = locationRepo.listLocationsForProject(activeProjectId);
      setClusters(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  const filteredClusters = useMemo(() => {
    if (!searchQuery) return clusters;
    const q = searchQuery.toLowerCase();
    return clusters.filter((c) => {
      const label = `${c.chainage_start} ${c.chainage_end} ${c.side} ${c.position}`.toLowerCase();
      return label.includes(q);
    });
  }, [clusters, searchQuery]);

  if (!activeProjectId) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Locations" />
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-6 py-20 text-center">
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
      </div>
    );
  }

  const getRiskColor = (weight: number) => {
    if (weight >= 100) return 'bg-red-100 text-red-600';
    if (weight >= 80) return 'bg-orange-100 text-orange-600';
    if (weight >= 60) return 'bg-yellow-100 text-yellow-600';
    if (weight >= 40) return 'bg-emerald-100 text-emerald-600';
    return 'bg-zinc-100 text-zinc-600';
  };

  const getRiskLabel = (weight: number) => {
    if (weight >= 100) return 'Critical';
    if (weight >= 80) return 'High';
    if (weight >= 60) return 'Medium';
    if (weight >= 40) return 'Low';
    return 'N/A';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Locations" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Search chainage, side, position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-10 text-center text-zinc-400">Loading locations...</div>
          ) : filteredClusters.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-10 text-center text-zinc-400">
              No locations found for this project.
            </div>
          ) : (
            filteredClusters.map((cluster) => (
              <div
                key={cluster.id}
                className="rounded-2xl border border-zinc-100 bg-white p-4 text-left shadow-sm"
              >
                <button
                  onClick={() => navigate(`/location/${cluster.id}`)}
                  className="flex w-full items-center justify-between transition-transform active:scale-[0.98]"
                >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400">
                      <MapPin size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-800">
                        {formatLocationShort(cluster)}
                      </span>
                      {cluster.description && (
                        <span className="text-[10px] text-zinc-500">{cluster.description}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getRiskColor(cluster.max_risk_weight)}`}>
                      {getRiskLabel(cluster.max_risk_weight)}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                      {cluster.entry_count} Record{cluster.entry_count > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {cluster.last_entry_ts && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
                        <Clock size={12} />
                        {new Date(cluster.last_entry_ts).toLocaleDateString()}
                      </div>
                    )}
                    {cluster.photo_count > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <Camera size={12} />
                        {cluster.photo_count} Photo{cluster.photo_count > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                  <ChevronRight size={20} className="text-zinc-300" />
                </button>
                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
                  <button onClick={() => navigate(`/location/${cluster.id}`)} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Details</button>
                  <button onClick={() => navigate(`/location-overview/${cluster.id}`)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-700 hover:bg-emerald-100">Review</button>
                  <button onClick={() => navigate(`/location-timeline/${cluster.id}`)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase text-indigo-700 hover:bg-indigo-100">Timeline</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
