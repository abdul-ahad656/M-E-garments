export const CART_KEY = "me_garments_cart_id";

export function getCartId(): string | null {
  return localStorage.getItem(CART_KEY);
}

export function setCartId(id: string): void {
  localStorage.setItem(CART_KEY, id);
}

export function clearCartId(): void {
  localStorage.removeItem(CART_KEY);
}
