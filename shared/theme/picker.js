import { readTheme, resolveMode, writeTheme } from './store.js';

export function initThemePicker(root) {
  const pairButtons = Array.from(root.querySelectorAll('button[data-theme-pair]'));
  const modeButtons = Array.from(root.querySelectorAll('button[data-theme-mode]'));
  const menus = Array.from(root.querySelectorAll('details.theme-pair'));
  if (!pairButtons.length || !modeButtons.length) return;
  const pairIds = Array.from(new Set(pairButtons.map((b) => b.dataset.themePair)));
  const html = document.documentElement;

  const render = ({ pair, mode }) => {
    const chosen = pairButtons.find((b) => b.dataset.themePair === pair);
    const label = chosen.querySelector('.theme-name').textContent;
    pairButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePair === pair)));
    menus.forEach((m) => {
      m.querySelector('[data-theme-pair-name]').textContent = label;
      m.style.setProperty('--theme-accent', chosen.dataset.accent || '');
    });
    html.dataset.pair = pair;
    html.dataset.themeMode = mode;
    html.dataset.theme = resolveMode(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const renderStored = () => render(readTheme(pairIds));
  const pick = (choice) => {
    render(choice);
    writeTheme(choice);
  };
  const closeMenus = () => menus.forEach((m) => (m.open = false));

  renderStored();
  // bfcache restores skip scripts, so re-read the cookie
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) renderStored();
  });
  pairButtons.forEach((b) =>
    b.addEventListener('click', () => {
      pick({ pair: b.dataset.themePair, mode: html.dataset.themeMode });
      closeMenus();
      b.closest('details').querySelector('summary').focus();
    }),
  );
  // as in the app header: the toggle commits the opposite of what is shown
  modeButtons.forEach((b) =>
    b.addEventListener('click', () => pick({ pair: html.dataset.pair, mode: html.dataset.theme === 'dark' ? 'light' : 'dark' })),
  );
  document.addEventListener('click', (e) => menus.forEach((m) => m.open && !m.contains(e.target) && (m.open = false)));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenus());
}
