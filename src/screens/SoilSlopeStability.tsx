import React, { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { soilSlopeRepo } from '../repositories/soilSlopeRepo';
import { buildSoilSlopeParagraph } from '../phrases/soilPhrases';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { SOIL_STRENGTH_PRESETS } from '../config/engineeringParameters';
import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { buildSoilDefaultsFromInvestigation } from '../utils/fieldLoggingDefaults';

const getUnitWeight = (soilType: string, groundwaterCondition: string): number => {
  const gamma = soilType === 'Clay' ? 18 : soilType === 'Silt' ? 19 : 20;
  return groundwaterCondition === 'Wet' ? Math.max(10, gamma - 2) : gamma;
};

const mapPresetToSlopeInputs = (presetId: string) => {
  const preset = SOIL_STRENGTH_PRESETS.find((item) => item.value === presetId);
  if (!preset || preset.value === 'custom') return null;
  const soilType = preset.value === 'clay' ? 'Clay' : preset.value === 'silt' ? 'Silt' : 'Sand';
  return {
    soilType,
    cohesion: preset.cohesion,
    frictionAngle: preset.frictionAngle
  };
};

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const SoilSlopeStability: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);

  const [slopeHeight, setSlopeHeight] = useState<string>('5.0');
  const [slopeAngle, setSlopeAngle] = useState<string>('30.0');
  const [soilPreset, setSoilPreset] = useState('sand');
  const [soilType, setSoilType] = useState('Sand');
  const [cohesion, setCohesion] = useState<string>('0.0');
  const [frictionAngle, setFrictionAngle] = useState<string>('30.0');
  const [groundwaterCondition, setGroundwaterCondition] = useState('Dry');
  const [erosionPresent, setErosionPresent] = useState(false);
  const [tensionCrackPresent, setTensionCrackPresent] = useState(false);
  const [toeCondition, setToeCondition] = useState('Stable');
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [stabilityConcern, setStabilityConcern] = useState('Low');
  const [indicativeFsBand, setIndicativeFsBand] = useState('1.5+');
  const [controllingFactor, setControllingFactor] = useState('Geometry');
  const [designNote, setDesignNote] = useState('');

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.soilSlopeStability);
    if (draft) {
      setProjectId(draft.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || '');
      setSlopeHeight(draft.slopeHeight ?? 5.0);
      setSlopeAngle(draft.slopeAngle ?? 30.0);
      setSoilPreset(draft.soilPreset || 'sand');
      setSoilType(draft.soilType || 'Sand');
      setCohesion(draft.cohesion ?? 0.0);
      setFrictionAngle(draft.frictionAngle ?? 30.0);
      setGroundwaterCondition(draft.groundwaterCondition || 'Dry');
      setErosionPresent(draft.erosionPresent ?? false);
      setTensionCrackPresent(draft.tensionCrackPresent ?? false);
      setToeCondition(draft.toeCondition || 'Stable');
      setNotes(draft.notes || '');
    } else {
      setProjectId(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    if (soilPreset === 'custom') return;
    const seeded = mapPresetToSlopeInputs(soilPreset);
    if (!seeded) return;
    setSoilType(seeded.soilType);
    setCohesion(String(seeded.cohesion));
    setFrictionAngle(String(seeded.frictionAngle));
  }, [soilPreset]);


  useEffect(() => {
    const hasDraft = hasFormDraft(DRAFT_KEYS.soilSlopeStability);
    const atDefaults = soilPreset === 'sand' && soilType === 'Sand' && cohesion === '0.0' && frictionAngle === '30.0' && groundwaterCondition === 'Dry' && !notes.trim();
    if (!projectId || !locationId || hasDraft || !atDefaults) return;
    const defaults = buildSoilDefaultsFromInvestigation(soilEngineeringDataService.getLatestInvestigationLog(locationId));
    if (!defaults) return;
    setSoilPreset(defaults.soilPreset);
    setSoilType(defaults.soilType);
    setCohesion(defaults.cohesion);
    setFrictionAngle(defaults.frictionAngle);
    setGroundwaterCondition(defaults.groundwaterCondition);
  }, [projectId, locationId]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.soilSlopeStability, {
      projectId,
      locationId,
      slopeHeight,
      slopeAngle,
      soilPreset,
      soilType,
      cohesion,
      frictionAngle,
      groundwaterCondition,
      erosionPresent,
      tensionCrackPresent,
      toeCondition,
      notes
    });
  }, [projectId, locationId, slopeHeight, slopeAngle, soilPreset, soilType, cohesion, frictionAngle, groundwaterCondition, erosionPresent, tensionCrackPresent, toeCondition, notes]);

  useEffect(() => {
    const H = Math.max(1, parseNumericInput(slopeHeight) ?? 0);
    const beta = (parseNumericInput(slopeAngle) ?? 0) * Math.PI / 180;
    const c = Math.max(0, parseNumericInput(cohesion) ?? 0);
    const phi = (parseNumericInput(frictionAngle) ?? 0) * Math.PI / 180;
    const gamma = getUnitWeight(soilType, groundwaterCondition);
    const z = Math.max(0.5, Math.min(H / 2, 2));
    const ru = groundwaterCondition === 'Wet' ? 0.3 : 0;

    const sinBeta = Math.max(0.01, Math.sin(beta));
    const cosBeta = Math.max(0.01, Math.cos(beta));
    let fs = (c / (gamma * z * sinBeta * cosBeta)) + (((1 - ru) * Math.tan(phi)) / Math.tan(beta));

    if (erosionPresent) fs -= 0.15;
    if (tensionCrackPresent) fs -= 0.2;
    if (toeCondition !== 'Stable') fs -= 0.15;
    fs = Math.max(0, fs);

    let concern = 'Low';
    let fsBand = '1.5+';
    if (fs < 1.0) { concern = 'Critical'; fsBand = '< 1.0'; }
    else if (fs < 1.2) { concern = 'High'; fsBand = '1.0 - 1.2'; }
    else if (fs < 1.5) { concern = 'Moderate'; fsBand = '1.2 - 1.5'; }

    let factor = fs < 1.2 ? 'Shear strength / geometry' : 'Geometry';
    if (groundwaterCondition === 'Wet') factor = 'Groundwater/seepage';
    if (erosionPresent || tensionCrackPresent || toeCondition !== 'Stable') factor = 'Instability indicators';

    const note = `Infinite-slope screening gives FoS ? ${fs.toFixed(2)} using z = ${z.toFixed(1)} m and ru = ${ru.toFixed(2)}. ${concern === 'Critical' || concern === 'High' ? 'Detailed stability assessment required.' : concern === 'Moderate' ? 'Slope warrants review and monitoring.' : 'Preliminary screening indicates stable conditions.'}`;

    setStabilityConcern(concern);
    setIndicativeFsBand(fsBand);
    setControllingFactor(factor);
    setDesignNote(note);
  }, [slopeHeight, slopeAngle, soilType, cohesion, frictionAngle, groundwaterCondition, erosionPresent, tensionCrackPresent, toeCondition]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId('');
      setLocationId('');
      setSlopeHeight('5.0');
      setSlopeAngle('30.0');
      setSoilPreset('sand');
      setSoilType('Sand');
      setCohesion('0.0');
      setFrictionAngle('30.0');
      setGroundwaterCondition('Dry');
      setErosionPresent(false);
      setTensionCrackPresent(false);
      setToeCondition('Stable');
      setNotes('');
      clearFormDraft(DRAFT_KEYS.soilSlopeStability);
    }
  };

  const handleSave = async () => {
    if (!projectId || (!locationId && !isNewLocation)) {
      alert('Please select a project and location.');
      return;
    }

    let finalLocationId = locationId;
    if (isNewLocation && newLocationData) {
      finalLocationId = await locationRepo.create({
        ...newLocationData,
        project_id: projectId,
      });
    }

    const summary = buildSoilSlopeParagraph(stabilityConcern, indicativeFsBand, controllingFactor);

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: finalLocationId,
        entry_type_id: 'ET23',
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary,
        is_handover_item: 0
      });

      await soilSlopeRepo.create({
        entry_id: entryId,
        slope_height: parseNumericInput(slopeHeight) ?? 0,
        slope_angle: parseNumericInput(slopeAngle) ?? 0,
        soil_type: soilType,
        cohesion: parseNumericInput(cohesion) ?? 0,
        friction_angle: parseNumericInput(frictionAngle) ?? 0,
        groundwater_condition: groundwaterCondition,
        erosion_present: erosionPresent ? 1 : 0,
        tension_crack_present: tensionCrackPresent ? 1 : 0,
        toe_condition: toeCondition,
        stability_concern: stabilityConcern,
        indicative_fs_band: indicativeFsBand,
        controlling_factor: controllingFactor,
        design_note: designNote,
        notes
      });

      clearFormDraft(DRAFT_KEYS.soilSlopeStability);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Soil Slope Stability:', error);
      alert('Failed to save Soil Slope Stability. Check console for details.');
    }
  };

  return (
    <div className="theme-soil-slope-stability flex flex-col h-screen bg-gray-50">
      <PageHeader title="Soil Slope Stability" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={handleClearForm} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center">
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
          </div>

          <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm mb-6">
              <strong>Note:</strong> This is a preliminary screening tool only and not a full limit equilibrium analysis.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectSelector value={projectId} onChange={setProjectId} />
              <LocationSelector value={locationId} onChange={(id, isNew, data) => { setLocationId(id); setIsNewLocation(isNew); setNewLocationData(data); }} />
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Slope Geometry</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Slope Height (m)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={slopeHeight} onChange={e => setSlopeHeight(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Slope Angle (deg)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={slopeAngle} onChange={e => setSlopeAngle(e.target.value)} /></div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Soil Parameters</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Soil Preset</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={soilPreset} onChange={e => setSoilPreset(e.target.value)}>
                  {SOIL_STRENGTH_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Soil Type</label><select className="w-full p-2 border border-slate-300 rounded-lg" value={soilType} onChange={e => { setSoilPreset('custom'); setSoilType(e.target.value); }}><option value="Sand">Sand</option><option value="Silt">Silt</option><option value="Clay">Clay</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Cohesion (kPa)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={cohesion} onChange={e => { setSoilPreset('custom'); setCohesion(e.target.value); }} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Friction Angle (deg)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={frictionAngle} onChange={e => { setSoilPreset('custom'); setFrictionAngle(e.target.value); }} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Groundwater Condition</label><select className="w-full p-2 border border-slate-300 rounded-lg" value={groundwaterCondition} onChange={e => setGroundwaterCondition(e.target.value)}><option value="Dry">Dry</option><option value="Wet">Wet</option></select></div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Indicators</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={erosionPresent} onChange={e => setErosionPresent(e.target.checked)} /><span className="text-sm text-slate-700">Erosion Present</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={tensionCrackPresent} onChange={e => setTensionCrackPresent(e.target.checked)} /><span className="text-sm text-slate-700">Tension Crack Present</span></label>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Toe Condition</label><select className="w-full p-2 border border-slate-300 rounded-lg" value={toeCondition} onChange={e => setToeCondition(e.target.value)}><option value="Stable">Stable</option><option value="Undercut">Undercut</option><option value="Eroded">Eroded</option></select></div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Results</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500">Stability Concern:</div>
                <div className={`font-bold ${stabilityConcern === 'Critical' || stabilityConcern === 'High' ? 'text-red-600' : stabilityConcern === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>{stabilityConcern}</div>
                <div className="text-slate-500">Indicative FS Band:</div>
                <div className="font-bold text-slate-800">{indicativeFsBand}</div>
                <div className="text-slate-500">Controlling Factor:</div>
                <div className="font-bold text-slate-800">{controllingFactor}</div>
                <div className="text-slate-500 col-span-2 mt-2">Design Note:</div>
                <div className="col-span-2 text-slate-800 italic">{designNote}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea className="w-full p-2 border border-slate-300 rounded-lg" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button onClick={handleSave} className="w-full bg-[var(--module-accent)] text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 transition-opacity">
              <Save className="w-5 h-5" />
              Save Assessment
            </button>
          </div>
        </div>
      </div>
      <SaveSuccessModal isOpen={showSuccessModal} entryId={savedEntryId} onContinue={() => { setShowSuccessModal(false); setSavedEntryId(null); handleClearForm(); }} />
    </div>
  );
};

