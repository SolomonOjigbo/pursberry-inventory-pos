import { describe, expect, it } from 'vitest';
import { fromMajor, minor } from './money.js';
import { computeCartVat, computeLineVat } from './vat.js';

describe('VAT', () => {
  it('adds 7.5% to a VAT-able line (exclusive pricing)', () => {
    const result = computeLineVat({ amount: fromMajor(1000), vatable: true });
    expect(result.vat).toBe(fromMajor(75));
    expect(result.gross).toBe(fromMajor(1075));
  });

  it('backs 7.5% out of a VAT-inclusive price', () => {
    const result = computeLineVat({ amount: fromMajor(1075), vatable: true }, 'inclusive');
    expect(result.net).toBe(fromMajor(1000));
    expect(result.vat).toBe(fromMajor(75));
    expect(result.gross).toBe(fromMajor(1075));
  });

  it('charges nothing on an exempt line', () => {
    const result = computeLineVat({ amount: fromMajor(500), vatable: false });
    expect(result.vat).toBe(minor(0));
    expect(result.rateBps).toBe(0);
  });

  it('computes a mixed cart per line, not on the total (POS-105 AC)', () => {
    const totals = computeCartVat([
      { amount: fromMajor(1000), vatable: true }, // 75.00 VAT
      { amount: fromMajor(500), vatable: false }, // zero-rated staple
      { amount: fromMajor(200), vatable: true }, // 15.00 VAT
    ]);

    expect(totals.net).toBe(fromMajor(1700));
    expect(totals.vat).toBe(fromMajor(90));
    expect(totals.gross).toBe(fromMajor(1790));
  });

  it('keeps line grosses summing exactly to the cart gross', () => {
    const lines = Array.from({ length: 7 }, () => ({ amount: minor(333), vatable: true }));
    const totals = computeCartVat(lines);
    const summed = totals.lines.reduce((sum, l) => sum + l.gross, 0);
    expect(summed).toBe(totals.gross);
  });

  it('honours a per-line override rate', () => {
    const result = computeLineVat({ amount: fromMajor(1000), vatable: true, rateBps: 500 });
    expect(result.vat).toBe(fromMajor(50));
  });
});
