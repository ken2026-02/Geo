import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Dropdown } from '../components/Dropdown';
import { MultiSelect } from '../components/MultiSelect';
import { locationRepo } from '../repositories/locationRepo';
import { projectRepo, Project } from '../repositories/projectRepo';
import { entryRepo } from '../repositories/entryRepo';
import { investigationRepo, InvestigationType as InvestigationRepoType } from '../repositories/investigationRepo';
import { saveAutoBackupZip } from '../utils/autoBackup';
import { refRepo, RefItem } from '../repositories/refRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { LoggingAssistant } from '../components/LoggingAssistant';
import { LoggingStyle } from '../utils/loggingStyle';
import { Save, ArrowLeft, Info, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getLoggingHints } from '../utils/loggingGuide';
import { getLoggingQualifiersPreference, getLoggingStylePreference, isAutoBackupEnabled, setLoggingQualifiersPreference, setLoggingStylePreference } from '../state/userPreferences';

export const InvestigationLog: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editEntryId = typeof (location.state as { entryId?: string } | null)?.entryId === 'string'
    ? (location.state as { entryId: string }).entryId
    : null;
  const isEditMode = Boolean(editEntryId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  
  // Save Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  
  // Section A: Metadata
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);
  const [isValidLocation, setIsValidLocation] = useState(false);
  const [riskLevelId, setRiskLevelId] = useState('R1'); // Default Low
  const [statusId, setStatusId] = useState('ST_OPEN'); // Default Open
  const [isHandoverItem, setIsHandoverItem] = useState(0);
  const [author] = useState('Field Engineer'); // Prefilled

  // Section B: Type Selector
  const [type, setType] = useState<InvestigationRepoType>('Cohesive');

  // Section C: Dynamic Fields
  const [formData, setFormData] = useState<any>({});
  const [secondaryComponents, setSecondaryComponents] = useState<string[]>([]);

  // Logging Assistant State
  const [loggingStyle, setLoggingStyle] = useState<LoggingStyle>(getLoggingStylePreference());
  const [qualifiers, setQualifiers] = useState<string[]>(getLoggingQualifiersPreference());
  const [editedSummary, setEditedSummary] = useState('');
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [refMaps, setRefMaps] = useState<Record<string, Map<string, RefItem>>>({});

  // Load draft on mount
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const draft = loadFormDraft(DRAFT_KEYS.investigationLog);
    if (draft) {
      if (draft.projectId) setProjectId(draft.projectId);
      if (draft.locationId) setLocationId(draft.locationId);
      if (draft.riskLevelId) setRiskLevelId(draft.riskLevelId);
      if (draft.statusId) setStatusId(draft.statusId);
      if (draft.isHandoverItem !== undefined) setIsHandoverItem(draft.isHandoverItem);
      if (draft.type) setType(draft.type);
      if (draft.formData) setFormData(draft.formData);
      if (draft.secondaryComponents) setSecondaryComponents(draft.secondaryComponents);
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
    if (navState.projectId) setProjectId((prev) => prev || navState.projectId || '');
    if (navState.locationId) {
      setLocationId((prev) => prev || navState.locationId || '');
      setIsValidLocation((prev) => prev || !!navState.locationId);
    }
  }, [location.state, isEditMode, isBootstrapping]);

  // Save draft on change
  useEffect(() => {
    if (isBootstrapping) return;
    saveFormDraft(DRAFT_KEYS.investigationLog, {
      projectId,
      locationId,
      riskLevelId,
      statusId,
      isHandoverItem,
      type,
      formData,
      secondaryComponents,
      loggingStyle,
      qualifiers,
      editedSummary,
      isManualEdit
    });
  }, [projectId, locationId, riskLevelId, statusId, isHandoverItem, type, formData, secondaryComponents, loggingStyle, qualifiers, editedSummary, isManualEdit, isBootstrapping]);

  useEffect(() => {
    const loadInitial = async () => {
      setProjects(projectRepo.getAll());

      const tables = [
        'ref_soil_material_type', 'ref_soil_plasticity', 'ref_soil_moisture',
        'ref_soil_consistency', 'ref_soil_structure', 'ref_origin_soil',
        'ref_soil_secondary_components', 'ref_soil_grading', 'ref_soil_density',
        'ref_fill_type', 'ref_fill_composition', 'ref_fill_inclusions',
        'ref_fill_contaminants', 'ref_transition_material'
      ];
      const maps: Record<string, Map<string, RefItem>> = {};
      for (const table of tables) {
        maps[table] = await refRepo.getRefMap(table);
      }
      setRefMaps(maps);

      if (editEntryId) {
        const existingEntry = entryRepo.getWithDetails(editEntryId);
        const existingInvestigation = investigationRepo.getByEntryId(editEntryId);
        if (!existingEntry || !existingInvestigation) {
          alert('Failed to load Investigation Log for edit mode.');
          return;
        }

        setProjectId(existingEntry.project_id);
        setLocationId(existingEntry.location_id);
        setIsNewLocation(false);
        setNewLocationData(null);
        setIsValidLocation(true);
        setRiskLevelId(existingEntry.risk_level_id);
        setStatusId(existingEntry.status_id);
        setIsHandoverItem(existingEntry.is_handover_item);
        setType(existingInvestigation.investigation_type);
        setFormData({
          material_type_id: existingInvestigation.material_type_id || '',
          plasticity_id: existingInvestigation.plasticity_id || '',
          moisture_id: existingInvestigation.moisture_id || '',
          consistency_id: existingInvestigation.consistency_id || '',
          structure_id: existingInvestigation.structure_id || '',
          origin_id: existingInvestigation.origin_id || '',
          grain_size_id: existingInvestigation.grain_size_id || '',
          grading_id: existingInvestigation.grading_id || '',
          fines_content_id: existingInvestigation.fines_content_id || '',
          density_id: existingInvestigation.density_id || '',
          angularity_id: existingInvestigation.angularity_id || '',
          fill_type_id: existingInvestigation.fill_type_id || '',
          composition_id: existingInvestigation.composition_id || '',
          contaminant_id: existingInvestigation.contaminant_id || '',
          inclusion_id: existingInvestigation.inclusion_id || '',
          material_id: existingInvestigation.transition_material_id || '',
          notes: existingInvestigation.notes || ''
        });
        setSecondaryComponents(existingInvestigation.secondary_components ? JSON.parse(existingInvestigation.secondary_components) : []);
        setEditedSummary(existingEntry.summary || '');
        setIsManualEdit(true);
      }

      setIsBootstrapping(false);
    };
    loadInitial();
  }, [editEntryId]);

  // Update generated summary
  useEffect(() => {
    if (Object.keys(refMaps).length === 0) return;

    const syncLookup = {
      getLabel: (table: string, id: string | null | undefined) => {
        if (!id) return '';
        return refMaps[table]?.get(id)?.label || id;
      }
    };

    const secondaryLabel = secondaryComponents
      .map(id => syncLookup.getLabel('ref_soil_secondary_components', id))
      .join(' and ');

    const summary = phraseBuilder.buildInvestigationLoggingParagraph(
      loggingStyle,
      type,
      { ...formData, secondary_component_id: secondaryLabel },
      syncLookup,
      formData.notes,
      qualifiers
    );

    if (!isManualEdit) {
      setEditedSummary(summary);
    }
  }, [formData, type, secondaryComponents, loggingStyle, qualifiers, refMaps, isManualEdit]);

  const handleSave = async () => {
    if (!projectId || !isValidLocation) {
      alert('Please select project and ensure location is valid');
      return;
    }

    try {
      let finalLocationId = locationId;
      if (isNewLocation) {
        finalLocationId = await locationRepo.create(newLocationData);
      }

      let entryId = editEntryId || '';
    if (isEditMode && editEntryId) {
      await entryRepo.updateEntry(editEntryId, {
        project_id: projectId,
        location_id: finalLocationId,
        risk_level_id: riskLevelId,
        status_id: statusId,
        summary: editedSummary,
        is_handover_item: isHandoverItem
      });
      await investigationRepo.updateByEntryId(editEntryId, {
        investigation_type: type as InvestigationRepoType,
        material_type_id: formData.material_type_id || null,
        plasticity_id: formData.plasticity_id || null,
        moisture_id: formData.moisture_id || null,
        consistency_id: formData.consistency_id || null,
        structure_id: formData.structure_id || null,
        origin_id: formData.origin_id || null,
        secondary_components: secondaryComponents.length ? JSON.stringify(secondaryComponents) : null,
        grain_size_id: formData.grain_size_id || null,
        grading_id: formData.grading_id || null,
        fines_content_id: formData.fines_content_id || null,
        density_id: formData.density_id || null,
        angularity_id: formData.angularity_id || null,
        fill_type_id: formData.fill_type_id || null,
        composition_id: formData.composition_id || null,
        contaminant_id: formData.contaminant_id || null,
        inclusion_id: formData.inclusion_id || null,
        transition_material_id: formData.material_id || null,
        notes: formData.notes || null
      });
      entryId = editEntryId;
    } else {
      entryId = await entryRepo.create({
        project_id: projectId,
        location_id: finalLocationId,
        entry_type_id: 'ET12',
        risk_level_id: riskLevelId,
        status_id: statusId,
        author: author,
        summary: editedSummary,
        is_handover_item: isHandoverItem
      });

      await investigationRepo.create({
        entry_id: entryId,
        investigation_type: type as InvestigationRepoType,
        material_type_id: formData.material_type_id || null,
        plasticity_id: formData.plasticity_id || null,
        moisture_id: formData.moisture_id || null,
        consistency_id: formData.consistency_id || null,
        structure_id: formData.structure_id || null,
        origin_id: formData.origin_id || null,
        secondary_components: secondaryComponents.length ? JSON.stringify(secondaryComponents) : null,
        grain_size_id: formData.grain_size_id || null,
        grading_id: formData.grading_id || null,
        fines_content_id: formData.fines_content_id || null,
        density_id: formData.density_id || null,
        angularity_id: formData.angularity_id || null,
        fill_type_id: formData.fill_type_id || null,
        composition_id: formData.composition_id || null,
        contaminant_id: formData.contaminant_id || null,
        inclusion_id: formData.inclusion_id || null,
        transition_material_id: formData.material_id || null,
        notes: formData.notes || null
      });
    }

      try {
        await locationRepo.touch(finalLocationId);
      } catch (touchErr) {
        console.error('Failed to touch location after investigation save:', touchErr);
      }

      // Save preferences
    setLoggingStylePreference(loggingStyle);
    setLoggingQualifiersPreference(qualifiers);

      // Trigger auto-backup if enabled (fire-and-forget)
      if (isAutoBackupEnabled()) {
        saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
      }

      clearFormDraft(DRAFT_KEYS.investigationLog);
      window.dispatchEvent(new Event('entries-changed'));
      if (isEditMode) {
        navigate(`/entry/${entryId}`);
        return;
      }
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to save investigation log');
    }
  };

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form? This will remove all entered data and saved drafts.')) {
      setProjectId('');
      setLocationId('');
      setRiskLevelId('R1');
      setStatusId('ST_OPEN');
      setIsHandoverItem(0);
      setType('Cohesive');
      setFormData({});
      setSecondaryComponents([]);
      setEditedSummary('');
      setIsManualEdit(false);
      clearFormDraft(DRAFT_KEYS.investigationLog);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const hints = getLoggingHints({
    material: type === 'Cohesive' ? 'Clay' : (type === 'Granular' ? 'Sand' : undefined)
  });

  return (
    <div className="theme-investigation-log flex flex-col h-screen bg-gray-50">
      <PageHeader title={isEditMode ? "Edit Investigation Log" : "Investigation Log"} />
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
          <div className="flex flex-col gap-6 pb-10">
            {/* Section A: Metadata */}
        <section className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">Entry Metadata</h2>
          </div>
          
          <ProjectSelector
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              setLocationId('');
            }}
          />

          <LocationSelector
            value={locationId}
            onChange={(id, isNew, data, isValid) => {
              setLocationId(id);
              setIsNewLocation(isNew);
              setNewLocationData(data);
              setIsValidLocation(!!isValid);
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown label="Risk Level" tableName="ref_risk_level" value={riskLevelId} onChange={setRiskLevelId} />
            <Dropdown label="Status" tableName="ref_status" value={statusId} onChange={setStatusId} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Author</label>
            <input
              type="text"
              value={author}
              readOnly
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-100">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800">Handover Item</span>
              <span className="text-[10px] text-zinc-400">Include in daily report</span>
            </div>
            <button
              type="button"
              onClick={() => setIsHandoverItem(isHandoverItem ? 0 : 1)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHandoverItem ? 'bg-emerald-500' : 'bg-zinc-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHandoverItem ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        {/* Section B: Type Selector */}
        <section className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">Investigation Type</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['Cohesive', 'Granular', 'Fill', 'Transition'] as InvestigationRepoType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t !== type && (Object.keys(formData).length > 0 || secondaryComponents.length > 0)) {
                    const confirmed = window.confirm('Switching investigation type will clear the current fields. Continue?');
                    if (!confirmed) return;
                  }
                  setType(t);
                  setFormData({});
                  setSecondaryComponents([]);
                }}
                className={`p-3 rounded-lg text-sm font-medium border transition-all ${
                  type === t 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Section C: Dynamic Fields */}
        <motion.section 
          key={type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">{type} Details</h2>
          </div>

          {hints.length > 0 && (
            <div className="rounded-xl bg-red-50 p-3 border border-red-100">
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

          {type === 'Cohesive' && (
            <>
              <Dropdown label="Soil Type" tableName="ref_soil_material_type" value={formData.material_type_id || ''} onChange={(v) => updateField('material_type_id', v)} required />
              <Dropdown label="Plasticity" tableName="ref_soil_plasticity" value={formData.plasticity_id || ''} onChange={(v) => updateField('plasticity_id', v)} />
              <Dropdown label="Moisture" tableName="ref_soil_moisture" value={formData.moisture_id || ''} onChange={(v) => updateField('moisture_id', v)} />
              <Dropdown label="Consistency" tableName="ref_soil_consistency" value={formData.consistency_id || ''} onChange={(v) => updateField('consistency_id', v)} />
              <Dropdown label="Structure" tableName="ref_soil_structure" value={formData.structure_id || ''} onChange={(v) => updateField('structure_id', v)} />
              <Dropdown label="Origin" tableName="ref_origin_soil" value={formData.origin_id || ''} onChange={(v) => updateField('origin_id', v)} />
              <MultiSelect label="Secondary Components" tableName="ref_soil_secondary_components" value={secondaryComponents} onChange={setSecondaryComponents} />
            </>
          )}

          {type === 'Granular' && (
            <>
              <Dropdown label="Soil Type" tableName="ref_soil_material_type" value={formData.material_type_id || ''} onChange={(v) => updateField('material_type_id', v)} required />
              <Dropdown label="Grain Size" tableName="ref_soil_grain_size" value={formData.grain_size_id || ''} onChange={(v) => updateField('grain_size_id', v)} />
              <Dropdown label="Grading" tableName="ref_soil_grading" value={formData.grading_id || ''} onChange={(v) => updateField('grading_id', v)} />
              <Dropdown label="Fines Content" tableName="ref_soil_fines_content" value={formData.fines_content_id || ''} onChange={(v) => updateField('fines_content_id', v)} />
              <Dropdown label="Moisture" tableName="ref_soil_moisture" value={formData.moisture_id || ''} onChange={(v) => updateField('moisture_id', v)} />
              <Dropdown label="Density" tableName="ref_soil_density" value={formData.density_id || ''} onChange={(v) => updateField('density_id', v)} />
              <Dropdown label="Angularity" tableName="ref_soil_angularity" value={formData.angularity_id || ''} onChange={(v) => updateField('angularity_id', v)} />
              <Dropdown label="Origin" tableName="ref_origin_soil" value={formData.origin_id || ''} onChange={(v) => updateField('origin_id', v)} />
              <MultiSelect label="Secondary Components" tableName="ref_soil_secondary_components" value={secondaryComponents} onChange={setSecondaryComponents} />
            </>
          )}

          {type === 'Fill' && (
            <>
              <Dropdown label="Fill Type" tableName="ref_fill_type" value={formData.fill_type_id || ''} onChange={(v) => updateField('fill_type_id', v)} required />
              <Dropdown label="Composition" tableName="ref_fill_composition" value={formData.composition_id || ''} onChange={(v) => updateField('composition_id', v)} />
              <Dropdown label="Contaminants" tableName="ref_fill_contaminants" value={formData.contaminant_id || ''} onChange={(v) => updateField('contaminant_id', v)} />
              <Dropdown label="Moisture" tableName="ref_soil_moisture" value={formData.moisture_id || ''} onChange={(v) => updateField('moisture_id', v)} />
              <div className="grid grid-cols-2 gap-4">
                <Dropdown label="Density" tableName="ref_soil_density" value={formData.density_id || ''} onChange={(v) => updateField('density_id', v)} />
                <Dropdown label="Consistency" tableName="ref_soil_consistency" value={formData.consistency_id || ''} onChange={(v) => updateField('consistency_id', v)} />
              </div>
              <Dropdown label="Structure" tableName="ref_soil_structure" value={formData.structure_id || ''} onChange={(v) => updateField('structure_id', v)} />
              <Dropdown label="Inclusions" tableName="ref_fill_inclusions" value={formData.inclusion_id || ''} onChange={(v) => updateField('inclusion_id', v)} />
            </>
          )}

          {type === 'Transition' && (
            <>
              <Dropdown label="Transition Material" tableName="ref_transition_material" value={formData.material_id || ''} onChange={(v) => updateField('material_id', v)} required />
              <Dropdown label="Origin" tableName="ref_origin_soil" value={formData.origin_id || ''} onChange={(v) => updateField('origin_id', v)} />
              <Dropdown label="Moisture" tableName="ref_soil_moisture" value={formData.moisture_id || ''} onChange={(v) => updateField('moisture_id', v)} />
              <Dropdown label="Structure" tableName="ref_soil_structure" value={formData.structure_id || ''} onChange={(v) => updateField('structure_id', v)} />
            </>
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Notes / Remarks</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Additional observations..."
              className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none min-h-[100px]"
            />
          </div>
        </motion.section>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSave}
            className="flex-1 bg-[var(--module-accent)] text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-95 hover:opacity-90 transition-opacity"
          >
            <Save size={20} />
            {isEditMode ? 'Update Investigation' : 'Save Investigation'}
          </button>
        </div>
          </div>
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



