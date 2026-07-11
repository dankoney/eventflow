/**
 * Ghana VAT-inclusive split for EventFlow invoices.
 * Total T already includes tax. Components:
 *   base ≈ T / 1.20
 *   NHIL = base × 2.5%, GETFund = base × 2.5%, VAT = base × 15%
 * Rounded to nearest pesewa; remainder absorbed into base so
 * base + nhil + getfund + vat === T exactly.
 */

export type InclusiveVatSplitPesewas = {
  baseAmountPesewas: number;
  nhilAmountPesewas: number;
  getfundAmountPesewas: number;
  vatAmountPesewas: number;
};

export type ExclusiveVatSplitPesewas = InclusiveVatSplitPesewas & {
  totalPesewas: number;
};

export const GHANA_VAT_INCLUSIVE_DIVISOR = 1.2;
export const GHANA_NHIL_RATE = 0.025;
export const GHANA_GETFUND_RATE = 0.025;
export const GHANA_VAT_RATE = 0.15;

export function splitInclusiveVatPesewas(totalPesewas: number): InclusiveVatSplitPesewas {
  const total = Math.max(0, Math.trunc(totalPesewas));
  if (total === 0) {
    return {
      baseAmountPesewas: 0,
      nhilAmountPesewas: 0,
      getfundAmountPesewas: 0,
      vatAmountPesewas: 0
    };
  }

  const baseExact = total / GHANA_VAT_INCLUSIVE_DIVISOR;
  const nhilAmountPesewas = Math.round(baseExact * GHANA_NHIL_RATE);
  const getfundAmountPesewas = Math.round(baseExact * GHANA_GETFUND_RATE);
  const vatAmountPesewas = Math.round(baseExact * GHANA_VAT_RATE);
  const baseAmountPesewas = total - nhilAmountPesewas - getfundAmountPesewas - vatAmountPesewas;

  return {
    baseAmountPesewas,
    nhilAmountPesewas,
    getfundAmountPesewas,
    vatAmountPesewas
  };
}

/**
 * Exclusive (tax-on-top) split for Enterprise payable invoices.
 * Line items are pre-levy; NHIL / GETFund / VAT are added on top.
 */
export function applyExclusiveVatPesewas(basePesewas: number): ExclusiveVatSplitPesewas {
  const baseAmountPesewas = Math.max(0, Math.trunc(basePesewas));
  const nhilAmountPesewas = Math.round(baseAmountPesewas * GHANA_NHIL_RATE);
  const getfundAmountPesewas = Math.round(baseAmountPesewas * GHANA_GETFUND_RATE);
  const vatAmountPesewas = Math.round(baseAmountPesewas * GHANA_VAT_RATE);
  return {
    baseAmountPesewas,
    nhilAmountPesewas,
    getfundAmountPesewas,
    vatAmountPesewas,
    totalPesewas:
      baseAmountPesewas + nhilAmountPesewas + getfundAmountPesewas + vatAmountPesewas
  };
}
