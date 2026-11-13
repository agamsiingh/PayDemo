// Server-side price list. The browser only sends a productId; the price NEVER comes from the client.
export const PRODUCTS: Record<string, { name: string; price: number }> = {
  starter: { name: "Starter Plan", price: 99 },
  pro: { name: "Pro Plan", price: 499 },
  course: { name: "Integration Course", price: 999 },
};
