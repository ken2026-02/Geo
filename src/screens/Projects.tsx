import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { projectRepo, Project } from '../repositories/projectRepo';
import { getActiveProjectId, setActiveProjectId } from '../state/activeProject';
import { Save, Trash2, Edit2, CheckCircle2, X, MapPin, FileText, ClipboardList } from 'lucide-react';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getActiveProjectId());
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '' });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    setProjects(projectRepo.listAll());
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await projectRepo.update(editingId, formData);
        setEditingId(null);
      } else {
        await projectRepo.create(formData);
      }
      setFormData({ name: '', code: '' });
      loadProjects();
    } catch (err) {
      console.error(err);
      alert(`Failed to save project: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (p: Project) => {
    setEditingId(p.id);
    setFormData({ name: p.name, code: p.code });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await projectRepo.remove(id);
      loadProjects();
    }
  };

  const handleSetActive = async (id: string) => {
    await projectRepo.setActive(id);
    setActiveProjectId(id);
    setActiveId(id);
    navigate('/');
  };

  return (
    <Layout title="Projects" showBack>
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 border border-emerald-100">
          <div className="font-bold">Project workflow</div>
          <div className="mt-1">Choose one active project, then use Locations for field review, Records for entry review, and Handover for shift output.</div>
        </div>
        {/* Form */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-800">
            {editingId ? 'Edit Project' : 'Create New Project'}
          </h3>
          <form onSubmit={handleCreateOrUpdate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. North Tunnel Expansion"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Project Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. NT-2024"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 font-bold text-white shadow-lg disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : editingId ? 'Update Project' : 'Create Project'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', code: '' });
                  }}
                  className="flex items-center justify-center rounded-xl bg-zinc-100 px-4 text-zinc-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">All Projects</h3>
          <div className="flex flex-col gap-3">
            {projects.map((p) => (
              <div key={p.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-900">{p.name}</h4>
                      {activeId === p.id && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 size={10} />
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-zinc-500">{p.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {activeId !== p.id ? (
                    <button
                      onClick={() => handleSetActive(p.id)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-50"
                    >
                      Set as Active
                    </button>
                  ) : (
                    <>
                      <button onClick={() => navigate('/locations')} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><MapPin size={14} /> Locations</button>
                      <button onClick={() => navigate('/records')} className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700"><FileText size={14} /> Records</button>
                      <button onClick={() => navigate('/handover')} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"><ClipboardList size={14} /> Handover</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-400">
                No projects found. Create one above.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
