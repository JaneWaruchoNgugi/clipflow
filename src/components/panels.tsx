import { memo } from 'react';
import { formatTime } from '../lib/time';
import type { EditSettings, Format } from '../lib/types';
import { Icon } from './Icon';
import { Button, Field, IconButton, Segmented } from './ui';

type Set = <K extends keyof EditSettings>(k: K, v: EditSettings[K]) => void;

/* ---------------- Trim ---------------- */
export const TrimPanel = memo(function TrimPanel(p: {
  start: number;
  end: number;
  duration: number;
  disabled: boolean;
  onStart: (t: number) => void;
  onEnd: (t: number) => void;
  onStartAtPlayhead: () => void;
  onEndAtPlayhead: () => void;
  onReset: () => void;
}) {
  const stepper = (label: string, value: number, set: (t: number) => void) => (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__row">
        <IconButton icon="minus" label={`${label} back 0.1 seconds`} variant="secondary" disabled={p.disabled} onClick={() => set(value - 0.1)} />
        <output className="stepper__value">{formatTime(value)}</output>
        <IconButton icon="plus" label={`${label} forward 0.1 seconds`} variant="secondary" disabled={p.disabled} onClick={() => set(value + 0.1)} />
      </div>
    </div>
  );
  return (
    <div className="panel-body">
      <div className="stepper-grid">
        {stepper('Start', p.start, p.onStart)}
        {stepper('End', p.end, p.onEnd)}
      </div>
      <div className="btn-row">
        <Button icon="flagStart" onClick={p.onStartAtPlayhead} disabled={p.disabled}>
          Start here
        </Button>
        <Button icon="flagEnd" onClick={p.onEndAtPlayhead} disabled={p.disabled}>
          End here
        </Button>
      </div>
      <div className="panel-foot">
        <p className="help">Drag the edges of the timeline, or play and tap “Start here” / “End here”.</p>
        <Button variant="ghost" icon="reset" onClick={p.onReset} disabled={p.disabled || (p.start === 0 && p.end === p.duration)}>
          Reset
        </Button>
      </div>
    </div>
  );
});

/* ---------------- Caption ---------------- */
const COLORS = [
  { v: '#ffffff', name: 'White' },
  { v: '#ffe14d', name: 'Yellow' },
  { v: '#ff4d7a', name: 'Pink' },
  { v: '#4dd8ff', name: 'Blue' },
  { v: '#111111', name: 'Black' },
];
const MAX_CAPTION = 160;

export const CaptionPanel = memo(function CaptionPanel({ s, set, disabled }: { s: EditSettings; set: Set; disabled: boolean }) {
  return (
    <div className="panel-body">
      <Field label="Caption text" htmlFor="caption" hint={`${s.caption.length}/${MAX_CAPTION}`}>
        <div className="textarea-wrap">
          <textarea
            id="caption"
            className="input textarea"
            placeholder="Type a caption to show on your clip"
            maxLength={MAX_CAPTION}
            rows={2}
            value={s.caption}
            disabled={disabled}
            onChange={(e) => set('caption', e.target.value)}
          />
          {s.caption && (
            <IconButton icon="close" label="Clear caption" className="textarea-clear" disabled={disabled} onClick={() => set('caption', '')} />
          )}
        </div>
      </Field>
      <fieldset className="fieldset" disabled={disabled || !s.caption.trim()}>
        <Field label="Position">
          <Segmented
            label="Caption position"
            value={s.captionPosition}
            onChange={(v) => set('captionPosition', v)}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]}
          />
        </Field>
        <Field label="Style">
          <Segmented
            label="Caption style"
            value={s.captionStyle}
            onChange={(v) => set('captionStyle', v)}
            options={[
              { value: 'box', label: 'Box' },
              { value: 'outline', label: 'Outline' },
              { value: 'plain', label: 'Shadow' },
            ]}
          />
        </Field>
        <Field label="Text size" htmlFor="capSize" hint={`${s.captionSize}`}>
          <input
            id="capSize"
            className="range"
            type="range"
            min={28}
            max={96}
            step={2}
            value={s.captionSize}
            onChange={(e) => set('captionSize', Number(e.target.value))}
            style={{ ['--fill' as string]: `${((s.captionSize - 28) / 68) * 100}%` }}
          />
        </Field>
        <Field label="Colour">
          <div className="swatches" role="radiogroup" aria-label="Caption colour">
            {COLORS.map((c) => (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={s.captionColor === c.v}
                aria-label={c.name}
                title={c.name}
                className={`swatch${s.captionColor === c.v ? ' is-on' : ''}`}
                style={{ ['--sw' as string]: c.v }}
                onClick={() => set('captionColor', c.v)}
              >
                {s.captionColor === c.v && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </Field>
      </fieldset>
      {!s.caption.trim() && <p className="help">Style options unlock once you type a caption.</p>}
    </div>
  );
});

/* ---------------- Format ---------------- */
const FORMATS: { value: Format; label: string; sub: string; w: number; h: number }[] = [
  { value: '9:16', label: '9:16', sub: 'Shorts, Reels, TikTok', w: 9, h: 16 },
  { value: '16:9', label: '16:9', sub: 'YouTube', w: 16, h: 9 },
  { value: '1:1', label: '1:1', sub: 'Feed post', w: 1, h: 1 },
  { value: 'orig', label: 'Original', sub: 'Keep shape', w: 0, h: 0 },
];

export const FormatPanel = memo(function FormatPanel({
  s,
  set,
  disabled,
  outW,
  outH,
}: {
  s: EditSettings;
  set: Set;
  disabled: boolean;
  outW: number;
  outH: number;
}) {
  return (
    <div className="panel-body">
      <Field label="Aspect ratio">
        <div className="ratios" role="radiogroup" aria-label="Aspect ratio">
          {FORMATS.map((f) => {
            const on = s.format === f.value;
            const k = f.w ? 22 / Math.max(f.w, f.h) : 0;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                className={`ratio${on ? ' is-on' : ''}`}
                onClick={() => set('format', f.value)}
              >
                <span className="ratio__shape" aria-hidden="true">
                  {f.w ? <i style={{ width: f.w * k, height: f.h * k }} /> : <i className="ratio__free" />}
                </span>
                <span className="ratio__label">{f.label}</span>
                <span className="ratio__sub">{f.sub}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Fit video" hint={s.format === 'orig' ? 'Not needed for Original' : undefined}>
        <Segmented
          label="Fit video"
          value={s.fit}
          onChange={(v) => set('fit', v)}
          disabled={disabled || s.format === 'orig'}
          options={[
            { value: 'fill', label: 'Fill' },
            { value: 'blur', label: 'Blur bars' },
            { value: 'black', label: 'Black bars' },
          ]}
        />
      </Field>
      <Field label="Export quality" hint={`${outW} × ${outH}`}>
        <Segmented
          label="Export quality"
          value={s.quality}
          onChange={(v) => set('quality', v)}
          disabled={disabled}
          options={[
            { value: '720', label: '720p · smaller' },
            { value: '1080', label: '1080p · sharper' },
          ]}
        />
      </Field>
    </div>
  );
});
