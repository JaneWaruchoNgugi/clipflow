import { useState } from 'react';
import { loadLinks, normalizeUrl, platformName, storeLinks } from '../lib/links';
import type { SavedLink } from '../lib/types';
import { useToast } from './Toast';

export function SavedLinks() {
  const toast = useToast();
  const [links, setLinks] = useState<SavedLink[]>(loadLinks);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const update = (next: SavedLink[]) => {
    setLinks(next);
    if (!storeLinks(next)) toast('Could not save (storage blocked)');
  };

  const add = () => {
    if (!url.trim()) return toast('Paste a link first');
    const u = normalizeUrl(url);
    if (!u) return toast('That doesn’t look like a link');
    update([{ title: title.trim(), url: u, added: Date.now() }, ...links]);
    setTitle('');
    setUrl('');
    toast('Link saved');
  };

  const paste = async () => {
    try {
      setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      toast('Long-press the box to paste');
    }
  };

  const copy = (u: string) => {
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(
      () => toast('Link copied'),
      () => toast('Copy not available'),
    );
  };

  const remove = (i: number) => {
    const gone = links[i];
    update(links.filter((_, j) => j !== i));
    toast(`Deleted “${gone.title || 'Untitled'}”`);
  };

  return (
    <>
      <div className="card">
        <h2>Save a video link</h2>
        <label htmlFor="lTitle">Title (optional)</label>
        <input id="lTitle" type="text" placeholder="e.g. Funny cat idea" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="lUrl">Link</label>
        <input
          id="lUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={paste}>
            Paste
          </button>
          <button type="button" className="primary" onClick={add}>
            Save link
          </button>
        </div>
        <p className="hint">
          Links are saved in this browser only. ClipFlow doesn’t download from YouTube, TikTok or Instagram; use it to keep
          ideas and references in one place.
        </p>
      </div>
      <div className="card">
        <h2>Saved links {links.length ? `(${links.length})` : ''}</h2>
        <ul className="links">
          {links.length === 0 && <li className="empty">No links yet. Save one above.</li>}
          {links.map((l, i) => (
            <li key={`${l.added}-${i}`}>
              <div className="t">
                {l.title || 'Untitled'}
                <span className="tag">{platformName(l.url)}</span>
              </div>
              <div className="u">{l.url}</div>
              <div className="acts">
                <a className="btn" href={l.url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
                <button type="button" onClick={() => copy(l.url)}>
                  Copy
                </button>
                <button type="button" onClick={() => remove(i)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
