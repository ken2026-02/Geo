import type {
  SiteApprovalRecord,
  SiteCleanOutRecord,
  SiteDrillingInterval,
  SiteDrillingRecord,
  SiteFieldEvent,
  SitePhotoAttachment,
  SiteInterpretation,
  SupportElement,
} from '../types/siteLogging';
import { PHOTO_TYPE_REFERENCE_DIAGRAM, formatElementTypeShortLabel } from './siteLoggingUi';

type VerificationSummary = {
  kind: 'anchor' | 'soil_nail' | 'micro_pile' | 'suitability' | 'other';
  status: 'pass' | 'conditional' | 'fail' | 'review_required';
  reasons: string[];
  review_required_triggers?: string[];
  reliability?: { level: 'high' | 'medium' | 'low'; notes: string[] };
  table: Array<{ label: string; design: string; actual: string }>;
  result: Record<string, any>;
};

const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const maxDepth = (record: SiteDrillingRecord | null, intervals: SiteDrillingInterval[]): number | null => {
  const fromIntervals = intervals.reduce<number | null>((acc, item) => {
    if (!Number.isFinite(item.to_depth_m)) return acc;
    return acc == null ? item.to_depth_m : Math.max(acc, item.to_depth_m);
  }, null);
  return fromIntervals ?? num(record?.end_depth_m);
};

const inferActualTorFromIntervals = (intervals: SiteDrillingInterval[]): number | null => {
  for (const item of [...intervals].sort((a, b) => a.from_depth_m - b.from_depth_m)) {
    const w = (item.weathering_class || '').toLowerCase();
    const rock = (item.rock_type || '').toLowerCase();
    const interpreted = (item.material_interpreted || '').toLowerCase();
    if (rock && rock !== 'not_applicable') return item.from_depth_m;
    // Treat weathered rock selections as the practical field trigger for ToR.
    // Field intent: once logging indicates entry into HW (or better), ToR can be inferred.
    if (['xw', 'hw', 'mw', 'sw', 'fr'].includes(w)) return item.from_depth_m;
    if (interpreted.includes('rock') || interpreted.includes('competent')) return item.from_depth_m;
  }
  return null;
};

const inferRockConditionFromIntervals = (
  intervals: SiteDrillingInterval[]
): { hasHW: boolean; hasMW: boolean; suggested: 'hw' | 'mw' | 'mixed' | 'missing' } => {
  let hasHW = false;
  let hasMW = false;
  for (const item of intervals) {
    const w = (item.weathering_class || '').toLowerCase();
    if (w === 'hw') hasHW = true;
    if (w === 'mw') hasMW = true;
  }
  const suggested: 'hw' | 'mw' | 'mixed' | 'missing' =
    hasHW && hasMW ? 'mixed' : hasHW ? 'hw' : hasMW ? 'mw' : 'missing';
  return { hasHW, hasMW, suggested };
};

const sumWeakBandThicknessFromInterpretation = (interpretation: Partial<SiteInterpretation> | null): number => {
  // Interpretation weak bands are reference-only; treat missing/malformed as zero.
  try {
    const raw = interpretation?.weak_band_intervals_json;
    if (!raw) return 0;
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, it) => {
      const from = typeof it?.from_depth_m === 'number' ? it.from_depth_m : typeof it?.from === 'number' ? it.from : null;
      const to = typeof it?.to_depth_m === 'number' ? it.to_depth_m : typeof it?.to === 'number' ? it.to : null;
      if (from == null || to == null) return acc;
      const t = Math.max(0, to - from);
      return acc + (Number.isFinite(t) ? t : 0);
    }, 0);
  } catch {
    return 0;
  }
};

const interpretReliabilityFromInterpretation = (
  interpretation: Partial<SiteInterpretation> | null
): { level: 'high' | 'medium' | 'low'; triggers: string[] } => {
  const triggers: string[] = [];
  const conf = String((interpretation as any)?.interpretation_confidence || (interpretation as any)?.confidence || '').toLowerCase();
  const confLevel: 'high' | 'medium' | 'low' = conf === 'high' ? 'high' : conf === 'low' ? 'low' : 'medium';

  let varianceClass = '';
  try {
    const raw = (interpretation as any)?.tor_variance_reason_json;
    const obj = raw ? JSON.parse(String(raw)) : null;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      varianceClass = String((obj as any).tor_variance_class || '').trim();
    }
  } catch {
    // ignore
  }

  if (varianceClass === 'significantly_deeper') triggers.push('Large ToR variance (significantly deeper than expected).');
  if (varianceClass === 'shallower_than_expected') triggers.push('ToR shallower than expected.');
  if (varianceClass === 'inconsistent_with_reference') triggers.push('ToR inconsistent with reference.');
  if (confLevel === 'low') triggers.push('Low interpretation confidence.');

  const weakBandsCount = (() => {
    try {
      const raw = (interpretation as any)?.weak_band_intervals_json;
      const arr = raw ? JSON.parse(String(raw)) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  })();
  if (weakBandsCount > 0 && confLevel !== 'high') triggers.push('Weak bands present with less than high confidence.');

  const level: 'high' | 'medium' | 'low' =
    confLevel === 'low' || ['significantly_deeper', 'shallower_than_expected', 'inconsistent_with_reference'].includes(varianceClass)
      ? 'low'
      : weakBandsCount > 0 || confLevel === 'medium'
        ? 'medium'
        : 'high';

  return { level, triggers };
};

