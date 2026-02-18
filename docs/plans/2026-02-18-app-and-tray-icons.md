# App and Tray Icons Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the default Electron placeholder icons with a custom clock+terminal design using a dark background and electric blue accent.

**Architecture:** SVG files are the source of truth, converted to all required formats via a shell script using macOS built-in tools (`qlmanage`, `sips`, `iconutil`). The tray icon swaps between a monochrome template image (idle) and an electric blue icon (jobs running) inside the existing `updateTrayMenu()` function.

**Tech Stack:** SVG, macOS `qlmanage` (SVG→PNG), `sips` (PNG resize), `iconutil` (PNG→icns), Electron `nativeImage`

---

### Task 1: Create the app icon SVG

**Files:**
- Create: `resources/icon.svg`

**Step 1: Create the file**

Create `resources/icon.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <!-- Background -->
  <rect width="1024" height="1024" rx="200" ry="200" fill="#1a1b2e"/>

  <!-- Clock ring -->
  <circle cx="512" cy="450" r="260" fill="none" stroke="#4F8EF7" stroke-width="22"/>

  <!-- Tick marks at 12, 3, 6, 9 o'clock -->
  <line x1="512" y1="190" x2="512" y2="225" stroke="#4F8EF7" stroke-width="18" stroke-linecap="round"/>
  <line x1="772" y1="450" x2="737" y2="450" stroke="#4F8EF7" stroke-width="18" stroke-linecap="round"/>
  <line x1="512" y1="710" x2="512" y2="675" stroke="#4F8EF7" stroke-width="18" stroke-linecap="round"/>
  <line x1="252" y1="450" x2="287" y2="450" stroke="#4F8EF7" stroke-width="18" stroke-linecap="round"/>

  <!-- Hour hand at 10 o'clock (300°): direction (sin300°, -cos300°) = (-0.866, -0.5), length 150px -->
  <line x1="512" y1="450" x2="382" y2="375" stroke="#4F8EF7" stroke-width="22" stroke-linecap="round"/>

  <!-- Minute hand at 2 o'clock / 10 min (60°): direction (sin60°, -cos60°) = (0.866, -0.5), length 210px -->
  <line x1="512" y1="450" x2="694" y2="345" stroke="#4F8EF7" stroke-width="22" stroke-linecap="round"/>

  <!-- Center dot -->
  <circle cx="512" cy="450" r="16" fill="#4F8EF7"/>

  <!-- Terminal prompt inside clock face -->
  <text x="512" y="630" text-anchor="middle" font-family="monospace" font-size="120" font-weight="bold" fill="#4F8EF7">&gt;_</text>
</svg>
```

**Step 2: Verify visually**

Open it in a browser or Quick Look (`qlmanage -p resources/icon.svg`) and confirm:
- Dark rounded rectangle background
- Blue clock ring with 4 tick marks
- Two hands forming a "V" pointing up-left and up-right (10:10 pose)
- `>_` centered in the lower half of the clock face

**Step 3: Commit**

```bash
git add resources/icon.svg
git commit -m "feat: add app icon SVG source"
```

---

### Task 2: Create the tray icon SVGs

**Files:**
- Create: `resources/tray-icon.svg`
- Create: `resources/tray-icon-active.svg`

**Step 1: Create the normal tray icon (black, macOS template image)**

