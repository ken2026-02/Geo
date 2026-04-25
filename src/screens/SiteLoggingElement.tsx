import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PileGeometryCard } from '../components/siteLogging/PileGeometryCard';
import { ReferenceDiagramCard } from '../components/siteLogging/ReferenceDiagramCard';
import { PhotoGrid } from '../components/siteLogging/PhotoGrid';
import { supportElementRepo } from '../repositories/supportElementRepo';
import { siteRepo } from '../repositories/siteRepo';
import { siteDesignInputRepo } from '../repositories/siteDesignInputRepo';
import { siteDrillingRepo } from '../repositories/siteDrillingRepo';
import { siteInterpretationRepo } from '../repositories/siteInterpretationRepo';
import { siteGroundReferenceRepo } from '../repositories/siteGroundReferenceRepo';
import { siteBoreholeCalibrationRepo } from '../repositories/siteBoreholeCalibrationRepo';
import { siteCleanOutRepo } from '../repositories/siteCleanOutRepo';
import { siteApprovalRepo } from '../repositories/siteApprovalRepo';
import { siteVerificationRepo } from '../repositories/siteVerificationRepo';
import { siteLoggingPhraseRepo } from '../repositories/siteLoggingPhraseRepo';
import { siteOutputReportRepo } from '../repositories/siteOutputReportRepo';
import { siteFieldEventRepo } from '../repositories/siteFieldEventRepo';
import { sitePhotoAttachmentRepo } from '../repositories/sitePhotoAttachmentRepo';
import type {
  Site,
  SiteApprovalRecord,
  SiteBoreholeCalibration,
  SiteCleanOutRecord,
  SiteDrillingInterval,
  SiteDrillingRecord,
  SiteFieldEvent,
  SiteLoggingPhrase,
  SiteOutputReport,
  SitePhotoAttachment,
  SupportElement,
} from '../types/siteLogging';
import { buildSiteOutputReport, computeTorCard, evaluateSiteVerification } from '../services/siteLoggingEngines';
import { LOGGING_PHRASE_SEEDS, SITE_GROUND_REFERENCE_SEEDS } from '../services/siteLoggingSeeds';
import { exportSiteLoggingElementPack, importSiteLoggingElementPack } from '../services/siteLoggingPackService';
import {
  buildSiteLoggingReferenceTemplate,
  mergeUniquePhrases,
  validateSiteLoggingReferenceTemplate,
  type SiteLoggingReferenceTemplateV1,
} from '../services/siteLoggingReferenceTemplate';
import { SITE_LOGGING_STARTER_TEMPLATES } from '../services/siteLoggingStarterTemplates';
import {
  PHOTO_TYPE_REFERENCE_DIAGRAM,
  formatElementTypeShortLabel,
  formatStatusLabel,
  coerceElementTypeToFieldType,
  coerceStatusToFieldStatus,
} from '../services/siteLoggingUi';
import { deleteBlob, getBlob, putBlob } from '../media/mediaStore';
import {
  SITE_LOGGING_PHRASE_BASE_CATEGORIES,
  isFieldLogSentence,
  normalizePhraseCategory,
  normalizePhraseText,
  normalizePhraseTextKey,
} from '../services/siteLoggingPhrasePolicy';

const toNumberOrNull = (v: string): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// For field typing on mobile, avoid coercing numeric inputs on every keystroke.
// Controlled numeric inputs that immediately coerce "0." -> 0 make it impossible to type "0.1".
const parseNumberOrNull = (raw: string): number | null => {
  const s = String(raw || '').trim();
  if (!s) return null;
  // Allow in-progress typing; we commit on blur/save, not on each keypress.
  if (s === '-' || s === '.' || s === '-.' || s.endsWith('.')) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const safeJsonStringify = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return '{}';
  }
};

const parseJsonArray = (text: string): any[] => {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (text: string): Record<string, any> | null => {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as any) : null;
  } catch {
    return null;
  }
};

// Avoid hard-coded phrase lists here. Reference + global seeds are the source-of-truth for
// phrase suggestions and quick picks. Keep fixed enums only for engineering/workflow states.

const INTERP_VARIANCE_REASONS = [
  'groundwater_influence',
  'velocity_inversion',
  'rapid_depth_variation',
  'boulder_anomaly',
  'elevation_discrepancy',
  'offset_uncertainty',
  'drilling_observation',
  'other',
] as const;

// Admin mode is controlled: allow only "field-log-relevant" phrase categories.
// Keep engine/support categories (e.g. interpretation_hint) out of normal phrase editing.
const PHRASE_ADMIN_CATEGORIES: string[] = SITE_LOGGING_PHRASE_BASE_CATEGORIES.filter(
  (c) => !['template_family', 'template_family_primary', 'interpretation_hint'].includes(String(c))
);

const composeIntervalPhrase = (i: Partial<SiteDrillingInterval>) => {
  const parts: string[] = [];
  if (i.material_observed) parts.push(`Obs: ${i.material_observed}`);
  if (i.material_interpreted) parts.push(`Int: ${i.material_interpreted}`);
  if ((i as any).drilling_time_min != null && Number.isFinite((i as any).drilling_time_min)) parts.push(`Time: ${(i as any).drilling_time_min} min`);
  if (i.weathering_class && i.weathering_class !== 'not_applicable') parts.push(`Wth: ${i.weathering_class}`);
  if (i.rock_type && i.rock_type !== 'not_applicable') parts.push(`Rock: ${i.rock_type}`);
  if (i.recovery_type) parts.push(`Rec: ${i.recovery_type}`);
  if (i.water_condition && i.water_condition !== 'not_observed') parts.push(`Water: ${i.water_condition}`);
  const resp = i.drilling_response_json ? parseJsonArray(i.drilling_response_json).join(', ') : '';
  if (resp) parts.push(`Resp: ${resp}`);
  if (i.free_text_note) parts.push(i.free_text_note);
  return parts.join(' | ');
};

type PhraseBuilderSelections = {
  template_family: 'mixed' | 'interpreted_first' | 'observed_first' | 'condition_led' | 'rock_transition' | 'weak_band';
  observed_material: string;
  interpreted_material: string;
  colour: string;
  modifier: string;
  water: string;
  recovery: string;
  drilling_response: string;
  weathering: string;
  rock_type: string;
  common_phrase: string;
};

const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const buildIntervalSentence = (sel: PhraseBuilderSelections) => {
  const weathering = sel.weathering ? sel.weathering.trim() : '';
  const rock = sel.rock_type ? sel.rock_type.trim() : '';
  const interpreted = sel.interpreted_material ? sel.interpreted_material.trim() : '';
  const observed = sel.observed_material ? sel.observed_material.trim() : '';
  const colour = sel.colour ? sel.colour.trim() : '';
  const modifier = sel.modifier ? sel.modifier.trim() : '';
  const common = sel.common_phrase ? sel.common_phrase.trim() : '';

  const interpLead = (() => {
    if (weathering && rock) return `${weathering} ${sentenceCase(rock)}`.trim();
    return interpreted ? sentenceCase(interpreted) : '';
  })();

  const returns = (() => {
    const parts: string[] = [];
    if (observed) parts.push(sentenceCase(observed));
    if (colour) parts.push(colour);
    if (modifier) parts.push(modifier);
    return parts.filter(Boolean).join(', ');
  })();

  const condBits: string[] = [];
  if (sel.water && sel.water !== 'not_observed') condBits.push(String(sel.water).trim());
  if (sel.recovery) condBits.push(String(sel.recovery).trim());
  if (sel.drilling_response) condBits.push(String(sel.drilling_response).trim());
  const cond = condBits.filter(Boolean).join(', ');

  const join = (...parts: Array<string | null | undefined>) =>
    parts.map((p) => String(p || '').trim()).filter(Boolean).join(' ');

  const base = (() => {
    if (sel.template_family === 'interpreted_first') {
      if (interpLead && returns) return join(`${interpLead},`, `recovered as ${returns}.`);
      if (returns) return join(`Recovered as ${returns}.`);
      if (interpLead) return join(`${interpLead}.`);
      return '';
    }
    if (sel.template_family === 'observed_first') {
      if (returns && interpLead) return join(`Recovered as ${returns},`, `with fragments of ${interpLead}.`);
      if (returns) return join(`Recovered as ${returns}.`);
      if (interpLead) return join(`${interpLead}.`);
      return '';
    }
    if (sel.template_family === 'condition_led') {
      // Condition-led: start with field condition, then returns.
      if (cond && returns) return join(`${sentenceCase(cond)},`, `recovered as ${returns}.`, interpLead ? `Possible ${interpLead}.` : '');
      if (returns) return join(`Recovered as ${returns}.`);
      if (interpLead) return join(`${interpLead}.`);
      return '';
    }
    if (sel.template_family === 'rock_transition') {
      // Rock transition: emphasize interpreted transition first if available.
      if (interpLead && returns) return join(`Transition into ${interpLead}.`, `Recovered as ${returns}.`);
      if (interpLead) return join(`Transition into ${interpLead}.`);
      if (returns) return join(`Recovered as ${returns}.`);
      return '';
    }
    if (sel.template_family === 'weak_band') {
      // Weak band: keep neutral wording; relies on modifier/common phrase to convey uncertainty.
      if (interpLead && returns) return join(`${interpLead}.`, `Recovered as ${returns}.`, modifier ? `Possible ${modifier}.` : '');
      if (returns) return join(`Recovered as ${returns}.`);
      if (interpLead) return join(`${interpLead}.`);
      return '';
    }
    // mixed (default): keep both if present, but avoid awkward repetition.
    if (interpLead && returns) return join(`${interpLead}.`, `Recovered as ${returns}.`);
    if (returns) return join(`Recovered as ${returns}.`);
    if (interpLead) return join(`${interpLead}.`);
    return '';
  })();

  const withCond = cond ? join(base, cond.endsWith('.') ? cond : `${cond}.`) : base;
  const withCommon = common ? join(withCond, common.endsWith('.') ? common : `${common}.`) : withCond;
  return withCommon.replace(/\s+/g, ' ').trim();
};

