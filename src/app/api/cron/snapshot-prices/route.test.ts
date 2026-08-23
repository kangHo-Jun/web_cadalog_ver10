import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redisGet, redisSet } from '@/lib/redis-client';

import { GET } from './route';

vi.mock('@/lib/redis-client', () => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock('@/lib/catalog-snapshot', async () => (
  import('../../../../lib/catalog-snapshot')
));

const groups = {
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
};

describe('GET /api/cron/snapshot-prices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T03:00:00.000Z'));
    delete process.env.CRON_SECRET;
    vi.mocked(redisGet).mockReset();
    vi.mocked(redisSet).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['legacy raw groups', groups],
    ['a v2 envelope', {
      schemaVersion: 2,
      generatedAt: '2026-08-23T03:00:00.000Z',
      groups,
    }],
  ])('preserves the daily price snapshot for %s', async (_label, catalogSnapshot) => {
    vi.mocked(redisGet).mockResolvedValue(catalogSnapshot);

    const response = await GET(new Request('https://example.test/api/cron/snapshot-prices'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      key: 'price_snapshot:2026-08-23',
      count: 1,
    });
    expect(redisSet).toHaveBeenCalledWith(
      'price_snapshot:2026-08-23',
      { P0000CXG000A: 28380 },
      { EX: 60 * 24 * 60 * 60 },
    );
  });
});
