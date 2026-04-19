import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectRepo, Project } from '../repositories/projectRepo';
import { locationRepo, Location } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { rmrRepo } from '../repositories/rmrRepo';
import { getActiveProjectId } from '../state/activeProject';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { Save, Trash2, Flag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const RockMassRating: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [formData, setFormData] = useState({
    project_id: getActiveProjectId() || '',
    location_id: '',
    ucs_rating: '0',
    rqd_rating: '0',
    spacing_rating: '0',
    condition_rating: '0',
    groundwater_rating: '0',
    orientation_adjustment: '0',
    notes: '',
    is_handover_item: 0
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.rockMassRating);
    if (draft) {
      setFormData(draft);
    }
  }, []);

  useEffect(() => {
    if (formData.project_id) {
      setLocations(locationRepo.getAll()); // locations are not strictly bound to project_id in schema
    }
  }, [formData.project_id]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.rockMassRating, formData);
  }, [formData]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setFormData({
        project_id: getActiveProjectId() || '',
        location_id: '',
        ucs_rating: '0',
        rqd_rating: '0',
        spacing_rating: '0',
        condition_rating: '0',
        groundwater_rating: '0',
        orientation_adjustment: '0',
        notes: '',
        is_handover_item: 0
      });
      clearFormDraft(DRAFT_KEYS.rockMassRating);
    }
  };

  const totalRMR = 
    (parseNumericInput(formData.ucs_rating) ?? 0) + 
    (parseNumericInput(formData.rqd_rating) ?? 0) + 
    (parseNumericInput(formData.spacing_rating) ?? 0) + 
    (parseNumericInput(formData.condition_rating) ?? 0) + 
    (parseNumericInput(formData.groundwater_rating) ?? 0) + 
    (parseNumericInput(formData.orientation_adjustment) ?? 0);

  let rockClass = '';
  if (totalRMR >= 81) rockClass = 'Very Good';
  else if (totalRMR >= 61) rockClass = 'Good';
  else if (totalRMR >= 41) rockClass = 'Fair';
  else if (totalRMR >= 21) rockClass = 'Poor';
  else rockClass = 'Very Poor';

  const handleSave = async () => {
    if (!formData.project_id || !formData.location_id) {
      alert('Project and Location are required.');
      return;
    }

    setIsSaving(true);
    try {
      const rmrData = {
        id: uuidv4(),
        entry_id: '', // Will be set after entry creation
        ucs_rating: parseNumericInput(formData.ucs_rating) ?? 0,
        rqd_rating: parseNumericInput(formData.rqd_rating) ?? 0,
        spacing_rating: parseNumericInput(formData.spacing_rating) ?? 0,
        condition_rating: parseNumericInput(formData.condition_rating) ?? 0,
        groundwater_rating: parseNumericInput(formData.groundwater_rating) ?? 0,
        orientation_adjustment: parseNumericInput(formData.orientation_adjustment) ?? 0,
        total_rmr: totalRMR,
        rock_class: rockClass,
        notes: formData.notes
      };

      const summary = phraseBuilder.buildRMRParagraph(rmrData);

      const entryId = await entryRepo.create({
        project_id: formData.project_id,
        location_id: formData.location_id,
        entry_type_id: 'ET13', // Rock Mass Rating
        risk_level_id: 'R1', // Default Low
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: formData.is_handover_item
      });

      rmrData.entry_id = entryId;
      rmrRepo.create(rmrData);

      clearFormDraft(DRAFT_KEYS.rockMassRating);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to save RMR:', err);
      alert('Failed to save Rock Mass Rating. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <PageHeader title="Rock Mass Rating" />
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          
          <div className="flex justify-end">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-600 font-medium rounded-lg text-sm hover:bg-zinc-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
          </div>

          {/* Context */}
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
            <ProjectSelector
              value={formData.project_id}
              onChange={(id) => setFormData({ ...formData, project_id: id, location_id: '' })}
            />

            <LocationSelector
              value={formData.location_id}
              onChange={(id) => setFormData({ ...formData, location_id: id })}
            />
          </div>

          {/* RMR Inputs */}
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">RMR Parameters</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">UCS Rating</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.ucs_rating}
                  onChange={(e) => setFormData({ ...formData, ucs_rating: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">RQD Rating</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.rqd_rating}
                  onChange={(e) => setFormData({ ...formData, rqd_rating: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">Spacing Rating</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.spacing_rating}
                  onChange={(e) => setFormData({ ...formData, spacing_rating: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">Condition Rating</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.condition_rating}
                  onChange={(e) => setFormData({ ...formData, condition_rating: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">Groundwater Rating</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.groundwater_rating}
                  onChange={(e) => setFormData({ ...formData, groundwater_rating: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">Orientation Adj.</label>
                <input
                  type="text" inputMode="decimal"
                  value={formData.orientation_adjustment}
                  onChange={(e) => setFormData({ ...formData, orientation_adjustment: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-800"
                />
              </div>
            </div>
          </div>

          {/* Live Calculation Result */}
          <div className="flex flex-col gap-2 rounded-2xl bg-indigo-50 p-4 border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-800">Total RMR</span>
              <span className="text-2xl font-black text-indigo-600">{totalRMR}</span>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-100 pt-2">
              <span className="text-xs font-bold text-indigo-600/70 uppercase">Rock Class</span>
              <span className="text-sm font-bold text-indigo-800">{rockClass}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-zinc-500 px-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-[100px] rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-sm"
              placeholder="Add any additional notes here..."
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm mt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Flag size={20} />
              </div>
              <div>
                <div className="font-medium text-zinc-800">Handover Item</div>
                <div className="text-xs text-zinc-500">Flag for shift handover</div>
              </div>
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

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/80 p-4 backdrop-blur-md pb-safe">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.project_id || !formData.location_id}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white shadow-lg shadow-emerald-200 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Save size={20} />
            {isSaving ? 'Saving...' : 'Save RMR Assessment'}
          </button>
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

