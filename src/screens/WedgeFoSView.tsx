import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Calculator, Info, Save } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { structuralAssessmentStore } from '../state/structuralAssessmentStore';
import { engineeringStore } from '../state/engineeringStore';
import { structuralRepo } from '../repositories/structuralRepo';
import { analyzeKinematics } from '../engineering/kinematicEngine';
import { estimateWedgeFS } from '../engineering/wedgeEngine';
import { decisionEngine } from '../engineering/decisionEngine';
import { GroundwaterCondition } from '../utils/wedgeFoS';
import { WaterCondition } from '../engineering/waterEngine';
import { estimateWedgeSize, screenBlockFallRisk, recommendSupport } from '../utils/rockEngineeringScreening';
import { entryRepo } from '../repositories/entryRepo';
import { wedgeFoSRepo } from '../repositories/wedgeFoSRepo';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { WedgeFoSResultPanels } from '../components/WedgeFoSResultPanels';
import { WedgeFoSParameterPanel } from '../components/WedgeFoSParameterPanel';
import { normalizeStructuralInput, normalizeStructuralRepoRecord } from '../utils/structuralInput';

export default function WedgeFoSView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>('');
  
  // Inputs
  const [weightMode, setWeightMode] = useState<'Manual' | 'Estimate'>('Manual');
  const [weight, setWeight] = useState<string>('100');
  const [wedgeHeight, setWedgeHeight] = useState<string>('1');
  const [s1, setS1] = useState<string>('1');
  const [s2, setS2] = useState<string>('1');
  const [persistenceFactor, setPersistenceFactor] = useState<string>('1');
  const [persistenceSelection, setPersistenceSelection] = useState<number>(1);
  const [unitWeight, setUnitWeight] = useState<string>('25');
  const [unitWeightSelection, setUnitWeightSelection] = useState<number>(25);
  
  const [frictionAngle, setFrictionAngle] = useState<string>('30');
  const [frictionSelection, setFrictionSelection] = useState<number>(30);
  const [cohesion, setCohesion] = useState<string>('0');
  const [cohesionSelection, setCohesionSelection] = useState<number>(0);
  const [groundwater, setGroundwater] = useState<GroundwaterCondition | 'Custom'>('Dry');
  const [customGroundwaterPressure, setCustomGroundwaterPressure] = useState<string>('0');
  
  // Support Inputs
  const [supportType, setSupportType] = useState<'None' | 'Shotcrete only' | 'Bolt only' | 'Bolt + Shotcrete' | 'Anchor / Cable' | 'Combined system'>('None');
  const [shotcreteTraceLength, setShotcreteTraceLength] = useState<string>('1');
  const [shotcreteThickness, setShotcreteThickness] = useState<string>('0');
  const [shotcreteThicknessSelection, setShotcreteThicknessSelection] = useState<number>(0);
  const [shotcreteShearStrength, setShotcreteShearStrength] = useState<string>('200');
  const [shotcreteShearSelection, setShotcreteShearSelection] = useState<number>(200);
  const [shotcreteReduction, setShotcreteReduction] = useState<string>('0.3');
  const [shotcreteReductionSelection, setShotcreteReductionSelection] = useState<number>(0.3);
  
  const [boltCapacity, setBoltCapacity] = useState<string>('0');
  const [boltCapacitySelection, setBoltCapacitySelection] = useState<number>(0);
  const [boltNumber, setBoltNumber] = useState<string>('1');
  const [boltTrend, setBoltTrend] = useState<string>('0');
  const [boltPlunge, setBoltPlunge] = useState<string>('0');
  const [boltEffectiveness, setBoltEffectiveness] = useState<string>('0.75');
  const [boltEffectivenessSelection, setBoltEffectivenessSelection] = useState<number>(0.75);
  
  const [anchorForce, setAnchorForce] = useState<string>('0');
  const [anchorCapacitySelection, setAnchorCapacitySelection] = useState<number>(0);
  const [anchorNumber, setAnchorNumber] = useState<string>('0');
  const [anchorTrend, setAnchorTrend] = useState<string>('0');
  const [anchorPlunge, setAnchorPlunge] = useState<string>('0');
  const [anchorEffectiveness, setAnchorEffectiveness] = useState<string>('0.75');
  const [anchorEffectivenessSelection, setAnchorEffectivenessSelection] = useState<number>(0.75);
  
  // Risk Screening Inputs
  const [slopeHeight, setSlopeHeight] = useState<number>(10);
  const [exposure, setExposure] = useState<string>('No exposure');
  const [trigger, setTrigger] = useState<string>('Dry / no trigger');
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);


  const safeDivide = (num: number, den: number): number | null => {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 1e-6) return null;
    const value = num / den;
    return Number.isFinite(value) ? value : null;
  };

  const parseNumericInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const weightValue = parseNumericInput(weight) ?? 0;
  const wedgeHeightValue = parseNumericInput(wedgeHeight) ?? 1;
  const s1Value = parseNumericInput(s1) ?? 1;
  const s2Value = parseNumericInput(s2) ?? 1;
  const persistenceFactorValue = parseNumericInput(persistenceFactor) ?? 1;
  const unitWeightValue = parseNumericInput(unitWeight) ?? 25;
  const frictionAngleValue = parseNumericInput(frictionAngle) ?? 30;
  const cohesionValue = parseNumericInput(cohesion) ?? 0;
  const customGroundwaterPressureValue = parseNumericInput(customGroundwaterPressure) ?? 0;
  const shotcreteTraceLengthValue = parseNumericInput(shotcreteTraceLength) ?? 0;
  const shotcreteThicknessValue = parseNumericInput(shotcreteThickness) ?? 0;
  const shotcreteShearStrengthValue = parseNumericInput(shotcreteShearStrength) ?? 0;
  const shotcreteReductionValue = parseNumericInput(shotcreteReduction) ?? 0.3;
  const boltCapacityValue = parseNumericInput(boltCapacity) ?? 0;
  const boltNumberValue = parseNumericInput(boltNumber) ?? 0;
  const boltTrendValue = parseNumericInput(boltTrend) ?? 0;
  const boltPlungeValue = parseNumericInput(boltPlunge) ?? 0;
  const boltEffectivenessValue = parseNumericInput(boltEffectiveness) ?? 0;
  const anchorForceValue = parseNumericInput(anchorForce) ?? 0;
  const anchorNumberValue = parseNumericInput(anchorNumber) ?? 0;
  const anchorTrendValue = parseNumericInput(anchorTrend) ?? 0;
  const anchorPlungeValue = parseNumericInput(anchorPlunge) ?? 0;
  const anchorEffectivenessValue = parseNumericInput(anchorEffectiveness) ?? 0;

  const getJointById = (jointId: string, source: any) => {
    if (source?.jointSets && Array.isArray(source.jointSets)) {
      const found = source.jointSets.find((js: any) => String(js.id).toUpperCase() === jointId.toUpperCase());
      if (found) {
        const dip = parseNumericInput(String(found.dip ?? found.meanOrientation?.dip ?? ''));
        const dipDirection = parseNumericInput(String(found.dipDirection ?? found.meanOrientation?.dipDirection ?? ''));
        if (dip !== null && dipDirection !== null) {
          return { id: jointId.toUpperCase(), dip, dipDirection };
        }
      }
    }

    const jointMap: Record<string, { dip: unknown; dipDirection: unknown }> = {
      J1: { dip: source.joint1Dip, dipDirection: source.joint1DipDir },
      J2: { dip: source.joint2Dip, dipDirection: source.joint2DipDir },
      J3: { dip: source.joint3Dip, dipDirection: source.joint3DipDir }
    };

    const fallback = jointMap[jointId.toUpperCase()];
    if (!fallback) return null;

    const dip = parseNumericInput(String(fallback.dip ?? ''));
    const dipDirection = parseNumericInput(String(fallback.dipDirection ?? ''));
    return dip !== null && dipDirection !== null ? { id: jointId.toUpperCase(), dip, dipDirection } : null;
  };

  const resolveControllingPair = (source: any): [string, string] => {
    const pairText = (
      source?.kinematicResult?.controllingPair ||
      source?.controllingPair ||
      source?.wedgePair ||
      source?.wedgeGeometry?.controllingPair ||
      ''
    ).replace(/\s+/g, ' ').trim();
    const match = pairText.match(/(J\d)\s*\+\s*(J\d)/i);
    if (match) return [match[1].toUpperCase(), match[2].toUpperCase()];
    return ['J1', 'J2'];
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Load from engineeringStore
      const state = engineeringStore.getState();
      
      // 1. Try location state
      if (location.state) {
        const normalized = normalizeStructuralInput(location.state);
        if (normalized) {
          setData(normalized);
          setFrictionAngle(String(normalized.frictionAngle));
          setDataSource('Using current unsaved Structural Assessment inputs');
          setLoading(false);
          return;
        }
      }

      // 2. Try live engineering state
      if (state.project && state.location && state.jointSets?.length) {
        const currentStateData = {
          projectId: state.project,
          locationId: state.location,
          slopeDip: state.slopeOrientation?.dip ?? 0,
          slopeDipDir: state.slopeOrientation?.dipDirection ?? 0,
          frictionAngle: state.friction ?? 30,
          cohesion: state.cohesion ?? 0,
          groundwater: state.groundwater ?? 'Dry',
          controllingPair: state.kinematicResult?.controllingPair ?? state.wedgeGeometry?.controllingPair ?? null,
          wedgeTrend: state.kinematicResult?.wedgeTrend ?? state.wedgeGeometry?.trend ?? null,
          wedgePlunge: state.kinematicResult?.wedgePlunge ?? state.wedgeGeometry?.plunge ?? null,
          wedgePossible: state.kinematicResult?.wedgePossible ?? state.wedgeGeometry?.isAdmissible ?? false,
          jointSets: state.jointSets,
        };
        const normalized = normalizeStructuralInput(currentStateData);
        if (normalized) {
          setData(normalized);
          setFrictionAngle(String(normalized.frictionAngle));
          setDataSource('Using current engineering state');
          setLoading(false);
          return;
        }
      }

      // 3. Try draft
      const draft = structuralAssessmentStore.loadDraft();
      if (draft) {
        const normalized = normalizeStructuralInput(draft);
        if (normalized) {
          setData(normalized);
          setFrictionAngle(String(normalized.frictionAngle));
          setDataSource('Using current unsaved Structural Assessment draft');
          setLoading(false);
          return;
        }
      }

      // 4. Try latest saved assessment from repo if available
      try {
        const latestProjectId = (location.state as any)?.projectId || state.project || undefined;
        const latestLocationId = (location.state as any)?.locationId || state.location || undefined;
        const latest = await structuralRepo.getLatestByProjectAndLocation?.(latestProjectId, latestLocationId);
        if (latest) {
          const normalized = normalizeStructuralRepoRecord(latest, {
            projectId: String(latestProjectId ?? ''),
            locationId: String(latestLocationId ?? '')
          });
          if (normalized) {
            setData(normalized);
            setFrictionAngle(String(normalized.frictionAngle));
            setDataSource('Using latest saved Structural Assessment result');
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('[WedgeFoSView] Could not load latest saved structural assessment', e);
      }

      setDataSource('No Structural Assessment data available');
      setLoading(false);
    };
    loadData();
  }, [location.state]);

  const estimatedWeight = useMemo(() => {
    if (weightMode === 'Manual') return { volume: 0, weight: weightValue, sizeClass: weightValue > 200 ? 'Very Large' : weightValue > 50 ? 'Large' : weightValue > 10 ? 'Medium' : 'Small' as any };
    return estimateWedgeSize({ height: wedgeHeightValue, s1: s1Value, s2: s2Value, persistenceFactor: persistenceFactorValue, unitWeight: unitWeightValue });
  }, [weightMode, weight, wedgeHeight, s1, s2, persistenceFactor, unitWeight]);

  const kinematicResult = useMemo(() => {
    if (!data) return null;

    return analyzeKinematics(
      data.slopeDip ?? 0,
      data.slopeDipDir ?? 0,
      frictionAngleValue ?? data.frictionAngle ?? 30,
      data.jointSets ?? []
    );
  }, [data, frictionAngleValue]);

  const analysis = useMemo(() => {
    if (!data) return null;

    const activePairText = kinematicResult?.controllingPair || data?.kinematicResult?.controllingPair || data?.controllingPair || data?.wedgeGeometry?.controllingPair || '';
    const [jointAId, jointBId] = resolveControllingPair({ controllingPair: activePairText });
    const jointA = getJointById(jointAId, data);
    const jointB = getJointById(jointBId, data);
    if (!jointA || !jointB) return null;

    const groundwaterCondition: GroundwaterCondition = groundwater === 'Custom' ? 'Pressurized' : groundwater;
    const waterCondition: WaterCondition = groundwaterCondition === 'Flowing' ? 'Wet' : groundwaterCondition as WaterCondition;

    const wedgeResult = estimateWedgeFS({
      slope: { dip: data.slopeDip ?? 0, dipDirection: data.slopeDipDir ?? 0 },
      joint1: { dip: jointA.dip, dipDirection: jointA.dipDirection },
      joint2: { dip: jointB.dip, dipDirection: jointB.dipDirection },
      frictionAngle: frictionAngleValue,
      boltForce: (supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? boltCapacityValue : 0,
      boltNumber: (supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? boltNumberValue : 0,
      boltTrend: (supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? boltTrendValue : 0,
      boltPlunge: (supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? boltPlungeValue : 0,
      boltEffectiveness: (supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? boltEffectivenessValue : 0,
      anchorForce: (supportType === 'Anchor / Cable' || supportType === 'Combined system') ? anchorForceValue : 0,
      anchorNumber: (supportType === 'Anchor / Cable' || supportType === 'Combined system') ? anchorNumberValue : 0,
      anchorTrend: (supportType === 'Anchor / Cable' || supportType === 'Combined system') ? anchorTrendValue : 0,
      anchorPlunge: (supportType === 'Anchor / Cable' || supportType === 'Combined system') ? anchorPlungeValue : 0,
      anchorEffectiveness: (supportType === 'Anchor / Cable' || supportType === 'Combined system') ? anchorEffectivenessValue : 0,
      shotcreteShearStrength: (supportType === 'Shotcrete only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? shotcreteShearStrengthValue : 0,
      shotcreteThickness: (supportType === 'Shotcrete only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? shotcreteThicknessValue : 0,
      slidingPlaneContactLength: (supportType === 'Shotcrete only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? shotcreteTraceLengthValue : 0,
      shotcreteReduction: (supportType === 'Shotcrete only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') ? shotcreteReductionValue : 0.3,
      unitWeight: unitWeightValue,
      wedgeHeight: wedgeHeightValue,
      waterHead: (groundwater === 'Pressurized' || groundwater === 'Custom') ? customGroundwaterPressureValue : 0,
      condition: waterCondition,
      manualWedgeWeight: estimatedWeight.weight,
      cohesion: cohesionValue
    });

    const fos = safeDivide(wedgeResult.debug?.resistingEff ?? wedgeResult.debug?.resistingDry ?? 0, wedgeResult.debug?.drivingEff ?? wedgeResult.debug?.drivingDry ?? 0);
    const fosShotcrete = safeDivide((wedgeResult.debug?.resistingEff ?? 0) + (wedgeResult.debug?.shotcreteContribution ?? 0), wedgeResult.debug?.drivingEff ?? 0);
    const fosBolt = safeDivide((wedgeResult.debug?.resistingEff ?? 0) + (wedgeResult.debug?.boltContribution ?? 0), wedgeResult.debug?.drivingEff ?? 0);
    const fosAnchor = safeDivide((wedgeResult.debug?.resistingEff ?? 0) + (wedgeResult.debug?.anchorContribution ?? 0), wedgeResult.debug?.drivingEff ?? 0);
    const fosCombined = safeDivide((wedgeResult.debug?.resistingEff ?? 0) + (wedgeResult.debug?.shotcreteContribution ?? 0) + (wedgeResult.debug?.boltContribution ?? 0) + (wedgeResult.debug?.anchorContribution ?? 0), wedgeResult.debug?.drivingEff ?? 0);

    const controllingPair = activePairText || `${jointA.id} + ${jointB.id}`;
    const wedgeTrend = kinematicResult?.wedgeTrend ?? wedgeResult.geometry?.intersectionTrend ?? data?.kinematicResult?.wedgeTrend ?? data?.wedgeTrend ?? null;
    const wedgePlunge = kinematicResult?.wedgePlunge ?? wedgeResult.geometry?.intersectionPlunge ?? data?.kinematicResult?.wedgePlunge ?? data?.wedgePlunge ?? null;
    const supportedForDecision = fosCombined ?? 0;
    const stabilityClass = supportedForDecision < 1.0 ? 'Unstable' : supportedForDecision < 1.3 ? 'Marginal' : 'Stable';
    const interpretation = fosCombined === null
      ? 'Invalid wedge geometry or zero driving force. Check controlling pair and structural inputs.'
      : `Potential wedge on ${controllingPair} with trend/plunge ${Math.round(wedgeTrend ?? 0)} / ${Math.round(wedgePlunge ?? 0)}. Screening FoS = ${supportedForDecision.toFixed(2)} using wedge weight ${estimatedWeight.weight.toFixed(1)} kN, friction ${frictionAngleValue.toFixed(1)} deg and cohesion ${cohesionValue.toFixed(1)} kPa.`;

    const result = {
      fos,
      fosShotcrete,
      fosBolt,
      fosAnchor,
      fosCombined,
      fsDry: wedgeResult.fsDry,
      fsWet: wedgeResult.fsWet,
      stabilityClass,
      interpretation,
      controllingPair,
      wedgeTrend,
      wedgePlunge,
      breakdown: {
        driving: wedgeResult.debug?.drivingEff ?? wedgeResult.debug?.drivingDry ?? 0,
        resisting: wedgeResult.debug?.resistingEff ?? wedgeResult.debug?.resistingDry ?? 0,
        shotcrete: wedgeResult.debug?.shotcreteContribution ?? 0,
        bolt: wedgeResult.debug?.boltContribution ?? 0,
        anchor: wedgeResult.debug?.anchorContribution ?? 0
      },
      debug: wedgeResult.debug
    };

    const decision = decisionEngine.evaluateSiteAction(
      'Wedge',
      wedgeResult.fsDry,
      wedgeResult.fsWet,
      'High confidence',
      [],
      supportType === 'None' ? 'Unknown' : ((wedgeResult.fsSupported ?? 0) > 1.3 ? 'Adequate' : 'Inadequate') as any,
      estimatedWeight.weight
    );

    return {
      ...result,
      decision
    };
  }, [
    data,
    kinematicResult,
    estimatedWeight,
    frictionAngle,
    cohesion,
    groundwater,
    customGroundwaterPressure,
    supportType,
    shotcreteTraceLength,
    shotcreteThickness,
    shotcreteShearStrength,
    shotcreteReduction,
    boltCapacity,
    boltNumber,
    boltTrend,
    boltPlunge,
    boltEffectiveness,
    anchorForce,
    anchorNumber,
    anchorTrend,
    anchorPlunge,
    anchorEffectiveness,
    unitWeight,
    wedgeHeight
  ]);


  const fmtFoS = (v: number | null) => v == null ? 'Invalid geometry' : v.toFixed(2);

  const riskScreening = useMemo(() => {
    if (!analysis) return null;
    return screenBlockFallRisk({
      sizeClass: estimatedWeight.sizeClass,
      exposure: exposure as any,
      trigger: trigger as any
    });
  }, [analysis, estimatedWeight, exposure, trigger]);

  const supportRecommendation = useMemo(() => {
    if (!analysis || !riskScreening) return null;
    return recommendSupport({
      wedgeWeight: estimatedWeight.weight,
      unsupportedFos: analysis.fos,
      groundwater,
      riskClass: riskScreening.finalRisk,
      isAdmissible: !!(kinematicResult?.wedgePossible ?? data?.wedgePossible)
    });
  }, [analysis, riskScreening, estimatedWeight, groundwater, data, kinematicResult]);

  const handleSave = async () => {
    if (!data || !analysis) return;
    
    const supportAdvice = supportRecommendation?.approach || analysis.decision.supportRecommendation;
    const summary = `Potential wedge instability: ${analysis.stabilityClass.toLowerCase()} screening result, ${riskScreening?.finalRisk || 'Low'} field risk, ${supportAdvice}.`;
    
    try {
      console.log('[WedgeFoSView] Saving analysis for entry:', data.projectId, data.locationId);
      const currentState = engineeringStore.getState();
      const riskLevelId = (riskScreening?.finalRisk === 'Critical' || analysis.decision.reviewRequired) ? 'R4' : (riskScreening?.finalRisk === 'High' || analysis.stabilityClass === 'Unstable') ? 'R3' : (riskScreening?.finalRisk === 'Moderate' || analysis.stabilityClass === 'Marginal') ? 'R2' : 'R1';
      const entryId = await entryRepo.create({
        project_id: data.projectId || currentState.project || '',
        location_id: data.locationId || currentState.location || '',
        entry_type_id: 'ET25',
        risk_level_id: riskLevelId,
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: 0
      });
      
      await wedgeFoSRepo.saveWedgeFoSAssessment({
        id: crypto.randomUUID(),
        entry_id: entryId,
        wedge_weight: estimatedWeight.weight,
        friction_angle: frictionAngleValue,
        cohesion: cohesionValue,
        groundwater_condition: groundwater,
        water_head: (groundwater === 'Pressurized' || groundwater === 'Custom') ? customGroundwaterPressureValue : 0,
        water_force: analysis.debug?.waterForce ?? null,
        controlling_pair: analysis.controllingPair,
        wedge_trend: analysis.wedgeTrend,
        wedge_plunge: analysis.wedgePlunge,
        fos: analysis.fos,
        fos_shotcrete: analysis.fosShotcrete,
        fos_bolt: analysis.fosBolt,
        fos_anchor: analysis.fosAnchor ?? null,
        fos_combined: analysis.fosCombined,
        stability_class: analysis.stabilityClass,
        risk_class: riskScreening?.finalRisk ?? null,
        action_level: analysis.decision.actionLevel,
        support_recommendation: supportAdvice,
        review_required: analysis.decision.reviewRequired ? 1 : 0,
        interpretation: analysis.interpretation,
        support_type: supportType,
        shotcrete_trace_length: shotcreteThicknessValue > 0 ? shotcreteTraceLengthValue : null,
        shotcrete_thickness: shotcreteThicknessValue > 0 ? shotcreteThicknessValue : null,
        shotcrete_shear_strength: shotcreteThicknessValue > 0 ? shotcreteShearStrengthValue : null,
        shotcrete_reduction_factor: shotcreteThicknessValue > 0 ? shotcreteReductionValue : null,
        bolt_capacity: boltCapacityValue > 0 ? boltCapacityValue : null,
        bolt_number: boltCapacityValue > 0 ? boltNumberValue : null,
        bolt_trend: boltCapacityValue > 0 ? boltTrendValue : null,
        bolt_plunge: boltCapacityValue > 0 ? boltPlungeValue : null,
        bolt_effectiveness: boltCapacityValue > 0 ? boltEffectivenessValue : null,
        anchor_force: anchorForceValue > 0 ? anchorForceValue : null,
        anchor_number: anchorForceValue > 0 ? anchorNumberValue : null,
        anchor_trend: anchorForceValue > 0 ? anchorTrendValue : null,
        anchor_plunge: anchorForceValue > 0 ? anchorPlungeValue : null,
        anchor_effectiveness: anchorForceValue > 0 ? anchorEffectivenessValue : null,
        driving_force: analysis.breakdown.driving,
        shear_resistance: analysis.breakdown.resisting,
        shotcrete_contribution: analysis.breakdown.shotcrete,
        bolt_contribution: analysis.breakdown.bolt,
        anchor_contribution: analysis.breakdown.anchor,
        notes: JSON.stringify({
          weightMode,
          estimatedVolume: estimatedWeight.volume,
          sizeClass: estimatedWeight.sizeClass,
          persistenceFactor,
          supportBasis: supportRecommendation?.basis ?? null,
          supportAction: supportRecommendation?.actionLevel ?? null,
          exposure,
          trigger,
          boltNumber,
          anchorNumber
        })
      });
      
      engineeringStore.setState({
        project: data.projectId || currentState.project || null,
        location: data.locationId || currentState.location || null,
        friction: frictionAngleValue,
        cohesion: cohesionValue,
        groundwater: groundwater === 'Custom' ? 'Wet' : groundwater,
        kinematicResult: {
          ...(currentState.kinematicResult ?? { mechanism: 'Wedge' as const }),
          mechanism: (kinematicResult?.wedgePossible || analysis.controllingPair) ? 'Wedge' : (currentState.kinematicResult?.mechanism ?? 'No mechanism'),
          planarPossible: kinematicResult?.planarPossible ?? currentState.kinematicResult?.planarPossible,
          wedgePossible: kinematicResult?.wedgePossible ?? true,
          topplingPossible: kinematicResult?.topplingPossible ?? currentState.kinematicResult?.topplingPossible,
          controllingSet: kinematicResult?.controllingSet ?? currentState.kinematicResult?.controllingSet ?? null,
          controllingPair: analysis.controllingPair,
          wedgeTrend: analysis.wedgeTrend,
          wedgePlunge: analysis.wedgePlunge,
          confidenceSummary: analysis.decision.confidenceNote
        },
        wedgeGeometry: analysis.wedgeTrend != null && analysis.wedgePlunge != null ? {
          weight: estimatedWeight.weight,
          plunge: analysis.wedgePlunge,
          trend: analysis.wedgeTrend,
          isAdmissible: Boolean(kinematicResult?.wedgePossible ?? true),
          controllingPair: analysis.controllingPair
        } : currentState.wedgeGeometry,
        wedgeFoS: analysis.fosCombined !== null ? {
          fos: analysis.fos ?? 0,
          fosShotcrete: analysis.fosShotcrete ?? 0,
          fosBolt: analysis.fosBolt ?? 0,
          fosCombined: analysis.fosCombined,
          drivingForce: analysis.breakdown.driving,
          resistingForce: analysis.breakdown.resisting,
          stabilityClass: analysis.stabilityClass,
          interpretation: analysis.interpretation
        } : currentState.wedgeFoS,
        supportEstimation: {
          shotcrete: shotcreteThicknessValue > 0 ? {
            traceLengthM: shotcreteTraceLengthValue,
            thicknessMm: shotcreteThicknessValue,
            shearStrengthKpa: shotcreteShearStrengthValue,
            reductionFactor: shotcreteReductionValue
          } : null,
          bolt: boltCapacityValue > 0 ? {
            capacityKn: boltCapacityValue,
            trendDeg: boltTrendValue,
            plungeDeg: boltPlungeValue,
            effectiveness: boltEffectivenessValue,
            number: boltNumberValue
          } : null,
          anchor: anchorForceValue > 0 ? {
            capacityKn: anchorForceValue,
            trendDeg: anchorTrendValue,
            plungeDeg: anchorPlungeValue,
            effectiveness: anchorEffectivenessValue,
            number: anchorNumberValue
          } : null,
          contribution: {
            shotcreteKn: analysis.breakdown.shotcrete,
            boltKn: analysis.breakdown.bolt,
            anchorKn: analysis.breakdown.anchor,
            combinedKn: analysis.breakdown.shotcrete + analysis.breakdown.bolt + analysis.breakdown.anchor
          }
        },
        riskScreening: riskScreening ? {
          sizeClass: estimatedWeight.sizeClass,
          exposure,
          trigger,
          finalRisk: riskScreening.finalRisk
        } : currentState.riskScreening,
        recommendationBasis: supportRecommendation?.basis ?? supportAdvice
      });
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Wedge FoS:', error);
      alert('Failed to save Wedge FoS.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
        <div className="text-slate-500">Loading analysis data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Wedge FoS Analysis" />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            Structural Assessment not yet run or data not available.
          </div>
        </div>
      </div>
    );
  }

  if (!kinematicResult?.wedgePossible) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Wedge FoS Analysis" />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            Structural Assessment run but no kinematically admissible wedge identified.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <PageHeader title="Wedge FoS Analysis" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {dataSource && (
            <div className={`mb-4 p-2 rounded text-xs font-bold text-center ${dataSource.includes('No') ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {dataSource}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center">
              <Home className="w-4 h-4 mr-1" /> Home
            </button>
          </div>

          <div className="space-y-6">
            <WedgeFoSParameterPanel
              controllingPair={analysis!.controllingPair || data.controllingPair || 'N/A'}
              wedgePlunge={analysis?.wedgePlunge ?? data.wedgePlunge ?? 0}
              wedgeTrend={analysis?.wedgeTrend ?? data.wedgeTrend ?? 0}
              weightMode={weightMode}
              setWeightMode={setWeightMode}
              weight={weight}
              setWeight={setWeight}
              wedgeHeight={wedgeHeight}
              setWedgeHeight={setWedgeHeight}
              s1={s1}
              setS1={setS1}
              s2={s2}
              setS2={setS2}
              persistenceSelection={persistenceSelection}
              setPersistenceSelection={setPersistenceSelection}
              persistenceFactor={persistenceFactor}
              setPersistenceFactor={setPersistenceFactor}
              unitWeightSelection={unitWeightSelection}
              setUnitWeightSelection={setUnitWeightSelection}
              unitWeight={unitWeight}
              setUnitWeight={setUnitWeight}
              frictionSelection={frictionSelection}
              setFrictionSelection={setFrictionSelection}
              frictionAngle={frictionAngle}
              setFrictionAngle={setFrictionAngle}
              cohesionSelection={cohesionSelection}
              setCohesionSelection={setCohesionSelection}
              cohesion={cohesion}
              setCohesion={setCohesion}
              groundwater={groundwater}
              setGroundwater={setGroundwater}
              customGroundwaterPressure={customGroundwaterPressure}
              setCustomGroundwaterPressure={setCustomGroundwaterPressure}
              supportType={supportType}
              setSupportType={setSupportType}
              shotcreteTraceLength={shotcreteTraceLength}
              setShotcreteTraceLength={setShotcreteTraceLength}
              shotcreteThicknessSelection={shotcreteThicknessSelection}
              setShotcreteThicknessSelection={setShotcreteThicknessSelection}
              shotcreteThickness={shotcreteThickness}
              setShotcreteThickness={setShotcreteThickness}
              shotcreteShearSelection={shotcreteShearSelection}
              setShotcreteShearSelection={setShotcreteShearSelection}
              shotcreteShearStrength={shotcreteShearStrength}
              setShotcreteShearStrength={setShotcreteShearStrength}
              shotcreteReductionSelection={shotcreteReductionSelection}
              setShotcreteReductionSelection={setShotcreteReductionSelection}
              shotcreteReduction={shotcreteReduction}
              setShotcreteReduction={setShotcreteReduction}
              boltCapacitySelection={boltCapacitySelection}
              setBoltCapacitySelection={setBoltCapacitySelection}
              boltCapacity={boltCapacity}
              setBoltCapacity={setBoltCapacity}
              boltNumber={boltNumber}
              setBoltNumber={setBoltNumber}
              boltTrend={boltTrend}
              setBoltTrend={setBoltTrend}
              boltPlunge={boltPlunge}
              setBoltPlunge={setBoltPlunge}
              boltEffectivenessSelection={boltEffectivenessSelection}
              setBoltEffectivenessSelection={setBoltEffectivenessSelection}
              boltEffectiveness={boltEffectiveness}
              setBoltEffectiveness={setBoltEffectiveness}
              anchorCapacitySelection={anchorCapacitySelection}
              setAnchorCapacitySelection={setAnchorCapacitySelection}
              anchorForce={anchorForce}
              setAnchorForce={setAnchorForce}
              anchorNumber={anchorNumber}
              setAnchorNumber={setAnchorNumber}
              anchorTrend={anchorTrend}
              setAnchorTrend={setAnchorTrend}
              anchorPlunge={anchorPlunge}
              setAnchorPlunge={setAnchorPlunge}
              anchorEffectivenessSelection={anchorEffectivenessSelection}
              setAnchorEffectivenessSelection={setAnchorEffectivenessSelection}
              anchorEffectiveness={anchorEffectiveness}
              setAnchorEffectiveness={setAnchorEffectiveness}
              showShotcreteWarning={Boolean(analysis && analysis.breakdown.shotcrete > (estimatedWeight.weight * 0.5))}
            />

            <WedgeFoSResultPanels
              analysis={analysis!}
              riskClass={riskScreening?.finalRisk || 'N/A'}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>
      <SaveSuccessModal 
        isOpen={showSuccessModal} 
        entryId={savedEntryId}
        onContinue={() => {
          setShowSuccessModal(false);
          setSavedEntryId(null);
          navigate(-1);
        }}
      />
    </div>
  );
}





