#!/usr/bin/env bash
# Re-applies local additions on top of the upstream build (run after every sync).
set -euo pipefail
cd "$(dirname "$0")/docs"
cp ../booster.js .

# 1) expose the main calculator component as window.__roCalc
chunk=$(grep -l 'ngOnInit(){\(window.__roCalc=this;\)\?this.optionList=' chunk-*.js)
[ "$(echo "$chunk" | wc -l)" = 1 ] || { echo "anchor not unique: $chunk"; exit 1; }
if ! grep -q 'window.__roCalc=this' "$chunk"; then
  sed -i 's/ngOnInit(){this.optionList=/ngOnInit(){window.__roCalc=this;this.optionList=/' "$chunk"
fi
grep -q 'window.__roCalc=this' "$chunk"

# 2) load booster.js
# versioned by content hash so browsers drop the cached copy (Pages caches 10 min)
v=$(md5sum booster.js | cut -c1-8)
sed -i -E 's#<script src="booster\.js[^"]*"></script>##' index.html
sed -i "s#</body>#<script src=\"booster.js?v=$v\"></script></body>#" index.html
grep -q "booster.js?v=$v" index.html
echo patched
