"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Card, Collection, SortBy, FilterStatus } from "../types";

type CardsResponse = { success: boolean; cards?: Card[]; error?: string };

export function useCards() {
  const [cardsBySheet, setCardsBySheet] = useState<Record<string, Card[]>>({
    master: [],
    donruss: [],
    "topps-now": [],
    "extra-collections": [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/cards", { cache: "no-store" });
      const data = (await response.json()) as CardsResponse;
      if (!response.ok || !data.success || !data.cards) {
        throw new Error(data.error || `Unable to load cards (HTTP ${response.status}).`);
      }

      const next: Record<string, Card[]> = {
        master: [],
        donruss: [],
        "topps-now": [],
        "extra-collections": [],
      };
      for (const card of data.cards) {
        if (next[card.sheet]) next[card.sheet].push(card);
      }
      setCardsBySheet(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
      setCardsBySheet({ master: [], donruss: [], "topps-now": [], "extra-collections": [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCards(); }, [fetchCards]);

  const toggleGot = useCallback(async (card: Card, got: boolean) => {
    const key = card.databaseId;
    const previous = card.got;
    setUpdating((prev) => new Set(prev).add(key));
    setCardsBySheet((prev) => ({
      ...prev,
      [card.sheet]: prev[card.sheet].map((item) => item.databaseId === key ? { ...item, got } : item),
    }));

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: key, got }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Update failed");
    } catch (err) {
      setCardsBySheet((prev) => ({
        ...prev,
        [card.sheet]: prev[card.sheet].map((item) => item.databaseId === key ? { ...item, got: previous } : item),
      }));
      setError(err instanceof Error ? err.message : "Could not save the card update.");
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const allCards = useMemo(() => Object.values(cardsBySheet).flat(), [cardsBySheet]);
  const collections = useMemo((): Collection[] => {
    const map = new Map<string, Card[]>();
    allCards.forEach((card) => {
      const key = `${card.year} – ${card.cardSet}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    });
    return Array.from(map.entries()).map(([name, colCards]) => ({
      name,
      year: colCards[0]?.year || "",
      cards: colCards,
      totalCards: colCards.length,
      gotCards: colCards.filter((card) => card.got).length,
      collectingCards: colCards.filter((card) => card.collecting).length,
    }));
  }, [allCards]);

  return { cards: allCards, collections, loading, error, updating, toggleGot, refetch: fetchCards };
}

export function filterAndSort(cards: Card[], search: string, status: FilterStatus, sortBy: SortBy, variantFilter: string): Card[] {
  let filtered = [...cards];
  if (search) {
    const query = search.toLowerCase();
    filtered = filtered.filter((card) =>
      card.playerName.toLowerCase().includes(query) ||
      card.cardNo.toLowerCase().includes(query) ||
      card.variant.toLowerCase().includes(query) ||
      card.cardDescription.toLowerCase().includes(query)
    );
  }
  if (status === "got") filtered = filtered.filter((card) => card.got);
  else if (status === "need") filtered = filtered.filter((card) => card.collecting && !card.got);
  else if (status === "collecting") filtered = filtered.filter((card) => card.collecting);
  if (variantFilter && variantFilter !== "all") filtered = filtered.filter((card) => card.variant === variantFilter);
  filtered.sort((a, b) => {
    if (sortBy === "cardNo") return (parseInt(a.cardNo) || 0) - (parseInt(b.cardNo) || 0);
    if (sortBy === "playerName") return a.playerName.localeCompare(b.playerName);
    return a.variant.localeCompare(b.variant);
  });
  return filtered;
}
