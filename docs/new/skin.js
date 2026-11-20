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

  function mount() {
    var bar = document.querySelector('.layout-topbar');
    if (bar && !document.getElementById('skin-toggle')) {
      var b = document.createElement('button');
      b.id = 'skin-toggle'; b.type = 'button';
      b.onclick = function () { localStorage.setItem(KEY, mode === 'dark' ? 'light' : 'dark'); apply(localStorage.getItem(KEY)); };
      bar.insertBefore(b, bar.querySelector('.layout-topbar-menu'));
      apply(mode);
    }
    var cols = document.querySelectorAll('app-ro-calculator > .grid > [class*="col-"]');
    if (cols.length === 2 && !document.getElementById('skin-jump')) {
      var nav = document.createElement('nav');
      nav.id = 'skin-jump'; nav.setAttribute('aria-label', 'ไปยังส่วน');
      [['🛡️ อุปกรณ์', 0], ['⚔️ ผลลัพธ์', 1]].forEach(function (x) {
        var a = document.createElement('button');
        a.type = 'button'; a.textContent = x[0];
        a.onclick = function () {
          var target = document.querySelectorAll('app-ro-calculator > .grid > [class*="col-"]')[x[1]];
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        nav.appendChild(a);
      });
      document.body.appendChild(nav);
    }
    // Consumable buttons get the full results width instead of the narrow monster column.
    var qt = document.getElementById('quick-toggles'), table = document.querySelector('.battle_summary > .damage_table');
    if (qt && table && qt.parentElement !== table.parentElement) table.before(qt.previousElementSibling, qt);
    // The app re-applies its own theme file after boot; keep ours.
    var link = document.getElementById('theme-css');
    if (link && link.getAttribute('href') !== THEME[mode]) link.setAttribute('href', THEME[mode]);
  }
  document.addEventListener('DOMContentLoaded', function () {
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    mount();
  });
})();
