# ClipFlow: Shorts Studio

A mobile-first web app for turning your own videos into short vertical clips. Everything runs in the browser; nothing is uploaded.

## Features

- **Clip editor**: pick a video from your gallery, drag the start/end handles (or nudge by 0.1s, or "Set start/end here" while playing).
- **Captions**: text overlay with position (top/middle/bottom), size, style (box/outline/plain) and colour.
- **Formats**: vertical 9:16, square 1:1 or original; fill (crop), fit + blurred background, or fit + black bars; 720p or 1080p.
- **Local export**: the trimmed clip is rendered to a canvas and recorded with `MediaRecorder`, audio included. MP4 where the browser supports it, otherwise WebM. Save or share from the phone.
- **Saved links**: keep a list of video links (stored in `localStorage` on this device).

ClipFlow does not download videos from YouTube, TikTok or Instagram.

## Develop

```bash
npm install
npm run dev          # local dev server
npm run typecheck
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/index.html
```

The single-file build can be copied to a phone and opened directly in Chrome.

## How export works

Export plays the selected range in real time, drawing each frame plus the caption onto a canvas, and records `canvas.captureStream()` together with the video's audio (routed through Web Audio so the speakers stay silent). A 30 second clip therefore takes about 30 seconds; keep the screen on while it runs. Works best in an up-to-date Chrome.

## Project layout

```
src/
  App.tsx                  tabs: Clip Editor / Saved Links
  components/ClipEditor.tsx
  components/TrimSlider.tsx
  components/SavedLinks.tsx
  lib/render.ts            frame + caption drawing
  lib/exporter.ts          MediaRecorder export
  lib/audio.ts             Web Audio routing
  lib/links.ts             saved-link storage and URL helpers
```
