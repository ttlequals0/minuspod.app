import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// the header logo leads to the landing page, not the docs index
export const onRequest = defineRouteMiddleware(({ locals }) => {
  locals.starlightRoute.siteTitleHref = 'https://minuspod.app/';
});
