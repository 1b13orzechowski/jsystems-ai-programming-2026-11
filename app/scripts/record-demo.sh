#!/usr/bin/env bash
# T21a — record the PoC demo video from the real app (run from app/ after `npm run build`).
# Starts the primary (:3000, real .env.local) and failure (:3001, invalid key) instances, records the
# top-left 1280×800 of $DISPLAY with ffmpeg x11grab (H.264, yuv420p, 30 fps) while scripts/demo-flow.ts
# drives a headed Chromium window there, then stops ffmpeg cleanly with "q" and both servers.
set -euo pipefail

OUT="${1:-../docs/qa/video/poc-demo.mp4}"
DISPLAY="${DISPLAY:-:10.0}"
export DISPLAY
mkdir -p "$(dirname "$OUT")"

npx next start -p 3000 >/dev/null 2>&1 &
PRIMARY_PID=$!
OPENROUTER_API_KEY=invalid-demo-key npx next start -p 3001 >/dev/null 2>&1 &
FAILURE_PID=$!
# Stop the npx wrappers and the next-server processes they spawned (matched by process name, not command line).
cleanup() {
  kill "$PRIMARY_PID" "$FAILURE_PID" 2>/dev/null || true
  ps -eo pid=,comm= | awk '$2 ~ /^next-serv/ {print $1}' | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

for port in 3000 3001; do
  for _ in $(seq 1 30); do
    node -e "fetch('http://localhost:$port').then(()=>process.exit(0)).catch(()=>process.exit(1))" && break
    sleep 1
  done
done

FIFO="$(mktemp -u)"
mkfifo "$FIFO"
ffmpeg -hide_banner -loglevel error -y \
  -f x11grab -video_size 1280x800 -framerate 30 -draw_mouse 1 -i "${DISPLAY}+0,0" \
  -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart "$OUT" <"$FIFO" &
FFMPEG_PID=$!
exec 3>"$FIFO"

npx tsx scripts/demo-flow.ts || echo "demo-flow failed" >&2

printf 'q' >&3
exec 3>&-
wait "$FFMPEG_PID"
rm -f "$FIFO"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,pix_fmt,r_frame_rate -of default=nw=1 "$OUT"
