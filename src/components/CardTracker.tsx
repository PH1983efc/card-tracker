"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCards, filterAndSort } from "../hooks/useCards";
import type { SortBy, FilterStatus, ViewMode, Collection } from "../types";
import Header from "./Header";
import FilterBar from "./FilterBar";
import CardItem from "./CardItem";
import CollectionSidebar from "./CollectionSidebar";
import ExportModal from "./ExportModal";
import SettingsModal from "./SettingsModal";
import LoadingSkeleton from "./LoadingSkeleton";
import { AlertCircle, ArrowRight, Layers, Menu, X, Trophy, CheckCircle2, Package, ShoppingCart } from "lucide-react";

type TrackerSheet = "all" | "master" | "donruss" | "topps-now" | "extra-collections";

const pageDetails: Record<TrackerSheet, { title: string; eyebrow: string; description: string; mark: string; href: string }> = {
  all: { title: "All collections", eyebrow: "The complete collection", description: "Every card, every collection, all in one place.", mark: "EFC", href: "/" },
  master: { title: "Everton cards", eyebrow: "The main collection", description: "The heart of the collection. Track every Everton card, variant and parallel.", mark: "EFC", href: "/everton" },
  donruss: { title: "Donruss", eyebrow: "The Donruss collection", description: "Keep every Donruss card accounted for, from base cards to the rarest parallels.", mark: "D", href: "/donruss" },
  "topps-now": { title: "Topps Now", eyebrow: "The moment, captured", description: "A season of moments, captured one card at a time.", mark: "NOW", href: "/topps-now" },
  "extra-collections": { title: "Extra collections", eyebrow: "The rest of the collection", description: "Special releases, one-offs and everything that doesn't fit elsewhere.", mark: "★", href: "/extra-collections" },
};

const navigation = [
  { label: "Home", href: "/" },
  { label: "Everton", href: "/everton", sheet: "master" },
  { label: "Donruss", href: "/donruss", sheet: "donruss" },
  { label: "Topps Now", href: "/topps-now", sheet: "topps-now" },
  { label: "Extras", href: "/extra-collections", sheet: "extra-collections" },
  { label: "Orders", href: "/orders" },
];

