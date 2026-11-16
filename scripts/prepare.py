#!/usr/bin/env python3
"""Prepare props for rendering; print them with generated fields filled in.

Usage: scripts/prepare.py videos/<name>.json > /tmp/merged.json

- Checks every referenced file in public/ exists (fails before a long render, not during it).
- Measures each scene clip (`videoSecs`) so the template can loop clips shorter than their scene.
- Voices every beat that has `narration` (`audio` + `audioSecs`).

One audio file per beat, so each beat lasts exactly as long as its own narration.
Engine: ElevenLabs when an API key is found (Keychain -> env -> .env), otherwise macOS `say`
as a free draft voice for checking pacing. Audio is cached by a hash of (engine, voice, model, text),
so re-rendering after a visual tweak never pays for the same line twice.
Stdlib only.
"""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public" / "audio"
RATE = 24000  # pcm_24000 is available on every ElevenLabs tier
VOICE_SETTINGS = {"stability": 0.55, "similarity_boost": 0.80, "style": 0.20, "use_speaker_boost": True}


def secret(name):
    try:
        out = subprocess.run(["security", "find-generic-password", "-s", name, "-w"],
                             capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except FileNotFoundError:  # not macOS
        pass
    if os.environ.get(name):
        return os.environ[name]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            k, _, v = line.partition("=")
            if k.strip() == name and v.strip():
                return v.strip().strip('"\'')
    return None


def write_wav(path, pcm):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)


def wav_seconds(path):
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def elevenlabs(text, voice, model, key, path):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_{RATE}",
        data=json.dumps({"text": text, "model_id": model, "voice_settings": VOICE_SETTINGS}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            write_wav(path, r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read().decode(errors='replace')[:500]}")


def say(text, path):
    # Default English voice reads Devanagari as silence; Lekha (hi_IN) ships with macOS.
    voice = ["-v", "Lekha"] if any("ऀ" <= c <= "ॿ" for c in text) else []
    subprocess.run(["say", *voice, "-o", str(path), "--file-format=WAVE", f"--data-format=LEI16@{RATE}", text], check=True)


def clip_seconds(path):
    out = subprocess.run(
        [str(ROOT / "node_modules" / ".bin" / "remotion"), "ffprobe", "-v", "error",
         "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True)
    return round(float(out.stdout.strip().splitlines()[-1]), 3)


def check_media(props):
    refs = [props.get("background")] + [b.get(k) for b in props["beats"] for k in ("image", "video", "logo")]
    missing = [r for r in refs if r and not (ROOT / "public" / r).is_file()]
    if missing:
        sys.exit("missing in public/: " + ", ".join(missing))
    for b in props["beats"]:
        if b.get("video"):
            b["videoSecs"] = clip_seconds(ROOT / "public" / b["video"])


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    props = json.loads(pathlib.Path(sys.argv[1]).read_text())
    check_media(props)
    key = secret("ELEVENLABS_API_KEY")
    voice = props.get("voice") or secret("ELEVENLABS_VOICE_ID")
    model = secret("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    if key and not voice:
        sys.exit("ELEVENLABS_API_KEY found but no voice id: set ELEVENLABS_VOICE_ID or \"voice\" in the props.")
    engine = "elevenlabs" if key else "say"
    if engine == "say":
        print("voiceover: no ElevenLabs key, using macOS `say` draft voice", file=sys.stderr)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for i, beat in enumerate(props["beats"]):
        text = (beat.get("narration") or "").strip()
        if not text:
            continue
        h = hashlib.sha256(json.dumps([engine, voice, model, VOICE_SETTINGS, text]).encode()).hexdigest()[:16]
        path = AUDIO_DIR / f"{h}.wav"
        if path.exists():
            print(f"voiceover: beat {i} cached", file=sys.stderr)
        else:
            print(f"voiceover: beat {i} generating ({len(text)} chars)", file=sys.stderr)
            tmp = path.with_suffix(".part")
            elevenlabs(text, voice, model, key, tmp) if engine == "elevenlabs" else say(text, tmp)
            tmp.rename(path)
        beat["audio"] = f"audio/{path.name}"
        beat["audioSecs"] = round(wav_seconds(path), 3)

    json.dump(props, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
