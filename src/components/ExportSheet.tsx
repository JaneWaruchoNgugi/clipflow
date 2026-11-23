import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatBytes } from '../lib/source';
import { Icon } from './Icon';
import { Button, IconButton } from './ui';

export type ExportPhase = 'confirm' | 'running' | 'done' | 'error';

export interface ExportOutput {
  url: string;
  name: string;
  file: File;
  ext: string;
}

interface Props {
  phase: ExportPhase;
  progress: number;
  clipLength: number;
  outW: number;
  outH: number;
  container: 'MP4' | 'WebM' | null;
  hasCaption: boolean;
  output: ExportOutput | null;
  error: string;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}

/** Bottom sheet (dialog on desktop) that walks through export: confirm → progress → done/error. */
export function ExportSheet(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const running = p.phase === 'running';

  // Move focus into the sheet when it opens or changes phase.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
    el?.focus();
  }, [p.phase]);

  // Simple focus trap + Escape to close.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !running) {
      e.stopPropagation();
      p.onClose();
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], video[controls]');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const canShare = !!p.output && typeof navigator.canShare === 'function' && navigator.canShare({ files: [p.output.file] });
  const secs = Math.ceil(p.clipLength);
  const remaining = Math.max(0, Math.ceil(p.clipLength * (1 - p.progress)));

  return (
    <div className="sheet-backdrop" onClick={() => !running && p.onClose()}>
      <div
        className="sheet"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheetTitle"
        tabIndex={-1}
        onKeyDown={onKey}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id="sheetTitle" className="title-md">
            {p.phase === 'confirm' && 'Export clip'}
            {p.phase === 'running' && 'Exporting…'}
            {p.phase === 'done' && 'Your clip is ready'}
            {p.phase === 'error' && 'Export didn’t finish'}
          </h2>
          {!running && <IconButton icon="close" label="Close" onClick={p.onClose} />}
        </div>

        {p.phase === 'confirm' && (
          <>
            <dl className="summary">
              <div>
                <dt>Length</dt>
                <dd>{p.clipLength.toFixed(1)}s</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {p.outW} × {p.outH}
                </dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{p.container ?? 'Not supported'}</dd>
              </div>
              <div>
                <dt>Caption</dt>
                <dd>{p.hasCaption ? 'Yes' : 'None'}</dd>
              </div>
            </dl>
            <p className="help">
              Export plays your clip once while recording it, so it takes about {secs} second{secs === 1 ? '' : 's'}. Keep
              this screen open until it finishes.
            </p>
            {p.container === 'WebM' && (
              <p className="alert alert--warn">
                <Icon name="alert" size={18} />
                <span>This browser saves WebM. Most apps play it; update Chrome to get MP4.</span>
              </p>
            )}
            <Button variant="primary" size="lg" block icon="download" onClick={p.onStart} disabled={!p.container} data-autofocus>
              Start export
            </Button>
          </>
        )}

        {p.phase === 'running' && (
          <>
            <div
              className="progress"
              role="progressbar"
              aria-label="Export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p.progress * 100)}
            >
              <i style={{ transform: `scaleX(${p.progress})` }} />
            </div>
            <div className="progress-meta">
              <b>{Math.round(p.progress * 100)}%</b>
              <span className="muted">About {remaining}s left · keep this screen open</span>
            </div>
            <Button block onClick={p.onCancel} data-autofocus>
              Cancel export
            </Button>
          </>
        )}

        {p.phase === 'done' && p.output && (
          <>
            <video className="sheet__video" src={p.output.url} controls playsInline />
            <p className="muted small center">
              {p.output.name} · {formatBytes(p.output.file.size)}
            </p>
            <div className="btn-row">
              <a className="btn btn--primary btn--lg" href={p.output.url} download={p.output.name} data-autofocus>
                <Icon name="download" /> Save video
              </a>
              {canShare && (
                <Button
                  size="lg"
                  icon="share"
                  onClick={() => navigator.share({ files: [p.output!.file], title: 'ClipFlow clip' }).catch(() => {})}
                >
                  Share
                </Button>
              )}
            </div>
            <Button variant="ghost" block onClick={p.onClose}>
              Back to editing
            </Button>
          </>
        )}

        {p.phase === 'error' && (
          <>
            <p className="alert alert--error" role="alert">
              <Icon name="alert" size={18} />
              <span>{p.error}</span>
            </p>
            <div className="btn-row">
              <Button onClick={p.onClose}>Close</Button>
              <Button variant="primary" onClick={p.onStart} data-autofocus>
                Try again
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
