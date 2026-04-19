import { siteRepo } from '../repositories/siteRepo';
import { siteGroundReferenceRepo } from '../repositories/siteGroundReferenceRepo';
import { siteBoreholeCalibrationRepo } from '../repositories/siteBoreholeCalibrationRepo';
import { siteLoggingPhraseRepo } from '../repositories/siteLoggingPhraseRepo';
import { supportElementRepo } from '../repositories/supportElementRepo';
import { siteDesignInputRepo } from '../repositories/siteDesignInputRepo';
import { siteDrillingRepo } from '../repositories/siteDrillingRepo';
import { siteInterpretationRepo } from '../repositories/siteInterpretationRepo';
import { siteVerificationRepo } from '../repositories/siteVerificationRepo';
import { normalizeElementType, normalizeStatus } from './siteLoggingUi';
import { siteCleanOutRepo } from '../repositories/siteCleanOutRepo';
import { siteApprovalRepo } from '../repositories/siteApprovalRepo';
import { siteFieldEventRepo } from '../repositories/siteFieldEventRepo';
import { sitePhotoAttachmentRepo } from '../repositories/sitePhotoAttachmentRepo';
import { siteOutputReportRepo } from '../repositories/siteOutputReportRepo';
import type { Site, SiteDrillingInterval, SiteDrillingRecord, SupportElement } from '../types/siteLogging';

export type SiteLoggingReferencePack = {
  version: 'site-logging-pack-v1';
  exported_at: string; // ISO
  project_id: string;
  sites: Array<{
    site_code: string;
    site_name?: string | null;
    ground_reference?: any;
    calibrations?: any[];
    phrases?: Array<{ category: string; text: string; site_specific?: boolean }>;
  }>;
};

export type SiteLoggingElementPack = {
  version: 'site-logging-element-pack-v1';
  exported_at: string; // ISO
  schema_version: 2;
  source: 'exported' | string;
  element: {
    site_code: string;
    site_name?: string | null;
    element_type: string;
    element_code?: string | null;
    status?: string | null;
    chainage?: number | null;
    location_description?: string | null;
    offset_description?: string | null;
    ground_rl?: number | null;
    hole_angle_deg?: number | null;
    hole_diameter_mm?: number | null;
    rig_type?: string | null;
    rig_model?: string | null;
    bit_type?: string | null;
    created_by?: string | null;
  };
  design_inputs: Array<{ design_type: string; input_json: string; meta?: any }>;
  drilling: Array<{
    record: Omit<SiteDrillingRecord, 'id' | 'element_id'>;
    intervals: Array<Omit<SiteDrillingInterval, 'id' | 'record_id'>>;
    clean_out?: any | null;
  }>;
  interpretation?: any | null;
  verification?: { anchor?: any | null; pile?: any | null } | null;
  approval?: any | null;
  field_events?: any[];
  photos?: Array<{ blob_key: string; mime_type: string | null; caption: string | null; taken_datetime: string | null; photo_type?: string | null; depth_m?: number | null }>;
  output_report?: any | null;
  learning?: {
    phrases?: Array<{ category: string; text: string }>;
    template_family_stats?: Array<{ family: string; count: number }>;
  };
  notes?: string | null;
};

const safeJsonParse = (txt: string): any => {
  const v = JSON.parse(txt);
  return v && typeof v === 'object' ? v : null;
};

export const exportSiteLoggingReferencePack = (projectId: string): SiteLoggingReferencePack => {
  const sites = siteRepo.listByProject(projectId);
  return {
    version: 'site-logging-pack-v1',
    exported_at: new Date().toISOString(),
    project_id: projectId,
    sites: sites.map((s) => {
      const gr = siteGroundReferenceRepo.getGroundReferenceBySite(s.id);
      const calibrations = siteBoreholeCalibrationRepo.listBySite(s.id);
      const phrases = siteLoggingPhraseRepo.list(s.id);
      return {
        site_code: s.site_code,
        site_name: s.site_name,
        ground_reference: gr ? safeJsonParse(gr.reference_json) : null,
        calibrations: calibrations.map((c) => ({ ...c, id: undefined, site_id: undefined })),
        phrases: phrases.map((p) => ({ category: p.category, text: p.text, site_specific: Boolean(p.site_specific) })),
      };
    }),
  };
};

