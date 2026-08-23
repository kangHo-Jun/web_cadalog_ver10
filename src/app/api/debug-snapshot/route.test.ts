import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redisGet } from '@/lib/redis-client';

import { GET } from './route';

vi.mock('@/lib/redis-client', () => ({
  redisGet: vi.fn(),
}));

vi.mock('@/lib/catalog-snapshot', async () => (
  import('../../../lib/catalog-snapshot')
));

describe('GET /api/debug-snapshot', () => {
  beforeEach(() => {
    vi.mocked(redisGet).mockReset();
  });

  it('unwraps v2 groups for lastSnapshot while exposing envelope metadata', async () => {
    vi.mocked(redisGet).mockResolvedValue({
      schemaVersion: 2,
      generatedAt: '2026-08-23T03:00:00.000Z',
      groups: {
        P0000CXG: { id: 'P0000CXG' },
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'OK',
      snapshotSize: 1,
      generatedAt: '2026-08-23T03:00:00.000Z',
      schemaVersion: 2,
      lastSnapshot: { P0000CXG: { id: 'P0000CXG' } },
    });
    expect(body.responseTime).toMatch(/^\d+ms$/);
  });
});
