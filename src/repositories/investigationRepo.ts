import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export type InvestigationType = 'Cohesive' | 'Granular' | 'Fill' | 'Transition';

export interface InvestigationLogEntry {
  id: string;
  entry_id: string;
  investigation_type: InvestigationType;
  material_type_id: string | null;
  plasticity_id: string | null;
  moisture_id: string | null;
  consistency_id: string | null;
  structure_id: string | null;
  origin_id: string | null;
  secondary_components: string | null;
  grain_size_id: string | null;
  grading_id: string | null;
  fines_content_id: string | null;
  density_id: string | null;
  angularity_id: string | null;
  fill_type_id: string | null;
  composition_id: string | null;
  contaminant_id: string | null;
  inclusion_id: string | null;
  transition_material_id: string | null;
  notes: string | null;
}

export const investigationRepo = {
  create: async (data: Omit<InvestigationLogEntry, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO investigation_logs (
        id, entry_id, investigation_type, material_type_id, plasticity_id, moisture_id, consistency_id,
        structure_id, origin_id, secondary_components, grain_size_id, grading_id, fines_content_id,
        density_id, angularity_id, fill_type_id, composition_id, contaminant_id, inclusion_id,
        transition_material_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.entry_id,
        data.investigation_type,
        data.material_type_id,
        data.plasticity_id,
        data.moisture_id,
        data.consistency_id,
        data.structure_id,
        data.origin_id,
        data.secondary_components,
        data.grain_size_id,
        data.grading_id,
        data.fines_content_id,
        data.density_id,
        data.angularity_id,
        data.fill_type_id,
        data.composition_id,
        data.contaminant_id,
        data.inclusion_id,
        data.transition_material_id,
        data.notes
      ]
    );
    return id;
  },
  getByEntryId: (entryId: string): InvestigationLogEntry | null => {
    const results = query<InvestigationLogEntry>('SELECT * FROM investigation_logs WHERE entry_id = ?', [entryId]);
    return results[0] || null;
  },

  updateByEntryId: async (entryId: string, data: Omit<InvestigationLogEntry, 'id' | 'entry_id'>): Promise<void> => {
    await execute(
      `UPDATE investigation_logs
       SET investigation_type = ?,
           material_type_id = ?,
           plasticity_id = ?,
           moisture_id = ?,
           consistency_id = ?,
           structure_id = ?,
           origin_id = ?,
           secondary_components = ?,
           grain_size_id = ?,
           grading_id = ?,
           fines_content_id = ?,
           density_id = ?,
           angularity_id = ?,
           fill_type_id = ?,
           composition_id = ?,
           contaminant_id = ?,
           inclusion_id = ?,
           transition_material_id = ?,
           notes = ?
       WHERE entry_id = ?`,
      [
        data.investigation_type,
        data.material_type_id,
        data.plasticity_id,
        data.moisture_id,
        data.consistency_id,
        data.structure_id,
        data.origin_id,
        data.secondary_components,
        data.grain_size_id,
        data.grading_id,
        data.fines_content_id,
        data.density_id,
        data.angularity_id,
        data.fill_type_id,
        data.composition_id,
        data.contaminant_id,
        data.inclusion_id,
        data.transition_material_id,
        data.notes,
        entryId
      ]
    );
  }
};
