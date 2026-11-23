export type VideoSource =
  | { kind: 'file'; url: string; name: string; size: number }
  | { kind: 'url'; url: string; name: string };

const BLOCKED: { re: RegExp; name: string }[] = [
  { re: /(^|\.)(youtube\.com|youtu\.be)$/, name: 'YouTube' },
  { re: /(^|\.)tiktok\.com$/, name: 'TikTok' },
  { re: /(^|\.)instagram\.com$/, name: 'Instagram' },
  { re: /(^|\.)(facebook\.com|fb\.watch)$/, name: 'Facebook' },
  { re: /(^|\.)(x\.com|twitter\.com)$/, name: 'X' },
  { re: /(^|\.)snapchat\.com$/, name: 'Snapchat' },
];

export type LinkCheck =
  | { ok: true; url: string; name: string }
  | { ok: false; reason: 'empty' | 'invalid' }
  | { ok: false; reason: 'platform'; platform: string };

/** Checks a pasted link before trying to load it as a video. */
export function checkVideoLink(input: string): LinkCheck {
  let u = input.trim();
  if (!u) return { ok: false, reason: 'empty' };
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!parsed.hostname.includes('.')) return { ok: false, reason: 'invalid' };
  const host = parsed.hostname.toLowerCase();
  const hit = BLOCKED.find((b) => b.re.test(host));
  if (hit) return { ok: false, reason: 'platform', platform: hit.name };
  const name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || host);
  return { ok: true, url: parsed.href, name };
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
