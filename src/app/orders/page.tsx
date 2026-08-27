"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type Order = {
  id: string;
  seller: string;
  date: string;
  price: string;
  cardIds: string[];
  received: string[];
};

type NeedCard = {
  id: string;
  name?: string;
  number?: string;
  collection?: string;
};

const AVAILABLE_SHEETS = [
  { id: "donruss", label: "Donruss" },
  { id: "topps-now", label: "Topps Now" },
  { id: "extra-collections", label: "Extra Collections" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Order Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seller, setSeller] = useState("");
  const [price, setPrice] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [manualCardId, setManualCardId] = useState("");

  // Needs Picker Modal State
  const [showNeedsPicker, setShowNeedsPicker] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState("donruss");
  const [needsCards, setNeedsCards] = useState<NeedCard[]>([]);
  const [loadingNeeds, setLoadingNeeds] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch Orders on load
  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const res = await fetch("/api/sheets?sheet=orders", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load orders");
      }

      const parsed: Order[] = (data.rows || [])
        .slice(1)
        .map((row: string[]) => row[0])
        .filter(Boolean)
        .map((raw: string) => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      setOrders(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  // 2. Fetch Needs when the picker modal is opened or collection tab changes
  useEffect(() => {
    if (!showNeedsPicker) return;

    async function loadNeeds() {
      setLoadingNeeds(true);
      try {
        const res = await fetch(`/api/sheets?sheet=${selectedSheet}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data.success && data.rows) {
          // Extracts cards from sheet rows
          const cards: NeedCard[] = data.rows
            .slice(1)
            .map((row: any[], index: number) => {
              // If row is a JSON string
              if (typeof row[0] === "string" && row[0].startsWith("{")) {
                try {
                  const parsed = JSON.parse(row[0]);
                  return {
                    id: parsed.id || parsed.cardId || `${selectedSheet}-${index}`,
                    name: parsed.name || parsed.player || "Card #" + (parsed.number || index),
                    number: parsed.number || "",
                    collection: selectedSheet,
                  };
                } catch {
                  return null;
                }
              }

              // If row is standard table columns: [id, name, number, owned...]
              return {
                id: row[0] || `${selectedSheet}-${index}`,
                name: row[1] || `Card ${row[0]}`,
                number: row[2] || "",
                collection: selectedSheet,
              };
            })
            .filter(Boolean);

          setNeedsCards(cards);
        }
      } catch (err) {
        console.error("Failed to load cards from sheet", err);
      } finally {
        setLoadingNeeds(false);
      }
    }

    loadNeeds();
  }, [showNeedsPicker, selectedSheet]);

  // Filter cards by search
  const filteredNeeds = useMemo(() => {
    if (!searchQuery.trim()) return needsCards;
    const q = searchQuery.toLowerCase();
    return needsCards.filter(
      (c) =>
        c.id?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.number?.toLowerCase().includes(q)
    );
  }, [needsCards, searchQuery]);

  // Toggle card selection in the Needs modal
  const toggleNeedCard = (id: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add manual ID
  const handleAddManualId = () => {
    if (!manualCardId.trim()) return;
    if (!selectedCardIds.includes(manualCardId.trim())) {
      setSelectedCardIds([...selectedCardIds, manualCardId.trim()]);
    }
    setManualCardId("");
  };

  // 3. Save new order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seller || selectedCardIds.length === 0) {
      alert("Please provide a seller name and select at least one card.");
      return;
    }

    setIsSaving(true);

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      seller,
      date: orderDate,
      price: price || "0",
      cardIds: selectedCardIds,
      received: [],
    };

    const updatedOrders = [newOrder, ...orders];

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "orders",
          rows: [
            ["OrderData"],
            ...updatedOrders.map((ord) => [JSON.stringify(ord)]),
          ],
        }),
      });

      if (!res.ok) throw new Error("Failed to save order to sheet");

      setOrders(updatedOrders);
      setShowOrderModal(false);
      // Reset form
      setSeller("");
      setPrice("");
      setSelectedCardIds([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving order");
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Toggle Card Received status
  const toggleReceivedStatus = async (orderId: string, cardId: string) => {
    const updatedOrders = orders.map((order) => {
      if (order.id !== orderId) return order;

      const alreadyReceived = order.received.includes(cardId);
      const newReceived = alreadyReceived
        ? order.received.filter((id) => id !== cardId)
        : [...order.received, cardId];

      return { ...order, received: newReceived };
    });

    setOrders(updatedOrders);

    // Save update in background
    try {
      await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "orders",
          rows: [
            ["OrderData"],
            ...updatedOrders.map((ord) => [JSON.stringify(ord)]),
          ],
        }),
      });
    } catch (err) {
      console.error("Error updating received status", err);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Navigation */}
        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          <Link href="/" className="rounded-lg bg-white/5 px-3 py-2 text-gray-300 hover:text-white">
            All Collections
          </Link>
          <Link href="/donruss" className="rounded-lg bg-white/5 px-3 py-2 text-gray-300 hover:text-white">
            Donruss
          </Link>
          <Link href="/topps-now" className="rounded-lg bg-white/5 px-3 py-2 text-gray-300 hover:text-white">
            Topps Now
          </Link>
          <Link href="/extra-collections" className="rounded-lg bg-white/5 px-3 py-2 text-gray-300 hover:text-white">
            Extra Collections
          </Link>
          <Link href="/orders" className="rounded-lg bg-indigo-600 px-3 py-2 text-white">
            Orders
          </Link>
        </nav>

        {/* Header with New Order Button */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Orders</h1>
            <p className="text-sm text-gray-400">
              Purchase orders from the Orders sheet.
            </p>
          </div>
          <button
            onClick={() => setShowOrderModal(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
          >
            + New Order
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading orders...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {/* Order Cards List */}
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-gray-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold">{order.seller}</h2>
                  <p className="text-sm text-gray-500">
                    {order.date} - £{order.price}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-400">
                  {order.received.length}/{order.cardIds.length} received
                </p>
              </div>

              {/* Badges with click-to-toggle received */}
              <div className="mt-3 flex flex-wrap gap-2">
                {order.cardIds.map((id) => {
                  const received = order.received.includes(id);

                  return (
                    <button
                      key={id}
                      onClick={() => toggleReceivedStatus(order.id, id)}
                      title="Click to toggle received status"
                      className={
                        received
                          ? "rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/30"
                          : "rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-300 transition hover:bg-amber-500/30"
                      }
                    >
                      {id} {received ? "✓" : "⏳"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!loading && orders.length === 0 && (
            <div className="rounded-2xl border border-white/5 bg-gray-900/20 py-12 text-center text-gray-500">
              No orders found. Click "+ New Order" to add one.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CREATE ORDER MODAL */}
      {/* ========================================================================= */}
      {showOrderModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Add New Order</h2>
            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400">
                  Seller / Store
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. eBay - seller123, Vinted"
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400">
                    Total Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Cards Added to this Order */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-400">
                    Cards in Order ({selectedCardIds.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNeedsPicker(true)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    + Pick from Needs
                  </button>
                </div>

                {/* Selected Cards Chips */}
                <div className="mt-2 flex min-h-[50px] flex-wrap gap-2 rounded-lg border border-white/10 bg-gray-800/60 p-2">
                  {selectedCardIds.length === 0 ? (
                    <span className="text-xs text-gray-500 self-center">
                      No cards selected yet. Pick from needs below or enter an ID.
                    </span>
                  ) : (
                    selectedCardIds.map((id) => (
                      <span
                        key={id}
                        className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300"
                      >
                        {id}
                        <button
                          type="button"
                          onClick={() => toggleNeedCard(id)}
                          className="ml-1 text-indigo-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Quick Add by Card ID input */}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Or type card ID manually..."
                    value={manualCardId}
                    onChange={(e) => setManualCardId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddManualId();
                      }
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-gray-800 px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualId}
                    className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-white hover:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PICK FROM NEEDS MODAL */}
      {/* ========================================================================= */}
      {showNeedsPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-gray-900 shadow-2xl">
            {/* Modal Header */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Select Cards from Needs</h3>
                <button
                  onClick={() => setShowNeedsPicker(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Collection Tabs */}
              <div className="mt-3 flex gap-2">
                {AVAILABLE_SHEETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSheet(s.id)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                      selectedSheet === s.id
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search by card name, number, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Modal Card List Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingNeeds ? (
                <p className="py-8 text-center text-gray-400">Loading collection cards...</p>
              ) : filteredNeeds.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No cards matched your search.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filteredNeeds.map((card) => {
                    const isSelected = selectedCardIds.includes(card.id);
                    return (
                      <div
                        key={card.id}
                        onClick={() => toggleNeedCard(card.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-950/40"
                            : "border-white/5 bg-gray-800/40 hover:bg-gray-800"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-sm truncate">{card.name}</p>
                          <p className="text-xs text-gray-400">
                            ID: <span className="text-gray-300">{card.id}</span>
                            {card.number && ` • #${card.number}`}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by div click
                          className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-white/10 p-4">
              <span className="text-xs text-gray-400">
                {selectedCardIds.length} cards selected
              </span>
              <button
                type="button"
                onClick={() => setShowNeedsPicker(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
