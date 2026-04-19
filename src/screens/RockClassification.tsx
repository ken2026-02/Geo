import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Dropdown } from '../components/Dropdown';
import { projectRepo, Project } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { qRepo } from '../repositories/qRepo';
import { saveAutoBackupZip } from '../utils/autoBackup';
import { refRepo, RefItem } from '../repositories/refRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { getSupportDesign } from '../rules/supportDesignRules';
import { Save, Calculator, Info, ShieldCheck, ShieldAlert, Loader2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { getFieldAuthor, isAutoBackupEnabled } from '../state/userPreferences';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const RockClassification: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [jnList, setJnList] = useState<RefItem[]>([]);
  const [jrList, setJrList] = useState<RefItem[]>([]);
  const [jaList, setJaList] = useState<RefItem[]>([]);
  const [jwList, setJwList] = useState<RefItem[]>([]);
  const [srfList, setSrfList] = useState<RefItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  // Save Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    isNewLocation: false,
    newLocationData: null as any,
    isValidLocation: false,
    rqd: '100',
    jn_id: '',
    jr_id: '',
    ja_id: '',
    jw_id: '',
    srf_id: '',
    jn_override: '',
    jr_override: '',
    ja_override: '',
    jw_override: '',
    srf_override: '',
    gsi_structure: '',
    gsi_surface: '',
    notes: '',
    is_handover_item: 0,
  });

  /**
   * ALGORITHM SPECIFICATION: Rock Mass Classification (Q-System)
   * 
   * PURPOSE:
   * Calculates the Q-system value (Barton et al., 1974) for rock mass quality
   * and provides indicative support recommendations.
   * 
   * INPUTS:
   * - RQD (Rock Quality Designation)
   * - Jn (Joint Set Number)
   * - Jr (Joint Roughness Number)
   * - Ja (Joint Alteration Number)
   * - Jw (Joint Water Reduction Factor)
   * - SRF (Stress Reduction Factor)
   * 
   * ENGINEERING RULES:
   * 1. Q = (RQD / Jn) * (Jr / Ja) * (Jw / SRF)
   * 2. Quality categories:
   *    - Q > 40: Very Good
   *    - Q 10-40: Good
   *    - Q 4-10: Fair
   *    - Q 1-4: Poor
   *    - Q 0.1-1: Very Poor
   *    - Q < 0.1: Extremely Poor
   * 
   * 3. GSI Guidance (Hoek & Marinos):
   *    - Maps Structure and Surface Condition to a GSI range.
   * 
   * OUTPUTS:
   * - Numerical Q-value and descriptive quality category.
   * - Indicative support measures (via supportDesignRules.ts).
   * 
   * ASSUMPTIONS:
   * - Standard Q-system parameter definitions apply.
   * - GSI mapping is for preliminary guidance only.
   * 
   * LIMITATIONS:
   * - Does not account for structural kinematic hazards (handled in Structural Assessment).
   * - Does not account for specific excavation geometry or stress orientation.
   */

  const [isSaving, setIsSaving] = useState(false);
  const author = getFieldAuthor();

  // Load draft on mount
  useEffect(() => {
    const draft = loadFormDraft(DRAFT_KEYS.rockClassification);
    if (draft) {
      setFormData(draft);
    } else {
      const activeId = getActiveProjectId();
      if (activeId) {
        setFormData(prev => ({ ...prev, project_id: activeId }));
      }
    }
  }, []);

  // Save draft on change
  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.rockClassification, formData);
  }, [formData]);

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const [projs, jn, jr, ja, jw, srf] = await Promise.all([
        projectRepo.list(),
        refRepo.getRefList('ref_q_jn'),
        refRepo.getRefList('ref_q_jr'),
        refRepo.getRefList('ref_q_ja'),
        refRepo.getRefList('ref_q_jw'),
        refRepo.getRefList('ref_q_srf')
      ]);

      setProjects(projs);
      setJnList(jn);
      setJrList(jr);
      setJaList(ja);
      setJwList(jw);
      setSrfList(srf);
    } catch (err) {
      console.error('Error loading classification data:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const qResult = useMemo(() => {
    const getVal = (id: string, list: RefItem[], override: string) => {
      if (override && !isNaN(parseFloat(override))) return parseFloat(override);
      return list.find(i => i.id === id)?.value;
    };

    const jn = getVal(formData.jn_id, jnList, formData.jn_override);
    const jr = getVal(formData.jr_id, jrList, formData.jr_override);
    const ja = getVal(formData.ja_id, jaList, formData.ja_override);
    const jw = getVal(formData.jw_id, jwList, formData.jw_override);
    const srf = getVal(formData.srf_id, srfList, formData.srf_override);

    if (jn === undefined || jr === undefined || ja === undefined || jw === undefined || srf === undefined) {
      return null;
    }

    const qValue = ((parseNumericInput(formData.rqd) ?? 0) / jn) * (jr / ja) * (jw / srf);
    
    let quality = 'Extremely Poor';
    let colorClass = 'bg-red-100 text-red-700';

    if (qValue > 40) {
      quality = 'Very Good';
      colorClass = 'bg-emerald-100 text-emerald-700';
    } else if (qValue >= 10) {
      quality = 'Good';
      colorClass = 'bg-green-100 text-green-700';
    } else if (qValue >= 4) {
      quality = 'Fair';
      colorClass = 'bg-yellow-100 text-yellow-700';
    } else if (qValue >= 1) {
      quality = 'Poor';
      colorClass = 'bg-orange-100 text-orange-700';
    } else if (qValue >= 0.1) {
      quality = 'Very Poor';
      colorClass = 'bg-red-100 text-red-700';
    }

    const recommendation = getSupportDesign(qValue);

    return { qValue, quality, colorClass, recommendation, jn, jr, ja, jw, srf };
  }, [formData, jnList, jrList, jaList, jwList, srfList]);

  const gsiResult = useMemo(() => {
    if (!formData.gsi_structure || !formData.gsi_surface) return null;

    // Consultant-grade GSI matrix mapping (Hoek & Marinos)
    const structureMap: Record<string, { base: number, desc: string }> = {
      'Massive / Intact': { base: 85, desc: 'Few widely spaced discontinuities' },
      'Blocky': { base: 65, desc: 'Well interlocked undisturbed rock mass' },
      'Very blocky': { base: 45, desc: 'Interlocked, partially disturbed' },
      'Blocky/Disturbed/Seamy': { base: 30, desc: 'Folded/faulted, angular blocks' },
      'Disintegrated': { base: 15, desc: 'Poorly interlocked, heavily broken' },
      'Laminated / Sheared': { base: 5, desc: 'Lack of blockiness, shear planes' }
    };

    const surfaceMap: Record<string, { mod: number, desc: string }> = {
      'Very rough, unweathered': { mod: 10, desc: 'Fresh, unweathered surfaces' },
      'Rough, slightly weathered': { mod: 0, desc: 'Slightly weathered, stained' },
      'Smooth, moderately weathered': { mod: -10, desc: 'Moderately weathered, altered' },
      'Slickensided / clay-coated': { mod: -25, desc: 'Highly weathered, clay coatings' },
      'Very poor (gouge/crushed)': { mod: -40, desc: 'Thick clay or crushed rock' }
    };

    const base = structureMap[formData.gsi_structure]?.base || 0;
    const mod = surfaceMap[formData.gsi_surface]?.mod || 0;
    
    const mid = Math.max(5, Math.min(95, base + mod));
    const min = Math.max(0, mid - 5);
    const max = Math.min(100, mid + 5);

    return { min, max, mid };
  }, [formData.gsi_structure, formData.gsi_surface]);

  if (timedOut) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Timeout" />
        <div className="flex-1 overflow-y-auto p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Rock Classification" />
        <div className="flex-1 overflow-y-auto flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_id || !formData.isValidLocation || !qResult) {
      alert('Please fill in all required fields and ensure location is valid');
      return;
    }

    setIsSaving(true);
    try {
      let finalLocationId = formData.location_id;
      if (formData.isNewLocation) {
        finalLocationId = await locationRepo.create(formData.newLocationData);
      }

      // Pre-fetch labels for summary
      const [jnLabel, jrLabel, jaLabel, jwLabel, srfLabel] = await Promise.all([
        refRepo.getLabel('ref_q_jn', formData.jn_id),
        refRepo.getLabel('ref_q_jr', formData.jr_id),
        refRepo.getLabel('ref_q_ja', formData.ja_id),
        refRepo.getLabel('ref_q_jw', formData.jw_id),
        refRepo.getLabel('ref_q_srf', formData.srf_id)
      ]);

      const lookup = {
        getLabel: (table: string, id: string | null | undefined): string => {
          if (id === formData.jn_id) return jnLabel;
          if (id === formData.jr_id) return jrLabel;
          if (id === formData.ja_id) return jaLabel;
          if (id === formData.jw_id) return jwLabel;
          if (id === formData.srf_id) return srfLabel;
          return id || '';
        }
      };

      const assessmentData = {
        ...formData,
        computed_q: qResult.qValue
      };

      let summary = phraseBuilder.buildQParagraph(assessmentData, lookup);
      
      // Append Q inputs used
      summary += `\nQ inputs used: RQD=${formData.rqd}, Jn=${qResult.jn}${formData.jn_override ? ' (override)' : ''}, Jr=${qResult.jr}${formData.jr_override ? ' (override)' : ''}, Ja=${qResult.ja}${formData.ja_override ? ' (override)' : ''}, Jw=${qResult.jw}${formData.jw_override ? ' (override)' : ''}, SRF=${qResult.srf}${formData.srf_override ? ' (override)' : ''}; Q=${qResult.qValue.toFixed(2)}.`;

      // Append GSI if available
      if (gsiResult) {
        summary += `\nGSI (guidance): ${gsiResult.mid} (range ${gsiResult.min}-${gsiResult.max}) based on ${formData.gsi_structure}/${formData.gsi_surface}.`;
      }

      if (formData.notes) {
        summary += `\nNotes: ${formData.notes}`;
      }

      const entryId = await entryRepo.create({
        project_id: formData.project_id,
        location_id: finalLocationId,
        entry_type_id: 'ET11', // Rock Mass Classification
        risk_level_id: 'R1', // Default to Low for classification
        status_id: 'ST_CLOSED', // Usually closed on creation
        author: author,
        summary: summary,
        is_handover_item: formData.is_handover_item,
      });

      await qRepo.save({
        entry_id: entryId,
        rqd: parseNumericInput(formData.rqd) ?? 0,
        jn_id: formData.jn_id,
        jr_id: formData.jr_id,
        ja_id: formData.ja_id,
        jw_id: formData.jw_id,
        srf_id: formData.srf_id,
        computed_q: qResult.qValue
      });

      await locationRepo.touch(finalLocationId);

      // Trigger auto-backup if enabled (fire-and-forget)
      if (isAutoBackupEnabled()) {
        saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
      }

      clearFormDraft(DRAFT_KEYS.rockClassification);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to save classification');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form? This will remove all entered data and saved drafts.')) {
      setFormData({
        project_id: '',
        location_id: '',
        isNewLocation: false,
        newLocationData: null as any,
        isValidLocation: false,
        rqd: '100',
        jn_id: '',
        jr_id: '',
        ja_id: '',
        jw_id: '',
        srf_id: '',
        jn_override: '',
        jr_override: '',
        ja_override: '',
        jw_override: '',
        srf_override: '',
        gsi_structure: '',
        gsi_surface: '',
        notes: '',
        is_handover_item: 0,
      });
      clearFormDraft(DRAFT_KEYS.rockClassification);
    }
  };

  return (
    <div className="theme-rock-classification flex flex-col h-screen bg-gray-50">
      <PageHeader title="Rock Mass Classification" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-6">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-6 pb-10">
            {/* Header Section */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2">Context</h3>
              <div className="space-y-4">
                <ProjectSelector
                  value={formData.project_id}
                  onChange={(id) => setFormData({ ...formData, project_id: id })}
                />
                <LocationSelector
                  value={formData.location_id}
                  onChange={(id, isNew, data, isValid) => setFormData({ ...formData, location_id: id, isNewLocation: isNew, newLocationData: data, isValidLocation: !!isValid })}
                />
                <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800">Handover Item</span>
                    <span className="text-[10px] text-zinc-400">Include in daily report</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_handover_item: formData.is_handover_item ? 0 : 1 })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_handover_item ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_handover_item ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Q-System Parameters */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-2">
                <Calculator size={16} className="text-emerald-600" />
                Q-System Parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">RQD (%) *</label>
                  <input type="text" inputMode="decimal" min="0" max="100" value={formData.rqd} onChange={(e) => setFormData({ ...formData, rqd: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-sm" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Dropdown label="Jn (Joint Set Number) *" tableName="ref_q_jn" value={formData.jn_id} onChange={(val) => setFormData({ ...formData, jn_id: val })} required />
                  <input type="text" inputMode="decimal" value={formData.jn_override} onChange={(e) => setFormData({ ...formData, jn_override: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-xs" placeholder="Jn Override..." />
                </div>
                <div className="flex flex-col gap-1">
                  <Dropdown label="Jr (Joint Roughness Number) *" tableName="ref_q_jr" value={formData.jr_id} onChange={(val) => setFormData({ ...formData, jr_id: val })} required />
                  <input type="text" inputMode="decimal" value={formData.jr_override} onChange={(e) => setFormData({ ...formData, jr_override: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-xs" placeholder="Jr Override..." />
                </div>
                <div className="flex flex-col gap-1">
                  <Dropdown label="Ja (Joint Alteration Number) *" tableName="ref_q_ja" value={formData.ja_id} onChange={(val) => setFormData({ ...formData, ja_id: val })} required />
                  <input type="text" inputMode="decimal" value={formData.ja_override} onChange={(e) => setFormData({ ...formData, ja_override: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-xs" placeholder="Ja Override..." />
                </div>
                <div className="flex flex-col gap-1">
                  <Dropdown label="Jw (Joint Water Reduction Factor) *" tableName="ref_q_jw" value={formData.jw_id} onChange={(val) => setFormData({ ...formData, jw_id: val })} required />
                  <input type="text" inputMode="decimal" value={formData.jw_override} onChange={(e) => setFormData({ ...formData, jw_override: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-xs" placeholder="Jw Override..." />
                </div>
                <div className="flex flex-col gap-1">
                  <Dropdown label="SRF (Stress Reduction Factor) *" tableName="ref_q_srf" value={formData.srf_id} onChange={(val) => setFormData({ ...formData, srf_id: val })} required />
                  <input type="text" inputMode="decimal" value={formData.srf_override} onChange={(e) => setFormData({ ...formData, srf_override: e.target.value })} className="w-full rounded-lg border border-zinc-200 p-2 text-xs" placeholder="SRF Override..." />
                </div>
              </div>
            </div>

            {/* GSI Guidance Panel */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-4 uppercase tracking-wider border-b border-amber-200 pb-2 flex items-center gap-2">
                <Info size={16} className="text-amber-600" />
                GSI (Guidance)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-800">Structure / Blockiness</label>
                  <select value={formData.gsi_structure} onChange={(e) => setFormData({ ...formData, gsi_structure: e.target.value })} className="w-full rounded-lg border border-amber-200 bg-white p-2 text-sm">
                    <option value="">Select Structure...</option>
                    <option value="Massive / Intact">Massive / Intact</option>
                    <option value="Blocky">Blocky</option>
                    <option value="Very blocky">Very blocky</option>
                    <option value="Blocky/Disturbed/Seamy">Blocky/Disturbed/Seamy</option>
                    <option value="Disintegrated">Disintegrated</option>
                    <option value="Laminated / Sheared">Laminated / Sheared</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-800">Surface Condition</label>
                  <select value={formData.gsi_surface} onChange={(e) => setFormData({ ...formData, gsi_surface: e.target.value })} className="w-full rounded-lg border border-amber-200 bg-white p-2 text-sm">
                    <option value="">Select Surface...</option>
                    <option value="Very rough, unweathered">Very rough, unweathered</option>
                    <option value="Rough, slightly weathered">Rough, slightly weathered</option>
                    <option value="Smooth, moderately weathered">Smooth, moderately weathered</option>
                    <option value="Slickensided / clay-coated">Slickensided / clay-coated</option>
                    <option value="Very poor (gouge/crushed)">Very poor (gouge/crushed)</option>
                  </select>
                </div>
              </div>
              {gsiResult && (
                <div className="mt-4 rounded-lg bg-amber-100 p-3 border border-amber-200">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-amber-900">GSI â‰?{gsiResult.mid}</span>
                    <span className="text-xs font-bold text-amber-700">(range {gsiResult.min}-{gsiResult.max})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Calculation Result */}
            {qResult && (
              <div className="flex flex-col gap-4">
                <div className={clsx("rounded-xl p-6 shadow-sm", qResult.colorClass)}>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Calculated Q-Value</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-black tracking-tighter">{qResult.qValue.toFixed(2)}</span>
                    <span className="text-lg font-bold opacity-80">{qResult.quality}</span>
                  </div>
                </div>

                {/* Support Design Guidance Panel */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-indigo-900 mb-4 uppercase tracking-wider border-b border-indigo-200 pb-2 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-indigo-600" />
                    Support Design Guidance
                  </h3>
                  <div className="flex flex-col gap-3">
                    <span className="text-lg font-bold text-indigo-950">{qResult.recommendation.label}</span>
                    <p className="text-sm text-indigo-800 leading-relaxed">{qResult.recommendation.summary}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/50 p-2 border border-indigo-100">
                        <span className="text-[8px] font-bold uppercase text-indigo-500">Bolt Spacing</span>
                        <span className="block text-xs font-bold text-indigo-900">{qResult.recommendation.boltSpacing || 'N/A'}</span>
                      </div>
                      <div className="rounded-lg bg-white/50 p-2 border border-indigo-100">
                        <span className="text-[8px] font-bold uppercase text-indigo-500">Mesh</span>
                        <span className="block text-xs font-bold text-indigo-900">{qResult.recommendation.meshRequired ? 'Required' : 'Not Required'}</span>
                      </div>
                      <div className="rounded-lg bg-white/50 p-2 border border-indigo-100">
                        <span className="text-[8px] font-bold uppercase text-indigo-500">Shotcrete</span>
                        <span className="block text-xs font-bold text-indigo-900">{qResult.recommendation.shotcreteThickness || 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                rows={3}
                placeholder="Enter any additional details..."
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || !qResult}
              className="w-full bg-[var(--module-accent)] text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Classification'}
            </button>
          </form>
        </div>
      </div>
      <SaveSuccessModal 
        isOpen={showSuccessModal} 
        entryId={savedEntryId}
        onContinue={() => {
          setShowSuccessModal(false);
          setSavedEntryId(null);
          handleClearForm();
        }}
      />
    </div>
  );
};


