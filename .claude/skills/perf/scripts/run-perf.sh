#!/usr/bin/env bash
# agent-worker web UI performance test
# Usage: bash run-perf.sh [--no-build] [--no-restart] [--quick]
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
WEB="$ROOT/packages/web"
INDEX="$WEB/src/index.html"
REPORT="/tmp/aw-perf.json"
PREV="/tmp/aw-perf-prev.json"
URL="http://127.0.0.1:7420/"

NO_BUILD=false
NO_RESTART=false
QUICK=false

for arg in "$@"; do
  case $arg in
    --no-build) NO_BUILD=true ;;
    --no-restart) NO_RESTART=true ;;
    --quick) QUICK=true ;;
  esac
done

# ── Step 1: Bump cache version ────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  CURRENT_V=$(grep -o 'v=[0-9]*' "$INDEX" | head -1 | cut -d= -f2)
  NEXT_V=$((CURRENT_V + 1))
  sed -i '' "s/v=$CURRENT_V/v=$NEXT_V/" "$INDEX"
  echo ">> Version bumped: v=$CURRENT_V → v=$NEXT_V"
fi

# ── Step 2: Build ─────────────────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  echo ">> Building web package..."
  cd "$WEB" && bun run build 2>&1 | tail -1
fi

# ── Step 3: Restart daemon ────────────────────────────────────────────
if [ "$NO_RESTART" = false ]; then
  echo ">> Restarting daemon..."
  cd "$ROOT"
  bun run aw daemon stop 2>/dev/null || true
  sleep 1
  bun run aw daemon start -d 2>&1 | grep -E "PID|URL|Web"
  sleep 1
fi

# ── Step 4: Quick check (agent-browser) ───────────────────────────────
if [ "$QUICK" = true ]; then
  echo ""
  echo ">> Quick DOM check..."
  agent-browser close 2>/dev/null || true
  agent-browser open "$URL" 2>/dev/null
  sleep 3
  agent-browser eval --stdin <<'EVALEOF' 2>/dev/null
JSON.stringify({
  domNodes: document.querySelectorAll('*').length,
  styleElements: document.querySelectorAll('style').length,
  semajsxStyles: document.querySelectorAll('style[data-semajsx]').length,
  cssRules: document.querySelector('style[data-semajsx]')?.textContent?.split('\n').filter(Boolean).length || 0,
  listItems: document.querySelectorAll('[class*="listItem"]').length,
  buttons: document.querySelectorAll('button').length,
  errors: (function() {
    try { return window.__consoleErrors?.length || 0; } catch(e) { return 'N/A'; }
  })(),
}, null, 2)
EVALEOF
  agent-browser close 2>/dev/null || true
  exit 0
fi

# ── Step 5: Run Lighthouse ────────────────────────────────────────────
echo ""
echo ">> Running Lighthouse (no CPU throttle)..."

# Save previous report
if [ -f "$REPORT" ]; then
  cp "$REPORT" "$PREV"
fi

npx lighthouse "$URL" \
  --only-categories=performance \
  --output=json \
  --output-path="$REPORT" \
  --chrome-flags="--headless --no-sandbox" \
  --throttling-method=provided \
  2>&1 | grep -E "status|Printer|error" | tail -3

# ── Step 6: Parse and display results ─────────────────────────────────
echo ""
python3 - "$REPORT" "$PREV" <<'PYEOF'
import json, sys, os

report = json.load(open(sys.argv[1]))
prev_file = sys.argv[2] if len(sys.argv) > 2 else None
prev = json.load(open(prev_file)) if prev_file and os.path.exists(prev_file) else None

a = report['audits']
pa = prev['audits'] if prev else None

def metric(key):
    val = a.get(key, {}).get('numericValue', 0)
    score = a.get(key, {}).get('score', 0)
    display = a.get(key, {}).get('displayValue', '?')
    delta = ''
    if pa and key in pa:
        old = pa[key].get('numericValue', 0)
        diff = val - old
        if abs(diff) > 1:
            sign = '+' if diff > 0 else ''
            delta = f'  ({sign}{diff:.0f}ms)'
    grade = '✓' if score and score >= 0.9 else '△' if score and score >= 0.5 else '✗'
    return f'{grade} {display}{delta}'

print('=' * 55)
print('  AGENT WORKER — PERFORMANCE REPORT')
print('=' * 55)
print()
print(f'  FCP  {metric("first-contentful-paint")}')
print(f'  LCP  {metric("largest-contentful-paint")}')
print(f'  TBT  {metric("total-blocking-time")}')
print(f'  TTI  {metric("interactive")}')
print(f'  FID  {metric("max-potential-fid")}')

# Main thread breakdown
mt = a.get('mainthread-work-breakdown', {})
items = mt.get('details', {}).get('items', [])
print()
print(f'  Main Thread: {mt.get("displayValue", "?")}')
for item in items[:5]:
    label = item.get('groupLabel', '?')
    dur = item.get('duration', 0)
    # Compare with prev
    delta = ''
    if pa:
        p_items = pa.get('mainthread-work-breakdown', {}).get('details', {}).get('items', [])
        p_match = next((i for i in p_items if i.get('groupLabel') == label), None)
        if p_match:
            diff = dur - p_match.get('duration', 0)
            if abs(diff) > 10:
                sign = '+' if diff > 0 else ''
                delta = f'  ({sign}{diff:.0f}ms)'
    print(f'    {label}: {dur:.0f}ms{delta}')

# Long tasks
diag = a.get('diagnostics', {}).get('details', {}).get('items', [{}])[0]
lt = a.get('long-tasks', {}).get('details', {}).get('items', [])
max_lt = max((t.get('duration', 0) for t in lt), default=0)
print()
print(f'  Long Tasks: {len(lt)}  (max: {max_lt:.0f}ms)')
print(f'  DOM Nodes: {diag.get("numRequests", "?")} requests')
print(f'  Tasks: {diag.get("numTasks", "?")} total, {diag.get("numTasksOver50ms", "?")} >50ms, {diag.get("numTasksOver500ms", "?")} >500ms')

# Score
perf_score = report.get('categories', {}).get('performance', {}).get('score', 0)
print()
prev_score = prev.get('categories', {}).get('performance', {}).get('score', 0) if prev else None
delta = ''
if prev_score is not None:
    diff = (perf_score or 0) - (prev_score or 0)
    if abs(diff) > 0.01:
        sign = '+' if diff > 0 else ''
        delta = f'  ({sign}{diff*100:.0f})'
print(f'  Performance Score: {int((perf_score or 0) * 100)}/100{delta}')
print()
print('=' * 55)

PYEOF
