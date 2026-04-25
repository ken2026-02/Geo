import type { SiteBoreholeCalibration, SiteGroundReference, SiteLoggingPhrase } from '../types/siteLogging';
import {
  SITE_LOGGING_PHRASE_BASE_CATEGORIES,
  normalizePhraseCategory,
  normalizePhraseText,
  normalizePhraseTextKey,
} from './siteLoggingPhrasePolicy';

export type SiteLoggingReferenceTemplateV1 = {
  kind: 'site_logging_reference_template';
  schema_version: 1;
  template_name: string;
  applicability?: {
    project?: string;
    site_code?: string;
    notes?: string;
  };
  metadata: {
    created_at: string;
    updated_at: string;
    created_by?: string;
  };
  ground_model: {
    geotechnical_units: string[];
    expected_tor_min_m: number | null;
    expected_tor_max_m: number | null;
    reference_tor_velocity_ms: number | null;
    expected_material_above_tor: string[];
    expected_material_below_tor: string[];
    risk_flags: string[];
    site_notes: string;
    // Project-maintained JSON (includes phrase ordering/archival policy, optional extra notes)
    reference_json: Record<string, any>;
    source_label?: string | null;
  };
  phrase_library: {
    phrases: Array<{
      category: string;
      text: string;
      scope: 'site' | 'global';
    }>;
    phrase_admin?: {
      archived: Array<{ category: string; text: string }>;
      order_by_category: Record<string, Array<{ category: string; text: string }>>;
    };
  };
  evidence: {
    borehole_calibrations: Array<Omit<SiteBoreholeCalibration, 'id' | 'site_id'>>;
    references: Array<{
      reference_type: string;
      source_label: string | null;
      reference_json: string;
    }>;
  };
};

const safeParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const asStringArray = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).map((s) => s.trim()).filter(Boolean) : [];

const allowedPhraseCategories = new Set<string>(SITE_LOGGING_PHRASE_BASE_CATEGORIES.map(String));

export const validateSiteLoggingReferenceTemplate = (
  jsonText: string
): { ok: true; value: SiteLoggingReferenceTemplateV1 } | { ok: false; error: string } => {
  const raw = safeParse(jsonText);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Invalid JSON.' };

  if (raw.kind !== 'site_logging_reference_template') return { ok: false, error: 'Not a reference template.' };
  if (raw.schema_version !== 1) return { ok: false, error: `Unsupported schema_version: ${raw.schema_version}` };

  const templateName = String(raw.template_name || '').trim();
  if (!templateName) return { ok: false, error: 'Template name is required.' };

  const gm = raw.ground_model && typeof raw.ground_model === 'object' ? raw.ground_model : null;
  if (!gm) return { ok: false, error: 'Missing ground_model.' };

  const phrasesRaw = raw.phrase_library?.phrases;
  if (!Array.isArray(phrasesRaw)) return { ok: false, error: 'Missing phrase_library.phrases.' };

  // Validate phrase categories and non-empty text
  for (const p of phrasesRaw) {
    const category = normalizePhraseCategory(String(p?.category || '')).normalized;
    const text = normalizePhraseText(String(p?.text || ''));
    if (!category || !text) return { ok: false, error: 'Phrase entries must have category and text.' };
    if (!allowedPhraseCategories.has(category)) return { ok: false, error: `Invalid phrase category: ${category}` };
  }

  const out: SiteLoggingReferenceTemplateV1 = {
    kind: 'site_logging_reference_template',
    schema_version: 1,
    template_name: templateName,
    applicability: raw.applicability && typeof raw.applicability === 'object' ? raw.applicability : undefined,
    metadata: {
      created_at: String(raw.metadata?.created_at || new Date().toISOString()),
      updated_at: String(raw.metadata?.updated_at || new Date().toISOString()),
      created_by: raw.metadata?.created_by != null ? String(raw.metadata.created_by) : undefined,
    },
    ground_model: {
      geotechnical_units: asStringArray(gm.geotechnical_units),
      expected_tor_min_m: typeof gm.expected_tor_min_m === 'number' ? gm.expected_tor_min_m : null,
      expected_tor_max_m: typeof gm.expected_tor_max_m === 'number' ? gm.expected_tor_max_m : null,
      reference_tor_velocity_ms: typeof gm.reference_tor_velocity_ms === 'number' ? gm.reference_tor_velocity_ms : null,
      expected_material_above_tor: asStringArray(gm.expected_material_above_tor),
      expected_material_below_tor: asStringArray(gm.expected_material_below_tor),
      risk_flags: asStringArray(gm.risk_flags),
      site_notes: String(gm.site_notes || ''),
      reference_json: gm.reference_json && typeof gm.reference_json === 'object' && !Array.isArray(gm.reference_json) ? gm.reference_json : {},
      source_label: gm.source_label != null ? String(gm.source_label) : null,
    },
    phrase_library: {
      phrases: phrasesRaw.map((p: any) => ({
        category: normalizePhraseCategory(String(p.category)).normalized,
        text: normalizePhraseText(String(p.text)),
        scope: String(p.scope || 'site') === 'global' ? 'global' : 'site',
      })),
      phrase_admin: raw.phrase_library?.phrase_admin && typeof raw.phrase_library.phrase_admin === 'object'
        ? raw.phrase_library.phrase_admin
        : undefined,
    },
    evidence: {
      borehole_calibrations: Array.isArray(raw.evidence?.borehole_calibrations)
        ? raw.evidence.borehole_calibrations
        : [],
      references: Array.isArray(raw.evidence?.references) ? raw.evidence.references : [],
    },
  };

  return { ok: true, value: out };
};

