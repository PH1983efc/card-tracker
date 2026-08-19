"use client";

import { useState, useMemo } from "react";
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
import { AlertCircle, Layers, Menu, X } from "lucide-react";

type TrackerSheet =
  | "all"
  | "master"
  | "donruss"
  | "topps-now"
  | "extra-collections";

export default function CardTracker({
  initialSheet = "all",
}: {
  initialSheet?: TrackerSheet;
}) {
  const {
    cards: allCards,
    loading,
    error,
    updating,
    toggleGot,
    refetch,
  } = useCards();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("cardNo");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [variantFilter, setVariantFilter] = useState("all");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const cards = useMemo(() => {
    if (initialSheet === "all") return allCards;
    return allCards.filter((card) => card.sheet === initialSheet);
  }, [allCards, initialSheet]);

  const collections = useMemo((): Collection[] => {
    const map = new Map<string, typeof cards>();

    cards.forEach((card) => {
      const key = `${card.year} – ${card.cardSet}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    });

    return Array.from(map.entries()).map(([name, colCards]) => ({
      name,
      year: colCards[0]?.year || "",
      cards: colCards,
      totalCards: colCards.length,
      gotCards: colCards.filter((c) => c.got).length,
      collectingCards: colCards.filter((c) => c.collecting).length,
    }));
  }, [cards]);

  const collectionCards = useMemo(() => {
    if (selectedCollection === null) return cards;

    return cards.filter(
      (card) => `${card.year} – ${card.cardSet}` === selectedCollection
    );
  }, [cards, selectedCollection]);

  const variants = useMemo(() => {
    const set = new Set(collectionCards.map((card) => card.variant));
    return Array.from(set).sort();
  }, [collectionCards]);

  const filteredCards = useMemo(
    () => filterAndSort(collectionCards, search, status, sortBy, variantFilter),
    [collectionCards, search, status, sortBy, variantFilter]
  );

  const totalCards = collectionCards.length;
  const gotCards = collectionCards.filter((card) => card.got).length;
  const collectingCards = collectionCards.filter((card) => card.collecting).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <Header
        totalCards={totalCards}
        gotCards={gotCards}
        collectingCards={collectingCards}
        onRefresh={refetch}
        onExport={() => setShowExport(true)}
        onSettings={() => setShowSettings(true)}
        loading={loading}
      />

      <nav className="border-b border-white/5 bg-gray-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 ${
              initialSheet === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            All Collections
          </Link>

          <Link
            href="/donruss"
            className={`rounded-lg px-3 py-2 ${
              initialSheet === "donruss"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            Donruss
          </Link>

          <Link
            href="/topps-now"
            className={`rounded-lg px-3 py-2 ${
              initialSheet === "topps-now"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            Topps Now
          </Link>

          <Link
            href="/extra-collections"
            className={`rounded-lg px-3 py-2 ${
              initialSheet === "extra-collections"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-300 hover:text-white"
            }`}
          >
            Extra Collections
          </Link>

          <Link
            href="/orders"
            className="rounded-lg bg-white/5 px-3 py-2 text-gray-300 hover:text-white"
          >
            Orders
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-all bg-gray-900/50 border border-white/5 rounded-xl px-4 py-2"
        >
          {showSidebar ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
          {selectedCollection || "All Collections"}
        </button>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">
                Error loading cards
              </p>
              <p className="text-xs text-red-300/70">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="ml-auto text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="flex gap-6">
            <div
              className={`${
                showSidebar ? "block" : "hidden"
              } lg:block w-full lg:w-72 shrink-0`}
            >
              <div className="sticky top-20">
                <CollectionSidebar
                  collections={collections}
                  selected={selectedCollection}
                  onSelect={(name) => {
                    setSelectedCollection(name);
                    setVariantFilter("all");
                    setShowSidebar(false);
                  }}
                />
              </div>
            </div>

            <div
              className={`flex-1 min-w-0 space-y-4 ${
                showSidebar ? "hidden lg:block" : ""
              }`}
            >
              {selectedCollection && (
                <div className="flex items-center gap-3 mb-2">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">
                    {selectedCollection}
                  </h2>
                </div>
              )}

              <FilterBar
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                sortBy={sortBy}
                onSortChange={setSortBy}
                viewMode={viewMode}
                onViewChange={setViewMode}
                variantFilter={variantFilter}
                onVariantChange={setVariantFilter}
                variants={variants}
                resultCount={filteredCards.length}
              />

              {filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Layers className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No cards found</p>
                  <p className="text-sm">
                    Try adjusting your filters or search.
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {filteredCards.map((card) => (
                    <CardItem
                      key={`${card.sheet}-${card.rowIndex}`}
                      card={card}
                      viewMode={viewMode}
                      updating={updating.has(`${card.sheet}-${card.rowIndex}`)}
                      onToggleGot={toggleGot}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCards.map((card) => (
                    <CardItem
                      key={`${card.sheet}-${card.rowIndex}`}
                      card={card}
                      viewMode={viewMode}
                      updating={updating.has(`${card.sheet}-${card.rowIndex}`)}
                      onToggleGot={toggleGot}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        collections={collections}
        cards={cards}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSyncComplete={refetch}
      />
    </div>
  );
}
