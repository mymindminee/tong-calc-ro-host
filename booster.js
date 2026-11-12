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
    { label: 'VIP', skill: 'VIP' },
    { label: 'Agi Up', skill: 'Cantocandidus' },
    { label: 'Bless', skill: 'Clementia' },
    { label: 'Myst.Amp', skill: 'Mystical Amplification' },
    { label: 'Spell Ench', skill: 'Spell Enchanting' },
    { label: 'Almighty', consumable: 12883 },
    { label: 'P.Booster', consumable: 14766 },
    { label: 'Unl.Drink', consumable: 23475 },
    { label: 'All-in-One', allInOne: true },
    { label: 'Awake', aspd: 656 },
    { label: 'Berserk', aspd: 657 },
    { label: 'Celermine', aspd: 12437 },
    { label: 'ASPD Pot', aspd: 12684 },
  ];

  function entry(c, name) {
    return (c.skillBuffEntries || []).find(function (e) { return e.skill.name === name; });
  }
  function isOn(c, t) {
    if (t.allInOne) return localStorage.getItem('allInOneOn') === '1';
    if (t.skill) { var e = entry(c, t.skill); return !!e && Number(c.model.skillBuffs[e.index]) > 0; }
    if (t.consumable) return (c.model.consumables || []).map(Number).indexOf(t.consumable) >= 0;
    return (c.model.aspdPotions || []).map(Number).indexOf(t.aspd) >= 0;
  }
  function setOn(c, t, on) {
    if (t.allInOne) {
      localStorage.setItem('allInOneOn', on ? '1' : '0');
      var ids = c.allInOneConsumableIds || [];
      c.model.consumables = c.normalizeIdList((c.model.consumables || []).filter(function (id) { return ids.indexOf(Number(id)) < 0; }).concat(on ? ids : []));
      return c.onConsumableChange();
    }
    if (localStorage.getItem('allInOneOn') === '1' && (c.allInOneConsumableIds || []).indexOf(t.consumable) >= 0) return;
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
      var t = TOGGLES[b.dataset.i];
      var locked = localStorage.getItem('allInOneOn') === '1' && (c.allInOneConsumableIds || []).indexOf(t.consumable) >= 0;
      b.disabled = locked;
      b.style.opacity = locked ? '0.35' : '';
      b.title = locked ? 'Included in All-in-One (no stacking)' : t.label;
      b.classList.toggle('p-button-outlined', locked || !isOn(c, t));
    });
    box.querySelectorAll('select[data-i]').forEach(function (s) {
      var t = TOGGLES[s.dataset.i], e = entry(c, t.skill);
      if (!e) return;
      var v = Number(c.model.skillBuffs[e.index]) || 0;
      s.value = String(v);
      s.style.background = v ? '#81c784' : '#1f2937';
      s.style.color = v ? '#0b1220' : '#81c784';
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
      if (t.skill && entry(window.__roCalc, t.skill).skill.inputType === 'dropdown') {
        var e = entry(window.__roCalc, t.skill);
        if (!e) return;
        var sel = document.createElement('select');
        sel.dataset.i = i;
        sel.title = e.skill.label;
        sel.setAttribute('aria-label', e.skill.label);
        sel.style.cssText = 'width:100%;min-width:0;padding:1px 2px;font-size:11px;border:1px solid #81c784;border-radius:3px';
        e.skill.dropdown.forEach(function (d) {
          var o = document.createElement('option');
          o.value = d.value;
          o.textContent = (t.skill === 'Cantocandidus' ? 'Agi' : t.label) + ' ' + String(d.label).replace(/^(Lv\.?|Job)\s+/i, '');
          o.style.cssText = 'background:#1f2937;color:#f3f4f6;font-size:14px';
          sel.appendChild(o);
        });
        sel.onchange = function () {
          run(function (c) { var current = entry(c, t.skill); if (current) { c.model.skillBuffs[current.index] = Number(sel.value); c.onSkillClassChange(); } });
          render(box);
        };
        box.appendChild(sel);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      b.className = 'p-button p-component p-button-sm p-button-outlined';
      b.style.cssText = 'padding:1px 2px;font-size:11px;justify-content:center;white-space:nowrap;overflow:hidden';
      b.textContent = t.label;
      var itemId = t.consumable || t.aspd || (t.allInOne ? 100906 : null);
      if (itemId) {
        var img = document.createElement('img');
        img.src = t.allInOne ? 'https://static.divine-pride.net/images/items/item/' + itemId + '.png' : 'assets/demo/images/items/' + itemId + '.png';
        img.alt = '';
        img.width = 16; img.height = 16;
        img.style.cssText = 'object-fit:contain;flex:none;margin-right:3px';
        img.onerror = function () { img.hidden = true; };
        b.prepend(img);
        b.style.minHeight = '22px';
      }
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
  function mountDebuffs(active) {
    var bs = document.querySelector('.battle_summary');
    var c = window.__roCalc;
    if (!bs || !c) return;
    var id = active ? 'active-skill-bar' : 'debuff-bar';
    var signature = active ? c.selectedCharacter.className : 'debuff';
    var old = document.getElementById(id);
    if (old && old.dataset.signature === signature) return;
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = id; bar.dataset.signature = signature;
    bar.className = 'col-12';
    bar.style.cssText = 'display:grid;grid-template-columns:repeat(' + (active ? 4 : 6) + ',minmax(0,1fr));gap:4px;padding:2px 0 8px';
    var st = document.createElement('style');
    st.textContent = '.battle_summary > .col-5{padding-right:10px}';
    document.head.appendChild(st);
    var ctrls = [];
    var heading = document.createElement('strong');
    heading.textContent = active ? 'สกิล / เอฟเฟกต์ที่ใช้งาน' : 'Debuff';
    heading.style.cssText = 'grid-column:1/-1;font-size:12px';
    bar.appendChild(heading);
    var entries = active ? (c.selectedCharacter.activeSkills || []).map(function (s, i) { return {skill:s,index:i}; }) : c.skillBuffEntries.filter(function (e) { return e.skill.isDebuff; });
    var elements = ['Lightning Loader', 'Flame Launcher', 'Frost Weapon', 'Seismic Weapon'];
    var elementColors = ['#81c784', '#ff8055', '#69c9ff', '#d69a57'];
    if (active) entries = entries.filter(function (e) { return e.skill.name !== 'Skill Version'; }).sort(function (a, b) {
      var ai = elements.indexOf(a.skill.name), bi = elements.indexOf(b.skill.name);
      return (ai < 0 ? 4 + a.index : ai) - (bi < 0 ? 4 + b.index : bi);
    });
    var field = active ? 'activeSkills' : 'skillBuffs';
    entries.forEach(function (e) {
      var dd = e.skill.dropdown, label = e.skill.label;
      var ei = elements.indexOf(e.skill.name);
      var idle = active ? (ei < 0 ? '#b8c4ef' : elementColors[ei]) : RED;
      var selected = active ? '#60a5fa' : GREEN;
      var base = active ? '#29354a' : 'transparent';
      function set(v) { run(function (c) { c.model[field][e.index] = v; c.onSkillClassChange(); }); paint(); }
      if (e.skill.inputType === 'selectButton') {
        var yes = dd.find(function (d) { return d.isUse; }).value;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'p-button p-component p-button-sm';
        b.style.cssText = 'width:100%;justify-content:center;padding:4px 6px;font-size:13px;white-space:nowrap;overflow:hidden;border-color:' + RED;
        b.textContent = label; b.title = label;
        if (active) b.style.cssText += ';padding:3px 5px;font-size:12px;min-height:27px;border-radius:4px';
        b.onclick = function () { set(Number(c.model[field][e.index]) > 0 ? 0 : yes); };
        bar.appendChild(b);
        ctrls.push(function (c) {
          var on = Number(c.model[field][e.index]) > 0;
          b.style.background = on ? selected : base; b.style.borderColor = on ? selected : idle;
          b.style.color = on ? '#0b1220' : idle;
          b.style.fontWeight = on ? '700' : '';
        });
      } else {
        var s = document.createElement('select');
        s.title = label;
        s.style.cssText = 'width:100%;font-size:13px;padding:4px 4px;background:transparent;border:1px solid ' + RED + ';border-radius:4px;color:' + RED;
        if (active) s.style.cssText += ';padding:3px 5px;font-size:12px;min-height:27px';
        dd.forEach(function (d) {
          var o = document.createElement('option');
          o.value = d.value;
          o.textContent = label + ' ' + d.label;
          o.style.background = '#1f2937'; o.style.color = '#f3f4f6'; o.style.fontSize = '14px';
          s.appendChild(o);
        });
        s.onchange = function () { set(Number(s.value)); };
        bar.appendChild(s);
        ctrls.push(function (c) {
          var v = String(Number(c.model[field][e.index]) || 0);
          if (s.value !== v) s.value = v;
          var on = v !== '0';
          s.style.background = on ? selected : base; s.style.borderColor = on ? selected : idle;
          s.style.color = on ? '#0b1220' : idle;
          s.style.fontWeight = on ? '700' : '';
        });
      }
    });
    function paint() { var c = window.__roCalc; if (c) ctrls.forEach(function (f) { f(c); }); }
    if (active && document.getElementById('debuff-bar')) bs.insertBefore(bar, document.getElementById('debuff-bar'));
    else bs.insertAdjacentElement('afterbegin', bar);
    paint();
    var timer = setInterval(function () { if (!bar.isConnected) return clearInterval(timer); paint(); }, 1000);
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
      sets.push(['MP ' + t[0] + ' +10', x.re, 10, x.ench, { Melee: '#f87171', Magic: '#60a5fa', Range: '#81c784' }[t[0]]]);
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

  function hookAllInOne() {
    var c = window.__roCalc;
    if (!c || c.__aioHooked) return;
    c.__aioHooked = true;
    var orig = c.onConsumableChange.bind(c);
    c.onConsumableChange = function () {
      if (localStorage.getItem('allInOneOn') === '1') c.model.consumables = c.normalizeIdList((c.model.consumables || []).concat(c.allInOneConsumableIds || []));
      return orig();
    };
    if (localStorage.getItem('allInOneOn') === '1') c.onConsumableChange();
  }

  // Use the calculator's native final damage multiplier, scoped to Training Dummy only.
  function mountDummyDamage() {
    var c = window.__roCalc;
    if (!c) return;
    if (!c.__dummyDamageHook) {
      c.__dummyDamageHook = true;
      var apply = c.applyCustomMonsterStats.bind(c);
      c.applyCustomMonsterStats = function () {
        var result = apply();
        var monster = c.monsterDataMap[c.selectedMonster];
        if (monster && /DUMMY/i.test(monster.dbname || '')) {
          var saved = Number(localStorage.getItem('dummyDamage:' + c.selectedMonster));
          if ([100, 10, 1, 0.1].indexOf(saved) >= 0) monster.stats.dmgtaken = saved;
        }
        return result;
      };
      c.applyCustomMonsterStats();
    }
    if (document.getElementById('dummy-damage')) return;
    var label = Array.from(document.querySelectorAll('.battle_summary div')).find(function (el) {
      return Array.from(el.childNodes).some(function (n) { return n.nodeType === 3 && /Dmg\.Taken/.test(n.textContent); });
    });
    if (!label) return;
    var select = document.createElement('select');
    select.id = 'dummy-damage';
    select.setAttribute('aria-label', 'Dummy damage taken');
    select.title = 'Damage received by Training Dummy';
    select.style.cssText = 'margin-left:4px;background:#1f2937;color:#81c784;border:1px solid #64748b;border-radius:3px;font-size:12px';
    [['100/100',100],['1/10',10],['1/100',1],['1/1000',0.1]].forEach(function (pair) {
      var option = document.createElement('option'); option.textContent = pair[0]; option.value = pair[1]; select.appendChild(option);
    });
    select.onchange = function () {
      var value = Number(select.value);
      if ([100,10,1,0.1].indexOf(value) < 0) return;
      localStorage.setItem('dummyDamage:' + c.selectedMonster, String(value));
      run(function (c) { c.onCustomMonsterStatsChange(); });
    };
    label.appendChild(select);
    function sync() {
      var monster = c.monsterDataMap[c.selectedMonster];
      select.hidden = !monster || !/DUMMY/i.test(monster.dbname || '');
      if (!select.hidden) select.value = String(monster.stats.dmgtaken > 0 ? monster.stats.dmgtaken : 100);
    }
    sync();
    var timer = setInterval(function () { if (!select.isConnected) return clearInterval(timer); sync(); }, 500);
  }

  // Keep same-class set switching intact, but never restore another class's shadow options.
  function hookShadowClassChange() {
    var c = window.__roCalc;
    if (!c || c.__shadowClassHook) return;
    c.__shadowClassHook = true;
    var previous = c.selectedCharacter && c.selectedCharacter.className;
    var original = c.setClassInstant.bind(c);
    c.setClassInstant = function () {
      var result = original();
      var next = c.selectedCharacter && c.selectedCharacter.className;
      if (previous && next && next !== previous) {
        localStorage.removeItem('shadowEnchMem');
        localStorage.removeItem('shadowOptMem');
        [c.model, c.model2].forEach(function (model) {
          if (!model) return;
          SLOTS.forEach(function (slot) {
            [1, 2, 3].forEach(function (n) { model[slot + 'Enchant' + n] = null; });
            if (model.rawOptionTxts) model.rawOptionTxts[SHADOW_OPT[slot]] = null;
          });
        });
        SLOTS.forEach(function (slot) {
          [1, 2, 3].forEach(function (n) {
            if (c.equipItemMap) c.equipItemMap.delete(slot + 'Enchant' + n);
            if (c.equipCompareItemIdItemTypeMap) c.equipCompareItemIdItemTypeMap.delete(slot + 'Enchant' + n);
          });
        });
      }
      previous = next;
      return result;
    };
  }

  // Read-only preset import: merge checked, class-compatible wearable slots only.
  function mountCopyEquipment() {
    var preset = document.querySelector('p-dropdown[placeholder="Presets"]');
    if (!preset || document.getElementById('copy-equipment')) return;
    var button = document.createElement('button');
    button.id = 'copy-equipment'; button.type = 'button';
    button.className = 'p-button p-component p-button-sm p-button-outlined';
    button.textContent = 'Copy equipment'; button.style.cssText = 'width:auto;margin:3px 0;padding:4px 8px';
    preset.parentElement.insertAdjacentElement('afterend', button);
    button.onclick = function () {
      var existing = document.getElementById('copy-equipment-dialog');
      if (existing) { if (existing.open) return existing.focus(); existing.remove(); }
      var c = window.__roCalc, choices = c.preSets || [];
      if (!choices.length) return c.messageService.add({severity:'warn',summary:'ยังไม่มี Preset ให้คัดลอก'});
      var dialog = document.createElement('dialog'); dialog.id = 'copy-equipment-dialog';
      dialog.style.cssText = 'background:#1f2937;color:#e5e7eb;border:1px solid #64748b;border-radius:6px;width:600px;max-width:92vw;max-height:85vh;padding:14px';
      var title = document.createElement('h3'); title.textContent = 'คัดลอกเฉพาะของสวมใส่'; title.style.margin = '0 0 8px';
      var note = document.createElement('p'); note.textContent = 'เลือก Preset และช่องที่จะนำมา • ข้ามของที่อาชีพปัจจุบันใส่ไม่ได้ • ไม่เปลี่ยนอาชีพ สเตตัส สกิล หรือยา'; note.style.fontSize = '12px';
      var select = document.createElement('select'); select.setAttribute('aria-label','Preset ต้นทาง'); select.style.cssText = 'width:100%;padding:6px;background:#111827;color:#e5e7eb;border:1px solid #64748b';
      choices.forEach(function (p) { var o = document.createElement('option'); o.value = p.value; o.textContent = p.label; select.appendChild(o); });
      if (choices.some(function (p) { return String(p.value) === String(c.selectedPreset); })) select.value = c.selectedPreset;
      var list = document.createElement('div'); list.style.cssText = 'display:grid;gap:5px;padding:10px 0;max-height:52vh;overflow:auto';
      var status = document.createElement('p'); status.setAttribute('role','status'); status.style.fontSize = '12px';
      var apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'คัดลอกช่องที่เลือก'; apply.className = 'p-button p-component p-button-sm';
      var close = document.createElement('button'); close.type = 'button'; close.textContent = 'ยกเลิก'; close.className = 'p-button p-component p-button-sm p-button-outlined'; close.style.marginLeft = '8px'; close.onclick = function () { dismiss(); };
      function dismiss() { dialog.close(); dialog.remove(); button.focus(); }
      dialog.addEventListener('cancel',function (event) { event.preventDefault(); dismiss(); });
      dialog.addEventListener('close',function () { dialog.remove(); });
      dialog.append(title,note,select,list,status,apply,close); document.body.appendChild(dialog); dialog.showModal();
      var source, destinationClass, rows = [], request = 0;
      var aliases = {costumeEnchantUpper:'costumeEnhUpperList',costumeEnchantUpper2:'costumeEnhUpper2List',costumeEnchantUpper3:'costumeEnhUpper3List',costumeEnchantMiddle:'costumeEnhMiddleList',costumeEnchantLower:'costumeEnhLowerList',costumeEnchantGarment:'costumeEnhGarmentList',costumeEnchantGarment2:'costumeEnhGarment2List',costumeEnchantGarment4:'costumeEnhGarment4List'};
      var slots = ['weapon','leftWeapon','ammo','shield','headUpper','headMiddle','headLower','armor','garment','boot','accRight','accLeft','costumeUpper','costumeMiddle','costumeLower','costumeGarment'].concat(c.compareItemList.filter(function (k) { return /^costumeEnchant|^shadow/.test(k); }));
      function allowed(slot,id) { return (c[aliases[slot] || slot+'List'] || []).some(function (o) { return Number(o.value) === Number(id); }); }
      function properties(slot) { return [slot,slot+'Refine',slot+'Grade',slot+'Card'].concat([1,2,3,4].map(function (n) { return slot+'Card'+n; }),[0,1,2,3].map(function (n) { return slot+'Enchant'+n; })); }
      function show(model) {
        if (typeof model === 'string') model = JSON.parse(model);
        if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('Preset ไม่มีข้อมูลอุปกรณ์');
        source = JSON.parse(JSON.stringify(model)); destinationClass = c.model.class; rows = []; list.replaceChildren();
        slots.forEach(function (slot) {
          var id = Number(source[slot]); if (!Number.isInteger(id) || id <= 0) return;
          var item = c.items[id], ok = !!item && allowed(slot,id);
          var row = document.createElement('label'); row.style.cssText = 'display:flex;gap:6px;align-items:center;font-size:12px;opacity:'+(ok?'1':'0.5');
          var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ok; cb.disabled = !ok; cb.dataset.slot = slot;
          var text = document.createElement('span'); text.textContent = slot+': '+(source[slot+'Refine']?'+'+source[slot+'Refine']+' ':'')+(item?item.name:'#'+id)+(ok?'':' — ข้าม: อาชีพนี้ใส่ไม่ได้/ไม่มีในรายการ');
          row.append(cb,text); list.appendChild(row); rows.push({slot:slot,id:id,cb:cb});
        });
        status.textContent = 'ติ๊กเฉพาะช่องที่จะนำมา ช่องที่ไม่เลือกจะคงของเดิม'; apply.disabled = !rows.some(function (r) { return !r.cb.disabled; });
      }
      function load() {
        var token = ++request; source = null; apply.disabled = true; list.replaceChildren(); status.textContent = 'กำลังอ่าน Preset…';
        function fail(error) { if (token === request && dialog.isConnected) status.textContent = 'อ่าน Preset ไม่สำเร็จ: '+String(error.message || error); }
        function accept(model) { if (token !== request || !dialog.isConnected) return; try { show(model); } catch (error) { fail(error); } }
        try {
          if (c.isLoggedIn) {
            var found = choices.find(function (p) { return String(p.value) === select.value; });
            run(function () { c.presetService.getPreset(found.value).subscribe({next:function (p) { accept(p.model); },error:fail}); });
          } else {
            var found = c.getPresetList().find(function (p) { return String(p.value) === select.value; });
            if (!found) throw new Error('ไม่พบ Preset'); accept(found.model);
          }
        } catch (error) { fail(error); }
      }
      select.onchange = load;
      apply.onclick = function () {
        if (!source) return;
        if (c.model.class !== destinationClass) { status.textContent = 'อาชีพเปลี่ยนแล้ว กรุณาเลือก Preset ใหม่'; apply.disabled = true; return; }
        var chosen = rows.filter(function (r) { return r.cb.checked && !r.cb.disabled && allowed(r.slot,r.id); });
        if (!chosen.length) { status.textContent = 'กรุณาเลือกอย่างน้อยหนึ่งช่อง'; return; }
        var merged = JSON.parse(JSON.stringify(c.model));
        chosen.forEach(function (r) {
          properties(r.slot).forEach(function (key) { merged[key] = Object.prototype.hasOwnProperty.call(source,key) ? source[key] : null; });
          (OPT[r.slot] || (r.slot === 'leftWeapon' ? [3,4,5] : [])).forEach(function (i) { merged.rawOptionTxts[i] = (source.rawOptionTxts || [])[i] || null; });
        });
        // Native loading prefers named maps; rebuild from current skill arrays to retain buffs.
        [['skillBuffs',c.skillBuffs,'skillBuffMap'],['activeSkills',c.selectedCharacter.activeSkills,'activeSkillMap'],['passiveSkills',c.selectedCharacter.passiveSkills,'passiveSkillMap']].forEach(function (group) {
          merged[group[2]] = {}; (group[1] || []).forEach(function (skill,i) { merged[group[2]][skill.name] = (c.model[group[0]] || [])[i] || 0; });
        });
        apply.disabled = true; select.disabled = true; status.textContent = 'กำลังคัดลอกอุปกรณ์…';
        run(function () { c.loadItemSet(merged).subscribe({next:function () {
          if (!dialog.isConnected) return;
          c.messageService.add({severity:'success',summary:'คัดลอกอุปกรณ์แล้ว '+chosen.length+' ช่อง'}); dismiss();
        },error:function (error) { status.textContent = 'คัดลอกไม่สำเร็จ: '+String(error.message || error); apply.disabled = false; select.disabled = false; }}); });
      };
      load();
    };
  }

  function mount() { hookShadowClassChange(); mountBooster(); mountToggles(); mountDebuffs(); mountDebuffs(true); mountDummyDamage(); hookAllInOne(); hookCompare(); mountDupCheckbox(); mountCopyEquipment(); }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
})();
