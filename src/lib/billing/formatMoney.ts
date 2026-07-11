/** Format Paystack amount (pesewas) as GHS for display. */
export function formatGhsFromPesewas(amountPesewas: number, currency = "GHS"): string {
  const major = amountPesewas / 100;
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency || "GHS",
      minimumFractionDigits: 2
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
