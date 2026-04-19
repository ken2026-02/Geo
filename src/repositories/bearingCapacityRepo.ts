import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type {
  BearingCheckResult,
  BearingLayerInput,
  BearingReportMeta,
} from '../engineering/bearingCapacitySpreadsheet';

export interface BearingCapacityAssessment {
  id: string;
  entry_id: string;
  title: string | null;
  geotech_ref: string | null;
  machinery: string | null;
  assessment_date: string | null;
  prepared_by: string | null;
  pressure_kpa: number | null;
  track_length_m: number | null;
  track_width_m: number | null;
  platform_thickness_m: number | null;
  factor_of_safety: number | null;
  footing_width: number | null;
  footing_depth: number | null;
  unit_weight: number | null;
  cohesion: number | null;
  friction_angle: number | null;
  groundwater_depth: number | null;
  ultimate_bearing_capacity: number;
  allowable_bearing_capacity: number;
  controlling_mode: string;
  controlling_layer: string | null;
  overall_pass: number;
  platform_json: string | null;
  layers_json: string | null;
  result_json: string | null;
  chart_json: string | null;
  basis_version: string | null;
  notes: string;
}

export interface BearingCapacityAssessmentRecord extends Omit<BearingCapacityAssessment, 'platform_json' | 'layers_json' | 'result_json' | 'chart_json'> {
  platform: BearingLayerInput | null;
  layers: BearingLayerInput[];
  result: BearingCheckResult | null;
  chart: BearingCheckResult['chart'] | null;
}

export interface BearingCapacityCreateInput {
  entry_id: string;
  meta: BearingReportMeta;
  pressure_kpa: number;
  track_length_m: number;
  track_width_m: number;
  platform_thickness_m: number;
  factor_of_safety: number;
  ultimate_bearing_capacity: number;
  allowable_bearing_capacity: number;
  controlling_mode: string;
  controlling_layer: string | null;
  overall_pass: number;
  platform: BearingLayerInput;
  layers: BearingLayerInput[];
  result: BearingCheckResult;
  chart: BearingCheckResult['chart'];
  basis_version: string;
  notes: string;
}

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const mapRow = (row: BearingCapacityAssessment): BearingCapacityAssessmentRecord => ({
  ...row,
  platform: safeParse<BearingLayerInput>(row.platform_json),
  layers: safeParse<BearingLayerInput[]>(row.layers_json) || [],
  result: safeParse<BearingCheckResult>(row.result_json),
  chart: safeParse<BearingCheckResult['chart']>(row.chart_json),
});

export const bearingCapacityRepo = {
  create: async (data: BearingCapacityCreateInput): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO bearing_capacity_assessments (
        id, entry_id, title, geotech_ref, machinery, assessment_date, prepared_by,
        pressure_kpa, track_length_m, track_width_m, platform_thickness_m, factor_of_safety,
        footing_width, footing_depth, unit_weight, cohesion, friction_angle, groundwater_depth,
        ultimate_bearing_capacity, allowable_bearing_capacity, controlling_mode, controlling_layer,
        overall_pass, platform_json, layers_json, result_json, chart_json, basis_version, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.entry_id,
        data.meta.title,
        data.meta.geotechRef,
        data.meta.machinery,
        data.meta.assessmentDate,
        data.meta.preparedBy,
        data.pressure_kpa,
        data.track_length_m,
        data.track_width_m,
        data.platform_thickness_m,
        data.factor_of_safety,
        data.track_width_m,
        data.platform_thickness_m,
        data.platform.gammaKNm3,
        data.platform.cKPa,
        data.platform.phiDeg,
        null,
        data.ultimate_bearing_capacity,
        data.allowable_bearing_capacity,
        data.controlling_mode,
        data.controlling_layer,
        data.overall_pass,
        JSON.stringify(data.platform),
        JSON.stringify(data.layers),
        JSON.stringify(data.result),
        JSON.stringify(data.chart),
        data.basis_version,
        data.notes,
      ]
    );
    return id;
  },
  getByEntryId: (entryId: string): BearingCapacityAssessmentRecord | null => {
    const results = query<BearingCapacityAssessment>('SELECT * FROM bearing_capacity_assessments WHERE entry_id = ?', [entryId]);
    return results[0] ? mapRow(results[0]) : null;
  },
  updateByEntryId: async (entryId: string, data: Omit<BearingCapacityCreateInput, 'entry_id'>): Promise<void> => {
    await execute(
      `UPDATE bearing_capacity_assessments SET
        title = ?,
        geotech_ref = ?,
        machinery = ?,
        assessment_date = ?,
        prepared_by = ?,
        pressure_kpa = ?,
        track_length_m = ?,
        track_width_m = ?,
        platform_thickness_m = ?,
        factor_of_safety = ?,
        footing_width = ?,
        footing_depth = ?,
        unit_weight = ?,
        cohesion = ?,
        friction_angle = ?,
        groundwater_depth = ?,
        ultimate_bearing_capacity = ?,
        allowable_bearing_capacity = ?,
        controlling_mode = ?,
        controlling_layer = ?,
        overall_pass = ?,
        platform_json = ?,
        layers_json = ?,
        result_json = ?,
        chart_json = ?,
        basis_version = ?,
        notes = ?
      WHERE entry_id = ?`,
      [
        data.meta.title,
        data.meta.geotechRef,
        data.meta.machinery,
        data.meta.assessmentDate,
        data.meta.preparedBy,
        data.pressure_kpa,
        data.track_length_m,
        data.track_width_m,
        data.platform_thickness_m,
        data.factor_of_safety,
        data.track_width_m,
        data.platform_thickness_m,
        data.platform.gammaKNm3,
        data.platform.cKPa,
        data.platform.phiDeg,
        null,
        data.ultimate_bearing_capacity,
        data.allowable_bearing_capacity,
        data.controlling_mode,
        data.controlling_layer,
        data.overall_pass,
        JSON.stringify(data.platform),
        JSON.stringify(data.layers),
        JSON.stringify(data.result),
        JSON.stringify(data.chart),
        data.basis_version,
        data.notes,
        entryId,
      ]
    );
  },
};