Create `resources/tray-icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <!-- Clock ring — black so macOS template rendering inverts it for light/dark menubar -->
  <circle cx="22" cy="18" r="13" fill="none" stroke="black" stroke-width="2"/>

  <!-- Tick marks at 12, 3, 6, 9 -->
  <line x1="22" y1="5"  x2="22" y2="8"  stroke="black" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="35" y1="18" x2="32" y2="18" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="22" y1="31" x2="22" y2="28" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="9"  y1="18" x2="12" y2="18" stroke="black" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Hour hand at 10 o'clock, length 7px: tip at (22+7×-0.866, 18+7×-0.5) = (16, 14.5) -->
  <line x1="22" y1="18" x2="16" y2="14.5" stroke="black" stroke-width="1.8" stroke-linecap="round"/>

  <!-- Minute hand at 10 min (2 o'clock), length 10px: tip at (22+10×0.866, 18+10×-0.5) = (31, 13) -->
  <line x1="22" y1="18" x2="31" y2="13" stroke="black" stroke-width="1.8" stroke-linecap="round"/>

  <!-- Center dot -->
  <circle cx="22" cy="18" r="1.5" fill="black"/>

  <!-- Terminal prompt inside clock -->
  <text x="22" y="28" text-anchor="middle" font-family="monospace" font-size="8.5" font-weight="bold" fill="black">&gt;_</text>
</svg>
```

**Step 2: Create the active tray icon (electric blue)**

Create `resources/tray-icon-active.svg` — identical but replacing every `black` with `#4F8EF7`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <circle cx="22" cy="18" r="13" fill="none" stroke="#4F8EF7" stroke-width="2"/>

  <line x1="22" y1="5"  x2="22" y2="8"  stroke="#4F8EF7" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="35" y1="18" x2="32" y2="18" stroke="#4F8EF7" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="22" y1="31" x2="22" y2="28" stroke="#4F8EF7" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="9"  y1="18" x2="12" y2="18" stroke="#4F8EF7" stroke-width="1.5" stroke-linecap="round"/>

  <line x1="22" y1="18" x2="16" y2="14.5" stroke="#4F8EF7" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="22" y1="18" x2="31" y2="13"   stroke="#4F8EF7" stroke-width="1.8" stroke-linecap="round"/>

  <circle cx="22" cy="18" r="1.5" fill="#4F8EF7"/>

  <text x="22" y="28" text-anchor="middle" font-family="monospace" font-size="8.5" font-weight="bold" fill="#4F8EF7">&gt;_</text>
</svg>
```

**Step 3: Verify visually**

```bash
qlmanage -p resources/tray-icon.svg
qlmanage -p resources/tray-icon-active.svg
```

Confirm: clock ring, 4 ticks, two hands, `>_` inside — black for normal, electric blue for active.

**Step 4: Commit**

```bash
git add resources/tray-icon.svg resources/tray-icon-active.svg
git commit -m "feat: add tray icon SVG sources"
```

---

### Task 3: Create the conversion script

**Files:**
- Create: `scripts/generate-icons.sh`

**Step 1: Create the script**

```bash
mkdir -p scripts
```

Create `scripts/generate-icons.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Generating icons..."

# ---- App icon ----
# Render SVG at 1024x1024 using Quick Look (reliable SVG renderer on macOS)
qlmanage -t -s 1024 -o /tmp/ resources/icon.svg 2>/dev/null
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
# Normal tray icon (black → macOS template rendering inverts for light/dark)
qlmanage -t -s 44 -o /tmp/ resources/tray-icon.svg 2>/dev/null
cp /tmp/tray-icon.svg.png "resources/tray-icon@2x.png"
sips -s format png --resampleWidth 22 "resources/tray-icon@2x.png" --out resources/tray-icon.png 2>/dev/null
echo "  ✓ resources/tray-icon.png + tray-icon@2x.png"

# Active tray icon (electric blue, not a template image)
qlmanage -t -s 44 -o /tmp/ resources/tray-icon-active.svg 2>/dev/null
cp /tmp/tray-icon-active.svg.png "resources/tray-icon-active@2x.png"
sips -s format png --resampleWidth 22 "resources/tray-icon-active@2x.png" --out resources/tray-icon-active.png 2>/dev/null
echo "  ✓ resources/tray-icon-active.png + tray-icon-active@2x.png"

