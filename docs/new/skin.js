// New-look skin for /new/: theme switch, URL keeper, mobile jump bar. Layout and engine stay native.
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
    if (document.querySelector('app-ro-calculator > .grid > .col-5') && !document.getElementById('skin-jump')) {
      var nav = document.createElement('nav');
      nav.id = 'skin-jump'; nav.setAttribute('aria-label', 'ไปยังส่วน');
      [['🛡️ อุปกรณ์', '.col-7'], ['⚔️ ผลลัพธ์', '.col-5']].forEach(function (x) {
        var a = document.createElement('button');
        a.type = 'button'; a.textContent = x[0];
        a.onclick = function () { var t = document.querySelector('app-ro-calculator > .grid > ' + x[1]); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        nav.appendChild(a);
      });
      document.body.appendChild(nav);
    }
    // The app re-applies its own theme file after boot; keep ours.
    var link = document.getElementById('theme-css');
    if (link && link.getAttribute('href') !== THEME[mode]) link.setAttribute('href', THEME[mode]);
  }
  document.addEventListener('DOMContentLoaded', function () {
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    mount();
  });
})();
