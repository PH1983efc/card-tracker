"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Order = {
  id: string;
  seller: string;
  date: string;
  price: string;
  cardIds: string[];
  received: string[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch("/api/sheets?sheet=orders", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to load orders");
        }

        const parsed = (data.rows || [])
          .slice(1)
          .map((row: string[]) => row[0])
          .filter(Boolean)
          .map((raw: string) => JSON.parse(raw));

        setOrders(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
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

        <h1 className="mb-2 text-2xl font-black">Orders</h1>
        <p className="mb-6 text-sm text-gray-400">
          Purchase orders from the Orders sheet.
        </p>

        {loading && <p className="text-gray-400">Loading orders...</p>}
        {error && <p className="text-red-400">{error}</p>}

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

              <div className="mt-3 flex flex-wrap gap-2">
                {order.cardIds.map((id) => {
                  const received = order.received.includes(id);

                  return (
                    <span
                      key={id}
                      className={
                        received
                          ? "rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300"
                          : "rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-300"
                      }
                    >
                      {id}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
