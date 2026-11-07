import { readTheme, resolveMode, writeTheme } from './store.js';

export function initThemePicker(root) {
  const pairSels = Array.from(root.querySelectorAll('select[data-theme-pair]'));
  const modeSels = Array.from(root.querySelectorAll('select[data-theme-mode]'));
  if (!pairSels.length || !modeSels.length) return;
  const pairIds = Array.from(pairSels[0].options, (o) => o.value);

  const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => ({ pair: pairSels[0].value, mode: modeSels[0].value });
  const updateDots = () => {
    pairSels.forEach((s) => {
      const accent = s.selectedOptions[0]?.dataset.accent;
      const label = s.closest('label');
      if (accent) label?.style.setProperty('--theme-accent', accent);
      else label?.style.removeProperty('--theme-accent');
    });
  };
  const emit = () => {
    writeTheme(current());
    document.dispatchEvent(new CustomEvent('minuspod-theme', { detail: current() }));
  };

  const apply = () => {
    const choice = readTheme(pairIds);
    const root = document.documentElement;
    const resolved = resolveMode(choice.mode, dark());
    pairSels.forEach((s) => (s.value = choice.pair));
    modeSels.forEach((s) => (s.value = choice.mode));
    root.dataset.pair = choice.pair;
    root.dataset.themeMode = choice.mode;
    root.dataset.theme = resolved;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved);
    updateDots();
  };

  apply();
  // bfcache restores skip scripts, so re-read the cookie
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) apply();
  });
  pairSels.forEach((sel) =>
    sel.addEventListener('change', () => {
      pairSels.forEach((s) => (s.value = sel.value));
      document.documentElement.dataset.pair = sel.value;
      updateDots();
      emit();
    }),
  );
  modeSels.forEach((sel) =>
    sel.addEventListener('change', () => {
      modeSels.forEach((s) => (s.value = sel.value));
      const resolved = resolveMode(sel.value, dark());
      document.documentElement.dataset.themeMode = sel.value;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved);
      emit();
    }),
  );
}
