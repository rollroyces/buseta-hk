import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJSON, fetchText } from '../../src/utils/network.js';

describe('fetchJSON', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on OK response', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hello: 'world' }),
    });
    const data = await fetchJSON('https://example.test/api');
    expect(data).toEqual({ hello: 'world' });
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.test/api', {
      signal: undefined,
    });
  });

  it('throws on non-OK response with status code in the message', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchJSON('https://example.test/missing')).rejects.toThrow('HTTP 404');
  });

  it('passes the AbortSignal through to fetch', async () => {
    const controller = new AbortController();
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    await fetchJSON('https://example.test/api', controller.signal);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.test/api', {
      signal: controller.signal,
    });
  });

  it('handles nested JSON arrays', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ route: '970' }, { route: '971' }],
    });
    const data = await fetchJSON('https://example.test/routes');
    expect(data).toHaveLength(2);
    expect(data[0].route).toBe('970');
  });
});

describe('fetchText', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns text body on OK response', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'plain text body',
    });
    const text = await fetchText('https://example.test/plain');
    expect(text).toBe('plain text body');
  });

  it('throws on non-OK response with status code in the message', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchText('https://example.test/error')).rejects.toThrow('HTTP 500');
  });

  it('passes the AbortSignal through to fetch', async () => {
    const controller = new AbortController();
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });
    await fetchText('https://example.test/plain', controller.signal);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.test/plain', {
      signal: controller.signal,
    });
  });
});
