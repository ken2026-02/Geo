import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { mediaRepo, MediaItem } from '../repositories/mediaRepo';
import { entryRepo, Entry } from '../repositories/entryRepo';
import { projectRepo, Project } from '../repositories/projectRepo';
import { formatLocationShort } from '../utils/formatters';
import { Image as ImageIcon, Calendar, Briefcase, Filter, ChevronRight, Loader2 } from 'lucide-react';
import { getBlob } from '../media/mediaStore';
import { TimeoutSafety } from '../components/TimeoutSafety';

export const PhotoGallery: React.FC = () => {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<(MediaItem & { entry: any, url?: string })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setProjects(projectRepo.getAll());
    loadPhotos();
  }, [selectedProject, selectedDate]);

  const loadPhotos = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      let allMedia: (MediaItem & { entry: any, url?: string })[] = [];
      const entries = selectedProject === 'all' ? entryRepo.listRecent(1000) : entryRepo.listByProject(selectedProject);
      
      for (const entry of entries) {
        const media = mediaRepo.listByEntry(entry.id);
        for (const m of media) {
          if (selectedDate && !entry.timestamp.startsWith(selectedDate)) continue;
          
          const blob = await getBlob(m.blob_key);
          const url = blob ? URL.createObjectURL(blob) : '';
          allMedia.push({ ...m, entry, url });
        }
      }

      // Sort by timestamp desc
      allMedia.sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());
      setPhotos(allMedia);
    } catch (err) {
      console.error('Error loading photos:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  if (timedOut) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Timeout" />
        <div className="flex-1 overflow-y-auto p-4">
          <TimeoutSafety onRetry={loadPhotos} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Photo Gallery" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {/* Filters */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <Filter size={16} />
            <h2 className="text-xs font-bold uppercase tracking-wider">Filters</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-medium text-zinc-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-medium text-zinc-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Photo Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-400">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="text-sm font-medium">No photos found matching filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => navigate(`/entry/${photo.entry_id}`)}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-transform active:scale-95"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Field photo'}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col p-3 text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase truncate">
                    {formatLocationShort(photo.entry)}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-600 line-clamp-1">
                    {photo.caption || 'No caption'}
                  </span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[9px] text-zinc-400">
                      {new Date(photo.entry.timestamp).toLocaleDateString()}
                    </span>
                    <ChevronRight size={12} className="text-zinc-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
