/**
 * Nigerian VAT (POS-105, plan §4.6).
 *
 * Rate is carried in basis points (750 === 7.5%) so it stays an integer and can
 * be changed per-tenant / per-period without touching float math. VAT is
 * computed PER LINE, never on the cart total — staples and fresh produce are
 * zero-rated, so a mixed cart has no single applicable rate.
 */

import { minor, multiply, subtract, type Minor } from './money.js';

export const NIGERIA_VAT_RATE_BPS = 750;
const BPS_DIVISOR = 10_000;

/** How a line's stored price should be read against the VAT rate. */
export type VatMode = 'exclusive' | 'inclusive';

export interface VatLineInput {
  /** Line amount before or after VAT depending on `mode`, already × quantity. */
  readonly amount: Minor;
  /** false for zero-rated / exempt goods (staples, fresh produce). */
  readonly vatable: boolean;
  readonly rateBps?: number;
}

export interface VatLineResult {
  readonly net: Minor;
  readonly vat: Minor;
  readonly gross: Minor;
  readonly rateBps: number;
}

export class VatError extends Error {}

function assertRate(rateBps: number): void {
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new VatError(`VAT rate must be a non-negative integer in basis points, got ${rateBps}`);
  }
}

export function computeLineVat(
  input: VatLineInput,
  mode: VatMode = 'exclusive',
  defaultRateBps: number = NIGERIA_VAT_RATE_BPS,
): VatLineResult {
  const rateBps = input.vatable ? (input.rateBps ?? defaultRateBps) : 0;
  assertRate(rateBps);

  if (rateBps === 0) {
    return { net: input.amount, vat: minor(0), gross: input.amount, rateBps: 0 };
  }

  if (mode === 'exclusive') {
    const vat = multiply(input.amount, rateBps / BPS_DIVISOR);
    return { net: input.amount, vat, gross: minor(input.amount + vat), rateBps };
  }

  // Inclusive: the stored price already contains VAT — back it out.
  const net = multiply(input.amount, BPS_DIVISOR / (BPS_DIVISOR + rateBps));
  return { net, vat: subtract(input.amount, net), gross: input.amount, rateBps };
}

export interface VatTotals {
  readonly net: Minor;
  readonly vat: Minor;
  readonly gross: Minor;
  readonly lines: readonly VatLineResult[];
}

/**
 * Total a cart. Sums the per-line results rather than re-applying the rate to a
 * grand total, so the receipt's line items always add up to the printed total
 * (the reconciliation failure merchants actually notice).
 */
export function computeCartVat(
  lines: readonly VatLineInput[],
  mode: VatMode = 'exclusive',
  defaultRateBps: number = NIGERIA_VAT_RATE_BPS,
): VatTotals {
  const results = lines.map((line) => computeLineVat(line, mode, defaultRateBps));
  return {
    net: minor(results.reduce((sum, r) => sum + r.net, 0)),
    vat: minor(results.reduce((sum, r) => sum + r.vat, 0)),
    gross: minor(results.reduce((sum, r) => sum + r.gross, 0)),
    lines: results,
  };
}