export const buildSiteLoggingReferenceTemplate = (args: {
  templateName: string;
  applicability?: SiteLoggingReferenceTemplateV1['applicability'];
  groundRef: SiteGroundReference | null;
  referenceObj: Record<string, any>;
  sitePhrases: SiteLoggingPhrase[];
  phraseAdminPolicy?: {
    archivedIds: Set<string>;
    orderByCategory: Record<string, string[]>;
  };
  boreholeCalibrations: SiteBoreholeCalibration[];
  otherReferences: Array<{ reference_type: string; source_label: string | null; reference_json: string }>;
}): SiteLoggingReferenceTemplateV1 => {
  const now = new Date().toISOString();

  const phrases = args.sitePhrases
    .map((p) => ({
      category: normalizePhraseCategory(String(p.category)).normalized,
      text: normalizePhraseText(String(p.text)),
      scope: p.site_id ? 'site' as const : 'global' as const,
    }))
    .filter((p) => p.scope === 'site'); // templates are meant to be portable; global phrases already ship in seeds

  const byKeyToPhrase = new Map<string, SiteLoggingPhrase>();
  for (const p of args.sitePhrases) {
    const key = `${normalizePhraseCategory(String(p.category)).normalized}::${normalizePhraseTextKey(p.text)}`;
    byKeyToPhrase.set(key, p);
  }

  const phraseAdmin = (() => {
    const policy = args.phraseAdminPolicy;
    if (!policy) return undefined;

    const archived: Array<{ category: string; text: string }> = [];
    for (const id of policy.archivedIds) {
      const p = args.sitePhrases.find((x) => String(x.id) === String(id));
      if (!p) continue;
      archived.push({
        category: normalizePhraseCategory(String(p.category)).normalized,
        text: normalizePhraseText(String(p.text)),
      });
    }

    const order_by_category: Record<string, Array<{ category: string; text: string }>> = {};
    for (const [cat, ids] of Object.entries(policy.orderByCategory || {})) {
      const out: Array<{ category: string; text: string }> = [];
      for (const id of ids || []) {
        const p = args.sitePhrases.find((x) => String(x.id) === String(id));
        if (!p) continue;
        out.push({
          category: normalizePhraseCategory(String(p.category)).normalized,
          text: normalizePhraseText(String(p.text)),
        });
      }
      order_by_category[String(cat)] = out;
    }

    return { archived, order_by_category };
  })();

  const gr = args.groundRef;
  const geotechUnits = asStringArray(gr?.geotechnical_units_json ? safeParse(gr.geotechnical_units_json) : []);
  const above = asStringArray(gr?.expected_material_above_tor_json ? safeParse(gr.expected_material_above_tor_json) : []);
  const below = asStringArray(gr?.expected_material_below_tor_json ? safeParse(gr.expected_material_below_tor_json) : []);
  const risks = asStringArray(gr?.site_risk_flags_json ? safeParse(gr.site_risk_flags_json) : []);

  return {
    kind: 'site_logging_reference_template',
    schema_version: 1,
    template_name: args.templateName,
    applicability: args.applicability,
    metadata: { created_at: now, updated_at: now },
    ground_model: {
      geotechnical_units: geotechUnits,
      expected_tor_min_m: gr?.expected_tor_min_m ?? null,
      expected_tor_max_m: gr?.expected_tor_max_m ?? null,
      reference_tor_velocity_ms: gr?.reference_tor_velocity_ms ?? null,
      expected_material_above_tor: above,
      expected_material_below_tor: below,
      risk_flags: risks,
      site_notes: String(gr?.reference_notes || ''),
      reference_json: args.referenceObj && typeof args.referenceObj === 'object' ? args.referenceObj : {},
      source_label: gr?.source_label ?? null,
    },
    phrase_library: {
      phrases,
      phrase_admin: phraseAdmin,
    },
    evidence: {
      borehole_calibrations: args.boreholeCalibrations.map((b) => ({
        site_line_id: b.site_line_id ?? null,
        borehole_id: b.borehole_id,
        borehole_offset_m: b.borehole_offset_m ?? null,
        elevation_difference_m: b.elevation_difference_m ?? null,
        borehole_tor_depth_m_bgl: b.borehole_tor_depth_m_bgl ?? null,
        borehole_lithology_at_tor: b.borehole_lithology_at_tor ?? null,
        srt_velocity_at_tor_ms: b.srt_velocity_at_tor_ms ?? null,
        difference_geophysics_minus_borehole_m: b.difference_geophysics_minus_borehole_m ?? null,
        variance_note: b.variance_note ?? null,
        confidence: b.confidence ?? null,
        created_at: (b as any).created_at ?? null,
        updated_at: (b as any).updated_at ?? null,
      })),
      references: args.otherReferences.map((r) => ({
        reference_type: String(r.reference_type),
        source_label: r.source_label ?? null,
        reference_json: String(r.reference_json || '{}'),
      })),
    },
  };
};

export const mergeUniquePhrases = (args: {
  existing: Array<{ category: string; text: string }>;
  incoming: Array<{ category: string; text: string }>;
}): Array<{ category: string; text: string }> => {
  const out: Array<{ category: string; text: string }> = [];
  const seen = new Set<string>();
  const push = (category: string, text: string) => {
    const cat = normalizePhraseCategory(category).normalized;
    const t = normalizePhraseText(text);
    if (!cat || !t) return;
    if (!allowedPhraseCategories.has(cat)) return;
    const key = `${cat}::${normalizePhraseTextKey(t)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ category: cat, text: t });
  };
  for (const p of args.existing) push(p.category, p.text);
  for (const p of args.incoming) push(p.category, p.text);
  return out;
};

