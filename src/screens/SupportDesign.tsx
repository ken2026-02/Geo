import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Trash2, Flag, Info, Calculator as CalcIcon } from 'lucide-react';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { supportDesignRepo, SupportDesign } from '../repositories/supportDesignRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { engineeringDataService, EngineeringSnapshot } from '../services/engineeringDataService';
import { AUTHORITATIVE_FIELDS } from '../engineering/authoritativeFields';

export default function SupportDesignScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const [qValue, setQValue] = useState('');
  const [rmrValue, setRmrValue] = useState('');
  const [gsiValue, setGsiValue] = useState('');
  const [failureMode, setFailureMode] = useState('none');
  const [groundwater, setGroundwater] = useState('dry');
  const [span, setSpan] = useState('');
  const [notes, setNotes] = useState('');
  const [isHandoverItem, setIsHandoverItem] = useState(0);

  const [result, setResult] = useState<Partial<SupportDesign>>({});

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);
  const [refCalculator, setRefCalculator] = useState<any>(null);

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.supportDesign);
    if (draft) {
      setSelectedProject(draft.selectedProject || getActiveProjectId() || '');
      setSelectedLocation(draft.selectedLocation || '');
      setQValue(draft.qValue || '');
      setRmrValue(draft.rmrValue || '');
      setGsiValue(draft.gsiValue || '');
      setFailureMode(draft.failureMode || 'none');
      setGroundwater(draft.groundwater || 'dry');
      setSpan(draft.span || '');
      setNotes(draft.notes || '');
      setIsHandoverItem(draft.isHandoverItem || 0);
    } else {
      setSelectedProject(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setLocations(locationRepo.listLocationsForProject(selectedProject));
    } else {
      setLocations([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && selectedLocation) {
      const data = engineeringDataService.getEngineeringSnapshotByLocation(selectedLocation);
      setSnapshot(data);
      setRefCalculator(engineeringDataService.getLatestSupportCalculatorByLocation(selectedLocation));
    } else {
      setSnapshot(null);
      setRefCalculator(null);
    }
  }, [selectedProject, selectedLocation]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.supportDesign, {
      selectedProject, selectedLocation, qValue, rmrValue, gsiValue, failureMode, groundwater, span, notes, isHandoverItem
    });
  }, [selectedProject, selectedLocation, qValue, rmrValue, gsiValue, failureMode, groundwater, span, notes, isHandoverItem]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setSelectedProject('');
      setSelectedLocation('');
      setQValue('');
      setRmrValue('');
      setGsiValue('');
      setFailureMode('none');
      setGroundwater('dry');
      setSpan('');
      setNotes('');
      setIsHandoverItem(0);
      clearFormDraft(DRAFT_KEYS.supportDesign);
    }
  };

  // Simple deterministic rules
  useEffect(() => {
    let supportClass = 'Class I (Spot bolting)';
    let boltLength = 3.0;
    let boltSpacing = 2.0;
    let meshRequired = 0;
    let shotcreteThickness = 0;
    let drainageRequired = 0;

    const q = parseFloat(qValue);
    const rmr = parseInt(rmrValue);
    const gsi = parseInt(gsiValue);
    const spanVal = parseFloat(span) || 5.0;

    // Estimate rock quality
    let quality = 'good'; // good, fair, poor, very_poor
    if (!isNaN(q)) {
      if (q < 0.1) quality = 'very_poor';
      else if (q < 1) quality = 'poor';
      else if (q < 10) quality = 'fair';
    } else if (!isNaN(rmr)) {
      if (rmr < 20) quality = 'very_poor';
      else if (rmr < 40) quality = 'poor';
      else if (rmr < 60) quality = 'fair';
    } else if (!isNaN(gsi)) {
      if (gsi < 25) quality = 'very_poor';
      else if (gsi < 45) quality = 'poor';
      else if (gsi < 65) quality = 'fair';
    }

    // Base support on quality
    if (quality === 'very_poor') {
      supportClass = 'Class IV (Heavy support)';
      boltSpacing = 1.0;
      meshRequired = 1;
      shotcreteThickness = 150;
    } else if (quality === 'poor') {
      supportClass = 'Class III (Systematic support)';
      boltSpacing = 1.5;
      meshRequired = 1;
      shotcreteThickness = 50;
    } else if (quality === 'fair') {
      supportClass = 'Class II (Pattern bolting)';
      boltSpacing = 2.0;
    }

    // Adjust for failure mode
    if (failureMode !== 'none') {
      if (quality === 'good' || quality === 'fair') {
        supportClass = 'Class III (Systematic support)';
        boltSpacing = Math.min(boltSpacing, 1.5);
        meshRequired = 1;
      }
    }

    // Adjust for groundwater
    if (groundwater === 'wet' || groundwater === 'dripping' || groundwater === 'flowing') {
      drainageRequired = 1;
      if (shotcreteThickness > 0) {
        shotcreteThickness += 50; // Extra shotcrete for wet conditions
      }
    }

    // Bolt length based on span
    boltLength = Math.max(3.0, Math.ceil(spanVal / 3));

    setResult({
      support_class: supportClass,
      bolt_length_m: boltLength,
      bolt_spacing_m: boltSpacing,
      mesh_required: meshRequired,
      shotcrete_thickness_mm: shotcreteThickness,
      drainage_required: drainageRequired
    });
  }, [qValue, rmrValue, gsiValue, failureMode, groundwater, span]);

  const handleSave = async () => {
    if (!selectedProject || !selectedLocation) {
      alert('Please select a project and location.');
      return;
    }

    const supportData = {
      source_q_value: qValue ? parseFloat(qValue) : null,
      source_rmr: rmrValue ? parseInt(rmrValue) : null,
      source_gsi: gsiValue ? parseInt(gsiValue) : null,
      source_failure_mode: failureMode,
      support_class: result.support_class || null,
      bolt_length_m: result.bolt_length_m || null,
      bolt_spacing_m: result.bolt_spacing_m || null,
      mesh_required: result.mesh_required || 0,
      shotcrete_thickness_mm: result.shotcrete_thickness_mm || 0,
      drainage_required: result.drainage_required || 0,
      support_notes: notes || null
    };

    const summary = phraseBuilder.buildSupportDesignParagraph(supportData);

    const entryId = await entryRepo.create({
      project_id: selectedProject,
      location_id: selectedLocation,
      entry_type_id: 'ET16',
      risk_level_id: 'R1', // Default
      status_id: 'ST_OPEN', // Default
      author: 'Current User', // Should come from auth context in a real app
      summary: summary,
      is_handover_item: isHandoverItem
    });

    await supportDesignRepo.create({
      entry_id: entryId,
      ...supportData
    });

    clearFormDraft(DRAFT_KEYS.supportDesign);
    setSavedEntryId(entryId);
    setShowSuccessModal(true);
  };

  const formatQ = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `Q = ${val.toFixed(2)}`;
  };

  const formatRMR = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `RMR = ${val}`;
  };

  const formatGSI = (val: number | null, range: { min: number; max: number } | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `GSI = ${val}${range ? ` (Range: ${range.min}â€?{range.max})` : ''}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Support Design" />
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

          <div className="space-y-6">
            {/* Context */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2">Context</h3>
              <div className="space-y-4">
                <ProjectSelector
                  value={selectedProject}
                  onChange={(id) => {
                    setSelectedProject(id);
                    setSelectedLocation('');
                  }}
                />
                <LocationSelector
                  value={selectedLocation}
                  onChange={(id) => setSelectedLocation(id)}
                />
              </div>
            </div>

            {/* Calculator Suggestion */}
            {refCalculator && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-cyan-900 mb-4 uppercase tracking-wider border-b border-cyan-200 pb-2 flex items-center gap-2">
                  <CalcIcon size={16} />
                  Suggested Support
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-cyan-800">
                  <div><span className="font-bold">Class:</span> {refCalculator.support_class}</div>
                  <div><span className="font-bold">Bolts:</span> {refCalculator.bolt_length_m}m @ {refCalculator.bolt_spacing_m}m</div>
                  <div><span className="font-bold">Shotcrete:</span> {refCalculator.shotcrete_thickness_mm}mm</div>
                  <div><span className="font-bold">Mesh:</span> {refCalculator.mesh_required ? 'Yes' : 'No'}</div>
                  <div><span className="font-bold">Drainage:</span> {refCalculator.drainage_required ? 'Yes' : 'No'}</div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Overwrite current inputs with calculator suggestion?')) {
                      setQValue(refCalculator.source_q_value?.toString() || '');
                      setRmrValue(refCalculator.source_rmr?.toString() || '');
                      setGsiValue(refCalculator.source_gsi?.toString() || '');
                      setFailureMode(refCalculator.source_failure_mode || 'none');
                      setGroundwater(refCalculator.groundwater_severity || 'dry');
                      setSpan(refCalculator.excavation_span?.toString() || '');
                    }
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 text-sm"
                >
                  Use Suggestion Inputs
                </button>
              </div>
            )}

            {/* Reference Inputs */}
            {snapshot && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-200 pb-2 flex items-center gap-2">
                  <Info size={16} />
                  Reference Inputs
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-zinc-700">
                  <div><span className="font-bold">Latest Q:</span> {formatQ(snapshot.q)}</div>
                  <div><span className="font-bold">Latest RMR:</span> {formatRMR(snapshot.rmr)}</div>
                  <div><span className="font-bold">Latest GSI:</span> {formatGSI(snapshot.gsi_mid, snapshot.gsi_range)}</div>
                  <div><span className="font-bold">Failure Mode:</span> {snapshot.structural_mode || 'None'}</div>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm('Use these reference values?')) {
                      if (snapshot.q !== null) setQValue(snapshot.q.toString());
                      if (snapshot.rmr !== null) setRmrValue(snapshot.rmr.toString());
                      if (snapshot.gsi_mid !== null) setGsiValue(snapshot.gsi_mid.toString());
                      if (snapshot.structural_mode) {
                        const mode = snapshot.structural_mode.toLowerCase();
                        if (mode.includes('planar')) setFailureMode('planar');
                        else if (mode.includes('wedge')) setFailureMode('wedge');
                        else if (mode.includes('toppling')) setFailureMode('toppling');
                      }
                    }
                  }}
                  className="mt-4 px-3 py-1.5 bg-zinc-200 text-zinc-800 font-bold rounded-lg hover:bg-zinc-300 text-sm"
                >
                  Accept Reference Values
                </button>
              </div>
            )}

            {/* Inputs */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2">Inputs</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Q Value</label>
                  <input type="text" inputMode="decimal" value={qValue} onChange={(e) => setQValue(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm" placeholder="e.g. 1.5" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">RMR</label>
                  <input type="text" inputMode="decimal" value={rmrValue} onChange={(e) => setRmrValue(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm" placeholder="e.g. 45" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">GSI</label>
                  <input type="text" inputMode="decimal" value={gsiValue} onChange={(e) => setGsiValue(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm" placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Excavation Span (m)</label>
                  <input type="text" inputMode="decimal" value={span} onChange={(e) => setSpan(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm" placeholder="e.g. 10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Failure Mode</label>
                  <select value={failureMode} onChange={(e) => setFailureMode(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm">
                    <option value="none">None / Unknown</option>
                    <option value="planar">Planar</option>
                    <option value="wedge">Wedge</option>
                    <option value="toppling">Toppling</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Groundwater</label>
                  <select value={groundwater} onChange={(e) => setGroundwater(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm">
                    <option value="dry">Dry</option>
                    <option value="damp">Damp</option>
                    <option value="wet">Wet</option>
                    <option value="dripping">Dripping</option>
                    <option value="flowing">Flowing</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border border-zinc-200 rounded-lg text-sm" rows={3} placeholder="Additional notes..." />
                </div>
              </div>
            </div>

            {/* Result Card */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-200 pb-2">Recommended Support</h3>
              <div className="grid grid-cols-1 gap-y-2 text-sm text-zinc-700">
                <p><span className="font-bold text-zinc-500">Class:</span> {result.support_class}</p>
                <p><span className="font-bold text-zinc-500">Bolting:</span> {result.bolt_length_m}m @ {result.bolt_spacing_m}m spacing</p>
                <p><span className="font-bold text-zinc-500">Mesh:</span> {result.mesh_required ? 'Yes' : 'No'}</p>
                <p><span className="font-bold text-zinc-500">Shotcrete:</span> {result.shotcrete_thickness_mm ? `${result.shotcrete_thickness_mm}mm` : 'None'}</p>
                <p><span className="font-bold text-zinc-500">Drainage:</span> {result.drainage_required ? 'Required' : 'Not required'}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!selectedProject || !selectedLocation}
              className="w-full bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-zinc-900 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              Save Support Design
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

