import { useState } from 'react';
import { loadServerConfig, saveServerConfig, testServer, type ServerConfig } from '../lib/remote';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Field } from './ui';

/** Form for the download server's address and access key (stored on this device only). */
export function ServerSettings({ onSaved, onClose }: { onSaved: (c: ServerConfig) => void; onClose?: () => void }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<ServerConfig>(loadServerConfig);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const save = async () => {
    setStatus(null);
    setTesting(true);
    try {
      const { needsKey } = await testServer(cfg);
      if (needsKey && !cfg.key.trim()) {
        setStatus({ tone: 'error', msg: 'This server needs an access key. Add it below.' });
        return;
      }
      if (!saveServerConfig(cfg)) throw new Error('Couldn’t save on this device (storage blocked).');
      setStatus({ tone: 'ok', msg: 'Connected. Settings saved on this device.' });
      toast('Download server connected', { tone: 'success' });
      onSaved(loadServerConfig());
    } catch (e) {
      setStatus({ tone: 'error', msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="server-settings">
      <div className="card__head">
        <h3 className="title-md">Download server</h3>
      </div>
      <p className="help">
        Downloading from YouTube, TikTok and Instagram needs your own ClipFlow server. The setup guide is in the repo’s
        server folder.
      </p>
      <Field label="Server address" htmlFor="srvUrl">
        <input
          id="srvUrl"
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://clipflow-api-xxxxx.a.run.app"
          value={cfg.url}
          onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
        />
      </Field>
      <Field label="Access key" htmlFor="srvKey" hint="Kept on this device">
        <input
          id="srvKey"
          className="input"
          type="password"
          autoComplete="off"
          placeholder="The ACCESS_KEY you set on the server"
          value={cfg.key}
          onChange={(e) => setCfg({ ...cfg, key: e.target.value })}
        />
      </Field>
      {status && (
        <p className={`alert ${status.tone === 'ok' ? 'alert--ok' : 'alert--error'}`} role="status">
          <Icon name={status.tone === 'ok' ? 'check' : 'alert'} size={18} />
          <span>{status.msg}</span>
        </p>
      )}
      <div className="btn-row">
        {onClose && <Button onClick={onClose}>Close</Button>}
        <Button variant="primary" onClick={save} disabled={testing || !cfg.url.trim()}>
          {testing ? (
            <>
              <span className="spinner" aria-hidden="true" /> Checking…
            </>
          ) : (
            'Save & test'
          )}
        </Button>
      </div>
    </div>
  );
}
