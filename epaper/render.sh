#!/bin/sh
# Render one page in e-paper mode to a PNG, for checking on a laptop.
#   epaper/render.sh months 1995-08-15 out.png [800 480]
set -e
unit="${1:-months}"; dob="${2:?birthday as YYYY-MM-DD}"; out="${3:-$unit.png}"
w="${4:-800}"; h="${5:-480}"
here="$(cd "$(dirname "$0")/.." && pwd)"
for c in google-chrome chromium chromium-browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then chrome="$c"; break; fi
done
[ -n "$chrome" ] || { echo "no Chrome or Chromium found" >&2; exit 1; }
"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="$w,$h" --virtual-time-budget=5000 --screenshot="$out" \
  "file://$here/$unit.html?epaper=1&dob=$dob" 2>/dev/null
echo "wrote $out"
