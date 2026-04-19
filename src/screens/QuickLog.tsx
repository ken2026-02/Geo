import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { putBlob } from '../media/mediaStore';
import { saveAutoBackupZip } from '../utils/autoBackup';
import { execute } from '../db/db';
import { quickLogRepo } from '../repositories/quickLogRepo';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Save, Loader2, Trash2 } from 'lucide-react';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { OBSERVATION_CATEGORIES } from '../constants/observations';
import { SOIL_OBSERVATION_CATEGORIES } from '../constants/soilObservations';
import { loadCustomObservations, saveCustomObservation, deleteCustomObservation } from '../utils/customObservationStore';
import { QuickLogObservationLibrary } from '../components/QuickLogObservationLibrary';
import { QuickLogEventChainPanel } from '../components/QuickLogEventChainPanel';
import { getFieldAuthor, isAutoBackupEnabled } from '../state/userPreferences';

const TRIGGER_CATEGORIES = [
  'Routine observation',
  'New instability sign',
  'Water / drainage issue',
  'Rockfall / ravelling',
  'Access / safety concern',
  'Post-rainfall check',
  'Post-blast / vibration check'
] as const;

const resolveSuggestedRiskId = (selectedLabels: string[]): 'R1' | 'R2' | 'R3' => {
  const allCategories = [...OBSERVATION_CATEGORIES, ...SOIL_OBSERVATION_CATEGORIES];
  const risks = allCategories
    .flatMap(cat => cat.items)
    .filter(item => selectedLabels.includes(item.label))
    .map(item => item.risk)
    .filter(Boolean);

  if (risks.includes('High')) return 'R3';
  if (risks.includes('Medium')) return 'R2';
  return 'R1';
};

