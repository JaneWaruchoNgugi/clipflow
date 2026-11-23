import { useState } from 'react';
import { ClipEditor } from './components/ClipEditor';
import { Icon, type IconName } from './components/Icon';
import { SavedLinks } from './components/SavedLinks';
import { ToastProvider } from './components/Toast';

type View = 'editor' | 'links';
const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: 'editor', label: 'Editor', icon: 'scissors' },
  { id: 'links', label: 'Saved links', icon: 'bookmark' },
];

export default function App() {
  const [view, setView] = useState<View>('editor');
  const go = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  const navItems = (cls: string) =>
    NAV.map((n) => (
      <button
        key={n.id}
        type="button"
        className={`${cls}${view === n.id ? ' is-on' : ''}`}
        aria-current={view === n.id ? 'page' : undefined}
        onClick={() => go(n.id)}
      >
        <Icon name={n.icon} size={20} />
        <span>{n.label}</span>
      </button>
    ));

  return (
    <ToastProvider>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="appbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="play" size={14} />
          </span>
          <span className="brand__name">ClipFlow</span>
          <span className="brand__tag">Shorts Studio</span>
        </div>
        <nav className="topnav" aria-label="Main">
          {navItems('topnav__item')}
        </nav>
      </header>

      <main id="main" className={`main main--${view}`}>
        {/* The editor stays mounted so switching tabs keeps your video and edits. */}
        <div hidden={view !== 'editor'}>
          <ClipEditor active={view === 'editor'} />
        </div>
        <div hidden={view !== 'links'}>
          <SavedLinks />
        </div>
      </main>

      <nav className="bottomnav" aria-label="Main">
        {navItems('bottomnav__item')}
      </nav>
    </ToastProvider>
  );
}
