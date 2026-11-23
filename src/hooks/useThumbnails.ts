import { useEffect, useState } from 'react';

/**
 * Builds a filmstrip of small JPEG thumbnails for the timeline using a separate, muted
 * video element on the same object URL (so the source file is never read into memory).
 * Thumbnails are tiny (~60px tall) and revoked when the source changes.
 */
export function useThumbnails(src: string | null, duration: number, count: number, remote = false): string[] {
  const [thumbs, setThumbs] = useState<string[]>([]);

  useEffect(() => {
    setThumbs([]);
    if (!src || !duration || count < 1) return;
    let cancelled = false;
    const urls: string[] = [];
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    if (remote) v.crossOrigin = 'anonymous';
    v.src = src;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');

    const seek = (t: number) =>
      new Promise<void>((resolve, reject) => {
        const ok = () => {
          cleanup();
          resolve();
        };
        const bad = () => {
          cleanup();
          reject(new Error('thumb'));
        };
        const cleanup = () => {
          v.removeEventListener('seeked', ok);
          v.removeEventListener('error', bad);
        };
        v.addEventListener('seeked', ok);
        v.addEventListener('error', bad);
        v.currentTime = t;
      });

    const run = async () => {
      await new Promise<void>((res, rej) => {
        if (v.readyState >= 1) return res();
        v.addEventListener('loadedmetadata', () => res(), { once: true });
        v.addEventListener('error', () => rej(new Error('meta')), { once: true });
      });
      const h = 64;
      c.height = h;
      c.width = Math.max(1, Math.round((h * (v.videoWidth || 16)) / (v.videoHeight || 9)));
      for (let i = 0; i < count && !cancelled; i++) {
        await seek(Math.min(duration - 0.05, ((i + 0.5) / count) * duration));
        if (cancelled || !g) return;
        g.drawImage(v, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.6));
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setThumbs((t) => [...t, url]);
      }
    };
    run().catch(() => {
      /* filmstrip is decorative; the timeline still works without it */
    });

    return () => {
      cancelled = true;
      v.removeAttribute('src');
      v.load();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [src, duration, count, remote]);

  return thumbs;
}
