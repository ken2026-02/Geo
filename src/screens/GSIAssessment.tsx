import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Save, Info, Trash2, Flag } from 'lucide-react';
import { projectRepo, Project } from '../repositories/projectRepo';
import { locationRepo, Location } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { saveGSIAssessment } from '../repositories/gsiRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { getActiveProjectId } from '../state/activeProject';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft } from '../state/formDrafts';

const STRUCTURE_CLASSES = [
  'Massive / Intact',
  'Blocky',
  'Very blocky',
  'Disintegrated',
  'Laminated / Sheared'
];

const SURFACE_CONDITIONS = [
  'Very rough, unweathered',
  'Rough, slightly weathered',
  'Smooth, moderately weathered',
  'Slickensided / clay-coated',
  'Very poor (gouge / crushed)'
];

const CONFIDENCE_LEVELS = ['High', 'Medium', 'Low'];

// Simple internal matrix mapping for GSI (Structure vs Surface Condition)
// Rows: Structure (0 to 4)
// Cols: Surface Condition (0 to 4)
// Values: [min, max]
const GSI_MATRIX: [number, number][][] = [
  // Massive / Intact
  [[85, 100], [75, 90], [65, 80], [55, 70], [45, 60]],
  // Blocky
  [[75, 90], [65, 80], [55, 70], [45, 60], [35, 50]],
  // Very blocky
  [[65, 80], [55, 70], [45, 60], [35, 50], [25, 40]],
  // Disintegrated
  [[55, 70], [45, 60], [35, 50], [25, 40], [15, 30]],
  // Laminated / Sheared
  [[45, 60], [35, 50], [25, 40], [15, 30], [5, 20]]
];

export default function GSIAssessment() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [projectId, setProjectId] = useState(getActiveProjectId() || '');
  const [locationId, setLocationId] = useState('');
  
  const [structureClass, setStructureClass] = useState(STRUCTURE_CLASSES[0]);
  const [surfaceCondition, setSurfaceCondition] = useState(SURFACE_CONDITIONS[0]);
  const [confidenceLevel, setConfidenceLevel] = useState(CONFIDENCE_LEVELS[1]);
  const [notes, setNotes] = useState('');
  const [isHandoverItem, setIsHandoverItem] = useState(0);

  const [gsiMin, setGsiMin] = useState(0);
  const [gsiMax, setGsiMax] = useState(0);
  const [gsiMid, setGsiMid] = useState(0);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.gsiAssessment);
    if (draft) {
      setProjectId(draft.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || '');
      setStructureClass(draft.structureClass || STRUCTURE_CLASSES[0]);
      setSurfaceCondition(draft.surfaceCondition || SURFACE_CONDITIONS[0]);
      setConfidenceLevel(draft.confidenceLevel || CONFIDENCE_LEVELS[1]);
      setNotes(draft.notes || '');
      setIsHandoverItem(draft.isHandoverItem || 0);
    } else {
      setProjectId(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      setLocations(locationRepo.getAll());
    } else {
      setLocations([]);
    }
  }, [projectId]);

  useEffect(() => {
    const structIdx = STRUCTURE_CLASSES.indexOf(structureClass);
    const surfIdx = SURFACE_CONDITIONS.indexOf(surfaceCondition);
    
    if (structIdx >= 0 && surfIdx >= 0) {
      const [min, max] = GSI_MATRIX[structIdx][surfIdx];
      setGsiMin(min);
      setGsiMax(max);
      setGsiMid(Math.round((min + max) / 2));
    }
  }, [structureClass, surfaceCondition]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.gsiAssessment, {
      projectId, locationId, structureClass, surfaceCondition, confidenceLevel, notes, isHandoverItem
    });
  }, [projectId, locationId, structureClass, surfaceCondition, confidenceLevel, notes, isHandoverItem]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId(getActiveProjectId() || '');
      setLocationId('');
      setStructureClass(STRUCTURE_CLASSES[0]);
      setSurfaceCondition(SURFACE_CONDITIONS[0]);
      setConfidenceLevel(CONFIDENCE_LEVELS[1]);
      setNotes('');
      setIsHandoverItem(0);
      clearFormDraft(DRAFT_KEYS.gsiAssessment);
    }
  };

  const handleSave = async () => {
    if (!projectId || !locationId) {
      alert('Please select a project and location.');
      return;
    }

    const gsiId = uuidv4();

    const gsiData = {
      id: gsiId,
      entry_id: '', // Will be set after entry creation
      structure_class: structureClass,
      surface_condition_class: surfaceCondition,
      gsi_min: gsiMin,
      gsi_max: gsiMax,
      gsi_mid: gsiMid,
      confidence_level: confidenceLevel,
      notes
    };

    const summary = phraseBuilder.buildGSIParagraph(gsiData);

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: locationId,
        entry_type_id: 'ET14', // Geological Strength Index
        risk_level_id: 'R1', // Default Low
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: isHandoverItem
      });

      gsiData.entry_id = entryId;
      await saveGSIAssessment(gsiData);
      
      clearFormDraft(DRAFT_KEYS.gsiAssessment);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save GSI:', error);
      alert('Failed to save GSI Assessment. Check console for details.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Geological Strength Index (GSI)" />
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

          <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            {/* Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectSelector
                value={projectId}
                onChange={(id) => {
                  setProjectId(id);
                  setLocationId('');
                }}
              />
              <LocationSelector
                value={locationId}
                onChange={(id) => setLocationId(id)}
              />
            </div>

            {/* GSI Inputs */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Assessment Parameters</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Structure / Blockiness</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={structureClass}
                  onChange={(e) => setStructureClass(e.target.value)}
                >
                  {STRUCTURE_CLASSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Surface Condition</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={surfaceCondition}
                  onChange={(e) => setSurfaceCondition(e.target.value)}
                >
                  {SURFACE_CONDITIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confidence Level</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(e.target.value)}
                >
                  {CONFIDENCE_LEVELS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Result */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col items-center justify-center">
              <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Estimated GSI</div>
              <div className="text-4xl font-bold text-indigo-600 mb-2">{gsiMin} - {gsiMax}</div>
              <div className="text-sm text-slate-600 font-medium">Midpoint: {gsiMid}</div>
              <div className="mt-3 flex items-start text-xs text-slate-500 bg-slate-100 p-2 rounded">
                <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <p>GSI is provided as guidance only and requires engineering judgement.</p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional observations..."
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm mt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Flag size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-800">Handover Item</div>
                  <div className="text-xs text-slate-500">Flag for shift handover</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverItem(isHandoverItem ? 0 : 1)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHandoverItem ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHandoverItem ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 flex items-center justify-center transition-colors"
            >
              <Save className="w-5 h-5 mr-2" />
              Save GSI Assessment
            </button>
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
}


