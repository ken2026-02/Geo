export type BearingMethod = 'linear' | 'westergaard' | 'boussinesq';

export type DistributionBasisId =
  | 'manual'
  | 'cohesive-soft'
  | 'cohesive-firm'
  | 'cohesive-hard'
  | 'cohesionless-loose'
  | 'cohesionless-medium'
  | 'cohesionless-dense'
  | 'platform-unreinforced'
  | 'platform-reinforced';

export interface BearingLayerInput {
  id: string;
  name: string;
  description: string;
  thicknessM: number;
  suKPa: number;
  phiDeg: number;
  cKPa: number;
  gammaKNm3: number;
  nu: number;
  distributionRatio: number;
  distributionMode: 'auto' | 'manual';
  distributionBasisId: DistributionBasisId;
  reinforced?: boolean;
}

export interface BearingReportMeta {
  title: string;
  geotechRef: string;
  machinery: string;
  assessmentDate: string;
  preparedBy: string;
}

export interface BearingEquipmentInput {
  pressureKPa: number;
  trackLengthM: number;
  trackWidthM: number;
  bearingFOS: number;
}

export interface BearingCheckInput {
  meta: BearingReportMeta;
  equipment: BearingEquipmentInput;
  platform: BearingLayerInput;
  layers: BearingLayerInput[];
  notes: string;
}

export interface BearingFactors {
  nq: number;
  nc: number;
  ngamma: number;
}

export interface LayerBearingResult extends BearingFactors {
  qult: number;
  qall: number;
  overburdenKPa: number;
  strengthTermKPa: number;
}

export interface LayerStressResult {
  baseDepthM: number;
  pressureKPa: number;
}

export interface LayerCheck {
  layerId: string;
  layerName: string;
  description: string;
  baseDepthM: number;
  bearing: LayerBearingResult;
  stress: Record<BearingMethod, number>;
  pass: Record<BearingMethod, boolean>;
  worstRatio: number;
}

export interface BearingChartSeries {
  depths: number[];
  pressureLinear: number[];
  pressureWestergaard: number[];
  pressureBoussinesq: number[];
  allowableStep: number[];
}

export interface BearingCheckResult {
  allLayers: BearingLayerInput[];
  layerChecks: LayerCheck[];
  summary: {
    overallPass: boolean;
    controllingLayerId: string | null;
    controllingLayerName: string | null;
    controllingMethod: BearingMethod | null;
    controllingRatio: number;
    minimumMarginKPa: number;
  };
  chart: BearingChartSeries;
}

const BASE_DEPTH_EPSILON = 1e-6;

export const getAllBearingLayers = (input: BearingCheckInput): BearingLayerInput[] => [input.platform, ...input.layers];

export const calcBearingFactors = (phiDeg: number): BearingFactors => {
  if (phiDeg <= 0.1) {
    return { nq: 1, nc: 5.14, ngamma: 0 };
  }

  const phiRad = (phiDeg * Math.PI) / 180;
  const nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const nc = (nq - 1) / Math.tan(phiRad);
  const ngamma = Math.max(0, (nq - 1) * Math.tan(1.4 * phiRad));
  return { nq, nc, ngamma };
};

export const calcLayerBaseDepths = (allLayers: BearingLayerInput[]): number[] => {
  let running = 0;
  return allLayers.map((layer) => {
    running += layer.thicknessM;
    return Number(running.toFixed(6));
  });
};

export const calcLinearStressAtLayerBases = (input: BearingCheckInput): LayerStressResult[] => {
  const allLayers = getAllBearingLayers(input);
  const load = input.equipment.pressureKPa * input.equipment.trackLengthM * input.equipment.trackWidthM;
  let expandedLength = input.equipment.trackLengthM;
  let expandedWidth = input.equipment.trackWidthM;
  let runningDepth = 0;

  return allLayers.map((layer) => {
    expandedLength += 2 * layer.distributionRatio * layer.thicknessM;
    expandedWidth += 2 * layer.distributionRatio * layer.thicknessM;
    runningDepth += layer.thicknessM;
    const loadedAreaM2 = Math.max(0.001, expandedLength * expandedWidth);
    return {
      baseDepthM: Number(runningDepth.toFixed(6)),
      pressureKPa: load / loadedAreaM2,
    };
  });
};

