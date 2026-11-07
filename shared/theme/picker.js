import { readTheme, resolveMode, writeTheme } from './store.js';

export function initThemePicker(root) {
  const pairSels = Array.from(root.querySelectorAll('select[data-theme-pair]'));
  const modeSels = Array.from(root.querySelectorAll('select[data-theme-mode]'));
  if (!pairSels.length || !modeSels.length) return;
  const pairIds = Array.from(pairSels[0].options, (o) => o.value);
  const choice = readTheme(pairIds);
  pairSels.forEach((s) => (s.value = choice.pair));
  modeSels.forEach((s) => (s.value = choice.mode));
  document.documentElement.dataset.pair = choice.pair;
  document.documentElement.dataset.themeMode = choice.mode;

  const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => ({ pair: pairSels[0].value, mode: modeSels[0].value });
  const updateDots = () => {
    pairSels.forEach((s) => {
      const accent = s.selectedOptions[0]?.dataset.accent;
      if (accent) s.closest('label')?.style.setProperty('--theme-accent', accent);
    });
  };
  const emit = () => {
    writeTheme(current());
    document.dispatchEvent(new CustomEvent('minuspod-theme', { detail: current() }));
  };

  updateDots();
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
