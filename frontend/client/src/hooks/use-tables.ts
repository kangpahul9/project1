/**
 * Per-table cart state + kitchen queue — all stored in localStorage.
 * This lets the POS hold multiple live table orders simultaneously
 * and exposes them to the KDS page on the same device.
 */

import { useEffect } from "react";

export interface TableCartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category_id: number | null;
  image_url?: string;
  barcode?: string;
  is_weight_based?: boolean;
  usage_count?: number;
  color?: string;
}

export interface KotSnapshot {
  id: number;
  quantity: number;
}

export interface TableCart {
  tableNumber: number;
  items: TableCartItem[];
  customerName: string;
  customerPhone: string;
  discount: number;
  sentToKitchen: boolean;
  sentAt?: string;
  lastUpdated: string;
  kotSnapshot?: KotSnapshot[];
}

export interface KitchenTicket {
  id: string;
  tableNumber: number;
  items: { name: string; quantity: number }[];
  sentAt: string;
  status: "pending" | "ready";
}

/* ── Storage keys ──────────────────────────────────────────────── */
const TABLE_KEY = (n: number) => `kangpos_table_${n}`;
const KITCHEN_KEY = "kangpos_kitchen";
const TABLE_COUNT_KEY = "kangpos_table_count";
const POS_MODE_KEY = "kangpos_pos_mode";

/* ── Event bus ─────────────────────────────────────────────────── */
const SYNC_EVENT = "kangpos:sync";

function dispatchSync() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

/**
 * Subscribe to any KDS/table storage change — works same-tab (custom event)
 * and cross-tab (native storage event). Pass a stable callback (useCallback).
 */
