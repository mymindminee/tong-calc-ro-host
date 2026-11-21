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

# 3) faster load: preload the lazy calculator chunk + data JSON alongside main; drop Google ads
calc=$(grep -l 'updateItemEvent.pipe(' chunk-*.js)
[ "$(echo "$calc" | wc -l)" = 1 ] || { echo "calc chunk not unique: $calc"; exit 1; }
sed -i -E 's#<link rel="modulepreload" href="chunk-[A-Z0-9]+\.js" data-booster>##g; s#<link rel="preload" href="assets/demo/data/[a-z_]+\.json" as="fetch" crossorigin data-booster>##g' index.html
pre="<link rel=\"modulepreload\" href=\"$calc\" data-booster>"
for j in item monster hp_sp_table rune; do pre="$pre<link rel=\"preload\" href=\"assets/demo/data/$j.json\" as=\"fetch\" crossorigin data-booster>"; done
sed -i "s#</head>#$pre</head>#" index.html
sed -i -E 's#<script async src="https://pagead2\.googlesyndication\.com[^"]*"[^>]*></script>##' index.html
grep -q "modulepreload\" href=\"$calc\"" index.html && ! grep -q pagead2 index.html

# 4) snappier recalculation: debounce 250ms -> 80ms, spinner 100ms -> 30ms (calc itself ~12ms)
sed -i -E 's/(isCalculating=!0(,c\.add\(A\))?\}?\)),Gt\(250\)\)/\1,Gt(80))/g; s/isCalculatingEvent\.pipe\(Gt\(100\)\)/isCalculatingEvent.pipe(Gt(30))/' "$calc"
[ "$(grep -o 'isCalculating=!0[^G]*Gt(80))' "$calc" | wc -l)" = 3 ] || { echo "debounce patch count wrong"; exit 1; }

# 4b) tab title + icon (both pages; /new/ is generated from this index.html)
cp ../favicon.ico ../app-icon.png .
sed -i -E 's#<title>[^<]*</title>#<title>Ragnarok Calculator</title>#; s#<link rel="(apple-touch-)?icon"[^>]*>##g' index.html
sed -i 's#</title>#</title><link rel="icon" href="favicon.ico?v=2" sizes="any"><link rel="icon" type="image/png" href="app-icon.png?v=2"><link rel="apple-touch-icon" href="app-icon.png?v=2">#' index.html
grep -q '<title>Ragnarok Calculator</title>' index.html && grep -q 'app-icon.png' index.html

# 5) /new/: the same engine and data with the new skin (theme switch, responsive). index.html stays as is.
mkdir -p new && cp ../skin/* new/
sv=$(cat ../skin/* | md5sum | cut -c1-8)
sed -E -e 's#<base href="[^"]*">#<base href="../../tong-calc-ro-host/">#' \
  -e "s#(<link id=\"theme-css\"[^>]*>)#\\1<script src=\"new/skin.js?v=$sv\"></script>#" \
  -e "s#</head>#<link rel=\"stylesheet\" href=\"new/skin.css?v=$sv\"></head>#" index.html > new/index.html
grep -q "new/skin.js?v=$sv" new/index.html && grep -q "new/skin.css?v=$sv" new/index.html && grep -q 'base href="../../tong-calc-ro-host/"' new/index.html
echo patched
