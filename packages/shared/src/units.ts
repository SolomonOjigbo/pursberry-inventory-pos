/**
 * Multi-unit packaging (PROD-102, plan §4.1).
 *
 * Stock is ALWAYS stored internally in base units. A product declares a set of
 * packaging units, each with `baseUnitsPerUnit` — how many base units one of it
 * contains. The base unit itself has a factor of 1.
 *
 *   1 Carton = 12 Packs = 120 Units  ->  [Carton:120, Pack:10, Unit:1]
 */

export interface ProductUnit {
  /** Stable per-product code, e.g. "CARTON" | "PACK" | "UNIT". */
  readonly code: string;
  readonly label: string;
  /** How many base units one of this unit contains. Base unit === 1. */
  readonly baseUnitsPerUnit: number;
}

export class UnitConversionError extends Error {}

export function assertValidUnitSet(units: readonly ProductUnit[]): void {
  if (units.length === 0) {
    throw new UnitConversionError('A product must define at least one unit');
  }
  for (const unit of units) {
    if (!Number.isInteger(unit.baseUnitsPerUnit) || unit.baseUnitsPerUnit < 1) {
      throw new UnitConversionError(
        `Unit "${unit.code}" has an invalid factor ${unit.baseUnitsPerUnit}; must be a positive integer`,
      );
    }
  }
  if (!units.some((u) => u.baseUnitsPerUnit === 1)) {
    throw new UnitConversionError('A product must define a base unit with factor 1');
  }
  const codes = new Set(units.map((u) => u.code));
  if (codes.size !== units.length) {
    throw new UnitConversionError('Unit codes must be unique within a product');
  }
}

function requireUnit(units: readonly ProductUnit[], code: string): ProductUnit {
  const unit = units.find((u) => u.code === code);
  if (!unit) {
    throw new UnitConversionError(`Unknown unit "${code}" for this product`);
  }
  return unit;
}

/** Convert a quantity expressed in `unitCode` into base units. */
export function toBaseUnits(
  units: readonly ProductUnit[],
  quantity: number,
  unitCode: string,
): number {
  if (!Number.isInteger(quantity)) {
    throw new UnitConversionError(`Quantity must be a whole number, got ${quantity}`);
  }
  return quantity * requireUnit(units, unitCode).baseUnitsPerUnit;
}

/**
 * Convert base units into a whole quantity of `unitCode`, or throw if it does
 * not divide evenly. Use `breakdown` when a remainder is acceptable.
 */
export function fromBaseUnits(
  units: readonly ProductUnit[],
  baseQuantity: number,
  unitCode: string,
): number {
  const factor = requireUnit(units, unitCode).baseUnitsPerUnit;
  if (baseQuantity % factor !== 0) {
    throw new UnitConversionError(
      `${baseQuantity} base units is not a whole number of "${unitCode}" (factor ${factor})`,
    );
  }
  return baseQuantity / factor;
}

export interface UnitBreakdownEntry {
  readonly unit: ProductUnit;
  readonly quantity: number;
}

/**
 * Express a base-unit quantity in the largest packaging units first.
 * 125 base units with [Carton:120, Pack:10, Unit:1] -> 1 Carton, 0 Packs, 5 Units.
 * Zero-quantity tiers are dropped unless `includeZero` is set.
 */
export function breakdown(
  units: readonly ProductUnit[],
  baseQuantity: number,
  options: { includeZero?: boolean } = {},
): UnitBreakdownEntry[] {
  assertValidUnitSet(units);
  if (baseQuantity < 0) {
    throw new UnitConversionError(`Cannot break down a negative quantity (${baseQuantity})`);
  }

  const descending = [...units].sort((a, b) => b.baseUnitsPerUnit - a.baseUnitsPerUnit);
  let remaining = baseQuantity;
  const result: UnitBreakdownEntry[] = [];

  for (const unit of descending) {
    const quantity = Math.trunc(remaining / unit.baseUnitsPerUnit);
    remaining -= quantity * unit.baseUnitsPerUnit;
    if (quantity > 0 || options.includeZero) {
      result.push({ unit, quantity });
    }
  }

  return result;
}

export function formatBreakdown(entries: readonly UnitBreakdownEntry[]): string {
  if (entries.length === 0) return '0';
  return entries.map((e) => `${e.quantity} ${e.unit.label}`).join(', ');
}
