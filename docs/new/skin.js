// New-look skin for /new/: theme switch, URL keeper, mobile jump bar. Calculator engine is untouched.
(function () {
  var KEY = 'skinTheme';
  var THEME = { dark: 'assets/layout/styles/theme/lara-dark-blue/theme.css', light: 'new/lara-light-blue.css' };
  var mode = localStorage.getItem(KEY);
  if (mode !== 'dark' && mode !== 'light') mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  function apply(m) {
    mode = m;
    document.documentElement.dataset.skin = m;
    var link = document.getElementById('theme-css');
    if (link && link.getAttribute('href') !== THEME[m]) link.setAttribute('href', THEME[m]);
    var b = document.getElementById('skin-toggle');
    if (b) { b.textContent = m === 'dark' ? '☀️' : '🌙'; b.title = b.ariaLabel = m === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'; }
  }
  apply(mode);

  // Angular's hash router resolves pushed URLs against <base>, which would drop the /new/ path.
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function (state, title, url) {
      if (url != null) {
        var u = new URL(url, document.baseURI);
        if (u.origin === location.origin) { u.pathname = location.pathname; url = u.href; }
      }
      return orig.call(this, state, title, url);
    };
  });

  var GROUPS = [
    ['equip', 'อุปกรณ์', ['weapon', 'leftWeapon', 'shield', 'headUpper', 'headMiddle', 'headLower', 'armor', 'garment', 'boot', 'accRight', 'accLeft', 'pet']],
    ['costume', 'Costume', ['costumeUpper', 'costumeMiddle', 'costumeLower', 'costumeGarment']],
    ['shadow', 'Shadow', ['shadowWeapon', 'shadowArmor', 'shadowShield', 'shadowBoot', 'shadowEarring', 'shadowPendant']],
  ];
  function groupOf(el) {
    if (el.id === 'sk-tabs') return null;
    if (el.querySelector('#booster-set-btn, .item_label_shadow')) return 'shadow';
    if (el.querySelector('.item_label_costume')) return 'costume';
    if (el.classList.contains('ux-heading')) return /Costume/.test(el.textContent) ? 'costume' : /Shadow/.test(el.textContent) ? 'shadow' : 'equip';
    return 'equip';
  }
  function setTab(col7, tab) {
    localStorage.setItem('skinTab', tab);
    col7.dataset.skTab = tab;
    document.querySelectorAll('#sk-tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
  }
  // Three columns: character + consumables | equipment tabs | results. Only our own nodes and the static
  // character card move; Angular-managed lists stay where the app renders them.
  function layout(col7, col5) {
    var side = document.getElementById('sk-side');
    if (!side) {
      side = document.createElement('div');
      side.id = 'sk-side'; side.className = 'col-sk';
      col7.before(side);
    }
    var card = col7.querySelector(':scope > .grid:has(.dropdown-joblist)');
    if (card) { card.classList.add('sk-charcard'); side.prepend(card); }
    var qt = document.getElementById('quick-toggles');
    if (qt && !qt.closest('#sk-side')) {
      var box = document.createElement('div'); box.className = 'sk-card sk-consumable';
      box.append(qt.previousElementSibling, qt); side.appendChild(box);
    }
    compactSide(side);
    if (!document.getElementById('sk-tabs')) {
      var tabs = document.createElement('div');
      tabs.id = 'sk-tabs'; tabs.setAttribute('role', 'tablist');
      GROUPS.forEach(function (g) {
        var b = document.createElement('button');
        b.type = 'button'; b.dataset.tab = g[0]; b.setAttribute('role', 'tab');
        b.innerHTML = '<span></span><small></small>';
        b.firstChild.textContent = g[1];
        b.onclick = function () { setTab(col7, g[0]); col7.scrollTop = 0; };
        tabs.appendChild(b);
      });
      col7.prepend(tabs);
      setTab(col7, localStorage.getItem('skinTab') || 'equip');
      setInterval(function () {
        var c = window.__roCalc; if (!c) return;
        tabs.querySelectorAll('button').forEach(function (b, i) {
          var g = GROUPS[i], n = g[2].filter(function (k) { return Number(c.model[k]) > 0; }).length;
          var t = n + '/' + g[2].length;
          if (b.lastChild.textContent !== t) b.lastChild.textContent = t;
        });
      }, 1000);
    }
    [].forEach.call(col7.children, function (el) { var g = groupOf(el); if (g && el.dataset.skGroup !== g) el.dataset.skGroup = g; });
    if (!document.getElementById('skin-jump')) {
      var nav = document.createElement('nav');
      nav.id = 'skin-jump'; nav.setAttribute('aria-label', 'ไปยังส่วน');
      [['👤 ตัวละคร', '#sk-side'], ['🛡️ อุปกรณ์', 'app-ro-calculator > .grid > .col-7'], ['⚔️ ผลลัพธ์', 'app-ro-calculator > .grid > .col-5']].forEach(function (x) {
        var a = document.createElement('button');
        a.type = 'button'; a.textContent = x[0];
        a.onclick = function () { var t = document.querySelector(x[1]); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        nav.appendChild(a);
      });
      document.body.appendChild(nav);
    }
    var bar = document.querySelector('.layout-topbar'), top = (bar ? bar.offsetHeight : 52) + 'px';
    if (document.documentElement.style.getPropertyValue('--sk-top') !== top) document.documentElement.style.setProperty('--sk-top', top);
  }

  // Rarely used consumables fold away; anything switched on stays visible.
  function compactSide(side) {
    var copy = document.getElementById('copy-equipment');
    if (copy && copy.textContent !== '⧉ Copy') { copy.textContent = '⧉ Copy'; copy.title = 'Copy equipment / stat จาก Preset'; }
    var qt = side.querySelector('#quick-toggles');
    if (!qt) return;
    var btns = [].slice.call(qt.querySelectorAll(':scope > button'));
    var cut = btns.findIndex(function (b) { return b.textContent.trim() === 'ASPD Pot'; });
    btns.forEach(function (b, i) { b.classList.toggle('sk-extra', cut >= 0 && i > cut); });
    var head = qt.previousElementSibling;
    if (head && !document.getElementById('sk-more')) {
      var more = document.createElement('button');
      more.id = 'sk-more'; more.type = 'button';
      more.onclick = function () { localStorage.setItem('skinMore', localStorage.getItem('skinMore') === '1' ? '0' : '1'); compactSide(side); };
      head.lastChild.before(more);
    }
    var open = localStorage.getItem('skinMore') === '1', n = qt.querySelectorAll('.sk-extra').length;
    qt.classList.toggle('sk-collapsed', !open);
    var label = open ? '− ซ่อน' : '+ อื่นๆ (' + n + ')';
    var m = document.getElementById('sk-more');
    if (m && m.textContent !== label) m.textContent = label;
  }

  function mount() {
    var bar = document.querySelector('.layout-topbar');
    if (bar && !document.getElementById('skin-toggle')) {
      var b = document.createElement('button');
      b.id = 'skin-toggle'; b.type = 'button';
      b.onclick = function () { localStorage.setItem(KEY, mode === 'dark' ? 'light' : 'dark'); apply(localStorage.getItem(KEY)); };
      bar.insertBefore(b, bar.querySelector('.layout-topbar-menu'));
      apply(mode);
    }
    var col7 = document.querySelector('app-ro-calculator > .grid > .col-7');
    var col5 = document.querySelector('app-ro-calculator > .grid > .col-5');
    if (col7 && col5) layout(col7, col5);
    // The app re-applies its own theme file after boot; keep ours.
    var link = document.getElementById('theme-css');
    if (link && link.getAttribute('href') !== THEME[mode]) link.setAttribute('href', THEME[mode]);
  }
  document.addEventListener('DOMContentLoaded', function () {
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    mount();
  });
})();
