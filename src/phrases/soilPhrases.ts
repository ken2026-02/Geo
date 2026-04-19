export const buildBearingCapacityParagraph = (
  overallPass: boolean,
  controllingMethod: string | null,
  controllingLayer: string | null,
  controllingRatio: number,
  allowable: number
): string => {
  const outcome = overallPass ? 'acceptable' : 'not acceptable';
  const method = controllingMethod ? ` The controlling method is ${controllingMethod}.` : '';
  const layer = controllingLayer ? ` The controlling layer is ${controllingLayer}.` : '';
  const ratioText = Number.isFinite(controllingRatio) && controllingRatio > 0 ? ` Worst applied/allowable ratio is ${controllingRatio.toFixed(2)}.` : '';
  return `Platform bearing screening indicates the current profile is ${outcome}. Governing allowable bearing capacity is ${allowable.toFixed(1)} kPa.${method}${layer}${ratioText} Review the controlling layer and method before issue or field use.`;
};

export const buildEarthPressureParagraph = (
  ka: number,
  force: number,
  application: number
): string => {
  return `Indicative earth pressure assessment indicates a pressure coefficient of ${ka.toFixed(2)}, with a resultant force of ${force.toFixed(1)} kN/m acting at ${application.toFixed(1)} m above the base. This is a preliminary assessment; final design requires engineering verification.`;
};

export const buildSettlementScreeningParagraph = (
  settlementRisk: string,
  diffSettlementRisk: string
): string => {
  return `Settlement screening indicates a ${settlementRisk} risk for total settlement and a ${diffSettlementRisk} risk for differential settlement. This is a preliminary assessment; final design requires engineering verification.`;
};

export const buildRetainingWallParagraph = (
  slidingFs: number,
  overturningFs: number,
  bearingPressure: number,
  controllingIssue: string
): string => {
  return `Preliminary retaining wall screening indicates a sliding factor of safety of ${slidingFs.toFixed(2)} and overturning factor of safety of ${overturningFs.toFixed(2)}. Bearing pressures are estimated at ${bearingPressure.toFixed(1)} kPa. The controlling issue appears to be ${controllingIssue}. This is a preliminary geotechnical/structural screening result and not final wall design.`;
};

export const buildSoilSlopeParagraph = (
  concern: string,
  fsBand: string,
  factor: string
): string => {
  return `Preliminary slope stability screening indicates ${concern} concern, primarily due to ${factor}. The indicative factor-of-safety band is ${fsBand}. This is a screening tool; drainage and geotechnical inspection are recommended.`;
};

export const buildSoilEngineeringBrainParagraph = (
  summary: string
): string => {
  return `Soil Engineering Brain Summary: ${summary} This is a preliminary assessment; final design requires engineering verification.`;
};
