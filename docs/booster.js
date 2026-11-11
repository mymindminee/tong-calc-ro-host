// Adds a "Booster Set" button above the shadow equipment rows.
// Relies on window.__roCalc exposed by patch.sh.
(function () {
  var SLOTS = ['shadowWeapon', 'shadowArmor', 'shadowShield', 'shadowBoot', 'shadowEarring', 'shadowPendant'];

  function apply() {
    var c = window.__roCalc;
    if (!c) return alert('calculator not ready');
    var zone = getAllAngularTestabilities()[0]._ngZone;
    zone.run(function () {
      var missing = [];
      SLOTS.forEach(function (k) {
        var pick = (c[k + 'List'] || []).find(function (o) { return /Booster Shadow/.test(o.label); });
        if (!pick) return missing.push(k);
        c.model[k] = pick.value;
        c.onSelectItem(k, pick.value, c.model[k + 'Refine'] || 0);
      });
      if (missing.length) c.messageService.add({ severity: 'warn', summary: 'No booster for: ' + missing.join(', ') });
    });
  }

  function mount() {
    var first = document.querySelector('app-equipment-shadow');
    if (!first || document.getElementById('booster-set-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'booster-set-btn';
    btn.type = 'button';
    btn.className = 'p-button p-component p-button-sm p-button-outlined';
    btn.style.margin = '4px 0';
    btn.textContent = 'Booster Set';
    btn.onclick = apply;
    first.parentElement.insertAdjacentElement('beforebegin', btn);
  }

  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
