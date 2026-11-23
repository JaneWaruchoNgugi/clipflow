# ClipFlow: Shorts Studio

A mobile-first web app for turning videos into short clips. Editing and export run in the browser; your own videos never leave the device.

## Features

- **Get a video**: choose one from your phone, drag one in on desktop, paste a direct video-file link, or paste a YouTube, TikTok, Instagram, Facebook or X link (needs your own download server, see below), then **Save** it or **Edit** it.
- **Timeline trim**: filmstrip with a trim frame. Drag the edges, tap to scrub, nudge by 0.1s, or "Start here / End here" while playing. Edges are keyboard sliders too (arrows, Shift for 1s).
- **Captions**: position, style (box / outline / shadow), size and colour, previewed live.
- **Formats**: 9:16, 16:9, 1:1 or original; fill, blurred bars or black bars; 720p or 1080p.
- **Export**: rendered locally with canvas + `MediaRecorder`, audio included, with progress, cancel, save and share. MP4 where the browser supports it, otherwise WebM.
- **Saved links**: keep video links on this device, with undo on delete.

Only download videos you own or have permission to use.

## Develop

```bash
npm install
npm run dev            # local dev server
npm run typecheck
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/index.html
npm run test:server    # download server tests (pip install -r server/requirements.txt pytest httpx)
```

## Download server

`server/` is a small FastAPI + yt-dlp + ffmpeg service. It only accepts links from the supported sites (so it can't be used to fetch other URLs), returns H.264/AAC MP4s, enforces length and size limits, and requires an access key.

Deploy it with the app on Firebase (Hosting + Cloud Run): see **[server/DEPLOY.md](server/DEPLOY.md)**, written to be followed from a phone.

## Project layout

```
src/
  App.tsx                      app shell: top nav (desktop), bottom nav (mobile)
  components/
    ClipEditor.tsx             editor state, loading, export orchestration
    UploadScreen.tsx           choose file / paste link / link downloads
    PreviewStage.tsx           fitted canvas preview
    Timeline.tsx               filmstrip trim timeline
    panels.tsx                 Trim, Caption and Format panels
    ExportSheet.tsx            export confirm / progress / done / error
    SavedLinks.tsx, ServerSettings.tsx, Toast.tsx, Icon.tsx, ui.tsx
  hooks/                       useVideoTime, useThumbnails
  lib/                         render, exporter, audio, remote, links, source
  styles/                      tokens, base, components, layout, editor, links
server/                        download server (see DEPLOY.md)
```
