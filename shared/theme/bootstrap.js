(function () {
  var cookie = '';
  try {
    cookie = document.cookie;
  } catch (e) {
    // cookies blocked: keep the stylesheet defaults
  }
  var name = 'minuspod-theme=';
  var entry = cookie.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s.indexOf(name) === 0; })[0];
  var parts = entry ? entry.slice(name.length).split('.') : [];
  var root = document.documentElement;
  if (parts[0]) root.dataset.pair = parts[0];
  var mode = parts[1] === 'light' || parts[1] === 'dark' ? parts[1] : 'system';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  // dataset.themeMode is the single source of truth; the picker updates it
  root.dataset.themeMode = mode;
  root.dataset.theme = mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
  mq.addEventListener('change', function (e) {
    if (root.dataset.themeMode === 'system') root.dataset.theme = e.matches ? 'dark' : 'light';
  });
})();
