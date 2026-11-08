"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Card = {
  databaseId: string; sourceCardId: string; collection: string; collectionName: string;
  year: string; cardSet: string; cardNo: string; playerName: string;
  cardDescription: string; variant: string; got: boolean;
};
type Item = {
  itemId: string; cardId: string | null; sourceCardId: string | null;
  collection: string | null; collectionName: string | null; playerName: string | null;
  cardNo: string | null; cardSet: string | null; quantity: number;
  receivedQuantity: number; receivedVariant: string | null; received: boolean;
};
type Order = { orderId: string; seller: string | null; orderDate: string | null; price: string | null; items: Item[] };
type Data = { success: boolean; cards: Card[]; orders: Order[]; collections: { key: string; name: string }[]; error?: string };

const inputClass = "w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const buttonClass = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40";

export default function OrdersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collection, setCollection] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<{ card: Card; quantity: number }[]>([]);
  const [seller, setSeller] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState<{ item: Item; quantity: number; variant: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json() as Data;
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load orders.");
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load orders."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const results = useMemo(() => {
    if (!data || !collection) return [];
    const q = search.trim().toLowerCase();
    return data.cards.filter(c => c.collection === collection &&
      (!q || [c.sourceCardId, c.playerName, c.cardNo, c.cardSet].some(v => (v || "").toLowerCase().includes(q))))
      .slice(0, 100);
  }, [data, collection, search]);

  function addCard(card: Card) {
    setCart(prev => prev.some(x => x.card.databaseId === card.databaseId)
      ? prev.map(x => x.card.databaseId === card.databaseId ? { ...x, quantity: x.quantity + 1 } : x)
      : [...prev, { card, quantity: 1 }]);
  }
  function changeQuantity(id: string, quantity: number) {
    setCart(prev => prev.map(x => x.card.databaseId === id ? { ...x, quantity } : x).filter(x => x.quantity > 0));
  }

  async function createOrder() {
    if (!cart.length) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller, orderDate, price, items: cart.map(x => ({ cardId: x.card.databaseId, quantity: x.quantity })) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not create order.");
      setCart([]); setSeller(""); setPrice(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create order."); }
    finally { setSaving(false); }
  }

  async function confirmReceipt() {
    if (!receiving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/orders/items/${receiving.item.itemId}/receive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: receiving.quantity, variant: receiving.variant })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not record delivery.");
      setReceiving(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record delivery."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-gray-950 text-white">
    <header className="border-b border-white/10 bg-gray-900/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div><h1 className="text-2xl font-bold">Orders</h1><p className="mt-1 text-sm text-gray-400">Track cards you have ordered and confirm deliveries.</p></div>
        <Link href="/" className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10">← All Collections</Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <section className="rounded-2xl border border-white/10 bg-gray-900/50 p-5">
        <h2 className="text-lg font-bold">Create an order</h2>
        <p className="mb-4 mt-1 text-sm text-gray-400">Choose the collection first, then find and add the card or cards you have ordered.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-gray-400">Seller<input className={inputClass + " mt-1"} value={seller} onChange={e => setSeller(e.target.value)} placeholder="Seller / shop" /></label>
          <label className="text-xs text-gray-400">Order date<input type="date" className={inputClass + " mt-1"} value={orderDate} onChange={e => setOrderDate(e.target.value)} /></label>
          <label className="text-xs text-gray-400">Total price<input className={inputClass + " mt-1"} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. £24.50" /></label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-400">1. Collection (required)
            <select className={inputClass + " mt-1"} value={collection} onChange={e => { setCollection(e.target.value); setSearch(""); }}>
              <option value="">Select a collection…</option>
              {(data?.collections || []).map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">2. Find a card
            <input className={inputClass + " mt-1"} value={search} onChange={e => setSearch(e.target.value)} disabled={!collection} placeholder="Card ID, player name or card number" />
          </label>
        </div>
        {collection && <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
          {results.map(card => <div key={card.databaseId} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{card.playerName || "Unknown player"} <span className="text-gray-400">#{card.cardNo}</span></p>
              <p className="truncate text-xs text-gray-500">{card.sourceCardId} · {card.year} {card.cardSet} · {card.variant}</p></div>
            <button className={buttonClass} onClick={() => addCard(card)}>Add</button>
          </div>)}
          {!results.length && <p className="p-3 text-sm text-gray-500">No matching cards in this collection.</p>}
        </div>}
        {cart.length > 0 && <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3">
          <h3 className="mb-2 text-sm font-semibold">Cards in this order ({cart.length})</h3>
          {cart.map(({card, quantity}) => <div key={card.databaseId} className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0">
            <div className="min-w-0"><p className="truncate text-sm">{card.playerName} · #{card.cardNo}</p><p className="text-xs text-gray-500">{card.collectionName} · ID {card.sourceCardId}</p></div>
            <div className="flex items-center gap-2"><label className="text-xs text-gray-400">Qty <input aria-label={"Quantity for " + card.playerName} type="number" min="1" max="999" className="w-16 rounded bg-gray-800 p-1 text-center text-white" value={quantity} onChange={e => changeQuantity(card.databaseId, Math.max(1, Number(e.target.value) || 1))} /></label><button className="text-xs text-red-300" onClick={() => changeQuantity(card.databaseId, 0)}>Remove</button></div>
          </div>)}
          <button className={buttonClass + " mt-3"} disabled={saving} onClick={() => void createOrder()}>{saving ? "Saving…" : "Save order"}</button>
        </div>}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-bold">Order history</h2><p className="text-sm text-gray-400">Cards stay marked as on order until their delivery is confirmed.</p></div>
        {loading ? <p className="text-sm text-gray-500">Loading orders…</p> : !data?.orders.length ? <p className="rounded-xl border border-white/10 p-5 text-sm text-gray-500">No orders recorded yet.</p> : data.orders.map(order => <article key={order.orderId} className="rounded-2xl border border-white/10 bg-gray-900/50 p-4">
          <div className="mb-3 flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{order.seller || "Order"} <span className="text-xs font-normal text-gray-500">#{order.orderId}</span></h3><p className="text-xs text-gray-500">{order.orderDate || "Date not recorded"} · {order.price || "Price not recorded"}</p></div>
            <span className="text-xs text-gray-400">{order.items.filter(i => i.received).length}/{order.items.length} items fully received</span></div>
          <div className="space-y-2">{order.items.map(item => <div key={item.itemId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-800/50 p-3">
            <div><p className="text-sm font-medium">{item.playerName || "Unlinked card"} {item.cardNo ? "· #" + item.cardNo : ""}</p><p className="text-xs text-gray-500">{item.collectionName || "Collection unknown"} · {item.receivedQuantity}/{item.quantity} received{item.receivedVariant ? " · " + item.receivedVariant : ""}</p></div>
            {item.cardId && item.receivedQuantity < item.quantity && <button className={buttonClass} onClick={() => setReceiving({item, quantity: item.quantity - item.receivedQuantity, variant: item.receivedVariant || "Base"})}>Confirm delivery</button>}
            {!item.cardId && <span className="text-xs text-amber-300">Needs card link</span>}
            {item.received && <span className="text-xs font-semibold text-emerald-300">Received</span>}
          </div>)}</div>
        </article>)}
      </section>
    </div>
    {receiving && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl">
        <h2 className="text-lg font-bold">Confirm card delivery</h2>
        <p className="mt-1 text-sm text-gray-400">{receiving.item.playerName} · #{receiving.item.cardNo}</p>
        <p className="mt-3 text-xs text-gray-400">Confirm the quantity received and the variant. Only this confirmation updates your collection.</p>
        <label className="mt-4 block text-xs text-gray-400">Quantity received<input type="number" min="1" max={receiving.item.quantity - receiving.item.receivedQuantity} className={inputClass + " mt-1"} value={receiving.quantity} onChange={e => setReceiving({...receiving, quantity: Number(e.target.value)})} /></label>
        <label className="mt-3 block text-xs text-gray-400">Variant received<input className={inputClass + " mt-1"} value={receiving.variant} onChange={e => setReceiving({...receiving, variant: e.target.value})} placeholder="e.g. Base, Holo, Gold" /></label>
        <div className="mt-5 flex justify-end gap-2"><button className="rounded-lg bg-white/10 px-4 py-2 text-sm" onClick={() => setReceiving(null)}>Cancel</button><button className={buttonClass} disabled={saving || receiving.quantity < 1 || receiving.quantity > receiving.item.quantity - receiving.item.receivedQuantity || !receiving.variant.trim()} onClick={() => void confirmReceipt()}>{saving ? "Saving…" : "Confirm and add to collection"}</button></div>
      </div>
    </div>}
  </main>;
}