const buildQuickLogSummary = (
  selectedLabels: string[],
  triggerCategory: string,
  immediateAction: string,
  reviewRequired: number,
  customLabels: string[]
): string => {
  const allCategories = [...OBSERVATION_CATEGORIES, ...SOIL_OBSERVATION_CATEGORIES];
  const defaultPhrases = allCategories
    .flatMap(cat => cat.items)
    .filter(item => selectedLabels.includes(item.label))
    .map(item => item.phrase);

  const customPhrases = customLabels
    .filter(label => selectedLabels.includes(label))
    .map(label => `Additional field observation recorded: ${label.toLowerCase()}.`);

  const parts: string[] = [];
  if (triggerCategory) parts.push(`Observation trigger: ${triggerCategory}.`);
  parts.push(...defaultPhrases, ...customPhrases);
  if (immediateAction.trim()) parts.push(`Immediate control implemented: ${immediateAction.trim()}.`);
  if (reviewRequired) parts.push('Escalate for engineering review on the next shift.');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const resolveQuickLogErrorMessage = (err: unknown): string => {
  if (err instanceof Error && err.message) return err.message;
  return 'Unexpected save error';
};

export const QuickLog: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editEntryId = typeof (location.state as { entryId?: string } | null)?.entryId === 'string'
    ? (location.state as { entryId: string }).entryId
    : null;
  const isEditMode = Boolean(editEntryId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [selectedObservations, setSelectedObservations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Rock' | 'Soil'>('Rock');
  const [customObservations, setCustomObservations] = useState(loadCustomObservations());
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // Save Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    isNewLocation: false,
    newLocationData: null as any,
    isValidLocation: false,
    entry_type_id: 'ET7', // Default to Quick Log
    risk_level_id: 'R1', // Default to Low
    status_id: 'ST_OPEN', // Default to Open
    summary: '',
    trigger_category: 'Routine observation',
    immediate_action: '',
    review_required: 0,
    is_handover_item: 0,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const author = getFieldAuthor();

  // Load draft on mount
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const draft = loadFormDraft(DRAFT_KEYS.quickLog);
    if (draft) {
      if (draft.formData) setFormData(draft.formData);
      if (Array.isArray(draft.selectedObservations)) setSelectedObservations(draft.selectedObservations);
      if (draft.activeTab === 'Rock' || draft.activeTab === 'Soil') setActiveTab(draft.activeTab);
      if (draft.isManualEdit !== undefined) setIsManualEdit(draft.isManualEdit);
    } else {
      const activeId = getActiveProjectId();
      if (activeId) {
        setFormData(prev => ({ ...prev, project_id: activeId }));
      }
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

  // Save draft on change
  useEffect(() => {
    if (isBootstrapping) return;
    saveFormDraft(DRAFT_KEYS.quickLog, {
      formData,
      selectedObservations,
      activeTab,
      isManualEdit,
    });
  }, [formData, selectedObservations, activeTab, isManualEdit, isBootstrapping]);

  const toggleObservation = (label: string) => {
    let newSelected = [...selectedObservations];
    if (newSelected.includes(label)) {
      newSelected = newSelected.filter(item => item !== label);
    } else {
      newSelected.push(label);
    }
    setSelectedObservations(newSelected);

    const suggestedRiskId = resolveSuggestedRiskId(newSelected);

    setFormData(prev => ({
      ...prev,
      risk_level_id: suggestedRiskId
    }));
  };

  useEffect(() => {
    if (isManualEdit) return;
    const generatedSummary = buildQuickLogSummary(
      selectedObservations,
      formData.trigger_category,
      formData.immediate_action,
      formData.review_required,
      customObservations.map(item => item.label)
    );
    setFormData(prev => ({ ...prev, summary: generatedSummary }));
  }, [selectedObservations, formData.trigger_category, formData.immediate_action, formData.review_required, customObservations, isManualEdit]);

  const addCustomObservation = () => {
    const label = prompt('Enter custom observation label:');
    if (label) {
      saveCustomObservation(label);
      setCustomObservations(loadCustomObservations());
    }
  };

  const removeCustomObservation = (label: string) => {
    deleteCustomObservation(label);
    setCustomObservations(loadCustomObservations());
    setSelectedObservations(prev => prev.filter(item => item !== label));
  };

  const loadExistingEntry = async (entryId: string) => {
    const existingEntry = entryRepo.getWithDetails(entryId);
    const existingQuickLog = quickLogRepo.getByEntryId(entryId);
    if (!existingEntry || !existingQuickLog) {
      throw new Error('Quick Log entry not found for edit mode.');
    }

    setFormData({
      project_id: existingEntry.project_id,
      location_id: existingEntry.location_id,
      isNewLocation: false,
      newLocationData: null as any,
      isValidLocation: true,
      entry_type_id: existingEntry.entry_type_id,
      risk_level_id: existingEntry.risk_level_id,
      status_id: existingEntry.status_id,
      summary: existingEntry.summary || '',
      trigger_category: existingQuickLog.trigger_category || 'Routine observation',
      immediate_action: existingQuickLog.immediate_action || '',
      review_required: existingQuickLog.review_required || 0,
      is_handover_item: existingEntry.is_handover_item,
    });
    setSelectedObservations(existingQuickLog.selected_observations || []);
    setActiveTab(existingQuickLog.observation_mode || 'Rock');
    setIsManualEdit(true);
  };

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const projs = await projectRepo.list();
      setProjects(projs);
      if (editEntryId) {
        await loadExistingEntry(editEntryId);
      }
    } catch (err) {
      console.error('Error loading quick log data:', err);
      alert('Failed to load Quick Log data.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [editEntryId]);

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
        <PageHeader title={isEditMode ? "Edit Quick Log" : "Quick Log"} />
        <div className="flex-1 overflow-y-auto flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_id || !formData.isValidLocation) {
      alert('Please fill in required fields and ensure location is valid');
      return;
    }

    if (selectedObservations.length === 0) {
      alert('Please select at least one observation before saving');
      return;
    }

    setIsSaving(true);
    let finalLocationId = formData.location_id;
    let entryId = editEntryId || '';

    try {
      if (formData.isNewLocation) {
        finalLocationId = await locationRepo.create(formData.newLocationData);
      }

      if (isEditMode && editEntryId) {
        await entryRepo.updateEntry(editEntryId, {
          project_id: formData.project_id,
          location_id: finalLocationId,
          risk_level_id: formData.risk_level_id,
          status_id: formData.status_id,
          summary: formData.summary,
          is_handover_item: formData.is_handover_item,
        });
        await quickLogRepo.updateByEntryId(editEntryId, {
          observation_mode: activeTab,
          selected_observations: selectedObservations,
          trigger_category: formData.trigger_category,
          immediate_action: formData.immediate_action,
          review_required: formData.review_required,
        });
        entryId = editEntryId;
      } else {
        console.log('[ENTRY] create start');
        entryId = await entryRepo.create({
          project_id: formData.project_id,
          location_id: finalLocationId,
          entry_type_id: formData.entry_type_id,
          risk_level_id: formData.risk_level_id,
          status_id: formData.status_id,
          author: author,
          summary: formData.summary,
          is_handover_item: formData.is_handover_item,
        });
        console.log('[ENTRY] create success', entryId);
        await quickLogRepo.create({
          entry_id: entryId,
          observation_mode: activeTab,
          selected_observations: selectedObservations,
          trigger_category: formData.trigger_category,
          immediate_action: formData.immediate_action,
          review_required: formData.review_required,
        });
      }
    } catch (err) {
      console.error('[ENTRY] create/update fail', err);
      if (!isEditMode && entryId) {
        try {
          await entryRepo.softDelete(entryId);
        } catch (cleanupErr) {
          console.error('[ENTRY] rollback fail', cleanupErr);
        }
      }
      const errorMessage = resolveQuickLogErrorMessage(err);
      alert(`${isEditMode ? 'Failed to update Quick Log' : 'Failed to save entry'}: ${errorMessage}`);
      setIsSaving(false);
      return;
    }

    try {
      await locationRepo.touch(finalLocationId);
    } catch (err) {
      console.error('[LOCATION] touch fail', err);
    }

    if (isAutoBackupEnabled()) {
      saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
    }

    if (photo) {
      let blobKey: string | null = null;
      try {
        console.log('[PHOTO] blob save start');
        blobKey = await putBlob(photo);
        console.log('[PHOTO] blob save success');
      } catch (err) {
        console.error('[PHOTO] blob save fail', err);
        alert('Entry saved, but photo failed to save');
      }

      if (blobKey) {
        try {
          console.log('[PHOTO] metadata save start');
          await execute(
            'INSERT INTO media_metadata (id, entry_id, blob_key, mime_type, caption) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), entryId, blobKey, photo.type, 'Quick Log Photo']
          );
          console.log('[PHOTO] metadata save success');
        } catch (err) {
          console.error('[PHOTO] metadata save fail', err);
          alert('Entry saved, but photo metadata failed to save');
        }
      }
    }

    setIsSaving(false);
    clearFormDraft(DRAFT_KEYS.quickLog);
    window.dispatchEvent(new Event('entries-changed'));
    if (isEditMode) {
      navigate(`/entry/${entryId}`);
      return;
    }
    setSavedEntryId(entryId);
    setShowSuccessModal(true);
  };

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form? This will remove all entered data and saved drafts.')) {
      setFormData({
        project_id: '',
        location_id: '',
        isNewLocation: false,
        newLocationData: null as any,
        isValidLocation: false,
        entry_type_id: 'ET7',
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        summary: '',
        trigger_category: 'Routine observation',
        immediate_action: '',
        review_required: 0,
        is_handover_item: 0,
      });
      setPhoto(null);
      setSelectedObservations([]);
      setActiveTab('Rock');
      setIsManualEdit(false);
      clearFormDraft(DRAFT_KEYS.quickLog);
    }
  };

  return (
    <div className="theme-quick-log flex flex-col h-screen bg-gray-50">
      <PageHeader title={isEditMode ? "Edit Quick Log" : "Quick Log"} />
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

            <QuickLogObservationLibrary
              activeTab={activeTab}
              onTabChange={setActiveTab}
              categories={activeTab === 'Rock' ? OBSERVATION_CATEGORIES : SOIL_OBSERVATION_CATEGORIES}
              selectedObservations={selectedObservations}
              customObservations={customObservations}
              onToggleObservation={toggleObservation}
              onAddCustomObservation={addCustomObservation}
              onRemoveCustomObservation={removeCustomObservation}
            />

            <QuickLogEventChainPanel
              triggerCategories={TRIGGER_CATEGORIES}
              triggerCategory={formData.trigger_category}
              immediateAction={formData.immediate_action}
              reviewRequired={formData.review_required}
              onTriggerChange={(value) => setFormData({ ...formData, trigger_category: value })}
              onImmediateActionChange={(value) => setFormData({ ...formData, immediate_action: value })}
              onToggleReviewRequired={() => setFormData({ ...formData, review_required: formData.review_required ? 0 : 1 })}
            />

            <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Entry Details</h2>
              <div className={isEditMode ? 'opacity-70' : ''}>
                <Dropdown
                  label="Entry Type"
                  tableName="ref_entry_type"
                  value={formData.entry_type_id}
                  onChange={(val) => {
                    if (!isEditMode) setFormData({ ...formData, entry_type_id: val });
                  }}
                  required
                />
              </div>
              <Dropdown
                label="Risk Level"
                tableName="ref_risk_level"
                value={formData.risk_level_id}
                onChange={(val) => setFormData({ ...formData, risk_level_id: val })}
                required
              />
              <Dropdown
                label="Status"
                tableName="ref_status"
                value={formData.status_id}
                onChange={(val) => setFormData({ ...formData, status_id: val })}
                required
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

            <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Summary</label>
                {isManualEdit && (
                  <button
                    type="button"
                    onClick={() => setIsManualEdit(false)}
                    className="text-[10px] font-bold uppercase text-emerald-600 hover:underline"
                  >
                    Use generated summary
                  </button>
                )}
              </div>
              <textarea
                value={formData.summary}
                onChange={(e) => { setFormData({ ...formData, summary: e.target.value }); setIsManualEdit(true); }}
                className="min-h-[100px] w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="Generated from observations and event chain. You can override it here if needed..."
              />
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Photo</label>
              <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50">
                {photo ? (
                  <img src={URL.createObjectURL(photo)} className="h-full w-full object-cover" alt="Preview" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <Camera size={32} />
                    <span className="text-xs font-semibold">Tap to add photo</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--module-accent)] py-4 font-bold text-white shadow-lg shadow-emerald-100 disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Save size={20} />
              {isSaving ? 'Saving...' : 'Save Quick Log'}
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