const fieldStabilityFromIntervals = (intervals: SiteDrillingInterval[]): { level: 'high' | 'medium' | 'low'; triggers: string[] } => {
  const triggers: string[] = [];
  const last = [...intervals].sort((a, b) => a.from_depth_m - b.from_depth_m).slice(-4);
  if (last.length < 2) return { level: 'medium', triggers };

  const waterSet = new Set(last.map((it: any) => String(it.water_condition || '').trim()).filter((x) => x && x !== 'not_observed'));
  if (waterSet.size >= 2) triggers.push('Water condition varies across recent intervals.');

  const recSet = new Set(last.map((it: any) => String(it.recovery_type || '').trim()).filter(Boolean));
  if (recSet.size >= 2) triggers.push('Recovery type varies across recent intervals.');

  const responseFlags = last
    .flatMap((it: any) => {
      try {
        return it.drilling_response_json ? (JSON.parse(String(it.drilling_response_json)) as any[]) : [];
      } catch {
        return [];
      }
    })
    .map((x) => String(x));
  if (responseFlags.some((r) => /collapse|re_drill|hammer_bounce/i.test(r))) {
    triggers.push('Unstable drilling response observed (collapse/re-drill/hammer bounce).');
  }

  const level: 'high' | 'medium' | 'low' = triggers.length >= 2 ? 'low' : triggers.length === 1 ? 'medium' : 'high';
  return { level, triggers };
};

export const computeTorCard = (
  interpretation: Partial<SiteInterpretation> | null,
  intervals: SiteDrillingInterval[]
) => {
  const reference = num(interpretation?.reference_tor_depth_m) ?? null;
  const actual = num(interpretation?.actual_tor_depth_m) ?? inferActualTorFromIntervals(intervals);
  const variance = reference != null && actual != null ? actual - reference : null;
  return {
    referenceTorDepthM: reference,
    actualTorDepthM: actual,
    varianceM: variance,
  };
};

