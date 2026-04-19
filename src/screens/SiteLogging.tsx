import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getActiveProjectId } from '../state/activeProject';
import { projectRepo } from '../repositories/projectRepo';
import { siteRepo } from '../repositories/siteRepo';
import { supportElementRepo } from '../repositories/supportElementRepo';
import { siteGroundReferenceRepo } from '../repositories/siteGroundReferenceRepo';
import { siteBoreholeCalibrationRepo } from '../repositories/siteBoreholeCalibrationRepo';
import { siteLoggingPhraseRepo } from '../repositories/siteLoggingPhraseRepo';
import { siteDesignInputRepo } from '../repositories/siteDesignInputRepo';
import type { Site } from '../types/siteLogging';
import type { SupportElementRecordListRow } from '../repositories/supportElementRepo';
import { LOGGING_PHRASE_SEEDS, SITE_GROUND_REFERENCE_SEEDS } from '../services/siteLoggingSeeds';
import {
  normalizeElementType,
  normalizeStatus,
  formatStatusLabel,
  formatTypeLabel,
  canContinueStatus,
} from '../services/siteLoggingUi';
import {
  exportSiteLoggingReferencePack,
  importSiteLoggingReferencePack,
} from '../services/siteLoggingPackService';

const toNumberOrNull = (v: string): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeSeedTerm = (raw: string): string => {
  const v = String(raw || '').trim();
  if (!v) return '';
  // Convert report-ish snake_case into field-friendly terms without hardcoding site language.
  // Examples: xw_argillite -> XW argillite, clayey_sand_transition -> clayey sand transition
  const m = v.match(/^(xw|mw|hw|sw|rs)_(.+)$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2].replace(/_/g, ' ')}`.trim();
  return v.replace(/_/g, ' ').trim();
};

const splitSeedSentences = (txt: string): string[] => {
  const v = String(txt || '').replace(/\s+/g, ' ').trim();
  if (!v) return [];
  return v
    .split(/[.;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith('.') ? s : `${s}.`))
    .filter((s) => s.length >= 10 && s.length <= 140)
    .slice(0, 8);
};

export const SiteLogging: React.FC = () => {
  const navigate = useNavigate();
  const activeProjectId = getActiveProjectId();
  const activeProject = activeProjectId ? projectRepo.getById(activeProjectId) : null;

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [rows, setRows] = useState<SupportElementRecordListRow[]>([]);

  const [showUtilities, setShowUtilities] = useState<boolean>(false);

  const [newSiteCode, setNewSiteCode] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [siteCodeError, setSiteCodeError] = useState<string>('');
  const siteCodeInputRef = useRef<HTMLInputElement | null>(null);
  const addSiteSectionRef = useRef<HTMLDivElement | null>(null);
  const importPackInputRef = useRef<HTMLInputElement | null>(null);

  const [newElementType, setNewElementType] = useState('anchor');
  const [newElementCode, setNewElementCode] = useState('');

  const selectedSite = useMemo(() => sites.find((s) => s.id === selectedSiteId) ?? null, [sites, selectedSiteId]);

  const [filterSiteId, setFilterSiteId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [editDraft, setEditDraft] = useState<{
    element_code: string;
    status: string;
    chainage: string;
    location_description: string;
  } | null>(null);

  const seedProjectReferences = async (projectId: string, projectSites: Site[]) => {
    // Seeding must never block core CRUD. During PWA hot-updates, some devices can
    // run new UI code before the DB instance is hard-reloaded and migrated.
    try {
      await siteLoggingPhraseRepo.seedIfEmpty(LOGGING_PHRASE_SEEDS);
    } catch (e) {
      console.warn('[SiteLogging] Phrase seed skipped:', e);
    }
    for (const site of projectSites) {
      const seed = SITE_GROUND_REFERENCE_SEEDS.find((item) => item.site_code === site.site_code);
      if (!seed) continue;
      try {
        const existing = siteGroundReferenceRepo.getGroundReferenceBySite(site.id);
        if (!existing) {
          await siteGroundReferenceRepo.upsertGroundReferenceBySite(projectId, site.id, seed.groundReference as any);
        }
      } catch (e) {
        console.warn('[SiteLogging] GroundReference seed skipped:', e);
      }
      try {
        const calibrations = siteBoreholeCalibrationRepo.listBySite(site.id);
        if (calibrations.length === 0 && seed.calibrations.length > 0) {
          await siteBoreholeCalibrationRepo.upsertManyForSite(site.id, seed.calibrations);
        }
      } catch (e) {
        console.warn('[SiteLogging] Borehole calibration seed skipped:', e);
      }

      // Seed site-specific phrase hints derived from the report extract (reference-only).
      // This is "content-flexible": it provides initial suggestions but field edits/usage will evolve it.
      try {
        const expectedAbove = Array.isArray((seed.groundReference as any)?.expected_material_above_tor_json)
          ? (seed.groundReference as any).expected_material_above_tor_json
          : (() => {
              try {
                const v = JSON.parse(String((seed.groundReference as any)?.expected_material_above_tor_json || '[]'));
                return Array.isArray(v) ? v : [];
              } catch {
                return [];
              }
            })();
        const expectedBelow = Array.isArray((seed.groundReference as any)?.expected_material_below_tor_json)
          ? (seed.groundReference as any).expected_material_below_tor_json
          : (() => {
              try {
                const v = JSON.parse(String((seed.groundReference as any)?.expected_material_below_tor_json || '[]'));
                return Array.isArray(v) ? v : [];
              } catch {
                return [];
              }
            })();
        const units = (() => {
          try {
            const v = JSON.parse(String((seed.groundReference as any)?.geotechnical_units_json || '[]'));
            return Array.isArray(v) ? v : [];
          } catch {
            return [];
          }
        })();
        const notes = String((seed.groundReference as any)?.reference_notes || '').trim();
        const risks = (() => {
          try {
            const v = JSON.parse(String((seed.groundReference as any)?.site_risk_flags_json || '[]'));
            return Array.isArray(v) ? v.map(String) : [];
          } catch {
            return [];
          }
        })();

        const phraseSeeds: Array<{ category: string; text: string; site_id: string }> = [];
        for (const t of [...expectedAbove, ...expectedBelow]) {
          const norm = normalizeSeedTerm(String(t || ''));
          if (!norm) continue;
          phraseSeeds.push({ category: 'interpreted_material', text: norm, site_id: site.id });
        }
        for (const u of units) {
          const norm = normalizeSeedTerm(String(u || ''));
          if (!norm) continue;
          phraseSeeds.push({ category: 'observed_material', text: norm, site_id: site.id });
        }
        for (const s of splitSeedSentences(notes)) {
          phraseSeeds.push({ category: 'common_phrase', text: s, site_id: site.id });
        }

        // Context seeds: preferred sentence families + interpretation hints.
        const lowerNotes = notes.toLowerCase();
        const lowerUnits = [...expectedAbove, ...expectedBelow, ...units].map((x) => String(x || '').toLowerCase());
        const hasTransition = lowerNotes.includes('transition') || lowerNotes.includes('competent') || lowerUnits.some((u) => u.includes('transition') || u.includes('rock'));
        const hasColluvium = lowerUnits.some((u) => u.includes('colluv')) || lowerNotes.includes('colluv');
        const hasBoulder = lowerNotes.includes('boulder') || risks.some((r) => String(r).includes('boulder'));
        const hasGroundwater = risks.some((r) => String(r).includes('groundwater')) || lowerNotes.includes('groundwater');

        const families: string[] = [];
        if (hasTransition) families.push('rock_transition', 'interpreted_first');
        if (hasColluvium || hasBoulder) families.push('mixed', 'condition_led');
        if (hasGroundwater) families.push('condition_led');
        if (families.length === 0) families.push('mixed');

        const uniqFamilies = [...new Set(families)].slice(0, 3);
        if (uniqFamilies[0]) phraseSeeds.push({ category: 'template_family_primary', text: uniqFamilies[0], site_id: site.id });
        for (const f of uniqFamilies) phraseSeeds.push({ category: 'template_family', text: f, site_id: site.id });

        for (const h of splitSeedSentences(notes).slice(0, 4)) {
          phraseSeeds.push({ category: 'interpretation_hint', text: h, site_id: site.id });
        }

        if (phraseSeeds.length) {
          await siteLoggingPhraseRepo.upsertManyUnique(phraseSeeds);
        }
      } catch (e) {
        console.warn('[SiteLogging] Site phrase seed skipped:', e);
      }
    }
  };

  const reload = async () => {
    if (!activeProjectId) {
      setSites([]);
      setRows([]);
      return;
    }

    try {
      const s = siteRepo.listByProject(activeProjectId);
      await seedProjectReferences(activeProjectId, s);
      setSites(s);
      if (!selectedSiteId) setSelectedSiteId(s[0]?.id || '');
      if (!filterSiteId && s[0]?.id) setFilterSiteId(s[0].id);

      setRows(
        supportElementRepo.listForRecordList(activeProjectId, {
          siteId: filterSiteId || undefined,
          elementType: filterType || undefined,
          status: filterStatus || undefined,
          queryText: filterQuery.trim() || undefined,
          limit: showAllRecords ? 200 : 30,
        })
      );
    } catch (e) {
      console.error('[SiteLogging] Reload failed:', e);
      alert(`Site Logging failed to load: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    setRows(
      supportElementRepo.listForRecordList(activeProjectId, {
        siteId: filterSiteId || undefined,
        elementType: filterType || undefined,
        status: filterStatus || undefined,
        queryText: filterQuery.trim() || undefined,
        limit: showAllRecords ? 200 : 30,
      })
    );
  }, [activeProjectId, filterSiteId, filterType, filterStatus, filterQuery, showAllRecords]);

  const openEditBasicInfo = (row: SupportElementRecordListRow) => {
    setEditingId(row.id);
    setEditDraft({
      element_code: row.element_code || '',
      status: normalizeStatus(row.status),
      chainage: row.chainage != null ? String(row.chainage) : '',
      location_description: row.location_description || '',
    });
  };

  const saveEditBasicInfo = async () => {
    if (!editingId || !editDraft) return;
    try {
      await supportElementRepo.update(editingId, {
        element_code: editDraft.element_code.trim() || null,
        status: normalizeStatus(editDraft.status),
        chainage: toNumberOrNull(editDraft.chainage),
        location_description: editDraft.location_description.trim() || null,
      } as any);
      setEditingId('');
      setEditDraft(null);
      await reload();
    } catch (e) {
      alert(`Failed to update: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const duplicateRecord = async (row: SupportElementRecordListRow) => {
    if (!activeProjectId) return;
    if (!selectedSite && !row.site_id) return;
    try {
      const newId = await supportElementRepo.create({
        project_id: row.project_id,
        site_id: row.site_id,
        element_type: normalizeElementType(row.element_type),
        element_code: row.element_code ? `${row.element_code}-COPY` : null,
        status: 'draft',
        location_description: row.location_description ?? null,
        chainage: row.chainage ?? null,
        offset_description: row.offset_description ?? null,
        ground_rl: row.ground_rl ?? null,
        hole_angle_deg: row.hole_angle_deg ?? null,
        hole_diameter_mm: row.hole_diameter_mm ?? null,
        rig_type: row.rig_type ?? null,
        rig_model: row.rig_model ?? null,
        bit_type: row.bit_type ?? null,
        created_by: row.created_by ?? null,
      } as any);

      // Best-effort: carry design inputs forward (new element starts with same design intent).
      const designs = siteDesignInputRepo.listByElement(row.id);
      for (const d of designs) {
        await siteDesignInputRepo.upsert(newId, d.design_type, d.input_json, { element_type: normalizeElementType(row.element_type) });
      }

      await reload();
      navigate(`/site-logging/element/${newId}`);
    } catch (e) {
      alert(`Failed to duplicate: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const archiveRecord = async (row: SupportElementRecordListRow) => {
    const ok = window.confirm(`Archive/delete this record?\n\n${row.element_code || row.id.slice(0, 8)} (${formatTypeLabel(row.element_type)})`);
    if (!ok) return;
    try {
      await supportElementRepo.softDelete(row.id);
      await reload();
    } catch (e) {
      alert(`Failed to archive: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const createSite = async () => {
    if (!activeProjectId) return alert('Select an active project first.');
    const code = newSiteCode.trim();
    if (!code) {
      setSiteCodeError('Site code is required.');
      // Ensure the user sees the missing field on mobile-sized screens.
      try {
        siteCodeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // ignore
      }
      siteCodeInputRef.current?.focus();
      return;
    }
    try {
      const id = await siteRepo.create({
        project_id: activeProjectId,
        site_code: code,
        site_name: newSiteName.trim() || null,
        chainage_from_km: null,
        chainage_to_km: null,
        notes: null,
      });
      setNewSiteCode('');
      setNewSiteName('');
      setSiteCodeError('');
      await reload();
      setSelectedSiteId(id);
      setFilterSiteId(id);
    } catch (e) {
      console.error('[SiteLogging] Create site failed:', e);
      alert(`Failed to add site: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const jumpToAddSite = () => {
    try {
      addSiteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      // ignore
    }
    // Give scroll a beat before focusing, so mobile browsers don't fight the scroll.
    window.setTimeout(() => siteCodeInputRef.current?.focus(), 50);
  };

  const clearSwCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    try {
      // Best-effort: clears Vite PWA precache and runtime cache.
      const w: any = window as any;
      if (w.caches && typeof w.caches.keys === 'function') {
        const keys = await w.caches.keys();
        await Promise.all(keys.map((k: string) => w.caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  const exportReferencePack = () => {
    if (!activeProjectId) return;
    try {
      const pack = exportSiteLoggingReferencePack(activeProjectId);
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `site-logging-pack-${activeProject.code || activeProjectId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }, 1000);
    } catch (e) {
      alert(`Failed to export pack: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startImportReferencePack = () => {
    importPackInputRef.current?.click();
  };

  const onImportPackFile = async (file: File | null) => {
    if (!file || !activeProjectId) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importSiteLoggingReferencePack(activeProjectId, json);
      await reload();
      alert(
        `Import complete.\n` +
          `Sites created: ${res.createdSites}\n` +
          `Ground references updated: ${res.updatedGroundReferences}\n` +
          `Calibrations rows imported: ${res.calibrationsRows}\n` +
          `Phrases upserted: ${res.upsertedPhrases}`
      );
    } catch (e) {
      alert(`Failed to import pack: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (importPackInputRef.current) importPackInputRef.current.value = '';
    }
  };

  const createElement = async (overrideType?: string) => {
    if (!activeProjectId) return alert('Select an active project first.');
    if (!selectedSiteId) return alert('Select a site first.');
    try {
      const elementType = normalizeElementType(overrideType ?? newElementType);
      const id = await supportElementRepo.create({
        project_id: activeProjectId,
        site_id: selectedSiteId,
        element_type: elementType,
        element_code: newElementCode.trim() || null,
        status: 'draft',
        location_description: null,
        chainage: selectedSite?.chainage_from_km != null ? selectedSite.chainage_from_km * 1000 : null,
        offset_description: null,
        ground_rl: null,
        hole_angle_deg: null,
        hole_diameter_mm: null,
        rig_type: null,
        rig_model: null,
        bit_type: null,
        created_by: 'Field',
      });
      setNewElementCode('');
      await reload();
      navigate(`/site-logging/element/${id}`);
    } catch (e) {
      console.error('[SiteLogging] Create element failed:', e);
      alert(`Failed to create element: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const updateSelectedSite = async (patch: Partial<Omit<Site, 'id' | 'project_id'>>) => {
    if (!selectedSiteId) return;
    await siteRepo.update(selectedSiteId, patch);
    reload();
  };

  if (!activeProjectId || !activeProject) {
    return (
      <Layout title="Site Logging">
        <div className="p-4 text-sm text-zinc-700">
          No active project selected. Go to <button className="underline" onClick={() => navigate('/projects')}>Projects</button>.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Site Logging">
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs font-semibold text-zinc-500">Active project</div>
          <div className="text-sm font-bold text-zinc-800">{activeProject.name} ({activeProject.code})</div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-zinc-800">Record List</div>
            <div className="flex gap-2">
              <button
                onClick={jumpToAddSite}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-emerald-700"
              >
                Add site
              </button>
              <button
                onClick={() => setShowUtilities((v) => !v)}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                title="Show/hide secondary utilities (export/import, cache reset, library)"
              >
                Utilities {showUtilities ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-zinc-600">
            SupportElement table grid (per Word spec). Reports are reference-only; validation must rely on field observations and measured depths.
          </div>

          {showUtilities && (
            <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase text-zinc-600">Utilities</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportReferencePack}
                    className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    title="Export site reference pack (JSON)"
                  >
                    Export pack
                  </button>
                  <button
                    onClick={startImportReferencePack}
                    className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    title="Import site reference pack (JSON)"
                  >
                    Import pack
                  </button>
                  <button
                    onClick={() => void clearSwCacheAndReload()}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold uppercase text-amber-900 hover:bg-amber-100"
                    title="Unregister Service Worker and clear cache, then reload"
                  >
                    Clear cache & reload
                  </button>
                  <button
                    onClick={() => navigate('/site-logging/library')}
                    className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    title="View and maintain phrase library (secondary tool)"
                  >
                    Phrase library
                  </button>
                  <button
                    onClick={reload}
                    className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                    title="Reload list"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                Keep Utilities closed during drilling. These are secondary tools.
              </div>
            </div>
          )}

          {sites.length === 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-bold">No sites yet</div>
              <div className="mt-1 text-[12px] text-amber-800">
                Create a Site first, then you can create Anchor/Soil Nail or Pile records against it.
              </div>
              <div className="mt-2">
                <button
                  onClick={jumpToAddSite}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white hover:bg-emerald-700"
                >
                  Create first site
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.site_code}{s.site_name ? ` - ${s.site_name}` : ''}
                </option>
              ))}
            </select>
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="Search (code / location)"
            />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">All types</option>
              <option value="anchor_soil_nail">Anchor / Soil nail</option>
              <option value="pile">Pile</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="finalised">Finalised</option>
            </select>
          </div>

          <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
            <div className="text-[11px] font-bold uppercase text-zinc-700">Quick Create</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site_code}{s.site_name ? ` - ${s.site_name}` : ''}
                  </option>
                ))}
              </select>
              <input
                value={newElementCode}
                onChange={(e) => setNewElementCode(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Element code (optional)"
              />
              <button onClick={() => createElement('anchor')} disabled={!selectedSiteId}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                + Anchor / Soil nail
              </button>
              <button onClick={() => createElement('micro_pile')} disabled={!selectedSiteId}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                + Pile
              </button>
            </div>

            <div className="mt-3 border-t pt-3">
              <div ref={addSiteSectionRef} className="text-[11px] font-semibold text-zinc-600">
                Add site
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <input
                    ref={siteCodeInputRef}
                    value={newSiteCode}
                    onChange={(e) => {
                      setNewSiteCode(e.target.value);
                      if (siteCodeError) setSiteCodeError('');
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm ${siteCodeError ? 'border-rose-400 ring-1 ring-rose-200' : ''}`}
                    placeholder="Site code (e.g. CCH013)"
                    aria-invalid={!!siteCodeError}
                  />
                  {siteCodeError && <div className="text-[11px] font-semibold text-rose-600">{siteCodeError}</div>}
                </div>
                <input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Site name (optional)" />
                <button onClick={createSite} className="col-span-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">Add site</button>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left text-[11px] font-bold uppercase text-zinc-600">
                  <th className="px-3 py-2">Element</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2 text-right">
                    <button
                      onClick={() => setShowAllRecords((v) => !v)}
                      className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                      title={showAllRecords ? 'Collapse to recent records' : 'Show more records'}
                    >
                      {showAllRecords ? 'Collapse' : 'Show more'}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-zinc-500" colSpan={6}>No records.</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t ${
                      normalizeStatus(r.status) === 'in_progress' ? 'bg-indigo-50/40' :
                      normalizeStatus(r.status) === 'draft' ? 'bg-amber-50/40' :
                      normalizeStatus(r.status) === 'review' ? 'bg-rose-50/40' :
                      ''
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold text-zinc-800">{r.element_code || '(no code)'}</td>
                    <td className="px-3 py-2 text-zinc-700">{formatTypeLabel(r.element_type)}</td>
                    <td className="px-3 py-2 text-zinc-700">{r.site_code}{r.site_name ? ` - ${r.site_name}` : ''}</td>
                    <td className="px-3 py-2 text-zinc-700">{formatStatusLabel(r.status)}</td>
                    <td className="px-3 py-2 text-zinc-600">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                    <td className="px-3 py-2 text-right">
                      {(() => {
                        const st = normalizeStatus(r.status);
                        const canContinue = canContinueStatus(st);
                        return (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              onClick={() => navigate(`/site-logging/element/${r.id}`)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => navigate(`/site-logging/element/${r.id}`)}
                              disabled={!canContinue}
                              className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                              title={canContinue ? 'Continue active logging' : 'Continue is only available for Draft / Logging in progress'}
                            >
                              Continue
                            </button>
                            <button
                              onClick={() => openEditBasicInfo(r)}
                              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => duplicateRecord(r)}
                              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                            >
                              Duplicate
                            </button>
                            <button
                              onClick={() => archiveRecord(r)}
                              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-rose-700 hover:bg-rose-50"
                            >
                              Archive
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingId && editDraft && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-xl border bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-zinc-900">Edit basic info</div>
                  <button
                    onClick={() => {
                      setEditingId('');
                      setEditDraft(null);
                    }}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    value={editDraft.element_code}
                    onChange={(e) => setEditDraft({ ...editDraft, element_code: e.target.value })}
                    className="col-span-2 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Element code"
                  />
                  <select
                    value={editDraft.status}
                    onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="in_progress">In progress</option>
                    <option value="review">Review</option>
                    <option value="finalised">Finalised</option>
                  </select>
                  <input
                    value={editDraft.chainage}
                    onChange={(e) => setEditDraft({ ...editDraft, chainage: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Chainage (m, optional)"
                    inputMode="decimal"
                  />
                  <textarea
                    value={editDraft.location_description}
                    onChange={(e) => setEditDraft({ ...editDraft, location_description: e.target.value })}
                    className="col-span-2 min-h-[90px] w-full rounded-lg border p-3 text-sm"
                    placeholder="Location description"
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingId('');
                      setEditDraft(null);
                    }}
                    className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveEditBasicInfo()}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={importPackInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => void onImportPackFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </Layout>
  );
};
