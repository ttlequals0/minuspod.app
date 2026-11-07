export function displayName({ label, group }) {
  if (label === 'Default') return group;
  if (group === 'Default' || group === 'Other' || label === group) return label;
  return `${group} ${label}`;
}

export function modeSuffix({ light, dark }) {
  if (!light) return ' (dark only)';
  if (!dark) return ' (light only)';
  return '';
}

export function modeTitle({ light, dark }) {
  if (!light) return 'Light mode uses the default light theme';
  if (!dark) return 'Dark mode uses the default dark theme';
  return undefined;
}
