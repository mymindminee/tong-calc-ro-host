// Overlay: "Booster Set" button above shadow slots + quick buff/potion toggles under the monster image.
// Relies on window.__roCalc exposed by patch.sh.
(function () {
  var SLOTS = ['shadowWeapon', 'shadowArmor', 'shadowShield', 'shadowBoot', 'shadowEarring', 'shadowPendant'];

  function run(fn) {
    var c = window.__roCalc;
    if (!c) return;
    getAllAngularTestabilities()[0]._ngZone.run(function () { fn(c); });
  }

  function applyBooster() {
    run(function (c) {
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

  // --- toggles -------------------------------------------------------------
  // skill: on = highest level in dropdown, off = 0. consumable: model.consumables. aspd: stack selection.
  var TOGGLES = [
    { label: 'Agi Up', skill: 'Cantocandidus' },
    { label: 'Blessing', skill: 'Clementia' },
    { label: 'Comet Amp', skill: 'Comet Amp' },
    { label: 'Almighty', consumable: 12883 },
    { label: 'Power Booster', consumable: 14766 },
    { label: 'Unlimited Drink', consumable: 23475 },
    { label: 'Concentration', aspd: 645 },
    { label: 'Awakening', aspd: 656 },
    { label: 'Berserk', aspd: 657 },
    { label: 'Celermine', aspd: 12437 },
    { label: 'ASPD Potion', aspd: 12684 },
  ];

  function entry(c, name) {
    return (c.skillBuffEntries || []).find(function (e) { return e.skill.name === name; });
  }
  function isOn(c, t) {
    if (t.skill) { var e = entry(c, t.skill); return !!e && Number(c.model.skillBuffs[e.index]) > 0; }
    if (t.consumable) return (c.model.consumables || []).map(Number).indexOf(t.consumable) >= 0;
    return (c.model.aspdPotions || []).map(Number).indexOf(t.aspd) >= 0;
  }
  function setOn(c, t, on) {
    if (t.skill) {
      var e = entry(c, t.skill);
      if (!e) return c.messageService.add({ severity: 'warn', summary: t.label + ' not available for this class' });
      var max = Math.max.apply(null, e.skill.dropdown.map(function (d) { return Number(d.value) || 0; }));
      c.model.skillBuffs[e.index] = on ? max : 0;
      return c.onSkillClassChange();
    }
    if (t.consumable) {
      var list = (c.model.consumables || []).map(Number).filter(function (x) { return x !== t.consumable; });
      if (on) list.push(t.consumable);
      c.model.consumables = c.normalizeIdList(list);
      return c.onConsumableChange();
    }
    var sel = (c.aspdPotionStackSelection || []).map(Number).filter(function (x) { return x !== t.aspd; });
    if (on) sel.push(t.aspd);
    c.onAspdPotionStackSelectionChange(sel);
  }

  function render(box) {
    var c = window.__roCalc;
    if (!c) return;
    box.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('p-button-outlined', !isOn(c, TOGGLES[b.dataset.i]));
    });
  }

  function mountToggles() {
    var sec = document.querySelector('.monster-custom-section');
    if (!sec || document.getElementById('quick-toggles')) return;
    var box = document.createElement('div');
    box.id = 'quick-toggles';
    box.className = 'col-12';
    box.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:4px 0';
    TOGGLES.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      b.className = 'p-button p-component p-button-sm p-button-outlined';
      b.style.padding = '2px 8px';
      b.textContent = t.label;
      b.onclick = function () { run(function (c) { setOn(c, t, !isOn(c, t)); }); render(box); };
      box.appendChild(b);
    });
    sec.insertAdjacentElement('afterend', box);
    render(box);
    // keep buttons in sync when the user changes the same things elsewhere
    setInterval(function () { render(box); }, 1000);
  }

  function mountBooster() {
    var first = document.querySelector('app-equipment-shadow');
    if (!first || document.getElementById('booster-set-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'booster-set-btn';
    btn.type = 'button';
    btn.className = 'p-button p-component p-button-sm p-button-outlined';
    btn.style.margin = '4px 0';
    btn.textContent = 'Booster Set';
    btn.onclick = applyBooster;
    first.parentElement.insertAdjacentElement('beforebegin', btn);
  }

  function mount() { mountBooster(); mountToggles(); }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
