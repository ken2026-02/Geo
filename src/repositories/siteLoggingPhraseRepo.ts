import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteLoggingPhrase } from '../types/siteLogging';
import { normalizePhraseCategory, normalizePhraseText } from '../services/siteLoggingPhrasePolicy';

export const siteLoggingPhraseRepo = {
  getById: (id: string): SiteLoggingPhrase | null => {
    return query<SiteLoggingPhrase>('SELECT * FROM site_logging_phrases WHERE id = ?', [id])[0] ?? null;
  },

  listByCategories: (siteId: string | null | undefined, categories: string[]): SiteLoggingPhrase[] => {
    const cats = (categories || []).map((c) => String(c || '').trim()).filter(Boolean);
    if (cats.length === 0) return siteLoggingPhraseRepo.list(siteId ?? null);

    const where: string[] = [];
    const args: any[] = [];

    where.push(`category IN (${cats.map(() => '?').join(', ')})`);
    args.push(...cats);

    if (siteId) {
      where.push('(site_id IS NULL OR site_id = ?)');
      args.push(siteId);
    }

    return query<SiteLoggingPhrase>(
      `SELECT * FROM site_logging_phrases
       WHERE ${where.join(' AND ')}
       ORDER BY site_specific DESC, category ASC, text ASC`,
      args
    );
  },

  list: (siteId?: string | null, category?: string): SiteLoggingPhrase[] => {
    const where: string[] = [];
    const args: any[] = [];
    if (category) {
      where.push('category = ?');
      args.push(category);
    }
    if (siteId) {
      where.push('(site_id IS NULL OR site_id = ?)');
      args.push(siteId);
    }
    return query<SiteLoggingPhrase>(
      `SELECT * FROM site_logging_phrases
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY site_specific DESC, text ASC`,
      args
    );
  },

  listForLibrary: (opts: {
    siteId?: string | null;
    scope?: 'all' | 'global' | 'site';
    category?: string;
    queryText?: string;
  }): SiteLoggingPhrase[] => {
    const where: string[] = [];
    const args: any[] = [];
    const scope = opts.scope ?? 'all';

    if (opts.category) {
      where.push('category = ?');
      args.push(opts.category);
    }
    if (opts.queryText) {
      where.push('LOWER(text) LIKE ?');
      args.push(`%${opts.queryText.toLowerCase()}%`);
    }

    if (scope === 'global') {
      where.push('site_id IS NULL');
    } else if (scope === 'site') {
      where.push('site_id = ?');
      args.push(opts.siteId ?? '');
    } else if (opts.siteId) {
      // For "all" with a site selected, show global + that site.
      where.push('(site_id IS NULL OR site_id = ?)');
      args.push(opts.siteId);
    }

    return query<SiteLoggingPhrase>(
      `SELECT * FROM site_logging_phrases
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY site_specific DESC, category ASC, text ASC`,
      args
    );
  },

  countAll: (): number => {
    const row = query<{ count: number }>('SELECT COUNT(*) as count FROM site_logging_phrases')[0];
    return row?.count ?? 0;
  },

  seedIfEmpty: async (phrases: Array<Omit<SiteLoggingPhrase, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
    if (siteLoggingPhraseRepo.countAll() > 0) return;
    for (const phrase of phrases) {
      await execute(
        `INSERT INTO site_logging_phrases (id, category, text, site_specific, site_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [uuidv4(), phrase.category, phrase.text, phrase.site_specific, phrase.site_id ?? null]
      );
    }
  },

  findByUnique: (category: string, text: string, siteId: string | null): SiteLoggingPhrase | null => {
    if (siteId) {
      return (
        query<SiteLoggingPhrase>(
          `SELECT * FROM site_logging_phrases WHERE category = ? AND text = ? AND site_id = ? LIMIT 1`,
          [category, text, siteId]
        )[0] ?? null
      );
    }
    return (
      query<SiteLoggingPhrase>(
        `SELECT * FROM site_logging_phrases WHERE category = ? AND text = ? AND site_id IS NULL LIMIT 1`,
        [category, text]
      )[0] ?? null
    );
  },

  create: async (data: { category: string; text: string; site_id?: string | null }): Promise<string> => {
    const id = uuidv4();
    const siteId = data.site_id ?? null;
    const category = normalizePhraseCategory(data.category).normalized;
    const text = normalizePhraseText(data.text);
    await execute(
      `INSERT INTO site_logging_phrases (id, category, text, site_specific, site_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, category, text, siteId ? 1 : 0, siteId]
    );
    return id;
  },

  update: async (
    id: string,
    patch: Partial<Pick<SiteLoggingPhrase, 'category' | 'text' | 'site_id' | 'site_specific'>>
  ): Promise<void> => {
    const current = siteLoggingPhraseRepo.getById(id);
    if (!current) return;
    const nextSiteId = patch.site_id !== undefined ? patch.site_id : current.site_id;
    const nextSiteSpecific =
      patch.site_specific !== undefined ? patch.site_specific : nextSiteId ? 1 : 0;

    const nextCategory = patch.category != null ? normalizePhraseCategory(patch.category).normalized : current.category;
    const nextText = patch.text != null ? normalizePhraseText(patch.text) : current.text;

    await execute(
      `UPDATE site_logging_phrases
       SET category = ?,
           text = ?,
           site_specific = ?,
           site_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextCategory,
        nextText,
        nextSiteSpecific,
        nextSiteId ?? null,
        id,
      ]
    );
  },

  remove: async (id: string): Promise<void> => {
    await execute(`DELETE FROM site_logging_phrases WHERE id = ?`, [id]);
  },

  upsertUnique: async (data: { category: string; text: string; site_id?: string | null }): Promise<string> => {
    const siteId = data.site_id ?? null;
    const category = normalizePhraseCategory(data.category).normalized;
    const text = normalizePhraseText(data.text);
    const existing = siteLoggingPhraseRepo.findByUnique(category, text, siteId);
    if (existing) return existing.id;
    return siteLoggingPhraseRepo.create({ category, text, site_id: siteId });
  },

  upsertManyUnique: async (
    items: Array<{ category: string; text: string; site_id?: string | null }>
  ): Promise<{ upserted: number }> => {
    let upserted = 0;
    for (const item of items) {
      const category = normalizePhraseCategory(item?.category || '').normalized;
      const text = normalizePhraseText(item?.text || '');
      if (!category || !text) continue;
      await siteLoggingPhraseRepo.upsertUnique({ category, text, site_id: item.site_id ?? null });
      upserted += 1;
    }
    return { upserted };
  },
};
