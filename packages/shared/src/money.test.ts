import { describe, expect, it } from 'vitest';
import { allocate, allocateByWeights, add, fromMajor, minor, multiply, toMajor } from './money.js';

describe('money', () => {
  it('rejects non-integer minor units', () => {
    expect(() => minor(10.5)).toThrow();
  });

  it('round-trips major units', () => {
    expect(fromMajor('1250.75')).toBe(125075);
    expect(toMajor(minor(125075))).toBe(1250.75);
  });

  it('does not accumulate float error across many additions', () => {
    const tenKobo = fromMajor(0.1);
    const total = add(...Array.from({ length: 10 }, () => tenKobo));
    expect(total).toBe(fromMajor(1));
  });

  it('rounds multiplication half-up away from zero', () => {
    expect(multiply(minor(1000), 0.075)).toBe(75);
    expect(multiply(minor(5), 0.5)).toBe(3);
    expect(multiply(minor(-5), 0.5)).toBe(-3);
  });

  describe('allocate', () => {
    it('splits without losing a kobo', () => {
      const parts = allocate(minor(1000), 3);
      expect(parts).toEqual([334, 333, 333]);
      expect(add(...parts)).toBe(1000);
    });

    it('handles an exact split', () => {
      expect(allocate(minor(900), 3)).toEqual([300, 300, 300]);
    });

    it('rejects a non-positive part count', () => {
      expect(() => allocate(minor(100), 0)).toThrow();
    });
  });

  describe('allocateByWeights', () => {
    it('allocates proportionally and preserves the total', () => {
      const shares = allocateByWeights(minor(1000), [1, 1, 2]);
      expect(shares).toEqual([250, 250, 500]);
      expect(add(...shares)).toBe(1000);
    });

    it('distributes an indivisible remainder', () => {
      const shares = allocateByWeights(minor(1000), [1, 1, 1]);
      expect(add(...shares)).toBe(1000);
      expect(shares).toEqual([334, 333, 333]);
    });

    it('falls back to an even split when all weights are zero', () => {
      expect(add(...allocateByWeights(minor(100), [0, 0]))).toBe(100);
    });
  });
});