export const evaluateSiteVerification = ({
  element,
  designInput,
  record,
  intervals,
  interpretation,
  cleanOut,
  approval,
}: {
  element: SupportElement;
  designInput: Record<string, any>;
  record: SiteDrillingRecord | null;
  intervals: SiteDrillingInterval[];
  interpretation: Partial<SiteInterpretation> | null;
  cleanOut: SiteCleanOutRecord | null;
  approval: SiteApprovalRecord | null;
}): VerificationSummary => {
  const interpRel = interpretReliabilityFromInterpretation(interpretation);
  const fieldRel = fieldStabilityFromIntervals(intervals);
  const torCard = computeTorCard(interpretation, intervals);
  const drilledDepth = maxDepth(record, intervals);
  const actualTor = torCard.actualTorDepthM;
  const toRSource = num(interpretation?.actual_tor_depth_m) != null ? 'manual' : 'inferred';
  const overdrillAllowance = num(designInput?.max_overdrill_m) ?? 0;

  if (['anchor', 'soil_nail'].includes(String(element.element_type))) {
    const designAnchorage = num(designInput?.design_anchorage_length_m) ?? 0;
    const designSocket = num(designInput?.required_socket_length_m ?? designInput?.design_socket_length_m) ?? 0;
    const anchorageActual = drilledDepth != null && actualTor != null ? Math.max(0, drilledDepth - actualTor) : null;
    const socketActual = anchorageActual;
    const overdrill = drilledDepth != null && actualTor != null && designSocket > 0
      ? Math.max(0, drilledDepth - (actualTor + designSocket))
      : null;
    const anchoragePass = anchorageActual != null ? anchorageActual >= designAnchorage : false;
    const socketPass = socketActual != null ? socketActual >= designSocket : false;
    const overdrillPass = overdrill != null ? overdrill <= overdrillAllowance : false;
    const groutReady = Boolean(cleanOut?.approved_for_grouting || approval?.approved_for_grouting);

    const reasons: string[] = [];
    if (!anchoragePass) reasons.push('Actual anchorage length is below design.');
    if (!socketPass) reasons.push('Actual socket length is below design.');
    if (!overdrillPass) reasons.push('Overdrill exceeds allowable limit.');
    if (!groutReady) reasons.push('Grout approval is not yet confirmed.');

    const baseStatus: Exclude<VerificationSummary['status'], 'review_required'> =
      reasons.length === 0 ? 'pass' : groutReady ? 'conditional' : 'fail';
    const reviewTriggers = [...interpRel.triggers, ...fieldRel.triggers];
    const status: VerificationSummary['status'] =
      baseStatus === 'fail' ? 'fail' :
      interpRel.level === 'low' ? 'review_required' :
      fieldRel.level === 'low' ? 'review_required' :
      baseStatus === 'pass' && (interpRel.level === 'medium' || fieldRel.level === 'medium') ? 'conditional' :
      baseStatus;
    return {
      kind: String(element.element_type) === 'soil_nail' ? 'soil_nail' : 'anchor',
      status,
      reasons,
      review_required_triggers: status === 'review_required' ? reviewTriggers : [],
      reliability: {
        level: interpRel.level === 'low' || fieldRel.level === 'low' ? 'low' : (interpRel.level === 'medium' || fieldRel.level === 'medium') ? 'medium' : 'high',
        notes: reviewTriggers,
      },
      table: [
        { label: 'ToR depth', design: actualTor != null ? `${actualTor.toFixed(2)} m reference` : '-', actual: actualTor != null ? `${actualTor.toFixed(2)} m` : '-' },
        { label: 'Anchorage length', design: `${designAnchorage.toFixed(2)} m`, actual: anchorageActual != null ? `${anchorageActual.toFixed(2)} m` : '-' },
        { label: 'Socket length', design: `${designSocket.toFixed(2)} m`, actual: socketActual != null ? `${socketActual.toFixed(2)} m` : '-' },
        { label: 'Allowable overdrill', design: `${overdrillAllowance.toFixed(2)} m`, actual: overdrill != null ? `${overdrill.toFixed(2)} m` : '-' },
      ],
      result: {
        length_to_rock_m: actualTor,
        anchorage_length_actual_m: anchorageActual,
        socket_length_actual_m: socketActual,
        drilled_length_actual_m: drilledDepth,
        overdrill_length_m: overdrill,
        design_anchorage_length_m: designAnchorage,
        design_socket_length_m: designSocket,
        allowable_overdrill_m: overdrillAllowance,
        anchorage_pass: anchoragePass,
        socket_pass: socketPass,
        overdrill_pass: overdrillPass,
        bond_zone_acceptable: socketPass,
        grout_ready: groutReady,
        compliance_status: status,
        reason_list: reasons,
      },
    };
  }

  if (['micro_pile', 'pile', 'permanent_casing'].includes(String(element.element_type))) {
    const requiredPlunge = num(designInput?.required_plunge_length_m) ?? 0;
    const governingRockConditionRaw = String(designInput?.governing_rock_condition || 'auto').toLowerCase();
    const rockEvidence = inferRockConditionFromIntervals(intervals);
    const governingRockCondition =
      governingRockConditionRaw === 'hw' || governingRockConditionRaw === 'mw' || governingRockConditionRaw === 'mixed'
        ? (governingRockConditionRaw as 'hw' | 'mw' | 'mixed')
        : (rockEvidence.suggested === 'missing' ? 'missing' : rockEvidence.suggested);
    const governingRockConditionSource =
      governingRockConditionRaw === 'hw' || governingRockConditionRaw === 'mw' || governingRockConditionRaw === 'mixed'
        ? 'manual'
        : 'auto';
    const requiredSocketHw = num(designInput?.required_socket_hw_m);
    const requiredSocketMw = num(designInput?.required_socket_mw_m);
    const legacyRequiredSocket = num(designInput?.required_socket_length_m);
    const socketBasis = String(designInput?.socket_basis || 'gross_socket');
    const overdrillAllowance = num(designInput?.max_overdrill_m) ?? 0;
    const casingToDepth = num(designInput?.casing_to_depth_m) ?? null; // "Base of casing depth" in Setup UI
    const casingType = String(designInput?.casing_type || '').trim() || null;

    const finalDepthOverride = num(designInput?.final_drilled_depth_m);
    const maxDepthM = finalDepthOverride ?? drilledDepth;

    const uBoltZone = num(designInput?.u_bolt_zone_length_m);
    const lowestUboltManual = num(designInput?.lowest_ubolt_depth_m);
    const lowestUboltCalculated =
      lowestUboltManual == null && casingToDepth != null && uBoltZone != null ? casingToDepth + uBoltZone : null;
    const lowestUboltDepthM = lowestUboltManual ?? lowestUboltCalculated;
    const lowestUboltSource = lowestUboltManual != null ? 'manual' : lowestUboltCalculated != null ? 'calculated' : 'missing';

    const requiredAnchorageBelowUboltDirect = num(designInput?.required_min_anchorage_below_ubolt_m);
    const legacyAnchHw = num(designInput?.min_anchorage_hw_m);
    const legacyAnchMw = num(designInput?.min_anchorage_mw_m);
    const legacyAnchMax = [legacyAnchHw, legacyAnchMw]
      .filter((v): v is number => v != null)
      .reduce((acc, v) => Math.max(acc, v), 0);
    const requiredAnchorageBelowUboltM =
      requiredAnchorageBelowUboltDirect != null ? requiredAnchorageBelowUboltDirect : legacyAnchMax > 0 ? legacyAnchMax : null;

    const requiredSocketM = (() => {
      if (governingRockCondition === 'hw') return requiredSocketHw ?? legacyRequiredSocket ?? null;
      if (governingRockCondition === 'mw') return requiredSocketMw ?? legacyRequiredSocket ?? null;
      if (governingRockCondition === 'mixed') {
        const mx = [requiredSocketHw, requiredSocketMw].filter((v): v is number => v != null);
        if (mx.length) return Math.max(...mx);
        return legacyRequiredSocket ?? null;
      }
      if (governingRockCondition === 'missing') {
        const mx = [requiredSocketHw, requiredSocketMw, legacyRequiredSocket].filter((v): v is number => v != null);
        return mx.length ? Math.max(...mx) : null;
      }
      return legacyRequiredSocket ?? requiredSocketHw ?? requiredSocketMw ?? null;
    })();

    // Field geometry: casing should plunge into rock. Use logging-derived ToR and check whether the
    // casing tip (base of casing) is below ToR by the required amount.
    // No hidden fallback: if base of casing is missing, casing plunge checks are unreliable.
    const baseOfCasingM = casingToDepth;
    const casingEmbedmentIntoRock = actualTor != null && baseOfCasingM != null ? Math.max(0, baseOfCasingM - actualTor) : null;
    const grossSocketActual = maxDepthM != null && actualTor != null ? Math.max(0, maxDepthM - actualTor) : null;

    const weakBandDeductionRequired = Boolean(designInput?.weak_band_deduction_required);
    const weakBandThickness = weakBandDeductionRequired ? sumWeakBandThicknessFromInterpretation(interpretation) : 0;
    const netSocketActual = grossSocketActual != null ? Math.max(0, grossSocketActual - weakBandThickness) : null;
    const socketActual = socketBasis === 'net_competent_socket' ? netSocketActual : grossSocketActual;

    const anchorageBelowUboltActual =
      maxDepthM != null && lowestUboltDepthM != null ? Math.max(0, maxDepthM - lowestUboltDepthM) : null;

    const requiredDepthFromSocket =
      actualTor != null && requiredSocketM != null ? actualTor + requiredSocketM : null;
    const requiredDepthFromAnchorage =
      lowestUboltDepthM != null && requiredAnchorageBelowUboltM != null ? lowestUboltDepthM + requiredAnchorageBelowUboltM : null;
    const minimumRequiredFinalDepth =
      requiredDepthFromSocket != null && requiredDepthFromAnchorage != null
        ? Math.max(requiredDepthFromSocket, requiredDepthFromAnchorage)
        : requiredDepthFromSocket ?? requiredDepthFromAnchorage ?? null;

    const overdrill =
      maxDepthM != null && minimumRequiredFinalDepth != null ? (maxDepthM - minimumRequiredFinalDepth) : null;

    const plungePass = requiredPlunge <= 0 ? true : casingEmbedmentIntoRock != null ? casingEmbedmentIntoRock >= requiredPlunge : false;
    const socketPass =
      governingRockCondition === 'missing'
        ? false
        : (requiredSocketM != null && grossSocketActual != null ? grossSocketActual >= requiredSocketM : false);
    const anchoragePass =
      requiredAnchorageBelowUboltM != null && anchorageBelowUboltActual != null
        ? anchorageBelowUboltActual >= requiredAnchorageBelowUboltM
        : false;
    const depthPass = minimumRequiredFinalDepth != null && maxDepthM != null ? maxDepthM >= minimumRequiredFinalDepth : false;
    const overdrillPass = overdrill != null ? overdrill <= overdrillAllowance : false;

    const cleanOutRequired = Boolean(designInput?.clean_out_required);
    const groutApprovalRequired = Boolean(designInput?.grout_approval_required);

    const cleanOutPass = !cleanOutRequired || Boolean(cleanOut?.clean_out_depth_m != null);
    const groutReady = !groutApprovalRequired || Boolean(cleanOut?.approved_for_grouting || approval?.approved_for_grouting);

    const reasons: string[] = [];
    const extraReviewTriggers: string[] = [];
    if (finalDepthOverride != null) extraReviewTriggers.push('Final drilled depth is provided manually (override).');
    if (governingRockCondition === 'mixed') extraReviewTriggers.push('Governing rock condition is mixed/uncertain (HW and MW both logged).');
    if (governingRockCondition === 'missing') extraReviewTriggers.push('No HW/MW evidence in logging; governing rock condition must be selected.');
    if (governingRockConditionSource === 'auto' && governingRockCondition !== 'missing') {
      extraReviewTriggers.push(`Governing rock condition is suggested from logging: ${String(governingRockCondition).toUpperCase()}.`);
    }
    if (weakBandDeductionRequired) extraReviewTriggers.push('Weak band deduction is enabled (review deductions).');
    if (lowestUboltSource === 'calculated') extraReviewTriggers.push('Lowest U-bolt depth is assumed from base of casing + allowance.');
    if (legacyRequiredSocket != null && (requiredSocketHw == null || requiredSocketMw == null)) extraReviewTriggers.push('Using legacy socket requirement (single value).');
    if (requiredAnchorageBelowUboltDirect == null && legacyAnchMax > 0) extraReviewTriggers.push('Using legacy anchorage requirement (HW/MW max).');
    if (requiredPlunge > 0 && casingToDepth == null) extraReviewTriggers.push('Base of casing depth is not set; casing plunge check is unreliable.');
    if (actualTor == null) extraReviewTriggers.push('Top of rock is not set (manual) and could not be inferred from logging.');
    if (requiredSocketM == null) extraReviewTriggers.push('Required socket length is missing.');
    if (requiredAnchorageBelowUboltM == null) extraReviewTriggers.push('Required anchorage below lowest U-bolt is missing.');
    if (lowestUboltDepthM == null) extraReviewTriggers.push('Lowest U-bolt depth is missing (manual or calculated).');
    if (minimumRequiredFinalDepth == null) extraReviewTriggers.push('Minimum required final drilled depth could not be determined.');

    const NEAR_MARGIN_M = 0.2;
    const near = (actual: number | null, req: number | null) =>
      actual != null && req != null ? Math.abs(actual - req) <= NEAR_MARGIN_M : false;

    if (!plungePass) reasons.push('Casing plunge into rock is below required.');
    if (!anchoragePass) reasons.push('Anchorage below lowest U-bolt is below required.');
    if (governingRockCondition !== 'missing' && !socketPass) reasons.push('Rock socket / embedment is below required.');
    if (!depthPass) reasons.push('Final drilled depth is below the governing minimum required depth.');
    if (!overdrillPass) reasons.push('Overdrill exceeds allowable limit.');
    if (!cleanOutPass) reasons.push('Clean-out is required but not recorded.');
    if (!groutReady) reasons.push('Grout approval is required but not yet confirmed.');

    if (near(casingEmbedmentIntoRock, requiredPlunge)) extraReviewTriggers.push('Casing plunge is close to minimum.');
    if (near(anchorageBelowUboltActual, requiredAnchorageBelowUboltM)) extraReviewTriggers.push('Anchorage below U-bolt is close to minimum.');
    if (near(grossSocketActual, requiredSocketM)) extraReviewTriggers.push('Socket / embedment is close to minimum.');
    if (near(maxDepthM, minimumRequiredFinalDepth)) extraReviewTriggers.push('Final depth is close to minimum required depth.');

    // Pile verification status is intentionally simple for field use: pass / review_required / fail.
    const baseStatus: Exclude<VerificationSummary['status'], 'review_required'> =
      reasons.length === 0 ? 'pass' : 'fail';
    const reviewTriggers = [...interpRel.triggers, ...fieldRel.triggers, ...extraReviewTriggers];
    const status: VerificationSummary['status'] =
      baseStatus === 'fail' ? 'fail' :
      extraReviewTriggers.length ? 'review_required' :
      interpRel.level === 'low' ? 'review_required' :
      fieldRel.level === 'low' ? 'review_required' :
      'pass';

    return {
      kind: 'micro_pile',
      status,
      reasons,
      review_required_triggers: status === 'review_required' ? reviewTriggers : [],
      reliability: {
        level: interpRel.level === 'low' || fieldRel.level === 'low' ? 'low' : (interpRel.level === 'medium' || fieldRel.level === 'medium') ? 'medium' : 'high',
        notes: reviewTriggers,
      },
      table: [
        { label: 'Top of rock', design: '-', actual: actualTor != null ? `${actualTor.toFixed(2)} m (${toRSource})` : '-' },
        { label: 'Base of casing depth', design: '-', actual: baseOfCasingM != null ? `${baseOfCasingM.toFixed(2)} m` : '-' },
        {
          label: 'Actual casing plunge into rock',
          design: `${requiredPlunge.toFixed(2)} m`,
          actual: casingEmbedmentIntoRock != null ? `${casingEmbedmentIntoRock.toFixed(2)} m` : '-',
        },
        {
          label: 'Lowest U-bolt depth',
          design: lowestUboltSource === 'calculated' && uBoltZone != null ? `Base + ${uBoltZone.toFixed(2)} m` : '-',
          actual: lowestUboltDepthM != null ? `${lowestUboltDepthM.toFixed(2)} m (${lowestUboltSource})` : '-',
        },
        {
          label: 'Actual anchorage below lowest U-bolt',
          design: requiredAnchorageBelowUboltM != null ? `${requiredAnchorageBelowUboltM.toFixed(2)} m` : '-',
          actual: anchorageBelowUboltActual != null ? `${anchorageBelowUboltActual.toFixed(2)} m` : '-',
        },
        {
          label: 'Actual rock socket / embedment length',
          design:
            governingRockCondition === 'missing'
              ? `Select basis. HW: ${requiredSocketHw != null ? requiredSocketHw.toFixed(2) : '-'} m; MW: ${requiredSocketMw != null ? requiredSocketMw.toFixed(2) : '-'} m`
              : requiredSocketM != null
                ? `${requiredSocketM.toFixed(2)} m (gov: ${String(governingRockCondition).toUpperCase()})`
                : '-',
          actual: grossSocketActual != null ? `${grossSocketActual.toFixed(2)} m` : '-',
        },
        {
          label: 'Minimum required final drilled depth',
          design: '-',
          actual: minimumRequiredFinalDepth != null ? `${minimumRequiredFinalDepth.toFixed(2)} m` : '-',
        },
        {
          label: 'Actual final drilled depth',
          design: minimumRequiredFinalDepth != null ? `>= ${minimumRequiredFinalDepth.toFixed(2)} m` : '-',
          actual: maxDepthM != null ? `${maxDepthM.toFixed(2)} m` : '-',
        },
        {
          label: 'Overdrill',
          design: `${overdrillAllowance.toFixed(2)} m`,
          actual: overdrill != null ? `${overdrill.toFixed(2)} m` : '-',
        },
        { label: 'Clean-out required', design: cleanOutRequired ? 'Yes' : 'No', actual: cleanOutPass ? 'OK' : 'Missing' },
        { label: 'Grout approval required', design: groutApprovalRequired ? 'Yes' : 'No', actual: groutReady ? 'OK' : 'Not confirmed' },
      ],
      result: {
        required_plunge_length_m: requiredPlunge,
        governing_rock_condition: governingRockCondition,
        governing_rock_condition_source: governingRockConditionSource,
        rock_evidence_hw: rockEvidence.hasHW,
        rock_evidence_mw: rockEvidence.hasMW,
        required_socket_hw_m: requiredSocketHw,
        required_socket_mw_m: requiredSocketMw,
        required_socket_length_m: requiredSocketM,
        required_anchorage_below_ubolt_m: requiredAnchorageBelowUboltM,
        u_bolt_zone_length_m: uBoltZone,
        lowest_ubolt_depth_m: lowestUboltDepthM,
        lowest_ubolt_source: lowestUboltSource,
        socket_basis: socketBasis,
        casing_to_depth_m: casingToDepth,
        casing_type: casingType,
        max_overdrill_m: overdrillAllowance,
        actual_total_depth_m: maxDepthM,
        actual_tor_depth_m: actualTor,
        base_of_casing_depth_m: casingToDepth,
        plunge_length_actual_m: casingEmbedmentIntoRock,
        base_of_socket_depth_m: maxDepthM,
        gross_socket_length_m: grossSocketActual,
        net_socket_length_m: netSocketActual,
        weak_band_deduction_m: weakBandThickness,
        anchorage_below_ubolt_actual_m: anchorageBelowUboltActual,
        minimum_required_final_depth_m: minimumRequiredFinalDepth,
        overdrill_length_m: overdrill,
        plunge_pass: plungePass,
        anchorage_pass: anchoragePass,
        socket_pass: socketPass,
        final_depth_pass: depthPass,
        overdrill_pass: overdrillPass,
        clean_out_pass: cleanOutPass,
        grout_ready: groutReady,
        compliance_status: status,
        reason_list: reasons,
      },
    };
  }

  if (['suitability_test'].includes(String(element.element_type))) {
    const testType = String(designInput?.test_type || '').trim() || 'suitability_test';
    const workingLoad = num(designInput?.working_load_kN);
    const cycleSchedule = Array.isArray(designInput?.cycle_schedule) ? designInput.cycle_schedule : [];
    const testComplete = Boolean(designInput?.test_complete);
    const notifyDesigner = Boolean(designInput?.notify_designer_required);

    const reasons: string[] = [];
    if (!workingLoad) reasons.push('Working load is not set.');
    if (!cycleSchedule.length) reasons.push('Cycle schedule is empty.');
    if (!testComplete) reasons.push('Suitability test is not marked complete.');
    if (notifyDesigner) reasons.push('Notify designer is required.');

    const baseStatus: Exclude<VerificationSummary['status'], 'review_required'> =
      reasons.length === 0 ? 'pass' : testComplete ? 'conditional' : 'fail';
    const reviewTriggers = [...interpRel.triggers, ...fieldRel.triggers];
    const status: VerificationSummary['status'] =
      baseStatus === 'fail' ? 'fail' :
      interpRel.level === 'low' ? 'review_required' :
      fieldRel.level === 'low' ? 'review_required' :
      baseStatus === 'pass' && (interpRel.level === 'medium' || fieldRel.level === 'medium') ? 'conditional' :
      baseStatus;
    return {
      kind: 'suitability',
      status,
      reasons,
      review_required_triggers: status === 'review_required' ? reviewTriggers : [],
      reliability: {
        level: interpRel.level === 'low' || fieldRel.level === 'low' ? 'low' : (interpRel.level === 'medium' || fieldRel.level === 'medium') ? 'medium' : 'high',
        notes: reviewTriggers,
      },
      table: [
        { label: 'Test type', design: testType, actual: testType },
        { label: 'Working load', design: workingLoad != null ? `${workingLoad.toFixed(0)} kN` : '-', actual: workingLoad != null ? `${workingLoad.toFixed(0)} kN` : '-' },
        { label: 'Cycles', design: cycleSchedule.length ? `${cycleSchedule.length}` : '-', actual: cycleSchedule.length ? `${cycleSchedule.length}` : '-' },
        { label: 'Test complete', design: 'Yes', actual: testComplete ? 'Yes' : 'No' },
      ],
      result: {
        test_type: testType,
        working_load_kN: workingLoad,
        cycle_schedule: cycleSchedule,
        test_complete: testComplete,
        notify_designer_required: notifyDesigner,
        compliance_status: status,
        reason_list: reasons,
      },
    };
  }

  return {
    kind: 'other',
    status: interpRel.level === 'low' || fieldRel.level === 'low' ? 'review_required' : 'conditional',
    reasons: ['Verification engine is not defined for this element type yet.'],
    review_required_triggers: interpRel.level === 'low' || fieldRel.level === 'low' ? [...interpRel.triggers, ...fieldRel.triggers] : [],
    reliability: {
      level: interpRel.level === 'low' || fieldRel.level === 'low' ? 'low' : 'medium',
      notes: [...interpRel.triggers, ...fieldRel.triggers],
    },
    table: [],
    result: {},
  };
};

