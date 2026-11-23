import type { SavedLink } from './types';

const KEY = 'clipflow.links.v1';

export function loadLinks(): SavedLink[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((l): l is SavedLink => !!l && typeof l.url === 'string') : [];
  } catch {
    return [];
  }
}

/** Returns false when storage is blocked (private mode etc). */
export function storeLinks(links: SavedLink[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(links));
    return true;
  } catch {
    return false;
  }
}

/** Adds https:// if missing and checks it parses as a real web link. Returns null if invalid. */
export function normalizeUrl(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const p = new URL(u);
    return p.hostname.includes('.') ? p.href : null;
  } catch {
    return null;
  }
}

export function platformName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^(www|m)\./, '');
    if (/youtube\.com|youtu\.be/.test(h)) return 'YouTube';
    if (/tiktok\.com/.test(h)) return 'TikTok';
    if (/instagram\.com/.test(h)) return 'Instagram';
    if (/facebook\.com|fb\.watch/.test(h)) return 'Facebook';
    if (/(^|\.)x\.com|twitter\.com/.test(h)) return 'X';
    return h;
  } catch {
    return '';
  }
}
