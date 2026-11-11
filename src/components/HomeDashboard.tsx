"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers3, ShoppingCart, Trophy } from "lucide-react";
import type { Card } from "@/types";

const collections = [
  { key: "master", title: "Everton Cards", subtitle: "The main collection", href: "/everton", mark: "EFC", tone: "from-sky-500/30 to-blue-950/80" },
  { key: "donruss", title: "Donruss", subtitle: "Donruss collection", href: "/donruss", mark: "D", tone: "from-slate-400/20 to-slate-950/80" },
  { key: "topps-now", title: "Topps Now", subtitle: "Topps Now collection", href: "/topps-now", mark: "NOW", tone: "from-red-500/20 to-slate-950/80" },
  { key: "extra-collections", title: "Extra Collections", subtitle: "Everything else", href: "/extra-collections", mark: "★", tone: "from-amber-400/20 to-slate-950/80" },
];

export default function HomeDashboard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/cards", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Could not load your collection.");
        if (active) setCards(data.cards ?? []);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load your collection."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    const total = cards.length;
    const collected = cards.filter((card) => card.got).length;
    const collecting = cards.filter((card) => card.collecting).length;
    return { total, collected, missing: Math.max(0, collecting - collected), progress: collecting ? Math.round((collected / collecting) * 100) : 0 };
  }, [cards]);

  const counts = useMemo(() => Object.fromEntries(collections.map((collection) => [
    collection.key,
    cards.filter((card) => card.sheet === collection.key).length,
  ])), [cards]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#020b1c] text-white">
      <section className="relative border-b border-sky-400/20 bg-[radial-gradient(ellipse_at_75%_15%,rgba(0,117,255,.35),transparent_42%),linear-gradient(115deg,#061b42_0%,#03102a_52%,#020817_100%)]">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(120deg,transparent 35%,rgba(37,146,255,.18) 50%,transparent 65%)" }} />
        <div className="relative mx-auto flex max-w-7xl items-center gap-5 px-5 py-8 sm:px-8 sm:py-12">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#e6d7a6] bg-[#08204b] text-center text-[#f2e7c5] shadow-[0_0_35px_rgba(0,132,255,.25)] sm:h-24 sm:w-24">
            <div className="rounded-full border border-[#e6d7a6]/70 px-2 py-3"><div className="text-[10px] font-black tracking-[.18em]">EVERTON</div><div className="my-1 text-2xl">⚓</div><div className="text-[8px] font-bold tracking-widest">1878</div></div>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[.32em] text-sky-300">Collect · Track · Complete</p>
            <h1 className="text-3xl font-black uppercase italic leading-none tracking-tight sm:text-5xl">Everton <span className="text-sky-400">Card Tracker</span></h1>
            <p className="mt-3 text-sm text-blue-100/70 sm:text-base">Our Blues. Our collection.</p>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-blue-100 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Personal collection</div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 border-b border-sky-400/15 bg-[#04132b]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 sm:px-8">
          <Link href="/" className="shrink-0 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20">Home</Link>
          <Link href="/everton" className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-blue-100 hover:bg-white/10">Collections</Link>
          <Link href="/orders" className="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-blue-100 hover:bg-white/10"><ShoppingCart size={16}/> Orders</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
        {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        <section className="grid gap-5 lg:grid-cols-[1.1fr_1.9fr]">
          <div className="rounded-3xl border border-sky-300/20 bg-[linear-gradient(145deg,rgba(12,47,91,.9),rgba(4,17,40,.95))] p-6 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-100"><Trophy size={17} className="text-amber-300"/> My collection progress</div>
            <div className="flex items-center gap-6">
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#0ea5e9 ${stats.progress}%, #18365d 0)` }}>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#071a37] text-2xl font-black">{loading ? "—" : `${stats.progress}%`}</div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3"><CheckCircle2 className="text-sky-300" size={18}/><span className="font-bold text-xl">{loading ? "—" : stats.collected.toLocaleString()}</span><span className="text-blue-100/70">Collected</span></div>
                <div className="flex items-center gap-3"><Layers3 className="text-slate-400" size={18}/><span className="font-bold text-xl">{loading ? "—" : stats.missing.toLocaleString()}</span><span className="text-blue-100/70">Still needed</span></div>
                <div className="flex items-center gap-3"><Trophy className="text-amber-300" size={18}/><span className="font-bold text-xl">{loading ? "—" : stats.total.toLocaleString()}</span><span className="text-blue-100/70">Total cards</span></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-3xl border border-sky-300/15 bg-[radial-gradient(ellipse_at_80%_20%,rgba(0,122,255,.24),transparent_45%),linear-gradient(120deg,#071d43,#06132b)] p-7">
            <p className="text-xs font-bold uppercase tracking-[.28em] text-sky-300">Welcome to the collection</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">Every card tells a story.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/70">Keep track of the cards you own, the ones still missing and anything currently on order. Pick a collection below to get started.</p>
            <Link href="/everton" className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-400">Browse Everton cards <ArrowRight size={16}/></Link>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-sky-300">Your cards</p><h2 className="mt-1 text-2xl font-black">Collections</h2></div><span className="text-xs text-blue-100/50">{loading ? "Loading…" : `${stats.total.toLocaleString()} cards in total`}</span></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {collections.map((collection) => (
              <Link key={collection.key} href={collection.href} className={`group relative min-h-48 overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br ${collection.tone} p-5 transition hover:-translate-y-1 hover:border-sky-300/60 hover:shadow-xl hover:shadow-sky-950/50`}>
                <div className="absolute -right-5 -top-7 text-8xl font-black italic text-white/[.06] transition group-hover:text-white/[.12]">{collection.mark}</div>
                <div className="relative flex h-full flex-col">
                  <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-black/20 text-lg font-black text-sky-100">{collection.mark}</div>
                  <h3 className="text-lg font-extrabold">{collection.title}</h3>
                  <p className="mt-1 text-xs text-blue-100/60">{collection.subtitle}</p>
                  <div className="mt-auto flex items-center justify-between pt-5"><span className="text-sm font-bold text-sky-200">{loading ? "—" : (Number(counts[collection.key] ?? 0)).toLocaleString()} cards</span><ArrowRight size={18} className="text-sky-300 transition group-hover:translate-x-1"/></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-blue-100/35">Everton Card Tracker · Collect · Track · Complete</footer>
    </main>
  );
}
