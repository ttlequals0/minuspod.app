import { defineConfig } from 'astro/config';
import { LANDING_SITE } from '../shared/social.mjs';

export default defineConfig({
  site: LANDING_SITE,
  // the home page's README code block is styled by site.css
  markdown: { syntaxHighlight: false },
});
