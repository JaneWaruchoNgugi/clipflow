import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { fetchRemoteVideo, loadServerConfig, RemoteError, type RemoteProgress, type RemoteVideo } from '../lib/remote';
import { checkVideoLink, formatBytes } from '../lib/source';
import { Icon } from './Icon';
import { ServerSettings } from './ServerSettings';
import { Button, IconButton } from './ui';

interface Props {
  onPickFile: () => void;
  onFile: (f: File) => void;
  onLoadUrl: (url: string, name: string) => void;
  loading: boolean;
  error: string;
  onClearError: () => void;
}

type Job =
  | { phase: 'working'; site: string; progress: RemoteProgress }
  | { phase: 'done'; video: RemoteVideo; objectUrl: string }
  | { phase: 'error'; site: string; message: string; code: string };

export function UploadScreen({ onPickFile, onFile, onLoadUrl, loading, error, onClearError }: Props) {
  const [link, setLink] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [over, setOver] = useState(false);
  const [server, setServer] = useState(loadServerConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Free the downloaded file's URL when replaced or when leaving this screen.
  const doneUrl = job?.phase === 'done' ? job.objectUrl : null;
  useEffect(() => () => void (doneUrl && URL.revokeObjectURL(doneUrl)), [doneUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const download = async (url: string, site: string) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setJob({ phase: 'working', site, progress: { stage: 'preparing' } });
    try {
      const video = await fetchRemoteVideo(url, server, (progress) => setJob({ phase: 'working', site, progress }), ac.signal);
      setJob({ phase: 'done', video, objectUrl: URL.createObjectURL(video.blob) });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setJob(null);
        return;
      }
      const err = e instanceof RemoteError ? e : new RemoteError('Something went wrong. Try again.', 'unknown');
      setJob({ phase: 'error', site, message: err.message, code: err.code });
      if (err.code === 'bad_key' || err.code === 'offline') setShowSettings(true);
    } finally {
      abortRef.current = null;
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onClearError();
    setJob(null);
    const r = checkVideoLink(link);
    if (r.ok) {
      setLinkMsg('');
      onLoadUrl(r.url, r.name);
    } else if (r.reason === 'platform') {
      setLinkMsg('');
      if (!server.url) {
        setLinkMsg(`To get ${r.platform} videos, connect your ClipFlow download server first.`);
        setShowSettings(true);
        return;
      }
      void download(link.trim(), r.platform);
    } else {
      setLinkMsg(r.reason === 'empty' ? 'Paste a video link first.' : 'That doesn’t look like a web link.');
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  const msg = linkMsg || error;
  const busy = loading || job?.phase === 'working';

  return (
    <div className="upload">
      <div className="upload__intro">
        <h2 className="title-lg">Start a new clip</h2>
        <p className="muted">Trim, caption and export vertical videos, right in your browser.</p>
      </div>

      <div
        className={`dropzone${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <div className="dropzone__icon">
          <Icon name="film" size={28} />
        </div>
        <p className="dropzone__title">Choose a video from your phone</p>
        <p className="dropzone__sub">MP4, MOV or WebM · stays on your device</p>
        <Button variant="primary" size="lg" icon="upload" onClick={onPickFile} disabled={busy}>
          Choose video
        </Button>
      </div>

      <div className="divider">
        <span>or paste a link</span>
      </div>

      <form className="linkload" onSubmit={submit} noValidate>
        <label className="sr-only" htmlFor="videoLink">
          Video link
        </label>
        <div className="input-row">
          <span className="input-row__icon">
            <Icon name="link" size={18} />
          </span>
          <input
            id="videoLink"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="YouTube, TikTok, Instagram or .mp4 link"
            value={link}
            disabled={busy}
            aria-invalid={!!msg || undefined}
            aria-describedby="linkHelp"
            onChange={(e) => {
              setLink(e.target.value);
              setLinkMsg('');
              onClearError();
              if (job?.phase === 'error') setJob(null);
            }}
          />
        </div>
        <Button type="submit" variant="secondary" block disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Getting video…
            </>
          ) : (
            'Get video'
          )}
        </Button>
        {msg ? (
          <p className="alert alert--error" id="linkHelp" role="alert">
            <Icon name="alert" size={18} />
            <span>{msg}</span>
          </p>
        ) : (
          <p className="help" id="linkHelp">
            Only download videos you own or have permission to use.
          </p>
        )}
      </form>

      {job && (
        <RemoteJobCard
          job={job}
          onCancel={() => abortRef.current?.abort()}
          onEdit={(v) => onFile(new File([v.blob], v.filename, { type: v.blob.type || 'video/mp4' }))}
          onRetry={() => job.phase === 'error' && void download(link.trim(), job.site)}
          onDismiss={() => setJob(null)}
        />
      )}

      {showSettings ? (
        <div className="card">
          <ServerSettings
            onSaved={(c) => {
              setServer(c);
              setShowSettings(false);
              setLinkMsg('');
            }}
            onClose={() => setShowSettings(false)}
          />
        </div>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setShowSettings(true)}>
          <Icon name="link" size={16} />
          {server.url ? 'Download server settings' : 'Set up the download server'}
        </button>
      )}
    </div>
  );
}

function RemoteJobCard({
  job,
  onCancel,
  onEdit,
  onRetry,
  onDismiss,
}: {
  job: Job;
  onCancel: () => void;
  onEdit: (v: RemoteVideo) => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (job.phase === 'working') {
    const p = job.progress;
    const pct = p.stage === 'receiving' && p.total ? p.loaded / p.total : null;
    return (
      <div className="card job" aria-live="polite">
        <div className="job__row">
          <span className="spinner" aria-hidden="true" />
          <div className="job__text">
            <b>{p.stage === 'preparing' ? `Getting the video from ${job.site}…` : 'Downloading to your phone…'}</b>
            <span className="muted small">
              {p.stage === 'preparing'
                ? 'This can take up to a minute for longer videos.'
                : `${formatBytes(p.loaded)}${p.total ? ` of ${formatBytes(p.total)}` : ''}`}
            </span>
          </div>
        </div>
        <div
          className={`progress${pct === null ? ' progress--busy' : ''}`}
          role="progressbar"
          aria-label="Download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct === null ? undefined : Math.round(pct * 100)}
        >
          <i style={pct === null ? undefined : { transform: `scaleX(${pct})` }} />
        </div>
        <Button block onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }
  if (job.phase === 'error') {
    return (
      <div className="card job">
        <p className="alert alert--error" role="alert">
          <Icon name="alert" size={18} />
          <span>{job.message}</span>
        </p>
        <div className="btn-row">
          <Button onClick={onDismiss}>Dismiss</Button>
          {job.code !== 'bad_key' && (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }
  const v = job.video;
  return (
    <div className="card job">
      <div className="job__row">
        <span className="job__ok" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
        <div className="job__text">
          <b className="job__title">{v.title}</b>
          <span className="muted small">
            {v.site} · {formatBytes(v.blob.size)}
          </span>
        </div>
        <IconButton icon="close" label="Dismiss" onClick={onDismiss} />
      </div>
      <div className="btn-row">
        <a className="btn btn--secondary btn--lg" href={job.objectUrl} download={v.filename}>
          <Icon name="download" /> Save
        </a>
        <Button variant="primary" size="lg" icon="scissors" onClick={() => onEdit(v)}>
          Edit
        </Button>
      </div>
    </div>
  );
}
