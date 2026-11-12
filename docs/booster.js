// Overlay: "Booster Set" button above shadow slots + quick buff/potion toggles under the monster image.
// Relies on window.__roCalc exposed by patch.sh.
(function () {
  var SLOTS = ['shadowWeapon', 'shadowArmor', 'shadowShield', 'shadowBoot', 'shadowEarring', 'shadowPendant'];

  function run(fn) {
    var c = window.__roCalc;
    if (!c) return;
    getAllAngularTestabilities()[0]._ngZone.run(function () { fn(c); });
  }

  // Lists <slot>List are already filtered by the selected class, so class lock comes for free.
  var BOOSTER = function () { return /Booster Shadow/; };
  var MASTER = function (k) {
    return k === 'shadowWeapon' ? /^Master Shadow Weapon$/ : k === 'shadowShield' ? /^Master Shadow Shield$/ : /^M\. .*Shadow/;
  };

  function applySet(name, re, refine) {
    run(function (c) {
      var missing = [];
      SLOTS.forEach(function (k) {
        var pick = (c[k + 'List'] || []).find(function (o) { return re(k).test(o.label); });
        if (!pick) return missing.push(k);
        var ref = refine == null ? (c.model[k + 'Refine'] || 0) : refine;
        c.model[k] = pick.value;
        c.model[k + 'Refine'] = ref;
        c.onSelectItem(k, pick.value, ref);
      });
      if (missing.length) c.messageService.add({ severity: 'warn', summary: 'No ' + name + ' for this class: ' + missing.join(', ') });
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
    var row = document.createElement('div');
    row.id = 'booster-set-btn';
    row.style.cssText = 'display:flex;gap:4px;margin:4px 0';
    [['Booster Set', BOOSTER, null], ['Master +9', MASTER, 9], ['Master +10', MASTER, 10]].forEach(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-button p-component p-button-sm p-button-outlined';
      btn.style.whiteSpace = 'nowrap';
      btn.textContent = s[0];
      btn.onclick = function () { applySet(s[0], s[1], s[2]); };
      row.appendChild(btn);
    });
    first.parentElement.insertAdjacentElement('beforebegin', row);
  }

  // --- compare: duplicate main item into the compare row when a slot is enabled ----
  var OPT = { weapon: [0,1,2], shield: [6,7], headUpper: [8,9], headMiddle: [10,11,29], headLower: [30,31,32],
    armor: [12,13,28], garment: [14,15], accRight: [16,17], accLeft: [18,19], shadowWeapon: [20], shadowArmor: [21],
    shadowShield: [22], shadowBoot: [23], shadowEarring: [24], shadowPendant: [25] };
  var DUP_KEY = 'dupCompare';
  function dupEnabled() { return localStorage.getItem(DUP_KEY) !== '0'; }

  function copySlot(c, slot) {
    var m = c.model, m2 = c.model2;
    if (slot === 'runeTablet') { m2.selectedRunes = (m.selectedRunes || []).slice(0, 1); return; }
    if (!m[slot]) return;
    Object.keys(m).forEach(function (k) {
      // slot itself + its refine/grade/cards/enchants (keys prefixed by the slot name)
      if (k === slot || (k.indexOf(slot) === 0 && /^(Refine|Grade|Card\d*|Enchant\d*)$/.test(k.slice(slot.length)))) m2[k] = m[k];
    });
    if (slot === 'weapon') m2.ammo = m.ammo;
    m2.rawOptionTxts = m2.rawOptionTxts || [];
    (OPT[slot] || []).forEach(function (i) { m2.rawOptionTxts[i] = (m.rawOptionTxts || [])[i]; });
  }

  var prevCompare = [];
  function hookCompare() {
    var c = window.__roCalc;
    if (!c || c.__dupHooked) return;
    c.__dupHooked = true;
    var orig = c.onListItemComparingChange.bind(c);
    c.onListItemComparingChange = function (clear) {
      var names = clear ? [] : (c.compareItemNames || []);
      var added = dupEnabled() ? names.filter(function (n) { return prevCompare.indexOf(n) < 0 && !c.model2[n]; }) : [];
      added.forEach(function (n) { copySlot(c, n); });
      prevCompare = names.slice();
      var r = orig(clear);
      // the compare row only computes card/option slots on an itemList change, so bump the
      // list reference after the row has rendered (app debounces compare render by 250ms)
      if (added.length) setTimeout(function () {
        run(function (c) { added.forEach(function (n) { if (Array.isArray(c[n + 'List'])) c[n + 'List'] = c[n + 'List'].slice(); }); });
      }, 500);
      return r;
    };
  }

  function mountDupCheckbox() {
    var wrap = document.querySelector('.item_label_compare');
    if (!wrap || document.getElementById('dup-compare')) return;
    var lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;margin-bottom:2px;cursor:pointer';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = 'dup-compare'; cb.checked = dupEnabled();
    cb.onchange = function () { localStorage.setItem(DUP_KEY, cb.checked ? '1' : '0'); };
    lbl.appendChild(cb); lbl.appendChild(document.createTextNode('Duplicate item to compare (same item / refine / cards / options)'));
    wrap.insertAdjacentElement('afterbegin', lbl);
  }

  function mount() { mountBooster(); mountToggles(); hookCompare(); mountDupCheckbox(); }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
