import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { entryRepo } from '../repositories/entryRepo';
import { actionRepo } from '../repositories/actionRepo';
import { locationJudgementRepo } from '../repositories/locationJudgementRepo';
import { query } from '../db/db';
import { formatLocationShort } from '../utils/formatters';
import { Clock, FileText, Image as ImageIcon, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { ReviewSurfaceHeader } from '../components/ReviewSurfaceHeader';
import { ROUTES, locationOverviewRoute, entryDetailRoute } from '../routes';
import { getActiveProjectId } from '../state/activeProject';

type FilterType = 'All' | 'Logs' | 'Rock' | 'Soil' | 'Photos' | 'Actions' | 'Judgements';

export const LocationTimeline: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('All');
  const projectId = getActiveProjectId();

  const timelineItems = useMemo(() => {
    if (!locationId || !projectId) return [];

    const entries = entryRepo.listByLocation(projectId, locationId);
    const actions = query<any>(`
        SELECT a.*, e.timestamp as timestamp, e.id as entry_id
        FROM actions a
        JOIN entries e ON a.entry_id = e.id
        WHERE e.location_id = ? AND e.is_deleted = 0
    `, [locationId]);
    const judgements = [locationJudgementRepo.getByLocationId(locationId)].filter(Boolean);

    const items: any[] = [];

    entries.forEach(e => {
        items.push({
            id: e.id,
            type: ['ET13', 'ET14', 'ET15'].includes(e.entry_type_id) ? 'Rock' : 
                  ['ET18', 'ET19', 'ET20', 'ET22', 'ET23'].includes(e.entry_type_id) ? 'Soil' : 'Logs',
            timestamp: e.timestamp,
            title: e.type_label,
            summary: e.summary,
            icon: FileText,
            link: entryDetailRoute(e.id)
        });
        if (e.media_count > 0) {
            items.push({
                id: `photo-${e.id}`,
                type: 'Photos',
                timestamp: e.timestamp,
                title: 'Photos',
                summary: `${e.media_count} photos`,
                icon: ImageIcon,
                link: entryDetailRoute(e.id)
            });
        }
    });

    actions.forEach(a => {
        items.push({
            id: a.id,
            type: 'Actions',
            timestamp: a.due_date,
            title: 'Action Item',
            summary: a.description,
            icon: CheckCircle2,
            link: `/entry/${a.entry_id}`
        });
    });

    judgements.forEach(j => {
        if (j) {
            items.push({
                id: j.id,
                type: 'Judgements',
                timestamp: j.updated_at,
                title: 'Engineering Judgement',
                summary: j.concern_note,
                icon: AlertTriangle,
                link: locationOverviewRoute(locationId)
            });
        }
    });

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [locationId, projectId]);

  const filteredItems = useMemo(() => {
    if (filter === 'All') return timelineItems;
    return timelineItems.filter(i => i.type === filter);
  }, [timelineItems, filter]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PageHeader title="Location Timeline" />
      <div className="p-4 pb-0">
        <ReviewSurfaceHeader
          badge="Timeline review"
          title="Chronological field, action and judgement review for this location"
          subtitle="Use filters to review logs, actions, photos and engineering updates in time order."
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex gap-2 overflow-x-auto">
        {(['All', 'Logs', 'Rock', 'Soil', 'Photos', 'Actions', 'Judgements'] as FilterType[]).map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-bold ${filter === f ? 'bg-emerald-600 text-white' : 'bg-white text-zinc-600 border border-zinc-200'}`}
          >
            {f}
          </button>
        ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => navigate(locationOverviewRoute(locationId!))} className="rounded-full bg-white px-3 py-2 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Location Review</button>
          <button onClick={() => navigate(ROUTES.records)} className="rounded-full bg-white px-3 py-2 text-[10px] font-bold uppercase text-zinc-700 border border-zinc-200 hover:bg-zinc-50">Records</button>
        </div>
      </div>
      <div className="flex-1 p-4 pb-20">
        <div className="flex flex-col gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-start gap-4">
              <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                <item.icon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-800">{item.title}</span>
                    <span className="text-[10px] text-zinc-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-zinc-600 mt-1">{item.summary}</p>
                <button onClick={() => navigate(item.link)} className="mt-3 text-[10px] font-bold text-emerald-600 uppercase">View</button>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <div className="text-center p-8 text-zinc-400 text-sm">No activities found.</div>}
        </div>
      </div>
    </div>
  );
};
