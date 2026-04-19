import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Info, Layers3, Plus, Save, Trash2 } from 'lucide-react';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { bearingCapacityRepo } from '../repositories/bearingCapacityRepo';
import { buildBearingCapacityParagraph } from '../phrases/soilPhrases';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft } from '../state/formDrafts';
import { BearingCapacityChart } from '../components/BearingCapacityChart';
import {
  type BearingCheckInput,
  type BearingLayerInput,
  type DistributionBasisId,
  evaluateBearingCheck,
} from '../engineering/bearingCapacitySpreadsheet';
import { BEARING_BASIS_LIBRARY, DISTRIBUTION_PRESETS, getDistributionPreset } from '../config/bearingCapacityBasis';
import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { buildSoilDefaultsFromInvestigation } from '../utils/fieldLoggingDefaults';

type LayerDraft = {
  id: string;
  name: string;
  description: string;
  thicknessM: string;
  suKPa: string;
  phiDeg: string;
  cKPa: string;
  gammaKNm3: string;
  nu: string;
  distributionMode: 'auto' | 'manual';
  distributionRatio: string;
  distributionBasisId: DistributionBasisId;
  reinforced?: boolean;
};

const BASIS_VERSION = 'bearing-capacity-v1';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const uid = () => Math.random().toString(36).slice(2, 10);

const createPlatformDraft = (): LayerDraft => ({
  id: uid(),
  name: 'Platform',
  description: 'Type 2.3 Capping Layer',
  thicknessM: '0.15',
  suKPa: '0',
  phiDeg: '36',
  cKPa: '5',
  gammaKNm3: '19',
  nu: '0.3',
  distributionMode: 'auto',
  distributionRatio: '0.75',
  distributionBasisId: 'platform-unreinforced',
  reinforced: false,
});

const createSoilLayerDraft = (index: number): LayerDraft => ({
  id: uid(),
  name: `Layer ${index}`,
  description: '',
  thicknessM: '1.0',
  suKPa: '0',
  // Match the workbook's common sample where the first natural layer is slightly stronger than deeper layers.
  phiDeg: index === 1 ? '34' : '32',
  cKPa: '1',
  gammaKNm3: '19',
  nu: '0.3',
  distributionMode: 'auto',
  distributionRatio: '0.75',
  distributionBasisId: 'cohesionless-dense',
});

const applyDistributionPreset = (layer: LayerDraft, basisId: DistributionBasisId): LayerDraft => {
  const preset = getDistributionPreset(basisId);
  if (!preset) return layer;
  return {
    ...layer,
    distributionBasisId: basisId,
    distributionMode: basisId === 'manual' ? 'manual' : 'auto',
    distributionRatio: String(preset.ratio),
  };
};

const layerDraftToInput = (layer: LayerDraft): BearingLayerInput => ({
  id: layer.id,
  name: layer.name || 'Layer',
  description: layer.description || '',
  thicknessM: Math.max(0.01, parseNumericInput(layer.thicknessM) ?? 0.01),
  suKPa: Math.max(0, parseNumericInput(layer.suKPa) ?? 0),
  phiDeg: Math.max(0, parseNumericInput(layer.phiDeg) ?? 0),
  cKPa: Math.max(0, parseNumericInput(layer.cKPa) ?? 0),
  gammaKNm3: Math.max(0, parseNumericInput(layer.gammaKNm3) ?? 0),
  nu: Math.max(0.01, parseNumericInput(layer.nu) ?? 0.3),
  distributionMode: layer.distributionMode,
  distributionRatio: Math.max(0, parseNumericInput(layer.distributionRatio) ?? 0),
  distributionBasisId: layer.distributionBasisId,
  reinforced: layer.reinforced,
});

const buildDefaultSummary = (result: ReturnType<typeof evaluateBearingCheck>) =>
  buildBearingCapacityParagraph(
    result.summary.overallPass,
    result.summary.controllingMethod,
    result.summary.controllingLayerName,
    result.summary.controllingRatio,
    result.layerChecks[0]?.bearing.qall ?? 0
  );

const getLayerFieldLabel = (field: 'suKPa' | 'phiDeg' | 'cKPa' | 'gammaKNm3' | 'nu') =>
  field === 'suKPa'
    ? 'Su (kPa)'
    : field === 'phiDeg'
      ? 'phi (deg)'
      : field === 'cKPa'
        ? "c' (kPa)"
        : field === 'gammaKNm3'
          ? 'gamma (kN/m3)'
          : 'nu';

