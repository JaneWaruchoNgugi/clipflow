import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useThumbnails } from '../hooks/useThumbnails';
import { getAudioRoute } from '../lib/audio';
import { ExportCancelled, exportClip, expectedContainer } from '../lib/exporter';
import { outputSize } from '../lib/render';
import { formatBytes, type VideoSource } from '../lib/source';
import type { EditSettings } from '../lib/types';
import { ExportSheet, type ExportOutput, type ExportPhase } from './ExportSheet';
import { Icon, type IconName } from './Icon';
import { CaptionPanel, FormatPanel, TrimPanel } from './panels';
import { PreviewStage } from './PreviewStage';
import { MIN_CLIP, Timeline } from './Timeline';
import { useToast } from './Toast';
import { Button, IconButton } from './ui';
import { UploadScreen } from './UploadScreen';
import { formatTime } from '../lib/time';

const DEFAULTS: EditSettings = {
  caption: '',
  captionSize: 56,
  captionPosition: 'bottom',
  captionStyle: 'box',
  captionColor: '#ffffff',
  format: '9:16',
  fit: 'fill',
  quality: '1080',
};

type Tool = 'trim' | 'caption' | 'format';
const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: 'trim', label: 'Trim', icon: 'scissors' },
  { id: 'caption', label: 'Caption', icon: 'type' },
  { id: 'format', label: 'Format', icon: 'ratio' },
];

