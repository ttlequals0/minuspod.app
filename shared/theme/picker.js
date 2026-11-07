import { readTheme, resolveMode, writeTheme } from './store.js';

export function initThemePicker(root) {
  const pairSel = root.querySelector('select[data-theme-pair]');
  const modeSel = root.querySelector('select[data-theme-mode]');
  if (!pairSel || !modeSel) return;
  const pairIds = Array.from(pairSel.options, (o) => o.value);
  const choice = readTheme(pairIds);
  pairSel.value = choice.pair;
  modeSel.value = choice.mode;

  const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => ({ pair: pairSel.value, mode: modeSel.value });
  const updateDot = () => {
    const accent = pairSel.selectedOptions[0]?.dataset.accent;
    if (accent) pairSel.closest('label')?.style.setProperty('--theme-accent', accent);
  };
  const emit = () => {
    writeTheme(current());
    document.dispatchEvent(new CustomEvent('minuspod-theme', { detail: current() }));
  };

  updateDot();
  pairSel.addEventListener('change', () => {
    document.documentElement.dataset.pair = pairSel.value;
    updateDot();
    emit();
  });
  modeSel.addEventListener('change', () => {
    const resolved = resolveMode(modeSel.value, dark());
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved);
    emit();
  });
}
