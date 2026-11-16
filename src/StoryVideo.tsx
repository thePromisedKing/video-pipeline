import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Img,
  interpolate,
  Loop,
  OffthreadVideo,
  random,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadDevanagari } from '@remotion/google-fonts/NotoSerifDevanagari';
import { LANDING, mandalaSvg } from './mandala';

export const FPS = 30;

const sans = loadInter('normal', { weights: ['400', '700', '800'], subsets: ['latin', 'latin-ext'] }).fontFamily;
const deva = loadDevanagari('normal', { weights: ['500', '700'], subsets: ['devanagari', 'latin', 'latin-ext'] }).fontFamily;

export type Beat = {
  type: 'hook' | 'verse' | 'text' | 'stat' | 'cta';
  headline?: string;
  subtext?: string;
  lines?: string[]; // verse: Devanagari lines
  translit?: string; // verse: IAST transliteration
  ref?: string; // verse: "Bhagavad Gītā 2.47"
  stat?: string; // stat: big number
  logo?: string; // cta: image path in public/
  image?: string; // scene background image in public/ (replaces the video-wide background for this scene)
  video?: string; // clip in public/: app recording, stock footage... always muted
  videoStyle?: 'full' | 'phone'; // full-bleed behind the text (default), or inside a phone frame below it
  videoTrim?: number; // seconds to skip at the start of the clip
  videoSecs?: number; // set by prepare.py; clips shorter than the scene loop
  narration?: string; // spoken text; prepare.py turns it into audio + audioSecs
  audio?: string; // set by prepare.py
  audioSecs?: number; // set by prepare.py
  durationSecs?: number; // minimum on-screen time (default 3s)
};

export type StoryProps = {
  format?: 'vertical' | 'square' | 'landscape';
  background?: string; // image path in public/; the camera pans to a new spot each beat
  theme?: Partial<Theme>;
  voice?: string; // ElevenLabs voice id override (read by prepare.py)
  beats: Beat[];
};

type Theme = typeof DEFAULT_THEME;
const DEFAULT_THEME = { bg: '#0E0B08', fg: '#F5EBDD', accent: '#D4A24C', accent2: '#B8352A', muted: '#B8A890' };

// Narrated beats last as long as their own audio plus a breath (never shorter than durationSecs),
// so voice and visuals never drift.
export const beatSeconds = (b: Beat) => Math.max(b.audioSecs ? b.audioSecs + 0.6 : 0, b.durationSecs ?? 3);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// Darkening over any background image/clip so text stays readable; strongest across the text band.
const dim = (t: Theme) => `linear-gradient(${t.bg}b3, ${t.bg}d9 35%, ${t.bg}d9 65%, ${t.bg}b3)`;

export const StoryVideo: React.FC<StoryProps> = ({ beats, background, theme }) => {
  const t = { ...DEFAULT_THEME, ...theme };
  const { width } = useVideoConfig();
  const s = width / 1080;
  const frames = beats.map((b) => Math.round(beatSeconds(b) * FPS));
  const starts = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <AbsoluteFill style={{ backgroundColor: t.bg, color: t.fg, fontFamily: sans }}>
      {background && <Camera src={background} starts={starts} t={t} />}
      <Embers color={t.accent} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${t.bg}cc 100%)` }} />
      <Series>
        {beats.map((b, i) => (
          <Series.Sequence key={i} durationInFrames={frames[i]}>
            {b.audio && <Html5Audio src={staticFile(b.audio)} />}
            <SceneMedia beat={b} t={t} />
            <BeatView beat={b} t={t} s={s} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

// Slow push-in across the whole video, gliding to a new focal point at each beat change.
const FOCI = [[0, 0], [-6, -5], [6, -2], [-4, 5], [5, 4], [-5, -2], [3, -6], [0, 2]];
const Camera: React.FC<{ src: string; starts: number[]; t: Theme }> = ({ src, starts, t }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.18, 1.32]);
  // Glide over the first ~1.2s of each beat, then hold.
  const keys = starts.flatMap((st, i) => (i === 0 ? [0] : [st, st + 36]));
  const pts = starts.flatMap((_, i) => (i === 0 ? [FOCI[0]] : [FOCI[(i - 1) % FOCI.length], FOCI[i % FOCI.length]]));
  const at = (axis: 0 | 1) =>
    keys.length < 2 ? 0 : interpolate(frame, keys, pts.map((p) => p[axis]), { ...clamp, easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${at(0)}%, ${at(1)}%)` }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill style={{ background: dim(t) }} />
    </AbsoluteFill>
  );
};

