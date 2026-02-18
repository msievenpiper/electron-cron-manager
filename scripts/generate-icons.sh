#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Generating icons..."

# ---- App icon ----
# Use sips to render SVG directly — preserves transparency unlike qlmanage
sips -s format png --resampleWidth 1024 resources/icon.svg --out resources/icon.png 2>/dev/null
if [ ! -s resources/icon.png ]; then
  echo "ERROR: sips failed to render icon.svg" >&2
  exit 1
fi
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
# Use sips directly on SVG — preserves transparency (qlmanage adds white background)

# Normal tray icon (black -> macOS template rendering inverts for light/dark)
sips -s format png --resampleWidth 44 resources/tray-icon.svg --out "resources/tray-icon@2x.png" 2>/dev/null
if [ ! -s "resources/tray-icon@2x.png" ]; then
  echo "ERROR: sips failed to render tray-icon.svg" >&2
  exit 1
fi
sips -s format png --resampleWidth 22 "resources/tray-icon@2x.png" --out resources/tray-icon.png 2>/dev/null
echo "  ✓ resources/tray-icon.png + tray-icon@2x.png"

# Active tray icon (electric blue, not a template image)
sips -s format png --resampleWidth 44 resources/tray-icon-active.svg --out "resources/tray-icon-active@2x.png" 2>/dev/null
if [ ! -s "resources/tray-icon-active@2x.png" ]; then
  echo "ERROR: sips failed to render tray-icon-active.svg" >&2
  exit 1
fi
sips -s format png --resampleWidth 22 "resources/tray-icon-active@2x.png" --out resources/tray-icon-active.png 2>/dev/null
echo "  ✓ resources/tray-icon-active.png + tray-icon-active@2x.png"

echo ""
echo "Done!"
