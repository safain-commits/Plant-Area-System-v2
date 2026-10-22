import { AppError } from '@plant/contracts';
import { failure, proxyAuthManagement } from '@plant/server';
export const dynamic = 'force-dynamic';
async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/');
    if (
      !/^(users|audit|applications|applications\/bag-filter|users\/[a-zA-Z0-9-]{1,36}\/(access|grant|password))$/.test(
        path,
      )
    )
      throw new AppError(404, 'Endpoint tidak tersedia.');
    return await proxyAuthManagement(request, `admin/${path}`);
  } catch (e) {
    return failure(e);
  }
}
export const GET = handler;
export const POST = handler;