const BasisButton: React.FC<{ basisId: string; onOpen: (basisId: string) => void }> = ({ basisId, onOpen }) => (
  <button type="button" onClick={() => onOpen(basisId)} className="inline-flex items-center text-slate-400 hover:text-slate-700">
    <Info className="h-4 w-4" />
  </button>
);

export const BearingCapacity: React.FC = () => {
  const location = useLocation();
  const editEntryId = typeof (location.state as { entryId?: string } | null)?.entryId === 'string'
    ? (location.state as { entryId: string }).entryId
    : null;
  const isEditMode = Boolean(editEntryId);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [newLocationData, setNewLocationData] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [geotechRef, setGeotechRef] = useState('');
  const [machinery, setMachinery] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(todayIso());
  const [preparedBy, setPreparedBy] = useState('');

  const [pressureKPa, setPressureKPa] = useState('198');
  const [trackLengthM, setTrackLengthM] = useState('0.967');
  const [trackWidthM, setTrackWidthM] = useState('0.967');
  const [bearingFOS, setBearingFOS] = useState('2');

  const [platform, setPlatform] = useState<LayerDraft>(createPlatformDraft());
  const [layers, setLayers] = useState<LayerDraft[]>([
    { ...createSoilLayerDraft(1), description: 'Colluvium with Cobbles' },
    { ...createSoilLayerDraft(2), description: 'Colluvium with Cobbles', thicknessM: '0.5' },
    { ...createSoilLayerDraft(3), description: 'Colluvium with Cobbles', thicknessM: '0.5' },
  ]);
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [selectedBasisId, setSelectedBasisId] = useState<string | null>(null);
  const [basisQuery, setBasisQuery] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [highlightTargetId, setHighlightTargetId] = useState<string | null>(null);

  const loadExistingEntry = (entryId: string) => {
    const existingEntry = entryRepo.getWithDetails(entryId);
    const existingBearing = bearingCapacityRepo.getByEntryId(entryId);
    if (!existingEntry || !existingBearing) {
      throw new Error('Bearing Capacity entry not found for edit mode.');
    }

    setProjectId(existingEntry.project_id);
    setLocationId(existingEntry.location_id);
    setIsNewLocation(false);
    setNewLocationData(null);
    setTitle(existingBearing.title || '');
    setGeotechRef(existingBearing.geotech_ref || '');
    setMachinery(existingBearing.machinery || '');
    setAssessmentDate(existingBearing.assessment_date || todayIso());
    setPreparedBy(existingBearing.prepared_by || existingEntry.author || '');
    setPressureKPa(String(existingBearing.pressure_kpa ?? 198));
    setTrackLengthM(String(existingBearing.track_length_m ?? 0.967));
    setTrackWidthM(String(existingBearing.track_width_m ?? 0.967));
    setBearingFOS(String(existingBearing.factor_of_safety ?? 2));

    if (existingBearing.platform) {
      setPlatform({
        id: existingBearing.platform.id,
        name: existingBearing.platform.name,
        description: existingBearing.platform.description,
        thicknessM: String(existingBearing.platform.thicknessM),
        suKPa: String(existingBearing.platform.suKPa),
        phiDeg: String(existingBearing.platform.phiDeg),
        cKPa: String(existingBearing.platform.cKPa),
        gammaKNm3: String(existingBearing.platform.gammaKNm3),
        nu: String(existingBearing.platform.nu),
        distributionMode: existingBearing.platform.distributionMode,
        distributionRatio: String(existingBearing.platform.distributionRatio),
        distributionBasisId: existingBearing.platform.distributionBasisId,
        reinforced: existingBearing.platform.reinforced,
      });
    }

    setLayers(
      (existingBearing.layers || []).map((layer) => ({
        id: layer.id,
        name: layer.name,
        description: layer.description,
        thicknessM: String(layer.thicknessM),
        suKPa: String(layer.suKPa),
        phiDeg: String(layer.phiDeg),
        cKPa: String(layer.cKPa),
        gammaKNm3: String(layer.gammaKNm3),
        nu: String(layer.nu),
        distributionMode: layer.distributionMode,
        distributionRatio: String(layer.distributionRatio),
        distributionBasisId: layer.distributionBasisId,
        reinforced: layer.reinforced,
      }))
    );
    setNotes(existingBearing.notes || '');
  };

  useEffect(() => {
    const navState = location.state as { projectId?: string; locationId?: string } | null;
    if (editEntryId) {
      try {
        loadExistingEntry(editEntryId);
      } catch (error) {
        console.error('Failed to load bearing capacity entry for edit:', error);
        window.alert('Failed to load Bearing Capacity assessment for edit.');
      }
      return;
    }
    const draft = loadFormDraft(DRAFT_KEYS.bearingCapacity);
    if (draft) {
      setProjectId(draft.projectId || navState?.projectId || getActiveProjectId() || '');
      setLocationId(draft.locationId || navState?.locationId || '');
      setTitle(draft.title || '');
      setGeotechRef(draft.geotechRef || '');
      setMachinery(draft.machinery || '');
      setAssessmentDate(draft.assessmentDate || todayIso());
      setPreparedBy(draft.preparedBy || '');
      setPressureKPa(draft.pressureKPa || '198');
      setTrackLengthM(draft.trackLengthM || '0.967');
      setTrackWidthM(draft.trackWidthM || '0.967');
      setBearingFOS(draft.bearingFOS || '2');
      setPlatform(draft.platform || createPlatformDraft());
      setLayers(draft.layers?.length ? draft.layers : [createSoilLayerDraft(1)]);
      setNotes(draft.notes || '');
    } else {
      setProjectId(navState?.projectId || getActiveProjectId() || '');
      setLocationId(navState?.locationId || '');
    }
  }, [editEntryId, location.state]);

  useEffect(() => {
    if (isEditMode) return;
    const draftState = {
      projectId,
      locationId,
      title,
      geotechRef,
      machinery,
      assessmentDate,
      preparedBy,
      pressureKPa,
      trackLengthM,
      trackWidthM,
      bearingFOS,
      platform,
      layers,
      notes,
    };
    saveFormDraft(DRAFT_KEYS.bearingCapacity, draftState);
  }, [isEditMode, projectId, locationId, title, geotechRef, machinery, assessmentDate, preparedBy, pressureKPa, trackLengthM, trackWidthM, bearingFOS, platform, layers, notes]);

  useEffect(() => {
    if (!locationId || loadFormDraft(DRAFT_KEYS.bearingCapacity)) return;
    const defaults = buildSoilDefaultsFromInvestigation(soilEngineeringDataService.getLatestInvestigationLog(locationId));
    if (!defaults || !layers.length || layers[0].description) return;
    setLayers((current) => current.map((layer, index) => index === 0 ? {
      ...layer,
      description: defaults.soilType,
      phiDeg: defaults.frictionAngle,
      cKPa: defaults.cohesion,
      gammaKNm3: defaults.unitWeight,
    } : layer));
  }, [locationId, layers]);

  const parsedInput = useMemo<BearingCheckInput>(() => ({
    meta: {
      title,
      geotechRef,
      machinery,
      assessmentDate,
      preparedBy,
    },
    equipment: {
      pressureKPa: Math.max(0, parseNumericInput(pressureKPa) ?? 0),
      trackLengthM: Math.max(0.01, parseNumericInput(trackLengthM) ?? 0.01),
      trackWidthM: Math.max(0.01, parseNumericInput(trackWidthM) ?? 0.01),
      bearingFOS: Math.max(1, parseNumericInput(bearingFOS) ?? 1),
    },
    platform: layerDraftToInput(platform),
    layers: layers.map(layerDraftToInput),
    notes,
  }), [title, geotechRef, machinery, assessmentDate, preparedBy, pressureKPa, trackLengthM, trackWidthM, bearingFOS, platform, layers, notes]);

  const result = useMemo(() => evaluateBearingCheck(parsedInput), [parsedInput]);
  const summaryText = useMemo(() => buildDefaultSummary(result), [result]);

  const resetForm = () => {
    setProjectId('');
    setLocationId('');
    setTitle('');
    setGeotechRef('');
    setMachinery('');
    setAssessmentDate(todayIso());
    setPreparedBy('');
    setPressureKPa('198');
    setTrackLengthM('0.967');
    setTrackWidthM('0.967');
    setBearingFOS('2');
    setPlatform(createPlatformDraft());
    setLayers([createSoilLayerDraft(1)]);
    setNotes('');
    clearFormDraft(DRAFT_KEYS.bearingCapacity);
  };

  const handleClearForm = () => {
    if (isEditMode && editEntryId) {
      if (!window.confirm('Reset unsaved changes and reload the saved assessment?')) return;
      try {
        loadExistingEntry(editEntryId);
      } catch (error) {
        console.error('Failed to reload bearing assessment:', error);
        window.alert('Failed to reload the saved bearing capacity assessment.');
      }
      return;
    }
    if (!window.confirm('Clear the bearing capacity form?')) return;
    resetForm();
  };

  const updateLayer = (layerId: string, updater: (layer: LayerDraft) => LayerDraft) => {
    setLayers((current) => current.map((layer) => (layer.id === layerId ? updater(layer) : layer)));
  };

  const addLayer = () => {
    setLayers((current) => [...current, createSoilLayerDraft(current.length + 1)]);
  };

  const removeLayer = (layerId: string) => {
    setLayers((current) => current.filter((layer) => layer.id !== layerId).map((layer, index) => ({ ...layer, name: `Layer ${index + 1}` })));
  };

  const saveAssessment = async () => {
    if (!projectId || (!locationId && !isNewLocation)) {
      window.alert('Please select a project and location.');
      return;
    }
    if (!layers.length) {
      window.alert('Please enter at least one soil layer.');
      return;
    }

    let finalLocationId = locationId;
    if (isNewLocation && newLocationData) {
      finalLocationId = await locationRepo.create({
        ...newLocationData,
        project_id: projectId,
      });
    }

    const controllingMode = result.summary.controllingMethod || 'linear';
    const controllingLayer = result.summary.controllingLayerName;

    try {
      const persistencePayload = {
        meta: parsedInput.meta,
        pressure_kpa: parsedInput.equipment.pressureKPa,
        track_length_m: parsedInput.equipment.trackLengthM,
        track_width_m: parsedInput.equipment.trackWidthM,
        platform_thickness_m: parsedInput.platform.thicknessM,
        factor_of_safety: parsedInput.equipment.bearingFOS,
        ultimate_bearing_capacity: result.layerChecks[0]?.bearing.qult ?? 0,
        allowable_bearing_capacity: result.layerChecks[0]?.bearing.qall ?? 0,
        controlling_mode: controllingMode,
        controlling_layer: controllingLayer,
        overall_pass: result.summary.overallPass ? 1 : 0,
        platform: parsedInput.platform,
        layers: parsedInput.layers,
        result,
        chart: result.chart,
        basis_version: BASIS_VERSION,
        notes,
      };

      let entryId = editEntryId || '';
      if (isEditMode && editEntryId) {
        await entryRepo.updateEntry(editEntryId, {
          project_id: projectId,
          location_id: finalLocationId,
          risk_level_id: result.summary.overallPass ? 'R1' : 'R2',
          status_id: 'ST_OPEN',
          summary: summaryText,
          is_handover_item: result.summary.overallPass ? 0 : 1,
        });
        await bearingCapacityRepo.updateByEntryId(editEntryId, persistencePayload);
        entryId = editEntryId;
      } else {
        entryId = await entryRepo.create({
          project_id: projectId,
          location_id: finalLocationId,
          entry_type_id: 'ET18',
          risk_level_id: result.summary.overallPass ? 'R1' : 'R2',
          status_id: 'ST_OPEN',
          author: preparedBy || 'Field Engineer',
          summary: summaryText,
          is_handover_item: result.summary.overallPass ? 0 : 1,
        });
        await bearingCapacityRepo.create({
          entry_id: entryId,
          ...persistencePayload,
        });
      }

      clearFormDraft(DRAFT_KEYS.bearingCapacity);
      if (isEditMode) {
        window.dispatchEvent(new Event('entries-changed'));
        window.location.assign(`/entry/${entryId}`);
        return;
      }
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Bearing Capacity:', error);
      window.alert('Failed to save bearing capacity assessment.');
    }
  };

  const selectedBasis = BEARING_BASIS_LIBRARY.find((item) => item.id === selectedBasisId)
    || (selectedBasisId && selectedBasisId in DISTRIBUTION_PRESETS
      ? {
          id: selectedBasisId,
          code: `BC-DIST-${selectedBasisId.toUpperCase()}`,
          category: 'distribution' as const,
          title: DISTRIBUTION_PRESETS[selectedBasisId as keyof typeof DISTRIBUTION_PRESETS].label,
          definition: 'Linear load distribution ratio',
          guidance: DISTRIBUTION_PRESETS[selectedBasisId as keyof typeof DISTRIBUTION_PRESETS].guidance,
          source: DISTRIBUTION_PRESETS[selectedBasisId as keyof typeof DISTRIBUTION_PRESETS].source,
          usedIn: ['Platform > Distribution basis', 'Platform > Distribution 1V:xH', 'Soil profile > Distribution basis', 'Soil profile > Distribution 1V:xH', 'Report > Soil Layers'],
          sectionId: 'bearing-soil-profile',
          relatedTargets: [
            { label: 'Platform > Distribution basis', targetId: 'bc-platform-distribution-basis' },
            { label: 'Platform > Distribution 1V:xH', targetId: 'bc-platform-distribution-ratio' },
            { label: 'Soil profile', targetId: 'bearing-results' },
          ],
        }
      : null);

  const filteredBasisItems = BEARING_BASIS_LIBRARY.filter((item) => {
    const haystack = `${item.code} ${item.title} ${item.definition} ${item.guidance} ${item.source}`.toLowerCase();
    return haystack.includes(basisQuery.trim().toLowerCase());
  });

  const basisGroups: Array<{ key: string; label: string }> = [
    { key: 'inputs', label: 'Inputs' },
    { key: 'distribution', label: 'Distribution' },
    { key: 'bearing', label: 'Bearing' },
    { key: 'stress', label: 'Stress methods' },
    { key: 'reporting', label: 'Reporting' },
  ];

  const jumpToTarget = (targetId?: string) => {
    if (!targetId) return;
    const directTarget = document.getElementById(targetId);
    const sectionTarget = sectionRefs.current[targetId];
    const target = directTarget || sectionTarget;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightTargetId(targetId);
    window.setTimeout(() => setHighlightTargetId((current) => (current === targetId ? null : current)), 2000);
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      window.setTimeout(() => target.focus(), 250);
    }
    setSelectedBasisId(null);
  };

  const highlightClassFor = (targetId: string) =>
    highlightTargetId === targetId ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white' : '';

  const getCurrentValueForTarget = (targetId: string): string | null => {
    switch (targetId) {
      case 'bc-pressure':
        return `${pressureKPa || '-'} kPa`;
      case 'bc-track-length':
        return `${trackLengthM || '-'} m`;
      case 'bc-track-width':
        return `${trackWidthM || '-'} m`;
      case 'bc-platform-thickness':
        return `${platform.thicknessM || '-'} m`;
      case 'bc-bearing-fos':
        return `${bearingFOS || '-'}`;
      case 'bc-platform-su':
        return `${platform.suKPa || '-'} kPa`;
      case 'bc-platform-phi':
        return `${platform.phiDeg || '-'} deg`;
      case 'bc-platform-c':
        return `${platform.cKPa || '-'} kPa`;
      case 'bc-platform-gamma':
        return `${platform.gammaKNm3 || '-'} kN/m3`;
      case 'bc-platform-nu':
        return `${platform.nu || '-'}`;
      case 'bc-platform-distribution-basis': {
        const preset = getDistributionPreset(platform.distributionBasisId);
        return preset ? preset.label : platform.distributionBasisId;
      }
      case 'bc-platform-distribution-ratio':
        return `1V:${platform.distributionRatio || '-'}H`;
      case 'bearing-results-table':
        return `Worst ratio ${result.summary.controllingRatio.toFixed(2)}`;
      case 'bearing-results-summary':
        return result.summary.overallPass ? 'Pass' : 'Review required';
      case 'bearing-assessment-note':
        return notes ? 'Custom note entered' : 'Using auto summary';
      default:
        return null;
    }
  };

  const getBasisCardValue = (basisId: string): string | null => {
    switch (basisId) {
      case 'pressure':
        return `${pressureKPa || '-'} kPa`;
      case 'track-geometry':
        return `L ${trackLengthM || '-'} / B ${trackWidthM || '-'} m`;
      case 'platform-thickness':
        return `${platform.thicknessM || '-'} m`;
      case 'bearing-fos':
        return `${bearingFOS || '-'}`;
      case 'su':
        return `Platform ${platform.suKPa || '-'} kPa`;
      case 'phi':
        return `Platform ${platform.phiDeg || '-'} deg`;
      case 'c':
        return `Platform ${platform.cKPa || '-'} kPa`;
      case 'gamma':
        return `Platform ${platform.gammaKNm3 || '-'} kN/m3`;
      case 'nu':
        return `Platform ${platform.nu || '-'}`;
      case 'distribution-rule': {
        const preset = getDistributionPreset(platform.distributionBasisId);
        return preset ? `Platform ${preset.label}` : `Platform ${platform.distributionBasisId}`;
      }
      case 'bearing-factors':
        return result.layerChecks[0]?.bearing.nq ? `Nq ${result.layerChecks[0].bearing.nq.toFixed(2)}` : null;
      case 'linear-method':
      case 'westergaard-method':
      case 'boussinesq-method':
        return `Worst ratio ${result.summary.controllingRatio.toFixed(2)}`;
      case 'reporting':
        return result.summary.overallPass ? 'Pass' : 'Review required';
      default:
        return null;
    }
  };

  return (
    <div className="theme-bearing-capacity flex h-screen flex-col bg-gray-50">
      <PageHeader title={isEditMode ? 'Edit Bearing Capacity Check' : 'Bearing Capacity Check'} />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClearForm}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear
            </button>
          </div>

          <section
            id="bearing-key-inputs"
            ref={(node) => { sectionRefs.current['bearing-key-inputs'] = node; }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Report setup</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ProjectSelector value={projectId} onChange={setProjectId} />
              <LocationSelector value={locationId} onChange={(id, isNew, data) => { setLocationId(id); setIsNewLocation(isNew); setNewLocationData(data); }} />
              <label className="block text-sm font-medium text-slate-700">Title
                <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Geotech Ref
                <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={geotechRef} onChange={(e) => setGeotechRef(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Machinery
                <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={machinery} onChange={(e) => setMachinery(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">By
                <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
              </label>
            </div>
          </section>

          <section
            id="bearing-platform"
            ref={(node) => { sectionRefs.current['bearing-platform'] = node; }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Key inputs</h2>
              <BasisButton basisId="pressure" onOpen={setSelectedBasisId} />
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <label className="block text-sm font-medium text-slate-700">P (kPa)
                <input id="bc-pressure" className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-pressure')}`} value={pressureKPa} onChange={(e) => setPressureKPa(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">L (m)
                <input id="bc-track-length" className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-track-length')}`} value={trackLengthM} onChange={(e) => setTrackLengthM(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">B (m)
                <input id="bc-track-width" className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-track-width')}`} value={trackWidthM} onChange={(e) => setTrackWidthM(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">D (m)
                <input id="bc-platform-thickness" className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-platform-thickness')}`} value={platform.thicknessM} onChange={(e) => setPlatform((current) => ({ ...current, thicknessM: e.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Bearing FOS
                <input id="bc-bearing-fos" className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-bearing-fos')}`} value={bearingFOS} onChange={(e) => setBearingFOS(e.target.value)} />
              </label>
            </div>
          </section>

          <section
            id="bearing-soil-profile"
            ref={(node) => { sectionRefs.current['bearing-soil-profile'] = node; }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Platform</h2>
              <BasisButton basisId={platform.distributionBasisId} onOpen={setSelectedBasisId} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Description
                <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={platform.description} onChange={(e) => setPlatform((current) => ({ ...current, description: e.target.value }))} />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={platform.reinforced || false}
                  onChange={(e) =>
                    setPlatform((current) =>
                      applyDistributionPreset(
                        { ...current, reinforced: e.target.checked },
                        e.target.checked ? 'platform-reinforced' : 'platform-unreinforced'
                      )
                    )
                  }
                />
                Reinforced platform
              </label>
                  {(['suKPa', 'phiDeg', 'cKPa', 'gammaKNm3', 'nu'] as const).map((field) => (
                    <label key={field} className="block text-sm font-medium text-slate-700">
                      {getLayerFieldLabel(field)}
                      <input
                        id={`bc-platform-${field === 'suKPa' ? 'su' : field === 'phiDeg' ? 'phi' : field === 'cKPa' ? 'c' : field === 'gammaKNm3' ? 'gamma' : 'nu'}`}
                        className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor(`bc-platform-${field === 'suKPa' ? 'su' : field === 'phiDeg' ? 'phi' : field === 'cKPa' ? 'c' : field === 'gammaKNm3' ? 'gamma' : 'nu'}`)}`}
                        value={platform[field]}
                        onChange={(e) => setPlatform((current) => ({ ...current, [field]: e.target.value }))}
                      />
                </label>
              ))}
              <label className="block text-sm font-medium text-slate-700">Distribution basis
                <select
                  id="bc-platform-distribution-basis"
                  className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-platform-distribution-basis')}`}
                  value={platform.distributionBasisId}
                  onChange={(e) => setPlatform((current) => applyDistributionPreset(current, e.target.value as DistributionBasisId))}
                >
                  {Object.entries(DISTRIBUTION_PRESETS)
                    .filter(([key]) => key.startsWith('platform-'))
                    .map(([key, preset]) => (
                      <option key={key} value={key}>{preset.label}</option>
                    ))}
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Distribution 1V:xH
                <input
                  id="bc-platform-distribution-ratio"
                  className={`mt-1 w-full rounded-lg border border-slate-300 p-2 ${highlightClassFor('bc-platform-distribution-ratio')}`}
                  value={platform.distributionRatio}
                  onChange={(e) => setPlatform((current) => ({ ...current, distributionMode: 'manual', distributionBasisId: 'manual', distributionRatio: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section
            id="bearing-results"
            ref={(node) => { sectionRefs.current['bearing-results'] = node; }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800">Soil profile</h2>
              </div>
              <button onClick={addLayer} className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
                <Plus className="mr-1 h-4 w-4" />
                Add layer
              </button>
            </div>
            <div className="space-y-4">
              {layers.map((layer) => (
                <div key={layer.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800">{layer.name}</h3>
                      <BasisButton basisId={layer.distributionBasisId} onOpen={setSelectedBasisId} />
                    </div>
                    <button onClick={() => removeLayer(layer.id)} className="text-sm text-red-600">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Description
                      <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={layer.description} onChange={(e) => updateLayer(layer.id, (current) => ({ ...current, description: e.target.value }))} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Thickness (m)
                      <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={layer.thicknessM} onChange={(e) => updateLayer(layer.id, (current) => ({ ...current, thicknessM: e.target.value }))} />
                    </label>
                    {(['suKPa', 'phiDeg', 'cKPa', 'gammaKNm3', 'nu'] as const).map((field) => (
                      <label key={field} className="block text-sm font-medium text-slate-700">
                        {getLayerFieldLabel(field)}
                        <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={layer[field]} onChange={(e) => updateLayer(layer.id, (current) => ({ ...current, [field]: e.target.value }))} />
                      </label>
                    ))}
                    <label className="block text-sm font-medium text-slate-700">Distribution basis
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                        value={layer.distributionBasisId}
                        onChange={(e) => updateLayer(layer.id, (current) => applyDistributionPreset(current, e.target.value as DistributionBasisId))}
                      >
                        <option value="cohesive-soft">Cohesive: very soft to soft</option>
                        <option value="cohesive-firm">Cohesive: soft to firm</option>
                        <option value="cohesive-hard">Cohesive: firm to hard</option>
                        <option value="cohesionless-loose">Cohesionless: very loose to loose</option>
                        <option value="cohesionless-medium">Cohesionless: loose to medium dense</option>
                        <option value="cohesionless-dense">Cohesionless: medium dense to very dense</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Distribution 1V:xH
                      <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={layer.distributionRatio} onChange={(e) => updateLayer(layer.id, (current) => ({ ...current, distributionMode: 'manual', distributionBasisId: 'manual', distributionRatio: e.target.value }))} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="bearing-results-summary" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Results</h2>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Overall</div>
                <div className={`mt-1 text-lg font-semibold ${result.summary.overallPass ? 'text-emerald-600' : 'text-red-600'}`}>{result.summary.overallPass ? 'Pass' : 'Review required'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Controlling method</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{result.summary.controllingMethod || '-'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Controlling layer</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{result.summary.controllingLayerName || '-'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Worst ratio</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{result.summary.controllingRatio.toFixed(2)}</div>
              </div>
            </div>

            <BearingCapacityChart chart={result.chart} />

            <div id="bearing-results-table" className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left">Layer</th>
                    <th className="px-2 py-2 text-left">Base depth</th>
                    <th className="px-2 py-2 text-left">Qall</th>
                    <th className="px-2 py-2 text-left">Linear</th>
                    <th className="px-2 py-2 text-left">Westergaard</th>
                    <th className="px-2 py-2 text-left">Boussinesq</th>
                  </tr>
                </thead>
                <tbody>
                  {result.layerChecks.map((check) => (
                    <tr key={check.layerId} className="border-t border-slate-200">
                      <td className="px-2 py-2 font-medium text-slate-800">{check.layerName}</td>
                      <td className="px-2 py-2">{check.baseDepthM.toFixed(2)} m</td>
                      <td className="px-2 py-2">{check.bearing.qall.toFixed(1)} kPa</td>
                      <td className={`px-2 py-2 ${check.pass.linear ? 'text-emerald-600' : 'text-red-600'}`}>{check.stress.linear.toFixed(1)}</td>
                      <td className={`px-2 py-2 ${check.pass.westergaard ? 'text-emerald-600' : 'text-red-600'}`}>{check.stress.westergaard.toFixed(1)}</td>
                      <td className={`px-2 py-2 ${check.pass.boussinesq ? 'text-emerald-600' : 'text-red-600'}`}>{check.stress.boussinesq.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="bearing-assessment-note" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Assessment note</h2>
            <textarea className="min-h-[96px] w-full rounded-lg border border-slate-300 p-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{summaryText}</div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Parameter basis</h2>
            <input
              className="mb-4 w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="Search parameter basis, formula or source"
              value={basisQuery}
              onChange={(e) => setBasisQuery(e.target.value)}
            />
            <div className="space-y-4">
              {basisGroups.map((group) => {
                const items = filteredBasisItems.filter((item) => item.category === group.key);
                if (!items.length) return null;
                return (
                  <div key={group.key}>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {items.map((item) => (
                        <button key={item.id} onClick={() => setSelectedBasisId(item.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800">{item.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.code}</div>
                            </div>
                            {(() => {
                              const value = getBasisCardValue(item.id);
                              return value ? (
                                <div className="text-right text-xs font-semibold text-slate-600">{value}</div>
                              ) : null;
                            })()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <button onClick={saveAssessment} className="w-full rounded-xl bg-[var(--module-accent)] px-4 py-3 font-bold text-white hover:opacity-90">
            <span className="inline-flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save bearing check
            </span>
          </button>
        </div>
      </div>

      {selectedBasis && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4" onClick={() => setSelectedBasisId(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-lg font-semibold text-slate-800">{selectedBasis.title}</div>
            <div className="space-y-4 text-sm text-slate-700">
              {'code' in selectedBasis ? <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{selectedBasis.code}</div> : null}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Definition</div>
                <div className="mt-1">{selectedBasis.definition}</div>
              </div>
              {'formula' in selectedBasis && selectedBasis.formula ? (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Formula</div>
                  <div className="mt-1 font-mono text-xs text-slate-800">{selectedBasis.formula}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guidance</div>
                <div className="mt-1">{selectedBasis.guidance}</div>
              </div>
              {'usedIn' in selectedBasis && selectedBasis.usedIn?.length ? (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Used in</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBasis.usedIn.map((use) => (
                      <span key={use} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{use}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {'relatedTargets' in selectedBasis && selectedBasis.relatedTargets?.length ? (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Related settings</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBasis.relatedTargets.map((target) => (
                      <button
                        key={target.targetId}
                        type="button"
                        onClick={() => jumpToTarget(target.targetId)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {target.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {selectedBasis.relatedTargets.map((t) => {
                      const currentValue = getCurrentValueForTarget(t.targetId);
                      if (!currentValue) return null;
                      return (
                        <div key={t.targetId}>
                          <span className="font-semibold">{t.label}:</span> {currentValue}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Source</div>
                <div className="mt-1">{selectedBasis.source}</div>
              </div>
              {'sectionId' in selectedBasis && selectedBasis.sectionId ? (
                <button
                  type="button"
                  onClick={() => jumpToTarget(selectedBasis.sectionId)}
                  className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Jump to related section
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <SaveSuccessModal
        isOpen={showSuccessModal}
        entryId={savedEntryId}
        onContinue={() => {
          setShowSuccessModal(false);
          setSavedEntryId(null);
          resetForm();
        }}
      />
    </div>
  );
};


