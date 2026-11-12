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

  // Nebula / Snow Flower / Varmundt +10 sets with their main enchant ("<prefix> of <Type>") in slot 1.
  var NSV_PREFIX = { shadowWeapon: 'Nebula', shadowShield: 'Nebula', shadowArmor: 'Snow Flower', shadowBoot: 'Snow Flower', shadowEarring: 'Varmundt', shadowPendant: 'Varmundt' };
  var NSV_ENCH = { Nebula: 'Nebula', 'Snow Flower': 'Snow Flower', Varmundt: 'Bio Energy' };
  function nsv(type) {
    return {
      re: function (k) { return new RegExp('^' + NSV_PREFIX[k] + ' ' + type + ' Shadow'); },
      ench: function (k) { return NSV_ENCH[NSV_PREFIX[k]] + ' of ' + type; },
    };
  }

  function applySet(name, re, refine, ench) {
    run(function (c) {
      var missing = [];
      var enchByName = {};
      if (ench) c.mapEnchant.forEach(function (e) { enchByName[e.name] = e.id; });
      // remember enchants per slot so a set without enchant slots (Booster) doesn't lose them for later sets
      var mem = JSON.parse(localStorage.getItem('shadowEnchMem') || '{}');
      SLOTS.forEach(function (k) {
        var pick = (c[k + 'List'] || []).find(function (o) { return re(k).test(o.label); });
        if (!pick) return missing.push(k);
        var ref = refine == null ? (c.model[k + 'Refine'] || 0) : refine;
        [1, 2, 3].forEach(function (n) {
          var key = k + 'Enchant' + n;
          if (c.model[key]) mem[key] = c.model[key];
          else if (mem[key]) c.model[key] = mem[key]; // the item component drops it again if invalid for the new item
        });
        c.model[k] = pick.value;
        c.model[k + 'Refine'] = ref;
        c.onSelectItem(k, pick.value, ref);
        // bring back the option Booster wiped (see lockBooster)
        var oi = SHADOW_OPT[k], om = JSON.parse(localStorage.getItem('shadowOptMem') || '{}');
        if (!/Booster Shadow/.test(pick.label) && !c.model.rawOptionTxts[oi] && om[oi]) c.model.rawOptionTxts[oi] = om[oi];
        if (ench) {
          var id = enchByName[ench(k)];
          if (!id) return missing.push(k + ' enchant');
          c.model[k + 'Enchant1'] = id;
          c.onSelectItem(k + 'Enchant1', id, ref);
        }
      });
      localStorage.setItem('shadowEnchMem', JSON.stringify(mem));
      if (missing.length) c.messageService.add({ severity: 'warn', summary: 'No ' + name + ' for this class: ' + missing.join(', ') });
    });
  }

  function isSetActive(c, re, refine) {
    return SLOTS.every(function (k) {
      var it = c.items[c.model[k]];
      return it && re(k).test(it.name) && (refine == null || Number(c.model[k + 'Refine']) === refine);
    });
  }

  // --- toggles -------------------------------------------------------------
  // skill: on = highest level in dropdown, off = 0. consumable: model.consumables. aspd: stack selection.
  var TOGGLES = [
    { label: 'Agi Up', skill: 'Cantocandidus' },
    { label: 'Bless', skill: 'Clementia' },
    { label: 'Almighty', consumable: 12883 },
    { label: 'P.Booster', consumable: 14766 },
    { label: 'Unl.Drink', consumable: 23475 },
    { label: 'Conc', aspd: 645 },
    { label: 'Awake', aspd: 656 },
    { label: 'Berserk', aspd: 657 },
    { label: 'Celermine', aspd: 12437 },
    { label: 'ASPD Pot', aspd: 12684 },
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
    box.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:4px 0';
    TOGGLES.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      b.className = 'p-button p-component p-button-sm p-button-outlined';
      b.style.cssText = 'padding:1px 2px;font-size:11px;justify-content:center;white-space:nowrap;overflow:hidden';
      b.textContent = t.label;
      b.onclick = function () { run(function (c) { setOn(c, t, !isOn(c, t)); }); render(box); };
      box.appendChild(b);
    });
    sec.insertAdjacentElement('afterend', box);
    render(box);
    // keep buttons in sync when the user changes the same things elsewhere
    setInterval(function () { render(box); }, 1000);
  }

  // --- debuffs: app's isDebuff skill buffs, mirrored at the top of Battle Summary ----
  var RED = '#f87171', GREEN = '#81c784';
  function mountDebuffs() {
    var bs = document.querySelector('.battle_summary');
    var c = window.__roCalc;
    if (!bs || !c || document.getElementById('debuff-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'debuff-bar';
    bar.className = 'col-12';
    bar.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:2px 0 8px';
    var st = document.createElement('style');
    st.textContent = '.battle_summary > .col-5{padding-right:10px}';
    document.head.appendChild(st);
    var ctrls = [];
    c.skillBuffEntries.filter(function (e) { return e.skill.isDebuff; }).forEach(function (e) {
      var dd = e.skill.dropdown, label = e.skill.label;
      function set(v) { run(function (c) { c.model.skillBuffs[e.index] = v; c.onSkillClassChange(); }); paint(); }
      if (e.skill.inputType === 'selectButton') {
        var yes = dd.find(function (d) { return d.isUse; }).value;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'p-button p-component p-button-sm';
        b.style.cssText = 'width:100%;justify-content:center;padding:4px 6px;font-size:13px;white-space:nowrap;overflow:hidden;border-color:' + RED;
        b.textContent = label;
        b.onclick = function () { set(Number(c.model.skillBuffs[e.index]) > 0 ? 0 : yes); };
        bar.appendChild(b);
        ctrls.push(function (c) {
          var on = Number(c.model.skillBuffs[e.index]) > 0;
          b.style.background = on ? GREEN : 'transparent'; b.style.borderColor = on ? GREEN : RED;
          b.style.color = on ? '#0b1220' : RED;
          b.style.fontWeight = on ? '700' : '';
        });
      } else {
        var s = document.createElement('select');
        s.title = label;
        s.style.cssText = 'width:100%;font-size:13px;padding:4px 4px;background:transparent;border:1px solid ' + RED + ';border-radius:4px;color:' + RED;
        dd.forEach(function (d) {
          var o = document.createElement('option');
          o.value = d.value;
          o.textContent = d.isUse ? label + ' ' + d.label : label;
          o.style.background = '#1f2937'; o.style.color = '#f3f4f6'; o.style.fontSize = '14px';
          s.appendChild(o);
        });
        s.onchange = function () { set(Number(s.value)); };
        bar.appendChild(s);
        ctrls.push(function (c) {
          var v = String(Number(c.model.skillBuffs[e.index]) || 0);
          if (s.value !== v) s.value = v;
          var on = v !== '0';
          s.style.background = on ? GREEN : 'transparent'; s.style.borderColor = on ? GREEN : RED;
          s.style.color = on ? '#0b1220' : RED;
          s.style.fontWeight = on ? '700' : '';
        });
      }
    });
    function paint() { var c = window.__roCalc; if (c) ctrls.forEach(function (f) { f(c); }); }
    bs.insertAdjacentElement('afterbegin', bar);
    paint();
    setInterval(paint, 1000);
  }

  function mountBooster() {
    var first = document.querySelector('app-equipment-shadow');
    if (!first || document.getElementById('booster-set-btn')) return;
    var row = document.createElement('div');
    row.id = 'booster-set-btn';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:4px 0';
    var sets = [['Booster Set', BOOSTER, 0], ['Master +9', MASTER, 9], ['Master +10', MASTER, 10]];
    [['Melee', 'Melee'], ['Magic', 'Magic'], ['Range', 'Range']].forEach(function (t) {
      var x = nsv(t[1]);
      sets.push(['MP ' + t[0] + ' +10', x.re, 10, x.ench, '#60a5fa']);
    });
    var btns = sets.map(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-button p-component p-button-sm p-button-outlined';
      btn.style.cssText = 'white-space:nowrap;width:auto;flex:none';
      btn.textContent = s[0];
      btn.onclick = function () { applySet(s[0], s[1], s[2], s[3]); };
      row.appendChild(btn);
      return btn;
    });
    // active set = filled button (theme green, or blue for MP); inactive = outlined
    function paint() {
      var c = window.__roCalc;
      if (!c) return;
      sets.forEach(function (s, i) {
        var on = isSetActive(c, s[1], s[2]), b = btns[i], col = s[4];
        b.classList.toggle('p-button-outlined', !on);
        b.style.fontWeight = on ? '700' : '';
        b.style.borderColor = col || '';
        b.style.background = on && col ? col : '';
        b.style.color = col ? (on ? '#0b1220' : col) : '';
      });
    }
    paint();
    setInterval(function () { paint(); lockBooster(); }, 500);
    first.parentElement.insertAdjacentElement('beforebegin', row);
  }

  // Booster Shadow items are always +0 with no random option: force it and grey out those controls.
  var SHADOW_OPT = { shadowWeapon: 20, shadowArmor: 21, shadowShield: 22, shadowBoot: 23, shadowEarring: 24, shadowPendant: 25 };
  var DOM_ORDER = ['shadowWeapon', 'shadowShield', 'shadowArmor', 'shadowBoot', 'shadowEarring', 'shadowPendant'];
  function lockBooster() {
    var c = window.__roCalc;
    if (!c) return;
    var rows = document.querySelectorAll('app-equipment-shadow');
    var dirty = false;
    DOM_ORDER.forEach(function (k, i) {
      var it = c.items[c.model[k]];
      var lock = !!it && /Booster Shadow/.test(it.name);
      if (lock && (Number(c.model[k + 'Refine']) || c.model.rawOptionTxts[SHADOW_OPT[k]])) {
        var om = JSON.parse(localStorage.getItem('shadowOptMem') || '{}');
        if (c.model.rawOptionTxts[SHADOW_OPT[k]]) om[SHADOW_OPT[k]] = c.model.rawOptionTxts[SHADOW_OPT[k]];
        localStorage.setItem('shadowOptMem', JSON.stringify(om));
        run(function (c) {
          c.model[k + 'Refine'] = 0;
          c.model.rawOptionTxts[SHADOW_OPT[k]] = null;
          c.onSelectItem(k, c.model[k], 0);
        });
        dirty = true;
      }
      var row = rows[i];
      if (!row) return;
      var ctl = [row.querySelectorAll('p-dropdown')[1], row.querySelector('p-cascadeselect')];
      ctl.forEach(function (el) {
        if (!el) return;
        el.style.pointerEvents = lock ? 'none' : '';
        el.style.opacity = lock ? '0.35' : '';
      });
    });
    if (dirty) run(function (c) { c.updateItemEvent.next(1); });
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

  function mount() { mountBooster(); mountToggles(); mountDebuffs(); hookCompare(); mountDupCheckbox(); }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
