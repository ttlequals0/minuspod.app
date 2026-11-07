(function () {
  try {
    var name = 'minuspod-theme=';
    var entry = document.cookie.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s.indexOf(name) === 0; })[0];
    var parts = entry ? entry.slice(name.length).split('.') : [];
    var root = document.documentElement;
    if (parts[0]) root.dataset.pair = parts[0];
    var mode = parts[1];
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var meta = document.querySelector('meta[name="color-scheme"]');
    var apply = function (t) {
      root.dataset.theme = t;
      if (meta) meta.setAttribute('content', t);
    };
    if (mode === 'light' || mode === 'dark') {
      apply(mode);
    } else {
      apply(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', function (e) {
        apply(e.matches ? 'dark' : 'light');
      });
    }
  } catch (e) {}
})();
