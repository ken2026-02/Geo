import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteVerificationRecord } from '../types/siteLogging';

const upsertInto = async (table: 'site_anchor_verifications' | 'site_pile_verifications', elementId: string, resultJson: string) => {
  const row = query<SiteVerificationRecord>(`SELECT * FROM ${table} WHERE element_id = ?`, [elementId])[0] ?? null;
  if (row) {
    await execute(`UPDATE ${table} SET result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [resultJson, row.id]);
    return row.id;
  }
  const id = uuidv4();
  await execute(
    `INSERT INTO ${table} (id, element_id, result_json, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, elementId, resultJson]
  );
  return id;
};

export const siteVerificationRepo = {
  getAnchorByElement: (elementId: string): SiteVerificationRecord | null =>
    query<SiteVerificationRecord>('SELECT * FROM site_anchor_verifications WHERE element_id = ?', [elementId])[0] ?? null,

  getPileByElement: (elementId: string): SiteVerificationRecord | null =>
    query<SiteVerificationRecord>('SELECT * FROM site_pile_verifications WHERE element_id = ?', [elementId])[0] ?? null,

  upsertAnchorByElement: (elementId: string, resultJson: string) => upsertInto('site_anchor_verifications', elementId, resultJson),
  upsertPileByElement: (elementId: string, resultJson: string) => upsertInto('site_pile_verifications', elementId, resultJson),
};

