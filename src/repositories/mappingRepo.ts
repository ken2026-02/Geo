import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface DiscontinuitySet {
  id?: string;
  mapping_id?: string;
  set_number: number;
  dip: number;
  dip_dir: number;
  spacing_id: string;
  persistence_id: string;
  aperture_id: string;
  roughness_id: string;
  infill_id: string;
  water_id: string;
}

export interface MappingEntry {
  id: string;
  entry_id: string;
  lithology_id: string;
  weathering_id: string;
  strength_id: string;
  structure_id: string;
  groundwater_id: string;
  sets?: DiscontinuitySet[];
}

export const mappingRepo = {
  create: async (mapping: Omit<MappingEntry, 'id'>, sets: DiscontinuitySet[]): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO mapping_entries (id, entry_id, lithology_id, weathering_id, strength_id, structure_id, groundwater_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, mapping.entry_id, mapping.lithology_id, mapping.weathering_id, mapping.strength_id, mapping.structure_id, mapping.groundwater_id]
    );

    for (const set of sets) {
      await execute(
        `INSERT INTO discontinuity_sets (id, mapping_id, set_number, dip, dip_dir, spacing_id, persistence_id, aperture_id, roughness_id, infill_id, water_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, set.set_number, set.dip, set.dip_dir, set.spacing_id, set.persistence_id, set.aperture_id, set.roughness_id, set.infill_id, set.water_id]
      );
    }

    return id;
  },

  getByEntryId: (entryId: string): MappingEntry | null => {
    const mapping = query<MappingEntry>('SELECT * FROM mapping_entries WHERE entry_id = ?', [entryId])[0];
    if (!mapping) return null;

    const sets = query<DiscontinuitySet>('SELECT * FROM discontinuity_sets WHERE mapping_id = ? ORDER BY set_number ASC', [mapping.id]);
    return { ...mapping, sets };
  },

  getLatestByProjectAndLocation: (projectId: string, locationId: string): MappingEntry | null => {
    const mapping = query<MappingEntry>(`
      SELECT me.*
      FROM mapping_entries me
      JOIN entries e ON me.entry_id = e.id
      WHERE e.project_id = ? AND e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [projectId, locationId])[0];
    if (!mapping) return null;

    const sets = query<DiscontinuitySet>('SELECT * FROM discontinuity_sets WHERE mapping_id = ? ORDER BY set_number ASC', [mapping.id]);
    return { ...mapping, sets };
  },

  updateByEntryId: async (entryId: string, mapping: Omit<MappingEntry, 'id' | 'entry_id' | 'sets'>, sets: DiscontinuitySet[]): Promise<void> => {
    const existing = query<MappingEntry>('SELECT * FROM mapping_entries WHERE entry_id = ?', [entryId])[0];
    if (!existing) {
      throw new Error(`Mapping entry not found for entry_id ${entryId}`);
    }

    await execute(
      `UPDATE mapping_entries
       SET lithology_id = ?, weathering_id = ?, strength_id = ?, structure_id = ?, groundwater_id = ?
       WHERE entry_id = ?`,
      [mapping.lithology_id, mapping.weathering_id, mapping.strength_id, mapping.structure_id, mapping.groundwater_id, entryId]
    );

    await execute('DELETE FROM discontinuity_sets WHERE mapping_id = ?', [existing.id]);
    for (const set of sets) {
      await execute(
        `INSERT INTO discontinuity_sets (id, mapping_id, set_number, dip, dip_dir, spacing_id, persistence_id, aperture_id, roughness_id, infill_id, water_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), existing.id, set.set_number, set.dip, set.dip_dir, set.spacing_id, set.persistence_id, set.aperture_id, set.roughness_id, set.infill_id, set.water_id]
      );
    }
  }
};
