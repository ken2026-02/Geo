import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { entryRepo } from '../repositories/entryRepo';
import { slopeRepo, SlopeAssessment as SlopeAssessmentType } from '../repositories/slopeRepo';
import { qRepo, QAssessment as QAssessmentType } from '../repositories/qRepo';
import { rmrRepo, RmrAssessment } from '../repositories/rmrRepo';
import { getGSIAssessmentByEntryId, GSIAssessment } from '../repositories/gsiRepo';
import { structuralRepo, StructuralAssessment } from '../repositories/structuralRepo';
import { supportDesignRepo, SupportDesign } from '../repositories/supportDesignRepo';
import { supportDesignCalculatorRepo, SupportDesignCalculation } from '../repositories/supportDesignCalculatorRepo';
import { bearingCapacityRepo, BearingCapacityAssessmentRecord } from '../repositories/bearingCapacityRepo';
import { earthPressureRepo, EarthPressureAssessment } from '../repositories/earthPressureRepo';
import { settlementScreeningRepo, SettlementScreeningAssessment } from '../repositories/settlementScreeningRepo';
import { retainingWallRepo, RetainingWallCheck } from '../repositories/retainingWallRepo';
import { soilSlopeRepo, SoilSlopeStability } from '../repositories/soilSlopeRepo';
import { wedgeFoSRepo, WedgeFoSAssessment } from '../repositories/wedgeFoSRepo';
import { mappingRepo, MappingEntry } from '../repositories/mappingRepo';
import { investigationRepo, InvestigationLogEntry } from '../repositories/investigationRepo';
import { quickLogRepo, QuickLogEntry } from '../repositories/quickLogRepo';
import { refRepo } from '../repositories/refRepo';
import { getSupportDesign } from '../rules/supportDesignRules';
import { predictFailureModes } from '../rules/failureRules';
import { getBlob } from '../media/mediaStore';
import { Calendar, User, MapPin, AlertTriangle, CheckCircle2, X, Info, Calculator, ShieldCheck, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import { formatLocationShort } from '../utils/formatters';
import { getEntryTypeLabel } from "../utils/entryTypes";
import { TimeoutSafety } from '../components/TimeoutSafety';
import { Layout } from '../components/Layout';
import { exportBearingCapacityReport } from '../utils/exportBundle';

export const EntryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<any>(null);
  const [slopeData, setSlopeData] = useState<SlopeAssessmentType | null>(null);
  const [qData, setQData] = useState<QAssessmentType | null>(null);
  const [rmrData, setRmrData] = useState<RmrAssessment | null>(null);
  const [gsiData, setGsiData] = useState<GSIAssessment | null>(null);
  const [structuralData, setStructuralData] = useState<StructuralAssessment | null>(null);
  const [supportDesignData, setSupportDesignData] = useState<SupportDesign | null>(null);
  const [supportCalcData, setSupportCalcData] = useState<SupportDesignCalculation | null>(null);
  const [bearingCapacityData, setBearingCapacityData] = useState<BearingCapacityAssessmentRecord | null>(null);
  const [earthPressureData, setEarthPressureData] = useState<EarthPressureAssessment | null>(null);
  const [settlementScreeningData, setSettlementScreeningData] = useState<SettlementScreeningAssessment | null>(null);
  const [retainingWallData, setRetainingWallData] = useState<RetainingWallCheck | null>(null);
  const [soilSlopeData, setSoilSlopeData] = useState<SoilSlopeStability | null>(null);
  const [wedgeFoSData, setWedgeFoSData] = useState<WedgeFoSAssessment | null>(null);
  const [mappingData, setMappingData] = useState<MappingEntry | null>(null);
  const [investigationData, setInvestigationData] = useState<InvestigationLogEntry | null>(null);
  const [quickLogData, setQuickLogData] = useState<QuickLogEntry | null>(null);
  const [indicators, setIndicators] = useState<string[]>([]);
  const [controls, setControls] = useState<string[]>([]);
  const [discontinuitySets, setDiscontinuitySets] = useState<{ dip: number, dip_dir: number }[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{ key: string, url: string }[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const loadData = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setTimedOut(false);

    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const data = entryRepo.getWithDetails(id);
      if (data) {
        setEntry(data);
        
        // Load entry type labels
        refRepo.getRefMap('ref_entry_type').then((map) => {
          const newLabels: Record<string, string> = {};
          map.forEach((v, k) => { newLabels[k] = v.label; });
          setLabels(prev => ({ ...prev, ...newLabels }));
        });

        // Load quick log data if applicable
        if (data.entry_type_id === 'ET7') {
          const quickLog = quickLogRepo.getByEntryId(id);
          if (quickLog) {
            setQuickLogData(quickLog);
          }
        }

        // Load mapping data if applicable
        if (data.entry_type_id === 'ET1') {
          const mapping = mappingRepo.getByEntryId(id);
          if (mapping) {
            setMappingData(mapping);
            const tables = [
              'ref_lithology',
              'ref_weathering',
              'ref_rock_strength',
              'ref_structure',
              'ref_groundwater',
              'ref_joint_spacing',
              'ref_persistence',
              'ref_aperture',
              'ref_roughness',
              'ref_infill',
              'ref_joint_water'
            ];

            Promise.all(tables.map(async (table) => {
              const map = await refRepo.getRefMap(table);
              const newLabels: Record<string, string> = {};
              map.forEach((v, k) => { newLabels[k] = v.label; });
              return newLabels;
            })).then((results) => {
              const merged = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
              setLabels(prev => ({ ...prev, ...merged }));
            });
          }
        }

        // Load investigation data if applicable
        if (data.entry_type_id === 'ET12') {
          const investigation = investigationRepo.getByEntryId(id);
          if (investigation) {
            setInvestigationData(investigation);
            const tables = [
              'ref_soil_material_type',
              'ref_soil_plasticity',
              'ref_soil_moisture',
              'ref_soil_consistency',
              'ref_soil_structure',
              'ref_origin_soil',
              'ref_soil_secondary_components',
              'ref_soil_grain_size',
              'ref_soil_grading',
              'ref_soil_fines_content',
              'ref_soil_density',
              'ref_soil_angularity',
              'ref_fill_type',
              'ref_fill_composition',
              'ref_fill_contaminants',
              'ref_fill_inclusions',
              'ref_transition_material'
            ];

            Promise.all(tables.map(async (table) => {
              const map = await refRepo.getRefMap(table);
              const newLabels: Record<string, string> = {};
              map.forEach((v, k) => { newLabels[k] = v.label; });
              return newLabels;
            })).then((results) => {
              const merged = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
              setLabels(prev => ({ ...prev, ...merged }));
            });
          }
        }

        // Load slope data if applicable
        if (data.entry_type_id === 'ET6') {
          const slope = slopeRepo.getByEntryId(id);
          if (slope) {
            setSlopeData(slope);
            const inds = slopeRepo.getIndicators(slope.id);
            const ctrls = slopeRepo.getControls(slope.id);
            const dSets = slopeRepo.getDiscontinuitySets(slope.id);
            setIndicators(inds);
            setControls(ctrls);
            setDiscontinuitySets(dSets);

            // Load labels for slope fields
            const tables = [
              'ref_slope_type', 'ref_failure_mode', 'ref_likelihood', 'ref_consequence',
              'ref_bench_condition', 'ref_toe_condition', 'ref_drainage_condition',
              'ref_instability_indicator', 'ref_controls'
            ];
            
            Promise.all(tables.map(async (table) => {
              const map = await refRepo.getRefMap(table);
              const newLabels: Record<string, string> = {};
              map.forEach((v, k) => { newLabels[k] = v.label; });
              return newLabels;
            })).then((results) => {
              const merged = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
              setLabels(merged);
            });
          }
        }

        // Load Q data if applicable
        if (data.entry_type_id === 'ET11') {
          const q = qRepo.getByEntryId(id);
          if (q) {
            setQData(q);
            const tables = ['ref_q_jn', 'ref_q_jr', 'ref_q_ja', 'ref_q_jw', 'ref_q_srf'];
            Promise.all(tables.map(async (table) => {
              const map = await refRepo.getRefMap(table);
              const newLabels: Record<string, string> = {};
              map.forEach((v, k) => { newLabels[k] = v.label; });
              return newLabels;
            })).then((results) => {
              const merged = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
              setLabels(merged);
            });
          }
        }

        // Load RMR data if applicable
        if (data.entry_type_id === 'ET13') {
          const rmr = rmrRepo.getByEntryId(id);
          if (rmr) {
            setRmrData(rmr);
          }
        }

        // Load GSI data if applicable
        if (data.entry_type_id === 'ET14') {
          getGSIAssessmentByEntryId(id).then(setGsiData);
        }

        // Load Structural Assessment data if applicable
        if (data.entry_type_id === 'ET15') {
          const structData = structuralRepo.getByEntryId(id);
          if (structData) {
            setStructuralData(structData);
          }
        }

        // Load Support Design data if applicable
        if (data.entry_type_id === 'ET16') {
          const supportData = supportDesignRepo.getByEntryId(id);
          if (supportData) {
            setSupportDesignData(supportData);
          }
        }

        // Load Support Calculator data if applicable
        if (data.entry_type_id === 'ET17') {
          const calcData = supportDesignCalculatorRepo.getByEntryId(id);
          if (calcData) {
            setSupportCalcData(calcData);
          }
        }

        // Load Bearing Capacity data if applicable
        if (data.entry_type_id === 'ET18') {
          const bcData = bearingCapacityRepo.getByEntryId(id);
          if (bcData) {
            setBearingCapacityData(bcData);
          }
        }

        // Load Earth Pressure data if applicable
        if (data.entry_type_id === 'ET19') {
          const epData = earthPressureRepo.getByEntryId(id);
          if (epData) {
            setEarthPressureData(epData);
          }
        }

        // Load Settlement Screening data if applicable
        if (data.entry_type_id === 'ET20') {
          const ssData = settlementScreeningRepo.getByEntryId(id);
          if (ssData) {
            setSettlementScreeningData(ssData);
          }
        }

        // Load Retaining Wall Check data if applicable
        if (data.entry_type_id === 'ET22') {
          const rwData = retainingWallRepo.getByEntryId(id);
          if (rwData) {
            setRetainingWallData(rwData);
          }
        }

        // Load Soil Slope Stability data if applicable
        if (data.entry_type_id === 'ET23') {
          const ssData = soilSlopeRepo.getByEntryId(id);
          if (ssData) {
            setSoilSlopeData(ssData);
          }
        }

        // Load Wedge FoS data if applicable
        if (data.entry_type_id === 'ET25') {
          const wfData = wedgeFoSRepo.getByEntryId(id);
          if (wfData) {
            setWedgeFoSData(wfData);
          }
        }

        // Load photos
        Promise.all(data.media.map(async (m: any) => {
          const blob = await getBlob(m.blob_key);
          return { key: m.blob_key, url: blob ? URL.createObjectURL(blob) : '' };
        })).then(setPhotos);
      } else {
        setError('Entry not found.');
      }
    } catch (err: any) {
      console.error('[EntryDetail] Error loading entry:', err);
      setError('Failed to load entry details.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    if (confirm('Delete this record? It will be hidden but can be restored.')) {
      await entryRepo.softDelete(id);
      window.dispatchEvent(new Event('entries-changed'));
      navigate(-1);
    }
  };

  const getModuleEditConfig = () => {
    if (!id || !entry) return null;
    if (entry.entry_type_id === 'ET7') return { path: '/quick-log', label: 'Quick Log' };
    if (entry.entry_type_id === 'ET1') return { path: '/mapping', label: 'Rock Mapping' };
    if (entry.entry_type_id === 'ET12') return { path: '/investigation-log', label: 'Investigation Log' };
    if (entry.entry_type_id === 'ET18') return { path: '/bearing-capacity', label: 'Bearing Capacity' };
    return null;
  };

  const handleModuleEdit = () => {
    const config = getModuleEditConfig();
    if (!config || !id) return;
    navigate(config.path, { state: { entryId: id, mode: 'edit' } });
  };

  if (timedOut) {
    return (
      <Layout title="Timeout" showBack>
        <div className="p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout title="Loading..." showBack>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600"></div>
            <p className="text-sm font-bold text-zinc-500">Loading Entry Details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !entry) {
    return (
      <Layout title="Error" showBack>
        <div className="flex h-screen flex-col items-center justify-center gap-6 p-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={40} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-zinc-900">{error || 'Entry Not Found'}</h2>
            <p className="text-sm text-zinc-500">
              The requested observation could not be loaded. It may have been deleted or the database is out of sync.
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl bg-zinc-900 px-8 py-3 font-bold text-white shadow-lg shadow-zinc-200 transition-transform active:scale-95"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  const getQualityLabel = (q: number) => {
    if (q > 40) return 'Very Good';
    if (q >= 10) return 'Good';
    if (q >= 4) return 'Fair';
    if (q >= 1) return 'Poor';
    if (q >= 0.1) return 'Very Poor';
    return 'Extremely Poor';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Entry Detail" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {/* Header Info */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
              entry.risk_level_id === 'R4' ? 'bg-red-100 text-red-600' :
              entry.risk_level_id === 'R3' ? 'bg-orange-100 text-orange-600' :
              'bg-zinc-100 text-zinc-600'
            }`}>
              {entry.risk_level_id} Risk
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={14} />
              {entry.status_id}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-zinc-900">
            {formatLocationShort(entry.location)}
          </h2>
          
          <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Calendar size={16} />
              <span className="text-xs">{new Date(entry.timestamp).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <User size={16} />
              <span className="text-xs">{entry.author}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <MapPin size={16} />
              <span className="text-xs">{entry.location.cluster_key}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <AlertTriangle size={16} />
              <span className="text-xs">{getEntryTypeLabel(entry.entry_type_id)}</span>
            </div>
          </div>
        </div>

        {/* Summary Paragraph */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-500 uppercase">
              {getEntryTypeLabel(entry.entry_type_id)}
            </div>
            <div className="flex gap-2">
              {getModuleEditConfig() && (
                <button 
                  onClick={handleModuleEdit}
                  className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <Edit2 size={12} />
                  Edit in Module
                </button>
              )}
              <button 
                onClick={() => navigate(`/entry/${id}/edit`)}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-200"
              >
                <Edit2 size={12} />
                {getModuleEditConfig() ? 'Entry Settings' : 'Edit'}
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Technical Summary</h3>
          <p className="text-sm leading-relaxed text-zinc-700 italic whitespace-pre-line">
            "{entry.summary || 'No summary generated.'}"
          </p>
        </div>

        {/* Quick Log Details */}
        {entry.entry_type_id === "ET7" && quickLogData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Info size={16} className="text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Quick Log Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Observation Mode</span>
                <span className="font-semibold text-zinc-800">{quickLogData.observation_mode}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Trigger Category</span>
                <span className="font-semibold text-zinc-800">{quickLogData.trigger_category || 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Further Review</span>
                <span className={`font-semibold ${quickLogData.review_required ? 'text-amber-700' : 'text-zinc-800'}`}>{quickLogData.review_required ? 'Required' : 'Not flagged'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Selected Observations</span>
                <span className="font-semibold text-zinc-800">{quickLogData.selected_observations.length || 0}</span>
              </div>
            </div>

            {quickLogData.selected_observations.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Observed Conditions</span>
                <div className="flex flex-wrap gap-1">
                  {quickLogData.selected_observations.map((item) => (
                    <span key={item} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {quickLogData.immediate_action && (
              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Immediate Action Taken</span>
                <p className="text-sm text-zinc-700 whitespace-pre-line">{quickLogData.immediate_action}</p>
              </div>
            )}
          </div>
        )}

        {/* Mapping Details */}
        {entry.entry_type_id === "ET1" && mappingData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Info size={16} className="text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Mapping Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Lithology</span>
                <span className="font-semibold text-zinc-800">{labels[mappingData.lithology_id] || mappingData.lithology_id || 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Weathering</span>
                <span className="font-semibold text-zinc-800">{labels[mappingData.weathering_id] || mappingData.weathering_id || 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Strength</span>
                <span className="font-semibold text-zinc-800">{labels[mappingData.strength_id] || mappingData.strength_id || 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Structure</span>
                <span className="font-semibold text-zinc-800">{labels[mappingData.structure_id] || mappingData.structure_id || 'N/A'}</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Groundwater</span>
                <span className="font-semibold text-zinc-800">{labels[mappingData.groundwater_id] || mappingData.groundwater_id || 'N/A'}</span>
              </div>
            </div>

            {mappingData.sets && mappingData.sets.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Discontinuity Sets</span>
                <div className="flex flex-col gap-3">
                  {mappingData.sets.map((set) => (
                    <div key={set.id || set.set_number} className="rounded-xl bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-zinc-800">Set {set.set_number}</span>
                        <span className="text-xs font-semibold text-zinc-600">{set.dip}/{String(set.dip_dir).padStart(3, '0')}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Spacing</span>
                          <span className="text-zinc-700">{labels[set.spacing_id] || set.spacing_id || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Persistence</span>
                          <span className="text-zinc-700">{labels[set.persistence_id] || set.persistence_id || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Aperture</span>
                          <span className="text-zinc-700">{labels[set.aperture_id] || set.aperture_id || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Roughness</span>
                          <span className="text-zinc-700">{labels[set.roughness_id] || set.roughness_id || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Infill</span>
                          <span className="text-zinc-700">{labels[set.infill_id] || set.infill_id || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-zinc-400">Joint Water</span>
                          <span className="text-zinc-700">{labels[set.water_id] || set.water_id || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Investigation Log Details */}
        {entry.entry_type_id === "ET12" && investigationData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Info size={16} className="text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Investigation Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Type</span>
                <span className="font-semibold text-zinc-800">{investigationData.investigation_type}</span>
              </div>
              {investigationData.material_type_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Material</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.material_type_id] || investigationData.material_type_id}</span>
                </div>
              )}
              {investigationData.transition_material_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Transition Material</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.transition_material_id] || investigationData.transition_material_id}</span>
                </div>
              )}
              {investigationData.fill_type_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Fill Type</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.fill_type_id] || investigationData.fill_type_id}</span>
                </div>
              )}
              {investigationData.origin_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Origin</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.origin_id] || investigationData.origin_id}</span>
                </div>
              )}
              {investigationData.moisture_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Moisture</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.moisture_id] || investigationData.moisture_id}</span>
                </div>
              )}
              {investigationData.structure_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Structure</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.structure_id] || investigationData.structure_id}</span>
                </div>
              )}
              {investigationData.plasticity_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Plasticity</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.plasticity_id] || investigationData.plasticity_id}</span>
                </div>
              )}
              {investigationData.consistency_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Consistency</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.consistency_id] || investigationData.consistency_id}</span>
                </div>
              )}
              {investigationData.grain_size_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Grain Size</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.grain_size_id] || investigationData.grain_size_id}</span>
                </div>
              )}
              {investigationData.grading_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Grading</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.grading_id] || investigationData.grading_id}</span>
                </div>
              )}
              {investigationData.fines_content_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Fines Content</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.fines_content_id] || investigationData.fines_content_id}</span>
                </div>
              )}
              {investigationData.density_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Density</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.density_id] || investigationData.density_id}</span>
                </div>
              )}
              {investigationData.angularity_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Angularity</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.angularity_id] || investigationData.angularity_id}</span>
                </div>
              )}
              {investigationData.composition_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Composition</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.composition_id] || investigationData.composition_id}</span>
                </div>
              )}
              {investigationData.contaminant_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Contaminants</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.contaminant_id] || investigationData.contaminant_id}</span>
                </div>
              )}
              {investigationData.inclusion_id && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Inclusions</span>
                  <span className="font-semibold text-zinc-800">{labels[investigationData.inclusion_id] || investigationData.inclusion_id}</span>
                </div>
              )}
            </div>

            {investigationData.secondary_components && (
              <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Secondary Components</span>
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(investigationData.secondary_components).map((id: string) => (
                    <span key={id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                      {labels[id] || id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {investigationData.notes && (
              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                <span className="font-semibold text-zinc-800 whitespace-pre-line">{investigationData.notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Investigation Logging Details */}
        {entry.entry_type_id === "ET12" && (
          <div className="mt-4 p-3 bg-slate-50 rounded">
            <h3 className="font-semibold text-sm mb-2">
              Investigation Logging
            </h3>

            <p className="text-sm text-gray-700 whitespace-pre-line">
              {entry.summary}
            </p>
          </div>
        )}

        {/* Wedge FoS Details */}
        {entry.entry_type_id === "ET25" && wedgeFoSData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Wedge FoS Analysis</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">FoS</span>
                <span className={`text-2xl font-bold ${wedgeFoSData.fos! < 1.0 ? 'text-red-600' : wedgeFoSData.fos! < 1.3 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {wedgeFoSData.fos?.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Stability Class</span>
                <span className="font-semibold text-zinc-800">{wedgeFoSData.stability_class}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Weight (kN)</span>
                <span className="font-semibold text-zinc-800">{wedgeFoSData.wedge_weight}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Friction Angle (°)</span>
                <span className="font-semibold text-zinc-800">{wedgeFoSData.friction_angle}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Cohesion (kPa)</span>
                <span className="font-semibold text-zinc-800">{wedgeFoSData.cohesion}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Groundwater</span>
                <span className="font-semibold text-zinc-800">{wedgeFoSData.groundwater_condition}</span>
              </div>
              {wedgeFoSData.controlling_pair && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Controlling Pair</span>
                  <span className="font-semibold text-zinc-800">{wedgeFoSData.controlling_pair}</span>
                </div>
              )}
              {(wedgeFoSData.wedge_trend != null || wedgeFoSData.wedge_plunge != null) && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Trend / Plunge</span>
                  <span className="font-semibold text-zinc-800">{wedgeFoSData.wedge_trend ?? '—'}° / {wedgeFoSData.wedge_plunge ?? '—'}°</span>
                </div>
              )}
              {(wedgeFoSData.water_head != null || wedgeFoSData.water_force != null) && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Water Head / Force</span>
                  <span className="font-semibold text-zinc-800">{wedgeFoSData.water_head ?? 0} m / {wedgeFoSData.water_force ?? 0} kN</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Interpretation</span>
              <p className="text-sm text-zinc-700 italic">{wedgeFoSData.interpretation}</p>
            </div>

            {(wedgeFoSData.shotcrete_thickness || wedgeFoSData.bolt_capacity || wedgeFoSData.anchor_force) && (
              <div className="pt-4 border-t border-zinc-100">
                <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Support Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {wedgeFoSData.support_type && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Support Type</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.support_type}</span>
                    </div>
                  )}
                  {wedgeFoSData.risk_class && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Risk Class</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.risk_class}</span>
                    </div>
                  )}
                  {wedgeFoSData.action_level && (
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Action Level</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.action_level}</span>
                    </div>
                  )}
                  {wedgeFoSData.support_recommendation && (
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Support Recommendation</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.support_recommendation}</span>
                    </div>
                  )}
                  {wedgeFoSData.review_required != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Review Required</span>
                      <span className="font-semibold text-zinc-800">{Number(wedgeFoSData.review_required) ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                  {wedgeFoSData.fos_shotcrete != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">FoS (+ Shotcrete)</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.fos_shotcrete?.toFixed(2)}</span>
                    </div>
                  )}
                  {wedgeFoSData.fos_bolt != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">FoS (+ Bolt)</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.fos_bolt?.toFixed(2)}</span>
                    </div>
                  )}
                  {wedgeFoSData.fos_anchor != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">FoS (+ Anchor)</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.fos_anchor?.toFixed(2)}</span>
                    </div>
                  )}
                  {wedgeFoSData.fos_combined != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">FoS (+ Combined Support)</span>
                      <span className="font-semibold text-zinc-800">{wedgeFoSData.fos_combined?.toFixed(2)}</span>
                    </div>
                  )}
                  {(wedgeFoSData.driving_force != null || wedgeFoSData.shear_resistance != null || wedgeFoSData.shotcrete_contribution != null || wedgeFoSData.bolt_contribution != null || wedgeFoSData.anchor_contribution != null) && (
                    <div className="flex flex-col col-span-2 gap-2 rounded-xl bg-zinc-50 p-3">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Force Breakdown</span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-zinc-500">Driving Force</span><span className="font-semibold text-zinc-800">{wedgeFoSData.driving_force ?? 0} kN</span>
                        <span className="text-zinc-500">Shear Resistance</span><span className="font-semibold text-zinc-800">{wedgeFoSData.shear_resistance ?? 0} kN</span>
                        <span className="text-zinc-500">Shotcrete Contribution</span><span className="font-semibold text-zinc-800">{wedgeFoSData.shotcrete_contribution ?? 0} kN</span>
                        <span className="text-zinc-500">Bolt Contribution</span><span className="font-semibold text-zinc-800">{wedgeFoSData.bolt_contribution ?? 0} kN</span>
                        <span className="text-zinc-500">Anchor Contribution</span><span className="font-semibold text-zinc-800">{wedgeFoSData.anchor_contribution ?? 0} kN</span>
                      </div>
                    </div>
                  )}
                  {wedgeFoSData.shotcrete_thickness && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Shotcrete Thickness (mm)</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.shotcrete_thickness}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Shotcrete Shear Strength (kPa)</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.shotcrete_shear_strength}</span>
                      </div>
                    </>
                  )}
                  {wedgeFoSData.bolt_capacity && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt Capacity (kN)</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.bolt_capacity}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt No. / Trend / Plunge</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.bolt_number ?? 1} / {wedgeFoSData.bolt_trend ?? '-'}° / {wedgeFoSData.bolt_plunge ?? '-'}°</span>
                      </div>
                    </>
                  )}
                  {wedgeFoSData.anchor_force && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Anchor Capacity (kN)</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.anchor_force}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-zinc-400">Anchor No. / Trend / Plunge</span>
                        <span className="font-semibold text-zinc-800">{wedgeFoSData.anchor_number ?? 1} / {wedgeFoSData.anchor_trend ?? '-'}° / {wedgeFoSData.anchor_plunge ?? '-'}°</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RMR Details */}
        {entry.entry_type_id === "ET13" && rmrData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rock Mass Rating</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-blue-600">{rmrData.total_rmr}</span>
              <span className="text-sm font-bold text-zinc-500 uppercase">{rmrData.rock_class}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">UCS Rating</span>
                <span className="font-semibold text-zinc-800">{rmrData.ucs_rating}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">RQD Rating</span>
                <span className="font-semibold text-zinc-800">{rmrData.rqd_rating}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Spacing Rating</span>
                <span className="font-semibold text-zinc-800">{rmrData.spacing_rating}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Condition Rating</span>
                <span className="font-semibold text-zinc-800">{rmrData.condition_rating}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Groundwater Rating</span>
                <span className="font-semibold text-zinc-800">{rmrData.groundwater_rating}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Orientation Adj.</span>
                <span className="font-semibold text-zinc-800">{rmrData.orientation_adjustment}</span>
              </div>
            </div>
          </div>
        )}

        {/* Q-System Details */}
        {qData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Q-System Classification</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-indigo-600">{qData.computed_q.toFixed(2)}</span>
              <span className="text-sm font-bold text-zinc-500 uppercase">{getQualityLabel(qData.computed_q)}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">RQD</span>
                <span className="font-semibold text-zinc-800">{qData.rqd}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Jn</span>
                <span className="font-semibold text-zinc-800 truncate" title={labels[qData.jn_id]}>{labels[qData.jn_id] || qData.jn_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Jr</span>
                <span className="font-semibold text-zinc-800 truncate" title={labels[qData.jr_id]}>{labels[qData.jr_id] || qData.jr_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Ja</span>
                <span className="font-semibold text-zinc-800 truncate" title={labels[qData.ja_id]}>{labels[qData.ja_id] || qData.ja_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Jw</span>
                <span className="font-semibold text-zinc-800 truncate" title={labels[qData.jw_id]}>{labels[qData.jw_id] || qData.jw_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">SRF</span>
                <span className="font-semibold text-zinc-800 truncate" title={labels[qData.srf_id]}>{labels[qData.srf_id] || qData.srf_id}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-600" />
                <span className="text-[10px] font-bold uppercase text-zinc-400">Support Design Guidance</span>
              </div>
              
              <div className="flex flex-col gap-3 rounded-xl bg-indigo-50/50 p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-zinc-800">{getSupportDesign(qData.computed_q).label}</span>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    {getSupportDesign(qData.computed_q).summary}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="flex flex-col gap-0.5 rounded-lg bg-white/50 p-2 border border-indigo-100">
                    <span className="text-[7px] font-bold uppercase text-zinc-400">Bolt Spacing</span>
                    <span className="text-[10px] font-bold text-zinc-700">{getSupportDesign(qData.computed_q).boltSpacing || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-lg bg-white/50 p-2 border border-indigo-100">
                    <span className="text-[7px] font-bold uppercase text-zinc-400">Mesh</span>
                    <span className="text-[10px] font-bold text-zinc-700">{getSupportDesign(qData.computed_q).meshRequired ? 'Required' : 'None'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-lg bg-white/50 p-2 border border-indigo-100">
                    <span className="text-[7px] font-bold uppercase text-zinc-400">Shotcrete</span>
                    <span className="text-[10px] font-bold text-zinc-700">{getSupportDesign(qData.computed_q).shotcreteThickness || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GSI Details */}
        {entry.entry_type_id === "ET14" && gsiData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-violet-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Geological Strength Index</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-violet-600">{gsiData.gsi_min} - {gsiData.gsi_max}</span>
              <span className="text-sm font-bold text-zinc-500 uppercase">Midpoint: {gsiData.gsi_mid}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Structure Class</span>
                <span className="font-semibold text-zinc-800">{gsiData.structure_class}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Surface Condition</span>
                <span className="font-semibold text-zinc-800">{gsiData.surface_condition_class}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Confidence Level</span>
                <span className="font-semibold text-zinc-800">{gsiData.confidence_level}</span>
              </div>
              {gsiData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{gsiData.notes}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-start text-xs text-slate-500 bg-slate-100 p-2 rounded">
              <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <p>GSI is provided as guidance only and requires engineering judgement.</p>
            </div>
          </div>
        )}

        {/* Structural Assessment Details */}
        {entry.entry_type_id === "ET15" && structuralData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-teal-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Structural Assessment</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-teal-600">{structuralData.dominant_failure_mode}</span>
              <span className={`text-sm font-bold uppercase ${
                structuralData.hazard_level === 'High' ? 'text-red-600' : 
                structuralData.hazard_level === 'Moderate' ? 'text-orange-500' : 
                'text-green-600'
              }`}>
                {structuralData.hazard_level} Hazard
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Slope Orientation</span>
                <span className="font-semibold text-zinc-800">{structuralData.slope_dip || '?'} / {structuralData.slope_dip_dir || '?'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Joint 1</span>
                <span className="font-semibold text-zinc-800">{structuralData.joint1_dip || '?'} / {structuralData.joint1_dip_dir || '?'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Joint 2</span>
                <span className="font-semibold text-zinc-800">{structuralData.joint2_dip || '?'} / {structuralData.joint2_dip_dir || '?'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Joint 3</span>
                <span className="font-semibold text-zinc-800">{structuralData.joint3_dip || '?'} / {structuralData.joint3_dip_dir || '?'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Planar Possible</span>
                <span className={`font-semibold ${structuralData.planar_possible ? 'text-red-600' : 'text-zinc-800'}`}>{structuralData.planar_possible ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Wedge Possible</span>
                <span className={`font-semibold ${structuralData.wedge_possible ? 'text-red-600' : 'text-zinc-800'}`}>{structuralData.wedge_possible ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Toppling Possible</span>
                <span className={`font-semibold ${structuralData.toppling_possible ? 'text-red-600' : 'text-zinc-800'}`}>{structuralData.toppling_possible ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Controlling Set</span>
                <span className="font-semibold text-zinc-800">{structuralData.controlling_set || 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Controlling Pair</span>
                <span className="font-semibold text-zinc-800">{structuralData.controlling_pair || 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Friction Angle</span>
                <span className="font-semibold text-zinc-800">{structuralData.friction_angle ?? 'Unknown'}{structuralData.friction_angle != null ? '?' : ''}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Confidence Level</span>
                <span className="font-semibold text-zinc-800">{structuralData.confidence_level || 'Unknown'}</span>
              </div>
              {structuralData.engineering_note && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Engineering Note</span>
                  <span className="font-semibold text-zinc-800 italic">{structuralData.engineering_note}</span>
                </div>
              )}
              {structuralData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{structuralData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Support Design Details */}
        {entry.entry_type_id === "ET16" && supportDesignData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-sky-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Support Design</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-sky-600">{supportDesignData.support_class || 'Unknown'}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt Length</span>
                <span className="font-semibold text-zinc-800">{supportDesignData.bolt_length_m ? `${supportDesignData.bolt_length_m}m` : 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt Spacing</span>
                <span className="font-semibold text-zinc-800">{supportDesignData.bolt_spacing_m ? `${supportDesignData.bolt_spacing_m}m` : 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Mesh Required</span>
                <span className={`font-semibold ${supportDesignData.mesh_required ? 'text-red-600' : 'text-zinc-800'}`}>{supportDesignData.mesh_required ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Shotcrete Thickness</span>
                <span className="font-semibold text-zinc-800">{supportDesignData.shotcrete_thickness_mm ? `${supportDesignData.shotcrete_thickness_mm}mm` : 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Drainage Required</span>
                <span className={`font-semibold ${supportDesignData.drainage_required ? 'text-red-600' : 'text-zinc-800'}`}>{supportDesignData.drainage_required ? 'Yes' : 'No'}</span>
              </div>
              {supportDesignData.support_notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{supportDesignData.support_notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Support Calculator Details */}
        {entry.entry_type_id === "ET17" && supportCalcData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-cyan-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Support Calculator</h3>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black tracking-tighter text-cyan-600">{supportCalcData.support_class || 'Unknown'}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt Length</span>
                <span className="font-semibold text-zinc-800">{supportCalcData.bolt_length_m ? `${supportCalcData.bolt_length_m}m` : 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bolt Spacing</span>
                <span className="font-semibold text-zinc-800">{supportCalcData.bolt_spacing_m ? `${supportCalcData.bolt_spacing_m}m` : 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Mesh Required</span>
                <span className={`font-semibold ${supportCalcData.mesh_required ? 'text-red-600' : 'text-zinc-800'}`}>{supportCalcData.mesh_required ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Shotcrete Thickness</span>
                <span className="font-semibold text-zinc-800">{supportCalcData.shotcrete_thickness_mm ? `${supportCalcData.shotcrete_thickness_mm}mm` : 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Drainage Required</span>
                <span className={`font-semibold ${supportCalcData.drainage_required ? 'text-red-600' : 'text-zinc-800'}`}>{supportCalcData.drainage_required ? 'Yes' : 'No'}</span>
              </div>
              {supportCalcData.design_note && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{supportCalcData.design_note}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bearing Capacity Details */}
        {entry.entry_type_id === "ET18" && bearingCapacityData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bearing Capacity</h3>
              <button
                onClick={() => exportBearingCapacityReport(id!)}
                className="ml-auto rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
              >
                Print / Save PDF
              </button>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              {bearingCapacityData.title && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Title</span>
                  <span className="font-semibold text-zinc-800">{bearingCapacityData.title}</span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Pressure</span>
                <span className="font-semibold text-zinc-800">{(bearingCapacityData.pressure_kpa ?? 0).toFixed(1)} kPa</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Track Geometry</span>
                <span className="font-semibold text-zinc-800">{(bearingCapacityData.track_length_m ?? 0).toFixed(3)} m × {(bearingCapacityData.track_width_m ?? 0).toFixed(3)} m</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Ultimate Capacity</span>
                <span className="font-semibold text-zinc-800">{bearingCapacityData.ultimate_bearing_capacity.toFixed(1)} kPa</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Allowable Capacity</span>
                <span className="font-semibold text-zinc-800">{bearingCapacityData.allowable_bearing_capacity.toFixed(1)} kPa</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Controlling Mode</span>
                <span className="font-semibold text-zinc-800">{bearingCapacityData.controlling_mode}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Overall Result</span>
                <span className={`font-semibold ${bearingCapacityData.overall_pass ? 'text-emerald-700' : 'text-red-700'}`}>
                  {bearingCapacityData.overall_pass ? 'Pass' : 'Review required'}
                </span>
              </div>
              {bearingCapacityData.controlling_layer && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Controlling Layer</span>
                  <span className="font-semibold text-zinc-800">{bearingCapacityData.controlling_layer}</span>
                </div>
              )}
              {bearingCapacityData.layers.length > 0 && (
                <div className="col-span-2 overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Layer</th>
                        <th className="px-3 py-2 text-left">Thickness</th>
                        <th className="px-3 py-2 text-left">φ</th>
                        <th className="px-3 py-2 text-left">γ</th>
                        <th className="px-3 py-2 text-left">1V:xH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[bearingCapacityData.platform, ...bearingCapacityData.layers].filter(Boolean).map((layer) => (
                        <tr key={layer!.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2 font-medium text-zinc-800">{layer!.name}</td>
                          <td className="px-3 py-2">{layer!.thicknessM.toFixed(2)} m</td>
                          <td className="px-3 py-2">{layer!.phiDeg.toFixed(1)}°</td>
                          <td className="px-3 py-2">{layer!.gammaKNm3.toFixed(1)}</td>
                          <td className="px-3 py-2">{layer!.distributionRatio.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bearingCapacityData.result?.layerChecks?.length ? (
                <div className="col-span-2 overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Layer</th>
                        <th className="px-3 py-2 text-left">Base Depth</th>
                        <th className="px-3 py-2 text-left">Qall</th>
                        <th className="px-3 py-2 text-left">Linear</th>
                        <th className="px-3 py-2 text-left">Westergaard</th>
                        <th className="px-3 py-2 text-left">Boussinesq</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bearingCapacityData.result.layerChecks.map((check) => (
                        <tr key={check.layerId} className="border-t border-zinc-200">
                          <td className="px-3 py-2 font-medium text-zinc-800">{check.layerName}</td>
                          <td className="px-3 py-2">{check.baseDepthM.toFixed(2)} m</td>
                          <td className="px-3 py-2">{check.bearing.qall.toFixed(1)} kPa</td>
                          <td className={`px-3 py-2 ${check.pass.linear ? 'text-emerald-700' : 'text-red-700'}`}>{check.stress.linear.toFixed(1)}</td>
                          <td className={`px-3 py-2 ${check.pass.westergaard ? 'text-emerald-700' : 'text-red-700'}`}>{check.stress.westergaard.toFixed(1)}</td>
                          <td className={`px-3 py-2 ${check.pass.boussinesq ? 'text-emerald-700' : 'text-red-700'}`}>{check.stress.boussinesq.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {bearingCapacityData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{bearingCapacityData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Earth Pressure Details */}
        {entry.entry_type_id === "ET19" && earthPressureData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-orange-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Earth Pressure</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Coefficient</span>
                <span className="font-semibold text-zinc-800">{earthPressureData.coefficient.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Resultant Force</span>
                <span className="font-semibold text-zinc-800">{earthPressureData.resultant_force.toFixed(1)} kN/m</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Application Point</span>
                <span className="font-semibold text-zinc-800">{earthPressureData.point_of_application.toFixed(1)} m</span>
              </div>
              {earthPressureData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{earthPressureData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settlement Screening Details */}
        {entry.entry_type_id === "ET20" && settlementScreeningData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Settlement Screening</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Settlement Concern</span>
                <span className={`font-semibold ${settlementScreeningData.settlement_risk === 'High' ? 'text-red-600' : settlementScreeningData.settlement_risk === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {settlementScreeningData.settlement_risk}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Diff. Settlement Concern</span>
                <span className={`font-semibold ${settlementScreeningData.differential_settlement_risk === 'High' ? 'text-red-600' : settlementScreeningData.differential_settlement_risk === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {settlementScreeningData.differential_settlement_risk}
                </span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Design Note</span>
                <span className="font-semibold text-zinc-800 italic">{settlementScreeningData.design_note}</span>
              </div>
              {settlementScreeningData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{settlementScreeningData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Retaining Wall Check Details */}
        {entry.entry_type_id === "ET22" && retainingWallData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-teal-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Retaining Wall Check</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Sliding FS</span>
                <span className={`font-semibold ${retainingWallData.sliding_fs < 1.1 ? 'text-red-600' : retainingWallData.sliding_fs < 1.5 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {retainingWallData.sliding_fs.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Overturning FS</span>
                <span className={`font-semibold ${retainingWallData.overturning_fs < 1.5 ? 'text-red-600' : retainingWallData.overturning_fs < 2.0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {retainingWallData.overturning_fs.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bearing Pressure</span>
                <span className="font-semibold text-zinc-800">{retainingWallData.bearing_pressure.toFixed(1)} kPa</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Eccentricity</span>
                <span className="font-semibold text-zinc-800">{retainingWallData.eccentricity.toFixed(2)} m</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Stability Result</span>
                <span className={`font-semibold ${retainingWallData.stability_result === 'Fail' ? 'text-red-600' : retainingWallData.stability_result === 'Review' ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {retainingWallData.stability_result}
                </span>
              </div>
              {retainingWallData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{retainingWallData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Soil Slope Stability Details */}
        {entry.entry_type_id === "ET23" && soilSlopeData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Calculator size={16} className="text-emerald-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Soil Slope Stability</h3>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Stability Concern</span>
                <span className={`font-semibold ${soilSlopeData.stability_concern === 'High' ? 'text-red-600' : soilSlopeData.stability_concern === 'Moderate' ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {soilSlopeData.stability_concern}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Indicative FS Band</span>
                <span className="font-semibold text-zinc-800">{soilSlopeData.indicative_fs_band}</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Design Note</span>
                <span className="font-semibold text-zinc-800 italic">{soilSlopeData.design_note}</span>
              </div>
              {soilSlopeData.notes && (
                <div className="flex flex-col col-span-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Notes</span>
                  <span className="font-semibold text-zinc-800 whitespace-pre-line">{soilSlopeData.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Slope Assessment Details */}
        {slopeData && (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <Info size={16} className="text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Assessment Details</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Slope Type</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.slope_type_id] || slopeData.slope_type_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Geometry</span>
                <span className="font-semibold text-zinc-800">{slopeData.height}m @ {slopeData.angle}°</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Failure Mode</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.failure_mode_id] || slopeData.failure_mode_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Risk Assessment</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.likelihood_id]} / {labels[slopeData.consequence_id]}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Bench Condition</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.bench_condition_id]}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Toe Condition</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.toe_condition_id]}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Drainage</span>
                <span className="font-semibold text-zinc-800">{labels[slopeData.drainage_condition_id]}</span>
              </div>
            </div>

            {indicators.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Instability Indicators</span>
                <div className="flex flex-wrap gap-1">
                  {indicators.map(id => (
                    <span key={id} className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                      {labels[id] || id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {controls.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Recommended Controls</span>
                <div className="flex flex-wrap gap-1">
                  {controls.map(id => (
                    <span key={id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {labels[id] || id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {slopeData && discontinuitySets.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="text-indigo-600" />
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Predicted Structural Failure Modes</span>
                </div>
                <div className="flex flex-col gap-2">
                  {predictFailureModes(
                    { dip: slopeData.angle, dipDirection: slopeData.dip_direction },
                    discontinuitySets.map(s => ({ dip: s.dip, dipDirection: s.dip_dir }))
                  ).map((failure, idx) => (
                    <div key={idx} className="flex flex-col gap-1 rounded-xl bg-indigo-50/50 p-3 border-l-4 border-indigo-500">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800">{failure.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          failure.severity === 'High' ? 'bg-red-100 text-red-700' : 
                          failure.severity === 'Moderate' ? 'bg-orange-100 text-orange-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {failure.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-relaxed">{failure.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Evidence</h3>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <button 
                  key={p.key} 
                  onClick={() => setSelectedPhoto(p.url)}
                  className="aspect-square overflow-hidden rounded-xl bg-zinc-200"
                >
                  <img src={p.url} className="h-full w-full object-cover" alt="Site Evidence" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <button 
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-6 right-6 text-white"
          >
            <X size={32} />
          </button>
          <img src={selectedPhoto} className="max-h-full max-w-full rounded-lg object-contain" alt="Enlarged Evidence" />
        </div>
      )}
      </div>
    </div>
  );
};
