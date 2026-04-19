import React, { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { retainingWallRepo } from '../repositories/retainingWallRepo';
import { buildRetainingWallParagraph } from '../phrases/soilPhrases';
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

export const RetainingWallCheck: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);
  const [soilPreset, setSoilPreset] = useState<string>('custom');

  const [wallHeight, setWallHeight] = useState<string>('3.0');
  const [baseWidth, setBaseWidth] = useState<string>('2.0');
  const [toeWidth, setToeWidth] = useState<string>('0.5');
  const [heelWidth, setHeelWidth] = useState<string>('1.0');
  const [soilUnitWeight, setSoilUnitWeight] = useState<string>('18.0');
  const [soilFrictionAngle, setSoilFrictionAngle] = useState<string>('30.0');
  const [cohesion, setCohesion] = useState<string>('0.0');
  const [surcharge, setSurcharge] = useState<string>('10.0');
  const [groundwaterCondition, setGroundwaterCondition] = useState('Dry');
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [slidingFs, setSlidingFs] = useState(0);
  const [overturningFs, setOverturningFs] = useState(0);
  const [bearingPressure, setBearingPressure] = useState(0);
  const [eccentricity, setEccentricity] = useState(0);
  const [stabilityResult, setStabilityResult] = useState('Pass');

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.retainingWallCheck);
    if (draft) {
      setProjectId(draft.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || '');
      setSoilPreset(draft.soilPreset || 'custom');
      setWallHeight(draft.wallHeight ?? 3.0);
      setBaseWidth(draft.baseWidth ?? 2.0);
      setToeWidth(draft.toeWidth ?? 0.5);
      setHeelWidth(draft.heelWidth ?? 1.0);
      setSoilUnitWeight(draft.soilUnitWeight ?? 18.0);
      setSoilFrictionAngle(draft.soilFrictionAngle ?? 30.0);
      setCohesion(draft.cohesion ?? 0.0);
      setSurcharge(draft.surcharge ?? 10.0);
      setGroundwaterCondition(draft.groundwaterCondition || 'Dry');
      setNotes(draft.notes || '');
    } else {
      setProjectId(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    const selectedPreset = SOIL_STRENGTH_PRESETS.find((preset) => preset.value === soilPreset);
    if (!selectedPreset || selectedPreset.value === 'custom') return;
    setSoilUnitWeight(String(selectedPreset.unitWeight));
    setCohesion(String(selectedPreset.cohesion));
    setSoilFrictionAngle(String(selectedPreset.frictionAngle));
  }, [soilPreset]);


  useEffect(() => {
    const hasDraft = hasFormDraft(DRAFT_KEYS.retainingWallCheck);
    const atDefaults = soilPreset === 'custom' && soilUnitWeight === '18.0' && soilFrictionAngle === '30.0' && cohesion === '0.0' && groundwaterCondition === 'Dry' && !notes.trim();
    if (!projectId || !locationId || hasDraft || !atDefaults) return;
    const defaults = buildSoilDefaultsFromInvestigation(soilEngineeringDataService.getLatestInvestigationLog(locationId));
    if (!defaults) return;
    setSoilPreset(defaults.soilPreset);
    setSoilUnitWeight(defaults.unitWeight);
    setSoilFrictionAngle(defaults.frictionAngle);
    setCohesion(defaults.cohesion);
    setGroundwaterCondition(defaults.groundwaterCondition);
  }, [projectId, locationId]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.retainingWallCheck, {
      projectId, locationId, soilPreset, wallHeight, baseWidth, toeWidth, heelWidth, soilUnitWeight, soilFrictionAngle, cohesion, surcharge, groundwaterCondition, notes
    });
  }, [projectId, locationId, soilPreset, wallHeight, baseWidth, toeWidth, heelWidth, soilUnitWeight, soilFrictionAngle, cohesion, surcharge, groundwaterCondition, notes]);

  useEffect(() => {
    const H = Math.max(0.5, parseNumericInput(wallHeight) ?? 0);
    const B = Math.max(0.5, parseNumericInput(baseWidth) ?? 0);
    const toe = Math.max(0.1, parseNumericInput(toeWidth) ?? 0);
    const heel = Math.max(0.1, parseNumericInput(heelWidth) ?? 0);
    const stem = Math.max(0.2, B - toe - heel);
    const phi = (parseNumericInput(soilFrictionAngle) ?? 0) * (Math.PI / 180);
    const gamma = parseNumericInput(soilUnitWeight) ?? 0;
    const c = Math.max(0, parseNumericInput(cohesion) ?? 0);
    const q = Math.max(0, parseNumericInput(surcharge) ?? 0);
    const gammaEff = groundwaterCondition === 'Wet' ? Math.max(0, gamma - 9.81) : gamma;
    const K = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);

    const wallArea = B * Math.max(0.4 * H, 0.6);
    const wallWeight = 24 * wallArea;
    const surchargeVertical = q * heel;
    const normalBaseForce = wallWeight + surchargeVertical;

    const activeForce = 0.5 * K * gammaEff * H * H + K * q * H;
    const waterForce = groundwaterCondition === 'Wet' ? 0.5 * 9.81 * H * H : 0;
    const drivingForce = activeForce + waterForce;
    const baseResistance = normalBaseForce * Math.tan(phi) + c * B;
    const slidingFsVal = baseResistance / Math.max(drivingForce, 1e-6);

    const wallCentroid = toe + (B / 2);
    const surchargeCentroid = toe + stem + (heel / 2);
    const resistingMoment = wallWeight * wallCentroid + surchargeVertical * surchargeCentroid;
    const overturningMoment = activeForce * (H / 3) + waterForce * (H / 3);
    const overturningFsVal = resistingMoment / Math.max(overturningMoment, 1e-6);

    const resultantVertical = Math.max(normalBaseForce, 1e-6);
    const netMomentAboutToe = resistingMoment - overturningMoment;
    const resultantLocation = netMomentAboutToe / resultantVertical;
    const eccentricityVal = Math.abs((B / 2) - resultantLocation);
    const qAvg = resultantVertical / B;
    const bearingPressureVal = qAvg * (1 + Math.min(1, (6 * eccentricityVal / B)));

    let result = 'Pass';
    if (slidingFsVal < 1.1 || overturningFsVal < 1.5 || eccentricityVal > B / 6) result = 'Fail';
    else if (slidingFsVal < 1.5 || overturningFsVal < 2.0) result = 'Review';

    setSlidingFs(slidingFsVal);
    setOverturningFs(overturningFsVal);
    setBearingPressure(bearingPressureVal);
    setEccentricity(eccentricityVal);
    setStabilityResult(result);
  }, [wallHeight, baseWidth, toeWidth, heelWidth, soilUnitWeight, soilFrictionAngle, cohesion, surcharge, groundwaterCondition]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId('');
      setLocationId('');
      setSoilPreset('custom');
      setWallHeight('3.0');
      setBaseWidth('2.0');
      setToeWidth('0.5');
      setHeelWidth('1.0');
      setSoilUnitWeight('18.0');
      setSoilFrictionAngle('30.0');
      setCohesion('0.0');
      setSurcharge('10.0');
      setGroundwaterCondition('Dry');
      setNotes('');
      setStabilityResult('Pass');
      clearFormDraft(DRAFT_KEYS.retainingWallCheck);
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

    const controllingIssue = slidingFs < overturningFs ? 'Sliding' : 'Overturning';
    const summary = buildRetainingWallParagraph(slidingFs, overturningFs, bearingPressure, controllingIssue);

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: finalLocationId,
        entry_type_id: 'ET22',
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary,
        is_handover_item: 0
      });

      await retainingWallRepo.create({
        entry_id: entryId,
        wall_height: parseNumericInput(wallHeight) ?? 0,
        base_width: parseNumericInput(baseWidth) ?? 0,
        toe_width: parseNumericInput(toeWidth) ?? 0,
        heel_width: parseNumericInput(heelWidth) ?? 0,
        soil_unit_weight: parseNumericInput(soilUnitWeight) ?? 0,
        soil_friction_angle: parseNumericInput(soilFrictionAngle) ?? 0,
        cohesion: parseNumericInput(cohesion) ?? 0,
        surcharge: parseNumericInput(surcharge) ?? 0,
        groundwater_condition: groundwaterCondition,
        sliding_fs: slidingFs,
        overturning_fs: overturningFs,
        bearing_pressure: bearingPressure,
        eccentricity: eccentricity,
        stability_result: stabilityResult,
        notes
      });

      clearFormDraft(DRAFT_KEYS.retainingWallCheck);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Retaining Wall Check:', error);
      alert('Failed to save Retaining Wall Check. Check console for details.');
    }
  };

  return (
    <div className="theme-retaining-wall-check flex flex-col h-screen bg-gray-50">
      <PageHeader title="Retaining Wall Check" />
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
              <strong>Note:</strong> This is a preliminary geotechnical/structural screening result and not final wall design.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectSelector value={projectId} onChange={setProjectId} />
              <LocationSelector value={locationId} onChange={(id, isNew, data) => { setLocationId(id); setIsNewLocation(isNew); setNewLocationData(data); }} />
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Wall Geometry</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Wall Height (m)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={wallHeight} onChange={e => setWallHeight(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Base Width (m)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={baseWidth} onChange={e => setBaseWidth(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Toe Width (m)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={toeWidth} onChange={e => setToeWidth(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Heel Width (m)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={heelWidth} onChange={e => setHeelWidth(e.target.value)} /></div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Backfill Parameters</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Soil Preset</label><select className="w-full p-2 border border-slate-300 rounded-lg" value={soilPreset} onChange={e => setSoilPreset(e.target.value)}>{SOIL_STRENGTH_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label === 'Custom' ? 'Custom' : `${preset.label} (${preset.frictionAngle} deg, ${preset.unitWeight} kN/m3${preset.cohesion > 0 ? `, c ${preset.cohesion} kPa` : ''})`}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit Weight (kN/m3)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={soilUnitWeight} onChange={e => setSoilUnitWeight(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Friction Angle (deg)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={soilFrictionAngle} onChange={e => setSoilFrictionAngle(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Cohesion (kPa)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={cohesion} onChange={e => setCohesion(e.target.value)} /></div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Loading</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Surcharge (kPa)</label><input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={surcharge} onChange={e => setSurcharge(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Groundwater Condition</label><select className="w-full p-2 border border-slate-300 rounded-lg" value={groundwaterCondition} onChange={e => setGroundwaterCondition(e.target.value)}><option value="Dry">Dry</option><option value="Wet">Wet</option></select></div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Results</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500">Sliding FS:</div>
                <div className={`font-bold ${slidingFs < 1.1 ? 'text-red-600' : slidingFs < 1.5 ? 'text-orange-600' : 'text-emerald-600'}`}>{slidingFs.toFixed(2)}</div>
                <div className="text-slate-500">Overturning FS:</div>
                <div className={`font-bold ${overturningFs < 1.5 ? 'text-red-600' : overturningFs < 2.0 ? 'text-orange-600' : 'text-emerald-600'}`}>{overturningFs.toFixed(2)}</div>
                <div className="text-slate-500">Bearing Pressure:</div>
                <div className="font-bold text-slate-800">{bearingPressure.toFixed(1)} kPa</div>
                <div className="text-slate-500">Eccentricity:</div>
                <div className="font-bold text-slate-800">{eccentricity.toFixed(2)} m</div>
                <div className="text-slate-500 col-span-2 mt-2">Stability Result:</div>
                <div className={`col-span-2 font-bold ${stabilityResult === 'Fail' ? 'text-red-600' : stabilityResult === 'Review' ? 'text-orange-600' : 'text-emerald-600'}`}>{stabilityResult}</div>
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

