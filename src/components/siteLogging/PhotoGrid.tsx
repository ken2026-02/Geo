import React from 'react';
import type { SitePhotoAttachment } from '../../types/siteLogging';

export function PhotoGrid({
  photos,
  photoUrls,
  onEnlarge,
  onRemove,
}: {
  photos: SitePhotoAttachment[];
  photoUrls: Record<string, string>;
  onEnlarge: (photoId: string) => void;
  onRemove: (photoId: string, blobKey: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {photos.length === 0 && <div className="col-span-3 text-sm text-zinc-500">No photos yet.</div>}
      {photos.map((p) => (
        <div key={p.id} className="rounded-lg border bg-white p-2">
          <button
            onClick={() => onEnlarge(p.id)}
            className="aspect-square w-full overflow-hidden rounded-lg bg-zinc-100"
          >
            {photoUrls[p.id] ? (
              <img src={photoUrls[p.id]} alt={p.caption || 'Site photo'} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">Loading</div>
            )}
          </button>
          <div className="mt-2 text-[11px] font-semibold text-zinc-800 line-clamp-2">{p.caption || 'Photo'}</div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">
            {(p.photo_type || 'other')}{p.depth_m != null ? ` @ ${p.depth_m.toFixed(2)} m` : ''}
            {p.taken_datetime || p.created_at ? ` / ${p.taken_datetime || p.created_at}` : ''}
          </div>
          <button
            onClick={() => onRemove(p.id, p.blob_key)}
            className="mt-2 w-full rounded-lg bg-zinc-100 px-3 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-200"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

