import { GET as syncProducts } from '@/app/api/sync-products/route';

export async function GET() {
  return syncProducts();
}
