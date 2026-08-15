/**
 * Money is ALWAYS handled as an integer count of minor units (kobo for NGN).
 * Never use floats for currency — 0.1 + 0.2 !== 0.3 will silently corrupt a
 * double-entry ledger, and §4.4 of the plan requires journal entries to balance
 * exactly. Prisma columns for money should be `Int`/`BigInt` minor units, not
 * `Float` and not `Decimal` used loosely.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

/** Integer minor units (e.g. 1_50 === ₦1.50). Branded to catch raw-number mixups. */
export type Minor = number & { readonly __brand: 'MinorUnits' };

export class MoneyError extends Error {}

export function minor(value: number): Minor {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Money must be an integer count of minor units, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Money value ${value} exceeds safe integer range`);
  }
  return value as Minor;
}

/** Parse a human-entered major-unit amount ("1250.75") into minor units. */
export function fromMajor(value: number | string): Minor {
  const asNumber = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(asNumber)) {
    throw new MoneyError(`Cannot parse "${value}" as a money amount`);
  }
  return minor(Math.round(asNumber * MINOR_UNITS_PER_MAJOR));
}

export function toMajor(value: Minor): number {
  return value / MINOR_UNITS_PER_MAJOR;
}

export function add(...values: Minor[]): Minor {
  return minor(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtract(a: Minor, b: Minor): Minor {
  return minor(a - b);
}

/**
 * Multiply money by a quantity, rounding half-up away from zero.
 * Half-up (not banker's rounding) matches what Nigerian retail receipts show
 * and what merchants expect to reconcile against.
 */
export function multiply(value: Minor, factor: number): Minor {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Cannot multiply money by ${factor}`);
  }
  const raw = value * factor;
  return minor(Math.sign(raw) * Math.round(Math.abs(raw)));
}

/**
 * Split an amount into `parts` shares that sum EXACTLY back to the original.
 * Remainder kobo are distributed one-per-share from the front, so a
 * ₦10.00 split three ways gives [334, 333, 333] rather than losing a kobo.
 * Needed for POS-103 (multi-payment split) and PROC-104 (landed cost allocation).
 */
export function allocate(value: Minor, parts: number): Minor[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`Cannot allocate into ${parts} parts`);
  }
  const base = Math.trunc(value / parts);
  let remainder = value - base * parts;
  const step = Math.sign(remainder) || 1;

  return Array.from({ length: parts }, () => {
    if (remainder !== 0) {
      remainder -= step;
      return minor(base + step);
    }
    return minor(base);
  });
}

/**
 * Allocate proportionally by weight, preserving the exact total.
 * Used by PROC-104 to spread shipping/duty across received line items by value.
 */
export function allocateByWeights(value: Minor, weights: number[]): Minor[] {
  if (weights.length === 0) {
    throw new MoneyError('allocateByWeights requires at least one weight');
  }
  if (weights.some((w) => w < 0)) {
    throw new MoneyError('allocateByWeights does not accept negative weights');
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return allocate(value, weights.length);
  }

  const shares = weights.map((w) => Math.trunc((value * w) / totalWeight));
  let remainder = value - shares.reduce((sum, s) => sum + s, 0);
  const step = Math.sign(remainder) || 1;

  for (let i = 0; remainder !== 0; i = (i + 1) % shares.length) {
    shares[i] = shares[i]! + step;
    remainder -= step;
  }

  return shares.map(minor);
}

export function formatNGN(value: Minor): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(toMajor(value));
}
