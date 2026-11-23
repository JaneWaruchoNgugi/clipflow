/**
 * Routes a video element's sound through Web Audio once, so export can record it
 * while the speakers stay silent. A media element can only be attached once.
 */
export interface AudioRoute {
  ctx: AudioContext;
  recordStream: MediaStream;
  setSpeakerMuted(muted: boolean): void;
}

const routes = new WeakMap<HTMLVideoElement, AudioRoute | null>();

export function getAudioRoute(video: HTMLVideoElement): AudioRoute | null {
  if (routes.has(video)) {
    const r = routes.get(video) ?? null;
    if (r && r.ctx.state === 'suspended') void r.ctx.resume();
    return r;
  }
  try {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    const speaker = ctx.createGain();
    src.connect(dest);
    src.connect(speaker);
    speaker.connect(ctx.destination);
    const route: AudioRoute = {
      ctx,
      recordStream: dest.stream,
      setSpeakerMuted: (m) => {
        speaker.gain.value = m ? 0 : 1;
      },
    };
    routes.set(video, route);
    return route;
  } catch (err) {
    console.warn('Audio routing unavailable', err);
    routes.set(video, null);
    return null;
  }
}
