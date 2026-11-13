// Remembers the orders you created in this browser so the Inspector can offer them. Best-effort only.
const KEY = "paydemo.recent";

export interface RecentOrder {
  no: string;
  product: string;
  at: string;
}

export function getRecent(): RecentOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function addRecent(o: RecentOrder) {
  try {
    const list = [o, ...getRecent().filter((x) => x.no !== o.no)].slice(0, 15);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: fine */
  }
}
