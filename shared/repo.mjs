export const REPO = 'ttlequals0/MinusPod';
export const REPO_URL = `https://github.com/${REPO}`;

// 537 -> "537", 1234 -> "1.2K"
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCount = (n) => compact.format(n);
