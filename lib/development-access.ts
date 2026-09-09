// Temporary development restriction, not authentication.
// Replace with verified Firebase authorization before enabling hosted data access.
export function requireLocalDevelopment() {
  if (import.meta.env.DEV) return null;
  return Response.json({ error: 'Sign-in is not configured yet.' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
