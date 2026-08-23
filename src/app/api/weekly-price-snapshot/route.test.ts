import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redisGet } from '@/lib/redis-client';

import { GET } from './route';

vi.mock('@/lib/redis-client', () => ({
  redisGet: vi.fn(),
}));

const envelope = {
  schemaVersion: 2 as const,
  generatedAt: '2026-08-23T03:00:00.000Z',
  groups: {
    P0000CXG: {
      id: 'P0000CXG',
      parentName: '방염 MDF 9T',
      detail_image: 'https://example.test/mdf.png',
      categoryNo: [326],
      children: [{
        name: '9T',
        price: 28380,
        productNo: 1956,
        variantCode: 'P0000CXG000A',
        customVariantCode: '(2)300SKBMD9',
      }],
    },
  },
};

function request(authorization?: string) {
  return new Request('https://example.test/api/weekly-price-snapshot', {
    headers: authorization ? { authorization } : undefined,
  });
}

describe('GET /api/weekly-price-snapshot', () => {
  beforeEach(() => {
    process.env.WEEKLY_PRICE_SNAPSHOT_SECRET = 'weekly-secret';
    vi.mocked(redisGet).mockReset();
  });

  afterEach(() => {
    delete process.env.WEEKLY_PRICE_SNAPSHOT_SECRET;
  });

  it('fails closed when the bearer secret is not configured', async () => {
    delete process.env.WEEKLY_PRICE_SNAPSHOT_SECRET;

    const response = await GET(request('Bearer weekly-secret'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured' });
  });

  it('rejects a request without a bearer token', async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects a request with the wrong bearer token', async () => {
    const response = await GET(request('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('reports an unavailable snapshot without exposing legacy raw groups', async () => {
    vi.mocked(redisGet).mockResolvedValue(null);

    const response = await GET(request('Bearer weekly-secret'));

    expect(response.status).toBe(503);
  });

  it('rejects a malformed v2 snapshot', async () => {
    vi.mocked(redisGet).mockResolvedValue({
      schemaVersion: 2,
      generatedAt: 'not-a-date',
      groups: {},
    });

    const response = await GET(request('Bearer weekly-secret'));

    expect(response.status).toBe(503);
  });

  it('returns the current v2 envelope as an uncached response', async () => {
    vi.mocked(redisGet).mockResolvedValue(envelope);

    const response = await GET(request('Bearer weekly-secret'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(envelope);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(redisGet).toHaveBeenCalledWith('catalog:snapshot:v1');
  });
});