export const importSiteLoggingReferencePack = async (
  projectId: string,
  pack: any
): Promise<{ createdSites: number; updatedGroundReferences: number; upsertedPhrases: number; calibrationsRows: number }> => {
  if (!pack || typeof pack !== 'object') throw new Error('Invalid pack JSON.');
  const sites = Array.isArray(pack.sites) ? pack.sites : [];

  let createdSites = 0;
  let updatedGroundReferences = 0;
  let upsertedPhrases = 0;
  let calibrationsRows = 0;

  const existingSites = siteRepo.listByProject(projectId);
  const byCode = new Map(existingSites.map((s) => [String(s.site_code).toUpperCase(), s]));

  for (const rawSite of sites) {
    const siteCode = String(rawSite?.site_code || '').trim();
    if (!siteCode) continue;

    let site = byCode.get(siteCode.toUpperCase()) || null;
    if (!site) {
      const id = await siteRepo.create({
        project_id: projectId,
        site_code: siteCode,
        site_name: rawSite?.site_name != null ? String(rawSite.site_name) : null,
        chainage_from_km: null,
        chainage_to_km: null,
        notes: null,
      });
      site = siteRepo.getById(id);
      if (site) {
        byCode.set(siteCode.toUpperCase(), site);
        createdSites += 1;
      }
    } else if (rawSite?.site_name != null && String(rawSite.site_name).trim() && site.site_name !== String(rawSite.site_name)) {
      await siteRepo.update(site.id, { site_name: String(rawSite.site_name) });
      site = siteRepo.getById(site.id);
      if (site) byCode.set(siteCode.toUpperCase(), site);
    }
    if (!site) continue;

    if (rawSite?.ground_reference) {
      await siteGroundReferenceRepo.upsertGroundReferenceBySite(projectId, site.id, rawSite.ground_reference);
      updatedGroundReferences += 1;
    }

    if (Array.isArray(rawSite?.calibrations)) {
      await siteBoreholeCalibrationRepo.upsertManyForSite(site.id, rawSite.calibrations);
      calibrationsRows += rawSite.calibrations.length;
    }

    if (Array.isArray(rawSite?.phrases)) {
      for (const p of rawSite.phrases) {
        const category = String(p?.category || '').trim();
        const text = String(p?.text || '').trim();
        if (!category || !text) continue;
        await siteLoggingPhraseRepo.upsertUnique({
          category,
          text,
          site_id: site.id,
        });
        upsertedPhrases += 1;
      }
    }
  }

  return { createdSites, updatedGroundReferences, upsertedPhrases, calibrationsRows };
};