echo ""
echo "Done!"
```

**Step 2: Make executable**

```bash
chmod +x scripts/generate-icons.sh
```

**Step 3: Commit**

```bash
git add scripts/generate-icons.sh
git commit -m "feat: add icon generation script"
```

---

### Task 4: Run the conversion script and verify output

**Step 1: Run the script**

```bash
bash scripts/generate-icons.sh
```

Expected output:
```
Generating icons...
  ✓ resources/icon.png
  ✓ build/icon.png
  ✓ build/icon.icns
  ✓ resources/tray-icon.png + tray-icon@2x.png
  ✓ resources/tray-icon-active.png + tray-icon-active@2x.png

Done!
```

**Step 2: Visually verify the PNGs**

```bash
qlmanage -p resources/icon.png
qlmanage -p resources/tray-icon.png
qlmanage -p resources/tray-icon-active.png
```

Confirm:
- `icon.png`: dark background, blue clock+`>_`, 1024×1024
- `tray-icon.png`: tiny black clock+`>_` on transparent background, 22×22
- `tray-icon-active.png`: same in electric blue, 22×22

**Step 3: Verify file sizes are non-trivial (not 1×1 green pixels)**

```bash
file resources/tray-icon.png resources/tray-icon-active.png
# Both should report PNG image data, 22 x 22
```

**Step 4: Commit**

```bash
git add resources/icon.png "resources/tray-icon@2x.png" resources/tray-icon.png \
        "resources/tray-icon-active@2x.png" resources/tray-icon-active.png \
        build/icon.png build/icon.icns
git commit -m "feat: generate icon PNGs and icns from SVG sources"
```

---

### Task 5: Update tray icon swap logic in index.ts

The existing `updateTrayMenu()` already calls `scheduler.getRunningJobIds()` (line 21). Add icon swapping at the top of that function.

**Files:**
- Modify: `src/main/index.ts:19-31`

**Step 1: Read the current function**

```typescript
// Current updateTrayMenu() at line 19-31:
function updateTrayMenu(): void {
  if (!tray) return
  const running = scheduler.getRunningJobIds()
  const runningLabel = running.length > 0 ? `${running.length} job(s) running` : 'No jobs running'
  const menu = Menu.buildFromTemplate([
    { label: runningLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Cron Manager', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(0) } },
  ])
  tray.setContextMenu(menu)
}
```

**Step 2: Apply the edit**

Replace the body of `updateTrayMenu` to add icon swapping:

```typescript
function updateTrayMenu(): void {
  if (!tray) return
  const running = scheduler.getRunningJobIds()

  // Swap tray icon: template image (idle) vs electric blue (jobs running)
  const iconFile = running.length > 0 ? 'tray-icon-active.png' : 'tray-icon.png'
  const icon = nativeImage.createFromPath(join(__dirname, `../../resources/${iconFile}`))
  if (running.length === 0) icon.setTemplateImage(true)
  tray.setImage(icon)

  const runningLabel = running.length > 0 ? `${running.length} job(s) running` : 'No jobs running'
  const menu = Menu.buildFromTemplate([
    { label: runningLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Cron Manager', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(0) } },
  ])
  tray.setContextMenu(menu)
}
```

Note: `nativeImage.createFromPath` automatically picks up `tray-icon@2x.png` for retina displays when the base file is `tray-icon.png`.

**Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: swap tray icon between idle and active states"
```

---

### Task 6: Smoke-test in the running app

**Step 1: Start the app**

```bash
npm run dev
```

**Step 2: Check menubar**

- App should appear in the macOS menubar with the new clock+`>_` icon
- Icon should appear dark on light menubar, light on dark menubar (template image behavior)
- Click the tray icon to open the app window

**Step 3: Trigger a job run**

In the app, run a job manually ("Run Now"). While it's running, observe the tray icon — it should turn electric blue. When the job finishes, it should return to the monochrome template icon.

**Step 4: Check the app icon**

Open `resources/icon.png` or check the app in the dock/Finder — it should show the custom clock+terminal design instead of the Electron atom placeholder.
