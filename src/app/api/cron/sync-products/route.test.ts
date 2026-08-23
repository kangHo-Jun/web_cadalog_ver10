import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient } from 'redis';
import apiClient from '@/lib/api-client';

import { GET } from './route';

vi.mock('redis', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  default: { get: vi.fn() },
}));

vi.mock('@/lib/product-utils', async () => (
  import('../../../../lib/product-utils')
));

vi.mock('@/lib/catalog-snapshot', async () => (
  import('../../../../lib/catalog-snapshot')
));

vi.mock('@/config/quote-categories', async () => (
  import('../../../../config/quote-categories')
));

const redisClient = {
  connect: vi.fn(),
  set: vi.fn(),
  quit: vi.fn(),
};

const singleProduct = {
  product_no: 2001,
  product_code: 'P0000SGL',
  product_name: '단일 상품',
  detail_image: 'https://example.test/single.png',
  price: '19700.00',
  options: { has_option: 'F' },
};

const expectedEnvelope = {
  schemaVersion: 2,
  generatedAt: '2026-08-23T03:00:00.000Z',
  groups: {
    P0000SGL: {
      id: 'P0000SGL',
      parentName: '단일 상품',
      detail_image: 'https://example.test/single.png',
      categoryNo: [192],
      children: [{
        name: '단일 상품',
        price: 19700,
        productNo: 2001,
        isSingle: true,
      }],
    },
  },
};

function mockCatalogProduct(product: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation(async (_path, config) => {
    const params = config?.params as { category?: number } | undefined;
    return {
      data: {
        products: params?.category === 192 ? [product] : [],
      },
    } as never;
  });
}

describe('GET /api/cron/sync-products', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T03:00:00.000Z'));
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(createClient).mockReset().mockReturnValue(redisClient as never);
    redisClient.connect.mockReset().mockResolvedValue(undefined);
    redisClient.set.mockReset().mockResolvedValue(undefined);
    redisClient.quit.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists the complete validated envelope and returns generation metadata', async () => {
    mockCatalogProduct(singleProduct);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      products: 1,
      generatedAt: '2026-08-23T03:00:00.000Z',
      schemaVersion: 2,
      debug: 'cron-sync-v2',
    });
    expect(redisClient.set).toHaveBeenCalledWith(
      'catalog:snapshot:v1',
      JSON.stringify(expectedEnvelope),
    );
  });

  it('does not create a Redis client when catalog validation fails', async () => {
    mockCatalogProduct({ ...singleProduct, product_no: undefined });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });
});
