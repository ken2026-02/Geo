import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteDrillingInterval, SiteDrillingRecord } from '../types/siteLogging';

export const siteDrillingRepo = {
  // Records
  listRecordsByElement: (elementId: string): SiteDrillingRecord[] => {
    return query<SiteDrillingRecord>(
      `SELECT * FROM site_drilling_records
       WHERE element_id = ?
       ORDER BY updated_at DESC`,
      [elementId]
    );
  },

  getRecordById: (id: string): SiteDrillingRecord | null => {
    return query<SiteDrillingRecord>('SELECT * FROM site_drilling_records WHERE id = ?', [id])[0] ?? null;
  },

  createRecord: async (data: Omit<SiteDrillingRecord, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_drilling_records (
        id, element_id, record_date, method, start_depth_m, end_depth_m, notes,
        start_date, end_date, logged_by, approved_by, record_page_count, general_note,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        data.element_id,
        data.record_date ?? null,
        data.method ?? null,
        data.start_depth_m ?? null,
        data.end_depth_m ?? null,
        data.notes ?? null,
        (data as any).start_date ?? null,
        (data as any).end_date ?? null,
        (data as any).logged_by ?? null,
        (data as any).approved_by ?? null,
        (data as any).record_page_count ?? null,
        (data as any).general_note ?? null,
      ]
    );
    return id;
  },

  updateRecord: async (id: string, patch: Partial<Omit<SiteDrillingRecord, 'id' | 'element_id'>>): Promise<void> => {
    const current = siteDrillingRepo.getRecordById(id);
    if (!current) return;
    await execute(
      `UPDATE site_drilling_records
       SET record_date = ?,
           method = ?,
           start_depth_m = ?,
           end_depth_m = ?,
           notes = ?,
           start_date = ?,
           end_date = ?,
           logged_by = ?,
           approved_by = ?,
           record_page_count = ?,
           general_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.record_date ?? current.record_date,
        patch.method ?? current.method,
        patch.start_depth_m ?? current.start_depth_m,
        patch.end_depth_m ?? current.end_depth_m,
        patch.notes ?? current.notes,
        patch.start_date ?? (current as any).start_date ?? null,
        patch.end_date ?? (current as any).end_date ?? null,
        patch.logged_by ?? (current as any).logged_by ?? null,
        patch.approved_by ?? (current as any).approved_by ?? null,
        patch.record_page_count ?? (current as any).record_page_count ?? null,
        patch.general_note ?? (current as any).general_note ?? null,
        id,
      ]
    );
  },

  deleteRecord: async (id: string): Promise<void> => {
    // hard delete is OK for Phase 1 scaffolding (raw logging is still the source of truth)
    await execute('DELETE FROM site_drilling_intervals WHERE record_id = ?', [id]);
    await execute('DELETE FROM site_drilling_records WHERE id = ?', [id]);
  },

  // Intervals
  listIntervalsByRecord: (recordId: string): SiteDrillingInterval[] => {
    return query<SiteDrillingInterval>(
      `SELECT * FROM site_drilling_intervals
       WHERE record_id = ?
       ORDER BY from_depth_m ASC`,
      [recordId]
    );
  },

  getIntervalById: (id: string): SiteDrillingInterval | null => {
    return query<SiteDrillingInterval>('SELECT * FROM site_drilling_intervals WHERE id = ?', [id])[0] ?? null;
  },

  createInterval: async (data: Omit<SiteDrillingInterval, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_drilling_intervals (
        id, record_id, from_depth_m, to_depth_m,
        observed_text, interpreted_text, recovery_text, water_text, response_text,
        drilling_time_min, material_observed, material_interpreted, colour, secondary_components_json,
        weathering_class, rock_type, recovery_type, water_condition, drilling_response_json,
        logging_phrase_output, free_text_note,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        data.record_id,
        data.from_depth_m,
        data.to_depth_m,
        data.observed_text ?? null,
        data.interpreted_text ?? null,
        data.recovery_text ?? null,
        data.water_text ?? null,
        data.response_text ?? null,
        (data as any).drilling_time_min ?? null,
        (data as any).material_observed ?? null,
        (data as any).material_interpreted ?? null,
        (data as any).colour ?? null,
        (data as any).secondary_components_json ?? null,
        (data as any).weathering_class ?? null,
        (data as any).rock_type ?? null,
        (data as any).recovery_type ?? null,
        (data as any).water_condition ?? null,
        (data as any).drilling_response_json ?? null,
        (data as any).logging_phrase_output ?? null,
        (data as any).free_text_note ?? null,
      ]
    );
    return id;
  },

  updateInterval: async (
    id: string,
    patch: Partial<Omit<SiteDrillingInterval, 'id' | 'record_id'>>
  ): Promise<void> => {
    const current = siteDrillingRepo.getIntervalById(id);
    if (!current) return;
    await execute(
      `UPDATE site_drilling_intervals
       SET from_depth_m = ?,
           to_depth_m = ?,
           observed_text = ?,
           interpreted_text = ?,
           recovery_text = ?,
           water_text = ?,
           response_text = ?,
           drilling_time_min = ?,
           material_observed = ?,
           material_interpreted = ?,
           colour = ?,
           secondary_components_json = ?,
           weathering_class = ?,
           rock_type = ?,
           recovery_type = ?,
           water_condition = ?,
           drilling_response_json = ?,
           logging_phrase_output = ?,
           free_text_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.from_depth_m ?? current.from_depth_m,
        patch.to_depth_m ?? current.to_depth_m,
        patch.observed_text ?? current.observed_text,
        patch.interpreted_text ?? current.interpreted_text,
        patch.recovery_text ?? current.recovery_text,
        patch.water_text ?? current.water_text,
        patch.response_text ?? current.response_text,
        (patch as any).drilling_time_min ?? (current as any).drilling_time_min ?? null,
        (patch as any).material_observed ?? (current as any).material_observed ?? null,
        (patch as any).material_interpreted ?? (current as any).material_interpreted ?? null,
        (patch as any).colour ?? (current as any).colour ?? null,
        (patch as any).secondary_components_json ?? (current as any).secondary_components_json ?? null,
        (patch as any).weathering_class ?? (current as any).weathering_class ?? null,
        (patch as any).rock_type ?? (current as any).rock_type ?? null,
        (patch as any).recovery_type ?? (current as any).recovery_type ?? null,
        (patch as any).water_condition ?? (current as any).water_condition ?? null,
        (patch as any).drilling_response_json ?? (current as any).drilling_response_json ?? null,
        (patch as any).logging_phrase_output ?? (current as any).logging_phrase_output ?? null,
        (patch as any).free_text_note ?? (current as any).free_text_note ?? null,
        id,
      ]
    );
  },

  deleteInterval: async (id: string): Promise<void> => {
    await execute('DELETE FROM site_drilling_intervals WHERE id = ?', [id]);
  },
};
