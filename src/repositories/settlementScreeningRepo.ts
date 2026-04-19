import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface SettlementScreeningAssessment {
  id: string;
  entry_id: string;
  soil_type: string;
  footing_width: number;
  footing_pressure: number;
  groundwater_condition: string;
  compressibility_flag: string;
  settlement_risk: string;
  differential_settlement_risk: string;
  design_note: string;
  notes: string;
}

export const settlementScreeningRepo = {
  create: async (data: Omit<SettlementScreeningAssessment, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO settlement_screening_assessments (id, entry_id, soil_type, footing_width, footing_pressure, groundwater_condition, compressibility_flag, settlement_risk, differential_settlement_risk, design_note, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.soil_type, data.footing_width, data.footing_pressure, data.groundwater_condition, data.compressibility_flag, data.settlement_risk, data.differential_settlement_risk, data.design_note, data.notes]
    );
    return id;
  },
  getByEntryId: (entryId: string): SettlementScreeningAssessment | null => {
    const results = query<SettlementScreeningAssessment>('SELECT * FROM settlement_screening_assessments WHERE entry_id = ?', [entryId]);
    return results[0] || null;
  }
};