export const calcWestergaardStressAtDepth = (
  pressureKPa: number,
  trackLengthM: number,
  trackWidthM: number,
  depthM: number,
  nu = 0.3
): number => {
  const z = Math.max(0.001, depthM);
  const m2 = Math.pow(trackWidthM / (2 * z), 2);
  const n2 = Math.pow(trackLengthM / (2 * z), 2);
  const n3 = Math.sqrt(Math.max(0.0001, (1 - 2 * nu) / (2 - 2 * nu)));
  const term1 = 1 / (2 * Math.PI);
  const term2 = 2 * Math.atan(1);
  const term3 = Math.atan(Math.sqrt(n3 * n3 * (1 / m2 + 1 / n2) + Math.pow(n3, 4) * (1 / (m2 * n2))));
  const i = term1 * (term2 - term3);
  return 4 * i * pressureKPa;
};

export const calcWestergaardStressAtLayerBases = (input: BearingCheckInput): LayerStressResult[] => {
  const allLayers = getAllBearingLayers(input);
  const baseDepths = calcLayerBaseDepths(allLayers);
  return allLayers.map((layer, index) => ({
    baseDepthM: baseDepths[index],
    pressureKPa: calcWestergaardStressAtDepth(
      input.equipment.pressureKPa,
      input.equipment.trackLengthM,
      input.equipment.trackWidthM,
      baseDepths[index],
      layer.nu || 0.3
    ),
  }));
};

export const calcBoussinesqStressAtDepth = (
  pressureKPa: number,
  trackLengthM: number,
  trackWidthM: number,
  depthM: number
): number => {
  const z = Math.max(0.001, depthM);
  const b = trackWidthM / 2;
  const m1 = trackLengthM / trackWidthM;
  const n1 = z / b;
  const term1 = 2 / Math.PI;
  const term2 = (m1 * n1) / Math.sqrt(1 + m1 * m1 + n1 * n1);
  const term3 = (1 + m1 * m1 + 2 * n1 * n1) / ((1 + n1 * n1) * (m1 * m1 + n1 * n1));
  const term4 = Math.asin(m1 / (Math.sqrt(m1 * m1 + n1 * n1) * Math.sqrt(1 + n1 * n1)));
  const i4 = term1 * (term2 * term3 + term4);
  return i4 * pressureKPa;
};

export const calcBoussinesqStressAtLayerBases = (input: BearingCheckInput): LayerStressResult[] => {
  const allLayers = getAllBearingLayers(input);
  const baseDepths = calcLayerBaseDepths(allLayers);
  return allLayers.map((_, index) => ({
    baseDepthM: baseDepths[index],
    pressureKPa: calcBoussinesqStressAtDepth(
      input.equipment.pressureKPa,
      input.equipment.trackLengthM,
      input.equipment.trackWidthM,
      baseDepths[index]
    ),
  }));
};

export const calcLayerAllowableBearing = (
  allLayers: BearingLayerInput[],
  layerIndex: number,
  trackWidthM: number,
  bearingFOS: number
): LayerBearingResult => {
  const layer = allLayers[layerIndex];
  const { nq, nc, ngamma } = calcBearingFactors(layer.phiDeg);
  const overburdenKPa = allLayers
    .slice(0, layerIndex)
    .reduce((sum, current) => sum + current.gammaKNm3 * current.thicknessM, 0);
  const strengthTermKPa = layer.cKPa + layer.suKPa;
  const qult =
    strengthTermKPa * nc +
    overburdenKPa * nq +
    0.5 * layer.gammaKNm3 * trackWidthM * ngamma;
  const qall = qult / Math.max(1, bearingFOS);
  return { nq, nc, ngamma, qult, qall, overburdenKPa, strengthTermKPa };
};

const createDepthSeries = (totalDepth: number, start: number, count: number): number[] => {
  const maxDepth = Math.max(start, Number((totalDepth * 1.5).toFixed(6)));
  if (count <= 1 || maxDepth <= start) return [start];
  const step = (maxDepth - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => Number((start + step * index).toFixed(6)));
};

const getLayerIndexForDepth = (depth: number, baseDepths: number[]): number => {
  for (let i = 0; i < baseDepths.length; i += 1) {
    if (depth < baseDepths[i] + BASE_DEPTH_EPSILON) return i;
  }
  return baseDepths.length - 1;
};

const interpolateLinearPressure = (depth: number, baseDepths: number[], basePressures: number[], surfacePressure: number): number => {
  if (depth <= 0) return surfacePressure;
  const points = [{ depth: 0, pressure: surfacePressure }, ...baseDepths.map((value, index) => ({ depth: value, pressure: basePressures[index] }))];
  for (let i = 1; i < points.length; i += 1) {
    if (depth <= points[i].depth + BASE_DEPTH_EPSILON) {
      const previous = points[i - 1];
      const current = points[i];
      const gradient = (current.pressure - previous.pressure) / Math.max(BASE_DEPTH_EPSILON, current.depth - previous.depth);
      return previous.pressure + gradient * (depth - previous.depth);
    }
  }
  return points[points.length - 1].pressure;
};

