const wholePesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pesosWithCents = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

// Amounts are stored as integer cents. Shows "$150" for whole pesos and "$150.50" otherwise.
export function formatMXN(cents: number): string {
  const formatter = cents % 100 === 0 ? wholePesos : pesosWithCents;
  return formatter.format(cents / 100);
}