// A muted clip, trimmed, looped when shorter than the scene.
const Clip: React.FC<{ beat: Beat; style: React.CSSProperties }> = ({ beat: b, style }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const trim = Math.round((b.videoTrim ?? 0) * fps);
  const clip = <OffthreadVideo src={staticFile(b.video!)} muted trimBefore={trim || undefined} style={style} />;
  const len = b.videoSecs ? Math.round(b.videoSecs * fps) - trim : 0;
  return len > 0 && len < durationInFrames ? <Loop durationInFrames={len}>{clip}</Loop> : clip;
};

// Per-scene background: an image (slow push-in) or a full-bleed clip, cross-fading with the scene.
const SceneMedia: React.FC<{ beat: Beat; t: Theme }> = ({ beat: b, t }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const full = b.video && (b.videoStyle ?? 'full') === 'full';
  if (!full && !b.image) return null;
  const fade = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], clamp);
  const cover: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${interpolate(frame, [0, durationInFrames], [1.05, 1.15])})` }}>
        {full ? <Clip beat={b} style={cover} /> : <Img src={staticFile(b.image!)} style={cover} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: dim(t) }} />
    </AbsoluteFill>
  );
};

// Phone mockup that slides up into the lower part of the frame.
const Phone: React.FC<{ beat: Beat; s: number }> = ({ beat, s }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 18, mass: 0.8 } });
  const h = Math.min(height * 0.58, width * 1.1);
  return (
    <div
      style={{
        height: h, aspectRatio: '9 / 19.5', margin: `${50 * s}px auto 0`, borderRadius: h * 0.075, overflow: 'hidden',
        border: `${h * 0.014}px solid #0b0b0b`, boxShadow: `0 ${30 * s}px ${90 * s}px #000c, 0 0 0 ${2 * s}px #ffffff22`,
        transform: `translateY(${(1 - p) * 300}px) rotate(${(1 - p) * -4}deg)`, opacity: Math.min(1, p * 1.5),
      }}
    >
      <Clip beat={beat} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

