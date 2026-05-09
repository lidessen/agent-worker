#!/usr/bin/env bash
#
# Download and update the bundled Maple Mono NF CN font.
#
# Usage:
#   ./scripts/update-maple-font.sh          # latest release
#   ./scripts/update-maple-font.sh v7.9     # specific version
#
# Requirements: curl, unzip, python3 with fonttools + brotli
#   pip3 install fonttools brotli

set -euo pipefail

VERSION="${1:-}"
REPO="subframe7536/maple-font"
ASSET_NAME="MapleMono-NF-CN-unhinted.zip"
FONT_DIR="packages/ssg/src/plugins/docs-theme/fonts"
WORK_DIR="$(mktemp -d)"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# ── Resolve version ──────────────────────────────────────────────

if [ -z "$VERSION" ]; then
  echo "Fetching latest release tag..."
  VERSION=$(curl -sS "https://api.github.com/repos/${REPO}/releases/latest" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")
fi

echo "Version: ${VERSION}"

# ── Download ─────────────────────────────────────────────────────

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"
ZIP_PATH="${WORK_DIR}/${ASSET_NAME}"

echo "Downloading ${DOWNLOAD_URL} ..."
curl -fSL -o "$ZIP_PATH" "$DOWNLOAD_URL"

# ── Extract Regular weight + LICENSE ─────────────────────────────

echo "Extracting MapleMono-NF-CN-Regular.ttf and LICENSE.txt ..."
unzip -o -j "$ZIP_PATH" "MapleMono-NF-CN-Regular.ttf" "LICENSE.txt" -d "$WORK_DIR"

# ── Convert TTF → WOFF2 ─────────────────────────────────────────

echo "Converting TTF to WOFF2 ..."
python3 -c "
from fontTools.ttLib import TTFont
font = TTFont('${WORK_DIR}/MapleMono-NF-CN-Regular.ttf')
font.flavor = 'woff2'
font.save('${WORK_DIR}/MapleMono-NF-CN-Regular.woff2')
"

# ── Copy to project ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEST="${PROJECT_ROOT}/${FONT_DIR}"

mkdir -p "$DEST"
cp "${WORK_DIR}/MapleMono-NF-CN-Regular.woff2" "$DEST/"
cp "${WORK_DIR}/LICENSE.txt" "$DEST/MAPLE_MONO_LICENSE.txt"

# ── Summary ──────────────────────────────────────────────────────

WOFF2_SIZE=$(du -h "${DEST}/MapleMono-NF-CN-Regular.woff2" | cut -f1)
echo ""
echo "Done! Updated Maple Mono NF CN to ${VERSION}"
echo "  ${FONT_DIR}/MapleMono-NF-CN-Regular.woff2  (${WOFF2_SIZE})"
echo "  ${FONT_DIR}/MAPLE_MONO_LICENSE.txt"
