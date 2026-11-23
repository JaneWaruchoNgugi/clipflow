import { useRef, useState, type FormEvent } from 'react';
import { loadLinks, normalizeUrl, platformName, storeLinks } from '../lib/links';
import type { SavedLink } from '../lib/types';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Field, IconButton } from './ui';

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#ff4d4d',
  TikTok: '#25f4ee',
  Instagram: '#e1306c',
  Facebook: '#4c8bf5',
  X: '#e7e7ea',
};

function timeAgo(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function SavedLinks() {
  const toast = useToast();
  const [links, setLinks] = useState<SavedLink[]>(loadLinks);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  const update = (next: SavedLink[]) => {
    setLinks(next);
    if (!storeLinks(next)) toast('Couldn’t save: this browser is blocking storage.', { tone: 'error' });
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Paste or type a link first.');
      urlRef.current?.focus();
      return;
    }
    const u = normalizeUrl(url);
    if (!u) {
      setError('That doesn’t look like a web link. Check it starts with https://');
      urlRef.current?.focus();
      return;
    }
    if (links.some((l) => l.url === u)) {
      setError('You’ve already saved this link.');
      return;
    }
    update([{ title: title.trim(), url: u, added: Date.now() }, ...links]);
    setTitle('');
    setUrl('');
    setError('');
    toast('Link saved', { tone: 'success' });
  };

  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) throw new Error('empty');
      setUrl(t);
      setError('');
    } catch {
      toast('Couldn’t read the clipboard. Long-press the link box to paste.');
      urlRef.current?.focus();
    }
  };

  const copy = (u: string) => {
    if (!navigator.clipboard) return toast('Copying isn’t available in this browser.', { tone: 'error' });
    navigator.clipboard.writeText(u).then(
      () => toast('Link copied', { tone: 'success' }),
      () => toast('Copying isn’t available in this browser.', { tone: 'error' }),
    );
  };

  const remove = (i: number) => {
    const before = links;
    const gone = links[i];
    update(links.filter((_, j) => j !== i));
    toast(`Deleted “${gone.title || platformName(gone.url) || 'link'}”`, {
      action: { label: 'Undo', onClick: () => update(before) },
    });
  };

  return (
    <div className="links-page">
      <form className="card" onSubmit={add} noValidate>
        <h2 className="title-md">Save a video link</h2>
        <p className="muted small">Keep ideas and references in one place. Links stay on this device.</p>
        <Field label="Link" htmlFor="lUrl">
          <div className="input-row">
            <span className="input-row__icon">
              <Icon name="link" size={18} />
            </span>
            <input
              ref={urlRef}
              id="lUrl"
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://…"
              value={url}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'lUrlErr' : undefined}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
            />
            <button type="button" className="input-row__action" onClick={paste}>
              Paste
            </button>
          </div>
          {error && (
            <p className="field-error" id="lUrlErr" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
        </Field>
        <Field label="Title" htmlFor="lTitle" hint="Optional">
          <input
            id="lTitle"
            className="input"
            type="text"
            placeholder="e.g. Hook idea for Monday"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block icon="plus">
          Save link
        </Button>
      </form>

      <section className="card" aria-labelledby="savedTitle">
        <div className="card__head">
          <h2 className="title-md" id="savedTitle">
            Saved links
          </h2>
          {links.length > 0 && <span className="chip">{links.length}</span>}
        </div>
        {links.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">
              <Icon name="bookmark" size={24} />
            </div>
            <p className="empty__title">No saved links yet</p>
            <p className="muted small">Links you save above will appear here.</p>
          </div>
        ) : (
          <ul className="linklist">
            {links.map((l, i) => {
              const plat = platformName(l.url);
              return (
                <li key={`${l.added}-${l.url}`} className="linkitem">
                  <span
                    className="linkitem__badge"
                    style={{ ['--badge' as string]: PLATFORM_COLORS[plat] ?? '#8b8b98' }}
                    aria-hidden="true"
                  >
                    {(plat || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="linkitem__body">
                    <p className="linkitem__title">{l.title || plat || 'Untitled'}</p>
                    <p className="linkitem__url">{l.url.replace(/^https?:\/\/(www\.)?/, '')}</p>
                    <p className="linkitem__meta">
                      {plat} · {timeAgo(l.added)}
                    </p>
                  </div>
                  <div className="linkitem__acts">
                    <a
                      className="iconbtn iconbtn--ghost"
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${l.title || plat}`}
                      title="Open"
                    >
                      <Icon name="external" />
                    </a>
                    <IconButton icon="copy" label={`Copy ${l.title || plat} link`} onClick={() => copy(l.url)} />
                    <IconButton icon="trash" label={`Delete ${l.title || plat}`} onClick={() => remove(i)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