export function ClipEditor({ active }: { active: boolean }) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [source, setSource] = useState<VideoSource | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [settings, setSettings] = useState<EditSettings>(DEFAULTS);
  const [tool, setTool] = useState<Tool>('trim');

  const [phase, setPhase] = useState<ExportPhase | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState('');
  const [output, setOutput] = useState<ExportOutput | null>(null);
  const exporting = phase === 'running';

  const thumbs = useThumbnails(ready ? source?.url ?? null : null, duration, 10, source?.kind === 'url');

  const set = useCallback(<K extends keyof EditSettings>(k: K, v: EditSettings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
  }, []);

  /* ---------- resources ---------- */
  useEffect(() => {
    if (source?.kind !== 'file') return;
    const url = source.url;
    return () => URL.revokeObjectURL(url);
  }, [source]);
  useEffect(() => {
    if (!output) return;
    const url = output.url;
    return () => URL.revokeObjectURL(url);
  }, [output]);

  // Pause when leaving the editor tab, unless an export is running.
  useEffect(() => {
    if (!active && !exporting) videoRef.current?.pause();
  }, [active, exporting]);

  /* ---------- loading ---------- */
  const resetForNewSource = () => {
    setReady(false);
    setLoadError('');
    setOutput(null);
    setDuration(0);
    setPlaying(false);
  };
  const loadFile = (f: File) => {
    if (f.type && !f.type.startsWith('video/')) {
      const msg = 'That file isn’t a video. Choose an MP4, MOV or WebM file.';
      if (ready) toast(msg, { tone: 'error' });
      else setLoadError(msg);
      return;
    }
    resetForNewSource();
    setSource({ kind: 'file', url: URL.createObjectURL(f), name: f.name, size: f.size });
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) loadFile(f);
  };
  const loadUrl = (url: string, name: string) => {
    resetForNewSource();
    setSource({ kind: 'url', url, name });
  };

  const onLoaded = () => {
    const v = videoRef.current!;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    if (!d || !v.videoWidth) {
      onError();
      return;
    }
    setDuration(d);
    setStart(0);
    setEnd(d);
    setReady(true);
    v.currentTime = Math.min(0.01, d);
  };
  const onError = () => {
    if (!source) return;
    setLoadError(
      source.kind === 'url'
        ? 'Couldn’t load that link. It may not be a direct video file, or the site doesn’t allow other apps to use its videos. Download the video and choose the file instead.'
        : 'This video can’t be played in your browser. Try an MP4 (H.264) file.',
    );
    setReady(false);
    setSource(null);
  };

  /* ---------- playback & trim ---------- */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || exporting || !ready) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.05) v.currentTime = start;
      getAudioRoute(v);
      v.play().catch(() => toast('Playback was blocked. Tap play again.', { tone: 'error' }));
    } else v.pause();
  }, [exporting, ready, start, end, toast]);

  // Stop at the end of the trimmed range during preview.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing || exporting) return;
    let raf = 0;
    const check = () => {
      if (v.currentTime >= end) {
        v.pause();
        v.currentTime = start;
        return;
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [playing, exporting, start, end]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) v.pause();
    v.currentTime = t;
  }, []);
  const changeStart = useCallback(
    (t: number) => {
      const s = Math.max(0, Math.min(t, end - MIN_CLIP));
      setStart(s);
      seek(s);
      return s;
    },
    [end, seek],
  );
  const changeEnd = useCallback(
    (t: number) => {
      const e = Math.min(duration, Math.max(t, start + MIN_CLIP));
      setEnd(e);
      seek(Math.max(start, e - 0.05));
      return e;
    },
    [duration, start, seek],
  );
  const startAtPlayhead = useCallback(() => {
    const s = changeStart(videoRef.current?.currentTime ?? 0);
    toast(`Start set to ${formatTime(s)}`);
  }, [changeStart, toast]);
  const endAtPlayhead = useCallback(() => {
    const e = changeEnd(videoRef.current?.currentTime ?? 0);
    toast(`End set to ${formatTime(e)}`);
  }, [changeEnd, toast]);
  const resetTrim = useCallback(() => {
    setStart(0);
    setEnd(duration);
    seek(0);
  }, [duration, seek]);

  // Space bar plays/pauses when focus isn't in a text field or button.
  useEffect(() => {
    if (!active || !ready) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== 'Space' || phase) return;
      if (t.closest('input, textarea, button, a, [role="slider"], [role="radio"], [role="tab"]')) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, ready, phase, togglePlay]);

  /* ---------- export ---------- */
  const { w: outW, h: outH } = useMemo(
    () => (ready && videoRef.current ? outputSize(videoRef.current, settings) : { w: 0, h: 0 }),
    [ready, settings],
  );
  const container = useMemo(() => expectedContainer(), []);

  const openExport = () => {
    videoRef.current?.pause();
    setExportError('');
    setPhase('confirm');
  };
  const closeSheet = () => {
    setPhase(null);
    requestAnimationFrame(() => exportBtnRef.current?.focus());
  };
  const runExport = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('running');
    setProgress(0);
    setOutput(null);
    let lock: WakeLockSentinel | null = null;
    try {
      lock = (await navigator.wakeLock?.request('screen').catch(() => null)) ?? null;
    } catch {
      lock = null;
    }
    try {
      const { blob, ext } = await exportClip({
        video: v,
        canvas: c,
        start,
        end,
        settings,
        onProgress: setProgress,
        signal: ac.signal,
      });
      const base = (source?.name ?? 'clip').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'clip';
      const name = `${base}-clipflow.${ext}`;
      setOutput({ url: URL.createObjectURL(blob), name, ext, file: new File([blob], name, { type: blob.type }) });
      setPhase('done');
    } catch (err) {
      if (err instanceof ExportCancelled) {
        setPhase(null);
        toast('Export cancelled');
      } else {
        const msg = (err as Error).message || 'Something went wrong.';
        setExportError(
          /security|tainted|insecure/i.test(msg)
            ? 'This video’s website doesn’t allow it to be exported. Download the video and choose the file instead.'
            : msg,
        );
        setPhase('error');
      }
    } finally {
      abortRef.current = null;
      void lock?.release().catch(() => {});
      v.currentTime = start;
      setFrameKey((k) => k + 1);
    }
  };

  // Warn before leaving the page mid-export.
  useEffect(() => {
    if (!exporting) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [exporting]);

  /* ---------- render ---------- */
  const hidden = (
    <>
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={onFile} tabIndex={-1} />
      <video
        key={source?.url ?? 'none'}
        ref={videoRef}
        className="src-video"
        src={source?.url}
        crossOrigin={source?.kind === 'url' ? 'anonymous' : undefined}
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onLoadedMetadata={onLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={onError}
      />
    </>
  );

  if (!ready) {
    return (
      <>
        {hidden}
        <UploadScreen
          onPickFile={() => fileRef.current?.click()}
          onFile={loadFile}
          onLoadUrl={loadUrl}
          loading={!!source && !loadError}
          error={loadError}
          onClearError={() => setLoadError('')}
        />
      </>
    );
  }

  return (
    <div className="editor">
      {hidden}
      <div className="editor__main">
        <div className="sourcebar">
          <div className="sourcebar__info">
            <Icon name={source?.kind === 'url' ? 'link' : 'film'} size={18} />
            <span className="sourcebar__name" title={source?.name}>
              {source?.name}
            </span>
            {source?.kind === 'file' && <span className="muted small">{formatBytes(source.size)}</span>}
          </div>
          <Button variant="ghost" icon="replace" onClick={() => fileRef.current?.click()} disabled={exporting}>
            Replace
          </Button>
        </div>

        <PreviewStage
          videoRef={videoRef}
          canvasRef={canvasRef}
          settings={settings}
          ready={ready}
          exporting={exporting}
          frameKey={frameKey}
          onTap={togglePlay}
          overlay={
            !playing && !exporting ? (
              <span className="stage__play" aria-hidden="true">
                <Icon name="play" size={28} />
              </span>
            ) : null
          }
        />

        <div className="transport">
          <IconButton icon="skipStart" label="Go to clip start" onClick={() => seek(start)} disabled={exporting} />
          <button
            type="button"
            className="transport__play"
            onClick={togglePlay}
            disabled={exporting}
            aria-label={playing ? 'Pause' : 'Play clip'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={24} />
          </button>
          <IconButton
            icon="skipEnd"
            label="Go to clip end"
            onClick={() => seek(Math.max(start, end - 0.05))}
            disabled={exporting}
          />
        </div>

        <Timeline
          videoRef={videoRef}
          src={source?.url ?? null}
          duration={duration}
          start={start}
          end={end}
          thumbs={thumbs}
          disabled={exporting}
          onStart={changeStart}
          onEnd={changeEnd}
          onSeek={seek}
        />
      </div>

      <div className="editor__tools">
        <div className="tabs" role="tablist" aria-label="Editing tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tool === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tool === t.id ? 0 : -1}
              className={`tab${tool === t.id ? ' is-on' : ''}`}
              onClick={() => setTool(t.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const i = TOOLS.findIndex((x) => x.id === tool);
                const n = TOOLS[(i + (e.key === 'ArrowRight' ? 1 : TOOLS.length - 1)) % TOOLS.length];
                setTool(n.id);
                document.getElementById(`tab-${n.id}`)?.focus();
              }}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
              {t.id === 'caption' && settings.caption.trim() && <i className="tab__dot" aria-label="(has caption)" />}
            </button>
          ))}
        </div>

        <div className="panel" role="tabpanel" id={`panel-${tool}`} aria-labelledby={`tab-${tool}`}>
          {tool === 'trim' && (
            <TrimPanel
              start={start}
              end={end}
              duration={duration}
              disabled={exporting}
              onStart={changeStart}
              onEnd={changeEnd}
              onStartAtPlayhead={startAtPlayhead}
              onEndAtPlayhead={endAtPlayhead}
              onReset={resetTrim}
            />
          )}
          {tool === 'caption' && <CaptionPanel s={settings} set={set} disabled={exporting} />}
          {tool === 'format' && <FormatPanel s={settings} set={set} disabled={exporting} outW={outW} outH={outH} />}
        </div>

        <div className="exportbar">
          <div className="exportbar__info">
            <b>{(end - start).toFixed(1)}s</b>
            <span className="muted small">
              {settings.format === 'orig' ? 'Original' : settings.format} · {settings.quality}p
            </span>
          </div>
          <Button ref={exportBtnRef} variant="primary" size="lg" icon="download" onClick={openExport} disabled={exporting}>
            Export
          </Button>
        </div>
      </div>

      {phase && (
        <ExportSheet
          phase={phase}
          progress={progress}
          clipLength={end - start}
          outW={outW}
          outH={outH}
          container={container}
          hasCaption={!!settings.caption.trim()}
          output={output}
          error={exportError}
          onStart={runExport}
          onCancel={() => abortRef.current?.abort()}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
