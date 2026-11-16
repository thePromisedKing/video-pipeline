#!/usr/bin/env bash
# Render a video from a props file: voiceover -> merged props -> MP4.
# Usage: scripts/render.sh videos/<name>.json   (or: npm run render -- videos/<name>.json)
# Output: out/YYYY-MM-DD-<name>.mp4
set -euo pipefail
cd "$(dirname "$0")/.."

props="${1:?usage: scripts/render.sh videos/<name>.json}"
slug="$(basename "$props" .json)"
merged="$(mktemp -t video-props).json"
trap 'rm -f "$merged"' EXIT

python3 -I scripts/prepare.py "$props" > "$merged"
mkdir -p out
out="out/$(date +%F)-$slug.mp4"
npx remotion render src/index.ts StoryVideo "$out" --props="$merged" --log=error
ls -lh "$out" | awk '{print "rendered", $NF, $5}'
