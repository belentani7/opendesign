#!/usr/bin/env bash
# Regenerates assets/og-image.png — the social card shown when the gallery is shared.
#
# Dev-only convenience; requires ImageMagick 6 (`convert`). It is NOT needed to
# build, run, test or host the site — the PNG is committed so everything works
# without it. If ImageMagick is missing this script exits cleanly.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick not installed — skipping (the committed og-image.png is used)."
  exit 0
fi

GOLD='#c9a84c'
GOLD_LT='#e3cb85'
INK='#07080a'

convert -size 1200x630 xc:"$INK" \
  \( -size 1400x700 radial-gradient:'#3a2f14'-"$INK" \) -gravity center -geometry +0-40 -compose screen -composite \
  \( -size 1200x630 xc:none -fill 'rgba(201,168,76,0.10)' -draw 'circle 950,110 950,210' \) -compose over -composite \
  -stroke "$GOLD" -strokewidth 5 -fill none \
  -draw 'circle 168,315 168,395' \
  -draw 'line 168,235 168,285' -draw 'line 237,275 194,300' -draw 'line 237,355 194,330' \
  -draw 'line 99,355 142,330' -draw 'line 99,275 142,300' \
  -stroke none -fill "$GOLD" -draw 'circle 168,315 168,333' \
  -font DejaVu-Sans-Bold -fill '#f1f3f7' -pointsize 86 -gravity NorthWest -annotate +300+250 'OpenDesign' \
  -font DejaVu-Sans -fill '#a3acb9' -pointsize 32 -annotate +304+360 'The free, open-source gallery for design' \
  -font DejaVu-Sans -fill '#a3acb9' -pointsize 32 -annotate +304+408 'mockups and design systems.' \
  -fill "$GOLD" -draw 'roundrectangle 304,468 356,506 6,6' \
  -font DejaVu-Sans-Bold -fill "$INK" -pointsize 24 -annotate +314+482 'MIT' \
  -fill 'rgba(201,168,76,0.16)' -draw 'roundrectangle 372,468 620,506 6,6' \
  -fill "$GOLD_LT" -pointsize 24 -annotate +388+482 '0 DEPENDENCIES' \
  -fill 'rgba(201,168,76,0.16)' -draw 'roundrectangle 636,468 808,506 6,6' \
  -fill "$GOLD_LT" -pointsize 24 -annotate +652+482 'FREE TO HOST' \
  -fill 'rgba(201,168,76,0.35)' -draw 'rectangle 0,624 1200,630' \
  -depth 8 -strip -colors 128 -define png:compression-level=9 assets/og-image.png

echo "wrote assets/og-image.png ($(wc -c < assets/og-image.png) bytes)"
