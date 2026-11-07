import { readTheme, resolveMode, writeTheme } from './store.js';

export function initThemePicker(root) {
  const pairSels = Array.from(root.querySelectorAll('select[data-theme-pair]'));
  const modeSels = Array.from(root.querySelectorAll('select[data-theme-mode]'));
  if (!pairSels.length || !modeSels.length) return;
  const pairIds = Array.from(pairSels[0].options, (o) => o.value);
  const html = document.documentElement;

  const render = ({ pair, mode }) => {
    pairSels.forEach((s) => {
      s.value = pair;
      const accent = s.selectedOptions[0]?.dataset.accent;
      const label = s.closest('label');
      if (accent) label?.style.setProperty('--theme-accent', accent);
      else label?.style.removeProperty('--theme-accent');
    });
    modeSels.forEach((s) => (s.value = mode));
    html.dataset.pair = pair;
    html.dataset.themeMode = mode;
    html.dataset.theme = resolveMode(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const renderStored = () => render(readTheme(pairIds));
  const pick = (choice) => {
    render(choice);
    writeTheme(choice);
  };

  renderStored();
  // bfcache restores skip scripts, so re-read the cookie
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) renderStored();
  });
  pairSels.forEach((sel) => sel.addEventListener('change', () => pick({ pair: sel.value, mode: modeSels[0].value })));
  modeSels.forEach((sel) => sel.addEventListener('change', () => pick({ pair: pairSels[0].value, mode: sel.value })));
}
