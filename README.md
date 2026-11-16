# video-pipeline

Brief in, narrated MP4 out. Claude Code + [Remotion](https://remotion.dev) + ElevenLabs.

```
briefs/<slug>.md --Claude /video--> videos/<slug>.json --scripts/prepare.py--> voice + clip lengths --remotion render--> out/<date>-<slug>.mp4
```

| Path | What |
|---|---|
| `briefs/TEMPLATE.md` | Fill-in script template: scenes, what's on screen, what's said, what's shown |
| `videos/*.json` | Scene specs Claude writes from a brief (the source of truth for a video) |
| `src/StoryVideo.tsx` | The template: scene types, animations, image/clip/phone-frame scenes |
| `scripts/prepare.py` | Checks media, measures clips, voices narration (ElevenLabs or free draft voice) |
| `scripts/render.sh` | prepare + render to `out/` |
| `scripts/record-sim.sh` | Records the iOS Simulator into `public/app/` for app-demo scenes |
| `.claude/skills/video/SKILL.md` | The `/video` workflow Claude follows |

## Setup (each machine)

Needs Node 22+ and Python 3 (stdlib only). Remotion brings its own Chromium and ffmpeg.

```bash
git clone https://github.com/thePromisedKing/video-pipeline.git && cd video-pipeline
npm ci --ignore-scripts
```

ElevenLabs credentials (skip to use the free macOS `say` draft voice):

```bash
# macOS
security add-generic-password -a "$USER" -s ELEVENLABS_API_KEY -w
security add-generic-password -a "$USER" -s ELEVENLABS_VOICE_ID -w
# elsewhere
cp .env.example .env   # then fill it in; .env is git-ignored
```

## Use

- In Claude Code, from this folder: `/video` plus a filled-in `briefs/TEMPLATE.md` (or just describe the video).
- By hand: `npm run render -- videos/example-gita-2-47.json`
- Live preview / tweak layouts: `npm run studio`

## Notes

- Versions are pinned exactly (Remotion 4.0.539). Upgrade deliberately and re-run `npm audit`.
- Known audit finding: `zod` 4.5.4 (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized untrusted input), pulled in by Remotion Studio.
  Not reachable here (we only validate our own props), and overriding zod makes Remotion warn about broken renders.
  Clears when Remotion ships zod >= 4.6.6.
- Remotion is free for individuals and companies of up to 3 people; larger teams need a [company license](https://remotion.dev/license).
- This repo is public: keys go in Keychain or `.env`, never in `videos/*.json`.
- Stock clips go in `public/footage/` (git-ignored; licences forbid redistribution). App recordings in `public/app/` are committed.
