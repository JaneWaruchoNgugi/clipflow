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

export function canExport(canvas: HTMLCanvasElement): boolean {
  return pickMimeType() !== null && typeof canvas.captureStream === 'function';
}

export interface ExportResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = t;
    setTimeout(done, 1500);
  });
}

/**
 * Plays the trimmed range in real time, drawing each frame (with caption) to the canvas
 * and recording the canvas plus the video's audio with MediaRecorder.
 */
export async function exportClip(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  start: number;
  end: number;
  settings: EditSettings;
  onProgress: (p: number) => void;
}): Promise<ExportResult> {
  const { video, canvas, start, end, settings, onProgress } = opts;
  const mime = pickMimeType();
  if (mime === null || !canvas.captureStream) throw new Error('This browser cannot record video.');

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

  await seekTo(video, start);
  drawFrame(canvas, video, settings);
  rec.start(250);

  let finished = false;
  const stop = () => {
    if (finished) return;
    finished = true;
    video.pause();
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
  const tick = () => {
    if (finished) return;
    drawFrame(canvas, video, settings);
    onProgress(Math.min(1, (video.currentTime - start) / (end - start)));
    if (video.currentTime >= end || video.ended) {
      stop();
      return;
    }
    requestAnimationFrame(tick);
  };
  video.addEventListener('ended', stop, { once: true });
  try {
    await video.play();
  } catch {
    stop();
  }
  requestAnimationFrame(tick);
  // Safety net in case the tab gets throttled in the background.
  const safety = setTimeout(stop, (end - start) * 2500 + 5000);
  await stopped;
  clearTimeout(safety);
  stream.getVideoTracks().forEach((t) => t.stop());
  audio?.setSpeakerMuted(false);

  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error('Nothing was recorded. Try again, and keep the screen on while it runs.');
  return { blob, ext: type.includes('mp4') ? 'mp4' : 'webm' };
}
