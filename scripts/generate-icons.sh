#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Generating icons..."

# ---- App icon ----
# Render SVG at 1024x1024 using Quick Look (reliable SVG renderer on macOS)
qlmanage -t -s 1024 -o /tmp/ resources/icon.svg 2>/dev/null
if [ ! -s /tmp/icon.svg.png ]; then
  echo "ERROR: qlmanage failed to render icon.svg" >&2
  exit 1
fi
cp /tmp/icon.svg.png resources/icon.png
cp resources/icon.png build/icon.png
echo "  ✓ resources/icon.png"
echo "  ✓ build/icon.png"

# Build .icns from iconset
ICONSET="build/icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

sips -s format png --resampleWidth 16   resources/icon.png --out "$ICONSET/icon_16x16.png"    2>/dev/null
sips -s format png --resampleWidth 32   resources/icon.png --out "$ICONSET/icon_16x16@2x.png" 2>/dev/null
sips -s format png --resampleWidth 32   resources/icon.png --out "$ICONSET/icon_32x32.png"    2>/dev/null
sips -s format png --resampleWidth 64   resources/icon.png --out "$ICONSET/icon_32x32@2x.png" 2>/dev/null
sips -s format png --resampleWidth 128  resources/icon.png --out "$ICONSET/icon_128x128.png"    2>/dev/null
sips -s format png --resampleWidth 256  resources/icon.png --out "$ICONSET/icon_128x128@2x.png" 2>/dev/null
sips -s format png --resampleWidth 256  resources/icon.png --out "$ICONSET/icon_256x256.png"    2>/dev/null
sips -s format png --resampleWidth 512  resources/icon.png --out "$ICONSET/icon_256x256@2x.png" 2>/dev/null
sips -s format png --resampleWidth 512  resources/icon.png --out "$ICONSET/icon_512x512.png"    2>/dev/null
sips -s format png --resampleWidth 1024 resources/icon.png --out "$ICONSET/icon_512x512@2x.png" 2>/dev/null

iconutil -c icns "$ICONSET" -o build/icon.icns
rm -rf "$ICONSET"
echo "  ✓ build/icon.icns"

# ---- Tray icons ----
# Normal tray icon (black -> macOS template rendering inverts for light/dark)
qlmanage -t -s 44 -o /tmp/ resources/tray-icon.svg 2>/dev/null
if [ ! -s /tmp/tray-icon.svg.png ]; then
  echo "ERROR: qlmanage failed to render tray-icon.svg" >&2
  exit 1
fi
cp /tmp/tray-icon.svg.png "resources/tray-icon@2x.png"
sips -s format png --resampleWidth 22 "resources/tray-icon@2x.png" --out resources/tray-icon.png 2>/dev/null
echo "  ✓ resources/tray-icon.png + tray-icon@2x.png"

# Active tray icon (electric blue, not a template image)
qlmanage -t -s 44 -o /tmp/ resources/tray-icon-active.svg 2>/dev/null
if [ ! -s /tmp/tray-icon-active.svg.png ]; then
  echo "ERROR: qlmanage failed to render tray-icon-active.svg" >&2
  exit 1
fi
cp /tmp/tray-icon-active.svg.png "resources/tray-icon-active@2x.png"
sips -s format png --resampleWidth 22 "resources/tray-icon-active@2x.png" --out resources/tray-icon-active.png 2>/dev/null
echo "  ✓ resources/tray-icon-active.png + tray-icon-active@2x.png"

echo ""
echo "Done!"
