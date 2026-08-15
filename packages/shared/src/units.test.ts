import { describe, expect, it } from 'vitest';
import {
  assertValidUnitSet,
  breakdown,
  formatBreakdown,
  fromBaseUnits,
  toBaseUnits,
  type ProductUnit,
} from './units.js';

// 1 Carton = 12 Packs = 120 Units — the worked example from plan §4.1.
const UNITS: ProductUnit[] = [
  { code: 'CARTON', label: 'Carton', baseUnitsPerUnit: 120 },
  { code: 'PACK', label: 'Pack', baseUnitsPerUnit: 10 },
  { code: 'UNIT', label: 'Unit', baseUnitsPerUnit: 1 },
];

describe('multi-unit packaging', () => {
  it('accepts a valid unit set', () => {
    expect(() => assertValidUnitSet(UNITS)).not.toThrow();
  });

  it('rejects a unit set with no base unit', () => {
    expect(() => assertValidUnitSet(UNITS.slice(0, 2))).toThrow(/base unit/);
  });

  it('rejects duplicate unit codes', () => {
    expect(() => assertValidUnitSet([...UNITS, UNITS[2]!])).toThrow(/unique/);
  });

  it('converts any unit to base units', () => {
    expect(toBaseUnits(UNITS, 2, 'CARTON')).toBe(240);
    expect(toBaseUnits(UNITS, 3, 'PACK')).toBe(30);
    expect(toBaseUnits(UNITS, 7, 'UNIT')).toBe(7);
  });

  it('converts base units back to a whole packaging unit', () => {
    expect(fromBaseUnits(UNITS, 240, 'CARTON')).toBe(2);
  });

  it('refuses a conversion that would lose a partial unit', () => {
    expect(() => fromBaseUnits(UNITS, 125, 'CARTON')).toThrow(/whole number/);
  });

  it('breaks a quantity down largest-unit-first', () => {
    expect(breakdown(UNITS, 125)).toEqual([
      { unit: UNITS[0], quantity: 1 },
      { unit: UNITS[2], quantity: 5 },
    ]);
    expect(formatBreakdown(breakdown(UNITS, 125))).toBe('1 Carton, 5 Unit');
  });

  it('keeps empty tiers when asked', () => {
    expect(breakdown(UNITS, 125, { includeZero: true }).map((e) => e.quantity)).toEqual([1, 0, 5]);
  });

  it('rejects a negative breakdown', () => {
    expect(() => breakdown(UNITS, -1)).toThrow();
  });
});
