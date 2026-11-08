import { negotiate, pageHeaders } from '../shared/worker/agent.mjs';

export default {
  async fetch(request, env) {
    return (await negotiate(request, env)) ?? pageHeaders(await env.ASSETS.fetch(request), new URL(request.url).pathname, request.headers.get('Accept'));
  },
};
