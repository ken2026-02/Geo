import { engineeringDataService } from '../services/engineeringDataService';
import { getSupportDesign } from '../rules/supportDesignRules';

export interface EngineeringSummary {
  locationId: string;
  qValue: number | null;
  rmrValue: number | null;
  gsiValue: number | null;
  rockMassQuality: {
    condition: 'Very Good' | 'Good' | 'Fair' | 'Poor' | 'Very Poor' | 'Insufficient classification data';
    source: 'RMR' | 'Q' | 'GSI' | 'None';
    value: number | null;
  };
  structuralHazard: {
    failureMode: string;
    hazardLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  };
  indicativeSupport: string;
  monitoring: string[];
  latestWedge: string | null;
  fieldAction: string;
  interpretation: string;
}

const normalizeHazard = (value: string | null | undefined): 'Low' | 'Moderate' | 'High' | 'Critical' => {
  switch ((value || '').toUpperCase()) {
    case 'MODERATE':
      return 'Moderate';
    case 'HIGH':
      return 'High';
    case 'CRITICAL':
      return 'Critical';
    default:
      return 'Low';
  }
};

const hasAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));
const hasObservation = (observations: string[], patterns: RegExp[]): boolean => observations.some((item) => hasAny(item.toLowerCase(), patterns));

const higherHazard = (
  a: 'Low' | 'Moderate' | 'High' | 'Critical',
  b: 'Low' | 'Moderate' | 'High' | 'Critical'
): 'Low' | 'Moderate' | 'High' | 'Critical' => {
  const rank = { Low: 0, Moderate: 1, High: 2, Critical: 3 } as const;
  return rank[a] >= rank[b] ? a : b;
};

