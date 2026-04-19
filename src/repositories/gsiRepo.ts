import { initDatabase, persistDatabase } from '../db/db';

export interface GSIAssessment {
  id: string;
  entry_id: string;
  structure_class: string;
  surface_condition_class: string;
  gsi_min: number;
  gsi_max: number;
  gsi_mid: number;
  confidence_level: string;
  notes: string;
}

export async function saveGSIAssessment(data: GSIAssessment): Promise<void> {
  const db = await initDatabase();
  db.run(
    `INSERT INTO gsi_assessments (
      id, entry_id, structure_class, surface_condition_class,
      gsi_min, gsi_max, gsi_mid, confidence_level, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.entry_id,
      data.structure_class,
      data.surface_condition_class,
      data.gsi_min,
      data.gsi_max,
      data.gsi_mid,
      data.confidence_level,
      data.notes
    ]
  );
  await persistDatabase();
}

export async function getGSIAssessmentByEntryId(entryId: string): Promise<GSIAssessment | null> {
  const db = await initDatabase();
  const res = db.exec('SELECT * FROM gsi_assessments WHERE entry_id = ?', [entryId]);
  if (res.length === 0) return null;

  const row = res[0].values[0];
  const columns = res[0].columns;

  const getCol = (name: string) => row[columns.indexOf(name)];

  return {
    id: getCol('id') as string,
    entry_id: getCol('entry_id') as string,
    structure_class: getCol('structure_class') as string,
    surface_condition_class: getCol('surface_condition_class') as string,
    gsi_min: getCol('gsi_min') as number,
    gsi_max: getCol('gsi_max') as number,
    gsi_mid: getCol('gsi_mid') as number,
    confidence_level: getCol('confidence_level') as string,
    notes: getCol('notes') as string,
  };
}
