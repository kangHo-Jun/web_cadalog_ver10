import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPriceMap } from '@/lib/price-map';
import { redisGet } from '@/lib/redis-client';

import { GET } from './route';

vi.mock('@/lib/price-map', () => ({
  getPriceMap: vi.fn(),
}));

vi.mock('@/lib/redis-client', () => ({
  redisGet: vi.fn(),
}));

vi.mock('@/lib/catalog-snapshot', async () => (
  import('../../../lib/catalog-snapshot')
));

const groups = {
  P0000HRD: {
    id: 'P0000HRD',
    parentName: 'Parent',
    detail_image: 'https://example.test/hardware.png',
    categoryNo: [223],
    children: [{
      name: 'Child',
      price: 100,
      productNo: 2001,
      variantCode: 'A',
    }],
  },
};

const expectedResponse = {
  A: {
    price: 100,
    prevPrice: 100,
    changeAmount: 0,
    changeDirection: 'same',
    changeRate: 0,
  },
  B: {
    price: 200,
    prevPrice: null,
    changeAmount: null,
    changeDirection: 'none',
    changeRate: null,
  },
  _is_test_period: true,
  _debug: {
    targetMatchesCount: 3,
    sampleMatches: ['Parent', 'Child', 'A'],
    sampleCurrent: ['A', 'B'],
  },
};

describe('GET /api/prices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T03:00:00.000Z'));
    vi.mocked(getPriceMap).mockReset().mockResolvedValue({ A: 100, B: 200 });
    vi.mocked(redisGet).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['legacy raw groups', groups],
    ['a v2 envelope', {
      schemaVersion: 2,
      generatedAt: '2026-03-30T03:00:00.000Z',
      groups,
    }],
  ])('preserves the public price response for %s', async (_label, catalogSnapshot) => {
    vi.mocked(redisGet).mockResolvedValue(catalogSnapshot);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedResponse);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
