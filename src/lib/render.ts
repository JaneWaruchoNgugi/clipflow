import type { EditSettings } from './types';

/** Output canvas size for the chosen format and quality (even numbers, as encoders prefer). */
export function outputSize(video: HTMLVideoElement, s: EditSettings): { w: number; h: number } {
  const q = s.quality === '720' ? 720 : 1080;
  const vw = video.videoWidth || 1080;
  const vh = video.videoHeight || 1920;
  let w: number;
  let h: number;
  if (s.format === '9:16') {
    w = q;
    h = Math.round((q * 16) / 9);
  } else if (s.format === '16:9') {
    w = Math.round((q * 16) / 9);
    h = q;
  } else if (s.format === '1:1') {
    w = q;
    h = q;
  } else {
    const k = q / Math.min(vw, vh);
    w = vw * k;
    h = vh * k;
  }
  return { w: Math.round(w / 2) * 2, h: Math.round(h / 2) * 2 };
}

/** Draws the current video frame plus caption onto the canvas. */
export function drawFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement, s: EditSettings): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  if (vw && vh) {
    const cover = Math.max(W / vw, H / vh);
    const contain = Math.min(W / vw, H / vh);
    const place = (k: number) => {
      const dw = vw * k;
      const dh = vh * k;
      g.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    };
    if (s.fit === 'fill' || s.format === 'orig') {
      place(cover);
    } else {
      if (s.fit === 'blur') {
        g.save();
        g.filter = `blur(${Math.round(W / 30)}px) brightness(0.6)`;
        place(cover * 1.1);
        g.restore();
      }
      place(contain);
    }
  }
  drawCaption(g, W, H, s);
}

function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const par of text.split('\n')) {
    const words = par.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > maxW && line) {
        out.push(line);
        line = w;
      } else {
        line = t;
      }
    }
    out.push(line);
  }
  return out;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawCaption(g: CanvasRenderingContext2D, W: number, H: number, s: EditSettings) {
  const text = s.caption.trim();
  if (!text) return;
  const fs = Math.round(s.captionSize * (W / 1080));
  g.font = `800 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = wrapLines(g, text, W * 0.84);
  const lh = fs * 1.22;
  const pad = fs * 0.35;
  const blockH = lines.length * lh;
  const cy =
    s.captionPosition === 'top' ? H * 0.12 + blockH / 2 : s.captionPosition === 'middle' ? H / 2 : H * 0.8 - blockH / 2;
  const y0 = cy - blockH / 2 + lh / 2;
  const dark = s.captionColor === '#111111';

  lines.forEach((ln, i) => {
    const y = y0 + i * lh;
    const tw = g.measureText(ln).width;
    if (s.captionStyle === 'box' && ln) {
      g.fillStyle = dark ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.65)';
      roundRect(g, W / 2 - tw / 2 - pad * 1.4, y - lh / 2, tw + pad * 2.8, lh, fs * 0.25);
      g.fill();
    }
    if (s.captionStyle === 'outline') {
      g.lineWidth = Math.max(2, fs * 0.14);
      g.lineJoin = 'round';
      g.strokeStyle = dark ? '#fff' : '#000';
      g.strokeText(ln, W / 2, y);
    }
    if (s.captionStyle === 'plain') {
      g.shadowColor = 'rgba(0,0,0,.7)';
      g.shadowBlur = fs * 0.25;
    }
    g.fillStyle = s.captionColor;
    g.fillText(ln, W / 2, y);
    g.shadowBlur = 0;
    g.shadowColor = 'transparent';
  });
}
