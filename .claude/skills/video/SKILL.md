---
name: video
description: Turn a script or brief into a finished narrated video (Shorts/Reels/square/landscape) - writes the scene JSON, gathers visuals (images, app screen recordings from the iOS Simulator, stock clips), voices it and renders an MP4 with Remotion. Use when the user types /video, gives a video script or scene list, or asks to make, edit or re-render a video in this repo.
---

# /video

Input: a script, scene list or rough idea (the user may follow `briefs/TEMPLATE.md`, paste prose, or point at a file).
Output: `out/YYYY-MM-DD-<slug>.mp4`.

## Workflow

1. **Intake.** Save the user's brief to `briefs/<slug>.md` if it came as a file or long paste. Fill gaps yourself
   (hooks, narration, scene split) and ask only what you can't decide: goal, platform/format, call to action.
   For a product, read its repo for real features, copy and brand colours instead of inventing them.
2. **Scenes.** Write `videos/<slug>.json` (schema below). Show the user a table: # / on-screen text / voiceover /
   visual. Wait for OK or edits - this is the cheap place to iterate.
3. **Visuals.** For each scene, get its media into `public/` (see Visual sources). Never ship a placeholder
   without saying so.
4. **Draft render.** `scripts/render.sh videos/<slug>.json` (run in background). Without an ElevenLabs key it uses
   the free draft voice - say so.
5. **Check it yourself.** `scripts/prepare.py videos/<slug>.json > /tmp/p.json` (cached, free), then render a still
   mid-way through each scene: `npx remotion still src/index.ts StoryVideo /tmp/f.png --props=/tmp/p.json --frame=<n> --scale=0.3`
   and look: text readable over the background, nothing cut off, Devanagari shaped, phone/clip visible.
   Scene n starts at the sum of earlier scene lengths (each = max(audioSecs + 0.6, durationSecs ?? 3) x 30 fps).
6. **Deliver.** Send the MP4 to the user with the scene table and anything unverified. Commit
   `videos/<slug>.json`, `briefs/<slug>.md` and new `public/` assets only when asked.

## Props

```jsonc
{
  "format": "vertical",            // vertical 1080x1920 | square 1080x1080 | landscape 1920x1080
  "background": "proj/art.jpg",    // optional, public/ path; camera pans to a new spot each scene
  "theme": { "bg": "#0E0B08", "fg": "#F5EBDD", "accent": "#D4A24C", "accent2": "#B8352A", "muted": "#B8A890" },
  "voice": "<elevenlabs voice id>", // optional override
  "beats": [ /* scenes */ ]
}
```

Every scene: `type`, optional `narration` (spoken), `durationSecs` (minimum seconds, default 3), and optionally one visual:
- `image`: public/ path, replaces the background for this scene
- `video` + `videoStyle: "full"` (default): muted clip full-bleed behind the text
- `video` + `videoStyle: "phone"`: clip inside a phone frame under the text (app recordings)
- `videoTrim`: seconds to skip at the clip start. Clips shorter than the scene loop automatically.

| type | fields | use |
|---|---|---|
| `hook` | `headline`, `subtext` | opening line, big |
| `verse` | `lines[]` (Devanagari), `translit`, `ref` | scripture; rotating mandala behind |
| `text` | `headline`, `subtext` | any statement / meaning / insight |
| `stat` | `stat`, `headline`, `subtext` | one big number, counts up |
| `cta` | `headline`, `subtext`, `logo` | close; rotating mandala behind |

Built in, no props needed: word-by-word headline reveal, blur/scale scene transitions, golden embers, camera moves.

## Visual sources

- **Images / paintings**: copy from the user's project into `public/<project>/`.
- **App screen recording** (iOS Simulator):
  1. Find a simulator build of the app (e.g. `<app>/ios/build/Build/Products/*-iphonesimulator/*.app`); if none,
     ask before building. Boot a simulator and launch it with the iOS Simulator tool (`attach`, `launch`).
  2. Get the app to the starting screen, then start `scripts/record-sim.sh <name> <seconds>` in the background
     and drive the app with the simulator tool (`swipe` up ~40% of screen height, ~1 s apart, for gentle scrolling).
  3. Check a still of `public/app/<name>.mp4`, set it as the scene `video` with `videoStyle: "phone"`.
  Known app: My Sanatan - `~/Projects/the_scroll_app/the_scroll_app`, release build `ios/build/Build/Products/Release-iphonesimulator/MySanatan.app`, bundle id `com.thescroll.ramayana`.
- **Stock footage**: the user downloads clips (Pexels / Pixabay are free for commercial use) into
  `public/footage/` (git-ignored: licences forbid redistributing clips). Note each clip's source URL in the brief.
  Avoid identifiable temple deities, private rituals, and anything implying a person in the footage endorses the product.

## Writing rules

- Headlines max 8 words, subtext max 16. Screen text is the summary; narration carries the detail.
- ~130 spoken words per minute. A Short is 5-8 scenes, under 60s.
- Verse scenes: Devanagari in `lines`, IAST in `translit`, Devanagari in `narration`, `durationSecs` >= 8.
- Never invent verse text, translations, statistics or product features - take them from the user or their sources.

## Voice

`scripts/prepare.py` reads `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` from macOS Keychain, then env, then `.env`.
No key = free macOS `say` draft voice. Audio is cached per line in `public/audio/`; only changed lines are re-voiced.
Never print, log or commit keys. This repo is public.
