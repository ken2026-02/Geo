import React, { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { settlementScreeningRepo } from '../repositories/settlementScreeningRepo';
import { buildSettlementScreeningParagraph } from '../phrases/soilPhrases';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { SOIL_STRENGTH_PRESETS } from '../config/engineeringParameters';
import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { buildSoilDefaultsFromInvestigation } from '../utils/fieldLoggingDefaults';

const getScreeningModulus = (soilType: string, compressibilityFlag: string, groundwaterCondition: string): number => {
  const base = soilType === 'Clay' ? 6000 : soilType === 'Silt' ? 12000 : 25000;
  const compressibilityFactor = compressibilityFlag === 'High' ? 0.4 : compressibilityFlag === 'Moderate' ? 0.7 : 1;
  const groundwaterFactor = groundwaterCondition === 'Wet' ? 0.8 : 1;
  return Math.max(1500, base * compressibilityFactor * groundwaterFactor);
};

const mapPresetToSettlementInputs = (presetId: string) => {
  switch (presetId) {
    case 'clay':
      return { soilType: 'Clay', compressibilityFlag: 'High' };
    case 'silt':
      return { soilType: 'Silt', compressibilityFlag: 'Moderate' };
    case 'dense_gravel':
      return { soilType: 'Sand', compressibilityFlag: 'Low' };
    case 'sand':
      return { soilType: 'Sand', compressibilityFlag: 'Low' };
    default:
      return null;
  }
};

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const SettlementScreening: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);

  const [soilPreset, setSoilPreset] = useState('sand');
  const [soilType, setSoilType] = useState('Sand');
  const [footingWidth, setFootingWidth] = useState<string>('1.0');
  const [footingPressure, setFootingPressure] = useState<string>('100.0');
  const [groundwaterCondition, setGroundwaterCondition] = useState('Dry');
  const [compressibilityFlag, setCompressibilityFlag] = useState('Low');
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const [settlementRisk, setSettlementRisk] = useState('Low');
  const [diffSettlementRisk, setDiffSettlementRisk] = useState('Low');
  const [designNote, setDesignNote] = useState('');

  useEffect(() => {
    setProjects(projectRepo.getAll());
    const draft = loadFormDraft(DRAFT_KEYS.settlementScreening);
    if (draft) {
      setProjectId(draft.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || '');
      setSoilPreset(draft.soilPreset || 'sand');
      setSoilType(draft.soilType || 'Sand');
      setFootingWidth(draft.footingWidth ?? 1.0);
      setFootingPressure(draft.footingPressure ?? 100.0);
      setGroundwaterCondition(draft.groundwaterCondition || 'Dry');
      setCompressibilityFlag(draft.compressibilityFlag || 'Low');
      setNotes(draft.notes || '');
    } else {
      setProjectId(getActiveProjectId() || '');
    }
  }, []);

  useEffect(() => {
    if (soilPreset === 'custom') return;
    const seeded = mapPresetToSettlementInputs(soilPreset);
    if (!seeded) return;
    setSoilType(seeded.soilType);
    setCompressibilityFlag(seeded.compressibilityFlag);
  }, [soilPreset]);


  useEffect(() => {
    const hasDraft = hasFormDraft(DRAFT_KEYS.settlementScreening);
    const atDefaults = soilPreset === 'sand' && soilType === 'Sand' && groundwaterCondition === 'Dry' && compressibilityFlag === 'Low' && !notes.trim();
    if (!projectId || !locationId || hasDraft || !atDefaults) return;
    const defaults = buildSoilDefaultsFromInvestigation(soilEngineeringDataService.getLatestInvestigationLog(locationId));
    if (!defaults) return;
    setSoilPreset(defaults.soilPreset);
    setSoilType(defaults.soilType);
    setGroundwaterCondition(defaults.groundwaterCondition);
    setCompressibilityFlag(defaults.compressibilityFlag);
  }, [projectId, locationId]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.settlementScreening, {
      projectId,
      locationId,
      soilPreset,
      soilType,
      footingWidth,
      footingPressure,
      groundwaterCondition,
      compressibilityFlag,
      notes
    });
  }, [projectId, locationId, soilPreset, soilType, footingWidth, footingPressure, groundwaterCondition, compressibilityFlag, notes]);

  useEffect(() => {
    const q = Math.max(0, parseNumericInput(footingPressure) ?? 0);
    const B = Math.max(0.1, parseNumericInput(footingWidth) ?? 0);
    const Es = getScreeningModulus(soilType, compressibilityFlag, groundwaterCondition);
    const estimatedSettlementMm = (q * B / Es) * 1000;

    let risk = 'Low';
    let diffRisk = 'Low';
    if (estimatedSettlementMm > 50 || compressibilityFlag === 'High') risk = 'High';
    else if (estimatedSettlementMm > 25 || groundwaterCondition === 'Wet') risk = 'Moderate';

    if (estimatedSettlementMm > 30 || B > 3 || compressibilityFlag !== 'Low') diffRisk = risk === 'High' ? 'High' : 'Moderate';

    const note = `Estimated settlement (screening) = ${estimatedSettlementMm.toFixed(1)} mm using S = qB / E with Es = ${Es.toFixed(0)} kPa. ${risk === 'High' ? 'Detailed settlement assessment required.' : risk === 'Moderate' ? 'Settlement sensitivity warrants review.' : 'Settlement risk appears low at screening level.'}`;

    setSettlementRisk(risk);
    setDiffSettlementRisk(diffRisk);
    setDesignNote(note);
  }, [soilType, footingWidth, footingPressure, groundwaterCondition, compressibilityFlag]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId('');
      setLocationId('');
      setSoilPreset('sand');
      setSoilType('Sand');
      setFootingWidth('1.0');
      setFootingPressure('100.0');
      setGroundwaterCondition('Dry');
      setCompressibilityFlag('Low');
      setNotes('');
      clearFormDraft(DRAFT_KEYS.settlementScreening);
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

    const summary = buildSettlementScreeningParagraph(settlementRisk, diffSettlementRisk);

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: finalLocationId,
        entry_type_id: 'ET20',
        risk_level_id: 'R1',
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: 0
      });

      await settlementScreeningRepo.create({
        entry_id: entryId,
        soil_type: soilType,
        footing_width: parseNumericInput(footingWidth) ?? 0,
        footing_pressure: parseNumericInput(footingPressure) ?? 0,
        groundwater_condition: groundwaterCondition,
        compressibility_flag: compressibilityFlag,
        settlement_risk: settlementRisk,
        differential_settlement_risk: diffSettlementRisk,
        design_note: designNote,
        notes: notes
      });

      clearFormDraft(DRAFT_KEYS.settlementScreening);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Settlement Screening:', error);
      alert('Failed to save Settlement Screening. Check console for details.');
    }
  };

  return (
    <div className="theme-settlement-screening flex flex-col h-screen bg-gray-50">
      <PageHeader title="Settlement Screening" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectSelector value={projectId} onChange={setProjectId} />
              <LocationSelector value={locationId} onChange={(id, isNew, data) => { setLocationId(id); setIsNewLocation(isNew); setNewLocationData(data); }} />
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Soil / Loading Inputs</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Soil Preset</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={soilPreset} onChange={e => setSoilPreset(e.target.value)}>
                  {SOIL_STRENGTH_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Soil Type</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={soilType} onChange={e => { setSoilPreset('custom'); setSoilType(e.target.value); }}>
                  <option value="Sand">Sand</option>
                  <option value="Silt">Silt</option>
                  <option value="Clay">Clay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Footing Width (m)</label>
                <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={footingWidth} onChange={e => setFootingWidth(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Footing Pressure (kPa)</label>
                <input type="text" inputMode="decimal" className="w-full p-2 border border-slate-300 rounded-lg" value={footingPressure} onChange={e => setFootingPressure(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Groundwater Condition</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={groundwaterCondition} onChange={e => setGroundwaterCondition(e.target.value)}>
                  <option value="Dry">Dry</option>
                  <option value="Wet">Wet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Compressibility Flag</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg" value={compressibilityFlag} onChange={e => { setSoilPreset('custom'); setCompressibilityFlag(e.target.value); }}>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Results</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500">Settlement Concern:</div>
                <div className={`font-bold ${settlementRisk === 'High' ? 'text-red-600' : settlementRisk === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>{settlementRisk}</div>
                <div className="text-slate-500">Diff. Settlement Concern:</div>
                <div className={`font-bold ${diffSettlementRisk === 'High' ? 'text-red-600' : diffSettlementRisk === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>{diffSettlementRisk}</div>
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

