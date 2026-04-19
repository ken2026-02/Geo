import React from 'react';
import type { SitePhotoAttachment } from '../../types/siteLogging';
import { PHOTO_TYPE_REFERENCE_DIAGRAM } from '../../services/siteLoggingUi';

export function ReferenceDiagramCard({
  diagram,
  diagramUrl,
  onEnlarge,
  onRemove,
  file,
  onFileChange,
  caption,
  onCaptionChange,
  onUpload,
}: {
  diagram: SitePhotoAttachment | null;
  diagramUrl: string | null;
  onEnlarge: () => void;
  onRemove: () => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] font-bold uppercase text-zinc-500">Reference diagram (guidance only)</div>
      <div className="mt-1 text-[12px] text-zinc-600">
        Optional. Stored locally and shown only in the Pile verification context and a dedicated report section.
      </div>

      <div className="mt-3 rounded-lg border bg-zinc-50 p-3">
        {diagram ? (
          <>
            <button
              onClick={onEnlarge}
              className="w-full overflow-hidden rounded-md bg-zinc-100"
              title="Click to enlarge"
            >
              {diagramUrl ? (
                <img
                  src={diagramUrl}
                  alt={diagram.caption || 'Reference diagram'}
                  className="max-h-[260px] w-full object-contain"
                />
              ) : (
                <div className="flex h-[180px] w-full items-center justify-center text-[11px] text-zinc-500">Loading</div>
              )}
            </button>
            <div className="mt-2 text-[12px] font-semibold text-zinc-900">{diagram.caption || 'Reference diagram'}</div>
            <div className="mt-1 text-[11px] text-zinc-600">
              Type: {PHOTO_TYPE_REFERENCE_DIAGRAM}{diagram.updated_at ? `  |  Updated: ${diagram.updated_at}` : ''}
            </div>
            <button
              onClick={onRemove}
              className="mt-3 w-full rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
            >
              Remove diagram
            </button>
          </>
        ) : (
          <div className="text-sm text-zinc-600">No reference diagram uploaded yet.</div>
        )}
      </div>

      <div className="mt-3 rounded-lg border bg-white p-3">
        <div className="text-[11px] font-bold uppercase text-zinc-600">Upload / replace</div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          />
          <input
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
            placeholder="Caption (optional)"
          />
          <button
            onClick={onUpload}
            disabled={!file}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Upload diagram
          </button>
        </div>
      </div>
    </div>
  );
}
