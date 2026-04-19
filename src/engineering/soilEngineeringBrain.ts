import { soilEngineeringDataService } from '../services/soilEngineeringDataService';
import { engineeringDataService } from '../services/engineeringDataService';

export interface SoilEngineeringSummary {
  locationId: string;
  soilCondition: {
    group: string;
    consistency: string;
    moisture: string;
    compressibility: string;
  };
  bearingSuitability: {
    allowable: number | null;
    status: 'Acceptable' | 'Review required' | 'Poor founding condition' | 'Not available';
    note: string;
  };
  lateralPressure: {
    state: string;
    coefficient: string;
    surchargeConcern: boolean;
    loadingConcern: 'Low' | 'Moderate' | 'High';
  };
  settlement: {
    concern: 'Low' | 'Moderate' | 'High' | 'Not available';
    differentialConcern: string;
    explanation: string;
  };
  stability: {
    wallResult: 'Pass' | 'Review' | 'Fail' | 'Not available';
    slopeConcern: 'Low' | 'Moderate' | 'High' | 'Critical' | 'Not available';
    controllingIssue: string;
  };
  monitoring: string[];
  interpretation: string;
}

const parseSettlementEstimate = (note?: string | null): number | null => {
  if (!note) return null;
  const match = note.match(/Estimated settlement[^\d]*([\d.]+)\s*mm/i);
  return match ? Number(match[1]) : null;
};

const hasObservation = (observations: string[], patterns: RegExp[]): boolean => observations.some((item) => patterns.some((pattern) => pattern.test(item.toLowerCase())));

export const getSoilEngineeringSummary = async (projectId: string, locationId: string): Promise<SoilEngineeringSummary> => {
  const bearing = soilEngineeringDataService.getLatestBearingCapacity(locationId);
  const earth = soilEngineeringDataService.getLatestEarthPressure(locationId);
  const settlement = soilEngineeringDataService.getLatestSettlementScreening(locationId);
  const wall = soilEngineeringDataService.getLatestRetainingWallCheck(locationId);
  const slope = soilEngineeringDataService.getLatestSoilSlopeStability(locationId);
  const investigation = soilEngineeringDataService.getLatestInvestigationLog(locationId);

  const snapshot = engineeringDataService.getEngineeringSnapshotByLocation(locationId);
  const quickLogText = [snapshot.quick_log_trigger, snapshot.quick_log_summary].filter(Boolean).join(' ').toLowerCase();
  const quickLogObservations = snapshot.quick_log_observations || [];

  const investigationMaterial = investigation?.material_label || investigation?.fill_type_label || investigation?.transition_material_label || null;
  const soilGroup = settlement?.soil_type || slope?.soil_type || investigationMaterial || 'Not available';
  const compressibility = settlement?.compressibility_flag || 'Not available';
  const moisture = settlement?.groundwater_condition || earth?.groundwater_condition || slope?.groundwater_condition || 'Not available';

  const soilCondition = {
    group: soilGroup,
    consistency: soilGroup === 'Clay' ? 'Cohesive' : soilGroup === 'Silt' ? 'Intermediate' : soilGroup === 'Sand' ? 'Granular' : 'Not available',
    moisture,
    compressibility,
  };

  let bearingStatus: 'Acceptable' | 'Review required' | 'Poor founding condition' | 'Not available' = 'Not available';
  if (bearing) {
    if (bearing.allowable_bearing_capacity > 150) bearingStatus = 'Acceptable';
    else if (bearing.allowable_bearing_capacity > 75) bearingStatus = 'Review required';
    else bearingStatus = 'Poor founding condition';
  }

  const surchargeConcern = (earth?.surcharge ?? 0) > 10 || hasObservation(quickLogObservations, [/wall movement/, /bulging/, /distortion/]) || /wall movement|bulging|distortion/.test(quickLogText);
  const loadingConcern: 'Low' | 'Moderate' | 'High' = (earth?.surcharge ?? 0) > 20 ? 'High' : (earth?.surcharge ?? 0) > 10 ? 'Moderate' : 'Low';
  const pressureState = earth?.pressure_state || 'Not available';
  const pressureCoefficient = earth?.coefficient != null ? `${pressureState === 'Passive' ? 'Kp' : pressureState === 'At-Rest' ? 'K0' : 'Ka'}=${Number(earth.coefficient).toFixed(2)}` : 'Not available';

  const settlementEstimate = parseSettlementEstimate(settlement?.design_note);
  const settlementConcern = (settlement?.settlement_risk as 'Low' | 'Moderate' | 'High' | undefined) || ((hasObservation(quickLogObservations, [/settlement/, /cracking/]) || /settlement observed|cracking/.test(quickLogText)) ? 'Moderate' : undefined) || 'Not available';
  const differentialConcern = settlement?.differential_settlement_risk || 'Not available';
  const settlementExplanation = settlement?.design_note || (settlementEstimate !== null ? `Estimated settlement is ${settlementEstimate.toFixed(1)} mm.` : 'No detailed explanation available.');

  const wallResult: SoilEngineeringSummary['stability']['wallResult'] = (wall?.stability_result as SoilEngineeringSummary['stability']['wallResult'] | undefined) || 'Not available';
  const slopeConcern: SoilEngineeringSummary['stability']['slopeConcern'] = (slope?.stability_concern as SoilEngineeringSummary['stability']['slopeConcern'] | undefined) || 'Not available';
  const stability: SoilEngineeringSummary['stability'] = {
    wallResult,
    slopeConcern,
    controllingIssue: wallResult === 'Fail' ? 'Retaining wall failure' : slopeConcern === 'Critical' ? 'Critical slope stability' : slope?.controlling_factor || 'None',
  };

  const monitoring: string[] = [];
  if (stability.wallResult === 'Fail' || stability.slopeConcern === 'Critical' || hasObservation(quickLogObservations, [/wall movement/, /bulging/]) || /wall movement|bulging/.test(quickLogText)) monitoring.push('Geotechnical review');
  if (surchargeConcern || snapshot.quick_log_review_required || hasObservation(quickLogObservations, [/seepage/, /erosion/, /ponding/]) || /seepage|erosion|ponding/.test(quickLogText)) monitoring.push('Drainage review');
  if (hasObservation(quickLogObservations, [/toe softening/, /slumping/]) || /toe softening|slumping/.test(quickLogText) || stability.slopeConcern === 'High') monitoring.push('Slope monitoring');
  if (monitoring.length === 0) monitoring.push('Routine inspection');

  const interpretation = `Ground model summary: ${soilCondition.group}. Bearing check status: ${bearingStatus}. Lateral pressure state: ${pressureState}. Settlement concern: ${settlementConcern}. Slope / wall stability concern: ${stability.slopeConcern}. Field response: ${monitoring[0] || 'Routine inspection'}. Summary is based on structured soil checks, investigation logs and latest field observations; final design still requires engineering verification.`;

  return {
    locationId,
    soilCondition,
    bearingSuitability: { allowable: bearing?.allowable_bearing_capacity || null, status: bearingStatus, note: 'Based on latest ET18 assessment.' },
    lateralPressure: {
      state: pressureState,
      coefficient: pressureCoefficient,
      surchargeConcern,
      loadingConcern,
    },
    settlement: {
      concern: settlementConcern,
      differentialConcern,
      explanation: settlementExplanation,
    },
    stability,
    monitoring,
    interpretation,
  };
};