export function useStorageSync(callback: () => void) {
  useEffect(() => {
    window.addEventListener(SYNC_EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(SYNC_EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  }, [callback]);
}

/* ── Table count (configurable, default 12) ────────────────────── */
export function getTableCount(): number {
  return Math.max(1, Number(localStorage.getItem(TABLE_COUNT_KEY) || "12"));
}
export function setTableCount(n: number) {
  localStorage.setItem(TABLE_COUNT_KEY, String(Math.max(1, n)));
}

/* ── POS mode ──────────────────────────────────────────────────── */
export function getPosMode(): "takeaway" | "dine-in" {
  return (localStorage.getItem(POS_MODE_KEY) as "takeaway" | "dine-in") || "takeaway";
}
export function savePosMode(mode: "takeaway" | "dine-in") {
  localStorage.setItem(POS_MODE_KEY, mode);
}

/* ── Per-table cart ────────────────────────────────────────────── */
export function getTableCart(tableNumber: number): TableCart | null {
  try {
    const raw = localStorage.getItem(TABLE_KEY(tableNumber));
    return raw ? (JSON.parse(raw) as TableCart) : null;
  } catch {
    return null;
  }
}

export function saveTableCart(
  tableNumber: number,
  data: Omit<TableCart, "tableNumber" | "lastUpdated">
) {
  const payload: TableCart = {
    ...data,
    tableNumber,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(TABLE_KEY(tableNumber), JSON.stringify(payload));
  dispatchSync();
}

export function clearTableCart(tableNumber: number) {
  localStorage.removeItem(TABLE_KEY(tableNumber));
  dispatchSync();
}

/* ── Kitchen queue ─────────────────────────────────────────────── */
export function getKitchenTickets(): KitchenTicket[] {
  try {
    const raw = localStorage.getItem(KITCHEN_KEY);
    return raw ? (JSON.parse(raw) as KitchenTicket[]) : [];
  } catch {
    return [];
  }
}

/**
 * Send a new KOT to the kitchen.
 * - Only sends items added since the last send (delta vs kotSnapshot).
 * - If an unprocessed pending ticket already exists for this table, the delta
 *   is MERGED into it (so kitchen never loses items from a rapid double-send).
 * - Ready tickets are always preserved.
 * Returns true if a ticket was created/updated, false if nothing new.
 */
export function sendToKitchen(
  tableNumber: number,
  items: { id: number; name: string; quantity: number }[]
): boolean {
  const cart = getTableCart(tableNumber);
  const snapshot: KotSnapshot[] = cart?.kotSnapshot ?? [];

  // Compute delta — only items whose quantity increased since the last KOT
  const deltaItems: { name: string; quantity: number }[] = [];
  for (const item of items) {
    const prev = snapshot.find(s => s.id === item.id);
    const delta = item.quantity - (prev?.quantity ?? 0);
    if (delta > 0) deltaItems.push({ name: item.name, quantity: delta });
  }

  if (deltaItems.length === 0) return false;

  const tickets = getKitchenTickets();
  const existingPending = tickets.find(
    t => t.tableNumber === tableNumber && t.status === "pending"
  );

  let updatedTickets: KitchenTicket[];

  if (existingPending) {
    const mergedItems = [...existingPending.items];
    for (const di of deltaItems) {
      const slot = mergedItems.find(m => m.name === di.name);
      if (slot) slot.quantity += di.quantity;
      else mergedItems.push({ name: di.name, quantity: di.quantity });
    }
    updatedTickets = tickets.map(t =>
      t.id === existingPending.id
        ? { ...t, items: mergedItems, sentAt: new Date().toISOString() }
        : t
    );
  } else {
    const newTicket: KitchenTicket = {
      id: `${tableNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tableNumber,
      items: deltaItems,
      sentAt: new Date().toISOString(),
      status: "pending",
    };
    updatedTickets = [...tickets, newTicket];
  }

  localStorage.setItem(KITCHEN_KEY, JSON.stringify(updatedTickets));

  // saveTableCart already calls dispatchSync
  saveTableCart(tableNumber, {
    items: cart?.items ?? [],
    customerName: cart?.customerName ?? "",
    customerPhone: cart?.customerPhone ?? "",
    discount: cart?.discount ?? 0,
    sentToKitchen: true,
    sentAt: new Date().toISOString(),
    kotSnapshot: items.map(i => ({ id: i.id, quantity: i.quantity })),
  });
  return true;
}

export function markTicketReady(ticketId: string) {
  const updated = getKitchenTickets().map(t =>
    t.id === ticketId ? { ...t, status: "ready" as const } : t
  );
  localStorage.setItem(KITCHEN_KEY, JSON.stringify(updated));
  dispatchSync();
}

/**
 * Dismiss a KDS ticket.
 * If this was the last ticket for the table, resets the table cart's
 * sentToKitchen flag so the POS grid reflects it immediately.
 */
export function dismissTicket(ticketId: string) {
  const tickets = getKitchenTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  const updated = tickets.filter(t => t.id !== ticketId);
  localStorage.setItem(KITCHEN_KEY, JSON.stringify(updated));

  if (ticket) {
    const stillHasTickets = updated.some(t => t.tableNumber === ticket.tableNumber);
    const cart = getTableCart(ticket.tableNumber);
    if (cart) {
      // Remove items that were in the dismissed ticket from the table cart
      const dismissedNames = new Set(ticket.items.map(i => i.name));
      const remainingItems = cart.items.filter(i => !dismissedNames.has(i.name));
      const remainingIds = new Set(remainingItems.map(i => i.id));
      const payload: TableCart = {
        ...cart,
        items: remainingItems,
        sentToKitchen: stillHasTickets,
        sentAt: stillHasTickets ? cart.sentAt : undefined,
        kotSnapshot: stillHasTickets
          ? (cart.kotSnapshot ?? []).filter(s => remainingIds.has(s.id))
          : [],
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(TABLE_KEY(ticket.tableNumber), JSON.stringify(payload));
    }
  }

  dispatchSync();
}

export function clearTableKitchenTickets(tableNumber: number) {
  const updated = getKitchenTickets().filter(t => t.tableNumber !== tableNumber);
  localStorage.setItem(KITCHEN_KEY, JSON.stringify(updated));
  dispatchSync();
}

/**
 * Remove a single item from the pending kitchen ticket for a table.
 * Called when the waiter removes an item from the POS cart that was
 * already sent to the kitchen. Also clears it from the kotSnapshot.
 */
export function removeItemFromKitchen(
  tableNumber: number,
  itemId: number,
  itemName: string
) {
  const tickets = getKitchenTickets();
  const updatedTickets = tickets
    .map(t => {
      if (t.tableNumber !== tableNumber || t.status !== "pending") return t;
      return { ...t, items: t.items.filter(i => i.name !== itemName) };
    })
    .filter(t => t.items.length > 0 || t.status === "ready");

  localStorage.setItem(KITCHEN_KEY, JSON.stringify(updatedTickets));

  const cart = getTableCart(tableNumber);
  if (cart) {
    const payload: TableCart = {
      ...cart,
      kotSnapshot: (cart.kotSnapshot ?? []).filter(s => s.id !== itemId),
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(TABLE_KEY(tableNumber), JSON.stringify(payload));
  }

  dispatchSync();
}

/* ── Utility ───────────────────────────────────────────────────── */
export function getElapsedMinutes(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
}
