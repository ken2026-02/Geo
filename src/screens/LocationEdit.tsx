import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ArrowLeft, Save } from 'lucide-react';
import { locationRepo, Location } from '../repositories/locationRepo';

export const LocationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Location>>({
    chainage_start: 0,
    chainage_end: 0,
    side: 'CL',
    position: 'NA' as any,
    description: ''
  });

  useEffect(() => {
    if (id) {
      const loc = locationRepo.getById(id);
      if (loc) {
        setFormData({
          chainage_start: loc.chainage_start,
          chainage_end: loc.chainage_end,
          side: loc.side,
          position: loc.position,
          description: loc.description || ''
        });
      } else {
        setError("Location not found.");
      }
      setLoading(false);
    }
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    
    let start = Number(formData.chainage_start) || 0;
    let end = Number(formData.chainage_end);
    
    if (isNaN(end) || formData.chainage_end === undefined || formData.chainage_end === null || formData.chainage_end === '') {
      end = start;
    }

    if (end < start) {
      alert("Chainage End cannot be less than Chainage Start.");
      return;
    }

    const side = formData.side || 'CL';
    const position = formData.position || 'NA';

    try {
      await locationRepo.updateLocation(id, {
        chainage_start: start,
        chainage_end: end,
        side: side as any,
        position: position as any,
        description: formData.description
      });
      navigate(-1);
    } catch (err) {
      console.error("Failed to update location:", err);
      alert("Failed to update location.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-4 text-center">Loading...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-4 text-center text-red-600">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full bg-zinc-50">
        <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm border-b border-zinc-200 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 text-zinc-600">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-zinc-900">Edit Location</h1>
          </div>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
          >
            <Save size={16} />
            Save
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl shadow-sm border border-zinc-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Chainage Start</label>
                <input
                  type="number"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formData.chainage_start}
                  onChange={(e) => setFormData({ ...formData, chainage_start: parseFloat(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Chainage End</label>
                <input
                  type="number"
                  placeholder="Optional"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formData.chainage_end === formData.chainage_start ? '' : formData.chainage_end}
                  onChange={(e) => setFormData({ ...formData, chainage_end: e.target.value ? parseFloat(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Side</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formData.side}
                  onChange={(e) => setFormData({ ...formData, side: e.target.value as any })}
                >
                  <option value="LHS">LHS</option>
                  <option value="CL">CL</option>
                  <option value="RHS">RHS</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Position</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                >
                  <option value="NA">NA</option>
                  <option value="Toe">Toe</option>
                  <option value="Mid">Mid</option>
                  <option value="Crest">Crest</option>
                  <option value="Face">Face</option>
                  <option value="Bench">Bench</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Batter 4 North"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="mt-2 rounded-xl bg-zinc-50 p-3 border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Preview Cluster Key</span>
              <span className="text-xs font-mono text-zinc-700">
                {locationRepo.generateClusterKey({
                  chainage_start: Number(formData.chainage_start) || 0,
                  chainage_end: (formData.chainage_end !== undefined && formData.chainage_end !== null && formData.chainage_end !== '') ? Number(formData.chainage_end) : (Number(formData.chainage_start) || 0),
                  side: formData.side || 'CL',
                  position: formData.position || 'NA' as any
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
