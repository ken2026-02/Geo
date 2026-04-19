import { getDb } from '../db/db';

export interface RmrAssessment {
  id: string;
  entry_id: string;
  ucs_rating: number;
  rqd_rating: number;
  spacing_rating: number;
  condition_rating: number;
  groundwater_rating: number;
  orientation_adjustment: number;
  total_rmr: number;
  rock_class: string;
  notes: string;
}

export const rmrRepo = {
  create: (data: RmrAssessment) => {
    const db = getDb();
    db.exec(`
      INSERT INTO rmr_assessments (
        id, entry_id, ucs_rating, rqd_rating, spacing_rating, 
        condition_rating, groundwater_rating, orientation_adjustment, 
        total_rmr, rock_class, notes
      ) VALUES (
        '${data.id}', '${data.entry_id}', ${data.ucs_rating}, ${data.rqd_rating}, 
        ${data.spacing_rating}, ${data.condition_rating}, ${data.groundwater_rating}, 
        ${data.orientation_adjustment}, ${data.total_rmr}, '${data.rock_class}', '${data.notes}'
      )
    `);
  },

  getByEntryId: (entryId: string): RmrAssessment | null => {
    const db = getDb();
    const result = db.exec(`SELECT * FROM rmr_assessments WHERE entry_id = '${entryId}'`);
    if (result.length > 0 && result[0].values.length > 0) {
      const row = result[0].values[0];
      const cols = result[0].columns;
      const getVal = (colName: string) => row[cols.indexOf(colName)];
      
      return {
        id: getVal('id') as string,
        entry_id: getVal('entry_id') as string,
        ucs_rating: getVal('ucs_rating') as number,
        rqd_rating: getVal('rqd_rating') as number,
        spacing_rating: getVal('spacing_rating') as number,
        condition_rating: getVal('condition_rating') as number,
        groundwater_rating: getVal('groundwater_rating') as number,
        orientation_adjustment: getVal('orientation_adjustment') as number,
        total_rmr: getVal('total_rmr') as number,
        rock_class: getVal('rock_class') as string,
        notes: getVal('notes') as string,
      };
    }
    return null;
  }
};