export const exportSiteLoggingElementPack = (elementId: string): SiteLoggingElementPack => {
  const element = supportElementRepo.getById(elementId);
  if (!element) throw new Error('Element not found.');
  const site = siteRepo.getById(element.site_id);
  if (!site) throw new Error('Site not found.');

  const designInputs = siteDesignInputRepo.listByElement(elementId);
  const records = siteDrillingRepo.listRecordsByElement(elementId);

  const drilling = records.map((r) => {
    const intervals = siteDrillingRepo.listIntervalsByRecord(r.id);
    const cleanOut = siteCleanOutRepo.getByRecord(r.id);
    const record: any = { ...r };
    delete record.id;
    delete record.element_id;

    const intervalsOut = intervals.map((it) => {
      const row: any = { ...it };
      delete row.id;
      delete row.record_id;
      return row;
    });

    return { record, intervals: intervalsOut, clean_out: cleanOut ? { ...cleanOut, id: undefined, drilling_record_id: undefined } : null };
  });

  // Learning export: pull phrases actually used by this element + sentence family usage.
  const usedPhrases: Array<{ category: string; text: string }> = [];
  const familyCounts = new Map<string, number>();
  const bump = (category: string, text: any) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    usedPhrases.push({ category, text: t });
  };
  for (const r of records) {
    const intervals = siteDrillingRepo.listIntervalsByRecord(r.id);
    for (const it of intervals as any[]) {
      bump('observed_material', it.material_observed);
      bump('interpreted_material', it.material_interpreted);
      bump('colour', it.colour);
      const sec = it.secondary_components_json ? (() => { try { return JSON.parse(String(it.secondary_components_json)); } catch { return null; } })() : null;
      if (sec && typeof sec === 'object') {
        bump('modifier', sec.modifier);
        bump('common_phrase', sec.common_phrase);
        const fam = String(sec.template_family || sec.template_id || '').trim();
        if (fam) familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1);
        const edited = String(sec.edit_level || '').toLowerCase() === 'heavy' || Boolean(sec.final_phrase_edited);
        if (edited && it.logging_phrase_output) bump('sentence_pattern', it.logging_phrase_output);
      }
    }
  }
  const uniq = new Map<string, { category: string; text: string }>();
  for (const p of usedPhrases) {
    const key = `${p.category}::${p.text}`;
    if (!uniq.has(key)) uniq.set(key, p);
  }

  const interpretation = siteInterpretationRepo.getByElement(elementId);
  const anchorVer = siteVerificationRepo.getAnchorByElement(elementId);
  const pileVer = siteVerificationRepo.getPileByElement(elementId);
  const approval = siteApprovalRepo.getByElement(elementId);
  const events = siteFieldEventRepo.listByElement(elementId);
  const photos = sitePhotoAttachmentRepo.listByElement(elementId);
  const out = siteOutputReportRepo.getByElementId(elementId);

  const elemOut: any = { ...element };
  delete elemOut.id;
  delete elemOut.project_id;
  delete elemOut.site_id;
  delete elemOut.is_deleted;
  delete elemOut.deleted_at;
  delete elemOut.created_at;
  delete elemOut.updated_at;

  return {
    version: 'site-logging-element-pack-v1',
    exported_at: new Date().toISOString(),
    schema_version: 2,
    source: 'exported',
    element: {
      site_code: site.site_code,
      site_name: site.site_name,
      element_type: String(element.element_type || ''),
      element_code: element.element_code ?? null,
      status: element.status ?? null,
      chainage: element.chainage ?? null,
      location_description: element.location_description ?? null,
      offset_description: element.offset_description ?? null,
      ground_rl: element.ground_rl ?? null,
      hole_angle_deg: element.hole_angle_deg ?? null,
      hole_diameter_mm: element.hole_diameter_mm ?? null,
      rig_type: element.rig_type ?? null,
      rig_model: element.rig_model ?? null,
      bit_type: element.bit_type ?? null,
      created_by: element.created_by ?? null,
    },
    design_inputs: designInputs.map((d) => ({ design_type: d.design_type, input_json: d.input_json, meta: { element_type: (d as any).element_type ?? null, reference_rl_type: (d as any).reference_rl_type ?? null, design_json: (d as any).design_json ?? null } })),
    drilling,
    interpretation: interpretation ? { ...interpretation, id: undefined, element_id: undefined } : null,
    verification: {
      anchor: anchorVer ? safeJsonParse(anchorVer.result_json) : null,
      pile: pileVer ? safeJsonParse(pileVer.result_json) : null,
    },
    approval: approval ? { ...approval, id: undefined, element_id: undefined } : null,
    field_events: events.map((e) => ({ ...e, id: undefined, element_id: undefined })),
    photos: photos.map((p) => ({
      blob_key: p.blob_key,
      mime_type: p.mime_type ?? null,
      caption: p.caption ?? null,
      taken_datetime: p.taken_datetime ?? null,
      photo_type: (p as any).photo_type ?? null,
      depth_m: (p as any).depth_m ?? null,
    })),
    output_report: out ? { report_text: out.report_text, report_json: safeJsonParse(out.report_json) } : null,
    learning: {
      phrases: [...uniq.values()],
      template_family_stats: [...familyCounts.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    },
    notes: 'Note: photo blobs are not included in this JSON export. This pack carries metadata only.',
  };
};

