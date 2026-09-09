import { getFiles } from '@/db/runtime';
import { requireLocalDevelopment } from '@/lib/development-access';

export async function POST(request: Request) {
  const blocked = requireLocalDevelopment();
  if (blocked) return blocked;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return Response.json({ error: 'Choose an image file.' }, { status: 400 });
  }
  if (file.size > 6 * 1024 * 1024) {
    return Response.json({ error: 'Images must be smaller than 6 MB.' }, { status: 400 });
  }

  const key = `images/${crypto.randomUUID()}`;
  await getFiles().put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return Response.json({ key });
}