export const buildSiteOutputReport = ({
  element,
  siteCode,
  designInput,
  interpretation,
  verification,
  cleanOut,
  approval,
  intervals,
  events,
  photos,
}: {
  element: SupportElement;
  siteCode: string;
  designInput: Record<string, any>;
  interpretation: Partial<SiteInterpretation> | null;
  verification: VerificationSummary | null;
  cleanOut: SiteCleanOutRecord | null;
  approval: SiteApprovalRecord | null;
  intervals: SiteDrillingInterval[];
  events?: SiteFieldEvent[];
  photos?: SitePhotoAttachment[];
}) => {
  const elementType = String(element.element_type || '').toLowerCase();
  const typeLabel = formatElementTypeShortLabel(elementType);

  const intervalRows = [...(intervals || [])].sort((a, b) => a.from_depth_m - b.from_depth_m);
  const intervalLines = intervalRows.length
    ? intervalRows
        .map((it) => {
          const phrase = (it.logging_phrase_output as any) || it.observed_text || '-';
          return `${it.from_depth_m.toFixed(2)}-${it.to_depth_m.toFixed(2)} m  ${phrase}`;
        })
        .join('\n')
    : '-';

  const eventLines = (events || [])
    .map((e) => {
      const dt = e.event_datetime || e.updated_at || '';
      const depth = e.depth_m != null ? ` @ ${e.depth_m.toFixed(2)} m` : '';
      return `${dt} [${e.category || 'event'}]${depth}: ${e.note || '-'}`;
    })
    .join('\n');
  // Keep reference diagrams out of the normal photo attachment list/output.
  const photoLines = (photos || [])
    .filter((p: any) => String(p.photo_type || '').trim() !== PHOTO_TYPE_REFERENCE_DIAGRAM)
    .map((p) => {
      const dt = p.taken_datetime || p.created_at || '';
      const kind = (p as any).photo_type || 'other';
      const depth = (p as any).depth_m != null ? ` @ ${(p as any).depth_m.toFixed(2)} m` : '';
      return `${dt} [${kind}]${depth}: ${p.caption || 'Photo'} (${p.mime_type || 'image'})`;
    })
    .join('\n');

  const verStatus = verification?.status ? String(verification.status).toUpperCase() : '-';
  const verReasons = Array.isArray(verification?.reasons) ? verification!.reasons.map(String).filter(Boolean) : [];
  const verReview = Array.isArray((verification as any)?.review_required_triggers)
    ? (verification as any).review_required_triggers.map(String).filter(Boolean)
    : [];
  const inferNextAction = () => {
    if (!verification) return '-';
    if (verification.status === 'review_required') return 'Engineer review required (verification reliability is low).';
    if (verReasons.some((r) => /clean-?out/i.test(r))) return 'Perform clean-out and re-run verification.';
    if (verReasons.some((r) => /grout approval/i.test(r))) return 'Engineer review / grout approval required.';
    if (verReasons.some((r) => /below (design|required)/i.test(r) || /below the governing minimum/i.test(r))) return 'Continue drilling to achieve required lengths.';
    if (verification.status === 'pass') return 'Stop at current depth (meets design).';
    return 'Review intervals and interpretation, then re-run verification.';
  };

  const interpSummary = (interpretation?.interpretation_summary || interpretation?.summary || '').trim() || '-';
  const weakBandsCount = (() => {
    try {
      const raw = (interpretation as any)?.weak_band_intervals_json;
      const arr = raw ? JSON.parse(String(raw)) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  })();

  const approvedForGrout = Boolean(approval?.approved_for_grouting || cleanOut?.approved_for_grouting);
  const cleanOutDepth = cleanOut?.clean_out_depth_m != null ? `${cleanOut.clean_out_depth_m.toFixed(2)} m` : '-';

  return [
    `SITE LOGGING REPORT`,
    `Site: ${siteCode}`,
    `Element: ${element.element_code || element.id} (${typeLabel})`,
    '',
    `INTERPRETATION`,
    `Reference ToR: ${interpretation?.reference_tor_depth_m ?? '-'}`,
    `Actual ToR: ${interpretation?.actual_tor_depth_m ?? '-'}`,
    `Continuous rock start: ${interpretation?.continuous_rock_start_m ?? '-'}`,
    `Weak bands: ${weakBandsCount}`,
    `Summary: ${interpSummary}`,
    '',
    `VERIFICATION`,
    `Outcome: ${verStatus}`,
    verReview.length ? `Review triggers: ${verReview.join('; ')}` : '',
    `Next action: ${inferNextAction()}`,
    verReasons.length ? `Reasons: ${verReasons.join('; ')}` : 'Reasons: none',
    '',
    `CLEAN-OUT / GROUT`,
    `Clean-out depth: ${cleanOutDepth}`,
    `Base condition: ${cleanOut?.base_condition || '-'}`,
    `Approved for grouting: ${approvedForGrout ? 'Yes' : 'No'}`,
    `Approval comment: ${approval?.approval_comment || cleanOut?.approval_note || '-'}`,
    '',
    `DRILLING LOG (final phrases)`,
    intervalLines,
    '',
    `FIELD EVENTS`,
    eventLines || '-',
    '',
    `PHOTO LIST`,
    photoLines || '-',
  ].join('\n');
};
