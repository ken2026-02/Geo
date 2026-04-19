import { query, ensureQuickLogEntriesTable } from '../db/db';
import { AUTHORITATIVE_FIELDS } from '../engineering/authoritativeFields';

interface QuickLogSnapshotRow {
  summary: string | null;
  trigger_category: string | null;
  risk_label: string | null;
  review_required: number | null;
  selected_observations: string | null;
  entry_id?: string;
}

interface MappingSnapshotRow {
  id: string;
  groundwater_id: string | null;
}

interface MappingSetSnapshotRow {
  persistence_id: string | null;
  aperture_id: string | null;
  water_id: string | null;
}

const parseSelectedObservations = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export interface EngineeringSnapshot {
  q: number | null;
  q_entry_id?: string;
  rmr: number | null;
  rmr_entry_id?: string;
  gsi_mid: number | null;
  gsi_range: { min: number; max: number } | null;
  gsi_entry_id?: string;
  structural_mode: string | null;
  structural_hazard: string | null;
  structural_entry_id?: string;
  support_class: string | null;
  support_entry_id?: string;
  wedge_fos: number | null;
  wedge_fos_combined: number | null;
  wedge_risk_class: string | null;
  wedge_action_level: string | null;
  wedge_support_recommendation: string | null;
  wedge_review_required: boolean;
  wedge_controlling_pair: string | null;
  wedge_trend: number | null;
  wedge_plunge: number | null;
  wedge_stability_class: string | null;
  wedge_support_type: string | null;
  wedge_entry_id?: string;
  quick_log_summary: string | null;
  quick_log_trigger: string | null;
  quick_log_risk_level: string | null;
  quick_log_review_required: boolean;
  quick_log_observations: string[];
  quick_log_entry_id?: string;
  mapping_set_count: number;
  mapping_groundwater_present: boolean;
  mapping_persistence_present: boolean;
  mapping_aperture_present: boolean;
  mapping_joint_water_present: boolean;
}

export const engineeringDataService = {
  getLatestQByLocation(locationId: string) {
    const res = query<any>(`
      SELECT qa.*, e.id as entry_id
      FROM q_assessments qa
      JOIN entries e ON qa.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestRMRByLocation(locationId: string) {
    const res = query<any>(`
      SELECT ra.*, e.id as entry_id
      FROM rmr_assessments ra
      JOIN entries e ON ra.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestGSIByLocation(locationId: string) {
    const res = query<any>(`
      SELECT ga.*, e.id as entry_id
      FROM gsi_assessments ga
      JOIN entries e ON ga.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestStructuralByLocation(locationId: string) {
    const res = query<any>(`
      SELECT sa.*, e.id as entry_id
      FROM structural_assessments sa
      JOIN entries e ON sa.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestSupportCalculatorByLocation(locationId: string) {
    const res = query<any>(`
      SELECT sdc.*, e.id as entry_id
      FROM support_design_calculations sdc
      JOIN entries e ON sdc.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestSupportDesignByLocation(locationId: string) {
    const res = query<any>(`
      SELECT sd.*, e.id as entry_id
      FROM support_designs sd
      JOIN entries e ON sd.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestWedgeFoSByLocation(locationId: string) {
    const res = query<any>(`
      SELECT wf.*, e.id as entry_id
      FROM wedge_fos_assessments wf
      JOIN entries e ON wf.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestQuickLogByLocation(locationId: string) {
    ensureQuickLogEntriesTable();
    const res = query<QuickLogSnapshotRow>(`
      SELECT ql.*, e.id as entry_id, e.summary, rl.label as risk_label
      FROM quick_log_entries ql
      JOIN entries e ON ql.entry_id = e.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY ql.review_required DESC, rl.weight DESC, e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestMappingByLocation(locationId: string) {
    const mapping = query<MappingSnapshotRow>(`
      SELECT me.id, me.groundwater_id
      FROM mapping_entries me
      JOIN entries e ON me.entry_id = e.id
      WHERE e.location_id = ?
      AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId])[0];

    if (!mapping) return null;

    const sets = query<MappingSetSnapshotRow>(
      'SELECT persistence_id, aperture_id, water_id FROM discontinuity_sets WHERE mapping_id = ?',
      [mapping.id]
    );

    return { ...mapping, sets };
  },

  getEngineeringSnapshotByLocation(locationId: string): EngineeringSnapshot {
    const q = this.getLatestQByLocation(locationId);
    const rmr = this.getLatestRMRByLocation(locationId);
    const gsi = this.getLatestGSIByLocation(locationId);
    const structural = this.getLatestStructuralByLocation(locationId);
    const support = this.getLatestSupportDesignByLocation(locationId) || this.getLatestSupportCalculatorByLocation(locationId);
    const wedge = this.getLatestWedgeFoSByLocation(locationId);
    const quickLog = this.getLatestQuickLogByLocation(locationId);
    const mapping = this.getLatestMappingByLocation(locationId);
    const quickLogObservations = parseSelectedObservations(quickLog?.selected_observations);

    return {
      q: q ? q[AUTHORITATIVE_FIELDS.Q_SYSTEM.field] : null,
      q_entry_id: q?.entry_id,
      rmr: rmr ? rmr[AUTHORITATIVE_FIELDS.RMR.field] : null,
      rmr_entry_id: rmr?.entry_id,
      gsi_mid: gsi ? gsi[AUTHORITATIVE_FIELDS.GSI.field] : null,
      gsi_range: gsi ? { min: gsi.gsi_min, max: gsi.gsi_max } : null,
      gsi_entry_id: gsi?.entry_id,
      structural_mode: structural ? structural[AUTHORITATIVE_FIELDS.STRUCTURAL.field] : null,
      structural_hazard: structural ? structural.hazard_level : null,
      structural_entry_id: structural?.entry_id,
      support_class: support ? support.support_class : null,
      support_entry_id: support?.entry_id,
      wedge_fos: wedge?.fos ?? null,
      wedge_fos_combined: wedge?.fos_combined ?? null,
      wedge_risk_class: wedge?.risk_class ?? null,
      wedge_action_level: wedge?.action_level ?? null,
      wedge_support_recommendation: wedge?.support_recommendation ?? null,
      wedge_review_required: Boolean(wedge?.review_required),
      wedge_controlling_pair: wedge?.controlling_pair ?? null,
      wedge_trend: wedge?.wedge_trend ?? null,
      wedge_plunge: wedge?.wedge_plunge ?? null,
      wedge_stability_class: wedge?.stability_class ?? null,
      wedge_support_type: wedge?.support_type ?? null,
      wedge_entry_id: wedge?.entry_id,
      quick_log_summary: quickLog?.summary ?? null,
      quick_log_trigger: quickLog?.trigger_category ?? null,
      quick_log_risk_level: quickLog?.risk_label ?? null,
      quick_log_review_required: Boolean(quickLog?.review_required),
      quick_log_observations: quickLogObservations,
      quick_log_entry_id: quickLog?.entry_id,
      mapping_set_count: mapping?.sets.length ?? 0,
      mapping_groundwater_present: Boolean(mapping?.groundwater_id),
      mapping_persistence_present: Boolean(mapping?.sets.some((set) => Boolean(set.persistence_id))),
      mapping_aperture_present: Boolean(mapping?.sets.some((set) => Boolean(set.aperture_id))),
      mapping_joint_water_present: Boolean(mapping?.sets.some((set) => Boolean(set.water_id)))
    };
  }
};

