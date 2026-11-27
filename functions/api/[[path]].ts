const API_ORIGIN = 'https://smartboard-api.yk445kauod.workers.dev';

export const onRequest = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);
  const target = new URL(url.pathname.replace(/^\/api/, '') + url.search, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete('host');

  const res = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const out = new Headers(res.headers);
  out.delete('access-control-allow-origin');
  out.delete('access-control-allow-credentials');
  out.delete('access-control-expose-headers');
  return new Response(res.body, { status: res.status, headers: out });
};
