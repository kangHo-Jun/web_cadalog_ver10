import { describe, expect, it } from 'vitest';

import { copyWeeklySnapshot } from '../copy-weekly-snapshot.mjs';

const envelope = {
  schemaVersion: 2,
  generatedAt: '2026-08-24T03:00:00.000Z',
  groups: {
    P0000CXG: {
      id: 'P0000CXG', parentName: '방염 MDF 9T',
      children: [{ name: '9T', price: 28380, productNo: 1956, variantCode: 'P0000CXG000A' }],
    },
  },
};

function clients(sourceValue, options = {}) {
  const calls = [];
  const createClient = (clientOptions) => {
    const { url } = clientOptions;
    calls.push([url, 'create', clientOptions.socket]);
    let isOpen = false;
    return {
      get isOpen() { return isOpen; },
      on: (event) => calls.push([url, 'on', event]),
      connect: async () => {
        calls.push([url, 'connect']);
        if (options.connectFailure === url) throw new Error('connect failed');
        isOpen = true;
      },
      get: async key => {
        calls.push([url, 'get', key]);
        if (options.getFailure === url) throw new Error('get failed');
        return sourceValue;
      },
      set: async (key, value, setOptions) => {
        calls.push([url, 'set', key, value, setOptions]);
        if (options.setFailure) throw new Error('set failed');
        return options.targetOccupied ? null : 'OK';
      },
      destroy: () => { calls.push([url, 'destroy']); isOpen = false; },
    };
  };
  return { calls, createClient };
}

describe('copyWeeklySnapshot', () => {
  it('atomically copies only the validated weekly snapshot key', async () => {
    const raw = JSON.stringify(envelope);
    const fake = clients(raw);

    await expect(copyWeeklySnapshot({
      sourceUrl: 'redis://source', targetUrl: 'redis://target', createClient: fake.createClient,
    })).resolves.toEqual({ key: 'catalog:snapshot:v1', generatedAt: envelope.generatedAt, stableKeyCount: 1 });

    expect(fake.calls.filter(call => call[1] === 'set')).toEqual([
      ['redis://target', 'set', 'catalog:snapshot:v1', raw, { NX: true }],
    ]);
    expect(fake.calls.filter(call => call[1] === 'destroy')).toEqual([
      ['redis://source', 'destroy'], ['redis://target', 'destroy'],
    ]);
    expect(fake.calls.filter(call => call[1] === 'create').every(call =>
      call[2].reconnectStrategy === false && call[2].connectTimeout === 10000)).toBe(true);
  });

  it('refuses same URLs, occupied targets, and malformed runtime envelopes', async () => {
    await expect(copyWeeklySnapshot({
      sourceUrl: 'redis://same', targetUrl: 'redis://same', createClient: () => ({}),
    })).rejects.toThrow(/must be different/);

    const malformedCases = [
      { schemaVersion: 1 },
      { ...envelope, generatedAt: 'August 24, 2026' },
      { ...envelope, groups: { P0000CXG: { ...envelope.groups.P0000CXG, children: [{ price: 1, productNo: '1', variantCode: 'V1' }] } } },
      { ...envelope, groups: { P0000CXG: { ...envelope.groups.P0000CXG, children: [...envelope.groups.P0000CXG.children, envelope.groups.P0000CXG.children[0]] } } },
      { ...envelope, groups: { P0000CXG: { ...envelope.groups.P0000CXG, children: [{ ...envelope.groups.P0000CXG.children[0], price: 0 }] } } },
    ];
    for (const value of malformedCases) {
      const fake = clients(JSON.stringify(value));
      await expect(copyWeeklySnapshot({
        sourceUrl: 'redis://source', targetUrl: 'redis://target', createClient: fake.createClient,
      })).rejects.toThrow(/valid v2 envelope/);
      expect(fake.calls.some(call => call[1] === 'set')).toBe(false);
    }

    const occupied = clients(JSON.stringify(envelope), { targetOccupied: true });
    await expect(copyWeeklySnapshot({
      sourceUrl: 'redis://source', targetUrl: 'redis://target', createClient: occupied.createClient,
    })).rejects.toThrow(/already exists/);
  });

  it('disables reconnects and cleans each opened client after read and write failures', async () => {
    for (const options of [{ getFailure: 'redis://source' }, { setFailure: true }]) {
      const fake = clients(JSON.stringify(envelope), options);
      await expect(copyWeeklySnapshot({
        sourceUrl: 'redis://source', targetUrl: 'redis://target', createClient: fake.createClient,
      })).rejects.toThrow();
      const createdUrls = fake.calls.filter(call => call[1] === 'create').map(call => call[0]);
      const destroyedUrls = fake.calls.filter(call => call[1] === 'destroy').map(call => call[0]);
      expect(destroyedUrls).toEqual(createdUrls);
      expect(fake.calls.filter(call => call[1] === 'create').every(call =>
        call[2].reconnectStrategy === false && call[2].connectTimeout === 10000)).toBe(true);
    }

    const connectFailure = clients(JSON.stringify(envelope), { connectFailure: 'redis://source' });
    await expect(copyWeeklySnapshot({
      sourceUrl: 'redis://source', targetUrl: 'redis://target', createClient: connectFailure.createClient,
    })).rejects.toThrow('connect failed');
    expect(connectFailure.calls.filter(call => call[1] === 'destroy')).toEqual([]);
    expect(connectFailure.calls.find(call => call[1] === 'create')[2]).toEqual({
      reconnectStrategy: false, connectTimeout: 10000,
    });
  });
});
