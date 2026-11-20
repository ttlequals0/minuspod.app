import { expect, it } from 'vitest';
import { twinMarkdown } from './twin.mjs';

it('collapses themed image pairs and videos into markdown', () => {
  const body = [
    'Intro.',
    '',
    '<img alt="Flow" src="/images/a-light.svg" class="dark:sl-hidden">',
    '<img alt="Flow" src="/images/a-dark.svg" class="light:sl-hidden">',
    '',
    '<a href="https://minuspod.app/watch/x/" data-video="https://minuspod.app/videos/minuspod-x-landscape.mp4" data-title="X"><img src="https://minuspod.app/videos/x-landscape.jpg" alt="Play video: X" width="1920" height="1080" loading="lazy"></a>',
    '',
    '<img class="w-1" alt="" src="/images/b.png">',
    '',
    'Set `<slug>` here.',
  ].join('\n');
  expect(twinMarkdown('Page', body)).toBe(
    '# Page\n\nIntro.\n\n![Flow](/images/a-light.svg)\n\nVideo: https://minuspod.app/videos/minuspod-x-landscape.mp4\n\n![](/images/b.png)\n\nSet `<slug>` here.',
  );
});