export const SiteLoggingElement: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const elementId = String(id || '');

  const intervalTopRef = React.useRef<HTMLDivElement | null>(null);
  const importElementPackInputRef = React.useRef<HTMLInputElement | null>(null);
  const datalistIdPrefix = useMemo(() => `site-log-${elementId.slice(0, 8)}`, [elementId]);

  const [element, setElement] = useState<SupportElement | null>(null);
  const [site, setSite] = useState<Site | null>(null);

  const [activeStep, setActiveStep] = useState<
    'Setup' | 'Reference' | 'Logging' | 'Interpretation' | 'Verification' | 'Closeout'
  >('Logging');
  const [referenceAdminMode, setReferenceAdminMode] = useState(false);
  const [showReferenceNotes, setShowReferenceNotes] = useState(false);
  const [showVerificationAdvanced, setShowVerificationAdvanced] = useState(false);
  const [pendingRefTemplate, setPendingRefTemplate] = useState<SiteLoggingReferenceTemplateV1 | null>(null);
  const [pendingRefTemplateMode, setPendingRefTemplateMode] = useState<'replace' | 'merge' | 'phrases_only' | 'ground_only'>('merge');
  const importRefTemplateInputRef = React.useRef<HTMLInputElement | null>(null);
  const [starterTemplateId, setStarterTemplateId] = useState<string>('');
  const [showPendingRefTemplateDetails, setShowPendingRefTemplateDetails] = useState(false);

  const [designType, setDesignType] = useState('Default');
  // Setup is field-first; no type override or reference-RL selector in normal UI.
  const [designInput, setDesignInput] = useState<any>({
    design_length_to_rock_m: null,
    design_anchorage_length_m: null,
    design_bonded_length_m: null,
    design_debonded_length_m: null,
    design_total_length_m: null,
    required_plunge_length_m: null,
    // Legacy single socket requirement (kept for existing records)
    required_socket_length_m: null,

    // Pile (field) requirements
    governing_rock_condition: 'auto', // 'auto' | 'hw' | 'mw' | 'mixed'
    required_socket_hw_m: null,
    required_socket_mw_m: null,
    required_min_anchorage_below_ubolt_m: null,
    u_bolt_zone_length_m: null,
    lowest_ubolt_depth_m: null,
    final_drilled_depth_m: null, // optional manual override for verification
    socket_basis: 'gross_socket',
    allow_overdrill: true,
    max_overdrill_m: null,
    suggested_overdrill_m: null,
    rock_basis: 'competent_rock',
    weak_band_deduction_required: false,
    clean_out_required: true,
    grout_approval_required: true,
    working_load_kN: null,
    inclination_to_horizontal_deg: null,
    horizontal_bearing: '',
    approval_notes: '',
    bar_id: '',
  });
  const [showSetupAdvanced, setShowSetupAdvanced] = useState(false);

  // Raw inputs for pile essentials to allow typing decimals like "0.1" without being coerced to "0".
  const [pileGroundRlRaw, setPileGroundRlRaw] = useState('');
  const [pileHoleDiaRaw, setPileHoleDiaRaw] = useState('');
  const [pileBaseCasingRaw, setPileBaseCasingRaw] = useState('');
  const [pileMinPlungeRaw, setPileMinPlungeRaw] = useState('');
  const [pileUboltZoneRaw, setPileUboltZoneRaw] = useState('');
  const [pileLowestUboltRaw, setPileLowestUboltRaw] = useState('');
  const [pileMinAnchBelowUboltRaw, setPileMinAnchBelowUboltRaw] = useState('');
  const [pileSocketHwRaw, setPileSocketHwRaw] = useState('');
  const [pileSocketMwRaw, setPileSocketMwRaw] = useState('');
  const [pileMaxOverdrillRaw, setPileMaxOverdrillRaw] = useState('');
  const [pileFinalDepthRaw, setPileFinalDepthRaw] = useState('');
  // Legacy raw inputs (kept for existing records; advanced-only if shown)
  // Legacy numeric fields exist in stored design JSON for backwards compatibility, but are no longer edited in field UI.

  // Raw inputs for Anchor/Soil Nail numeric fields (allow typing "0.2" without losing the dot mid-entry).
  const [anchorAnchorageRaw, setAnchorAnchorageRaw] = useState('');
  const [anchorSocketRaw, setAnchorSocketRaw] = useState('');
  const [anchorWorkingLoadRaw, setAnchorWorkingLoadRaw] = useState('');
  const [anchorMaxOverdrillRaw, setAnchorMaxOverdrillRaw] = useState('');
  const [anchorBondedRaw, setAnchorBondedRaw] = useState('');
  const [anchorDebondedRaw, setAnchorDebondedRaw] = useState('');

  const [records, setRecords] = useState<SiteDrillingRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string>('');
  const [intervals, setIntervals] = useState<SiteDrillingInterval[]>([]);
  const [showAllIntervalHistory, setShowAllIntervalHistory] = useState(false);

  const [newRecordDate, setNewRecordDate] = useState('');
  const [newRecordMethod, setNewRecordMethod] = useState('');
  const [recordStartDate, setRecordStartDate] = useState('');
  const [recordEndDate, setRecordEndDate] = useState('');
  const [recordLoggedBy, setRecordLoggedBy] = useState('');
  const [recordApprovedBy, setRecordApprovedBy] = useState('');
  const [recordPageCount, setRecordPageCount] = useState('');
  const [recordGeneralNote, setRecordGeneralNote] = useState('');

  const [newFrom, setNewFrom] = useState('0');
  const [newTo, setNewTo] = useState('0.5');
  const [newTimeMin, setNewTimeMin] = useState('');
  const [newObs, setNewObs] = useState('');
  const [newMatObs, setNewMatObs] = useState('');
  const [newMatInt, setNewMatInt] = useState('');
  const [newWeathering, setNewWeathering] = useState<'rs' | 'xw' | 'hw' | 'mw' | 'sw' | 'fr' | 'not_applicable'>('not_applicable');
  const [newRockType, setNewRockType] = useState<'argillite' | 'greywacke' | 'granodiorite' | 'arenite' | 'unknown_rock' | 'not_applicable'>('not_applicable');
  const [newRecoveryType, setNewRecoveryType] = useState<'good_return' | 'reduced_return' | 'partial_loss' | 'no_return' | 'inconsistent_recovery' | 'chips' | 'fine_dust' | 'mixed_return'>('good_return');
  const [newWater, setNewWater] = useState<'dry' | 'moist' | 'wet' | 'with_water' | 'water_encountered' | 'water_loss' | 'not_observed'>('not_observed');
  const [newResponses, setNewResponses] = useState<string[]>([]);
  const [newFreeNote, setNewFreeNote] = useState('');
  const [newFinalPhrase, setNewFinalPhrase] = useState('');
  const [newAutoPhrase, setNewAutoPhrase] = useState('');
  const [newFinalPhraseEdited, setNewFinalPhraseEdited] = useState(false);
  const [showFinalPhraseAdvanced, setShowFinalPhraseAdvanced] = useState(false);
  const [templateFamilyTouched, setTemplateFamilyTouched] = useState(false);
  const [phraseSel, setPhraseSel] = useState<PhraseBuilderSelections>({
    template_family: 'mixed',
    observed_material: '',
    interpreted_material: '',
    colour: '',
    modifier: '',
    water: '',
    recovery: '',
    drilling_response: '',
    weathering: '',
    rock_type: '',
    common_phrase: '',
  });

  const [editingIntervalId, setEditingIntervalId] = useState<string>('');
  const [editFrom, setEditFrom] = useState('0');
  const [editTo, setEditTo] = useState('0.5');
  const [editTimeMin, setEditTimeMin] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editMatObs, setEditMatObs] = useState('');
  const [editMatInt, setEditMatInt] = useState('');
  const [editWeathering, setEditWeathering] = useState<'rs' | 'xw' | 'hw' | 'mw' | 'sw' | 'fr' | 'not_applicable'>('not_applicable');
  const [editRockType, setEditRockType] = useState<'argillite' | 'greywacke' | 'granodiorite' | 'arenite' | 'unknown_rock' | 'not_applicable'>('not_applicable');
  const [editRecoveryType, setEditRecoveryType] = useState<'good_return' | 'reduced_return' | 'partial_loss' | 'no_return' | 'inconsistent_recovery' | 'chips' | 'fine_dust' | 'mixed_return'>('good_return');
  const [editWater, setEditWater] = useState<'dry' | 'moist' | 'wet' | 'with_water' | 'water_encountered' | 'water_loss' | 'not_observed'>('not_observed');
  const [editResponses, setEditResponses] = useState<string[]>([]);
  const [editFreeNote, setEditFreeNote] = useState('');
  const [editFinalPhrase, setEditFinalPhrase] = useState('');

  // Interpretation (Word schema fields)
  const [interpReferenceTorDepth, setInterpReferenceTorDepth] = useState<string>('');
  const [interpReferenceTorVelocity, setInterpReferenceTorVelocity] = useState<string>('');
  const [interpActualTorDepth, setInterpActualTorDepth] = useState<string>('');
  const [interpReasonsJson, setInterpReasonsJson] = useState('[]');
  const [interpContinuousRockStart, setInterpContinuousRockStart] = useState<string>('');
  const [interpWeakBandsJson, setInterpWeakBandsJson] = useState('[]');
  const [interpConfidence, setInterpConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [interpVarianceClass, setInterpVarianceClass] = useState<
    'within_range' | 'slightly_deeper' | 'significantly_deeper' | 'shallower_than_expected' | 'inconsistent_with_reference'
  >('inconsistent_with_reference');
  const [interpSummary, setInterpSummary] = useState('');
  const [interpWeakBands, setInterpWeakBands] = useState<Array<{ from_m: string; to_m: string; note: string }>>([]);
  const [interpVarianceReasons, setInterpVarianceReasons] = useState<string[]>([]);
  const [interpVarianceOther, setInterpVarianceOther] = useState('');
  const [showInterpretationAdvanced, setShowInterpretationAdvanced] = useState(false);

  const [refType, setRefType] = useState('GeotechUnit');
  const [refSource, setRefSource] = useState('');
  const [refJson, setRefJson] = useState(safeJsonStringify({}));
  const [refs, setRefs] = useState<any[]>([]);
  const [groundRefReferenceObj, setGroundRefReferenceObj] = useState<Record<string, any>>({});

  // Phrase admin policy lives inside the project-maintained reference JSON so we can
  // support reorder/archive without schema changes. Define it before any phrase
  // suggestion hooks that depend on it.
  const phraseAdminPolicy = useMemo(() => {
    const obj: any = groundRefReferenceObj && typeof groundRefReferenceObj === 'object' ? groundRefReferenceObj : {};
    const pa: any = obj.phrase_admin && typeof obj.phrase_admin === 'object' ? obj.phrase_admin : {};
    const archived = Array.isArray(pa.archived_ids) ? pa.archived_ids.map(String) : [];
    const orderByCatRaw = pa.order_by_category && typeof pa.order_by_category === 'object' ? pa.order_by_category : {};
    const orderByCategory: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(orderByCatRaw)) {
      orderByCategory[String(k)] = Array.isArray(v) ? (v as any[]).map(String) : [];
    }
    return {
      archivedIds: new Set<string>(archived),
      orderByCategory,
    };
  }, [groundRefReferenceObj]);
  const [groundRefUnitsJson, setGroundRefUnitsJson] = useState('[]');
  // Legacy optional depth cues (ToR/velocity) are still stored in DB for compatibility,
  // but are no longer shown in the field/admin UI (site workflow does not use them).
  const [groundRefExpectedTorMin, setGroundRefExpectedTorMin] = useState<string>('');
  const [groundRefExpectedTorMax, setGroundRefExpectedTorMax] = useState<string>('');
  const [groundRefRefVelocity, setGroundRefRefVelocity] = useState<string>('1600');
  const [groundRefRiskFlagsJson, setGroundRefRiskFlagsJson] = useState('[]');
  const [groundRefNotes, setGroundRefNotes] = useState('');
  const [groundRefUnitDraft, setGroundRefUnitDraft] = useState('');
  const [groundRefRiskDraft, setGroundRefRiskDraft] = useState('');
  const [boreholeCalibrations, setBoreholeCalibrations] = useState<SiteBoreholeCalibration[]>([]);
  const [newBhId, setNewBhId] = useState('');
  const [newBhTor, setNewBhTor] = useState('');
  const [newBhVel, setNewBhVel] = useState('');
  const [newBhDiff, setNewBhDiff] = useState('');
  const [newBhConf, setNewBhConf] = useState<'high' | 'medium' | 'low' | ''>('');
  const [bhEditId, setBhEditId] = useState<string>('');
  const [bhEditDraft, setBhEditDraft] = useState<any | null>(null);
  const [cleanOut, setCleanOut] = useState<SiteCleanOutRecord | null>(null);
  const [approval, setApproval] = useState<SiteApprovalRecord | null>(null);
  const [phrases, setPhrases] = useState<SiteLoggingPhrase[]>([]);
  const [phraseRevision, setPhraseRevision] = useState(0);
  const [showArchivedPhrases, setShowArchivedPhrases] = useState(false);
  const [phraseFormCategory, setPhraseFormCategory] = useState<string>('common_phrase');
  const [phraseFormText, setPhraseFormText] = useState<string>('');
  const [phraseEditId, setPhraseEditId] = useState<string>('');
  const [phraseEditCategory, setPhraseEditCategory] = useState<string>('');
  const [phraseEditOriginalCategory, setPhraseEditOriginalCategory] = useState<string>('');
  const [phraseEditText, setPhraseEditText] = useState<string>('');
  const [outputReport, setOutputReport] = useState<SiteOutputReport | null>(null);
  const [verificationSummary, setVerificationSummary] = useState<any | null>(null);
  const [reportPreview, setReportPreview] = useState('');
  const [fieldEvents, setFieldEvents] = useState<SiteFieldEvent[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhotoAttachment[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoTakenAt, setNewPhotoTakenAt] = useState('');
  const [newPhotoType, setNewPhotoType] = useState<string>('other');
  const [newPhotoDepth, setNewPhotoDepth] = useState('');
  const [newPhotoRecordId, setNewPhotoRecordId] = useState<string>('');

  // Pile verification reference diagram (guidance only). Stored using existing photo attachment path,
  // but kept out of normal drilling photo lists and standard photo output.
  const [pileDiagramFile, setPileDiagramFile] = useState<File | null>(null);
  const [pileDiagramCaption, setPileDiagramCaption] = useState('');

  const [newEventDateTime, setNewEventDateTime] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('');
  const [newEventDepth, setNewEventDepth] = useState('');
  const [newEventNote, setNewEventNote] = useState('');

  const [cleanMethodAir, setCleanMethodAir] = useState(false);
  const [cleanMethodWater, setCleanMethodWater] = useState(false);
  const [cleanMethodGrout, setCleanMethodGrout] = useState(false);
  const [cleanDepth, setCleanDepth] = useState('');
  const [cleanDateTime, setCleanDateTime] = useState('');
  const [cleanBaseCondition, setCleanBaseCondition] = useState<'clean' | 'soft' | 'sedimented' | 'contaminated' | 'unknown'>('unknown');
  const [cleanSediment, setCleanSediment] = useState(false);
  const [cleanApproved, setCleanApproved] = useState(false);
  const [cleanNote, setCleanNote] = useState('');

  const [approvalLoggedBy, setApprovalLoggedBy] = useState('');
  const [approvalReviewedBy, setApprovalReviewedBy] = useState('');
  const [approvalApprovedBy, setApprovalApprovedBy] = useState('');
  const [approvalDateTime, setApprovalDateTime] = useState('');
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  const record = useMemo(() => records.find((r) => r.id === activeRecordId) ?? null, [records, activeRecordId]);
  const elementType = String(element?.element_type || '');
  const phraseElementType = useMemo(() => {
    // Phrase learning/stats are grouped by field workflow type.
    const t = coerceElementTypeToFieldType(elementType);
    if (t === 'micro_pile') return 'micro_pile';
    if (t === 'soil_nail') return 'soil_nail';
    return 'anchor';
  }, [elementType]);
  const elementDesignMode = useMemo(() => {
    const t = coerceElementTypeToFieldType(elementType);
    if (t === 'micro_pile') return 'MicroPile';
    if (t === 'soil_nail') return 'SoilNail';
    return 'Anchor';
  }, [elementType]);
  const effectiveDesignType = elementDesignMode;
  const visibleWorkflowSteps = ['Setup', 'Reference', 'Logging', 'Verification', 'Closeout'] as const;

  const phraseUsage = useMemo(() => {
    // Usage stats are computed from saved intervals (frequency + recency) to drive "learning" suggestions
    // without needing schema changes for weights.
    type Stat = { count: number; lastUsedTs: number };
    const byCategory = new Map<string, Map<string, Stat>>();

    const bump = (category: string, rawText: string | null | undefined, ts: number) => {
      const text = String(rawText || '').trim();
      if (!text) return;
      const c = category.trim();
      if (!c) return;
      if (!byCategory.has(c)) byCategory.set(c, new Map());
      const m = byCategory.get(c)!;
      const key = text;
      const prev = m.get(key) ?? { count: 0, lastUsedTs: 0 };
      m.set(key, { count: prev.count + 1, lastUsedTs: Math.max(prev.lastUsedTs, ts) });
    };

    for (const it of intervals) {
      const ts = (() => {
        const d = (it.updated_at || it.created_at) ? new Date(String(it.updated_at || it.created_at)) : null;
        const n = d && Number.isFinite(d.getTime()) ? d.getTime() : 0;
        return n || 0;
      })();

      bump('observed_material', (it as any).material_observed ?? null, ts);
      bump('interpreted_material', (it as any).material_interpreted ?? null, ts);
      bump('colour', (it as any).colour ?? null, ts);

      const water = (it as any).water_condition ? String((it as any).water_condition).replace(/_/g, ' ') : '';
      bump('water', water, ts);
      const recovery = (it as any).recovery_type ? String((it as any).recovery_type).replace(/_/g, ' ') : '';
      bump('recovery', recovery, ts);

      const resp = (it as any).drilling_response_json ? parseJsonArray(String((it as any).drilling_response_json)) : [];
      for (const r of resp) bump('drilling_response', String(r).replace(/_/g, ' '), ts);

      if ((it as any).weathering_class && (it as any).weathering_class !== 'not_applicable') {
        bump('weathering', String((it as any).weathering_class).toUpperCase(), ts);
      }
      if ((it as any).rock_type && (it as any).rock_type !== 'not_applicable') {
        bump('rock_type', String((it as any).rock_type), ts);
      }

      const sec = (it as any).secondary_components_json ? parseJsonObject(String((it as any).secondary_components_json)) : null;
      if (sec) {
        bump('template_family', sec.template_family ?? sec.template_id ?? null, ts);
        bump('modifier', sec.modifier ?? null, ts);
        bump('common_phrase', sec.common_phrase ?? null, ts);
      }
    }

    return byCategory;
  }, [intervals]);

  const preferredTemplateFamily = useMemo((): PhraseBuilderSelections['template_family'] => {
    // Preference is learned from interval history first, then from site reference seeds.
    const allowed: PhraseBuilderSelections['template_family'][] = ['mixed', 'interpreted_first', 'observed_first', 'condition_led', 'rock_transition', 'weak_band'];
    const hist = phraseUsage.get('template_family');
    if (hist && hist.size) {
      let best: { fam: PhraseBuilderSelections['template_family']; score: number } | null = null;
      for (const fam of allowed) {
        const st = hist.get(fam);
        if (!st) continue;
        const score = st.count * 1000 + (st.lastUsedTs ? Math.min(500, Math.floor(st.lastUsedTs / 1_000_000)) : 0);
        if (!best || score > best.score) best = { fam, score };
      }
      if (best) return best.fam;
    }

    // Site seeded preference: use primary hint first (report-derived), then fall back.
    const primary = phrases
      .filter((p) => String(p.category || '').trim() === 'template_family_primary')
      .map((p) => String(p.text || '').trim())
      .find((t) => allowed.includes(t as any));
    if (primary) return primary as any;

    const seeded = phrases
      .filter((p) => String(p.category || '').trim() === 'template_family')
      .map((p) => String(p.text || '').trim())
      .filter((t) => allowed.includes(t as any));
    return (seeded[0] as any) || 'mixed';
  }, [phraseUsage, phrases]);

  useEffect(() => {
    if (templateFamilyTouched) return;
    setPhraseSel((prev) => ({ ...prev, template_family: preferredTemplateFamily }));
  }, [preferredTemplateFamily, templateFamilyTouched]);

  const builderOptions = useMemo(() => {
    const siteId = site?.id || element?.site_id || null;
    const list = siteLoggingPhraseRepo.list(siteId);

    // Resolve category to "base" + optional "@type" suffix. Only include type-specific
    // phrases that match the current element workflow type.
    const byBase = new Map<string, Array<{ id: string; text: string; siteSpecific: boolean; base: string }>>();
    const accept = (base: string, id: string, text: string, siteSpecific: boolean) => {
      const b = String(base || '').trim();
      const pid = String(id || '').trim();
      const t = String(text || '').trim();
      if (!b || !pid || !t) return;
      if (!byBase.has(b)) byBase.set(b, []);
      byBase.get(b)!.push({ id: pid, text: t, siteSpecific, base: b });
    };

    for (const p of list) {
      if (phraseAdminPolicy.archivedIds.has(String(p.id))) continue;
      const rawCat = String(p.category || '').trim();
      const text = String(p.text || '').trim();
      if (!rawCat || !text) continue;

      const [base, typeSuffix] = rawCat.split('@');
      if (typeSuffix) {
        const t = typeSuffix.trim();
        if (t && t !== phraseElementType) continue;
        accept(base, p.id, text, Boolean(p.site_specific));
      } else {
        accept(rawCat, p.id, text, Boolean(p.site_specific));
      }
    }

    const scoreFor = (base: string, text: string, siteSpecific: boolean) => {
      const stats = phraseUsage.get(base)?.get(text) ?? null;
      const freq = stats?.count ?? 0;
      const last = stats?.lastUsedTs ?? 0;
      const ageDays = last > 0 ? (Date.now() - last) / 86_400_000 : 999;
      return (siteSpecific ? 100_000 : 0) + freq * 1_000 - Math.round(ageDays * 10);
    };

    const get = (base: string) => {
      const cands = byBase.get(base) ?? [];
      const order = phraseAdminPolicy.orderByCategory[base] ?? [];
      const orderRank = new Map<string, number>();
      order.forEach((id, idx) => orderRank.set(String(id), idx));

      const uniq = new Map<string, { id: string; text: string; siteSpecific: boolean; score: number }>();
      for (const c of cands) {
        if (base === 'common_phrase' && !isFieldLogSentence(c.text)) continue;
        if (!uniq.has(c.text)) {
          const ord = orderRank.has(c.id) ? (orderRank.get(c.id)! >= 0 ? 10_000 - orderRank.get(c.id)! : 0) : 0;
          uniq.set(c.text, { id: c.id, text: c.text, siteSpecific: c.siteSpecific, score: scoreFor(base, c.text, c.siteSpecific) + ord * 10 });
        }
      }
      // Ensure interval-history items appear even if not in the phrase table yet (learning-driven UX).
      const hist = phraseUsage.get(base);
      if (hist) {
        for (const [t, stat] of hist.entries()) {
          if (base === 'common_phrase' && !isFieldLogSentence(t)) continue;
          if (!uniq.has(t)) uniq.set(t, { id: `hist:${t}`, text: t, siteSpecific: true, score: 50_000 + stat.count * 800 });
        }
      }

      return [...uniq.values()]
        .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
        .map((x) => x.text)
        .slice(0, 60);
    };

    return {
      observed_material: get('observed_material'),
      interpreted_material: get('interpreted_material'),
      colour: get('colour'),
      modifier: get('modifier'),
      water: get('water'),
      recovery: get('recovery'),
      drilling_response: get('drilling_response'),
      weathering: get('weathering'),
      rock_type: get('rock_type'),
      common_phrase: get('common_phrase'),
    };
  }, [site?.id, element?.site_id, phraseElementType, phraseUsage, phraseRevision, phraseAdminPolicy]);

  const sentencePatternSuggestions = useMemo(() => {
    // Full-sentence patterns (learning-driven). Prefer type-specific and site-specific ones.
    const allowedCats = new Set([
      `sentence_pattern@${phraseElementType}`,
      'sentence_pattern',
      `common_phrase@${phraseElementType}`,
      'common_phrase',
    ]);
    const cands = phrases
      .filter((p) => !phraseAdminPolicy.archivedIds.has(String(p.id)))
      .filter((p) => allowedCats.has(String(p.category || '').trim()))
      .map((p) => ({ text: String(p.text || '').trim(), siteSpecific: Boolean(p.site_specific) }))
      .filter((p) => p.text.length >= 10 && p.text.length <= 180)
      .filter((p) => isFieldLogSentence(p.text));
    const uniq = new Map<string, { text: string; siteSpecific: boolean }>();
    for (const c of cands) {
      if (!uniq.has(c.text)) uniq.set(c.text, c);
    }
    return [...uniq.values()].sort((a, b) => Number(b.siteSpecific) - Number(a.siteSpecific) || a.text.localeCompare(b.text)).slice(0, 10);
  }, [phrases, phraseElementType, phraseAdminPolicy]);

  const sortedIntervals = useMemo(
    () => [...intervals].sort((a, b) => Number(a.from_depth_m) - Number(b.from_depth_m)),
    [intervals]
  );

  const displayedIntervals = useMemo(() => {
    if (showAllIntervalHistory) return sortedIntervals;
    const keep = 12;
    return sortedIntervals.slice(Math.max(0, sortedIntervals.length - keep));
  }, [sortedIntervals, showAllIntervalHistory]);

  const lastInterval = sortedIntervals.length ? sortedIntervals[sortedIntervals.length - 1] : null;

  const continuityPrompts = useMemo(() => {
    if (!lastInterval) return [] as string[];
    const prompts: string[] = [];
    const lastWater = String((lastInterval as any).water_condition || '').trim();
    const lastRec = String((lastInterval as any).recovery_type || '').trim();
    const lastInt = String((lastInterval as any).material_interpreted || '').trim();
    const lastResp = (lastInterval as any).drilling_response_json ? parseJsonArray(String((lastInterval as any).drilling_response_json)).map(String) : [];

    const curWater = String(newWater || '').trim();
    const curRec = String(newRecoveryType || '').trim();
    const curInt = String(newMatInt || '').trim();
    const curResp = (newResponses || []).map(String);

    const respChanged = (() => {
      const a = new Set(lastResp);
      const b = new Set(curResp);
      if (a.size !== b.size) return true;
      for (const v of a) if (!b.has(v)) return true;
      return false;
    })();

    if (lastInt && curInt && lastInt.toLowerCase() !== curInt.toLowerCase()) prompts.push('Possible layer change: interpreted material changed. Recheck ToR/continuity.');
    if (lastWater && lastWater !== 'not_observed' && curWater && curWater !== lastWater) prompts.push('Water condition changed. Confirm interval conditions.');
    if (lastRec && curRec && lastRec !== curRec) prompts.push('Recovery changed. Confirm interval and consider weaker material/voids.');
    if (respChanged && (lastResp.length || curResp.length)) prompts.push('Drilling response changed. Confirm interval conditions.');

    return prompts.slice(0, 3);
  }, [lastInterval?.id, newWater, newRecoveryType, newMatInt, newResponses.join('|')]);

  const focusIntervalTop = () => {
    try {
      intervalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      // ignore
    }
  };

  const applyBuilderSelect = (key: keyof PhraseBuilderSelections, value: string) => {
    setPhraseSel((prev) => ({ ...prev, [key]: value }));
  };

  const applyReferencePhraseToLogging = (category: string, text: string) => {
    const v = String(text || '').trim();
    if (!v) return;

    if (category === 'water') {
      const norm = v.toLowerCase().replace(/\s+/g, ' ').trim();
      const map: Record<string, typeof newWater> = {
        dry: 'dry',
        moist: 'moist',
        wet: 'wet',
        'with water': 'with_water',
        'water encountered': 'water_encountered',
        'water loss': 'water_loss',
      };
      const next = map[norm];
      if (next) setNewWater(next as any);
    }

    if (category === 'recovery') {
      const norm = v.toLowerCase().replace(/\s+/g, ' ').trim();
      const map: Record<string, typeof newRecoveryType> = {
        'good return': 'good_return',
        'reduced return': 'reduced_return',
        'partial loss': 'partial_loss',
        'no return': 'no_return',
        inconsistent: 'inconsistent_recovery',
        'inconsistent recovery': 'inconsistent_recovery',
        chips: 'chips',
        'fine dust': 'fine_dust',
        'mixed return': 'mixed_return',
      };
      const next = map[norm];
      if (next) setNewRecoveryType(next as any);
    }

    if (category === 'drilling_response') {
      const norm = v.toLowerCase().replace(/\s+/g, ' ').trim();
      // Store drilling responses as human text (not enum ids). Existing records may contain
      // underscore ids; we normalize those elsewhere for display/suggestions.
      if (norm) setNewResponses((prev) => (prev.includes(v) ? prev : [...prev, v]));
    }

    if (category === 'observed_material') setNewMatObs(v);
    if (category === 'interpreted_material') setNewMatInt(v);
    if (category === 'weathering') {
      const norm = v.toLowerCase().replace(/\s+/g, ' ').trim();
      const map: Record<string, typeof newWeathering> = {
        rs: 'rs',
        residual: 'rs',
        xw: 'xw',
        'extremely weathered': 'xw',
        hw: 'hw',
        'highly weathered': 'hw',
        mw: 'mw',
        'moderately weathered': 'mw',
        sw: 'sw',
        'slightly weathered': 'sw',
        fr: 'fr',
        fresh: 'fr',
      };
      const next = map[norm] ?? (map[norm.replace(/^wth:\s*/i, '')] as any);
      if (next) setNewWeathering(next as any);
    }
    if (category === 'rock_type') {
      const norm = v.toLowerCase().replace(/\s+/g, ' ').trim();
      const map: Record<string, typeof newRockType> = {
        argillite: 'argillite',
        greywacke: 'greywacke',
        graywacke: 'greywacke',
        granodiorite: 'granodiorite',
        arenite: 'arenite',
        unknown: 'unknown_rock',
        'unknown rock': 'unknown_rock',
      };
      const next = map[norm];
      if (next) setNewRockType(next as any);
    }
    if (category === 'colour') setPhraseSel((prev) => ({ ...prev, colour: v }));
    if (category === 'modifier') setPhraseSel((prev) => ({ ...prev, modifier: v }));
    if (category === 'common_phrase') setPhraseSel((prev) => ({ ...prev, common_phrase: v }));

    setActiveStep('Logging');
    window.setTimeout(() => focusIntervalTop(), 50);
  };

  useEffect(() => {
    // Keep builder selections synced with main structured fields (and vice versa).
    setPhraseSel((prev) => ({
      ...prev,
      observed_material: newMatObs,
      interpreted_material: newMatInt,
      weathering: newWeathering !== 'not_applicable' ? newWeathering.toUpperCase() : '',
      rock_type: newRockType !== 'not_applicable' ? newRockType : '',
      water: newWater !== 'not_observed' ? newWater.replace(/_/g, ' ') : '',
      recovery: newRecoveryType.replace(/_/g, ' '),
      drilling_response: newResponses.length ? newResponses.map((r) => r.replace(/_/g, ' ')).join(', ') : '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMatObs, newMatInt, newWeathering, newRockType, newWater, newRecoveryType, newResponses.join('|')]);

  useEffect(() => {
    const auto = buildIntervalSentence(phraseSel);
    setNewAutoPhrase(auto);
    if (!newFinalPhraseEdited) setNewFinalPhrase(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseSel]);

  useEffect(() => {
    // Keep design type aligned with element type for field workflow. Allow override for edge cases.
    if (!element) return;
    setDesignType(elementDesignMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element?.id, elementDesignMode]);

  useEffect(() => {
    // Keep ToR variance classification in sync with the (optional) report/reference ToR and the current actual ToR.
    // Site "reference" is treated as a knowledge base; we avoid hard-coded expected ranges here.
    const refTor = toNumberOrNull(interpReferenceTorDepth);
    const actual = toNumberOrNull(interpActualTorDepth);

    const next = (() => {
      if (refTor == null || actual == null) return 'inconsistent_with_reference' as const;
      const delta = actual - refTor;
      if (Math.abs(delta) <= 0.5) return 'within_range' as const;
      if (delta < -0.5) return 'shallower_than_expected' as const;
      // Field-friendly thresholds (can be tuned later without schema changes).
      return delta <= 1.0 ? ('slightly_deeper' as const) : ('significantly_deeper' as const);
    })();

    setInterpVarianceClass(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interpReferenceTorDepth, interpActualTorDepth]);
  const torCard = useMemo(
    () =>
      computeTorCard(
        {
          reference_tor_depth_m: toNumberOrNull(interpReferenceTorDepth),
          actual_tor_depth_m: toNumberOrNull(interpActualTorDepth),
        } as any,
        intervals
      ),
    [interpReferenceTorDepth, interpActualTorDepth, intervals]
  );
  const inferredTorDepth = useMemo(
    () => computeTorCard({ reference_tor_depth_m: null, actual_tor_depth_m: null } as any, intervals).actualTorDepthM,
    [intervals]
  );

  const pileRockEvidence = useMemo(() => {
    if (!intervals.length) return { hasHW: false, hasMW: false, note: 'No intervals logged yet.' };
    let hasHW = false;
    let hasMW = false;
    for (const it of intervals) {
      const w = String(it.weathering_class || '').toLowerCase();
      const mat = String(it.material_interpreted || '').toLowerCase();
      if (w === 'hw' || mat.includes(' hw')) hasHW = true;
      if (w === 'mw' || mat.includes(' mw')) hasMW = true;
    }
    const note =
      hasHW && hasMW ? 'HW and MW both logged.' :
      hasHW ? 'HW rock logged.' :
      hasMW ? 'MW rock logged.' :
      'No HW/MW rock logged.';
    return { hasHW, hasMW, note };
  }, [intervals]);

  const pileSuggestedGoverningCondition = useMemo(() => {
    if (pileRockEvidence.hasHW && pileRockEvidence.hasMW) return { value: 'mixed', reason: 'HW and MW both logged.' };
    if (pileRockEvidence.hasHW) return { value: 'hw', reason: 'Only HW logged.' };
    if (pileRockEvidence.hasMW) return { value: 'mw', reason: 'Only MW logged.' };
    return { value: '', reason: 'No HW/MW evidence in logging.' };
  }, [pileRockEvidence]);

  const seededGroundReference = useMemo(() => {
    if (!site) return null as any;
    const seed = SITE_GROUND_REFERENCE_SEEDS.find((x) => x.site_code === site.site_code);
    return seed?.groundReference ?? null;
  }, [site?.site_code]);

  const updatePhraseAdmin = (patch: {
    archivedIds?: string[];
    orderByCategory?: Record<string, string[]>;
  }) => {
    setGroundRefReferenceObj((prev) => {
      const base: any = prev && typeof prev === 'object' ? { ...prev } : {};
      const pa: any = base.phrase_admin && typeof base.phrase_admin === 'object' ? { ...base.phrase_admin } : {};
      if (patch.archivedIds) pa.archived_ids = [...new Set(patch.archivedIds.map(String))];
      if (patch.orderByCategory) pa.order_by_category = patch.orderByCategory;
      base.phrase_admin = pa;
      return base;
    });
  };

  const setPhraseArchived = (phraseId: string, archived: boolean) => {
    const id = String(phraseId || '').trim();
    if (!id) return;
    const cur = new Set<string>([...phraseAdminPolicy.archivedIds]);
    if (archived) cur.add(id);
    else cur.delete(id);
    updatePhraseAdmin({
      archivedIds: [...cur],
      orderByCategory: phraseAdminPolicy.orderByCategory,
    });
  };

  const movePhraseOrder = (category: string, phraseId: string, dir: 'up' | 'down') => {
    const cat = String(category || '').trim();
    const id = String(phraseId || '').trim();
    if (!cat || !id) return;
    const cur = phraseAdminPolicy.orderByCategory[cat] ? [...phraseAdminPolicy.orderByCategory[cat]] : [];
    if (!cur.includes(id)) cur.push(id);
    const idx = cur.indexOf(id);
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || nextIdx < 0 || nextIdx >= cur.length) return;
    const tmp = cur[idx];
    cur[idx] = cur[nextIdx];
    cur[nextIdx] = tmp;
    updatePhraseAdmin({
      archivedIds: [...phraseAdminPolicy.archivedIds],
      orderByCategory: { ...phraseAdminPolicy.orderByCategory, [cat]: cur },
    });
  };

  const applySeedToProjectReference = async (source: 'apply_seed' | 'reset_to_seed') => {
    if (!element || !site) return;
    if (!seededGroundReference) return alert('No seeded site default exists for this site.');
    const msg =
      source === 'apply_seed'
        ? 'Apply the seeded site default into the Project maintained reference?\n\nThis will overwrite the Project maintained reference values for this site.'
        : 'Reset the Project maintained reference back to the seeded site default?\n\nThis will overwrite the Project maintained reference values for this site.';
    const ok = window.confirm(msg);
    if (!ok) return;
    try {
      await siteGroundReferenceRepo.upsertGroundReferenceBySite(element.project_id, site.id, {
        ...(seededGroundReference as any),
        source_label: 'Project maintained reference (seed applied)',
      } as any);
      await reload();
      alert('Seed applied to Project maintained reference.');
    } catch (e) {
      alert(`Failed to apply seed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const exportReferenceTemplate = () => {
    if (!element || !site) return;
    const templateName = window.prompt('Template name (e.g. "Cairns pile logging reference")', `${site.site_code || 'Site'} reference template`);
    if (!templateName) return;

    try {
      const groundRef: any = siteGroundReferenceRepo.getGroundReferenceBySite(site.id);
      const sitePhrases = siteLoggingPhraseRepo.listForLibrary({ siteId: site.id, scope: 'site' });
      const otherRefs = siteGroundReferenceRepo
        .listBySite(site.id)
        .filter((r: any) => String(r.reference_type || '') !== 'GroundReference')
        .map((r: any) => ({ reference_type: String(r.reference_type), source_label: r.source_label ?? null, reference_json: String(r.reference_json || '{}') }));

      const tpl = buildSiteLoggingReferenceTemplate({
        templateName: templateName.trim(),
        applicability: { project: String(site.project_id || ''), site_code: String(site.site_code || '') },
        groundRef,
        referenceObj: groundRefReferenceObj,
        sitePhrases,
        phraseAdminPolicy,
        boreholeCalibrations,
        otherReferences: otherRefs,
      });

      const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = templateName.trim().replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
      a.download = `site-reference-template-${safeName || 'template'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`Failed to export template: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startImportReferenceTemplate = () => {
    importRefTemplateInputRef.current?.click();
  };

  const onImportReferenceTemplateFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const validated = validateSiteLoggingReferenceTemplate(text);
      if (validated.ok === false) {
        alert(`Invalid template: ${validated.error}`);
        return;
      }
      setPendingRefTemplate(validated.value);
      setPendingRefTemplateMode('merge');
      setShowPendingRefTemplateDetails(false);
    } catch (e) {
      alert(`Failed to read template: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (importRefTemplateInputRef.current) importRefTemplateInputRef.current.value = '';
    }
  };

  const applyPendingReferenceTemplate = async () => {
    if (!pendingRefTemplate || !element || !site) return;
    const tpl = pendingRefTemplate;

    const confirmMsg =
      `Apply reference template "${tpl.template_name}"?\n\n` +
      `Mode: ${pendingRefTemplateMode}\n` +
      `Phrases: ${tpl.phrase_library.phrases.length}\n` +
      `Calibrations: ${tpl.evidence.borehole_calibrations.length}\n` +
      `Evidence refs: ${tpl.evidence.references.length}\n\n` +
      `This does not import drilling records, photos, or verification results.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const currentGroundRef: any = siteGroundReferenceRepo.getGroundReferenceBySite(site.id);
      const currentPhrases = siteLoggingPhraseRepo.listForLibrary({ siteId: site.id, scope: 'site' });
      const currentOtherRefs = siteGroundReferenceRepo
        .listBySite(site.id)
        .filter((r: any) => String(r.reference_type || '') !== 'GroundReference');
      const currentCal = siteBoreholeCalibrationRepo.listBySite(site.id);

      const templatePhrasePairs = tpl.phrase_library.phrases
        .filter((p) => p.scope === 'site')
        .map((p) => ({ category: p.category, text: p.text }));

      const nextPhrases =
        pendingRefTemplateMode === 'replace'
          ? templatePhrasePairs
          : pendingRefTemplateMode === 'phrases_only' || pendingRefTemplateMode === 'merge'
            ? mergeUniquePhrases({
                existing: currentPhrases.map((p) => ({ category: p.category, text: p.text })),
                incoming: templatePhrasePairs,
              })
            : currentPhrases.map((p) => ({ category: p.category, text: p.text }));

      if (pendingRefTemplateMode === 'replace') {
        // Remove existing site-specific phrases first (global phrases come from seeds)
        for (const p of currentPhrases) {
          await siteLoggingPhraseRepo.remove(p.id);
        }
      }

      if (pendingRefTemplateMode !== 'ground_only') {
        await siteLoggingPhraseRepo.upsertManyUnique(nextPhrases.map((p) => ({ ...p, site_id: site.id })));
      }

      // Re-load phrases to build id mapping for phrase_admin
      const refreshedPhrases = siteLoggingPhraseRepo.listForLibrary({ siteId: site.id, scope: 'site' });
      const phraseKeyToId = new Map<string, string>();
      for (const p of refreshedPhrases) {
        const key = `${normalizePhraseCategory(String(p.category)).normalized}::${normalizePhraseTextKey(p.text)}`;
        phraseKeyToId.set(key, p.id);
      }

      const buildPhraseAdminFromTemplate = () => {
        const pa = tpl.phrase_library.phrase_admin;
        if (!pa) return null;
        const archivedIds: string[] = [];
        for (const a of pa.archived || []) {
          const key = `${normalizePhraseCategory(String(a.category)).normalized}::${normalizePhraseTextKey(a.text)}`;
          const id = phraseKeyToId.get(key);
          if (id) archivedIds.push(id);
        }
        const orderByCategory: Record<string, string[]> = {};
        for (const [cat, entries] of Object.entries(pa.order_by_category || {} as any)) {
          const ids: string[] = [];
          const list = Array.isArray(entries) ? entries : [];
          for (const e of list) {
            const key = `${normalizePhraseCategory(String(e.category)).normalized}::${normalizePhraseTextKey(e.text)}`;
            const id = phraseKeyToId.get(key);
            if (id) ids.push(id);
          }
          orderByCategory[String(cat)] = ids;
        }
        return { archivedIds: [...new Set(archivedIds)], orderByCategory };
      };

      const nextPhraseAdmin = buildPhraseAdminFromTemplate();

      // Ground model apply/merge
      if (pendingRefTemplateMode !== 'phrases_only') {
        const gm = tpl.ground_model;
        const existingUnits = currentGroundRef?.geotechnical_units_json ? parseJsonArray(String(currentGroundRef.geotechnical_units_json)) : [];
        const existingRisks = currentGroundRef?.site_risk_flags_json ? parseJsonArray(String(currentGroundRef.site_risk_flags_json)) : [];
        const existingAbove = currentGroundRef?.expected_material_above_tor_json ? parseJsonArray(String(currentGroundRef.expected_material_above_tor_json)) : [];
        const existingBelow = currentGroundRef?.expected_material_below_tor_json ? parseJsonArray(String(currentGroundRef.expected_material_below_tor_json)) : [];

        const union = (a: any[], b: any[]) => [...new Set([...a.map(String), ...b.map(String)].map((s) => s.trim()).filter(Boolean))];
        const nextUnits = pendingRefTemplateMode === 'merge' ? union(existingUnits, gm.geotechnical_units) : gm.geotechnical_units;
        const nextRisks = pendingRefTemplateMode === 'merge' ? union(existingRisks, gm.risk_flags) : gm.risk_flags;
        const nextAbove = pendingRefTemplateMode === 'merge' ? union(existingAbove, gm.expected_material_above_tor) : gm.expected_material_above_tor;
        const nextBelow = pendingRefTemplateMode === 'merge' ? union(existingBelow, gm.expected_material_below_tor) : gm.expected_material_below_tor;
        const nextNotes =
          pendingRefTemplateMode === 'merge'
            ? [String(currentGroundRef?.reference_notes || '').trim(), String(gm.site_notes || '').trim()].filter(Boolean).join('\n\n')
            : String(gm.site_notes || '');

        const nextRefObj =
          pendingRefTemplateMode === 'merge'
            ? { ...(groundRefReferenceObj || {}), ...(gm.reference_json || {}) }
            : (gm.reference_json || {});

        if (nextPhraseAdmin) {
          nextRefObj.phrase_admin = {
            archived_ids: nextPhraseAdmin.archivedIds,
            order_by_category: nextPhraseAdmin.orderByCategory,
          };
        }

        await siteGroundReferenceRepo.upsertGroundReferenceBySite(element.project_id, site.id, {
          source_label: gm.source_label ?? 'Project maintained reference (template)',
          geotechnical_units_json: JSON.stringify(nextUnits),
          expected_tor_min_m: gm.expected_tor_min_m ?? null,
          expected_tor_max_m: gm.expected_tor_max_m ?? null,
          reference_tor_velocity_ms: gm.reference_tor_velocity_ms ?? null,
          expected_material_above_tor_json: JSON.stringify(nextAbove),
          expected_material_below_tor_json: JSON.stringify(nextBelow),
          site_risk_flags_json: JSON.stringify(nextRisks),
          reference_notes: nextNotes,
          reference_json: JSON.stringify(nextRefObj),
        });
      }

      // Evidence/calibration apply
      if (pendingRefTemplateMode === 'replace') {
        // Calibrations replace
        await siteBoreholeCalibrationRepo.upsertManyForSite(site.id, tpl.evidence.borehole_calibrations as any);
        // Other refs replace (delete existing non-ground and recreate)
        for (const r of currentOtherRefs) await siteGroundReferenceRepo.delete(r.id);
        for (const r of tpl.evidence.references) {
          await siteGroundReferenceRepo.create({
            project_id: element.project_id,
            site_id: site.id,
            reference_type: r.reference_type,
            source_label: r.source_label ?? null,
            reference_json: r.reference_json,
            created_at: '',
            updated_at: '',
          } as any);
        }
      } else if (pendingRefTemplateMode === 'merge' || pendingRefTemplateMode === 'ground_only') {
        // Calibrations merge by borehole_id
        const byBh = new Map<string, any>();
        for (const c of currentCal) byBh.set(String(c.borehole_id), { ...c });
        for (const c of tpl.evidence.borehole_calibrations as any[]) byBh.set(String(c.borehole_id), { ...c });
        const merged = [...byBh.values()].map((c) => ({
          site_line_id: c.site_line_id ?? null,
          borehole_id: c.borehole_id,
          borehole_offset_m: c.borehole_offset_m ?? null,
          elevation_difference_m: c.elevation_difference_m ?? null,
          borehole_tor_depth_m_bgl: c.borehole_tor_depth_m_bgl ?? null,
          borehole_lithology_at_tor: c.borehole_lithology_at_tor ?? null,
          srt_velocity_at_tor_ms: c.srt_velocity_at_tor_ms ?? null,
          difference_geophysics_minus_borehole_m: c.difference_geophysics_minus_borehole_m ?? null,
          variance_note: c.variance_note ?? null,
          confidence: c.confidence ?? null,
        }));
        await siteBoreholeCalibrationRepo.upsertManyForSite(site.id, merged as any);

        // Other refs merge (add any that do not exist verbatim)
        const existingKeys = new Set(
          currentOtherRefs.map((r: any) => `${r.reference_type}::${String(r.source_label || '')}::${String(r.reference_json || '')}`)
        );
        for (const r of tpl.evidence.references) {
          const key = `${r.reference_type}::${String(r.source_label || '')}::${String(r.reference_json || '')}`;
          if (existingKeys.has(key)) continue;
          await siteGroundReferenceRepo.create({
            project_id: element.project_id,
            site_id: site.id,
            reference_type: r.reference_type,
            source_label: r.source_label ?? null,
            reference_json: r.reference_json,
            created_at: '',
            updated_at: '',
          } as any);
        }
      }

      await reload();
      setPendingRefTemplate(null);
      setShowPendingRefTemplateDetails(false);
      alert('Reference template applied.');
    } catch (e) {
      console.warn('[SiteLoggingElement] Apply reference template failed:', e);
      alert(`Failed to apply template: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadStarterReferenceTemplate = () => {
    const id = String(starterTemplateId || '').trim();
    if (!id) return;
    const found = SITE_LOGGING_STARTER_TEMPLATES.find((t) => t.id === id);
    if (!found) return alert('Starter template not found.');
    setPendingRefTemplate(found.template);
    setPendingRefTemplateMode('merge');
    setShowPendingRefTemplateDetails(false);
  };

  const recommendedNextActions = useMemo((): string[] => {
    if (!verificationSummary) return ['Run verification to get a recommended action.'];
    const status = String(verificationSummary?.status || '');
    const reasons: string[] = Array.isArray(verificationSummary?.reasons) ? verificationSummary.reasons.map(String) : [];
    const result: Record<string, any> = verificationSummary?.result && typeof verificationSummary.result === 'object' ? verificationSummary.result : {};
    const reviewTriggers: string[] = Array.isArray((verificationSummary as any)?.review_required_triggers)
      ? (verificationSummary as any).review_required_triggers.map(String)
      : [];

    const actions: string[] = [];
    const push = (s: string) => {
      const v = s.trim();
      if (!v) return;
      if (!actions.includes(v)) actions.push(v);
    };

    const needsCleanOut = result?.clean_out_pass === false || reasons.some((r) => /clean-?out/i.test(r));
    const needsGroutApproval = result?.grout_ready === false || reasons.some((r) => /grout approval/i.test(r));
    const needsMoreDepth = reasons.some((r) => /below (design|required)/i.test(r) || /below the governing minimum/i.test(r));
    const overdrillIssue = reasons.some((r) => /overdrill/i.test(r));
    const torManual = toNumberOrNull(interpActualTorDepth) != null;

    if (!torManual && (needsMoreDepth || status === 'fail' || status === 'review_required')) push('Confirm rock entry depth (manual or inferred from logging).');
    if (needsMoreDepth) push('Continue drilling to meet design length(s).');
    if (needsCleanOut) push('Clean-out required before grouting.');
    if (needsGroutApproval) push('Engineer review / grout approval required.');
    if (overdrillIssue) push('Engineer review required (overdrill exceeds limit).');
    if (status === 'review_required' || reviewTriggers.length) push('Engineer review required (verification reliability is low).');

    if (status === 'pass') {
      if (result?.grout_ready === true) push('Grout ready.');
      else if (needsCleanOut) push('Clean-out required before grouting.');
      else push('Stop at current depth (meets design).');
    }

    if (actions.length === 0) push('Continue drilling (review intervals and verification).');
    return actions;
  }, [verificationSummary, interpActualTorDepth]);

  const pileReferenceDiagram = useMemo(() => {
    const list = sitePhotos.filter((p: any) => String(p.photo_type || '').trim() === PHOTO_TYPE_REFERENCE_DIAGRAM);
    return list.length ? list[0] : null;
  }, [sitePhotos]);

  const visibleSitePhotos = useMemo(() => {
    // Keep reference diagrams out of normal drilling photos by default.
    return sitePhotos.filter((p: any) => String(p.photo_type || '').trim() !== PHOTO_TYPE_REFERENCE_DIAGRAM);
  }, [sitePhotos]);

  const closeoutProgress = useMemo(() => {
    const cleanOutComplete =
      (cleanOut?.clean_out_depth_m != null && Number.isFinite(cleanOut.clean_out_depth_m)) ||
      (toNumberOrNull(cleanDepth) != null);
    const photosComplete = (visibleSitePhotos?.length ?? 0) > 0;
    const approvalComplete = Boolean(approvalApproved || approval?.approved_for_grouting);
    const reportReady = Boolean((outputReport?.report_text || '').trim() || (reportPreview || '').trim());
    return { cleanOutComplete, photosComplete, approvalComplete, reportReady };
  }, [cleanOut, cleanDepth, visibleSitePhotos?.length, approvalApproved, approval, outputReport, reportPreview]);

  useEffect(() => {
    // Keep the field-friendly lists in sync with stored JSON strings.
    const bands = parseJsonArray(interpWeakBandsJson)
      .map((it) => ({
        from_m: it?.from_depth_m != null ? String(it.from_depth_m) : it?.from != null ? String(it.from) : '',
        to_m: it?.to_depth_m != null ? String(it.to_depth_m) : it?.to != null ? String(it.to) : '',
        note: it?.note != null ? String(it.note) : '',
      }))
      .filter((it) => it.from_m || it.to_m || it.note);
    setInterpWeakBands(bands);

    const obj = parseJsonObject(interpReasonsJson);
    if (obj) {
      const cls = String(obj?.tor_variance_class || obj?.tor_variance_classification || '').trim();
      if (
        cls === 'within_range' ||
        cls === 'slightly_deeper' ||
        cls === 'significantly_deeper' ||
        cls === 'shallower_than_expected' ||
        cls === 'inconsistent_with_reference'
      ) {
        setInterpVarianceClass(cls);
      }
      const reasons = Array.isArray(obj?.reasons) ? obj.reasons.map(String).filter(Boolean) : [];
      setInterpVarianceReasons(reasons);
      setInterpVarianceOther(obj?.other != null ? String(obj.other) : '');
    } else {
      const reasons = parseJsonArray(interpReasonsJson).map(String).filter(Boolean);
      setInterpVarianceReasons(reasons);
    }
  }, [interpWeakBandsJson, interpReasonsJson]);

  const syncDerivedOutputs = (
    el: SupportElement,
    currentDesignInput: any,
    currentRecord: SiteDrillingRecord | null,
    currentIntervals: SiteDrillingInterval[],
    currentCleanOut: SiteCleanOutRecord | null,
    currentApproval: SiteApprovalRecord | null,
    currentInterpretation?: any,
    currentEvents: SiteFieldEvent[] = [],
    currentPhotos: SitePhotoAttachment[] = []
  ) => {
    const summary = evaluateSiteVerification({
      element: el,
      designInput: currentDesignInput ?? {},
      record: currentRecord,
      intervals: currentIntervals,
      interpretation: currentInterpretation ?? null,
      cleanOut: currentCleanOut,
      approval: currentApproval,
    });
    setVerificationSummary(summary);
    const reportText = buildSiteOutputReport({
      element: el,
      siteCode: site?.site_code || '',
      designInput: currentDesignInput ?? {},
      interpretation: currentInterpretation ?? null,
      verification: summary,
      cleanOut: currentCleanOut,
      approval: currentApproval,
      intervals: currentIntervals,
      events: currentEvents,
      photos: currentPhotos,
    });
    setReportPreview(reportText);
  };

  const persistOutputReport = async (el: SupportElement, reportText: string) => {
    const reportJson = safeJsonStringify({
      element_id: el.id,
      site_id: site?.id ?? null,
      design_input: designInput,
      interpretation: {
        reference_tor_depth_m: toNumberOrNull(interpReferenceTorDepth),
        reference_tor_velocity_ms: toNumberOrNull(interpReferenceTorVelocity),
        actual_tor_depth_m: toNumberOrNull(interpActualTorDepth),
        tor_variance_reason_json: interpReasonsJson,
        continuous_rock_start_m: toNumberOrNull(interpContinuousRockStart),
        weak_band_intervals_json: interpWeakBandsJson,
        interpretation_confidence: interpConfidence,
        interpretation_summary: interpSummary,
      },
      verification: verificationSummary,
      clean_out: cleanOut,
      approval,
      intervals_count: intervals.length,
      photos_count: sitePhotos.length,
      photos: sitePhotos.map((p) => ({
        id: p.id,
        drilling_record_id: (p as any).drilling_record_id ?? null,
        photo_type: (p as any).photo_type ?? null,
        depth_m: (p as any).depth_m ?? null,
        caption: p.caption,
        taken_datetime: p.taken_datetime,
        mime_type: p.mime_type,
        blob_key: p.blob_key,
      })),
      generated_at: new Date().toISOString(),
    });
    await siteOutputReportRepo.upsertByElementId(el.id, reportText, reportJson);
    setOutputReport(siteOutputReportRepo.getByElementId(el.id));
  };

  const reload = async () => {
    const el = supportElementRepo.getById(elementId);
    setElement(el);
    if (!el) return;

    const s = siteRepo.getById(el.site_id);
    setSite(s);
    try {
      await siteLoggingPhraseRepo.seedIfEmpty(LOGGING_PHRASE_SEEDS);
    } catch (e) {
      console.warn('[SiteLoggingElement] Phrase seed skipped:', e);
    }
    if (s) {
      const seed = SITE_GROUND_REFERENCE_SEEDS.find((item) => item.site_code === s.site_code);
      if (seed && !siteGroundReferenceRepo.getGroundReferenceBySite(s.id)) {
        await siteGroundReferenceRepo.upsertGroundReferenceBySite(el.project_id, s.id, seed.groundReference as any);
      }
      if (seed && siteBoreholeCalibrationRepo.listBySite(s.id).length === 0 && seed.calibrations.length > 0) {
        await siteBoreholeCalibrationRepo.upsertManyForSite(s.id, seed.calibrations);
      }
    }

    const ds = siteDesignInputRepo.getByElementAndType(el.id, designType);
    let currentDesignInput = designInput;
    try {
      const parsed = ds?.input_json ? JSON.parse(ds.input_json) : {};
      currentDesignInput = { ...designInput, ...parsed };
      setDesignInput(currentDesignInput);
    } catch {
      currentDesignInput = { ...designInput };
      setDesignInput(currentDesignInput);
    }

    // Initialize raw numeric inputs for pile essentials (do not overwrite during user typing).
    try {
      setPileBaseCasingRaw(currentDesignInput.casing_to_depth_m != null ? String(currentDesignInput.casing_to_depth_m) : '');
      setPileMinPlungeRaw(currentDesignInput.required_plunge_length_m != null ? String(currentDesignInput.required_plunge_length_m) : '');
      setPileUboltZoneRaw(currentDesignInput.u_bolt_zone_length_m != null ? String(currentDesignInput.u_bolt_zone_length_m) : '');
      setPileLowestUboltRaw(currentDesignInput.lowest_ubolt_depth_m != null ? String(currentDesignInput.lowest_ubolt_depth_m) : '');
      setPileMinAnchBelowUboltRaw(currentDesignInput.required_min_anchorage_below_ubolt_m != null ? String(currentDesignInput.required_min_anchorage_below_ubolt_m) : '');
      setPileSocketHwRaw(currentDesignInput.required_socket_hw_m != null ? String(currentDesignInput.required_socket_hw_m) : '');
      setPileSocketMwRaw(currentDesignInput.required_socket_mw_m != null ? String(currentDesignInput.required_socket_mw_m) : '');
      setPileFinalDepthRaw(currentDesignInput.final_drilled_depth_m != null ? String(currentDesignInput.final_drilled_depth_m) : '');
      setPileGroundRlRaw(el.ground_rl != null ? String(el.ground_rl) : '');
      setPileHoleDiaRaw(el.hole_diameter_mm != null ? String(el.hole_diameter_mm) : '');
    } catch {
      // ignore
    }
    const rs = siteDrillingRepo.listRecordsByElement(el.id);
    setRecords(rs);
    const nextRecordId = activeRecordId || rs[0]?.id || '';
    setActiveRecordId(nextRecordId);
    const currentIntervals = nextRecordId ? siteDrillingRepo.listIntervalsByRecord(nextRecordId) : [];
    setIntervals(currentIntervals);
    const currentRecord = rs.find((item) => item.id === nextRecordId) ?? null;

    const it: any = siteInterpretationRepo.getByElement(el.id);
    setInterpReferenceTorDepth(it?.reference_tor_depth_m != null ? String(it.reference_tor_depth_m) : '');
    setInterpReferenceTorVelocity(it?.reference_tor_velocity_ms != null ? String(it.reference_tor_velocity_ms) : '');
    setInterpActualTorDepth(it?.actual_tor_depth_m != null ? String(it.actual_tor_depth_m) : '');
    const nextReasonsJson = it?.tor_variance_reason_json ?? '[]';
    setInterpReasonsJson(nextReasonsJson);
    const reasonObj = nextReasonsJson ? parseJsonObject(String(nextReasonsJson)) : null;
    if (reasonObj) {
      const cls = String(reasonObj?.tor_variance_class || '').trim();
      if (
        cls === 'within_range' ||
        cls === 'slightly_deeper' ||
        cls === 'significantly_deeper' ||
        cls === 'shallower_than_expected' ||
        cls === 'inconsistent_with_reference'
      ) {
        setInterpVarianceClass(cls);
      }
      setInterpVarianceOther(reasonObj?.other != null ? String(reasonObj.other) : '');
    }
    setInterpContinuousRockStart(it?.continuous_rock_start_m != null ? String(it.continuous_rock_start_m) : '');
    setInterpWeakBandsJson(it?.weak_band_intervals_json ?? '[]');
    setInterpConfidence((it?.interpretation_confidence as any) || 'medium');
    setInterpSummary(it?.interpretation_summary ?? it?.summary ?? '');
    const currentInterpretation = it ?? null;

    if (s) {
      setRefs(siteGroundReferenceRepo.listBySite(s.id));
      const gr: any = siteGroundReferenceRepo.getGroundReferenceBySite(s.id);
      setGroundRefUnitsJson(gr?.geotechnical_units_json ?? '[]');
      // Legacy optional depth cues: keep loaded for compatibility/export, but not shown in UI.
      setGroundRefExpectedTorMin(gr?.expected_tor_min_m != null ? String(gr.expected_tor_min_m) : '');
      setGroundRefExpectedTorMax(gr?.expected_tor_max_m != null ? String(gr.expected_tor_max_m) : '');
      setGroundRefRefVelocity(gr?.reference_tor_velocity_ms != null ? String(gr.reference_tor_velocity_ms) : '1600');
      setGroundRefRiskFlagsJson(gr?.site_risk_flags_json ?? '[]');
      setGroundRefNotes(gr?.reference_notes ?? '');
      setGroundRefReferenceObj(parseJsonObject(String(gr?.reference_json || '{}')) ?? {});
      setBoreholeCalibrations(siteBoreholeCalibrationRepo.listBySite(s.id));
      setPhrases(siteLoggingPhraseRepo.list(s.id));
    }
    else {
      setRefs([]);
      setBoreholeCalibrations([]);
      setGroundRefReferenceObj({});
      setPhrases(siteLoggingPhraseRepo.list(null));
    }

    try {
      setOutputReport(siteOutputReportRepo.getByElementId(el.id));
    } catch (e) {
      console.warn('[SiteLoggingElement] Output report load failed:', e);
      setOutputReport(null);
    }

    const currentCleanOut = currentRecord ? siteCleanOutRepo.getByRecord(currentRecord.id) : null;
    setCleanOut(currentCleanOut);
    setCleanMethodAir(Boolean(currentCleanOut?.method_air));
    setCleanMethodWater(Boolean(currentCleanOut?.method_water));
    setCleanMethodGrout(Boolean(currentCleanOut?.method_grout));
    setCleanDepth(currentCleanOut?.clean_out_depth_m != null ? String(currentCleanOut.clean_out_depth_m) : '');
    setCleanDateTime(currentCleanOut?.clean_out_datetime ?? '');
    setCleanBaseCondition((currentCleanOut?.base_condition as any) ?? 'unknown');
    setCleanSediment(Boolean(currentCleanOut?.sedimentation_observed));
    setCleanApproved(Boolean(currentCleanOut?.approved_for_grouting));
    setCleanNote(currentCleanOut?.approval_note ?? '');

    const currentApproval = siteApprovalRepo.getByElement(el.id);
    setApproval(currentApproval);
    setApprovalLoggedBy(currentApproval?.logged_by ?? '');
    setApprovalReviewedBy(currentApproval?.reviewed_by ?? '');
    setApprovalApprovedBy(currentApproval?.approved_by ?? '');
    setApprovalDateTime(currentApproval?.approval_datetime ?? '');
    setApprovalApproved(Boolean(currentApproval?.approved_for_grouting));
    setApprovalComment(currentApproval?.approval_comment ?? '');

    const ev = siteFieldEventRepo.listByElement(el.id);
    setFieldEvents(ev);
    let photos: SitePhotoAttachment[] = [];
    try {
      photos = sitePhotoAttachmentRepo.listByElement(el.id);
      setSitePhotos(photos);
    } catch (e) {
      console.warn('[SiteLoggingElement] Photo attachments load failed:', e);
      setSitePhotos([]);
      photos = [];
    }

    syncDerivedOutputs(el, currentDesignInput, currentRecord, currentIntervals, currentCleanOut, currentApproval, currentInterpretation, ev, photos);
  };

  useEffect(() => {
    let cancelled = false;
    const nextUrls: Record<string, string> = {};
    const revoke: string[] = [];

    const run = async () => {
      // Revoke existing urls first
      Object.values(photoUrls).forEach((u) => {
        try { URL.revokeObjectURL(String(u)); } catch { /* ignore */ }
      });

      for (const p of sitePhotos) {
        try {
          const blob = await getBlob(p.blob_key);
          const url = blob ? URL.createObjectURL(blob as Blob) : '';
          if (url) {
            nextUrls[p.id] = url;
            revoke.push(url);
          }
        } catch (e) {
          console.warn('[SiteLoggingElement] getBlob failed:', e);
        }
      }

      if (!cancelled) setPhotoUrls(nextUrls);
      else revoke.forEach((u) => { try { URL.revokeObjectURL(String(u)); } catch { /* ignore */ } });
    };

    void run();
    return () => {
      cancelled = true;
      revoke.forEach((u) => { try { URL.revokeObjectURL(String(u)); } catch { /* ignore */ } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePhotos.map((p) => p.id).join('|')]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  useEffect(() => {
    if (!element) return;
    const ds: any = siteDesignInputRepo.getByElementAndType(element.id, designType);
    try {
      const parsed = ds?.input_json ? JSON.parse(ds.input_json) : {};
      setDesignInput({ ...designInput, ...parsed });
    } catch {
      setDesignInput({ ...designInput });
    }
  }, [designType, element]);

  useEffect(() => {
    if (!activeRecordId) {
      setIntervals([]);
      return;
    }
    const nextIntervals = siteDrillingRepo.listIntervalsByRecord(activeRecordId);
    setIntervals(nextIntervals);
  }, [activeRecordId]);

  useEffect(() => {
    if (!record) {
      setRecordStartDate('');
      setRecordEndDate('');
      setRecordLoggedBy('');
      setRecordApprovedBy('');
      setRecordPageCount('');
      setRecordGeneralNote('');
      return;
    }
    setRecordStartDate((record as any).start_date ?? '');
    setRecordEndDate((record as any).end_date ?? '');
    setRecordLoggedBy((record as any).logged_by ?? '');
    setRecordApprovedBy((record as any).approved_by ?? '');
    setRecordPageCount((record as any).record_page_count != null ? String((record as any).record_page_count) : '');
    setRecordGeneralNote((record as any).general_note ?? '');
  }, [record?.id]);

  // Sync raw numeric input buffers from persisted design input (so reload/import keeps fields consistent).
  useEffect(() => {
    if (effectiveDesignType === 'MicroPile') {
      setPileMaxOverdrillRaw(designInput?.max_overdrill_m != null ? String(designInput.max_overdrill_m) : '');
      return;
    }
    setPileMaxOverdrillRaw('');
  }, [effectiveDesignType, designInput?.max_overdrill_m]);

  useEffect(() => {
    if (effectiveDesignType === 'Anchor' || effectiveDesignType === 'SoilNail') {
      setAnchorAnchorageRaw(designInput?.design_anchorage_length_m != null ? String(designInput.design_anchorage_length_m) : '');
      setAnchorSocketRaw(designInput?.required_socket_length_m != null ? String(designInput.required_socket_length_m) : '');
      setAnchorWorkingLoadRaw(designInput?.working_load_kN != null ? String(designInput.working_load_kN) : '');
      setAnchorMaxOverdrillRaw(designInput?.max_overdrill_m != null ? String(designInput.max_overdrill_m) : '');
      setAnchorBondedRaw(designInput?.design_bonded_length_m != null ? String(designInput.design_bonded_length_m) : '');
      setAnchorDebondedRaw(designInput?.design_debonded_length_m != null ? String(designInput.design_debonded_length_m) : '');
      return;
    }
    setAnchorAnchorageRaw('');
    setAnchorSocketRaw('');
    setAnchorWorkingLoadRaw('');
    setAnchorMaxOverdrillRaw('');
    setAnchorBondedRaw('');
    setAnchorDebondedRaw('');
  }, [
    effectiveDesignType,
    designInput?.design_anchorage_length_m,
    designInput?.required_socket_length_m,
    designInput?.working_load_kN,
    designInput?.max_overdrill_m,
    designInput?.design_bonded_length_m,
    designInput?.design_debonded_length_m,
  ]);

  const saveElementPatch = async (patch: Partial<Omit<SupportElement, 'id' | 'project_id' | 'site_id'>>) => {
    if (!element) return;
    await supportElementRepo.update(element.id, patch);
    setElement(supportElementRepo.getById(element.id));
  };

  const saveDesign = async () => {
    if (!element) return;

    // Commit raw numeric inputs so "0.1" style values persist correctly.
    const committedDesignInput =
      effectiveDesignType === 'MicroPile'
        ? {
            ...designInput,
            required_plunge_length_m: parseNumberOrNull(pileMinPlungeRaw),
            max_overdrill_m: parseNumberOrNull(pileMaxOverdrillRaw),
          }
        : effectiveDesignType === 'Anchor' || effectiveDesignType === 'SoilNail'
          ? {
              ...designInput,
              design_anchorage_length_m: parseNumberOrNull(anchorAnchorageRaw),
              required_socket_length_m: parseNumberOrNull(anchorSocketRaw),
              working_load_kN: parseNumberOrNull(anchorWorkingLoadRaw),
              max_overdrill_m: parseNumberOrNull(anchorMaxOverdrillRaw),
              design_bonded_length_m: parseNumberOrNull(anchorBondedRaw),
              design_debonded_length_m: parseNumberOrNull(anchorDebondedRaw),
            }
          : designInput;

    setDesignInput(committedDesignInput);

    // Commit pile element numeric fields on Save (buffered typing for mobile).
    if (effectiveDesignType === 'MicroPile') {
      try {
        await saveElementPatch({
          ground_rl: parseNumberOrNull(pileGroundRlRaw),
          hole_diameter_mm: parseNumberOrNull(pileHoleDiaRaw) as any,
        } as any);
      } catch {
        // ignore; element patch errors are surfaced elsewhere
      }
    }

    await siteDesignInputRepo.upsert(element.id, designType, JSON.stringify(committedDesignInput), {
      element_type: String(element.element_type || '').toLowerCase(),
      reference_rl_type: 'ground_rl',
      design_json: JSON.stringify(committedDesignInput),
    });
    reload();
    alert('Design input saved.');
  };

  const createRecord = async () => {
    if (!element) return;
    const id = await siteDrillingRepo.createRecord({
      element_id: element.id,
      record_date: newRecordDate || null,
      method: newRecordMethod.trim() || null,
      start_depth_m: null,
      end_depth_m: null,
      notes: null,
    });
    setNewRecordDate('');
    setNewRecordMethod('');
    setRecords(siteDrillingRepo.listRecordsByElement(element.id));
    setActiveRecordId(id);
  };

  const deleteRecord = async (recordId: string) => {
    if (!confirm('Delete drilling record (and its intervals)?')) return;
    await siteDrillingRepo.deleteRecord(recordId);
    if (element) setRecords(siteDrillingRepo.listRecordsByElement(element.id));
    setActiveRecordId('');
    setIntervals([]);
  };

  const learnFromIntervalEdits = async (opts: {
    siteId: string | null;
    elementType: string;
    selections: PhraseBuilderSelections;
    autoPhrase: string | null;
    finalPhrase: string | null;
    finalPhraseEdited: boolean;
  }) => {
    const siteId = opts.siteId;
    const elementType = opts.elementType;
    const siteScoped = siteId ?? null;

    const norm = (s: any) => String(s || '').replace(/\s+/g, ' ').trim();
    const shortOk = (s: string) => s.length >= 2 && s.length <= 140 && !/[\r\n]/.test(s);

    const computeEditLevel = (auto: string, fin: string): 'none' | 'light' | 'heavy' => {
      const a = norm(auto).toLowerCase();
      const f = norm(fin).toLowerCase();
      if (!a || !f) return 'heavy';
      if (a === f) return 'none';
      const lenA = a.length;
      const lenF = f.length;
      const lenDiff = Math.abs(lenA - lenF);
      const rel = lenDiff / Math.max(1, Math.min(lenA, lenF));
      const prefix = (() => {
        const n = Math.min(18, lenA, lenF);
        return a.slice(0, n) === f.slice(0, n);
      })();
      if (rel < 0.25 && prefix) return 'light';
      return 'heavy';
    };

    const inferFamilyFromFinal = (fin: string): PhraseBuilderSelections['template_family'] => {
      const f = norm(fin).toLowerCase();
      if (!f) return opts.selections.template_family;
      if (f.startsWith('recovered as')) return 'observed_first';
      if (f.startsWith('with water') || f.startsWith('water ') || f.startsWith('wet ') || f.startsWith('dry ')) return 'condition_led';
      if (f.startsWith('transition') || f.includes('transition into')) return 'rock_transition';
      if (f.includes('weak band') || f.includes('soft band') || f.includes('interbed')) return 'weak_band';
      // If it starts with weathering/rock shorthand, treat as interpreted-first.
      if (/^(xw|mw|sw|hw|rs|fr)\b/.test(f)) return 'interpreted_first';
      return opts.selections.template_family;
    };

    const upsert = async (baseCategory: string, rawText: any) => {
      const text = norm(rawText);
      if (!text || !shortOk(text)) return;
      // Store element-type specific variants to support per-workflow filtering without schema changes.
      const category = `${baseCategory}@${elementType}`;
      await siteLoggingPhraseRepo.upsertUnique({ category, text, site_id: siteScoped });
    };

    try {
      await upsert('observed_material', opts.selections.observed_material);
      await upsert('interpreted_material', opts.selections.interpreted_material);
      await upsert('colour', opts.selections.colour);
      await upsert('modifier', opts.selections.modifier);
      await upsert('water', opts.selections.water);
      await upsert('recovery', opts.selections.recovery);
      await upsert('drilling_response', opts.selections.drilling_response);
      await upsert('weathering', opts.selections.weathering);
      await upsert('rock_type', opts.selections.rock_type);
      await upsert('common_phrase', opts.selections.common_phrase);

      const auto = norm(opts.autoPhrase);
      const fin = norm(opts.finalPhrase);
      const editedMeaningfully =
        Boolean(opts.finalPhraseEdited) && fin && (!auto || fin.toLowerCase() !== auto.toLowerCase());
      const editLevel = auto && fin ? computeEditLevel(auto, fin) : editedMeaningfully ? 'heavy' : 'light';
      const learnedFamily = inferFamilyFromFinal(fin);

      if (editedMeaningfully) {
        // "Learning": store the final user-edited phrase as a site-specific common phrase suggestion.
        await upsert('common_phrase', fin);
        // Pattern learning: keep full-sentence examples as reusable patterns (team wording).
        if (editLevel === 'heavy') await upsert('sentence_pattern', fin);
      }

      // Track sentence pattern family usage (as suggestions, not hard rules).
      await upsert('template_family', learnedFamily);

      // Refresh phrase library view and re-run suggestion ordering.
      if (siteId != null) setPhrases(siteLoggingPhraseRepo.list(siteId));
      setPhraseRevision((n) => n + 1);
    } catch (e) {
      console.warn('[SiteLoggingElement] phrase learn skipped:', e);
    }
  };

  const createInterval = async () => {
    if (!activeRecordId) return alert('Select a drilling record first.');
    const from = Number(newFrom);
    const to = Number(newTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return alert('Interval depths must be numeric and to > from.');
    const autoPhrase = newAutoPhrase.trim() || null;
    const finalPhrase = newFinalPhrase.trim() || autoPhrase || null;
    const computeEditLevel = (auto: string | null, fin: string | null): 'none' | 'light' | 'heavy' => {
      const a = String(auto || '').replace(/\s+/g, ' ').trim();
      const f = String(fin || '').replace(/\s+/g, ' ').trim();
      if (!a || !f) return 'heavy';
      if (a.toLowerCase() === f.toLowerCase()) return 'none';
      const rel = Math.abs(a.length - f.length) / Math.max(1, Math.min(a.length, f.length));
      const prefix = a.slice(0, Math.min(18, a.length, f.length)).toLowerCase() === f.slice(0, Math.min(18, a.length, f.length)).toLowerCase();
      if (rel < 0.25 && prefix) return 'light';
      return 'heavy';
    };
    const editLevel = computeEditLevel(autoPhrase, finalPhrase);

    const inferFamilyFromFinal = (fin: string | null): PhraseBuilderSelections['template_family'] => {
      const f = String(fin || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!f) return phraseSel.template_family;
      if (f.startsWith('recovered as')) return 'observed_first';
      if (f.startsWith('with water') || f.startsWith('water ') || f.startsWith('wet ') || f.startsWith('dry ')) return 'condition_led';
      if (f.startsWith('transition') || f.includes('transition into')) return 'rock_transition';
      if (f.includes('weak band') || f.includes('soft band') || f.includes('interbed')) return 'weak_band';
      if (/^(xw|mw|sw|hw|rs|fr)\b/.test(f)) return 'interpreted_first';
      return phraseSel.template_family;
    };
    const learnedFamily = editLevel === 'heavy' ? inferFamilyFromFinal(finalPhrase) : phraseSel.template_family;

    const secondary = {
      schema_version: 'site-drilling-interval-v1',
      source: 'field_record',
      element_type: phraseElementType,
      template_family: phraseSel.template_family,
      learned_family: learnedFamily,
      colour: phraseSel.colour ? phraseSel.colour.trim() : null,
      modifier: phraseSel.modifier ? phraseSel.modifier.trim() : null,
      common_phrase: phraseSel.common_phrase ? phraseSel.common_phrase.trim() : null,
      auto_phrase: autoPhrase,
      edit_level: editLevel,
      final_phrase_edited: Boolean(newFinalPhraseEdited) && editLevel !== 'none',
    };
    await siteDrillingRepo.createInterval({
      record_id: activeRecordId,
      from_depth_m: from,
      to_depth_m: to,
      observed_text: newObs.trim() || null,
      interpreted_text: null,
      recovery_text: null,
      water_text: null,
      response_text: null,
      drilling_time_min: toNumberOrNull(newTimeMin),
      material_observed: newMatObs.trim() || null,
      material_interpreted: newMatInt.trim() || null,
      colour: phraseSel.colour.trim() || null,
      secondary_components_json: JSON.stringify(secondary),
      weathering_class: newWeathering,
      rock_type: newRockType,
      recovery_type: newRecoveryType,
      water_condition: newWater,
      drilling_response_json: JSON.stringify(newResponses || []),
      free_text_note: newFreeNote.trim() || null,
      logging_phrase_output: finalPhrase as any,
    });

    // After saving, refresh history and prep the next interval. Carry forward sensible context,
    // but do not carry forward the final phrase.
    const span = Math.max(0.1, to - from);
    setNewFrom(String(to.toFixed(2)));
    setNewTo(String((to + span).toFixed(2)));
    setNewObs('');
    setNewMatObs('');
    setNewTimeMin('');
    setNewFreeNote('');
    setNewFinalPhrase('');
    setNewFinalPhraseEdited(false);
    setPhraseSel((prev) => ({ ...prev, colour: '', modifier: '', common_phrase: '' }));
    setIntervals(siteDrillingRepo.listIntervalsByRecord(activeRecordId));
    focusIntervalTop();

    const siteId = site?.id || element?.site_id || null;
    await learnFromIntervalEdits({
      siteId,
      elementType: phraseElementType,
      selections: phraseSel,
      autoPhrase,
      finalPhrase,
      finalPhraseEdited: newFinalPhraseEdited,
    });
  };

  const beginEditInterval = (it: SiteDrillingInterval) => {
    setEditingIntervalId(it.id);
    setEditFrom(String(it.from_depth_m));
    setEditTo(String(it.to_depth_m));
    setEditTimeMin((it as any).drilling_time_min != null ? String((it as any).drilling_time_min) : '');
    setEditObs(it.observed_text ?? '');
    setEditMatObs((it as any).material_observed ?? '');
    setEditMatInt((it as any).material_interpreted ?? '');
    setEditWeathering(((it as any).weathering_class as any) ?? 'not_applicable');
    setEditRockType(((it as any).rock_type as any) ?? 'not_applicable');
    setEditRecoveryType(((it as any).recovery_type as any) ?? 'good_return');
    setEditWater(((it as any).water_condition as any) ?? 'not_observed');
    const resp = (it as any).drilling_response_json
      ? parseJsonArray((it as any).drilling_response_json).map(String).map((s) => s.replace(/_/g, ' '))
      : [];
    setEditResponses(resp);
    setEditFreeNote((it as any).free_text_note ?? '');
    setEditFinalPhrase(((it as any).logging_phrase_output as any) || '');
  };

  const cancelEditInterval = () => {
    setEditingIntervalId('');
  };

  const saveEditInterval = async () => {
    if (!editingIntervalId) return;
    const from = Number(editFrom);
    const to = Number(editTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return alert('Interval depths must be numeric and to > from.');
    const phrase = composeIntervalPhrase({
      material_observed: editMatObs.trim() || null,
      material_interpreted: editMatInt.trim() || null,
      drilling_time_min: toNumberOrNull(editTimeMin) as any,
      weathering_class: editWeathering,
      rock_type: editRockType,
      recovery_type: editRecoveryType,
      water_condition: editWater,
      drilling_response_json: JSON.stringify(editResponses || []),
      free_text_note: editFreeNote.trim() || null,
    });
    await siteDrillingRepo.updateInterval(editingIntervalId, {
      from_depth_m: from,
      to_depth_m: to,
      observed_text: editObs.trim() || null,
      drilling_time_min: toNumberOrNull(editTimeMin),
      material_observed: editMatObs.trim() || null,
      material_interpreted: editMatInt.trim() || null,
      weathering_class: editWeathering,
      rock_type: editRockType,
      recovery_type: editRecoveryType,
      water_condition: editWater,
      drilling_response_json: JSON.stringify(editResponses || []),
      free_text_note: editFreeNote.trim() || null,
      logging_phrase_output: (editFinalPhrase.trim() || phrase || null) as any,
    } as any);
    if (activeRecordId) setIntervals(siteDrillingRepo.listIntervalsByRecord(activeRecordId));
    setEditingIntervalId('');

    // Learning: treat interval edit as a user-evolved phrase if it diverges from the auto phrase.
    const siteId = site?.id || element?.site_id || null;
    await learnFromIntervalEdits({
      siteId,
      elementType: phraseElementType,
      selections: {
        ...phraseSel,
        observed_material: editMatObs.trim(),
        interpreted_material: editMatInt.trim(),
      },
      autoPhrase: null,
      finalPhrase: editFinalPhrase.trim() || phrase || null,
      finalPhraseEdited: true,
    });
  };

  const deleteInterval = async (intervalId: string) => {
    await siteDrillingRepo.deleteInterval(intervalId);
    if (activeRecordId) setIntervals(siteDrillingRepo.listIntervalsByRecord(activeRecordId));
  };

  const loadIntervalIntoCurrent = (
    it: SiteDrillingInterval,
    mode: 'duplicate' | 'next' | 'insert_after',
    nextInterval?: SiteDrillingInterval | null
  ) => {
    const span = Math.max(0.1, Number(it.to_depth_m) - Number(it.from_depth_m));
    const baseFrom = mode === 'duplicate' ? Number(it.from_depth_m) : Number(it.to_depth_m);
    let baseTo =
      mode === 'duplicate'
        ? Number(it.to_depth_m)
        : mode === 'insert_after' && nextInterval
          ? Number(nextInterval.from_depth_m)
          : Number(it.to_depth_m) + span;
    if (!Number.isFinite(baseTo) || baseTo <= baseFrom) baseTo = baseFrom + span;
    setNewFrom(String(baseFrom.toFixed(2)));
    setNewTo(String(baseTo.toFixed(2)));
    setNewTimeMin((it as any).drilling_time_min != null ? String((it as any).drilling_time_min) : '');
    setNewObs(it.observed_text ?? '');
    setNewMatObs((it as any).material_observed ?? '');
    setNewMatInt((it as any).material_interpreted ?? '');
    setNewWeathering(((it as any).weathering_class as any) ?? 'not_applicable');
    setNewRockType(((it as any).rock_type as any) ?? 'not_applicable');
    setNewRecoveryType(((it as any).recovery_type as any) ?? 'good_return');
    setNewWater(((it as any).water_condition as any) ?? 'not_observed');
    const resp = (it as any).drilling_response_json ? parseJsonArray((it as any).drilling_response_json).map(String) : [];
    setNewResponses(resp);
    setNewFreeNote((it as any).free_text_note ?? '');
    setNewFinalPhrase(((it as any).logging_phrase_output as any) || '');
    setNewFinalPhraseEdited(Boolean(String(((it as any).logging_phrase_output as any) || '').trim()));

    const sec = (it as any).secondary_components_json ? parseJsonObject(String((it as any).secondary_components_json)) : null;
    setPhraseSel((prev) => ({
      ...prev,
      template_family:
        (sec?.template_family === 'interpreted_first' ||
          sec?.template_family === 'observed_first' ||
          sec?.template_family === 'mixed' ||
          sec?.template_family === 'condition_led' ||
          sec?.template_family === 'rock_transition' ||
          sec?.template_family === 'weak_band')
          ? sec.template_family
          : (sec?.template_id === 'interpreted_first' || sec?.template_id === 'observed_first' || sec?.template_id === 'mixed')
            ? sec.template_id
            : prev.template_family,
      colour: String((it as any).colour ?? sec?.colour ?? prev.colour ?? '').trim(),
      modifier: String(sec?.modifier ?? prev.modifier ?? '').trim(),
      common_phrase: String(sec?.common_phrase ?? prev.common_phrase ?? '').trim(),
    }));

    if (mode === 'next') {
      // Next interval: carry forward conditions/interpreted context, but start returns/phrase fresh.
      setNewObs('');
      setNewMatObs('');
      setNewTimeMin('');
      setNewFreeNote('');
      setNewFinalPhrase('');
      setNewFinalPhraseEdited(false);
      setPhraseSel((prev) => ({ ...prev, colour: '', modifier: '', common_phrase: '' }));
    }

    if (mode === 'insert_after') {
      // Insert mode is about getting depths correct; keep conditions as a hint but start returns/phrase fresh.
      setNewObs('');
      setNewMatObs('');
      setNewMatInt('');
      setNewFreeNote('');
      setNewFinalPhrase('');
      setNewFinalPhraseEdited(false);
      setPhraseSel((prev) => ({ ...prev, colour: '', modifier: '', common_phrase: '' }));
    }

    focusIntervalTop();
  };

  const reuseWordingFromInterval = (it: SiteDrillingInterval) => {
    const phrase = String(((it as any).logging_phrase_output as any) || it.observed_text || '').trim();
    if (!phrase) return;
    // Only bring back the wording + style (sentence family), without overwriting depths/conditions.
    setNewFinalPhrase(phrase);
    setNewFinalPhraseEdited(true);

    const sec = (it as any).secondary_components_json ? parseJsonObject(String((it as any).secondary_components_json)) : null;
    if (sec) {
      const fam =
        sec?.template_family === 'interpreted_first' ||
        sec?.template_family === 'observed_first' ||
        sec?.template_family === 'mixed' ||
        sec?.template_family === 'condition_led' ||
        sec?.template_family === 'rock_transition' ||
        sec?.template_family === 'weak_band'
          ? (sec.template_family as any)
          : null;
      if (fam) {
        setTemplateFamilyTouched(true);
        setPhraseSel((prev) => ({ ...prev, template_family: fam }));
      }
      setPhraseSel((prev) => ({
        ...prev,
        colour: String(sec?.colour ?? prev.colour ?? '').trim(),
        modifier: String(sec?.modifier ?? prev.modifier ?? '').trim(),
        common_phrase: String(sec?.common_phrase ?? prev.common_phrase ?? '').trim(),
      }));
    }

    setActiveStep('Logging');
    window.setTimeout(() => focusIntervalTop(), 50);
  };

  const saveActiveRecordDetails = async () => {
    if (!record) return;
    await siteDrillingRepo.updateRecord(record.id, {
      start_date: recordStartDate.trim() || null,
      end_date: recordEndDate.trim() || null,
      logged_by: recordLoggedBy.trim() || null,
      approved_by: recordApprovedBy.trim() || null,
      record_page_count: toNumberOrNull(recordPageCount) as any,
      general_note: recordGeneralNote.trim() || null,
    } as any);
    if (element) setRecords(siteDrillingRepo.listRecordsByElement(element.id));
    alert('Drilling record updated.');
  };

  const saveInterpretation = async () => {
    if (!element) return;
    const refTor = toNumberOrNull(interpReferenceTorDepth);
    const refVel = toNumberOrNull(interpReferenceTorVelocity);
    const actualTor = toNumberOrNull(interpActualTorDepth);
    const variance = actualTor != null && refTor != null ? actualTor - refTor : null;

    const reasons = [
      ...interpVarianceReasons.map(String).map((s) => s.trim()).filter(Boolean),
      ...(interpVarianceOther.trim() ? [interpVarianceOther.trim()] : []),
    ];
    const weakBands = interpWeakBands
      .map((w) => ({
        from_depth_m: toNumberOrNull(w.from_m),
        to_depth_m: toNumberOrNull(w.to_m),
        note: w.note?.trim() || null,
      }))
      .filter((w) => w.from_depth_m != null && w.to_depth_m != null && w.to_depth_m > w.from_depth_m);
    const reasonsJson = JSON.stringify({
      tor_variance_class: interpVarianceClass,
      reasons,
      other: interpVarianceOther.trim() || null,
      reference_tor_m: refTor,
    });
    const weakBandsJson = JSON.stringify(weakBands);
    setInterpReasonsJson(reasonsJson);
    setInterpWeakBandsJson(weakBandsJson);

    await siteInterpretationRepo.upsert(element.id, {
      confidence: interpConfidence,
      summary: interpSummary.trim() || null,
      interpretation_json: null,
      reference_tor_depth_m: refTor,
      reference_tor_velocity_ms: refVel,
      actual_tor_depth_m: actualTor,
      tor_variance_m: variance,
      tor_variance_reason_json: reasonsJson,
      continuous_rock_start_m: toNumberOrNull(interpContinuousRockStart),
      weak_band_intervals_json: weakBandsJson,
      interpretation_confidence: interpConfidence,
      interpretation_summary: interpSummary.trim() || null,
    } as any);
    reload();
    alert('Interpretation saved.');
  };

  const saveGroundReference = async () => {
    if (!element) return;
    await siteGroundReferenceRepo.upsertGroundReferenceBySite(element.project_id, element.site_id, {
      source_label: 'Project maintained reference',
      geotechnical_units_json: groundRefUnitsJson.trim() || '[]',
      expected_tor_min_m: toNumberOrNull(groundRefExpectedTorMin),
      expected_tor_max_m: toNumberOrNull(groundRefExpectedTorMax),
      reference_tor_velocity_ms: toNumberOrNull(groundRefRefVelocity),
      site_risk_flags_json: groundRefRiskFlagsJson.trim() || '[]',
      reference_notes: groundRefNotes.trim() || null,
      reference_json: safeJsonStringify(groundRefReferenceObj || {}),
    });
    reload();
    alert('Site reference saved.');
  };

  const saveCleanOut = async () => {
    if (!record) return alert('Select a drilling record first.');
    await siteCleanOutRepo.upsertByRecord(record.id, {
      method_air: cleanMethodAir ? 1 : 0,
      method_water: cleanMethodWater ? 1 : 0,
      method_grout: cleanMethodGrout ? 1 : 0,
      clean_out_depth_m: toNumberOrNull(cleanDepth),
      clean_out_datetime: cleanDateTime.trim() || null,
      base_condition: cleanBaseCondition,
      sedimentation_observed: cleanSediment ? 1 : 0,
      approved_for_grouting: cleanApproved ? 1 : 0,
      approval_note: cleanNote.trim() || null,
    });
    await reload();
    alert('Clean-out saved.');
  };

  const saveApproval = async () => {
    if (!element) return;
    const nextApproval = {
      logged_by: approvalLoggedBy.trim() || null,
      reviewed_by: approvalReviewedBy.trim() || null,
      approved_by: approvalApprovedBy.trim() || null,
      approved_for_grouting: approvalApproved ? 1 : 0,
      approval_datetime: approvalDateTime.trim() || null,
      approval_comment: approvalComment.trim() || null,
    };
    await siteApprovalRepo.upsertByElement(element.id, nextApproval);
    setApproval(nextApproval as any);
    const nextText = buildSiteOutputReport({
      element,
      siteCode: site?.site_code || '',
      designInput,
      interpretation: {
        reference_tor_depth_m: toNumberOrNull(interpReferenceTorDepth),
        actual_tor_depth_m: toNumberOrNull(interpActualTorDepth),
        interpretation_summary: interpSummary,
      } as any,
      verification: verificationSummary,
      cleanOut,
      approval: nextApproval as any,
      intervals,
      events: fieldEvents,
      photos: sitePhotos,
    });
    setReportPreview(nextText);
    try {
      await persistOutputReport(element, nextText);
    } catch (e) {
      console.warn('[SiteLoggingElement] Output report persistence failed:', e);
    }
    await reload();
    alert('Approval saved.');
  };

  const runVerification = async () => {
    if (!element) return;

    // Verification can capture as-built depths (base of casing / U-bolt / final depth).
    // Persist these alongside design inputs so field users don't need to bounce back to Setup to save.
    const committedForVerification =
      effectiveDesignType === 'MicroPile'
        ? {
            ...designInput,
            casing_to_depth_m: parseNumberOrNull(pileBaseCasingRaw),
            lowest_ubolt_depth_m: parseNumberOrNull(pileLowestUboltRaw),
            final_drilled_depth_m: parseNumberOrNull(pileFinalDepthRaw),
            required_plunge_length_m: parseNumberOrNull(pileMinPlungeRaw),
            max_overdrill_m: parseNumberOrNull(pileMaxOverdrillRaw),
            u_bolt_zone_length_m: parseNumberOrNull(pileUboltZoneRaw),
            required_min_anchorage_below_ubolt_m: parseNumberOrNull(pileMinAnchBelowUboltRaw),
            required_socket_hw_m: parseNumberOrNull(pileSocketHwRaw),
            required_socket_mw_m: parseNumberOrNull(pileSocketMwRaw),
          }
        : effectiveDesignType === 'Anchor' || effectiveDesignType === 'SoilNail'
          ? {
              ...designInput,
              design_anchorage_length_m: parseNumberOrNull(anchorAnchorageRaw),
              required_socket_length_m: parseNumberOrNull(anchorSocketRaw),
              working_load_kN: parseNumberOrNull(anchorWorkingLoadRaw),
              max_overdrill_m: parseNumberOrNull(anchorMaxOverdrillRaw),
              design_bonded_length_m: parseNumberOrNull(anchorBondedRaw),
              design_debonded_length_m: parseNumberOrNull(anchorDebondedRaw),
            }
          : designInput;

    setDesignInput(committedForVerification);
    try {
      await siteDesignInputRepo.upsert(element.id, designType, JSON.stringify(committedForVerification), {
        element_type: String(element.element_type || '').toLowerCase(),
        reference_rl_type: 'ground_rl',
        design_json: JSON.stringify(committedForVerification),
      });
    } catch (e) {
      console.warn('[SiteLoggingElement] Design input persistence during verification failed:', e);
      // Continue; verification can still run in-memory.
    }

    const summary = evaluateSiteVerification({
      element,
      designInput: committedForVerification,
      record,
      intervals,
      interpretation: {
        reference_tor_depth_m: toNumberOrNull(interpReferenceTorDepth),
        reference_tor_velocity_ms: toNumberOrNull(interpReferenceTorVelocity),
        actual_tor_depth_m: toNumberOrNull(interpActualTorDepth),
        interpretation_summary: interpSummary,
      } as any,
      cleanOut,
      approval,
    });
    setVerificationSummary(summary);
    try {
      if (summary.kind === 'anchor' || summary.kind === 'soil_nail') {
        await siteVerificationRepo.upsertAnchorByElement(element.id, JSON.stringify(summary.result));
      } else if (summary.kind === 'micro_pile') {
        await siteVerificationRepo.upsertPileByElement(element.id, JSON.stringify(summary.result));
      }
    } catch (e) {
      console.warn('[SiteLoggingElement] Verification persistence failed:', e);
    }
    const nextText = buildSiteOutputReport({
      element,
      siteCode: site?.site_code || '',
      designInput: committedForVerification,
      interpretation: {
        reference_tor_depth_m: toNumberOrNull(interpReferenceTorDepth),
        actual_tor_depth_m: toNumberOrNull(interpActualTorDepth),
        interpretation_summary: interpSummary,
      } as any,
      verification: summary,
      cleanOut,
      approval,
      intervals,
      events: fieldEvents,
      photos: sitePhotos,
    });
    setReportPreview(nextText);
    try {
      await persistOutputReport(element, nextText);
    } catch (e) {
      console.warn('[SiteLoggingElement] Output report persistence failed:', e);
    }
    alert('Verification updated.');
  };

  const exportElementPack = () => {
    if (!element) return;
    try {
      const pack = exportSiteLoggingElementPack(element.id);
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const siteCode = String(site?.site_code || 'site').trim() || 'site';
      const code = String(element.element_code || element.id.slice(0, 8)).trim().replace(/\s+/g, '_');
      a.download = `site-logging-element-${siteCode}-${code}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`Failed to export element pack: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startImportElementPack = () => {
    importElementPackInputRef.current?.click();
  };

  const onImportElementPackFile = async (file: File | null) => {
    if (!file || !element) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importSiteLoggingElementPack(element.project_id, json);
      alert(
        `Element import complete.\n` +
          `Created site: ${res.createdSite ? 'yes' : 'no'}\n` +
          `Records: ${res.importedRecords}\n` +
          `Intervals: ${res.importedIntervals}\n` +
          `Design inputs: ${res.importedDesignInputs}\n` +
          `Events: ${res.importedEvents}\n` +
          `Photos metadata in pack (not imported): ${res.importedPhotosMeta}`
      );
      navigate(`/site-logging/element/${res.createdElementId}`);
    } catch (e) {
      alert(`Failed to import element pack: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (importElementPackInputRef.current) importElementPackInputRef.current.value = '';
    }
  };

  const appendPhrase = (category: string, text: string, target: 'new' | 'edit') => {
    if (target === 'new') {
      if (category === 'material_observed') setNewMatObs((prev) => (prev ? `${prev}; ${text}` : text));
      else if (category === 'material_interpreted') setNewMatInt((prev) => (prev ? `${prev}; ${text}` : text));
      else if (category === 'template') setNewFreeNote((prev) => (prev ? `${prev} ${text}` : text));
      else setNewFreeNote((prev) => (prev ? `${prev}; ${text}` : text));
      return;
    }
    if (category === 'material_observed') setEditMatObs((prev) => (prev ? `${prev}; ${text}` : text));
    else if (category === 'material_interpreted') setEditMatInt((prev) => (prev ? `${prev}; ${text}` : text));
    else if (category === 'template') setEditFreeNote((prev) => (prev ? `${prev} ${text}` : text));
    else setEditFreeNote((prev) => (prev ? `${prev}; ${text}` : text));
  };

  const createReference = async () => {
    if (!element) return;
    // Prevent adding internal/system reference types via the generic "Add note" UI.
    // GroundReference is reserved for the project-maintained knowledge base record.
    if (String(refType || '').trim() === 'GroundReference') {
      alert('This reference type is system-managed and cannot be created here.');
      return;
    }
    await siteGroundReferenceRepo.create({
      project_id: element.project_id,
      site_id: element.site_id,
      reference_type: refType,
      source_label: refSource.trim() || null,
      reference_json: refJson,
    });
    setRefSource('');
    setRefJson(safeJsonStringify({}));
    if (site) setRefs(siteGroundReferenceRepo.listBySite(site.id));
  };

  const addFieldEvent = async () => {
    if (!element) return;
    const note = newEventNote.trim();
    if (!note) return alert('Event note is required.');
    await siteFieldEventRepo.create({
      element_id: element.id,
      drilling_record_id: record?.id ?? null,
      event_datetime: newEventDateTime.trim() || null,
      category: newEventCategory.trim() || null,
      depth_m: toNumberOrNull(newEventDepth),
      note,
      created_by: 'Field',
    });
    setNewEventDateTime('');
    setNewEventCategory('');
    setNewEventDepth('');
    setNewEventNote('');
    setFieldEvents(siteFieldEventRepo.listByElement(element.id));
  };

  const removeFieldEvent = async (id: string) => {
    if (!element) return;
    await siteFieldEventRepo.remove(id);
    setFieldEvents(siteFieldEventRepo.listByElement(element.id));
  };

  const uploadSitePhoto = async () => {
    if (!element) return;
    if (!newPhotoFile) return alert('Select a photo first.');
    let blobKey: string | null = null;
    try {
      blobKey = await putBlob(newPhotoFile);
    } catch (e) {
      console.error(e);
      alert(`Failed to save photo blob: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    try {
      await sitePhotoAttachmentRepo.create({
        element_id: element.id,
        drilling_record_id: newPhotoRecordId || record?.id || null,
        photo_type: newPhotoType || 'other',
        depth_m: toNumberOrNull(newPhotoDepth),
        blob_key: blobKey,
        mime_type: newPhotoFile.type || null,
        caption: newPhotoCaption.trim() || null,
        taken_datetime: newPhotoTakenAt.trim() || null,
      });
      setNewPhotoFile(null);
      setNewPhotoCaption('');
      setNewPhotoTakenAt('');
      setNewPhotoType('other');
      setNewPhotoDepth('');
      setSitePhotos(sitePhotoAttachmentRepo.listByElement(element.id));
    } catch (e) {
      console.error(e);
      // Roll back blob if metadata failed.
      try { await deleteBlob(blobKey); } catch { /* ignore */ }
      alert(`Failed to attach photo: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const removeSitePhoto = async (photoId: string, blobKey: string) => {
    if (!element) return;
    await sitePhotoAttachmentRepo.remove(photoId);
    try { await deleteBlob(blobKey); } catch { /* ignore */ }
    setSitePhotos(sitePhotoAttachmentRepo.listByElement(element.id));
  };

  const uploadPileReferenceDiagram = async () => {
    if (!element) return;
    if (!pileDiagramFile) return alert('Select an image first.');

    // Replace existing diagram(s) so we keep a single "active" diagram in normal field use.
    const existing = sitePhotos.filter((p: any) => String(p.photo_type || '').trim() === PHOTO_TYPE_REFERENCE_DIAGRAM);
    for (const p of existing) {
      try {
        await sitePhotoAttachmentRepo.remove(p.id);
        try { await deleteBlob(p.blob_key); } catch { /* ignore */ }
      } catch {
        // ignore
      }
    }

    let blobKey: string | null = null;
    try {
      blobKey = await putBlob(pileDiagramFile);
    } catch (e) {
      console.error(e);
      alert(`Failed to save reference diagram blob: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    try {
      await sitePhotoAttachmentRepo.create({
        element_id: element.id,
        drilling_record_id: null,
        photo_type: PHOTO_TYPE_REFERENCE_DIAGRAM,
        depth_m: null,
        blob_key: blobKey,
        mime_type: pileDiagramFile.type || null,
        caption: pileDiagramCaption.trim() || 'Pile reference diagram',
        taken_datetime: null,
      });
      setPileDiagramFile(null);
      setPileDiagramCaption('');
      setSitePhotos(sitePhotoAttachmentRepo.listByElement(element.id));
    } catch (e) {
      console.error(e);
      try { await deleteBlob(blobKey); } catch { /* ignore */ }
      alert(`Failed to attach reference diagram: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const removePileReferenceDiagram = async () => {
    if (!element) return;
    const diag = pileReferenceDiagram;
    if (!diag) return;
    if (!window.confirm('Remove reference diagram?')) return;
    try {
      await sitePhotoAttachmentRepo.remove(diag.id);
      try { await deleteBlob(diag.blob_key); } catch { /* ignore */ }
      setSitePhotos(sitePhotoAttachmentRepo.listByElement(element.id));
    } catch (e) {
      alert(`Failed to remove reference diagram: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addBoreholeCalibration = async () => {
    if (!site) return alert('Select a site first.');
    const bh = newBhId.trim();
    if (!bh) return alert('Borehole id is required.');
    await siteBoreholeCalibrationRepo.createForSite(site.id, {
      site_line_id: null,
      borehole_id: bh,
      borehole_offset_m: null,
      elevation_difference_m: null,
      borehole_tor_depth_m_bgl: toNumberOrNull(newBhTor),
      borehole_lithology_at_tor: null,
      srt_velocity_at_tor_ms: newBhVel.trim() || null,
      difference_geophysics_minus_borehole_m: toNumberOrNull(newBhDiff),
      variance_note: null,
      confidence: newBhConf || null,
    } as any);
    setNewBhId('');
    setNewBhTor('');
    setNewBhVel('');
    setNewBhDiff('');
    setNewBhConf('');
    setBoreholeCalibrations(siteBoreholeCalibrationRepo.listBySite(site.id));
  };

  const removeBoreholeCalibration = async (id: string) => {
    if (!site) return;
    await siteBoreholeCalibrationRepo.remove(id);
    setBoreholeCalibrations(siteBoreholeCalibrationRepo.listBySite(site.id));
  };

  const beginEditBoreholeCalibration = (row: SiteBoreholeCalibration) => {
    setBhEditId(row.id);
    setBhEditDraft({
      borehole_id: row.borehole_id ?? '',
      borehole_tor_depth_m_bgl: row.borehole_tor_depth_m_bgl != null ? String(row.borehole_tor_depth_m_bgl) : '',
      srt_velocity_at_tor_ms: row.srt_velocity_at_tor_ms ?? '',
      difference_geophysics_minus_borehole_m:
        row.difference_geophysics_minus_borehole_m != null ? String(row.difference_geophysics_minus_borehole_m) : '',
      confidence: (row.confidence as any) ?? '',
      variance_note: row.variance_note ?? '',
    });
  };

  const cancelEditBoreholeCalibration = () => {
    setBhEditId('');
    setBhEditDraft(null);
  };

  const saveEditBoreholeCalibration = async () => {
    if (!site || !bhEditId || !bhEditDraft) return;
    const bh = String(bhEditDraft.borehole_id || '').trim();
    if (!bh) return alert('Borehole id is required.');
    try {
      await siteBoreholeCalibrationRepo.update(bhEditId, {
        borehole_id: bh,
        borehole_tor_depth_m_bgl: toNumberOrNull(String(bhEditDraft.borehole_tor_depth_m_bgl || '')),
        srt_velocity_at_tor_ms: String(bhEditDraft.srt_velocity_at_tor_ms || '').trim() || null,
        difference_geophysics_minus_borehole_m: toNumberOrNull(String(bhEditDraft.difference_geophysics_minus_borehole_m || '')),
        confidence: String(bhEditDraft.confidence || '').trim() || null,
        variance_note: String(bhEditDraft.variance_note || '').trim() || null,
      } as any);
      cancelEditBoreholeCalibration();
      setBoreholeCalibrations(siteBoreholeCalibrationRepo.listBySite(site.id));
    } catch (e) {
      alert(`Failed to update calibration: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const savePhraseForm = async () => {
    if (!site) return alert('Select a site first.');
    const text = normalizePhraseText(phraseFormText);
    const category = normalizePhraseCategory(String(phraseFormCategory || '').trim() || 'common_phrase').base || 'common_phrase';
    if (!PHRASE_ADMIN_CATEGORIES.includes(category)) return alert('Invalid phrase category.');
    if (!text) return alert('Phrase text is required.');

    // Prevent duplicates (case-insensitive) for long-term maintainability.
    const already = phrases.find((p) => {
      const c = normalizePhraseCategory(String(p.category || '')).base;
      if (c !== category) return false;
      return normalizePhraseTextKey(String(p.text || '')) === normalizePhraseTextKey(text);
    });
    if (already) return alert('Duplicate phrase (same category) already exists.');
    try {
      await siteLoggingPhraseRepo.upsertUnique({ category, text, site_id: site.id });
      setPhraseFormText('');
      setPhrases(siteLoggingPhraseRepo.list(site.id));
      setPhraseRevision((v) => v + 1);
    } catch (e) {
      alert(`Failed to save phrase: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startEditPhrase = (p: SiteLoggingPhrase) => {
    setPhraseEditId(p.id);
    const full = String(p.category || '').trim();
    setPhraseEditOriginalCategory(full);
    // Admin category picker is controlled to base categories; preserve any "@type" suffix internally.
    setPhraseEditCategory(full.split('@')[0]);
    setPhraseEditText(String(p.text || ''));
  };

  const cancelEditPhrase = () => {
    setPhraseEditId('');
    setPhraseEditCategory('');
    setPhraseEditOriginalCategory('');
    setPhraseEditText('');
  };

  const saveEditPhrase = async () => {
    if (!site) return;
    if (!phraseEditId) return;
    const text = normalizePhraseText(phraseEditText);
    const baseCategory = normalizePhraseCategory(String(phraseEditCategory || '').trim() || 'common_phrase').base || 'common_phrase';
    if (!PHRASE_ADMIN_CATEGORIES.includes(baseCategory)) return alert('Invalid phrase category.');
    if (!text) return alert('Phrase text is required.');

    // Preserve "@type" suffix only if the base category is unchanged from the original.
    const original = String(phraseEditOriginalCategory || '').trim();
    const origBase = original ? original.split('@')[0] : '';
    const origSuffix = original && original.includes('@') ? `@${original.split('@').slice(1).join('@')}` : '';
    const category = origBase && origBase === baseCategory ? `${baseCategory}${origSuffix}` : baseCategory;

    const dup = phrases.find((p) => {
      if (String(p.id) === String(phraseEditId)) return false;
      const c = String(p.category || '').trim();
      if (c !== category) return false;
      return normalizePhraseTextKey(String(p.text || '')) === normalizePhraseTextKey(text);
    });
    if (dup) return alert('Duplicate phrase already exists.');
    try {
      await siteLoggingPhraseRepo.update(phraseEditId, { category, text } as any);
      cancelEditPhrase();
      setPhrases(siteLoggingPhraseRepo.list(site.id));
      setPhraseRevision((v) => v + 1);
    } catch (e) {
      alert(`Failed to update phrase: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const deletePhrase = async (id: string) => {
    if (!site) return;
    const ok = window.confirm('Delete this phrase?');
    if (!ok) return;
    try {
      await siteLoggingPhraseRepo.remove(id);
      // Remove from local ordering/archiving policy as well.
      const archived = new Set<string>([...phraseAdminPolicy.archivedIds]);
      archived.delete(id);
      const nextOrderByCat: Record<string, string[]> = {};
      for (const [cat, arr] of Object.entries(phraseAdminPolicy.orderByCategory) as Array<[string, string[]]>) {
        nextOrderByCat[cat] = (arr || []).filter((x) => String(x) !== String(id));
      }
      updatePhraseAdmin({ archivedIds: [...archived], orderByCategory: nextOrderByCat });
      setPhrases(siteLoggingPhraseRepo.list(site.id));
      setPhraseRevision((v) => v + 1);
    } catch (e) {
      alert(`Failed to delete phrase: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const deleteReference = async (refId: string) => {
    await siteGroundReferenceRepo.delete(refId);
    if (site) setRefs(siteGroundReferenceRepo.listBySite(site.id));
  };

  const softDeleteElement = async () => {
    if (!element) return;
    if (!confirm('Archive this support element?')) return;
    await supportElementRepo.softDelete(element.id);
    navigate('/site-logging');
  };

  if (!elementId) {
    return (
      <Layout title="Site Logging">
        <div className="p-4 text-sm text-zinc-600">Missing element id.</div>
      </Layout>
    );
  }

  if (!element) {
    return (
      <Layout title="Site Logging">
        <div className="p-4">
          <div className="text-sm text-zinc-600">Element not found (or deleted).</div>
          <button className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold" onClick={() => navigate('/site-logging')}>
            Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Site Logging">
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-sm font-bold text-zinc-800">
                {element.element_code ? `${element.element_code} / ` : ''}
                {formatElementTypeShortLabel(String(element.element_type || ''))}
              </div>
              <div className="text-[11px] text-zinc-500">
                Site: {site?.site_code ?? element.site_id} / Status:{' '}
                {formatStatusLabel(String(element.status || '')) || '-'}
                {element.chainage != null ? ` / Ch ${Number(element.chainage).toFixed(0)} m` : ''}
                {element.location_description ? ` / ${element.location_description}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                onClick={() => navigate('/site-logging')}
              >
                Back
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                onClick={() => navigate(`/site-logging/element/${element.id}/report`)}
              >
                Report
              </button>
              <button
                className="rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-rose-700"
                onClick={softDeleteElement}
              >
                Archive
              </button>
            </div>
          </div>

          {activeStep === 'Setup' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={element.element_code ?? ''}
                onChange={(e) => saveElementPatch({ element_code: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Element code"
              />
              <input
                value={element.chainage ?? ''}
                onChange={(e) => saveElementPatch({ chainage: toNumberOrNull(e.target.value) })}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Chainage (m)"
                inputMode="decimal"
              />
              <input
                value={element.location_description ?? ''}
                onChange={(e) => saveElementPatch({ location_description: e.target.value })}
                className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                placeholder="Location description"
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-2">
          <div className="flex flex-wrap gap-2">
            {visibleWorkflowSteps.map((t) => (
              <button
                key={t}
                onClick={() => setActiveStep(t)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase ${
                  activeStep === t ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {activeStep === 'Setup' && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-zinc-800">Setup</div>
              <button onClick={saveDesign} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">Save</button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">
              Element setup and design inputs. Field logging is done in <span className="font-semibold text-zinc-800">Logging</span>.
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-zinc-50 p-2">
                <div className="text-[11px] font-bold uppercase text-zinc-700">Field essentials</div>
                <button
                  onClick={() => setShowSetupAdvanced((v) => !v)}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                  title="Show less-used settings"
                >
                  {showSetupAdvanced ? 'Hide advanced' : 'Advanced'}
                </button>
              </div>

              {(effectiveDesignType === 'Anchor' || effectiveDesignType === 'SoilNail') && (
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">
                    {effectiveDesignType === 'SoilNail' ? 'Soil nail essentials' : 'Anchor essentials'}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Anchorage length (m)"
                      inputMode="decimal"
                      value={anchorAnchorageRaw}
                      onChange={(e) => setAnchorAnchorageRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          design_anchorage_length_m: parseNumberOrNull(anchorAnchorageRaw),
                        })
                      }
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Socket / bond length (m)"
                      inputMode="decimal"
                      value={anchorSocketRaw}
                      onChange={(e) => setAnchorSocketRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          required_socket_length_m: parseNumberOrNull(anchorSocketRaw),
                        })
                      }
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Working load (kN)"
                      inputMode="decimal"
                      value={anchorWorkingLoadRaw}
                      onChange={(e) => setAnchorWorkingLoadRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          working_load_kN: parseNumberOrNull(anchorWorkingLoadRaw),
                        })
                      }
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Max overdrill (m)"
                      inputMode="decimal"
                      value={anchorMaxOverdrillRaw}
                      onChange={(e) => setAnchorMaxOverdrillRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          max_overdrill_m: parseNumberOrNull(anchorMaxOverdrillRaw),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {effectiveDesignType === 'MicroPile' && (
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">Pile essentials</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Collar / ground RL (m)"
                      inputMode="decimal"
                      value={pileGroundRlRaw}
                      onChange={(e) => setPileGroundRlRaw(e.target.value)}
                      onBlur={() => void saveElementPatch({ ground_rl: parseNumberOrNull(pileGroundRlRaw) })}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Hole diameter (mm)"
                      inputMode="numeric"
                      value={pileHoleDiaRaw}
                      onChange={(e) => setPileHoleDiaRaw(e.target.value)}
                      onBlur={() => void saveElementPatch({ hole_diameter_mm: parseNumberOrNull(pileHoleDiaRaw) as any })}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Steel casing size (e.g. 273 OD, 250 NB)"
                      value={designInput.steel_casing_size ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, steel_casing_size: e.target.value })}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Casing type (temporary / permanent / none)"
                      value={designInput.casing_type ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, casing_type: e.target.value })}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Min casing plunge into rock (m)"
                      inputMode="decimal"
                      value={pileMinPlungeRaw}
                      onChange={(e) => setPileMinPlungeRaw(e.target.value)}
                      onBlur={() => setDesignInput({ ...designInput, required_plunge_length_m: parseNumberOrNull(pileMinPlungeRaw) })}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="U-bolt zone allowance (m)"
                      inputMode="decimal"
                      value={pileUboltZoneRaw}
                      onChange={(e) => setPileUboltZoneRaw(e.target.value)}
                      onBlur={() => setDesignInput({ ...designInput, u_bolt_zone_length_m: parseNumberOrNull(pileUboltZoneRaw) })}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Required anchorage below lowest U-bolt (m)"
                      inputMode="decimal"
                      value={pileMinAnchBelowUboltRaw}
                      onChange={(e) => setPileMinAnchBelowUboltRaw(e.target.value)}
                      onBlur={() => setDesignInput({ ...designInput, required_min_anchorage_below_ubolt_m: parseNumberOrNull(pileMinAnchBelowUboltRaw) })}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Required HW socket (m)"
                      inputMode="decimal"
                      value={pileSocketHwRaw}
                      onChange={(e) => setPileSocketHwRaw(e.target.value)}
                      onBlur={() => setDesignInput({ ...designInput, required_socket_hw_m: parseNumberOrNull(pileSocketHwRaw) })}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Required MW socket (m)"
                      inputMode="decimal"
                      value={pileSocketMwRaw}
                      onChange={(e) => setPileSocketMwRaw(e.target.value)}
                      onBlur={() => setDesignInput({ ...designInput, required_socket_mw_m: parseNumberOrNull(pileSocketMwRaw) })}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Pile / post ID"
                      value={designInput.bar_id ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, bar_id: e.target.value })}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Bar / pile size (optional)"
                      value={designInput.anchor_bar_size ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, anchor_bar_size: e.target.value })}
                    />
                    <select
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      value={String(designInput.governing_rock_condition || 'auto')}
                      onChange={(e) => setDesignInput({ ...designInput, governing_rock_condition: e.target.value })}
                      title="Design basis for socket requirement. Auto will follow logging evidence but may still require review."
                    >
                      <option value="auto">Governing rock condition: Auto (from logging)</option>
                      <option value="hw">Governing rock condition: HW</option>
                      <option value="mw">Governing rock condition: MW</option>
                      <option value="mixed">Governing rock condition: mixed / review</option>
                    </select>
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Max overdrill (m)"
                      inputMode="decimal"
                      value={pileMaxOverdrillRaw}
                      onChange={(e) => setPileMaxOverdrillRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          max_overdrill_m: parseNumberOrNull(pileMaxOverdrillRaw),
                        })
                      }
                    />
                    <textarea
                      className="col-span-2 min-h-[70px] w-full rounded-lg border bg-white p-3 text-sm"
                      placeholder="Approval notes (optional)"
                      value={designInput.approval_notes ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, approval_notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {/* Pile advanced fields intentionally removed from field Setup. */}
              {/* Intentionally no element-type override, status override, reference-RL selector, or workflow flags here.
                  Setup is design requirements only for field use. Admin/debug controls remain internal-only. */}

              {showSetupAdvanced && (effectiveDesignType === 'Anchor' || effectiveDesignType === 'SoilNail') && (
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">
                    {effectiveDesignType === 'SoilNail' ? 'Soil nail design' : 'Anchor design'}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Bonded length (m)"
                      inputMode="decimal"
                      value={anchorBondedRaw}
                      onChange={(e) => setAnchorBondedRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          design_bonded_length_m: parseNumberOrNull(anchorBondedRaw),
                        })
                      }
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Debonded length (m)"
                      inputMode="decimal"
                      value={anchorDebondedRaw}
                      onChange={(e) => setAnchorDebondedRaw(e.target.value)}
                      onBlur={() =>
                        setDesignInput({
                          ...designInput,
                          design_debonded_length_m: parseNumberOrNull(anchorDebondedRaw),
                        })
                      }
                    />
                    <textarea
                      className="col-span-2 min-h-[70px] w-full rounded-lg border bg-white p-3 text-sm"
                      placeholder="Approval notes (optional)"
                      value={designInput.approval_notes ?? ''}
                      onChange={(e) => setDesignInput({ ...designInput, approval_notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Suitability workflow is intentionally removed from field Setup UI (not used in current site workflow). */}
              {false && null /*
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">Suitability (optional)</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="col-span-2 text-[11px] text-zinc-600">
                      Use this section only when a suitability test is required by the design. Keep it concise for field use.
                    </div>

                    <div className="col-span-2 rounded-lg border bg-white p-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Cycle schedule</div>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : []).map((row: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-4 gap-2 rounded-lg border p-2 text-sm">
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="Cycle #"
                              inputMode="numeric"
                              value={row.cycle_no ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : [])];
                                next[idx] = { ...row, cycle_no: Number(e.target.value) };
                                setDesignInput({ ...designInput, cycle_schedule: next });
                              }}
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="% WL"
                              inputMode="decimal"
                              value={row.percent_of_working_load ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : [])];
                                next[idx] = { ...row, percent_of_working_load: toNumberOrNull(e.target.value) };
                                setDesignInput({ ...designInput, cycle_schedule: next });
                              }}
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="Min (min)"
                              inputMode="decimal"
                              value={row.minimum_observation_min ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : [])];
                                next[idx] = { ...row, minimum_observation_min: toNumberOrNull(e.target.value) };
                                setDesignInput({ ...designInput, cycle_schedule: next });
                              }}
                            />
                            <button
                              onClick={() => {
                                const next = [...(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : [])];
                                next.splice(idx, 1);
                                setDesignInput({ ...designInput, cycle_schedule: next });
                              }}
                              className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const next = [...(Array.isArray(designInput.cycle_schedule) ? designInput.cycle_schedule : [])];
                            next.push({ cycle_no: next.length + 1, percent_of_working_load: null, minimum_observation_min: null });
                            setDesignInput({ ...designInput, cycle_schedule: next });
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                        >
                          Add cycle
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2 rounded-lg border bg-white p-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Measurements (load / time / deformation)</div>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : []).map((row: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-4 gap-2 rounded-lg border p-2 text-sm">
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="Load (kN)"
                              inputMode="decimal"
                              value={row.load_kN ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                                next[idx] = { ...row, load_kN: toNumberOrNull(e.target.value) };
                                setDesignInput({ ...designInput, suitability_measurements: next });
                              }}
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="Time (min)"
                              inputMode="decimal"
                              value={row.time_min ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                                next[idx] = { ...row, time_min: toNumberOrNull(e.target.value) };
                                setDesignInput({ ...designInput, suitability_measurements: next });
                              }}
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-sm"
                              placeholder="Def (mm)"
                              inputMode="decimal"
                              value={row.deformation_mm ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                                next[idx] = { ...row, deformation_mm: toNumberOrNull(e.target.value) };
                                setDesignInput({ ...designInput, suitability_measurements: next });
                              }}
                            />
                            <button
                              onClick={() => {
                                const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                                next.splice(idx, 1);
                                setDesignInput({ ...designInput, suitability_measurements: next });
                              }}
                              className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Remove
                            </button>
                            <input
                              className="col-span-4 rounded-lg border px-2 py-1 text-sm"
                              placeholder="Note (optional)"
                              value={row.note ?? ''}
                              onChange={(e) => {
                                const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                                next[idx] = { ...row, note: e.target.value };
                                setDesignInput({ ...designInput, suitability_measurements: next });
                              }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const next = [...(Array.isArray(designInput.suitability_measurements) ? designInput.suitability_measurements : [])];
                            next.push({ load_kN: null, time_min: null, deformation_mm: null, note: '' });
                            setDesignInput({ ...designInput, suitability_measurements: next });
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                        >
                          Add measurement row
                        </button>
                      </div>
                    </div>

                    <label className="col-span-2 flex items-center gap-2 rounded-lg border bg-white p-2 text-sm">
                      <input type="checkbox" checked={Boolean(designInput.test_complete)} onChange={(e) => setDesignInput({ ...designInput, test_complete: e.target.checked })} />
                      Test complete
                    </label>
                    <label className="col-span-2 flex items-center gap-2 rounded-lg border bg-white p-2 text-sm">
                      <input type="checkbox" checked={Boolean(designInput.notify_designer_required)} onChange={(e) => setDesignInput({ ...designInput, notify_designer_required: e.target.checked })} />
                      Notify designer required
                    </label>
                    <textarea className="col-span-2 min-h-[80px] w-full rounded-lg border p-3 text-sm" placeholder="Test note"
                      value={designInput.test_note ?? ''} onChange={(e) => setDesignInput({ ...designInput, test_note: e.target.value })} />
                  </div>
                </div>
              */ }

              <textarea className="min-h-[80px] w-full rounded-lg border p-3 text-sm" placeholder="Approval notes"
                value={designInput.approval_notes ?? ''} onChange={(e) => setDesignInput({ ...designInput, approval_notes: e.target.value })} />
            </div>
          </div>
        )}

        {activeStep === 'Logging' && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-zinc-800">Field Logging</div>
              <div className="text-[11px] text-zinc-500">Intervals grid editor with free text, structured fields, and phrase quick-pick</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <input value={newRecordDate} onChange={(e) => setNewRecordDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Record date (YYYY-MM-DD)" />
              <input value={newRecordMethod} onChange={(e) => setNewRecordMethod(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Method (e.g. Rotary)" />
              <button onClick={createRecord} className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">Add drilling record</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              {records.length === 0 && <div className="text-sm text-zinc-500">No drilling records yet.</div>}
              {records.map((r) => (
                <div key={r.id} className={`rounded-lg border p-2 ${r.id === activeRecordId ? 'border-indigo-400 bg-indigo-50/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setActiveRecordId(r.id)} className="flex flex-col text-left">
                      <div className="text-sm font-semibold text-zinc-800">{r.record_date || '(no date)'}{r.method ? `  /  ${r.method}` : ''}</div>
                      <div className="text-[11px] text-zinc-500">Record id: {r.id.slice(0, 8)}</div>
                    </button>
                    <button onClick={() => deleteRecord(r.id)} className="rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-rose-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-zinc-800">Intervals</div>
                <div className="text-[11px] text-zinc-500">{record ? `Active record: ${record.id.slice(0, 8)}` : 'Select a record'}</div>
              </div>

              {record && (
                <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase text-zinc-600">Record details</div>
                    <button onClick={saveActiveRecordDetails} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">
                      Save record
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={recordStartDate} onChange={(e) => setRecordStartDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Start date (YYYY-MM-DD)" />
                    <input value={recordEndDate} onChange={(e) => setRecordEndDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="End date (YYYY-MM-DD)" />
                    <input value={recordLoggedBy} onChange={(e) => setRecordLoggedBy(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Logged by" />
                    <input value={recordApprovedBy} onChange={(e) => setRecordApprovedBy(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Approved by" />
                    <input value={recordPageCount} onChange={(e) => setRecordPageCount(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Record page count" inputMode="numeric" />
                    <div />
                    <textarea value={recordGeneralNote} onChange={(e) => setRecordGeneralNote(e.target.value)} className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 text-sm" placeholder="General note" />
                  </div>
                </div>
              )}

              <div ref={intervalTopRef} className="mt-3 grid grid-cols-1 gap-3">
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase text-zinc-600">A) Current interval</div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {lastInterval && (
                        <button
                          onClick={() => loadIntervalIntoCurrent(lastInterval, 'next')}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                          title="Use last interval as the next interval (from = last to)"
                        >
                          Next from last
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setNewObs('');
                          setNewMatObs('');
                          setNewMatInt('');
                          setNewTimeMin('');
                          setNewResponses([]);
                          setNewFreeNote('');
                          setNewFinalPhrase('');
                          setNewFinalPhraseEdited(false);
                          setPhraseSel((prev) => ({ ...prev, colour: '', modifier: '', common_phrase: '' }));
                        }}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                        title="Clear the current interval entry"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="From depth (m)" inputMode="decimal" />
                    <input value={newTo} onChange={(e) => setNewTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="To depth (m)" inputMode="decimal" />
                    <input value={newTimeMin} onChange={(e) => setNewTimeMin(e.target.value)} className="col-span-2 rounded-lg border px-3 py-2 text-sm" placeholder="Drilling time (min, optional)" inputMode="decimal" />
                  </div>
                  {lastInterval && (
                    <div className="mt-3 rounded-lg border bg-white p-2 text-[12px] text-zinc-700">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Carry-forward context (soft)</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {!!String((lastInterval as any).material_interpreted || '').trim() && (
                          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                            Suggested interpreted: {String((lastInterval as any).material_interpreted)}
                          </span>
                        )}
                        {!!String((lastInterval as any).water_condition || '').trim() && String((lastInterval as any).water_condition) !== 'not_observed' && (
                          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                            Prev water: {String((lastInterval as any).water_condition).replace(/_/g, ' ')}
                          </span>
                        )}
                        {!!String((lastInterval as any).recovery_type || '').trim() && (
                          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                            Prev recovery: {String((lastInterval as any).recovery_type).replace(/_/g, ' ')}
                          </span>
                        )}
                        {(() => {
                          const resp = (lastInterval as any).drilling_response_json
                            ? parseJsonArray(String((lastInterval as any).drilling_response_json)).map(String).filter(Boolean)
                            : [];
                          return resp.length ? (
                            <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                              Prev response: {resp.slice(0, 3).map((r) => r.replace(/_/g, ' ')).join(', ')}{resp.length > 3 ? '…' : ''}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {!!continuityPrompts.length && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
                          <div className="text-[11px] font-bold uppercase text-amber-900">Continuity prompt</div>
                          <div className="mt-1 grid grid-cols-1 gap-1">
                            {continuityPrompts.map((p) => (
                              <div key={p}>{p}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">B) Returns (what came out)</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      list={`${datalistIdPrefix}-obs`}
                      value={newMatObs}
                      onChange={(e) => setNewMatObs(e.target.value)}
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Material observed (free text or pick)"
                    />
                    <datalist id={`${datalistIdPrefix}-obs`}>
                      {builderOptions.observed_material.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <textarea value={newObs} onChange={(e) => setNewObs(e.target.value)} className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 text-sm" placeholder="Observed notes (free text)" />
                    {!!builderOptions.observed_material.length && (
                      <div className="col-span-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-500">Quick picks</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {builderOptions.observed_material.slice(0, 12).map((t) => (
                            <button
                              key={t}
                              onClick={() => setNewMatObs(t)}
                              className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">C) Conditions</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select value={newWater} onChange={(e) => setNewWater(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="not_observed">Water: not observed</option>
                      <option value="dry">Dry</option>
                      <option value="moist">Moist</option>
                      <option value="wet">Wet</option>
                      <option value="with_water">With water</option>
                      <option value="water_encountered">Water encountered</option>
                      <option value="water_loss">Water loss</option>
                    </select>
                    <select value={newRecoveryType} onChange={(e) => setNewRecoveryType(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="good_return">Recovery: good return</option>
                      <option value="reduced_return">Reduced return</option>
                      <option value="partial_loss">Partial loss</option>
                      <option value="no_return">No return</option>
                      <option value="inconsistent_recovery">Inconsistent</option>
                      <option value="chips">Chips</option>
                      <option value="fine_dust">Fine dust</option>
                      <option value="mixed_return">Mixed return</option>
                    </select>
                    <div className="col-span-2 rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Drilling response</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-zinc-700">
                        {builderOptions.drilling_response.map((t) => {
                          const checked = newResponses.includes(t);
                          return (
                            <label key={t} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setNewResponses((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)));
                                }}
                              />
                              <span>{t}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">D) Interpretation assist</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      list={`${datalistIdPrefix}-int`}
                      value={newMatInt}
                      onChange={(e) => setNewMatInt(e.target.value)}
                      className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Interpreted material (optional)"
                    />
                    <datalist id={`${datalistIdPrefix}-int`}>
                      {builderOptions.interpreted_material.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <select value={newWeathering} onChange={(e) => setNewWeathering(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="not_applicable">Weathering: N/A</option>
                      <option value="rs">RS</option>
                      <option value="xw">XW</option>
                      <option value="hw">HW</option>
                      <option value="mw">MW</option>
                      <option value="sw">SW</option>
                      <option value="fr">FR</option>
                    </select>
                    <select value={newRockType} onChange={(e) => setNewRockType(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="not_applicable">Rock type: N/A</option>
                      <option value="argillite">Argillite</option>
                      <option value="greywacke">Greywacke</option>
                      <option value="granodiorite">Granodiorite</option>
                      <option value="arenite">Arenite</option>
                      <option value="unknown_rock">Unknown rock</option>
                    </select>

                    <textarea
                      value={newFreeNote}
                      onChange={(e) => setNewFreeNote(e.target.value)}
                      className="col-span-2 min-h-[60px] w-full rounded-lg border p-3 text-sm"
                      placeholder="Extra note (optional)"
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">E) Final record line</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="col-span-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-600">Final phrase (field log line)</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setNewFinalPhrase(newAutoPhrase);
                            setNewFinalPhraseEdited(false);
                          }}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                          title="Replace final phrase with the auto-generated phrase"
                        >
                          Use auto
                        </button>
                        <button
                          onClick={() => setShowFinalPhraseAdvanced((v) => !v)}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                          title="Show/hide advanced sentence settings"
                        >
                          Advanced {showFinalPhraseAdvanced ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={newFinalPhrase}
                      onChange={(e) => {
                        setNewFinalPhrase(e.target.value);
                        setNewFinalPhraseEdited(true);
                      }}
                      className="col-span-2 min-h-[90px] w-full rounded-lg border p-3 text-sm"
                      placeholder="Final field log phrase (you can edit freely)"
                    />

                    {!!sentencePatternSuggestions.length && (
                      <div className="col-span-2 rounded-lg border bg-white p-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-500">Sentence suggestions (field-style)</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sentencePatternSuggestions.slice(0, 8).map((p) => (
                            <button
                              key={p.text}
                              onClick={() => {
                                setNewFinalPhrase(p.text);
                                setNewFinalPhraseEdited(true);
                              }}
                              className="rounded-lg border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                              title="Apply wording to final phrase (you can edit after)"
                            >
                              {p.text.length > 42 ? `${p.text.slice(0, 42)}…` : p.text}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-600">
                          These are learned from real interval log lines. Reference notes and borehole wording are excluded here.
                        </div>
                      </div>
                    )}

                    <div className="col-span-2 rounded-lg border bg-zinc-50 p-2 text-[12px] text-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-500">Auto phrase (generated)</div>
                        <button
                          onClick={() => {
                            setNewFinalPhrase(newAutoPhrase);
                            setNewFinalPhraseEdited(false);
                          }}
                          className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                          title="Use the auto phrase as the final phrase"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{newAutoPhrase || '(select values above to build a phrase)'}</div>
                    </div>

                    {showFinalPhraseAdvanced && (
                      <div className="col-span-2 rounded-lg border bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-bold uppercase text-zinc-500">Advanced sentence settings</div>
                          <button
                            onClick={() => {
                              // Allow user to "reset" sentence family back to learned default.
                              setTemplateFamilyTouched(false);
                              setPhraseSel((prev) => ({ ...prev, template_family: preferredTemplateFamily }));
                            }}
                            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            title="Reset sentence family to the learned default for this site/type"
                          >
                            Reset style
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select
                            value={phraseSel.template_family}
                            onChange={(e) => {
                              setTemplateFamilyTouched(true);
                              applyBuilderSelect('template_family', e.target.value as any);
                            }}
                            className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                            title="Sentence template family for the auto-generated phrase"
                          >
                            <option value="mixed">Sentence family: interpreted + recovered (mixed)</option>
                            <option value="interpreted_first">Sentence family: interpreted first</option>
                            <option value="observed_first">Sentence family: recovered first</option>
                            <option value="condition_led">Sentence family: condition-led</option>
                            <option value="rock_transition">Sentence family: rock transition</option>
                            <option value="weak_band">Sentence family: weak band</option>
                          </select>
                          <input
                            list={`${datalistIdPrefix}-colour`}
                            value={phraseSel.colour}
                            onChange={(e) => applyBuilderSelect('colour', e.target.value)}
                            className="rounded-lg border px-3 py-2 text-sm"
                            placeholder="Colour (optional)"
                          />
                          <datalist id={`${datalistIdPrefix}-colour`}>
                            {builderOptions.colour.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                          <input
                            list={`${datalistIdPrefix}-mod`}
                            value={phraseSel.modifier}
                            onChange={(e) => applyBuilderSelect('modifier', e.target.value)}
                            className="rounded-lg border px-3 py-2 text-sm"
                            placeholder="Modifier (optional)"
                          />
                          <datalist id={`${datalistIdPrefix}-mod`}>
                            {builderOptions.modifier.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>

                          <input
                            list={`${datalistIdPrefix}-common`}
                            value={phraseSel.common_phrase}
                            onChange={(e) => applyBuilderSelect('common_phrase', e.target.value)}
                            className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                            placeholder="Common phrase (optional)"
                          />
                          <datalist id={`${datalistIdPrefix}-common`}>
                            {builderOptions.common_phrase.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-600">
                          Advanced affects the auto phrase style. Your final phrase is always editable.
                        </div>
                      </div>
                    )}

                    <button onClick={createInterval} className="col-span-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={!activeRecordId}>
                      Add interval
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-zinc-800">Interval history</div>
                  <div className="flex items-center gap-2">
                    {sortedIntervals.length > 12 && (
                      <button
                        onClick={() => setShowAllIntervalHistory((v) => !v)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                      >
                        {showAllIntervalHistory ? 'Collapse' : `Show all (${sortedIntervals.length})`}
                      </button>
                    )}
                    <div className="text-[11px] text-zinc-500">Edit, duplicate, insert, or delete past intervals</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {sortedIntervals.length === 0 && <div className="text-sm text-zinc-500">No intervals yet.</div>}
                  {displayedIntervals.map((it) => {
                    const fullIdx = sortedIntervals.findIndex((x) => x.id === it.id);
                    const nextIt = fullIdx >= 0 && fullIdx + 1 < sortedIntervals.length ? sortedIntervals[fullIdx + 1] : null;
                    const resp = (it as any).drilling_response_json ? parseJsonArray((it as any).drilling_response_json).map(String).filter(Boolean) : [];
                    const water = String((it as any).water_condition || '').trim();
                    const recovery = String((it as any).recovery_type || '').trim();
                    const wth = String((it as any).weathering_class || '').trim();
                    const rock = String((it as any).rock_type || '').trim();
                    const tmin = (it as any).drilling_time_min;
                    return (
                      <div key={it.id} className="rounded-lg border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <div className="text-sm font-semibold text-zinc-800">{it.from_depth_m} to {it.to_depth_m} m</div>
                            <div className="text-[12px] text-zinc-700 whitespace-pre-wrap">
                              {(it.logging_phrase_output as any) || it.observed_text || '(no phrase yet)'}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tmin != null && Number.isFinite(tmin) && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">{tmin} min</span>}
                              {water && water !== 'not_observed' && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">{water.replace(/_/g, ' ')}</span>}
                              {recovery && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{recovery.replace(/_/g, ' ')}</span>}
                              {wth && wth !== 'not_applicable' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{wth.toUpperCase()}</span>}
                              {rock && rock !== 'not_applicable' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{rock}</span>}
                              {!!resp.length && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">{resp.join(', ')}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => beginEditInterval(it)}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => loadIntervalIntoCurrent(it, 'duplicate')}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              title="Copy this interval back into the current interval form (includes depths/conditions)"
                            >
                              Duplicate interval
                            </button>
                            <button
                              onClick={() => reuseWordingFromInterval(it)}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              title="Bring this interval wording + sentence style into the current editor (does not change depths/conditions)"
                            >
                              Reuse wording
                            </button>
                            <button
                              onClick={() => loadIntervalIntoCurrent(it, 'next')}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              title="Create the next interval starting at this interval end depth"
                            >
                              Next
                            </button>
                            <button
                              onClick={() => loadIntervalIntoCurrent(it, 'insert_after', nextIt)}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              title="Insert an interval after this one (depths set between this and next interval when possible)"
                            >
                              Insert
                            </button>
                            <button
                              onClick={() => deleteInterval(it.id)}
                              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                    {editingIntervalId === it.id && (
                      <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-bold uppercase text-zinc-600">Edit interval</div>
                          <div className="flex gap-2">
                            <button onClick={cancelEditInterval} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Cancel</button>
                            <button onClick={saveEditInterval} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">Save</button>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input value={editFrom} onChange={(e) => setEditFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="From (m)" inputMode="decimal" />
                          <input value={editTo} onChange={(e) => setEditTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="To (m)" inputMode="decimal" />
                          <input value={editTimeMin} onChange={(e) => setEditTimeMin(e.target.value)} className="col-span-2 rounded-lg border px-3 py-2 text-sm" placeholder="Time (min, optional)" inputMode="decimal" />
                          <textarea value={editObs} onChange={(e) => setEditObs(e.target.value)} className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 text-sm" placeholder="Observed (free text)" />
                          <input value={editMatObs} onChange={(e) => setEditMatObs(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Material observed" />
                          <input value={editMatInt} onChange={(e) => setEditMatInt(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Material interpreted" />
                          <select value={editWeathering} onChange={(e) => setEditWeathering(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                            <option value="not_applicable">Weathering: N/A</option>
                            <option value="rs">RS</option>
                            <option value="xw">XW</option>
                            <option value="hw">HW</option>
                            <option value="mw">MW</option>
                            <option value="sw">SW</option>
                            <option value="fr">FR</option>
                          </select>
                          <select value={editWater} onChange={(e) => setEditWater(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                            <option value="not_observed">Water: not observed</option>
                            <option value="dry">Dry</option>
                            <option value="moist">Moist</option>
                            <option value="wet">Wet</option>
                            <option value="with_water">With water</option>
                            <option value="water_encountered">Water encountered</option>
                            <option value="water_loss">Water loss</option>
                          </select>
                          <select value={editRockType} onChange={(e) => setEditRockType(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                            <option value="not_applicable">Rock type: N/A</option>
                            <option value="argillite">Argillite</option>
                            <option value="greywacke">Greywacke</option>
                            <option value="granodiorite">Granodiorite</option>
                            <option value="arenite">Arenite</option>
                            <option value="unknown_rock">Unknown rock</option>
                          </select>
                          <select value={editRecoveryType} onChange={(e) => setEditRecoveryType(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                            <option value="good_return">Recovery: good return</option>
                            <option value="reduced_return">Reduced return</option>
                            <option value="partial_loss">Partial loss</option>
                            <option value="no_return">No return</option>
                            <option value="inconsistent_recovery">Inconsistent</option>
                            <option value="chips">Chips</option>
                            <option value="fine_dust">Fine dust</option>
                            <option value="mixed_return">Mixed return</option>
                          </select>
                          <textarea value={editFreeNote} onChange={(e) => setEditFreeNote(e.target.value)} className="col-span-2 min-h-[60px] w-full rounded-lg border p-3 text-sm" placeholder="Free note" />
                          <div className="col-span-2 rounded-lg border bg-white p-2">
                            <div className="text-[11px] font-bold uppercase text-zinc-500">Drilling response</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-zinc-700">
                              {Array.from(
                                new Set([
                                  ...builderOptions.drilling_response,
                                  ...editResponses.map((r) => String(r).trim()).filter(Boolean),
                                ])
                              ).map((t) => {
                                const checked = editResponses.includes(t);
                                return (
                                  <label key={t} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setEditResponses((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)));
                                      }}
                                    />
                                    <span>{t}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <div className="col-span-2 rounded-lg border bg-white p-2">
                            <div className="text-[11px] font-bold uppercase text-zinc-500">Phrase quick-pick</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {phrases.slice(0, 18).map((phrase) => (
                                <button
                                  key={phrase.id}
                                  onClick={() => appendPhrase(phrase.category, phrase.text, 'edit')}
                                  className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                                >
                                  {phrase.text}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="col-span-2 rounded-lg border bg-white p-2 text-[11px] text-zinc-700">
                            <div className="font-bold uppercase text-zinc-500">Auto phrase preview</div>
                            <div className="mt-1 whitespace-pre-wrap">
                              {(() => {
                                const auto = buildIntervalSentence({
                                  template_family: 'mixed',
                                  observed_material: editMatObs || '',
                                  interpreted_material: editMatInt || '',
                                  colour: '',
                                  modifier: '',
                                  water: editWater !== 'not_observed' ? editWater.replace(/_/g, ' ') : '',
                                  recovery: editRecoveryType ? editRecoveryType.replace(/_/g, ' ') : '',
                                  drilling_response: editResponses.length ? editResponses.map((r) => r.replace(/_/g, ' ')).join(', ') : '',
                                  weathering: editWeathering !== 'not_applicable' ? String(editWeathering).toUpperCase() : '',
                                  rock_type: editRockType !== 'not_applicable' ? String(editRockType) : '',
                                  common_phrase: '',
                                });
                                return auto || '(none)';
                              })()}
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center justify-between gap-2">
                            <div className="text-[11px] font-bold uppercase text-zinc-500">Final phrase (editable)</div>
                            <button
                              onClick={() => {
                                const auto = buildIntervalSentence({
                                  template_family: 'mixed',
                                  observed_material: editMatObs || '',
                                  interpreted_material: editMatInt || '',
                                  colour: '',
                                  modifier: '',
                                  water: editWater !== 'not_observed' ? editWater.replace(/_/g, ' ') : '',
                                  recovery: editRecoveryType ? editRecoveryType.replace(/_/g, ' ') : '',
                                  drilling_response: editResponses.length ? editResponses.map((r) => r.replace(/_/g, ' ')).join(', ') : '',
                                  weathering: editWeathering !== 'not_applicable' ? String(editWeathering).toUpperCase() : '',
                                  rock_type: editRockType !== 'not_applicable' ? String(editRockType) : '',
                                  common_phrase: '',
                                });
                                setEditFinalPhrase(auto);
                              }}
                              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              title="Replace final phrase with the auto-generated phrase"
                            >
                              Use auto
                            </button>
                          </div>
                          <textarea
                            value={editFinalPhrase}
                            onChange={(e) => setEditFinalPhrase(e.target.value)}
                            className="col-span-2 min-h-[90px] w-full rounded-lg border p-3 text-sm"
                            placeholder="Final field log phrase (editable)"
                          />
                        </div>
                      </div>
                    )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-zinc-800">Field events</div>
                <button onClick={addFieldEvent} className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700">
                  Add event
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={newEventDateTime} onChange={(e) => setNewEventDateTime(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Datetime (optional)" />
                <input value={newEventCategory} onChange={(e) => setNewEventCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Category (optional)" />
                <input value={newEventDepth} onChange={(e) => setNewEventDepth(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Depth m (optional)" inputMode="decimal" />
                <div />
                <textarea value={newEventNote} onChange={(e) => setNewEventNote(e.target.value)} className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 text-sm" placeholder="Event note (required)" />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {fieldEvents.length === 0 && <div className="text-sm text-zinc-500">No field events yet.</div>}
                {fieldEvents.map((ev) => (
                  <div key={ev.id} className="rounded-lg border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-zinc-800">
                          {(ev.event_datetime || '').trim() || (ev.updated_at ? new Date(ev.updated_at).toLocaleString() : 'Event')}
                          {ev.category ? ` / ${ev.category}` : ''}
                          {ev.depth_m != null ? ` @ ${ev.depth_m.toFixed(2)} m` : ''}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-[12px] text-zinc-700">{ev.note || '-'}</div>
                      </div>
                      <button
                        onClick={() => removeFieldEvent(ev.id)}
                        className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeStep === 'Interpretation' && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-zinc-800">Interpretation</div>
              <button
                onClick={saveInterpretation}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700"
              >
                Save
              </button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">
              Confirm ToR and rock continuity from field observations. Report/geophysics data is reference-only.
            </div>

            <div className="mt-3 rounded-lg border bg-amber-50 p-3 text-[12px] text-amber-900">
              <div className="text-[11px] font-bold uppercase text-amber-900">Interpretation guide</div>
              <div className="mt-2 grid grid-cols-1 gap-1">
                <div><span className="font-semibold">ToR</span>: first meaningful transition into rock/weathered rock used for design reference.</div>
                <div><span className="font-semibold">Continuous rock start</span>: where competent rock becomes continuous (not isolated chips).</div>
                <div><span className="font-semibold">Weak band</span>: softer interbed within rock that can reduce competent socket.</div>
              </div>
            </div>

            {phrases.some((p) => String(p.category || '').trim() === 'interpretation_hint') && (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-600">Site interpretation hints (reference)</div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-zinc-700">
                  {phrases
                    .filter((p) => String(p.category || '').trim() === 'interpretation_hint')
                    .slice(0, 4)
                    .map((p) => (
                      <div key={p.id}>• {String(p.text || '').trim()}</div>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-600">ToR confirmation</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border bg-white p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Reference ToR</div>
                  <div className="font-semibold text-zinc-800">
                    {torCard.referenceTorDepthM != null ? `${torCard.referenceTorDepthM.toFixed(2)} m` : '-'}
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Actual ToR</div>
                  <div className="font-semibold text-zinc-800">{torCard.actualTorDepthM != null ? `${torCard.actualTorDepthM.toFixed(2)} m` : '-'}</div>
                </div>
                <div className="rounded-lg border bg-white p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Variance</div>
                  <div className="font-semibold text-zinc-800">{torCard.varianceM != null ? `${torCard.varianceM.toFixed(2)} m` : '-'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-white p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Variance classification</div>
                  <select
                    value={interpVarianceClass}
                    onChange={(e) => setInterpVarianceClass(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    title="Structured classification of reference vs actual ToR"
                  >
                    <option value="within_range">Matches reference (±0.5 m)</option>
                    <option value="slightly_deeper">Deeper than reference (slight)</option>
                    <option value="significantly_deeper">Deeper than reference (significant)</option>
                    <option value="shallower_than_expected">Shallower than reference</option>
                    <option value="inconsistent_with_reference">Inconsistent / reference unclear</option>
                  </select>
                </div>
                <div className="rounded-lg border bg-white p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Interpretation confidence</div>
                  <select
                    value={interpConfidence}
                    onChange={(e) => setInterpConfidence(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    title="Engineering confidence in ToR and continuity interpretation"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 rounded-lg border bg-white p-2 text-[12px] text-zinc-700">
                <div className="text-[11px] font-bold uppercase text-zinc-500">Reliability hints</div>
                <div className="mt-1 grid grid-cols-1 gap-1">
                  {interpVarianceClass === 'within_range' && <div>Reference and actual ToR broadly align.</div>}
                  {interpVarianceClass !== 'within_range' && <div>Actual ToR differs from reference. Consider variance reasons and confidence.</div>}
                  {interpConfidence === 'low' && <div>Low confidence: engineer review is recommended before acting on verification.</div>}
                  {interpWeakBands.length > 0 && <div>Weak bands recorded: may reduce competent socket / continuity confidence.</div>}
                  {intervals.length < 2 && <div>Limited logging evidence: add more intervals to support ToR interpretation.</div>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Reference ToR (m, optional)"
                  inputMode="decimal"
                  value={interpReferenceTorDepth}
                  onChange={(e) => setInterpReferenceTorDepth(e.target.value)}
                />
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Reference velocity (m/s, optional)"
                  inputMode="decimal"
                  value={interpReferenceTorVelocity}
                  onChange={(e) => setInterpReferenceTorVelocity(e.target.value)}
                />
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Actual ToR (m)"
                  inputMode="decimal"
                  value={interpActualTorDepth}
                  onChange={(e) => setInterpActualTorDepth(e.target.value)}
                />
                <button
                  onClick={() => {
                    const inferred = computeTorCard({ reference_tor_depth_m: null, actual_tor_depth_m: null } as any, intervals).actualTorDepthM;
                    if (inferred != null) setInterpActualTorDepth(String(inferred));
                    else alert('No inferred ToR found from intervals.');
                  }}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  Use inferred ToR
                </button>
                <input
                  className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                  placeholder="Continuous rock start (m, optional)"
                  inputMode="decimal"
                  value={interpContinuousRockStart}
                  onChange={(e) => setInterpContinuousRockStart(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-600">Weak bands (competent socket deductions)</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {interpWeakBands.length === 0 && <div className="text-sm text-zinc-500">No weak bands recorded.</div>}
                {interpWeakBands.map((w, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 rounded-lg border bg-zinc-50 p-2">
                    <input
                      className="col-span-2 rounded-lg border px-2 py-1 text-sm"
                      placeholder="From (m)"
                      inputMode="decimal"
                      value={w.from_m}
                      onChange={(e) => {
                        const next = [...interpWeakBands];
                        next[idx] = { ...next[idx], from_m: e.target.value };
                        setInterpWeakBands(next);
                      }}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-2 py-1 text-sm"
                      placeholder="To (m)"
                      inputMode="decimal"
                      value={w.to_m}
                      onChange={(e) => {
                        const next = [...interpWeakBands];
                        next[idx] = { ...next[idx], to_m: e.target.value };
                        setInterpWeakBands(next);
                      }}
                    />
                    <input
                      className="col-span-2 rounded-lg border px-2 py-1 text-sm"
                      placeholder="Note (optional)"
                      value={w.note}
                      onChange={(e) => {
                        const next = [...interpWeakBands];
                        next[idx] = { ...next[idx], note: e.target.value };
                        setInterpWeakBands(next);
                      }}
                    />
                    <button
                      onClick={() => {
                        const next = [...interpWeakBands];
                        next.splice(idx, 1);
                        setInterpWeakBands(next);
                      }}
                      className="col-span-6 rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                    >
                      Remove band
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setInterpWeakBands((prev) => [...prev, { from_m: '', to_m: '', note: '' }])}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                >
                  Add weak band
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-600">Variance reasons</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {INTERP_VARIANCE_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={interpVarianceReasons.includes(r)}
                      onChange={(e) => {
                        setInterpVarianceReasons((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)));
                      }}
                    />
                    <span className="text-[12px] text-zinc-700">{r}</span>
                  </label>
                ))}
              </div>
              <input
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Other reason (optional)"
                value={interpVarianceOther}
                onChange={(e) => setInterpVarianceOther(e.target.value)}
              />
            </div>

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-600">Confidence and summary</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select value={interpConfidence} onChange={(e) => setInterpConfidence(e.target.value as any)} className="col-span-2 rounded-lg border px-3 py-2 text-sm">
                  <option value="high">Confidence: high</option>
                  <option value="medium">Confidence: medium</option>
                  <option value="low">Confidence: low</option>
                </select>
                <textarea
                  className="col-span-2 min-h-[90px] w-full rounded-lg border p-3 text-sm"
                  placeholder="Interpretation summary (field-friendly)"
                  value={interpSummary}
                  onChange={(e) => setInterpSummary(e.target.value)}
                />
                <button
                  onClick={() => setShowInterpretationAdvanced((v) => !v)}
                  className="col-span-2 rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  {showInterpretationAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
                {showInterpretationAdvanced && (
                  <>
                    <textarea className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 font-mono text-[11px]" value={interpReasonsJson} onChange={(e) => setInterpReasonsJson(e.target.value)} />
                    <textarea className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 font-mono text-[11px]" value={interpWeakBandsJson} onChange={(e) => setInterpWeakBandsJson(e.target.value)} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeStep === 'Reference' && (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="text-sm font-bold text-zinc-800">Site knowledge base</div>
              <div className="text-[11px] text-zinc-600">
                A project-maintained field library (terms, phrases, notes, borehole highlights). Reference-only; field observations remain the source of truth.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setReferenceAdminMode((v) => !v)}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
              >
                {referenceAdminMode ? 'Field mode' : 'Admin mode'}
              </button>
              {referenceAdminMode && (
                <button
                  onClick={exportReferenceTemplate}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  title="Export the Project maintained reference as a reusable JSON template (no drilling records/photos)."
                >
                  Export template
                </button>
              )}
              {referenceAdminMode && (
                <button
                  onClick={startImportReferenceTemplate}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  title="Import a JSON reference template (preview before applying)."
                >
                  Import template
                </button>
              )}
              {referenceAdminMode && (
                <button
                  onClick={() => void applySeedToProjectReference('reset_to_seed')}
                  disabled={!seededGroundReference}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                  title={seededGroundReference ? 'Overwrite project reference with seeded site default' : 'No seeded default available for this site'}
                >
                  Reset to seed
                </button>
              )}
              {referenceAdminMode && (
                <button
                  onClick={saveGroundReference}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          <input
            ref={importRefTemplateInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => void onImportReferenceTemplateFile(e.target.files?.[0] ?? null)}
          />

          {referenceAdminMode && (
            <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <div className="text-[11px] font-bold uppercase text-zinc-700">Reference templates</div>
                  <div className="text-[11px] text-zinc-600">Reusable project knowledge packages (ground model + phrase library + evidence notes).</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={starterTemplateId}
                    onChange={(e) => setStarterTemplateId(e.target.value)}
                    className="min-w-[260px] rounded-lg border bg-white px-3 py-2 text-sm"
                    title="Starter templates are editable after loading."
                  >
                    <option value="">Load starter template...</option>
                    {SITE_LOGGING_STARTER_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadStarterReferenceTemplate}
                    disabled={!starterTemplateId}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
              </div>

              {pendingRefTemplate && (
                <div className="mt-3 rounded-lg border bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="text-sm font-bold text-zinc-800">Pending template: {pendingRefTemplate.template_name}</div>
                      <div className="text-[11px] text-zinc-600">
                        Preview then apply. Does not import drilling records, photos, verification, or closeout.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={pendingRefTemplateMode}
                        onChange={(e) => setPendingRefTemplateMode(e.target.value as any)}
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                        title="How to apply this template into the Project maintained reference."
                      >
                        <option value="merge">Apply mode: merge</option>
                        <option value="replace">Apply mode: replace</option>
                        <option value="phrases_only">Apply mode: phrases only</option>
                        <option value="ground_only">Apply mode: ground model only</option>
                      </select>
                      <button
                        onClick={() => setPendingRefTemplate(null)}
                        className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void applyPendingReferenceTemplate()}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] uppercase text-zinc-500">Phrases</div>
                      <div className="font-semibold text-zinc-800">{pendingRefTemplate.phrase_library.phrases.length}</div>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] uppercase text-zinc-500">Calibrations</div>
                      <div className="font-semibold text-zinc-800">{pendingRefTemplate.evidence.borehole_calibrations.length}</div>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] uppercase text-zinc-500">Evidence notes</div>
                      <div className="font-semibold text-zinc-800">{pendingRefTemplate.evidence.references.length}</div>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] uppercase text-zinc-500">Ground units</div>
                      <div className="font-semibold text-zinc-800">{pendingRefTemplate.ground_model.geotechnical_units.length}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setShowPendingRefTemplateDetails((v) => !v)}
                      className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                    >
                      {showPendingRefTemplateDetails ? 'Hide details' : 'Show details'}
                    </button>
                    <div className="text-[11px] text-zinc-600">Existing reference is unchanged until Apply is pressed.</div>
                  </div>

                  {showPendingRefTemplateDetails && (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div className="rounded-lg border bg-white p-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-600">Ground model summary</div>
                        <div className="mt-1 text-[12px] text-zinc-700">
                          Risks: {pendingRefTemplate.ground_model.risk_flags.length}; Upper profile notes: {pendingRefTemplate.ground_model.expected_material_above_tor.length}; Lower profile notes: {pendingRefTemplate.ground_model.expected_material_below_tor.length}; Site notes: {String(pendingRefTemplate.ground_model.site_notes || '').trim() ? 'included' : 'none'}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-white p-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-600">Phrase preview (first 12)</div>
                        <div className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-zinc-700">
                          {pendingRefTemplate.phrase_library.phrases.slice(0, 12).map((p, idx) => (
                            <div key={idx}>
                              <span className="font-mono text-[11px] text-zinc-500">{String(p.category)}:</span> {String(p.text)}
                            </div>
                          ))}
                          {pendingRefTemplate.phrase_library.phrases.length > 12 && (
                            <div className="text-[11px] text-zinc-500">…and {pendingRefTemplate.phrase_library.phrases.length - 12} more</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!referenceAdminMode && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-[12px] text-indigo-900">
                <div className="text-[11px] font-bold uppercase text-indigo-900">Field mode (read-only)</div>
                <div className="mt-1">
                  This is site-level guidance only. Field observations and measured depths remain the source of truth.
                  Use <span className="font-semibold">Admin mode</span> to maintain the Project reference before or during works.
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">Seeded site default (report extract)</div>
                  <button
                    onClick={() => void applySeedToProjectReference('apply_seed')}
                    disabled={!seededGroundReference}
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                    title={seededGroundReference ? 'Apply seeded site default into the Project maintained reference' : 'No seeded default available for this site'}
                  >
                    Apply seed to project reference
                  </button>
                </div>
                {(() => {
                  const seed: any = seededGroundReference as any;
                  if (!seed) return <div className="mt-2 text-sm text-zinc-500">No seeded default exists for this site.</div>;
                  const units = parseJsonArray(String(seed.geotechnical_units_json ?? '[]'));
                  const risks = parseJsonArray(String(seed.site_risk_flags_json ?? '[]'));
                  const notes = String(seed.reference_notes ?? '').trim();
                  return (
                    <div className="mt-2 grid grid-cols-1 gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-zinc-500">Geology terms (seeded)</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {units.length === 0 && <div className="text-sm text-zinc-500">No units in seeded default.</div>}
                          {units.slice(0, 10).map((u: any) => (
                            <span key={String(u)} className="rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-semibold text-zinc-700">
                              {String(u)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!!risks.length && (
                        <div>
                          <div className="text-[11px] font-bold uppercase text-zinc-500">Site tags / risks (seeded)</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {risks.slice(0, 12).map((r: any) => (
                              <span key={String(r)} className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-900">
                                {String(r)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {notes && (
                        <div className="rounded-lg border bg-zinc-50 p-2 text-[12px] text-zinc-700 whitespace-pre-wrap">
                          {notes}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="mt-2 text-[11px] text-zinc-600">
                  Seeded defaults are derived from reports for startup guidance. They should be reviewed and refined into the Project reference when needed.
                </div>
              </div>

              <div className="rounded-lg border bg-zinc-50 p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-600">Project maintained reference (editable in Admin mode)</div>
                <div className="mt-1 text-[11px] text-zinc-600">
                  This is the team-maintained site reference layer. Update it in Admin mode; use it as guidance in the field.
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-600">1) Ground model (guidance only)</div>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Common materials (from reports + past logs)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {parseJsonArray(groundRefUnitsJson).length === 0 && <div className="text-sm text-zinc-500">No units recorded for this site.</div>}
                      {parseJsonArray(groundRefUnitsJson).map((u) => (
                        <span key={String(u)} className="rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-semibold text-zinc-700">
                          {String(u)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Key site risks</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {parseJsonArray(groundRefRiskFlagsJson).length === 0 && <div className="text-sm text-zinc-500">No risks flagged.</div>}
                      {parseJsonArray(groundRefRiskFlagsJson).map((r) => (
                        <span key={String(r)} className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-900">
                          {String(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {groundRefNotes?.trim() && (
                    <div>
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Short field note</div>
                      <div className="mt-2 rounded-lg border bg-zinc-50 p-2 text-[12px] text-zinc-700 whitespace-pre-wrap">
                        {groundRefNotes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-600">2) Logging library (tap to apply)</div>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Observed material</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.observed_material.slice(0, 10).map((t) => (
                        <button
                          key={`obs-${t}`}
                          onClick={() => applyReferencePhraseToLogging('observed_material', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Observed)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.observed_material.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Interpreted material</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.interpreted_material.slice(0, 10).map((t) => (
                        <button
                          key={`int-${t}`}
                          onClick={() => applyReferencePhraseToLogging('interpreted_material', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Interpreted)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.interpreted_material.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Rock type</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {builderOptions.rock_type.slice(0, 10).map((t) => (
                          <button
                            key={`rock-${t}`}
                            onClick={() => applyReferencePhraseToLogging('rock_type', t)}
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                            title="Apply to current interval (Rock type)"
                          >
                            {t}
                          </button>
                        ))}
                        {builderOptions.rock_type.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Weathering</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {builderOptions.weathering.slice(0, 10).map((t) => (
                          <button
                            key={`wth-${t}`}
                            onClick={() => applyReferencePhraseToLogging('weathering', t)}
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                            title="Apply to current interval (Weathering)"
                          >
                            {t}
                          </button>
                        ))}
                        {builderOptions.weathering.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Colour</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {builderOptions.colour.slice(0, 8).map((t) => (
                          <button
                            key={`col-${t}`}
                            onClick={() => applyReferencePhraseToLogging('colour', t)}
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                            title="Apply to phrase builder (Colour)"
                          >
                            {t}
                          </button>
                        ))}
                        {builderOptions.colour.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-zinc-500">Modifiers</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {builderOptions.modifier.slice(0, 10).map((t) => (
                          <button
                            key={`mod-${t}`}
                            onClick={() => applyReferencePhraseToLogging('modifier', t)}
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                            title="Apply to phrase builder (Modifier)"
                          >
                            {t}
                          </button>
                        ))}
                        {builderOptions.modifier.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Conditions (water / recovery / drilling response)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.water.slice(0, 6).map((t) => (
                        <button
                          key={`water-${t}`}
                          onClick={() => applyReferencePhraseToLogging('water', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Water)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.recovery.slice(0, 6).map((t) => (
                        <button
                          key={`rec-${t}`}
                          onClick={() => applyReferencePhraseToLogging('recovery', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Recovery)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.drilling_response.slice(0, 6).map((t) => (
                        <button
                          key={`resp-${t}`}
                          onClick={() => applyReferencePhraseToLogging('drilling_response', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Drilling response)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.water.length === 0 &&
                        builderOptions.recovery.length === 0 &&
                        builderOptions.drilling_response.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Common final phrases</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.common_phrase.slice(0, 10).map((t) => (
                        <button
                          key={`common-${t}`}
                          onClick={() => applyReferencePhraseToLogging('common_phrase', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to phrase builder (Common phrase)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.common_phrase.length === 0 && <div className="text-sm text-zinc-500">No phrases yet.</div>}
                    </div>
                  </div>
                </div>
              </div>

              {false && null /* legacy duplicate logging-library block (removed in favour of the compact 4-block Reference layout)
              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">2) Logging description library</div>
                  <button
                    onClick={() => setActiveStep('Logging')}
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                    title="Jump to Logging"
                  >
                    Use in logging
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Observed material</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.observed_material.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          onClick={() => applyReferencePhraseToLogging('observed_material', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Observed material)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.observed_material.length === 0 && <div className="text-sm text-zinc-500">No site phrases yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Interpreted material</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.interpreted_material.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          onClick={() => applyReferencePhraseToLogging('interpreted_material', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Interpreted material)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.interpreted_material.length === 0 && <div className="text-sm text-zinc-500">No site phrases yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Colour and weathering</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.colour.slice(0, 8).map((t) => (
                        <button key={`colour-${t}`} onClick={() => applyReferencePhraseToLogging('colour', t)} className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50">{t}</button>
                      ))}
                      {builderOptions.weathering.slice(0, 8).map((t) => (
                        <button key={`weathering-${t}`} onClick={() => applyReferencePhraseToLogging('weathering', t)} className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50">{t}</button>
                      ))}
                      {builderOptions.colour.length === 0 && builderOptions.weathering.length === 0 && <div className="text-sm text-zinc-500">No colour or weathering phrases yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Recovery / water / drilling response</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.water.slice(0, 6).map((t) => (
                        <button
                          key={`water-${t}`}
                          onClick={() => applyReferencePhraseToLogging('water', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Water)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.recovery.slice(0, 6).map((t) => (
                        <button
                          key={`recovery-${t}`}
                          onClick={() => applyReferencePhraseToLogging('recovery', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Recovery)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.drilling_response.slice(0, 6).map((t) => (
                        <button
                          key={`resp-${t}`}
                          onClick={() => applyReferencePhraseToLogging('drilling_response', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to current interval (Drilling response)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.water.length === 0 && builderOptions.recovery.length === 0 && builderOptions.drilling_response.length === 0 && (
                        <div className="text-sm text-zinc-500">No site phrases yet.</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Modifier phrases</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.modifier.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          onClick={() => applyReferencePhraseToLogging('modifier', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to phrase builder (Modifier)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.modifier.length === 0 && <div className="text-sm text-zinc-500">No site phrases yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Common final phrases</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {builderOptions.common_phrase.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          onClick={() => applyReferencePhraseToLogging('common_phrase', t)}
                          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          title="Apply to phrase builder (Common phrase)"
                        >
                          {t}
                        </button>
                      ))}
                      {builderOptions.common_phrase.length === 0 && <div className="text-sm text-zinc-500">No site phrases yet.</div>}
                    </div>
                  </div>
                </div>
              </div>
              */ }

              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase text-zinc-600">3) Report / investigation notes</div>
                  <button
                    onClick={() => setShowReferenceNotes((v) => !v)}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    {showReferenceNotes ? 'Hide notes' : 'Show notes'}
                  </button>
                </div>
                {!showReferenceNotes ? (
                  <div className="mt-2 text-sm text-zinc-500">Collapsed by default. Open only when you need borehole or geophysics context.</div>
                ) : (
                  <div className="mt-2 grid grid-cols-1 gap-3">
                    <div className="rounded-lg border bg-zinc-50 p-2 text-[12px] text-zinc-700">
                      Report and investigation notes are reference only. Do not let them override field observations.
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <div className="text-[11px] font-bold uppercase text-zinc-600">Borehole calibration highlights</div>
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-[520px] w-full text-sm">
                          <thead className="bg-white">
                            <tr className="text-left text-[11px] uppercase text-zinc-500">
                              <th className="px-2 py-1">BH</th>
                              <th className="px-2 py-1">ToR</th>
                              <th className="px-2 py-1">Velocity</th>
                              <th className="px-2 py-1">Diff</th>
                              <th className="px-2 py-1">Conf</th>
                            </tr>
                          </thead>
                          <tbody>
                            {boreholeCalibrations.length === 0 && (
                              <tr><td className="px-2 py-2 text-zinc-500" colSpan={5}>No calibration rows.</td></tr>
                            )}
                            {boreholeCalibrations.slice(0, 8).map((row) => (
                              <tr key={row.id} className="border-t">
                                <td className="px-2 py-1 font-semibold text-zinc-800">{row.borehole_id}</td>
                                <td className="px-2 py-1 text-zinc-700">{row.borehole_tor_depth_m_bgl ?? '-'}</td>
                                <td className="px-2 py-1 text-zinc-700">{row.srt_velocity_at_tor_ms ?? '-'}</td>
                                <td className="px-2 py-1 text-zinc-700">{row.difference_geophysics_minus_borehole_m ?? '-'}</td>
                                <td className="px-2 py-1 text-zinc-700">{row.confidence ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold uppercase text-zinc-600">Reference phrases snapshot</div>
                        <button
                          onClick={() => navigate('/site-logging/library')}
                          className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                        >
                          Open library
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {phrases.slice(0, 18).map((phrase) => (
                          <span key={phrase.id} className="rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-semibold text-zinc-700">
                            {phrase.text}
                          </span>
                        ))}
                        {phrases.length === 0 && <div className="text-sm text-zinc-500">No phrases found.</div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {referenceAdminMode && (<>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="col-span-2 rounded-lg border bg-zinc-50 p-2">
              <div className="text-[11px] font-bold uppercase text-zinc-500">Geotechnical units</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {parseJsonArray(groundRefUnitsJson).length === 0 && (
                  <div className="text-sm text-zinc-500">No units recorded.</div>
                )}
                {parseJsonArray(groundRefUnitsJson).map((unit) => (
                  <button
                    key={String(unit)}
                    onClick={() => {
                      const next = parseJsonArray(groundRefUnitsJson).map(String).filter((u) => u !== String(unit));
                      setGroundRefUnitsJson(JSON.stringify(next));
                    }}
                    className="rounded-full border bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    title="Remove"
                  >
                    {String(unit)} <span className="text-zinc-400">×</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={groundRefUnitDraft}
                  onChange={(e) => setGroundRefUnitDraft(e.target.value)}
                  className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="Add unit (e.g. Colluvium)"
                />
                <button
                  onClick={() => {
                    const v = String(groundRefUnitDraft || '').trim();
                    if (!v) return;
                    const next = [...new Set([...parseJsonArray(groundRefUnitsJson).map(String), v].map((s) => s.trim()).filter(Boolean))];
                    setGroundRefUnitsJson(JSON.stringify(next));
                    setGroundRefUnitDraft('');
                  }}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="col-span-2 rounded-lg border bg-zinc-50 p-2">
              <div className="text-[11px] font-bold uppercase text-zinc-500">Site risk flags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {parseJsonArray(groundRefRiskFlagsJson).length === 0 && (
                  <div className="text-sm text-zinc-500">No risks flagged.</div>
                )}
                {parseJsonArray(groundRefRiskFlagsJson).map((flag) => (
                  <button
                    key={String(flag)}
                    onClick={() => {
                      const next = parseJsonArray(groundRefRiskFlagsJson).map(String).filter((f) => f !== String(flag));
                      setGroundRefRiskFlagsJson(JSON.stringify(next));
                    }}
                    className="rounded-full border bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
                    title="Remove"
                  >
                    {String(flag)} <span className="text-amber-700/60">×</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={groundRefRiskDraft}
                  onChange={(e) => setGroundRefRiskDraft(e.target.value)}
                  className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="Add risk (e.g. groundwater influence)"
                />
                <button
                  onClick={() => {
                    const v = String(groundRefRiskDraft || '').trim();
                    if (!v) return;
                    const next = [...new Set([...parseJsonArray(groundRefRiskFlagsJson).map(String), v].map((s) => s.trim()).filter(Boolean))];
                    setGroundRefRiskFlagsJson(JSON.stringify(next));
                    setGroundRefRiskDraft('');
                  }}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  Add
                </button>
              </div>
            </div>
            <textarea className="col-span-2 min-h-[70px] w-full rounded-lg border p-3 text-sm" placeholder="Reference notes"
              value={groundRefNotes} onChange={(e) => setGroundRefNotes(e.target.value)} />
          </div>

          <details className="mt-4 rounded-lg border bg-zinc-50 p-3">
            <summary className="cursor-pointer select-none text-[11px] font-bold uppercase text-zinc-600">
              Optional calibration evidence (collapsed)
            </summary>
            <div className="mt-2 text-[11px] text-zinc-600">
              Borehole/geophysics highlights and investigation notes. Reference-only.
            </div>
            <div className="mt-3 text-[11px] font-bold uppercase text-zinc-600">Borehole calibration</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={newBhId} onChange={(e) => setNewBhId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="BH id (e.g. BH01)" />
              <input value={newBhTor} onChange={(e) => setNewBhTor(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="BH ToR depth (m)" inputMode="decimal" />
              <input value={newBhVel} onChange={(e) => setNewBhVel(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="SRT velocity at ToR (m/s)" inputMode="decimal" />
              <input value={newBhDiff} onChange={(e) => setNewBhDiff(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Geophys - BH diff (m)" inputMode="decimal" />
              <select value={newBhConf} onChange={(e) => setNewBhConf(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Confidence (optional)</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
              <button onClick={addBoreholeCalibration} className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700">
                Add row
              </button>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="bg-white">
                  <tr className="text-left text-[11px] uppercase text-zinc-500">
                    <th className="px-2 py-1">BH</th>
                    <th className="px-2 py-1">ToR</th>
                    <th className="px-2 py-1">Velocity</th>
                    <th className="px-2 py-1">Difference</th>
                    <th className="px-2 py-1">Confidence</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {boreholeCalibrations.length === 0 && (
                    <tr><td className="px-2 py-2 text-zinc-500" colSpan={6}>No calibration rows.</td></tr>
                  )}
                  {boreholeCalibrations.map((row) => (
                    <tr key={row.id} className="border-t">
                      {bhEditId === row.id && bhEditDraft ? (
                        <>
                          <td className="px-2 py-1">
                            <input
                              value={bhEditDraft.borehole_id}
                              onChange={(e) => setBhEditDraft({ ...bhEditDraft, borehole_id: e.target.value })}
                              className="w-[120px] rounded-md border px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              value={bhEditDraft.borehole_tor_depth_m_bgl}
                              onChange={(e) => setBhEditDraft({ ...bhEditDraft, borehole_tor_depth_m_bgl: e.target.value })}
                              className="w-[90px] rounded-md border px-2 py-1 text-sm"
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              value={bhEditDraft.srt_velocity_at_tor_ms}
                              onChange={(e) => setBhEditDraft({ ...bhEditDraft, srt_velocity_at_tor_ms: e.target.value })}
                              className="w-[130px] rounded-md border px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              value={bhEditDraft.difference_geophysics_minus_borehole_m}
                              onChange={(e) =>
                                setBhEditDraft({ ...bhEditDraft, difference_geophysics_minus_borehole_m: e.target.value })
                              }
                              className="w-[90px] rounded-md border px-2 py-1 text-sm"
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={bhEditDraft.confidence}
                              onChange={(e) => setBhEditDraft({ ...bhEditDraft, confidence: e.target.value })}
                              className="rounded-md border px-2 py-1 text-sm"
                            >
                              <option value="">-</option>
                              <option value="high">high</option>
                              <option value="medium">medium</option>
                              <option value="low">low</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-2">
                              <button
                                onClick={() => void saveEditBoreholeCalibration()}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase text-white hover:bg-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditBoreholeCalibration}
                                className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1">{row.borehole_id}</td>
                          <td className="px-2 py-1">{row.borehole_tor_depth_m_bgl ?? '-'}</td>
                          <td className="px-2 py-1">{row.srt_velocity_at_tor_ms ?? '-'}</td>
                          <td className="px-2 py-1">{row.difference_geophysics_minus_borehole_m ?? '-'}</td>
                          <td className="px-2 py-1">{row.confidence ?? '-'}</td>
                          <td className="px-2 py-1">
                            <div className="flex gap-2">
                              <button
                                onClick={() => beginEditBoreholeCalibration(row)}
                                className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => removeBoreholeCalibration(row.id)}
                                className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-rose-700 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase text-zinc-600">Phrase sets (project maintained)</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowArchivedPhrases((v) => !v)}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  title="Show/hide archived phrases"
                >
                  {showArchivedPhrases ? 'Hide archived' : 'Show archived'}
                </button>
                <button
                  onClick={() => navigate('/site-logging/library')}
                  className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  title="Global phrase maintenance (secondary)"
                >
                  Open library
                </button>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">
              Add/edit/delete phrases here for this site. Reorder and archive are stored in the Project reference (saved when you press <span className="font-semibold">Save</span> above).
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={phraseFormCategory} onChange={(e) => setPhraseFormCategory(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
                {PHRASE_ADMIN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={phraseFormText}
                onChange={(e) => setPhraseFormText(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
                placeholder="New phrase text"
              />
              <button
                onClick={() => void savePhraseForm()}
                className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Add phrase
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {PHRASE_ADMIN_CATEGORIES.map((cat) => {
                const order = phraseAdminPolicy.orderByCategory[cat] ?? [];
                const orderRank = new Map<string, number>();
                order.forEach((id, idx) => orderRank.set(String(id), idx));

                const rows = phrases
                  .filter((p) => (p.site_id ? p.site_id === site?.id : false))
                  .filter((p) => String(p.category || '').trim().split('@')[0] === cat)
                  .filter((p) => (showArchivedPhrases ? true : !phraseAdminPolicy.archivedIds.has(String(p.id))))
                  .sort((a, b) => {
                    const ai = orderRank.has(String(a.id)) ? orderRank.get(String(a.id))! : 9999;
                    const bi = orderRank.has(String(b.id)) ? orderRank.get(String(b.id))! : 9999;
                    return ai - bi || String(a.text || '').localeCompare(String(b.text || ''));
                  });

                const title =
                  cat === 'common_phrase'
                    ? 'common_phrase (final log lines)'
                    : cat === 'sentence_pattern'
                      ? 'sentence_pattern (learned sentence examples)'
                      : cat;

                return (
                  <details key={cat} className="rounded-lg border bg-white p-3" open={cat === 'common_phrase' || cat === 'sentence_pattern'}>
                    <summary className="cursor-pointer select-none text-[12px] font-bold uppercase text-zinc-700">
                      {title} <span className="ml-2 text-[11px] font-semibold text-zinc-500">({rows.length})</span>
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {rows.length === 0 && <div className="text-sm text-zinc-500">No phrases in this category for this site.</div>}
                      {rows.map((p) => {
                        const archived = phraseAdminPolicy.archivedIds.has(String(p.id));
                        const idx = order.indexOf(String(p.id));
                        const canUp = (idx >= 0 ? idx : order.length) > 0;
                        const canDown = idx >= 0 && idx < order.length - 1;
                        return (
                          <div key={p.id} className={`rounded-lg border p-2 ${archived ? 'bg-zinc-50' : 'bg-white'}`}>
                            {phraseEditId === p.id ? (
                              <div className="grid grid-cols-2 gap-2">
                                <select value={phraseEditCategory} onChange={(e) => setPhraseEditCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                                  {PHRASE_ADMIN_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <input value={phraseEditText} onChange={(e) => setPhraseEditText(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
                                <button onClick={() => void saveEditPhrase()} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">Save</button>
                                <button onClick={cancelEditPhrase} className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <div className="text-[13px] text-zinc-900 whitespace-pre-wrap">{p.text}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => movePhraseOrder(cat, p.id, 'up')}
                                    disabled={!canUp}
                                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                                    title="Move up (higher priority)"
                                  >
                                    Up
                                  </button>
                                  <button
                                    onClick={() => movePhraseOrder(cat, p.id, 'down')}
                                    disabled={!canDown}
                                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                                    title="Move down (lower priority)"
                                  >
                                    Down
                                  </button>
                                  <button
                                    onClick={() => setPhraseArchived(p.id, !archived)}
                                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                                    title={archived ? 'Activate phrase' : 'Archive phrase'}
                                  >
                                    {archived ? 'Activate' : 'Archive'}
                                  </button>
                                  <button
                                    onClick={() => startEditPhrase(p)}
                                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => void deletePhrase(p.id)}
                                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-rose-700 hover:bg-rose-50"
                                  >
                                    Delete
                                  </button>
                                  {idx < 0 && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                      Not ordered
                                    </span>
                                  )}
                                  {archived && (
                                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                                      Archived
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
          </>)}

          {referenceAdminMode && (
            <div className="mt-4 border-t pt-3">
              <div className="text-[11px] font-semibold text-zinc-600">Evidence / investigation notes (optional)</div>
              <div className="mt-1 text-[11px] text-zinc-600">
                Keep this lightweight. These notes are for calibration and context, not a raw database editor.
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select value={refType} onChange={(e) => setRefType(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="GeotechUnit">Geotech unit</option>
                  <option value="BoreholeNote">Borehole note</option>
                  <option value="GeophysicsNote">Geophysics note</option>
                  <option value="SiteRisk">Site risk note</option>
                  <option value="GeneralNote">General note</option>
                </select>
                <input value={refSource} onChange={(e) => setRefSource(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Source label" />
                <textarea value={refJson} onChange={(e) => setRefJson(e.target.value)} className="col-span-2 min-h-[90px] w-full rounded-lg border p-3 text-sm" placeholder="Note (plain text)" />
                <button onClick={createReference} className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">Add note</button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {refs.map((r: any) => (
                  <div key={r.id} className="rounded-lg border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-zinc-800">{r.reference_type}{r.source_label ? ` / ${r.source_label}` : ''}</div>
                        <div className="mt-1 whitespace-pre-wrap text-[12px] text-zinc-700">{String(r.reference_json || '')}</div>
                      </div>
                      <button onClick={() => deleteReference(r.id)} className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {activeStep === 'Verification' && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-zinc-800">Verification</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVerificationAdvanced((v) => !v)}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  {showVerificationAdvanced ? 'Hide advanced' : 'Advanced'}
                </button>
                <button
                  onClick={runVerification}
                  disabled={!['Anchor', 'SoilNail', 'MicroPile'].includes(elementDesignMode)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Run verification
                </button>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">
              Field view keeps this as a simple required-versus-actual depth check. Rock entry comes from logging by default, with an optional manual override below.
            </div>
            {!['Anchor', 'SoilNail', 'MicroPile'].includes(elementDesignMode) && (
              <div className="mt-2 rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-700">
                Verification is not defined for element type: <span className="font-semibold">{formatElementTypeShortLabel(String(element.element_type || ''))}</span>.
              </div>
            )}

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase text-zinc-500">Rock entry depth</div>
                <div className="text-[12px] text-zinc-600">
                  Source: <span className="font-semibold">{toNumberOrNull(interpActualTorDepth) != null ? 'Manual verification input' : 'Inferred from logging'}</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  value={interpActualTorDepth}
                  onChange={(e) => setInterpActualTorDepth(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Actual rock entry depth (m, optional manual)"
                  inputMode="decimal"
                />
                <button
                  onClick={() => setInterpActualTorDepth(inferredTorDepth != null ? inferredTorDepth.toFixed(2) : '')}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  Use inferred from logging
                </button>
                <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  Inferred from logging: <span className="font-semibold">{inferredTorDepth != null ? `${inferredTorDepth.toFixed(2)} m` : '-'}</span>
                </div>
              </div>
            </div>

            {verificationSummary?.kind === 'micro_pile' && (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase text-zinc-500">As-built inputs</div>
                  <div className="text-[11px] text-zinc-500">Entered here (not in Setup)</div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Base of casing depth (m)"
                    inputMode="decimal"
                    value={pileBaseCasingRaw}
                    onChange={(e) => setPileBaseCasingRaw(e.target.value)}
                    onBlur={() => setDesignInput({ ...designInput, casing_to_depth_m: parseNumberOrNull(pileBaseCasingRaw) })}
                  />
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Lowest U-bolt depth (m, optional)"
                    inputMode="decimal"
                    value={pileLowestUboltRaw}
                    onChange={(e) => setPileLowestUboltRaw(e.target.value)}
                    onBlur={() => setDesignInput({ ...designInput, lowest_ubolt_depth_m: parseNumberOrNull(pileLowestUboltRaw) })}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const base = parseNumberOrNull(pileBaseCasingRaw);
                      const zone = parseNumberOrNull(pileUboltZoneRaw);
                      if (base == null || zone == null) {
                        alert('Enter base of casing depth and U-bolt zone allowance first (As-built inputs).');
                        return;
                      }
                      const computed = base + zone;
                      setPileLowestUboltRaw(computed.toFixed(2));
                      setDesignInput({ ...designInput, lowest_ubolt_depth_m: computed });
                    }}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    Calc lowest U-bolt = base + allowance
                  </button>
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Final drilled depth (m, optional manual)"
                    inputMode="decimal"
                    value={pileFinalDepthRaw}
                    onChange={(e) => setPileFinalDepthRaw(e.target.value)}
                    onBlur={() => setDesignInput({ ...designInput, final_drilled_depth_m: parseNumberOrNull(pileFinalDepthRaw) })}
                  />
                </div>
                <div className="mt-2 rounded-lg border bg-zinc-50 p-2 text-[11px] text-zinc-600">
                  Rock condition evidence: <span className="font-semibold">{pileRockEvidence.note}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <select
                    value={String(designInput.governing_rock_condition || 'auto')}
                    onChange={(e) => setDesignInput({ ...designInput, governing_rock_condition: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="auto">Governing rock condition: Auto (from logging)</option>
                    <option value="hw">Governing rock condition: HW</option>
                    <option value="mw">Governing rock condition: MW</option>
                    <option value="mixed">Governing rock condition: mixed / review</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const v = pileSuggestedGoverningCondition.value;
                      if (v) setDesignInput({ ...designInput, governing_rock_condition: v });
                      else setDesignInput({ ...designInput, governing_rock_condition: 'mixed' });
                    }}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    {pileSuggestedGoverningCondition.value
                      ? `Use suggested: ${pileSuggestedGoverningCondition.value.toUpperCase()}`
                      : 'Set basis to REVIEW'}
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-zinc-600">
                  Suggested basis: <span className="font-semibold">{pileSuggestedGoverningCondition.value ? pileSuggestedGoverningCondition.value.toUpperCase() : 'none'}</span>{' '}
                  <span className="text-zinc-500">({pileSuggestedGoverningCondition.reason})</span>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-500">Status</div>
              <div className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${
                verificationSummary?.status === 'pass' ? 'bg-emerald-100 text-emerald-700' :
                verificationSummary?.status === 'conditional' ? 'bg-amber-100 text-amber-700' :
                verificationSummary?.status === 'review_required' ? 'bg-violet-100 text-violet-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {verificationSummary?.status || 'not run'}
              </div>
              <div className="mt-2 text-[12px] text-zinc-700">
                Rock entry source:{' '}
                <span className="font-semibold">
                  {toNumberOrNull(interpActualTorDepth) != null ? 'Manual verification input' : 'Inferred from logging intervals'}
                </span>
              </div>
            </div>

            {verificationSummary?.kind === 'micro_pile' && (
              <div className={`mt-3 grid grid-cols-1 gap-3 ${showVerificationAdvanced ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
                <div className="rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Pile verification (field)</div>
                    <div className="text-[11px] text-zinc-500">Design vs actual</div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {(verificationSummary?.table || []).map((row: any) => (
                      <div key={row.label} className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-sm">
                        <div className="font-semibold text-zinc-800">{row.label}</div>
                        <div className="text-zinc-600">Design: {row.design}</div>
                        <div className="text-zinc-600">Actual: {row.actual}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {showVerificationAdvanced && (
                  <div className="rounded-lg border bg-zinc-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-zinc-600">Geometry summary (advanced)</div>
                    <div className="mt-2 text-sm text-zinc-700">
                      <div>1. Ground / collar level</div>
                      <div className="ml-4 text-zinc-600">(datum selected in Setup; depths measured downward)</div>
                      <div className="mt-2">2. Top of rock</div>
                      <div className="ml-4 text-zinc-600">
                        {verificationSummary?.result?.actual_tor_depth_m != null ? `${Number(verificationSummary.result.actual_tor_depth_m).toFixed(2)} m` : '-'}
                      </div>
                      <div className="mt-2">3. Base of casing</div>
                      <div className="ml-4 text-zinc-600">
                        {verificationSummary?.result?.base_of_casing_depth_m != null ? `${Number(verificationSummary.result.base_of_casing_depth_m).toFixed(2)} m` : '-'}
                      </div>
                      <div className="mt-2">4. U-bolt zone and lowest U-bolt</div>
                      <div className="ml-4 text-zinc-600">
                        Zone allowance: {verificationSummary?.result?.u_bolt_zone_length_m != null ? `${Number(verificationSummary.result.u_bolt_zone_length_m).toFixed(2)} m` : '-'}; lowest U-bolt: {verificationSummary?.result?.lowest_ubolt_depth_m != null ? `${Number(verificationSummary.result.lowest_ubolt_depth_m).toFixed(2)} m` : '-'}
                      </div>
                      <div className="mt-2">5. Final drilled depth / pile bottom</div>
                      <div className="ml-4 text-zinc-600">
                        {verificationSummary?.result?.actual_total_depth_m != null ? `${Number(verificationSummary.result.actual_total_depth_m).toFixed(2)} m` : '-'}
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-2 text-[11px] text-zinc-600">
                      Reference diagram is guidance only and does not populate fields.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-500">Recommended next action</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {recommendedNextActions.map((a) => (
                  <div key={a} className="rounded-lg border bg-zinc-50 p-2 text-sm text-zinc-800">{a}</div>
                ))}
              </div>
            </div>

            {(verificationSummary?.kind === 'anchor' || verificationSummary?.kind === 'soil_nail') && (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-500">
                  {verificationSummary?.kind === 'soil_nail' ? 'Soil nail verification' : 'Anchor verification'}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(verificationSummary?.table || []).map((row: any) => (
                    <div key={row.label} className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-sm">
                      <div className="font-semibold text-zinc-800">{row.label}</div>
                      <div className="text-zinc-600">Design: {row.design}</div>
                      <div className="text-zinc-600">Actual: {row.actual}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verificationSummary?.kind === 'suitability' && (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-500">Suitability verification</div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(verificationSummary?.table || []).map((row: any) => (
                    <div key={row.label} className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-sm">
                      <div className="font-semibold text-zinc-800">{row.label}</div>
                      <div className="text-zinc-600">Design: {row.design}</div>
                      <div className="text-zinc-600">Actual: {row.actual}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] font-bold uppercase text-zinc-500">What drove the result</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {(verificationSummary?.reasons || []).length ? verificationSummary.reasons.map((reason: string) => (
                  <div key={reason} className="rounded-lg border p-2 text-sm text-zinc-700">{reason}</div>
                )) : <div className="text-sm text-zinc-500">No reasons. Current result is fully acceptable.</div>}
              </div>
            </div>

            {showVerificationAdvanced && (
              <>
                <div className="mt-3 rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Advanced engineer review</div>
                    <button
                      onClick={() => setActiveStep('Interpretation')}
                      className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                    >
                      Open interpretation
                    </button>
                  </div>
                  {Array.isArray((verificationSummary as any)?.review_required_triggers) && (verificationSummary as any).review_required_triggers.length > 0 ? (
                    <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg border border-violet-200 bg-violet-50 p-2 text-[12px] text-violet-900">
                      {(verificationSummary as any).review_required_triggers.slice(0, 6).map((t: any) => (
                        <div key={String(t)}>{String(t)}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-600">No additional review triggers recorded.</div>
                  )}
                </div>

                {verificationSummary?.kind === 'micro_pile' && (
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <PileGeometryCard
                      verificationResult={verificationSummary?.result}
                      torManual={toNumberOrNull(interpActualTorDepth) != null}
                    />

                    <ReferenceDiagramCard
                      diagram={pileReferenceDiagram}
                      diagramUrl={pileReferenceDiagram ? (photoUrls[pileReferenceDiagram.id] || null) : null}
                      onEnlarge={() => setSelectedPhotoUrl(pileReferenceDiagram ? (photoUrls[pileReferenceDiagram.id] || null) : null)}
                      onRemove={removePileReferenceDiagram}
                      file={pileDiagramFile}
                      onFileChange={setPileDiagramFile}
                      caption={pileDiagramCaption}
                      onCaptionChange={setPileDiagramCaption}
                      onUpload={uploadPileReferenceDiagram}
                    />
                  </div>
                )}

                <div className="mt-3 rounded-lg border bg-white p-3">
                  <div className="text-[11px] font-bold uppercase text-zinc-500">Source logic</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-700">
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">How rock entry is determined</div>
                      <div className="mt-1 text-[12px] whitespace-pre-wrap">
                        {toNumberOrNull(interpActualTorDepth) != null
                          ? `Rock entry uses the manual verification input: ${interpActualTorDepth} m.`
                          : `Rock entry is inferred from the first interval that indicates competent rock / MW-SW weathering / rock type.`}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-zinc-50 p-2">
                      <div className="text-[11px] font-bold uppercase text-zinc-500">How lengths are calculated</div>
                      <div className="mt-1 text-[12px] whitespace-pre-wrap">
                        {(verificationSummary?.kind === 'anchor' || verificationSummary?.kind === 'soil_nail') && `Anchorage/socket length = (total drilled depth - rock entry). Overdrill = (total depth - (rock entry + required socket)).`}
                        {verificationSummary?.kind === 'micro_pile' && `Casing plunge = (base of casing - rock entry). Socket/embedment = (final depth - rock entry). Anchorage below lowest U-bolt = (final depth - lowest U-bolt depth). Minimum required final depth = max(rock entry + required socket, lowest U-bolt depth + required anchorage). Overdrill = (final depth - minimum required final depth).`}
                        {verificationSummary?.kind === 'suitability' && `Suitability verification checks working load, cycle schedule, and completion flags.`}
                        {!verificationSummary?.kind && 'Run verification to see calculations.'}
                      </div>
                    </div>
                  </div>
                </div>

                {verificationSummary?.kind === 'micro_pile' && (
                  <div className="mt-3 rounded-lg border bg-white p-3">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">Micro-pile detail</div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {(verificationSummary?.table || []).map((row: any) => (
                        <div key={row.label} className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-sm">
                          <div className="font-semibold text-zinc-800">{row.label}</div>
                          <div className="text-zinc-600">Design: {row.design}</div>
                          <div className="text-zinc-600">Actual: {row.actual}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeStep === 'Closeout' && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <div className="text-sm font-bold text-zinc-800">Closeout</div>
                <div className="text-[11px] text-zinc-600">Complete the field workflow in order: clean-out → photos → approval → report.</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
              <div className={`rounded-lg border px-2 py-2 font-semibold ${closeoutProgress.cleanOutComplete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-zinc-50 text-zinc-700'}`}>
                1. Clean-out {closeoutProgress.cleanOutComplete ? 'OK' : 'Pending'}
              </div>
              <div className={`rounded-lg border px-2 py-2 font-semibold ${closeoutProgress.photosComplete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-zinc-50 text-zinc-700'}`}>
                2. Photos {closeoutProgress.photosComplete ? 'OK' : 'Pending'}
              </div>
              <div className={`rounded-lg border px-2 py-2 font-semibold ${closeoutProgress.approvalComplete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-zinc-50 text-zinc-700'}`}>
                3. Approval {closeoutProgress.approvalComplete ? 'OK' : 'Pending'}
              </div>
              <div className={`rounded-lg border px-2 py-2 font-semibold ${closeoutProgress.reportReady ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-zinc-50 text-zinc-700'}`}>
                4. Report {closeoutProgress.reportReady ? 'Ready' : 'Pending'}
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">1) Clean-out</div>
                <button onClick={saveCleanOut} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">Save</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={cleanMethodAir} onChange={(e) => setCleanMethodAir(e.target.checked)} /> Air</label>
                <label className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={cleanMethodWater} onChange={(e) => setCleanMethodWater(e.target.checked)} /> Water</label>
                <label className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={cleanMethodGrout} onChange={(e) => setCleanMethodGrout(e.target.checked)} /> Grout</label>
                <label className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={cleanSediment} onChange={(e) => setCleanSediment(e.target.checked)} /> Sedimentation observed</label>
                <input value={cleanDepth} onChange={(e) => setCleanDepth(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Cleaned depth (m)" inputMode="decimal" />
                <input value={cleanDateTime} onChange={(e) => setCleanDateTime(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Clean-out datetime" />
                <select value={cleanBaseCondition} onChange={(e) => setCleanBaseCondition(e.target.value as any)} className="rounded-lg border bg-white px-3 py-2 text-sm">
                  <option value="unknown">Base condition: unknown</option>
                  <option value="clean">Clean</option>
                  <option value="soft">Soft</option>
                  <option value="sedimented">Sedimented</option>
                  <option value="contaminated">Contaminated</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={cleanApproved} onChange={(e) => setCleanApproved(e.target.checked)} /> Approved for grouting</label>
                <textarea value={cleanNote} onChange={(e) => setCleanNote(e.target.value)} className="col-span-2 min-h-[80px] w-full rounded-lg border bg-white p-3 text-sm" placeholder="Clean-out / approval note" />
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">2) Photos</div>
                <div className="text-[11px] text-zinc-600">Stored offline in the shared media store.</div>
              </div>

              <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
                <div className="text-[11px] font-bold uppercase text-zinc-600">Add photo</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setNewPhotoFile(e.target.files?.[0] ?? null)}
                    className="col-span-2 rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={newPhotoCaption}
                    onChange={(e) => setNewPhotoCaption(e.target.value)}
                    className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Caption (optional)"
                  />
                  <select
                    value={newPhotoType}
                    onChange={(e) => setNewPhotoType(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="drilling_location">drilling_location</option>
                    <option value="material_at_depth">material_at_depth</option>
                    <option value="hole_condition">hole_condition</option>
                    <option value="clean_out">clean_out</option>
                    <option value="casing">casing</option>
                    <option value="u_bolt">u_bolt</option>
                    <option value="grout_preparation">grout_preparation</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    value={newPhotoDepth}
                    onChange={(e) => setNewPhotoDepth(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Depth m (optional)"
                    inputMode="decimal"
                  />
                  <select
                    value={newPhotoRecordId}
                    onChange={(e) => setNewPhotoRecordId(e.target.value)}
                    className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Attach to active record</option>
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.record_date || '(no date)'}{r.method ? ` / ${r.method}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newPhotoTakenAt}
                    onChange={(e) => setNewPhotoTakenAt(e.target.value)}
                    className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Taken datetime (optional)"
                  />
                  <button
                    onClick={uploadSitePhoto}
                    className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    disabled={!newPhotoFile}
                  >
                    Upload photo
                  </button>
                </div>
              </div>

              <PhotoGrid
                photos={visibleSitePhotos}
                photoUrls={photoUrls}
                onEnlarge={(id) => setSelectedPhotoUrl(photoUrls[id] || null)}
                onRemove={removeSitePhoto}
              />
            </div>

            <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">3) Approval</div>
                <button onClick={saveApproval} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700">Save</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input value={approvalLoggedBy} onChange={(e) => setApprovalLoggedBy(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Logged by" />
                <input value={approvalReviewedBy} onChange={(e) => setApprovalReviewedBy(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Reviewed by" />
                <input value={approvalApprovedBy} onChange={(e) => setApprovalApprovedBy(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Approved by" />
                <input value={approvalDateTime} onChange={(e) => setApprovalDateTime(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Approval datetime" />
                <label className="col-span-2 flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"><input type="checkbox" checked={approvalApproved} onChange={(e) => setApprovalApproved(e.target.checked)} /> Approved for grouting</label>
                <textarea value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} className="col-span-2 min-h-[80px] w-full rounded-lg border bg-white p-3 text-sm" placeholder="Approval comment" />
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">4) Report preview</div>
                <button
                  onClick={() => navigate(`/site-logging/element/${element.id}/report`)}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                >
                  Open printable report
                </button>
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                {outputReport?.updated_at ? `Saved: ${new Date(outputReport.updated_at).toLocaleString()}` : 'Not saved yet'}
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-zinc-700">
                {outputReport?.report_text || reportPreview || 'Run verification to update preview.'}
              </pre>
            </div>

            <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">Export / Import</div>
                <div className="text-[11px] text-zinc-600">JSON packs for reuse and handover.</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={exportElementPack}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  title="Export this element (design + logging + interpretation + verification)."
                >
                  Export element pack
                </button>
                <button
                  onClick={startImportElementPack}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  title="Import an element pack into this project (creates a new element)."
                >
                  Import element pack
                </button>
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                Packs include reference and structured logging data. Photo blobs are not embedded (metadata only).
              </div>
              <input
                ref={importElementPackInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => void onImportElementPackFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        )}
      </div>

      {selectedPhotoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <button
            onClick={() => setSelectedPhotoUrl(null)}
            className="absolute top-4 right-4 rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-white/20"
          >
            Close
          </button>
          <img src={selectedPhotoUrl} className="max-h-full max-w-full rounded-lg object-contain" alt="Photo" />
        </div>
      )}
    </Layout>
  );
};
