import { failure, proxyAuthManagement } from '@plant/server';
export async function POST(request: Request) {
  try {
    return await proxyAuthManagement(request, 'profile');
  } catch (e) {
    return failure(e);
  }
}