export const evaluateBearingCheck = (input: BearingCheckInput): BearingCheckResult => {
  const allLayers = getAllBearingLayers(input);
  const baseDepths = calcLayerBaseDepths(allLayers);
  const linearBase = calcLinearStressAtLayerBases(input);
  const westergaardBase = calcWestergaardStressAtLayerBases(input);
  const boussinesqBase = calcBoussinesqStressAtLayerBases(input);

  const layerChecks: LayerCheck[] = allLayers.map((layer, index) => {
    const bearing = calcLayerAllowableBearing(allLayers, index, input.equipment.trackWidthM, input.equipment.bearingFOS);
    const stress = {
      linear: linearBase[index].pressureKPa,
      westergaard: westergaardBase[index].pressureKPa,
      boussinesq: boussinesqBase[index].pressureKPa,
    };
    const ratios = {
      linear: stress.linear / Math.max(BASE_DEPTH_EPSILON, bearing.qall),
      westergaard: stress.westergaard / Math.max(BASE_DEPTH_EPSILON, bearing.qall),
      boussinesq: stress.boussinesq / Math.max(BASE_DEPTH_EPSILON, bearing.qall),
    };
    return {
      layerId: layer.id,
      layerName: layer.name,
      description: layer.description,
      baseDepthM: baseDepths[index],
      bearing,
      stress,
      pass: {
        linear: stress.linear <= bearing.qall,
        westergaard: stress.westergaard <= bearing.qall,
        boussinesq: stress.boussinesq <= bearing.qall,
      },
      worstRatio: Math.max(ratios.linear, ratios.westergaard, ratios.boussinesq),
    };
  });

  let controllingLayerId: string | null = null;
  let controllingLayerName: string | null = null;
  let controllingMethod: BearingMethod | null = null;
  let controllingRatio = 0;
  let minimumMarginKPa = Number.POSITIVE_INFINITY;

  layerChecks.forEach((check) => {
    (['linear', 'westergaard', 'boussinesq'] as BearingMethod[]).forEach((method) => {
      const applied = check.stress[method];
      const ratio = applied / Math.max(BASE_DEPTH_EPSILON, check.bearing.qall);
      const margin = check.bearing.qall - applied;
      if (ratio > controllingRatio) {
        controllingRatio = ratio;
        controllingLayerId = check.layerId;
        controllingLayerName = check.layerName;
        controllingMethod = method;
      }
      if (margin < minimumMarginKPa) {
        minimumMarginKPa = margin;
      }
    });
  });

  const depthSeries = createDepthSeries(baseDepths[baseDepths.length - 1] || input.platform.thicknessM, 0.01, 36);
  const linearBasePressures = linearBase.map((item) => item.pressureKPa);
  const chart: BearingChartSeries = {
    depths: depthSeries,
    pressureLinear: depthSeries.map((depth) => interpolateLinearPressure(depth, baseDepths, linearBasePressures, input.equipment.pressureKPa)),
    pressureWestergaard: depthSeries.map((depth) => {
      const layerIndex = getLayerIndexForDepth(depth, baseDepths);
      return calcWestergaardStressAtDepth(
        input.equipment.pressureKPa,
        input.equipment.trackLengthM,
        input.equipment.trackWidthM,
        depth,
        allLayers[layerIndex]?.nu || 0.3
      );
    }),
    pressureBoussinesq: depthSeries.map((depth) =>
      calcBoussinesqStressAtDepth(
        input.equipment.pressureKPa,
        input.equipment.trackLengthM,
        input.equipment.trackWidthM,
        depth
      )
    ),
    allowableStep: depthSeries.map((depth) => {
      const layerIndex = getLayerIndexForDepth(depth, baseDepths);
      return layerChecks[layerIndex]?.bearing.qall ?? layerChecks[layerChecks.length - 1]?.bearing.qall ?? 0;
    }),
  };

  return {
    allLayers,
    layerChecks,
    summary: {
      overallPass: layerChecks.every((check) => check.pass.linear && check.pass.westergaard && check.pass.boussinesq),
      controllingLayerId,
      controllingLayerName,
      controllingMethod,
      controllingRatio,
      minimumMarginKPa: Number.isFinite(minimumMarginKPa) ? minimumMarginKPa : 0,
    },
    chart,
  };
};
