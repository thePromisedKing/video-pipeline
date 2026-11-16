#!/usr/bin/env bash
# Record the booted iOS Simulator into public/app/<name>.mp4 for use as a scene `video`.
# Usage: scripts/record-sim.sh <name> <seconds> [device-udid]
# Drive the app (scroll, tap) while it records: by hand, or Claude via the iOS Simulator tool.
# Status bar is set to a clean 9:41 / full battery for the recording and restored after.
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:?usage: scripts/record-sim.sh <name> <seconds> [device-udid]}"
secs="${2:?usage: scripts/record-sim.sh <name> <seconds> [device-udid]}"
dev="${3:-booted}"
if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "no booted simulator: boot one and open the app first" >&2; exit 1
fi

out="public/app/$name.mp4"
mkdir -p public/app
xcrun simctl status_bar "$dev" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 >/dev/null 2>&1 || true
trap 'xcrun simctl status_bar "$dev" clear >/dev/null 2>&1 || true' EXIT

xcrun simctl io "$dev" recordVideo --codec=h264 --force "$out" 2>/dev/null &
rec=$!
sleep 1.5 # recorder warm-up
echo "recording $secs s -> $out"
sleep "$secs"
kill -INT "$rec"
wait "$rec" || true
ls -lh "$out" | awk '{print "saved", $NF, $5}'
