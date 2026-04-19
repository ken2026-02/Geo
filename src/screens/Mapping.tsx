import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Dropdown } from '../components/Dropdown';
import { projectRepo, Project } from '../repositories/projectRepo';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { mappingRepo, DiscontinuitySet as RepoDiscontinuitySet } from '../repositories/mappingRepo';
import { saveAutoBackupZip } from '../utils/autoBackup';
import { refRepo, RefItem } from '../repositories/refRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { LoggingAssistant } from '../components/LoggingAssistant';
import { LoggingStyle } from '../utils/loggingStyle';
import { query, execute } from '../db/db';
import { Plus, Save, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { getLoggingHints } from '../utils/loggingGuide';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { getFieldAuthor, getLoggingQualifiersPreference, getLoggingStylePreference, isAutoBackupEnabled, setLoggingQualifiersPreference, setLoggingStylePreference } from '../state/userPreferences';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

type EditableDiscontinuitySet = Omit<RepoDiscontinuitySet, 'dip' | 'dip_dir'> & { dip: string; dip_dir: string };

const toEditableSet = (set: Partial<RepoDiscontinuitySet>, index: number): EditableDiscontinuitySet => ({
  set_number: set.set_number ?? index + 1,
  dip: set.dip != null ? String(set.dip) : '0',
  dip_dir: set.dip_dir != null ? String(set.dip_dir) : '0',
  spacing_id: set.spacing_id || '',
  persistence_id: set.persistence_id || '',
  aperture_id: set.aperture_id || '',
  roughness_id: set.roughness_id || '',
  infill_id: set.infill_id || '',
  water_id: set.water_id || ''
});

export const Mapping: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editEntryId = typeof (location.state as { entryId?: string } | null)?.entryId === 'string'
    ? (location.state as { entryId: string }).entryId
    : null;
  const isEditMode = Boolean(editEntryId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    isNewLocation: false,
    newLocationData: null as any,
    isValidLocation: false,
    risk_level_id: 'R1',
    status_id: 'ST_OPEN',
    lithology_id: '',
    weathering_id: '',
    strength_id: '',
    structure_id: '',
    groundwater_id: '',
    is_handover_item: 0,
  });

  const hints = getLoggingHints({ entryType: 'Mapping' });

  const [sets, setSets] = useState<EditableDiscontinuitySet[]>([
    { set_number: 1, dip: '0', dip_dir: '0', spacing_id: '', persistence_id: '', aperture_id: '', roughness_id: '', infill_id: '', water_id: '' }
  ]);

  const [indicators, setIndicators] = useState<string[]>([]);
  const [controls, setControls] = useState<string[]>([]);

  const [refData, setRefData] = useState<{ indicators: any[], controls: any[] }>({ indicators: [], controls: [] });
  const [refMaps, setRefMaps] = useState<Record<string, Map<string, RefItem>>>({});

  const [loggingStyle, setLoggingStyle] = useState<LoggingStyle>(getLoggingStylePreference());
  const [qualifiers, setQualifiers] = useState<string[]>(getLoggingQualifiersPreference());
  const [editedSummary, setEditedSummary] = useState('');
  const [isManualEdit, setIsManualEdit] = useState(false);

  const author = getFieldAuthor();

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const draft = loadFormDraft(DRAFT_KEYS.mapping);
    if (draft) {
      if (draft.formData) setFormData(draft.formData);
      if (Array.isArray(draft.sets)) {
        setSets(draft.sets.map((set: Partial<RepoDiscontinuitySet>, index: number) => toEditableSet(set, index)));
      } else if (Array.isArray(draft.parsedSets)) {
        setSets(draft.parsedSets.map((set: Partial<RepoDiscontinuitySet>, index: number) => toEditableSet(set, index)));
      }
      if (draft.indicators) setIndicators(draft.indicators);
      if (draft.controls) setControls(draft.controls);
      if (draft.loggingStyle) setLoggingStyle(draft.loggingStyle);
      if (draft.qualifiers) setQualifiers(draft.qualifiers);
      if (draft.editedSummary) setEditedSummary(draft.editedSummary);
      if (draft.isManualEdit !== undefined) setIsManualEdit(draft.isManualEdit);
    }
    setIsBootstrapping(false);
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode || isBootstrapping) return;
    const navState = location.state as { projectId?: string; locationId?: string } | null;
    if (!navState) return;
    setFormData((prev) => ({
      ...prev,
      project_id: prev.project_id || navState.projectId || '',
      location_id: prev.location_id || navState.locationId || '',
      isValidLocation: prev.isValidLocation || !!navState.locationId,
    }));
  }, [location.state, isEditMode, isBootstrapping]);

  useEffect(() => {
    if (isBootstrapping) return;
    saveFormDraft(DRAFT_KEYS.mapping, {
      formData,
      sets,
      indicators,
      controls,
      loggingStyle,
      qualifiers,
      editedSummary,
      isManualEdit
    });
  }, [formData, sets, indicators, controls, loggingStyle, qualifiers, editedSummary, isManualEdit, isBootstrapping]);

  const loadExistingEntry = async (entryId: string) => {
    const existingEntry = entryRepo.getWithDetails(entryId);
    const existingMapping = mappingRepo.getByEntryId(entryId);
    if (!existingEntry || !existingMapping) {
      throw new Error('Mapping entry not found for edit mode.');
    }

    setFormData({
      project_id: existingEntry.project_id,
      location_id: existingEntry.location_id,
      isNewLocation: false,
      newLocationData: null as any,
      isValidLocation: true,
      risk_level_id: existingEntry.risk_level_id,
      status_id: existingEntry.status_id,
      lithology_id: existingMapping.lithology_id || '',
      weathering_id: existingMapping.weathering_id || '',
      strength_id: existingMapping.strength_id || '',
      structure_id: existingMapping.structure_id || '',
      groundwater_id: existingMapping.groundwater_id || '',
      is_handover_item: existingEntry.is_handover_item,
    });
    setSets((existingMapping.sets || []).map((set, index) => toEditableSet(set, index)));
    setEditedSummary(existingEntry.summary || '');
    setIsManualEdit(true);
  };

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      try {
        const riskCount = query<{n: number}>('SELECT COUNT(*) AS n FROM ref_risk_level;')[0]?.n;
        const strengthCount = query<{n: number}>('SELECT COUNT(*) AS n FROM ref_rock_strength;')[0]?.n;
        const spacingCount = query<{n: number}>('SELECT COUNT(*) AS n FROM ref_joint_spacing;')[0]?.n;
        console.log('Diagnostic Counts:', { riskCount, strengthCount, spacingCount });
      } catch (e) {
        console.error('Diagnostic query failed:', e);
      }

      const projs = await projectRepo.list();
      setProjects(projs);

      const [indics, ctrls] = await Promise.all([
        refRepo.getRefList('ref_instability_indicator'),
        refRepo.getRefList('ref_controls')
      ]);
      setRefData({ indicators: indics, controls: ctrls });

      const tables = [
        'ref_lithology', 'ref_weathering', 'ref_rock_strength', 'ref_structure',
        'ref_groundwater', 'ref_joint_spacing', 'ref_persistence', 'ref_aperture', 'ref_roughness', 'ref_infill', 'ref_joint_water', 'ref_colour'
      ];
      const maps: Record<string, Map<string, RefItem>> = {};
      for (const table of tables) {
        maps[table] = await refRepo.getRefMap(table);
      }
      setRefMaps(maps);

      if (editEntryId) {
        await loadExistingEntry(editEntryId);
      }
    } catch (err) {
      console.error('Error loading mapping data:', err);
      alert('Failed to load Mapping data.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [editEntryId]);

  const parsedSets: RepoDiscontinuitySet[] = sets
    .filter((set) => {
      const dip = set.dip.trim();
      const dipDir = set.dip_dir.trim();
      const hasCustomOrientation = (dip !== '' && dip !== '0') || (dipDir !== '' && dipDir !== '0');
      const hasDescriptors = Boolean(
        set.spacing_id || set.persistence_id || set.aperture_id || set.roughness_id || set.infill_id || set.water_id
      );
      return hasCustomOrientation || hasDescriptors;
    })
    .map((set) => ({
      ...set,
      dip: parseNumericInput(set.dip) ?? 0,
      dip_dir: parseNumericInput(set.dip_dir) ?? 0
    }));

  useEffect(() => {
    if (Object.keys(refMaps).length === 0) return;

    const syncLookup = {
      getLabel: (table: string, id: string | null | undefined) => {
        if (!id) return '';
        return refMaps[table]?.get(id)?.label || id;
      }
    };

    const summary = phraseBuilder.buildRockLoggingParagraph(
      loggingStyle,
      formData,
      parsedSets,
      syncLookup,
      '',
      qualifiers
    );

    if (!isManualEdit) {
      setEditedSummary(summary);
    }
  }, [formData, parsedSets, loggingStyle, qualifiers, refMaps, isManualEdit]);

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
        <PageHeader title={isEditMode ? "Edit Rock Mapping" : "Rock Mapping"} />
        <div className="flex-1 overflow-y-auto flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </div>
    );
  }

  const addSet = () => {
    if (sets.length < 3) {
      setSets([...sets, { set_number: sets.length + 1, dip: '0', dip_dir: '0', spacing_id: '', persistence_id: '', aperture_id: '', roughness_id: '', infill_id: '', water_id: '' }]);
    }
  };

  const removeSet = (index: number) => {
    setSets(sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 })));
  };

  const updateSet = (index: number, field: string, value: any) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_id || !formData.isValidLocation) {
      alert('Please fill in required fields and ensure location is valid');
      return;
    }
    setIsSaving(true);
    try {
      let finalLocationId = formData.location_id;
      if (formData.isNewLocation) {
        finalLocationId = await locationRepo.create(formData.newLocationData);
      }

      if (parsedSets.length === 0) {
        alert('Please enter at least one discontinuity set before saving');
        setIsSaving(false);
        return;
      }

      let entryId = editEntryId || '';
      if (isEditMode && editEntryId) {
        await entryRepo.updateEntry(editEntryId, {
          project_id: formData.project_id,
          location_id: finalLocationId,
          risk_level_id: formData.risk_level_id,
          status_id: formData.status_id,
          summary: editedSummary,
          is_handover_item: formData.is_handover_item,
        });
        await mappingRepo.updateByEntryId(editEntryId, {
          lithology_id: formData.lithology_id,
          weathering_id: formData.weathering_id,
          strength_id: formData.strength_id,
          structure_id: formData.structure_id,
          groundwater_id: formData.groundwater_id,
        }, parsedSets);
        entryId = editEntryId;
      } else {
        entryId = await entryRepo.create({
          project_id: formData.project_id,
          location_id: finalLocationId,
          entry_type_id: 'ET1',
          risk_level_id: formData.risk_level_id,
          status_id: formData.status_id,
          author: author,
          summary: editedSummary,
          is_handover_item: formData.is_handover_item,
        });

        await mappingRepo.create({
          entry_id: entryId,
          lithology_id: formData.lithology_id,
          weathering_id: formData.weathering_id,
          strength_id: formData.strength_id,
          structure_id: formData.structure_id,
          groundwater_id: formData.groundwater_id,
        }, parsedSets);

      }

      try {
        await locationRepo.touch(finalLocationId);
      } catch (touchErr) {
        console.error('Failed to touch location after mapping save:', touchErr);
      }

      if (isAutoBackupEnabled()) {
        saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
      }

      setLoggingStylePreference(loggingStyle);
      setLoggingQualifiersPreference(qualifiers);

      clearFormDraft(DRAFT_KEYS.mapping);
      window.dispatchEvent(new Event('entries-changed'));
      if (isEditMode) {
        navigate(`/entry/${entryId}`);
        return;
      }
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to save mapping');
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
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        lithology_id: '',
        weathering_id: '',
        strength_id: '',
        structure_id: '',
        groundwater_id: '',
        is_handover_item: 0,
      });
      setSets([{ set_number: 1, dip: '0', dip_dir: '0', spacing_id: '', persistence_id: '', aperture_id: '', roughness_id: '', infill_id: '', water_id: '' }]);
      setIndicators([]);
      setControls([]);
      setEditedSummary('');
      setIsManualEdit(false);
      clearFormDraft(DRAFT_KEYS.mapping);
    }
  };

  return (
    <div className="theme-mapping flex flex-col h-screen bg-gray-50">
      <PageHeader title={isEditMode ? "Edit Rock Mapping" : "Rock Mapping"} />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-6">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {isEditMode ? 'Reset Form' : 'Clear Form'}
            </button>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <ProjectSelector
                value={formData.project_id}
                onChange={(id) => setFormData({ ...formData, project_id: id })}
              />
              <LocationSelector
                value={formData.location_id}
                onChange={(id, isNew, data, isValid) => setFormData({ ...formData, location_id: id, isNewLocation: isNew, newLocationData: data, isValidLocation: !!isValid })}
              />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800">Rock Mass Properties</h3>
              <Dropdown label="Lithology" tableName="ref_lithology" value={formData.lithology_id} onChange={(v) => setFormData({ ...formData, lithology_id: v })} required />
              <Dropdown label="Weathering" tableName="ref_weathering" value={formData.weathering_id} onChange={(v) => setFormData({ ...formData, weathering_id: v })} required />
              <Dropdown label="Strength" tableName="ref_rock_strength" value={formData.strength_id} onChange={(v) => setFormData({ ...formData, strength_id: v })} required />
              <Dropdown label="Structure" tableName="ref_structure" value={formData.structure_id} onChange={(v) => setFormData({ ...formData, structure_id: v })} required />
              <Dropdown label="Groundwater" tableName="ref_groundwater" value={formData.groundwater_id} onChange={(v) => setFormData({ ...formData, groundwater_id: v })} required />

              {hints.length > 0 && (
                <div className="mt-2 rounded-xl bg-red-50 p-3 border border-red-100">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Missing Descriptors:</span>
                  </div>
                  <ul className="list-disc list-inside text-[10px] text-red-500 font-medium">
                    {hints.map((hint, i) => (
                      <li key={i}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              <LoggingAssistant
                style={loggingStyle}
                qualifiers={qualifiers}
                generatedText={editedSummary}
                onStyleChange={(s) => {
                  setLoggingStyle(s);
                  setIsManualEdit(false);
                }}
                onQualifiersChange={(q) => {
                  setQualifiers(q);
                  setIsManualEdit(false);
                }}
                onTextEdit={(t) => {
                  setEditedSummary(t);
                  setIsManualEdit(true);
                }}
                onReset={() => setIsManualEdit(false)}
              />
            </div>

            {sets.map((set, idx) => (
              <div key={idx} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border-l-4 border-emerald-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-800">Discontinuity Set {set.set_number}</h3>
                  {idx > 0 && <button type="button" onClick={() => removeSet(idx)} className="text-red-500"><Trash2 size={18} /></button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Dip (0-90)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      max="90"
                      value={set.dip}
                      onChange={(e) => updateSet(idx, 'dip', e.target.value)}
                      className="rounded-lg border border-zinc-200 p-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Dip Dir (0-360)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      max="360"
                      value={set.dip_dir}
                      onChange={(e) => updateSet(idx, 'dip_dir', e.target.value)}
                      className="rounded-lg border border-zinc-200 p-2 text-sm"
                    />
                  </div>
                </div>
                <Dropdown label="Spacing" tableName="ref_joint_spacing" value={set.spacing_id} onChange={(v) => updateSet(idx, 'spacing_id', v)} />
                <Dropdown label="Persistence" tableName="ref_persistence" value={set.persistence_id} onChange={(v) => updateSet(idx, 'persistence_id', v)} />
                <Dropdown label="Aperture" tableName="ref_aperture" value={set.aperture_id} onChange={(v) => updateSet(idx, 'aperture_id', v)} />
                <Dropdown label="Roughness" tableName="ref_roughness" value={set.roughness_id} onChange={(v) => updateSet(idx, 'roughness_id', v)} />
                <Dropdown label="Infill" tableName="ref_infill" value={set.infill_id} onChange={(v) => updateSet(idx, 'infill_id', v)} />
                <Dropdown label="Joint Water" tableName="ref_joint_water" value={set.water_id} onChange={(v) => updateSet(idx, 'water_id', v)} />
              </div>
            ))}

            {sets.length < 3 && (
              <button type="button" onClick={addSet} className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-bold text-zinc-500">
                <Plus size={18} /> Add Discontinuity Set
              </button>
            )}

            <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <Dropdown label="Risk Level" tableName="ref_risk_level" value={formData.risk_level_id} onChange={(v) => setFormData({ ...formData, risk_level_id: v })} required />
              <Dropdown label="Status" tableName="ref_status" value={formData.status_id} onChange={(v) => setFormData({ ...formData, status_id: v })} required />
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

            <button type="submit" disabled={isSaving} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--module-accent)] py-4 font-bold text-white shadow-lg disabled:opacity-50 hover:opacity-90 transition-opacity">
              <Save size={20} /> {isSaving ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Mapping' : 'Save Mapping')}
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