export default function CardTracker({ initialSheet = "all" }: { initialSheet?: TrackerSheet }) {
  const { cards: allCards, loading, error, updating, toggleGot, refetch } = useCards();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("cardNo");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [variantFilter, setVariantFilter] = useState("all");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const cards = useMemo(() => initialSheet === "all" ? allCards : allCards.filter(card => card.sheet === initialSheet), [allCards, initialSheet]);
  const collections = useMemo((): Collection[] => {
    const map = new Map<string, typeof cards>();
    cards.forEach(card => {
      const key = `${card.year} – ${card.cardSet}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    });
    return Array.from(map.entries()).map(([name, colCards]) => ({
      name, year: colCards[0]?.year || "", cards: colCards, totalCards: colCards.length,
      gotCards: colCards.filter(card => card.got).length,
      collectingCards: colCards.filter(card => card.collecting).length,
    }));
  }, [cards]);
  const collectionCards = useMemo(() => selectedCollection === null ? cards : cards.filter(card => `${card.year} – ${card.cardSet}` === selectedCollection), [cards, selectedCollection]);
  const variants = useMemo(() => Array.from(new Set(collectionCards.map(card => card.variant))).sort(), [collectionCards]);
  const filteredCards = useMemo(() => filterAndSort(collectionCards, search, status, sortBy, variantFilter), [collectionCards, search, status, sortBy, variantFilter]);

  const totalCards = collectionCards.length;
  const gotCards = collectionCards.filter(card => card.got).length;
  const collectingCards = collectionCards.filter(card => card.collecting).length;
  const needCards = Math.max(0, collectingCards - gotCards);
  const onOrder = collectionCards.reduce((sum, card) => sum + (card.onOrderQuantity || 0), 0);
  const progress = collectingCards ? Math.round(gotCards / collectingCards * 100) : 0;
  const page = pageDetails[initialSheet];

  return (
    <main className="min-h-screen bg-[#020b1c] text-white">
      <Header totalCards={totalCards} gotCards={gotCards} collectingCards={collectingCards} onRefresh={refetch}
        onExport={() => setShowExport(true)} onSettings={() => setShowSettings(true)} loading={loading} />

      <nav className="sticky top-0 z-40 border-b border-sky-400/15 bg-[#04132b]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {navigation.map(item => {
            const active = item.sheet === initialSheet;
            return <Link key={item.href} href={item.href} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-blue-100/70 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>;
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="relative mb-7 overflow-hidden rounded-3xl border border-sky-300/20 bg-[radial-gradient(ellipse_at_80%_15%,rgba(14,165,233,.22),transparent_45%),linear-gradient(115deg,#09234b_0%,#061832_55%,#041126_100%)] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="absolute -right-5 -top-12 select-none text-[180px] font-black italic leading-none text-white/[.035]">{page.mark}</div>
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-xs font-black uppercase tracking-[.3em] text-sky-300">{page.eyebrow}</p>
              <h1 className="text-3xl font-black uppercase italic tracking-tight sm:text-5xl">{page.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/70 sm:text-base">{page.description}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-400/10 text-sm font-black text-sky-200">{page.mark}</div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-100/50">Collection progress</p><p className="text-2xl font-black">{loading ? "—" : `${progress}%`}</p></div>
            </div>
          </div>
        </section>

        <section className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-sky-300/15 bg-[#071a37]/80 p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100/55"><Layers size={15} className="text-sky-300"/> Total cards</div><p className="text-2xl font-black sm:text-3xl">{loading ? "—" : totalCards.toLocaleString()}</p><p className="mt-1 text-xs text-blue-100/45">In this collection</p></div>
          <div className="rounded-2xl border border-emerald-400/15 bg-[#071a37]/80 p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100/55"><CheckCircle2 size={15} className="text-emerald-400"/> Collected</div><p className="text-2xl font-black text-emerald-300 sm:text-3xl">{loading ? "—" : gotCards.toLocaleString()}</p><p className="mt-1 text-xs text-blue-100/45">Cards you own</p></div>
          <div className="rounded-2xl border border-amber-400/15 bg-[#071a37]/80 p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100/55"><Trophy size={15} className="text-amber-300"/> Still needed</div><p className="text-2xl font-black text-amber-200 sm:text-3xl">{loading ? "—" : needCards.toLocaleString()}</p><p className="mt-1 text-xs text-blue-100/45">Remaining to collect</p></div>
          <div className="rounded-2xl border border-sky-300/15 bg-[#071a37]/80 p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-100/55"><Package size={15} className="text-sky-300"/> On order</div><p className="text-2xl font-black text-sky-200 sm:text-3xl">{loading ? "—" : onOrder.toLocaleString()}</p><p className="mt-1 text-xs text-blue-100/45">Copies on their way</p></div>
        </section>

        <div className="mb-4 flex items-center justify-between lg:hidden">
          <button onClick={() => setShowSidebar(!showSidebar)} className="flex items-center gap-2 rounded-xl border border-sky-300/20 bg-[#071a37] px-4 py-2.5 text-sm text-blue-100"><Menu size={16}/>{selectedCollection || "All sets"}{showSidebar ? <X size={15}/> : <ArrowRight size={15}/>}</button>
          <span className="text-xs text-blue-100/50">{filteredCards.length.toLocaleString()} results</span>
        </div>

        {error && <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4"><AlertCircle className="h-5 w-5 shrink-0 text-red-300"/><div><p className="text-sm font-bold text-red-200">Unable to load or save cards</p><p className="text-xs text-red-200/70">{error}</p></div><button onClick={refetch} className="ml-auto rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200">Retry</button></div>}

        {loading ? <LoadingSkeleton/> : (
          <div className="flex items-start gap-6">
            <aside className={`${showSidebar ? "block" : "hidden"} w-full shrink-0 lg:sticky lg:top-36 lg:block lg:w-72`}>
              <CollectionSidebar collections={collections} selected={selectedCollection} onSelect={name => { setSelectedCollection(name); setVariantFilter("all"); setShowSidebar(false); }}/>
            </aside>
            <section className={`min-w-0 flex-1 space-y-4 ${showSidebar ? "hidden lg:block" : ""}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">Browse your cards</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{selectedCollection || page.title}</h2></div>
                <span className="text-xs text-blue-100/50">{filteredCards.length.toLocaleString()} cards shown</span>
              </div>
              <FilterBar search={search} onSearchChange={setSearch} status={status} onStatusChange={setStatus} sortBy={sortBy} onSortChange={setSortBy}
                viewMode={viewMode} onViewChange={setViewMode} variantFilter={variantFilter} onVariantChange={setVariantFilter} variants={variants} resultCount={filteredCards.length}/>
              {filteredCards.length === 0 ? <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-sky-300/20 bg-[#071a37]/40 py-20 text-blue-100/55"><Layers className="mb-4 h-12 w-12 opacity-30"/><p className="text-lg font-bold text-white">No cards found</p><p className="text-sm">Try adjusting your filters or search.</p></div> : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{filteredCards.map(card => <CardItem key={`${card.sheet}-${card.rowIndex}-${card.databaseId}`} card={card} viewMode={viewMode} updating={updating.has(card.databaseId)} onToggleGot={toggleGot}/>)}</div>
              ) : <div className="space-y-2">{filteredCards.map(card => <CardItem key={`${card.sheet}-${card.rowIndex}-${card.databaseId}`} card={card} viewMode={viewMode} updating={updating.has(card.databaseId)} onToggleGot={toggleGot}/>)}</div>}
            </section>
          </div>
        )}
      </div>

      <footer className="mt-10 border-t border-white/10 px-4 py-6 text-center text-xs text-blue-100/35">Everton Card Tracker · Collect · Track · Complete</footer>
      <ExportModal open={showExport} onClose={() => setShowExport(false)} collections={collections} cards={cards}/>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onSyncComplete={refetch}/>
    </main>
  );
}