export const importSiteLoggingElementPack = async (
  projectId: string,
  pack: any
): Promise<{ createdSite: boolean; createdElementId: string; importedIntervals: number; importedRecords: number; importedDesignInputs: number; importedEvents: number; importedPhotosMeta: number }> => {
  if (!pack || typeof pack !== 'object') throw new Error('Invalid pack JSON.');
  if (pack.version !== 'site-logging-element-pack-v1') throw new Error('Unsupported pack version.');

  const elementInfo = pack.element ?? null;
  const siteCode = String(elementInfo?.site_code || '').trim();
  if (!siteCode) throw new Error('Pack missing site_code.');

  const existingSites = siteRepo.listByProject(projectId);
  const byCode = new Map(existingSites.map((s: Site) => [String(s.site_code).toUpperCase(), s]));
  let site = byCode.get(siteCode.toUpperCase()) || null;
  let createdSite = false;

  if (!site) {
    const id = await siteRepo.create({
      project_id: projectId,
      site_code: siteCode,
      site_name: elementInfo?.site_name != null ? String(elementInfo.site_name) : null,
      chainage_from_km: null,
      chainage_to_km: null,
      notes: null,
    });
    site = siteRepo.getById(id);
    createdSite = true;
  }
  if (!site) throw new Error('Failed to create/load site.');

  const elementType = normalizeElementType(String(elementInfo?.element_type || '')) || 'anchor';
  const elementCode = elementInfo?.element_code != null ? String(elementInfo.element_code) : null;

  const createdElementId = await supportElementRepo.create({
    project_id: projectId,
    site_id: site.id,
    element_type: elementType,
    element_code: elementCode,
    status: normalizeStatus(String(elementInfo?.status || 'draft')),
    location_description: elementInfo?.location_description != null ? String(elementInfo.location_description) : null,
    chainage: elementInfo?.chainage ?? null,
    offset_description: elementInfo?.offset_description ?? null,
    ground_rl: elementInfo?.ground_rl ?? null,
    hole_angle_deg: elementInfo?.hole_angle_deg ?? null,
    hole_diameter_mm: elementInfo?.hole_diameter_mm ?? null,
    rig_type: elementInfo?.rig_type ?? null,
    rig_model: elementInfo?.rig_model ?? null,
    bit_type: elementInfo?.bit_type ?? null,
    created_by: elementInfo?.created_by ?? null,
  } as SupportElement as any);

  let importedDesignInputs = 0;
  for (const d of Array.isArray(pack.design_inputs) ? pack.design_inputs : []) {
    const designType = String(d?.design_type || '').trim();
    const inputJson = String(d?.input_json || '').trim();
    if (!designType || !inputJson) continue;
    await siteDesignInputRepo.upsert(createdElementId, designType, inputJson, d?.meta ?? undefined);
    importedDesignInputs += 1;
  }

  let importedRecords = 0;
  let importedIntervals = 0;
  for (const dr of Array.isArray(pack.drilling) ? pack.drilling : []) {
    const r = dr?.record ?? null;
    const recordId = await siteDrillingRepo.createRecord({
      element_id: createdElementId,
      record_date: r?.record_date ?? null,
      method: r?.method ?? null,
      start_depth_m: r?.start_depth_m ?? null,
      end_depth_m: r?.end_depth_m ?? null,
      notes: r?.notes ?? null,
      start_date: r?.start_date ?? null,
      end_date: r?.end_date ?? null,
      logged_by: r?.logged_by ?? null,
      approved_by: r?.approved_by ?? null,
      record_page_count: r?.record_page_count ?? null,
      general_note: r?.general_note ?? null,
    } as any);
    importedRecords += 1;

    const intervals = Array.isArray(dr?.intervals) ? dr.intervals : [];
    for (const it of intervals) {
      await siteDrillingRepo.createInterval({
        record_id: recordId,
        from_depth_m: Number(it.from_depth_m),
        to_depth_m: Number(it.to_depth_m),
        observed_text: it.observed_text ?? null,
        interpreted_text: it.interpreted_text ?? null,
        recovery_text: it.recovery_text ?? null,
        water_text: it.water_text ?? null,
        response_text: it.response_text ?? null,
        drilling_time_min: (it as any).drilling_time_min ?? null,
        material_observed: (it as any).material_observed ?? null,
        material_interpreted: (it as any).material_interpreted ?? null,
        colour: (it as any).colour ?? null,
        secondary_components_json: (it as any).secondary_components_json ?? null,
        weathering_class: (it as any).weathering_class ?? null,
        rock_type: (it as any).rock_type ?? null,
        recovery_type: (it as any).recovery_type ?? null,
        water_condition: (it as any).water_condition ?? null,
        drilling_response_json: (it as any).drilling_response_json ?? null,
        logging_phrase_output: (it as any).logging_phrase_output ?? null,
        free_text_note: (it as any).free_text_note ?? null,
      } as any);
      importedIntervals += 1;
    }

    if (dr?.clean_out && typeof dr.clean_out === 'object') {
      await siteCleanOutRepo.upsertByRecord(recordId, {
        method_air: Number(dr.clean_out.method_air ?? 0),
        method_water: Number(dr.clean_out.method_water ?? 0),
        method_grout: Number(dr.clean_out.method_grout ?? 0),
        clean_out_depth_m: dr.clean_out.clean_out_depth_m ?? null,
        clean_out_datetime: dr.clean_out.clean_out_datetime ?? null,
        base_condition: dr.clean_out.base_condition ?? null,
        sedimentation_observed: Number(dr.clean_out.sedimentation_observed ?? 0),
        approved_for_grouting: Number(dr.clean_out.approved_for_grouting ?? 0),
        approval_note: dr.clean_out.approval_note ?? null,
      } as any);
    }
  }

  if (pack.interpretation && typeof pack.interpretation === 'object') {
    await siteInterpretationRepo.upsert(createdElementId, {
      confidence: pack.interpretation.confidence ?? null,
      summary: pack.interpretation.summary ?? null,
      interpretation_json: pack.interpretation.interpretation_json ?? null,
      reference_tor_depth_m: pack.interpretation.reference_tor_depth_m ?? null,
      reference_tor_velocity_ms: pack.interpretation.reference_tor_velocity_ms ?? null,
      actual_tor_depth_m: pack.interpretation.actual_tor_depth_m ?? null,
      tor_variance_m: pack.interpretation.tor_variance_m ?? null,
      tor_variance_reason_json: pack.interpretation.tor_variance_reason_json ?? null,
      continuous_rock_start_m: pack.interpretation.continuous_rock_start_m ?? null,
      weak_band_intervals_json: pack.interpretation.weak_band_intervals_json ?? null,
      interpretation_confidence: pack.interpretation.interpretation_confidence ?? null,
      interpretation_summary: pack.interpretation.interpretation_summary ?? null,
    } as any);
  }

  if (pack.verification && typeof pack.verification === 'object') {
    if (pack.verification.anchor) await siteVerificationRepo.upsertAnchorByElement(createdElementId, JSON.stringify(pack.verification.anchor));
    if (pack.verification.pile) await siteVerificationRepo.upsertPileByElement(createdElementId, JSON.stringify(pack.verification.pile));
  }

  if (pack.approval && typeof pack.approval === 'object') {
    await siteApprovalRepo.upsertByElement(createdElementId, {
      logged_by: pack.approval.logged_by ?? null,
      reviewed_by: pack.approval.reviewed_by ?? null,
      approved_by: pack.approval.approved_by ?? null,
      approved_for_grouting: Number(pack.approval.approved_for_grouting ?? 0),
      approval_datetime: pack.approval.approval_datetime ?? null,
      approval_comment: pack.approval.approval_comment ?? null,
    } as any);
  }

  let importedEvents = 0;
  for (const e of Array.isArray(pack.field_events) ? pack.field_events : []) {
    await siteFieldEventRepo.create({
      element_id: createdElementId,
      drilling_record_id: null,
      event_datetime: e?.event_datetime ?? null,
      category: e?.category ?? null,
      depth_m: e?.depth_m ?? null,
      note: e?.note ?? null,
      created_by: e?.created_by ?? null,
    } as any);
    importedEvents += 1;
  }

  // Photos: metadata-only export. Import intentionally does not create photo rows by default because blobs are not present.
  const importedPhotosMeta = Array.isArray(pack.photos) ? pack.photos.length : 0;

  // Learning restore: upsert used phrases/patterns into the site phrase library for future suggestions.
  try {
    const learning = pack.learning && typeof pack.learning === 'object' ? pack.learning : null;
    const phrases = Array.isArray(learning?.phrases) ? learning.phrases : [];
    for (const p of phrases) {
      const category = String(p?.category || '').trim();
      const text = String(p?.text || '').trim();
      if (!category || !text) continue;
      await siteLoggingPhraseRepo.upsertUnique({ category, text, site_id: site.id });
    }
    const famStats = Array.isArray(learning?.template_family_stats) ? learning.template_family_stats : [];
    for (const f of famStats) {
      const fam = String(f?.family || '').trim();
      if (!fam) continue;
      await siteLoggingPhraseRepo.upsertUnique({ category: 'template_family', text: fam, site_id: site.id });
    }
  } catch {
    // best-effort learning import only
  }

  if (pack.output_report && typeof pack.output_report === 'object') {
    const reportText = String(pack.output_report.report_text || '').trim();
    const reportJson = JSON.stringify(pack.output_report.report_json ?? {}, null, 2);
    if (reportText) await siteOutputReportRepo.upsertByElementId(createdElementId, reportText, reportJson);
  }

  return { createdSite, createdElementId, importedIntervals, importedRecords, importedDesignInputs, importedEvents, importedPhotosMeta };
};
