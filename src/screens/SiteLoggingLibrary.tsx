import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getActiveProjectId } from '../state/activeProject';
import { projectRepo } from '../repositories/projectRepo';
import { siteRepo } from '../repositories/siteRepo';
import { siteLoggingPhraseRepo } from '../repositories/siteLoggingPhraseRepo';
import type { Site, SiteLoggingPhrase } from '../types/siteLogging';
import { SITE_LOGGING_PHRASE_BASE_CATEGORIES } from '../services/siteLoggingPhrasePolicy';

// Library categories should reflect the active Site Logging phrase system (controlled categories).
const CATEGORIES: Array<SiteLoggingPhrase['category']> = [...SITE_LOGGING_PHRASE_BASE_CATEGORIES];

export const SiteLoggingLibrary: React.FC = () => {
  const navigate = useNavigate();
  const activeProjectId = getActiveProjectId();
  const activeProject = activeProjectId ? projectRepo.getById(activeProjectId) : null;

  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [scope, setScope] = useState<'all' | 'global' | 'site'>('all');
  const [category, setCategory] = useState<string>('');
  const [queryText, setQueryText] = useState<string>('');

  const [rows, setRows] = useState<SiteLoggingPhrase[]>([]);

  const [formId, setFormId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('observed_material');
  const [formOriginalCategory, setFormOriginalCategory] = useState<string>('');
  const [formText, setFormText] = useState<string>('');
  const [formScope, setFormScope] = useState<'global' | 'site'>('global');
  const [formSiteId, setFormSiteId] = useState<string>('');

  const [importText, setImportText] = useState<string>('');

  const selectedSite = useMemo(() => sites.find((s) => s.id === siteId) ?? null, [sites, siteId]);

  const reload = () => {
    const list = siteLoggingPhraseRepo.listForLibrary({
      siteId: siteId || null,
      scope,
      category: category || undefined,
      queryText: queryText.trim() || undefined,
    });
    setRows(list);
  };

  useEffect(() => {
    if (!activeProjectId) {
      setSites([]);
      setRows([]);
      return;
    }
    const s = siteRepo.listByProject(activeProjectId);
    setSites(s);
    if (!siteId) setSiteId(s[0]?.id || '');
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, scope, category, queryText]);

  const resetForm = () => {
    setFormId('');
    setFormCategory('observed_material');
    setFormOriginalCategory('');
    setFormText('');
    setFormScope('global');
    setFormSiteId('');
  };

  const startEdit = (p: SiteLoggingPhrase) => {
    setFormId(p.id);
    const full = String(p.category || '').trim();
    setFormOriginalCategory(full);
    setFormCategory(full.split('@')[0] || full);
    setFormText(p.text);
    setFormScope(p.site_id ? 'site' : 'global');
    setFormSiteId(p.site_id ?? '');
  };

  const savePhrase = async () => {
    const text = formText.trim();
    if (!text) return alert('Phrase text is required.');
    const cat = String(formCategory || '').trim() || 'observed_material';
    const nextSiteId = formScope === 'site' ? (formSiteId || siteId || '') : '';
    if (formScope === 'site' && !nextSiteId) return alert('Select a site for site-specific phrases.');

    try {
      if (formId) {
        // Preserve any "@type" suffix from the original category if the base category did not change.
        const original = String(formOriginalCategory || '').trim();
        const origBase = original ? original.split('@')[0] : '';
        const origSuffix = original && original.includes('@') ? `@${original.split('@').slice(1).join('@')}` : '';
        const nextCategory = origBase && origBase === cat ? `${cat}${origSuffix}` : cat;
        await siteLoggingPhraseRepo.update(formId, {
          category: nextCategory,
          text,
          site_id: formScope === 'site' ? nextSiteId : null,
        } as any);
      } else {
        await siteLoggingPhraseRepo.upsertUnique({
          category: cat,
          text,
          site_id: formScope === 'site' ? nextSiteId : null,
        });
      }
      resetForm();
      reload();
    } catch (e) {
      console.error(e);
      alert(`Failed to save phrase: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const removePhrase = async (id: string) => {
    if (!confirm('Delete this phrase?')) return;
    await siteLoggingPhraseRepo.remove(id);
    reload();
  };

  const copyJson = async () => {
    const payload = rows.map((r) => ({
      category: r.category,
      text: r.text,
      site_id: r.site_id,
      site_specific: r.site_specific,
    }));
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied JSON to clipboard.');
    } catch (e) {
      console.warn(e);
      alert('Copy failed. Use manual select/copy from the box below.');
      setImportText(text);
    }
  };

  const importJson = async () => {
    const raw = importText.trim();
    if (!raw) return alert('Paste JSON first.');
    let items: any[] = [];
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return alert(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!items.length) return alert('JSON must be an array of phrases.');

    let inserted = 0;
    for (const item of items) {
      const cat = String(item.category || '').trim();
      const text = String(item.text || '').trim();
      if (!cat || !text) continue;
      const site = item.site_id ? String(item.site_id) : null;
      await siteLoggingPhraseRepo.upsertUnique({ category: cat, text, site_id: site });
      inserted++;
    }
    alert(`Imported ${inserted} phrase(s) (duplicates skipped).`);
    reload();
  };

  if (!activeProjectId || !activeProject) {
    return (
      <Layout title="Site Logging Library" showBack>
        <div className="p-4 text-sm text-zinc-700">
          No active project selected. Go to <button className="underline" onClick={() => navigate('/projects')}>Projects</button>.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Site Logging Library" showBack>
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs font-semibold text-zinc-500">Active project</div>
          <div className="text-sm font-bold text-zinc-800">{activeProject.name} ({activeProject.code})</div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-zinc-800">Lookup Library (Phrases)</div>
            <div className="flex gap-2">
              <button onClick={copyJson} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Copy JSON</button>
              <button onClick={reload} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Refresh</button>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-zinc-600">
            This library drives Field Logging quick-pick. Use global phrases for all sites, and site-specific phrases when terminology differs.
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">(no site selected)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.site_code}{s.site_name ? ` - ${s.site_name}` : ''}</option>
              ))}
            </select>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="all">Scope: global + site</option>
              <option value="global">Scope: global only</option>
              <option value="site">Scope: site only</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input value={queryText} onChange={(e) => setQueryText(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Search phrase text" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left text-[11px] font-bold uppercase text-zinc-600">
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="px-3 py-3 text-zinc-500" colSpan={4}>No phrases.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-semibold text-zinc-800">{r.category}</td>
                    <td className="px-3 py-2 text-zinc-700">{r.text}</td>
                    <td className="px-3 py-2 text-zinc-600">
                      {r.site_id ? `Site: ${sites.find((s) => s.id === r.site_id)?.site_code || r.site_id}` : 'Global'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Edit</button>
                        <button onClick={() => removePhrase(r.id)} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-zinc-800">{formId ? 'Edit phrase' : 'Add phrase'}</div>
            <button onClick={resetForm} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Reset</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={formScope} onChange={(e) => setFormScope(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="global">Global</option>
              <option value="site">Site-specific</option>
            </select>
            {formScope === 'site' ? (
              <select value={formSiteId || siteId} onChange={(e) => setFormSiteId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm col-span-2">
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.site_code}{s.site_name ? ` - ${s.site_name}` : ''}</option>
                ))}
              </select>
            ) : (
              <div className="col-span-2 text-[11px] text-zinc-600">Global phrases apply to all sites.</div>
            )}
            <textarea value={formText} onChange={(e) => setFormText(e.target.value)} className="col-span-2 min-h-[80px] w-full rounded-lg border p-3 text-sm" placeholder="Phrase text" />
            <button onClick={savePhrase} className="col-span-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              Save phrase
            </button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="text-sm font-bold text-zinc-800">Import JSON</div>
          <div className="mt-2 text-[11px] text-zinc-600">
            Paste an array of objects: {`[{ category, text, site_id? }]`}. Duplicates are skipped by (category + text + site).
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="min-h-[120px] w-full rounded-lg border p-3 font-mono text-[12px]" placeholder='[{"category":"observed_material","text":"Colluvium with cobbles"}]' />
            <div className="flex gap-2">
              <button onClick={importJson} className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700">Import</button>
              <button onClick={() => setImportText('')} className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200">Clear</button>
              <div className="ml-auto text-[11px] text-zinc-600">
                Current site: {selectedSite?.site_code || '(none)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
