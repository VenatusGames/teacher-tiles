import { requireLocalDevelopment } from '@/lib/development-access';
import { getFiles } from '@/db/runtime';

export async function GET(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  const key = new URL(request.url).searchParams.get('key');
  if (!key || !key.startsWith('images/')) return new Response('Not found', { status: 404 });
  const object = await getFiles().get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, no-store');
  return new Response(object.body, { headers });
}
