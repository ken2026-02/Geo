import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Trash2, Calculator } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { earthPressureRepo } from '../repositories/earthPressureRepo';
import { buildEarthPressureParagraph } from '../phrases/soilPhrases';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { SOIL_STRENGTH_PRESETS } from '../config/engineeringParameters';
import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { buildSoilDefaultsFromInvestigation } from '../utils/fieldLoggingDefaults';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const EarthPressure: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);
  const [soilPreset, setSoilPreset] = useState<string>('custom');
  
  const [wallHeight, setWallHeight] = useState<string>('3.0');
  const [surcharge, setSurcharge] = useState<string>('10.0');
  const [unitWeight, setUnitWeight] = useState<string>('18.0');
  const [cohesion, setCohesion] = useState<string>('0.0');
  const [frictionAngle, setFrictionAngle] = useState<string>('30.0');
  const [groundwaterCondition, setGroundwaterCondition] = useState('Dry');
  const [pressureState, setPressureState] = useState('Active');
  const [calculationMode, setCalculationMode] = useState<'Coefficient' | 'Distribution' | 'Loading'>('Coefficient');
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Results
  const [Ka, setKa] = useState(0);
  const [force, setForce] = useState(0);
  const [application, setApplication] = useState(0);

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.earthPressure);
    if (draft) {
      setProjectId(draft.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || '');
      setSoilPreset(draft.soilPreset || 'custom');
      setWallHeight(draft.wallHeight ?? 3.0);
      setSurcharge(draft.surcharge ?? 10.0);
      setUnitWeight(draft.unitWeight ?? 18.0);
      setCohesion(draft.cohesion ?? 0.0);
      setFrictionAngle(draft.frictionAngle ?? 30.0);
      setGroundwaterCondition(draft.groundwaterCondition || 'Dry');
      setPressureState(draft.pressureState || 'Active');
      setCalculationMode(draft.calculationMode || 'Coefficient');
      setNotes(draft.notes || '');
    } else {
      setProjectId(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    const selectedPreset = SOIL_STRENGTH_PRESETS.find((preset) => preset.value === soilPreset);
    if (!selectedPreset || selectedPreset.value === 'custom') return;
    setUnitWeight(String(selectedPreset.unitWeight));
    setCohesion(String(selectedPreset.cohesion));
    setFrictionAngle(String(selectedPreset.frictionAngle));
  }, [soilPreset]);


  useEffect(() => {
    const hasDraft = hasFormDraft(DRAFT_KEYS.earthPressure);
    const atDefaults = soilPreset === 'custom' && unitWeight === '18.0' && cohesion === '0.0' && frictionAngle === '30.0' && groundwaterCondition === 'Dry' && !notes.trim();
    if (!projectId || !locationId || hasDraft || !atDefaults) return;
    const defaults = buildSoilDefaultsFromInvestigation(soilEngineeringDataService.getLatestInvestigationLog(locationId));
    if (!defaults) return;
    setSoilPreset(defaults.soilPreset);
    setUnitWeight(defaults.unitWeight);
    setCohesion(defaults.cohesion);
    setFrictionAngle(defaults.frictionAngle);
    setGroundwaterCondition(defaults.groundwaterCondition);
  }, [projectId, locationId]);

  useEffect(() => {
    const stateToSave = {
      projectId, locationId, soilPreset, wallHeight, surcharge, unitWeight, cohesion, frictionAngle, groundwaterCondition, pressureState, calculationMode, notes
    };
    saveFormDraft(DRAFT_KEYS.earthPressure, stateToSave);
  }, [projectId, locationId, soilPreset, wallHeight, surcharge, unitWeight, cohesion, frictionAngle, groundwaterCondition, pressureState, calculationMode, notes]);

  useEffect(() => {
    const H = Math.max(0, parseNumericInput(wallHeight) ?? 0);
    const q = Math.max(0, parseNumericInput(surcharge) ?? 0);
    const gamma = Math.max(0, parseNumericInput(unitWeight) ?? 0);
    const c = Math.max(0, parseNumericInput(cohesion) ?? 0);
    const phi = Math.max(0, parseNumericInput(frictionAngle) ?? 0);
    const phiRad = phi * (Math.PI / 180);

    let coeff = 0;
    if (pressureState === 'Active') {
      coeff = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
    } else if (pressureState === 'Passive') {
      coeff = Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
    } else {
      // Jaky at-rest coefficient
      coeff = 1 - Math.sin(phiRad);
    }

    // Simple groundwater screening: reduce effective unit weight for wet conditions.
    const isWet = groundwaterCondition !== 'Dry';
    const gammaEff = isWet ? Math.max(0, gamma - 9.81) : gamma;

    let forceVal = 0;
    let applicationVal = 0;

    if (calculationMode === 'Coefficient') {
      setKa(coeff);
      setForce(0);
      setApplication(0);
      return;
    }

    const triangular = 0.5 * coeff * gammaEff * H * H;
    const surchargeComponent = coeff * q * H;
    // Rankine cohesive correction: active reduces pressure, passive increases it. Clamp active at zero (no tension).
    const cohesionComponent = phi > 0.1 ? (pressureState === 'Passive' ? 2 * c * Math.sqrt(coeff) * H : -2 * c * Math.sqrt(coeff) * H) : 0;

    if (calculationMode === 'Distribution') {
      forceVal = Math.max(0, triangular + cohesionComponent);
      applicationVal = H / 3;
    } else if (calculationMode === 'Loading') {
      forceVal = Math.max(0, triangular + surchargeComponent + cohesionComponent);
      // Combined resultant from triangular + rectangular surcharge load. Treat cohesion correction as triangular-equivalent at H/3 for screening.
      applicationVal = forceVal > 0 ? (((triangular + cohesionComponent) * (H / 3)) + (surchargeComponent * (H / 2))) / forceVal : 0;
    }

    setKa(coeff);
    setForce(forceVal);
    setApplication(applicationVal);
  }, [wallHeight, surcharge, unitWeight, cohesion, frictionAngle, pressureState, calculationMode, groundwaterCondition]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId('');
      setLocationId('');
      setSoilPreset('custom');
      setWallHeight('3.0');
      setSurcharge('10.0');
      setUnitWeight('18.0');
      setCohesion('0.0');
      setFrictionAngle('30.0');
      setGroundwaterCondition('Dry');
      setPressureState('Active');
      setNotes('');
      clearFormDraft(DRAFT_KEYS.earthPressure);
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

    const summary = buildEarthPressureParagraph(Ka, force, application);

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: finalLocationId,
        entry_type_id: 'ET19',
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: 0
      });

      await earthPressureRepo.create({
        entry_id: entryId,
        wall_height: parseNumericInput(wallHeight) ?? 0,
        surcharge: parseNumericInput(surcharge) ?? 0,
        unit_weight: parseNumericInput(unitWeight) ?? 0,
        cohesion: parseNumericInput(cohesion) ?? 0,
        friction_angle: parseNumericInput(frictionAngle) ?? 0,
        groundwater_condition: groundwaterCondition,
        pressure_state: pressureState,
        coefficient: Ka,
        resultant_force: force,
        point_of_application: application,
        notes: `${notes}\nCalculation Mode: ${calculationMode}`
      });

      clearFormDraft(DRAFT_KEYS.earthPressure);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Earth Pressure:', error);
      alert('Failed to save Earth Pressure. Check console for details.');
    }
  };

  return (
    <div className="theme-earth-pressure flex flex-col h-screen bg-gray-50">
      <PageHeader title="Earth Pressure Calculator" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
          </div>

          <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm mb-6">
              <strong>Note:</strong> This is an indicative / preliminary assessment only and not final design.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectSelector
                value={projectId}
                onChange={setProjectId}
              />
              <LocationSelector
                value={locationId}
                onChange={(id, isNew, data) => { setLocationId(id); setIsNewLocation(isNew); setNewLocationData(data); }}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Calculation Mode</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={calculationMode} onChange={e => setCalculationMode(e.target.value as any)}>
                  <option value="Coefficient">Pressure Coefficient</option>
                  <option value="Distribution">Lateral Pressure Distribution</option>
                  <option value="Loading">Additional Loading</option>
                </select>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Wall / Loading</h2>
            <div className="grid grid-cols-2 gap-4">
              {calculationMode !== 'Coefficient' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Wall Height (m)</label>
                    <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={wallHeight} onChange={e => setWallHeight(e.target.value)} />
                  </div>
                </>
              )}
              {calculationMode === 'Loading' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Surcharge (kPa)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={surcharge} onChange={e => setSurcharge(e.target.value)} />
                </div>
              )}
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Soil Parameters</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Soil Preset</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={soilPreset} onChange={e => setSoilPreset(e.target.value)}>
                  {SOIL_STRENGTH_PRESETS.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label === 'Custom' ? 'Custom' : `${preset.label} (${preset.frictionAngle} deg, ${preset.unitWeight} kN/m3${preset.cohesion > 0 ? `, c ${preset.cohesion} kPa` : ''})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Weight (kN/m³)</label>
                <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={unitWeight} onChange={e => setUnitWeight(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cohesion (kPa)</label>
                <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={cohesion} onChange={e => setCohesion(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Friction Angle (°)</label>
                <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={frictionAngle} onChange={e => setFrictionAngle(e.target.value)} />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Groundwater / Pressure State</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Groundwater Condition</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={groundwaterCondition} onChange={e => setGroundwaterCondition(e.target.value)}>
                  <option value="Dry">Dry</option>
                  <option value="Wet">Wet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pressure State</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={pressureState} onChange={e => setPressureState(e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Passive">Passive</option>
                  <option value="At-Rest">At-Rest</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Results</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500">Coefficient (Ka/Kp/K0):</div>
                <div className="font-bold text-slate-800">{Ka.toFixed(2)}</div>
                <div className="text-slate-500">Resultant Force:</div>
                <div className="font-bold text-slate-800">{force.toFixed(1)} kN/m</div>
                <div className="text-slate-500">Application Point:</div>
                <div className="font-bold text-slate-800">{application.toFixed(1)} m</div>
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


