/** Alert when variant available quantity is at or below this level. */
export const LOW_STOCK_THRESHOLD = 5;

export function isLowStock(available: number): boolean {
  return available <= LOW_STOCK_THRESHOLD;
}

export function lowStockLabel(available: number): string {
  if (available <= 0) return "Out of stock";
  if (available <= LOW_STOCK_THRESHOLD) {
    return `Low stock (${available} left)`;
  }
  return "";
}
