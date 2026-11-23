import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getAudioRoute } from '../lib/audio';
import { canExport, exportClip } from '../lib/exporter';
import { drawFrame, outputSize } from '../lib/render';
import { formatTime } from '../lib/time';
import type { EditSettings } from '../lib/types';
import { Segmented } from './Segmented';
import { MIN_CLIP, TrimSlider } from './TrimSlider';
import { useToast } from './Toast';

const COLORS = [
  { v: '#ffffff', name: 'White' },
  { v: '#ffe14d', name: 'Yellow' },
  { v: '#ff3d6e', name: 'Pink' },
  { v: '#4dd8ff', name: 'Blue' },
  { v: '#111111', name: 'Black' },
];

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

interface Result {
  url: string;
  name: string;
  file: File;
  ext: string;
}

export function ClipEditor({ active }: { active: boolean }) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settings, setSettings] = useState<EditSettings>(DEFAULTS);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [warning, setWarning] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  // Refs mirror state for use inside animation loops.
  const live = useRef({ start, end, settings, exporting });
  live.current = { start, end, settings, exporting };

  const set = <K extends keyof EditSettings>(k: K, v: EditSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const redraw = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (v && c) drawFrame(c, v, live.current.settings);
    if (v) setNow(v.currentTime);
  }, []);

  // Resize the preview canvas whenever the layout changes (lighter resolution than export).
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || exporting) return;
    const { w, h } = outputSize(v, settings);
    const k = Math.min(1, 540 / w);
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    redraw();
  }, [settings, duration, exporting, redraw]);

  // Pause when leaving the editor tab.
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  // Release object URLs.
  useEffect(() => () => void (srcUrl && URL.revokeObjectURL(srcUrl)), [srcUrl]);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResult(null);
    setWarning('');
    setSrcUrl(URL.createObjectURL(f));
  };

  const onLoaded = () => {
    const v = videoRef.current!;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setStart(0);
    setEnd(Math.min(d, 60));
    v.currentTime = 0.01;
    if (!d) toast('Could not read video length');
  };

  // Playback loop: draws frames and loops inside the trim range.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const v = videoRef.current;
      if (!v) return;
      if (!live.current.exporting && v.currentTime >= live.current.end) {
        v.pause();
        v.currentTime = live.current.start;
      }
      redraw();
      if (!v.paused) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, redraw]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || exporting) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.05) v.currentTime = start;
      getAudioRoute(v);
      v.play().catch(() => {});
    } else v.pause();
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) v.pause();
    v.currentTime = t;
  };
  const changeStart = (t: number) => {
    const s = Math.max(0, Math.min(t, end - MIN_CLIP));
    setStart(s);
    seek(s);
    return s;
  };
  const changeEnd = (t: number) => {
    const e = Math.min(duration, Math.max(t, start + MIN_CLIP));
    setEnd(e);
    seek(Math.max(start, e - 0.05));
    return e;
  };

  const doExport = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || exporting || !duration) return;
    setWarning('');
    if (!canExport(c)) {
      setWarning('Your browser can’t record video. Please open ClipFlow in an up-to-date Chrome.');
      return;
    }
    setExporting(true);
    setProgress(0);
    setResult(null);
    try {
      const { blob, ext } = await exportClip({ video: v, canvas: c, start, end, settings, onProgress: setProgress });
      const name = `clipflow-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
      setResult({ url: URL.createObjectURL(blob), name, ext, file: new File([blob], name, { type: blob.type }) });
      if (ext === 'webm')
        setWarning('Saved as WebM, which plays in most apps. If one won’t accept it, update Chrome for MP4 export.');
      toast(`Done! ${(blob.size / 1048576).toFixed(1)} MB`);
    } catch (err) {
      setWarning(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
      v.currentTime = start;
    }
  };

  const canShare = !!result && !!navigator.canShare?.({ files: [result.file] });

  return (
    <>
      {!srcUrl && (
        <div className="card">
          <label className="pick" htmlFor="file">
            <b>Choose a video</b>
            <span>From your gallery or files. Nothing is uploaded.</span>
          </label>
        </div>
      )}
      <input ref={fileRef} id="file" type="file" accept="video/*" hidden onChange={onFile} />

      <video
        ref={videoRef}
        className="src"
        src={srcUrl ?? undefined}
        playsInline
        preload="auto"
        onLoadedMetadata={onLoaded}
        onSeeked={() => videoRef.current?.paused && redraw()}
        onTimeUpdate={() => setNow(videoRef.current!.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          redraw();
        }}
        onError={() => srcUrl && toast('This video format is not supported by your browser')}
      />

      {srcUrl && (
        <div>
          <div className="card">
            <div className="stage">
              <canvas ref={canvasRef} width={540} height={960} />
            </div>
            <div className="controls">
              <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="time">
                {formatTime(now)} / {formatTime(duration)}
              </span>
              <button type="button" style={{ marginLeft: 'auto', fontSize: 14 }} onClick={() => fileRef.current?.click()} disabled={exporting}>
                Change video
              </button>
            </div>
          </div>

          <div className="card">
            <h2>1 · Trim</h2>
            <TrimSlider
              duration={duration}
              start={start}
              end={end}
              playhead={now}
              disabled={exporting}
              onStart={changeStart}
              onEnd={changeEnd}
            />
            <div className="nudge">
              <button type="button" disabled={exporting} onClick={() => changeStart(start - 0.1)}>Start −0.1s</button>
              <button type="button" disabled={exporting} onClick={() => changeStart(start + 0.1)}>Start +0.1s</button>
              <button type="button" disabled={exporting} onClick={() => changeEnd(end - 0.1)}>End −0.1s</button>
              <button type="button" disabled={exporting} onClick={() => changeEnd(end + 0.1)}>End +0.1s</button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" disabled={exporting} onClick={() => toast(`Start set at ${formatTime(changeStart(now))}`)}>
                Set start here
              </button>
              <button type="button" disabled={exporting} onClick={() => toast(`End set at ${formatTime(changeEnd(now))}`)}>
                Set end here
              </button>
            </div>
            <p className="hint">Drag the dots, or play the video and tap “Set start/end here”.</p>
          </div>

          <div className="card">
            <h2>2 · Caption</h2>
            <textarea
              aria-label="Caption"
              placeholder="Type your caption…"
              maxLength={160}
              value={settings.caption}
              onChange={(e) => set('caption', e.target.value)}
            />
            <label>Position</label>
            <Segmented
              label="Caption position"
              value={settings.captionPosition}
              onChange={(v) => set('captionPosition', v)}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'middle', label: 'Middle' },
                { value: 'bottom', label: 'Bottom' },
              ]}
            />
            <label htmlFor="capSize">Size</label>
            <input
              id="capSize"
              type="range"
              min={28}
              max={96}
              value={settings.captionSize}
              onChange={(e) => set('captionSize', Number(e.target.value))}
            />
            <label>Style</label>
            <Segmented
              label="Caption style"
              value={settings.captionStyle}
              onChange={(v) => set('captionStyle', v)}
              options={[
                { value: 'box', label: 'Box' },
                { value: 'outline', label: 'Outline' },
                { value: 'plain', label: 'Plain' },
              ]}
            />
            <label>Colour</label>
            <div className="colors" role="radiogroup" aria-label="Caption colour">
              {COLORS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  role="radio"
                  aria-checked={settings.captionColor === c.v}
                  aria-label={c.name}
                  className={settings.captionColor === c.v ? 'on' : ''}
                  style={{ background: c.v }}
                  onClick={() => set('captionColor', c.v)}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h2>3 · Format</h2>
            <Segmented
              label="Format"
              value={settings.format}
              onChange={(v) => set('format', v)}
              options={[
                { value: '9:16', label: 'Vertical 9:16' },
                { value: '1:1', label: 'Square 1:1' },
                { value: 'orig', label: 'Original' },
              ]}
            />
            <label>Fit</label>
            <Segmented
              label="Fit"
              value={settings.fit}
              onChange={(v) => set('fit', v)}
              options={[
                { value: 'fill', label: 'Fill (crop)' },
                { value: 'blur', label: 'Fit + blur' },
                { value: 'black', label: 'Fit + black' },
              ]}
            />
            <label>Quality</label>
            <Segmented
              label="Quality"
              value={settings.quality}
              onChange={(v) => set('quality', v)}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p' },
              ]}
            />
          </div>

          <div className="card">
            <h2>4 · Export</h2>
            <button type="button" className="primary block" onClick={doExport} disabled={exporting}>
              {exporting ? `Exporting… ${Math.round(progress * 100)}%` : 'Export trimmed video'}
            </button>
            {exporting && (
              <div className="progress" style={{ display: 'block' }}>
                <i style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            <p className="hint">
              Export plays the clip in real time while recording, so a 30 second clip takes about 30 seconds. Keep this
              screen open.
            </p>
            {warning && (
              <div className="warn" style={{ display: 'block' }}>
                {warning}
              </div>
            )}
            {result && (
              <div className="result" style={{ marginTop: 14 }}>
                <video src={result.url} controls playsInline />
                <div className="row">
                  <a className="btn primary" href={result.url} download={result.name}>
                    Save video
                  </a>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => navigator.share({ files: [result.file], title: 'ClipFlow clip' }).catch(() => {})}
                    >
                      Share
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
