import { getAudioRoute } from './audio';
import { drawFrame, outputSize } from './render';
import type { EditSettings } from './types';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** Best recording format this browser supports, '' for browser default, null if recording is impossible. */
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* keep looking */
    }
  }
  return '';
}

export function canExport(): boolean {
  return pickMimeType() !== null && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** File type the browser will produce: used to set expectations before exporting. */
export function expectedContainer(): 'MP4' | 'WebM' | null {
  const m = pickMimeType();
  if (m === null) return null;
  return m.includes('mp4') ? 'MP4' : 'WebM';
}

export interface ExportResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
}

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelled';
  }
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    timer = window.setTimeout(done, 1500);
    video.currentTime = t;
  });
}

/**
 * Plays the trimmed range in real time, drawing each frame (with caption) to the canvas
 * and recording the canvas plus the video's audio with MediaRecorder.
 * Only the recorded output is held in memory, never the source file.
 */
export async function exportClip(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  start: number;
  end: number;
  settings: EditSettings;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const { video, canvas, start, end, settings, onProgress, signal } = opts;
  const mime = pickMimeType();
  if (mime === null || !canvas.captureStream) throw new Error('This browser cannot record video.');
  if (signal?.aborted) throw new ExportCancelled();

  const audio = getAudioRoute(video);
  video.pause();
  const { w, h } = outputSize(video, settings);
  canvas.width = w;
  canvas.height = h;

  const stream = canvas.captureStream(30);
  audio?.recordStream.getAudioTracks().forEach((t) => stream.addTrack(t));
  audio?.setSpeakerMuted(true);

  const bits = w * h > 1e6 ? 8e6 : 5e6;
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bits } : { videoBitsPerSecond: bits });
  } catch {
    rec = new MediaRecorder(stream);
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  let finished = false;
  let cancelled = false;
  let raf = 0;
  const stop = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    video.pause();
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
  const onAbort = () => {
    cancelled = true;
    stop();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    await seekTo(video, start);
    drawFrame(canvas, video, settings);
    rec.start(250);
    if (cancelled) stop();

    const tick = () => {
      if (finished) return;
      drawFrame(canvas, video, settings);
      onProgress(Math.max(0, Math.min(1, (video.currentTime - start) / (end - start))));
      if (video.currentTime >= end || video.ended) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    video.addEventListener('ended', stop, { once: true });
    try {
      if (!finished) await video.play();
    } catch {
      stop();
    }
    raf = requestAnimationFrame(tick);
    // Safety net in case the tab gets throttled in the background.
    const safety = window.setTimeout(stop, (end - start) * 2500 + 5000);
    await stopped;
    window.clearTimeout(safety);
    video.removeEventListener('ended', stop);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    stream.getVideoTracks().forEach((t) => t.stop());
    audio?.setSpeakerMuted(false);
  }

  if (cancelled) throw new ExportCancelled();
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error('Nothing was recorded. Try again, and keep the screen on while it runs.');
  onProgress(1);
  return { blob, ext: type.includes('mp4') ? 'mp4' : 'webm' };
}
