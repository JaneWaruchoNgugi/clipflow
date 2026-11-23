import { useState } from 'react';
import { ClipEditor } from './components/ClipEditor';
import { SavedLinks } from './components/SavedLinks';
import { ToastProvider } from './components/Toast';

type View = 'editor' | 'links';

export default function App() {
  const [view, setView] = useState<View>('editor');
  const go = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  return (
    <ToastProvider>
      <header>
        <div className="logo">▶</div>
        <div>
          <h1>ClipFlow</h1>
          <small>Shorts Studio · everything stays on your phone</small>
        </div>
      </header>
      <main>
        {/* Editor stays mounted so switching tabs keeps your video and edits. */}
        <section className={`view${view === 'editor' ? ' on' : ''}`}>
          <ClipEditor active={view === 'editor'} />
        </section>
        <section className={`view${view === 'links' ? ' on' : ''}`}>
          <SavedLinks />
        </section>
      </main>
      <nav>
        <button type="button" className={view === 'editor' ? 'on' : ''} onClick={() => go('editor')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M10 9l5 3-5 3z" fill="currentColor" />
          </svg>
          Clip Editor
        </button>
        <button type="button" className={view === 'links' ? 'on' : ''} onClick={() => go('links')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          </svg>
          Saved Links
        </button>
      </nav>
    </ToastProvider>
  );
}
