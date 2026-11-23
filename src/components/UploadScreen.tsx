import { useState, type DragEvent, type FormEvent } from 'react';
import { checkVideoLink } from '../lib/source';
import { Icon } from './Icon';
import { Button } from './ui';

interface Props {
  onPickFile: () => void;
  onDropFile: (f: File) => void;
  onLoadUrl: (url: string, name: string) => void;
  loading: boolean;
  error: string;
  onClearError: () => void;
}

export function UploadScreen({ onPickFile, onDropFile, onLoadUrl, loading, error, onClearError }: Props) {
  const [link, setLink] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [over, setOver] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onClearError();
    const r = checkVideoLink(link);
    if (r.ok) {
      setLinkMsg('');
      onLoadUrl(r.url, r.name);
    } else if (r.reason === 'platform') {
      setLinkMsg(
        `${r.platform} links can’t be opened here: ${r.platform} doesn’t let other apps load its videos. Save the video to your phone first (only videos you own or have permission to use), then choose it with “Choose video”. You can keep the link in Saved Links.`,
      );
    } else {
      setLinkMsg(r.reason === 'empty' ? 'Paste a link to a video file first.' : 'That doesn’t look like a web link.');
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onDropFile(f);
  };

  const msg = linkMsg || error;

  return (
    <div className="upload">
      <div className="upload__intro">
        <h2 className="title-lg">Start a new clip</h2>
        <p className="muted">Trim, caption and export vertical videos. Your video never leaves this device.</p>
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
        <p className="dropzone__sub">MP4, MOV or WebM · any length</p>
        <Button variant="primary" size="lg" icon="upload" onClick={onPickFile} disabled={loading}>
          Choose video
        </Button>
      </div>

      <div className="divider">
        <span>or paste a video link</span>
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
            placeholder="https://example.com/video.mp4"
            value={link}
            aria-invalid={!!msg || undefined}
            aria-describedby="linkHelp"
            onChange={(e) => {
              setLink(e.target.value);
              setLinkMsg('');
              onClearError();
            }}
          />
        </div>
        <Button type="submit" variant="secondary" block disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Loading video…
            </>
          ) : (
            'Load link'
          )}
        </Button>
        {msg ? (
          <p className="alert alert--error" id="linkHelp" role="alert">
            <Icon name="alert" size={18} />
            <span>{msg}</span>
          </p>
        ) : (
          <p className="help" id="linkHelp">
            Works with direct links to video files on sites that allow it. YouTube, TikTok and Instagram links can’t be
            loaded.
          </p>
        )}
      </form>

      <ul className="privacy">
        <li>
          <Icon name="lock" size={16} /> Processed on your device. Nothing is uploaded.
        </li>
      </ul>
    </div>
  );
}
