import { onRequest } from './functions/api/chat';

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: any) {
    return onRequest({ request, env, next: () => new Response(null, { status: 404 }) });
  },
};
