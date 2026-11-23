/** Client for the ClipFlow download server (see /server). */

const KEY = 'clipflow.server.v1';

export interface ServerConfig {
  url: string;
  key: string;
}

/**
 * Default server address. VITE_API_URL overrides it at build time; otherwise it is the
 * Cloud Run address that `gcloud run deploy clipflow-api` gets in Firebase project
 * clipflow-e1d70 (project number 212955757755, region us-central1).
 */
const DEFAULT_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'https://clipflow-api-212955757755.us-central1.run.app';

export function loadServerConfig(): ServerConfig {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<ServerConfig> | null;
    return { url: v?.url?.trim() || DEFAULT_URL, key: v?.key ?? '' };
  } catch {
    return { url: DEFAULT_URL, key: '' };
  }
}

export function saveServerConfig(c: ServerConfig): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ url: c.url.trim().replace(/\/+$/, ''), key: c.key.trim() }));
    return true;
  } catch {
    return false;
  }
}

export class RemoteError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

function apiBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Checks the server is reachable and the key is accepted. */
export async function testServer(c: ServerConfig, signal?: AbortSignal): Promise<{ needsKey: boolean }> {
  if (!c.url) throw new RemoteError('Add your server address first.', 'no_server');
  let r: Response;
  try {
    r = await fetch(`${apiBase(c.url)}/api/health`, { signal });
  } catch {
    throw new RemoteError('Can’t reach the server. Check the address and that it’s deployed.', 'offline');
  }
  if (!r.ok) throw new RemoteError(`The server answered with an error (${r.status}).`, 'bad_status');
  const j = (await r.json()) as { needsKey?: boolean };
  return { needsKey: !!j.needsKey };
}

export interface RemoteVideo {
  blob: Blob;
  title: string;
  site: string;
  filename: string;
}

export type RemoteProgress = { stage: 'preparing' } | { stage: 'receiving'; loaded: number; total: number };

/**
 * Asks the server to fetch the video, then streams the MP4 back with progress.
 * The server does the slow part first ("preparing"), then sends the file ("receiving").
 */
export async function fetchRemoteVideo(
  pageUrl: string,
  c: ServerConfig,
  onProgress: (p: RemoteProgress) => void,
  signal?: AbortSignal,
): Promise<RemoteVideo> {
  if (!c.url) throw new RemoteError('Set up your download server first.', 'no_server');
  onProgress({ stage: 'preparing' });
  let r: Response;
  try {
    r = await fetch(`${apiBase(c.url)}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(c.key ? { 'X-ClipFlow-Key': c.key } : {}) },
      body: JSON.stringify({ url: pageUrl }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // Browsers report "no server here", a crash and CORS the same way; ask /api/health to tell them apart.
    const alive = await fetch(`${apiBase(c.url)}/api/health`, { signal }).then((h) => h.ok, () => false);
    throw new RemoteError(
      alive
        ? 'The server is up but refused this app’s request. Check ALLOWED_ORIGINS on the server (see DEPLOY.md).'
        : `No ClipFlow server answered at ${apiBase(c.url)}. Check that the deploy finished and that the address in server settings matches it.`,
      alive ? 'cors' : 'offline',
    );
  }
  if (!r.ok) {
    let msg = `The server couldn’t get this video (error ${r.status}).`;
    let code = 'http_' + r.status;
    try {
      const j = (await r.json()) as { detail?: { message?: string; code?: string } };
      if (j.detail?.message) msg = j.detail.message;
      if (j.detail?.code) code = j.detail.code;
    } catch {
      /* keep default */
    }
    throw new RemoteError(msg, code);
  }

  const total = Number(r.headers.get('Content-Length') || 0);
  const site = r.headers.get('X-Video-Site') || '';
  const title = decodeURIComponent(r.headers.get('X-Video-Title') || '') || `${site || 'Downloaded'} video`;
  const cd = r.headers.get('Content-Disposition') || '';
  const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)?.[1];
  const type = r.headers.get('Content-Type')?.split(';')[0] || 'video/mp4';
  const filename = fromHeader ? decodeURIComponent(fromHeader) : `video.${type.includes('webm') ? 'webm' : 'mp4'}`;

  let blob: Blob;
  if (r.body) {
    const reader = r.body.getReader();
    const parts: BlobPart[] = [];
    let loaded = 0;
    onProgress({ stage: 'receiving', loaded, total });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.byteLength;
      onProgress({ stage: 'receiving', loaded, total });
    }
    blob = new Blob(parts, { type });
  } else {
    blob = await r.blob();
  }
  if (!blob.size) throw new RemoteError('The server sent an empty file. Try again.', 'empty');
  return { blob, title, site, filename };
}
