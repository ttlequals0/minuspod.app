import { expect, test } from 'vitest';
import { assertFullHistory, lastCommitDates } from './git.mjs';

test('assertFullHistory rejects a shallow clone', () => {
  expect(() => assertFullHistory('/main', () => 'true\n')).toThrow(/shallow clone/);
  expect(() => assertFullHistory('/main', () => 'false\n')).not.toThrow();
});

test('lastCommitDates keeps the newest commit day of each file', () => {
  const log = '@2026-11-20\n\ndocs/a.md\nREADME.md\n@2026-11-08\n\ndocs/a.md\ndocs/b.md\n';
  const exec = (cmd, args) => (args.includes('rev-parse') ? 'false\n' : log);
  expect([...lastCommitDates('/main', ['docs'], exec)]).toEqual([
    ['docs/a.md', '2026-11-20'],
    ['README.md', '2026-11-20'],
    ['docs/b.md', '2026-11-08'],
  ]);
});
