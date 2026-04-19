import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEntryTypeLabel } from '../utils/entryTypes';
import { Layout } from '../components/Layout';
import { entryRepo, Entry } from '../repositories/entryRepo';
import { refRepo } from '../repositories/refRepo';
import { locationRepo, Location } from '../repositories/locationRepo';
import { Save, AlertTriangle, Loader2 } from 'lucide-react';
import { TimeoutSafety } from '../components/TimeoutSafety';

export const EntryEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [riskLevels, setRiskLevels] = useState<{ id: string, label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string, label: string }[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [formData, setFormData] = useState({
    risk_level_id: '',
    status_id: '',
    summary: '',
    is_handover_item: 0,
    location_id: ''
  });

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setTimedOut(false);
    setError(null);

    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const data = entryRepo.getWithDetails(id);
      if (data) {
        setEntry(data);
        setFormData({
          risk_level_id: data.risk_level_id,
          status_id: data.status_id,
          summary: data.summary || '',
          is_handover_item: data.is_handover_item,
          location_id: data.location_id
        });

        const [risks, stats, locs] = await Promise.all([
          refRepo.getRefList('ref_risk_level'),
          refRepo.getRefList('ref_status'),
          locationRepo.getAll()
        ]);

        setRiskLevels(risks);
        setStatuses(stats);
        setLocations(locs);
      } else {
        setError('Entry not found.');
      }
    } catch (err) {
      console.error('Error loading entry for edit:', err);
      setError('Failed to load data.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await entryRepo.updateEntry(id, formData);
      navigate(`/entry/${id}`);
    } catch (err) {
      console.error('Error saving entry:', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const moduleEditConfig = entry?.entry_type_id === 'ET7'
    ? { path: '/quick-log', label: 'Quick Log' }
    : entry?.entry_type_id === 'ET1'
      ? { path: '/mapping', label: 'Rock Mapping' }
      : entry?.entry_type_id === 'ET12'
        ? { path: '/investigation-log', label: 'Investigation Log' }
        : entry?.entry_type_id === 'ET18'
          ? { path: '/bearing-capacity', label: 'Bearing Capacity' }
        : null;

  if (timedOut) {
    return (
      <Layout title="Timeout" showBack>
        <div className="p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout title="Loading..." showBack>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </Layout>
    );
  }

  if (error || !entry) {
    return (
      <Layout title="Error" showBack>
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold">{error || 'Entry Not Found'}</h2>
          <button onClick={() => navigate(-1)} className="mt-4 text-emerald-600 font-bold">Go Back</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Edit Entry" showBack>
      <div className="flex flex-col gap-6 p-4">
        {moduleEditConfig && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
            <div className="font-bold">This record has structured module data.</div>
            <div className="mt-1 text-emerald-800">Use {getEntryTypeLabel(entry.entry_type_id)} to correct the technical content. This page only edits common entry fields.</div>
            <button
              onClick={() => navigate(moduleEditConfig.path, { state: { entryId: id, mode: 'edit' } })}
              className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Edit in {moduleEditConfig.label}
            </button>
          </div>
        )}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Risk Level</label>
            <select
              value={formData.risk_level_id}
              onChange={(e) => setFormData({ ...formData, risk_level_id: e.target.value })}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
            >
              {riskLevels.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Status</label>
            <select
              value={formData.status_id}
              onChange={(e) => setFormData({ ...formData, status_id: e.target.value })}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
            >
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Location</label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  CH {l.chainage_start}-{l.chainage_end} {l.side} ({l.position})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-100">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800">Handover Item</span>
              <span className="text-[10px] text-zinc-400">Include in daily report</span>
            </div>
            <button
              onClick={() => setFormData({ ...formData, is_handover_item: formData.is_handover_item ? 0 : 1 })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_handover_item ? 'bg-emerald-500' : 'bg-zinc-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_handover_item ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Technical Summary</label>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={6}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700"
              placeholder="Enter technical details..."
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 font-bold text-white shadow-lg shadow-zinc-200 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </div>
    </Layout>
  );
};
