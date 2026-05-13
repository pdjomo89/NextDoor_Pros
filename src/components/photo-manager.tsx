'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';

const MAX_PHOTOS = 8;

export type PhotoLabels = {
  title: string;
  help: string;
  upload: string;
  uploading: string;
  remove: string;
  empty: string;
  max: string;
  failed: string;
};

export function PhotoManager({ labels: l }: { labels: PhotoLabels }) {
  const photos = useQuery(api.contractors.myPhotos) as
    | { storageId: string; url: string }[]
    | undefined;
  const generateUploadUrl = useMutation(api.contractors.generateUploadUrl);
  const addPhotos = useMutation(api.contractors.addPhotos);
  const removePhoto = useMutation(api.contractors.removePhoto);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const count = photos?.length ?? 0;
  const remaining = Math.max(0, MAX_PHOTOS - count);
  const atMax = remaining === 0;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const picked = files.slice(0, remaining);
      const storageIds: string[] = [];
      for (const file of picked) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = (await res.json()) as { storageId: string };
        storageIds.push(storageId);
      }
      if (storageIds.length > 0) await addPhotos({ storageIds: storageIds as never });
    } catch (err) {
      console.error(err);
      setError(l.failed);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(storageId: string) {
    setRemoving(storageId);
    setError(null);
    try {
      await removePhoto({ storageId: storageId as never });
    } catch (err) {
      console.error(err);
      setError(l.failed);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-navy">{l.title}</h3>
          <p className="mt-0.5 text-sm text-navy/60">{l.help}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || atMax}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? l.uploading : l.upload}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPick}
        />
      </div>

      {atMax && <p className="mt-3 text-xs text-navy/50">{l.max}</p>}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {photos === undefined ? (
        <div className="mt-5 flex items-center justify-center py-8 text-navy/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <p className="mt-5 text-sm text-navy/50">{l.empty}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.storageId}
              className="group relative aspect-square overflow-hidden rounded-xl border border-navy/10 bg-navy/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onRemove(p.storageId)}
                disabled={removing === p.storageId}
                aria-label={l.remove}
                className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-red-600 shadow-sm backdrop-blur transition-opacity hover:bg-white disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
              >
                {removing === p.storageId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
