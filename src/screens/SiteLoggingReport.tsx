import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supportElementRepo } from '../repositories/supportElementRepo';
import { siteRepo } from '../repositories/siteRepo';
import { siteOutputReportRepo } from '../repositories/siteOutputReportRepo';
import { sitePhotoAttachmentRepo } from '../repositories/sitePhotoAttachmentRepo';
import type { Site, SupportElement } from '../types/siteLogging';
import type { SitePhotoAttachment } from '../types/siteLogging';
import { getBlob } from '../media/mediaStore';
import { PHOTO_TYPE_REFERENCE_DIAGRAM, formatElementTypeShortLabel } from '../services/siteLoggingUi';

export const SiteLoggingReport: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const elementId = String(id || '');

  const [element, setElement] = useState<SupportElement | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [reportText, setReportText] = useState<string>('');
  const [photos, setPhotos] = useState<Array<SitePhotoAttachment & { url?: string }>>([]);
  const report = useMemo(() => siteOutputReportRepo.getByElementId(elementId), [elementId, reportText]);

  const referenceDiagram = useMemo(
    () => photos.find((p: any) => String(p.photo_type || '').trim() === PHOTO_TYPE_REFERENCE_DIAGRAM) ?? null,
    [photos]
  );
  const normalPhotos = useMemo(
    () => photos.filter((p: any) => String(p.photo_type || '').trim() !== PHOTO_TYPE_REFERENCE_DIAGRAM),
    [photos]
  );

  useEffect(() => {
    if (!elementId) return;
    const el = supportElementRepo.getById(elementId);
    setElement(el);
    setSite(el ? siteRepo.getById(el.site_id) : null);
    setReportText(report?.report_text || '');

    let cancelled = false;
    const revoke: string[] = [];
    const loadPhotos = async () => {
      if (!el) {
        setPhotos([]);
        return;
      }
      const list = sitePhotoAttachmentRepo.listByElement(el.id);
      const withUrls: Array<SitePhotoAttachment & { url?: string }> = [];
      for (const p of list) {
        try {
          const blob = await getBlob(p.blob_key);
          const url = blob ? URL.createObjectURL(blob as Blob) : '';
          if (url) revoke.push(url);
          withUrls.push({ ...p, url });
        } catch {
          withUrls.push({ ...p });
        }
      }
      if (!cancelled) setPhotos(withUrls);
      else revoke.forEach((u) => { try { URL.revokeObjectURL(String(u)); } catch { /* ignore */ } });
    };

    void loadPhotos();
    return () => {
      cancelled = true;
      revoke.forEach((u) => { try { URL.revokeObjectURL(String(u)); } catch { /* ignore */ } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  if (!elementId || !element) {
    return (
      <Layout title="Site Report" showBack>
        <div className="p-4 text-sm text-zinc-700">Report not found.</div>
      </Layout>
    );
  }

  return (
    <Layout title="Site Report" showBack>
      <div className="p-4">
        <div className="no-print flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-zinc-800">
            {site?.site_code || '-'} / {element.element_code || element.id.slice(0, 8)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/site-logging/element/${element.id}`)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
            >
              Back to element
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-indigo-700"
            >
              Print
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border bg-white p-4 print:mt-0 print:border-none print:p-0">
          <div className="text-xs font-semibold text-zinc-500">Site Logging Report</div>
          <div className="mt-1 text-sm font-bold text-zinc-900">
            {site?.site_code || '-'} {site?.site_name ? `- ${site.site_name}` : ''}
          </div>
          <div className="mt-1 text-sm text-zinc-700">
            Element: {element.element_code || element.id} ({formatElementTypeShortLabel(String(element.element_type || ''))})
          </div>
          <div className="mt-4 whitespace-pre-wrap rounded-lg border bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-900 print:border-none print:bg-white print:p-0">
            {report?.report_text || reportText || 'No output report yet. Run verification and save approvals to generate.'}
          </div>

          {referenceDiagram && (
            <div className="mt-6 rounded-lg border bg-white p-3 print:border print:rounded-none">
              <div className="text-xs font-bold uppercase text-zinc-600">Pile reference diagram (guidance only)</div>
              <div className="mt-2 text-[12px] text-zinc-600">
                This diagram is for visual reference only and does not affect calculations.
              </div>
              <div className="mt-3 break-inside-avoid rounded-lg border p-3 print:border print:rounded-none">
                <div className="h-[240px] w-full overflow-hidden rounded-md bg-zinc-100 print:rounded-none print:h-[220px]">
                  {referenceDiagram.url ? (
                    <img src={referenceDiagram.url} alt={referenceDiagram.caption || 'Reference diagram'} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">Unavailable</div>
                  )}
                </div>
                <div className="mt-2 text-[12px] font-semibold text-zinc-900">{referenceDiagram.caption || 'Reference diagram'}</div>
                <div className="mt-1 text-[11px] text-zinc-600">
                  <span className="font-semibold text-zinc-700">Type:</span> {PHOTO_TYPE_REFERENCE_DIAGRAM}
                  {referenceDiagram.updated_at ? `  |  Updated: ${referenceDiagram.updated_at}` : ''}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-lg border bg-white p-3 print:border-none print:p-0">
            <div className="text-xs font-bold uppercase text-zinc-600">Photo attachments</div>
            {normalPhotos.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500">No photos attached.</div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {normalPhotos.map((p) => (
                  <div key={p.id} className="break-inside-avoid rounded-lg border p-3 print:border print:rounded-none">
                    <div className="h-[240px] w-full overflow-hidden rounded-md bg-zinc-100 print:rounded-none print:h-[220px]">
                      {p.url ? (
                        <img src={p.url} alt={p.caption || 'Photo'} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">Unavailable</div>
                      )}
                    </div>
                    <div className="mt-2 text-[12px] font-semibold text-zinc-900">{p.caption || 'Photo'}</div>
                    <div className="mt-1 text-[11px] text-zinc-600">
                      <span className="font-semibold text-zinc-700">Type:</span> {(p as any).photo_type || 'other'}
                      {(p as any).depth_m != null ? `  |  Depth: ${(p as any).depth_m.toFixed(2)} m` : ''}
                      {p.taken_datetime ? `  |  Taken: ${p.taken_datetime}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
