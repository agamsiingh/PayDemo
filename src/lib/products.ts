// Display data only. The authoritative price list is in supabase/functions/_shared/products.ts:
// the server looks the price up by id, so editing this file cannot change what a customer is charged.
export interface Product {
  id: string;
  name: string;
  price: number;
  blurb: string;
  emoji: string;
}

export const PRODUCTS: Product[] = [
  { id: "starter", name: "Starter Plan", price: 99, emoji: "🌱", blurb: "A tiny fake plan for testing the smallest payment." },
  { id: "pro", name: "Pro Plan", price: 499, emoji: "🚀", blurb: "A mid-priced fake plan. The classic demo order." },
  { id: "course", name: "Integration Course", price: 999, emoji: "🎓", blurb: "A fake course. Nothing is delivered, nothing is real." },
];

export const findProduct = (id: string | undefined) => PRODUCTS.find((p) => p.id === id);