export const getEngineeringSummary = async (projectId: string, locationId: string): Promise<EngineeringSummary> => {
  const snapshot = engineeringDataService.getEngineeringSnapshotByLocation(locationId);

  let condition: EngineeringSummary['rockMassQuality']['condition'] = 'Insufficient classification data';
  let source: EngineeringSummary['rockMassQuality']['source'] = 'None';
  let value: number | null = null;

  if (snapshot.rmr !== null) {
    source = 'RMR';
    value = snapshot.rmr;
    if (snapshot.rmr >= 81) condition = 'Very Good';
    else if (snapshot.rmr >= 61) condition = 'Good';
    else if (snapshot.rmr >= 41) condition = 'Fair';
    else if (snapshot.rmr >= 21) condition = 'Poor';
    else condition = 'Very Poor';
  } else if (snapshot.q !== null) {
    source = 'Q';
    value = snapshot.q;
    if (snapshot.q > 10) condition = 'Good';
    else if (snapshot.q >= 1) condition = 'Fair';
    else if (snapshot.q >= 0.1) condition = 'Poor';
    else condition = 'Very Poor';
  } else if (snapshot.gsi_mid !== null) {
    source = 'GSI';
    value = snapshot.gsi_mid;
    if (snapshot.gsi_mid >= 75) condition = 'Very Good';
    else if (snapshot.gsi_mid >= 55) condition = 'Good';
    else if (snapshot.gsi_mid >= 35) condition = 'Fair';
    else if (snapshot.gsi_mid >= 15) condition = 'Poor';
    else condition = 'Very Poor';
  }

  let failureMode = snapshot.structural_mode || 'None observed';
  let hazardLevel: EngineeringSummary['structuralHazard']['hazardLevel'] = normalizeHazard(snapshot.structural_hazard);

  if (snapshot.wedge_fos_combined !== null) {
    if (failureMode === 'No mechanism' || failureMode === 'None observed') {
      failureMode = 'Wedge';
    } else if (failureMode !== 'Wedge' && failureMode !== 'Multiple mechanisms') {
      failureMode = 'Multiple mechanisms';
    }
    if (snapshot.wedge_fos_combined < 1.0) hazardLevel = 'Critical';
    else if (snapshot.wedge_fos_combined < 1.3) hazardLevel = higherHazard(hazardLevel, 'High');
    else hazardLevel = higherHazard(hazardLevel, 'Moderate');
  }
  if (snapshot.wedge_review_required) {
    hazardLevel = higherHazard(hazardLevel, snapshot.wedge_fos_combined !== null && snapshot.wedge_fos_combined < 1 ? 'Critical' : 'High');
  }

  const quickLogText = [snapshot.quick_log_trigger, snapshot.quick_log_summary].filter(Boolean).join(' ').toLowerCase();
  const quickLogObservations = snapshot.quick_log_observations.map((item) => item.toLowerCase());

  const groundwaterObserved = snapshot.mapping_groundwater_present || snapshot.mapping_joint_water_present || hasAny(quickLogText, [/water /, /drainage/, /seepage/, /wet/]) || hasObservation(quickLogObservations, [/water /, /drainage/, /seepage/, /wet/]);
  const looseRockObserved = hasObservation(quickLogObservations, [/loose block/, /loose rock/, /ravelling/, /ravel/, /rockfall/]) || hasAny(quickLogText, [/loose block/, /loose rock/, /ravelling/, /ravel/, /rockfall/]);
  const persistenceObserved = snapshot.mapping_persistence_present || hasObservation(quickLogObservations, [/persistent/, /through-going/]) || hasAny(quickLogText, [/persistent/, /through-going/]);
  const blockyGroundObserved = snapshot.mapping_aperture_present || snapshot.mapping_set_count >= 3 || hasObservation(quickLogObservations, [/blocky/, /overhang/, /open joint/]) || hasAny(quickLogText, [/blocky/, /overhang/, /open joint/]);
  const weatheringObserved = hasObservation(quickLogObservations, [/weathered/, /decomposed/]) || hasAny(quickLogText, [/weathered/, /decomposed/]);
  const blastDamageObserved = hasObservation(quickLogObservations, [/blast/, /overbreak/]) || hasAny(quickLogText, [/blast/, /overbreak/]);

  let hazardScore = hazardLevel === 'Critical' ? 30 : hazardLevel === 'High' ? 20 : hazardLevel === 'Moderate' ? 10 : 0;
  if (looseRockObserved) hazardScore += 10;
  if (blockyGroundObserved) hazardScore += 10;
  if (persistenceObserved) hazardScore += 10;
  if (groundwaterObserved) hazardScore += 5;
  if (weatheringObserved) hazardScore += 5;
  if (blastDamageObserved) hazardScore += 10;

  if (hazardScore >= 30) hazardLevel = 'Critical';
  else if (hazardScore >= 20) hazardLevel = 'High';
  else if (hazardScore >= 10) hazardLevel = 'Moderate';
  else hazardLevel = 'Low';

  let indicativeSupport = snapshot.support_class || snapshot.wedge_support_recommendation || 'Not available';
  if (snapshot.q !== null) {
    const support = getSupportDesign(snapshot.q, hazardLevel, groundwaterObserved ? 'Wet' : 'Dry', snapshot.wedge_fos_combined, failureMode);
    indicativeSupport = support.label;
  } else if (snapshot.rmr !== null) {
    if (snapshot.rmr > 60) indicativeSupport = 'Spot bolts as required';
    else if (snapshot.rmr >= 40) indicativeSupport = 'Pattern bolts with routine scaling';
    else if (snapshot.rmr >= 20) indicativeSupport = 'Pattern bolts with mesh';
    else indicativeSupport = 'Heavy temporary support and geotechnical review';
  } else if (hazardLevel === 'High' || hazardLevel === 'Critical') {
    indicativeSupport = 'Scaling and support review required';
  }

  if (snapshot.wedge_support_recommendation) {
    indicativeSupport = snapshot.wedge_support_recommendation;
  }
  if (groundwaterObserved && !indicativeSupport.toLowerCase().includes('drainage')) {
    indicativeSupport = `${indicativeSupport}; drainage review required`;
  }
  if (blastDamageObserved && !indicativeSupport.toLowerCase().includes('review')) {
    indicativeSupport = `${indicativeSupport}; support review after blasting`;
  }
  if (persistenceObserved && !indicativeSupport.toLowerCase().includes('mesh')) {
    indicativeSupport = `${indicativeSupport}; consider mesh for loose blocks`;
  }

  const monitoring: string[] = [];
  if (snapshot.wedge_action_level) monitoring.push(snapshot.wedge_action_level);
  if (hazardLevel === 'Critical') monitoring.push('Geotechnical review required before further exposure');
  else if (hazardLevel === 'High') monitoring.push('Increase geotechnical inspection and monitor movement');
  else if (hazardLevel === 'Moderate') monitoring.push('Inspect after rain, blasting and scaling');
  else monitoring.push('Routine geotechnical inspection');

  if (groundwaterObserved || snapshot.wedge_fos_combined !== null) {
    monitoring.push('Drainage review required and inspect wet areas');
  }
  if (looseRockObserved || blockyGroundObserved) {
    monitoring.push('Scaling required where loose or blocky rock is present');
  }
  if (blastDamageObserved) {
    monitoring.push('Review support after blasting or overbreak');
  }
  if (snapshot.wedge_review_required) {
    monitoring.push('Pattern support review required for the latest wedge assessment');
  }

  const uniqueMonitoring = Array.from(new Set(monitoring));
  const qualityReference = source === 'None' ? 'insufficient classification data' : `${source} = ${value}`;
  const latestWedge = snapshot.wedge_fos_combined !== null
    ? `Latest wedge check: FoS ${snapshot.wedge_fos_combined.toFixed(2)}${snapshot.wedge_controlling_pair ? ` on ${snapshot.wedge_controlling_pair}` : ''}${snapshot.wedge_trend != null && snapshot.wedge_plunge != null ? ` (trend/plunge ${Math.round(snapshot.wedge_trend)}/${Math.round(snapshot.wedge_plunge)})` : ''}.`
    : null;
  const groundwaterText = groundwaterObserved ? 'Groundwater or wet defect conditions were noted in the latest structured field records.' : 'No clear groundwater issue is evident in the latest structured field records.';
  const blastText = blastDamageObserved ? ' Blast damage or overbreak has been noted and support should be reviewed after excavation advance.' : '';
  const fieldAction = snapshot.wedge_action_level || uniqueMonitoring[0] || 'Routine geotechnical inspection';

  const interpretation = `Rock mass condition: ${condition} (${qualityReference}). Structural risk: ${hazardLevel} from ${failureMode}. ${groundwaterText}${blastText}${latestWedge ? ` ${latestWedge}` : ''} Field support / control: ${indicativeSupport}. Shift action: ${fieldAction}.`;

  return {
    locationId,
    qValue: snapshot.q,
    rmrValue: snapshot.rmr,
    gsiValue: snapshot.gsi_mid,
    rockMassQuality: { condition, source, value },
    structuralHazard: {
      failureMode,
      hazardLevel
    },
    indicativeSupport,
    monitoring: uniqueMonitoring,
    latestWedge,
    fieldAction,
    interpretation
  };
};
