export function displayName({ label, group }) {
  if (label === 'Default') return group;
  if (group === 'Default' || group === 'Other' || label === group) return label;
  return `${group} ${label}`;
}

export function modeSuffix({ light, dark }) {
  if (light === dark) return '';
  return light ? ' (light only)' : ' (dark only)';
}

export function modeTitle({ light, dark }) {
  if (light === dark) return undefined;
  return light ? 'Dark mode uses the default dark theme' : 'Light mode uses the default light theme';
}