// Golden embers drifting up, deterministic per frame.
const Embers: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {Array.from({ length: 36 }, (_, i) => {
        const size = 4 + random(`s${i}`) * 8;
        const speed = 0.8 + random(`v${i}`) * 1.8;
        const span = height + 100;
        const y = span - ((frame * speed + random(`y${i}`) * span) % span) - 50;
        const x = random(`x${i}`) * width + Math.sin(frame / 40 + i) * 30;
        const flicker = 0.35 + 0.45 * Math.abs(Math.sin(frame / (12 + i % 7) + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
              background: color, opacity: flicker * (y / height), boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Words rise out of a blur one after another.
const Kinetic: React.FC<{ text: string; delay?: number; style: React.CSSProperties }> = ({ text, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={style}>
      {text.split(' ').map((w, i) => {
        const p = spring({ frame: frame - delay - i * 3, fps, config: { damping: 18, mass: 0.6 } });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block', marginRight: '0.25em', opacity: Math.min(1, p),
              transform: `translateY(${(1 - p) * 40}px)`, filter: `blur(${Math.max(0, 1 - p) * 10}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const BeatView: React.FC<{ beat: Beat; t: Theme; s: number }> = ({ beat: b, t, s }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [0, 1], clamp);
  // Staggered fade-up for item n (lines, sub-elements).
  const reveal = (n: number) => {
    const p = spring({ frame: frame - 8 - n * 8, fps, config: { damping: 200 } });
    return { opacity: p, transform: `translateY(${(1 - p) * 30}px)` };
  };
  const barW = spring({ frame: frame - 14, fps, config: { damping: 30 } }) * 120 * s;

  const headline = (size: number) =>
    b.headline && <Kinetic text={b.headline} style={{ fontSize: size * s, fontWeight: 800, lineHeight: 1.15 }} />;
  const sub = (n: number) =>
    b.subtext && (
      <div style={{ fontSize: 40 * s, color: t.muted, lineHeight: 1.4, marginTop: 36 * s, ...reveal(n) }}>{b.subtext}</div>
    );
  const bar = <div style={{ width: barW, height: 6 * s, background: t.accent, margin: `${40 * s}px auto`, borderRadius: 3 * s }} />;
  const glow = `0 0 ${24 + 12 * Math.sin(frame / 10)}px ${t.accent}88`;

  let body: React.ReactNode;
  switch (b.type) {
    case 'hook':
      body = (<>{headline(88)}{sub(2)}</>);
      break;
    case 'verse':
      body = (
        <>
          {b.lines?.map((l, i) => (
            <div key={i} style={{ fontFamily: deva, fontWeight: 700, fontSize: 56 * s, lineHeight: 1.6, color: t.accent, textShadow: glow, ...reveal(i * 2) }}>
              {l}
            </div>
          ))}
          {b.translit && (
            <div style={{ fontStyle: 'italic', fontSize: 36 * s, color: t.muted, lineHeight: 1.5, marginTop: 40 * s, ...reveal((b.lines?.length ?? 0) * 2 + 1) }}>
              {b.translit}
            </div>
          )}
          {b.ref && (
            <div style={{ fontSize: 30 * s, letterSpacing: 4 * s, textTransform: 'uppercase', marginTop: 48 * s, ...reveal((b.lines?.length ?? 0) * 2 + 2) }}>
              {b.ref}
            </div>
          )}
        </>
      );
      break;
    case 'stat': {
      const n = parseFloat(b.stat ?? '');
      const count = spring({ frame, fps, config: { damping: 40 }, durationInFrames: 40 });
      // Count numbers up ("147M" -> 0M..147M); non-numeric stats just scale in.
      const shown = Number.isFinite(n) ? `${Math.round(n * count)}${(b.stat ?? '').replace(/^[\d.]+/, '')}` : b.stat;
      body = (
        <>
          <div style={{ fontSize: 220 * s, fontWeight: 800, color: t.accent, textShadow: glow, transform: `scale(${0.6 + 0.4 * enter})` }}>{shown}</div>
          {headline(56)}
          {sub(2)}
        </>
      );
      break;
    }
    case 'cta':
      body = (
        <>
          {b.logo && <Img src={staticFile(b.logo)} style={{ width: 220 * s, height: 220 * s, borderRadius: 48 * s, marginBottom: 48 * s, ...reveal(0) }} />}
          {headline(84)}
          {bar}
          {sub(3)}
        </>
      );
      break;
    default: // text
      body = (<>{headline(72)}{bar}{sub(2)}</>);
  }

  const mandala = (b.type === 'verse' || b.type === 'cta') && (
    <Img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(mandalaSvg(LANDING, { a: t.accent2, g: t.accent, m: t.accent2, p: t.bg }))}`}
      style={{
        position: 'absolute', width: 980 * s, height: 980 * s, opacity: 0.13 * enter * (1 - exit),
        transform: `rotate(${frame * 0.2}deg) scale(${0.85 + 0.15 * enter})`,
      }}
    />
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 100 * s,
        opacity: Math.min(enter, 1 - exit),
        transform: `scale(${0.96 + 0.04 * enter}) translateY(${-40 * exit}px)`,
        filter: `blur(${(1 - enter) * 8 + exit * 8}px)`,
      }}
    >
      {mandala}
      <div style={{ maxWidth: 900 * s, textWrap: 'balance', position: 'relative' }}>
        {body}
        {b.video && b.videoStyle === 'phone' && <Phone beat={b} s={s} />}
      </div>
    </AbsoluteFill>
  );
};
