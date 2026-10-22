export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const r = await fetch(`${process.env.AUTH_INTERNAL_URL}/auth/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw Error();
    return Response.json({ status: 'ready' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
