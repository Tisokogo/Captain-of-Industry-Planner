import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson, writeJson } from './storage';

describe('safe storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips JSON values', () => {
    expect(writeJson('key', { value: 42 })).toBe(true);
    expect(readJson('key', null)).toEqual({ value: 42 });
  });

  it('returns fallback for malformed JSON', () => {
    localStorage.setItem('key', '{');
    expect(readJson('key', { safe: true })).toEqual({ safe: true });
  });

  it('reports write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota');
    });
    expect(writeJson('key', { large: true })).toBe(false);
  });
});
