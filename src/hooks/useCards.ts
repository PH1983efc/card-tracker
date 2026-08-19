"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Card, Collection, SortBy, FilterStatus } from "../types";

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/read");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load cards");

      const parsed: Card[] = data.cards.map((c: Card) => ({
        ...c,
        imageUrl: c.imageUrl || undefined,
      }));

      setCards(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load cards";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const cardKey = (card: Card) => `${card.sheet}-${card.rowIndex}`;

  const toggleGot = useCallback(async (card: Card, got: boolean) => {
    const key = `${card.sheet}-${card.rowIndex}`;
    setUpdating((prev) => new Set(prev).add(key));

    setCards((prev) =>
      prev.map((c) =>
        c.sheet === card.sheet && c.rowIndex === card.rowIndex ? { ...c, got } : c
      )
    );

    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: card.sheet, rowIndex: card.rowIndex, got }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Update failed");
    } catch {
      setCards((prev) =>
        prev.map((c) =>
          c.sheet === card.sheet && c.rowIndex === card.rowIndex ? { ...c, got: !got } : c
        )
      );
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const collections = useMemo((): Collection[] => {
    const map = new Map<string, Card[]>();
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

  return { cards, collections, loading, error, updating, toggleGot, refetch: fetchCards, cardKey };
}

export function filterAndSort(
  cards: Card[],
  search: string,
  status: FilterStatus,
  sortBy: SortBy,
  variantFilter: string
): Card[] {
  let filtered = [...cards];

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.playerName.toLowerCase().includes(q) ||
        c.cardNo.toLowerCase().includes(q) ||
        c.variant.toLowerCase().includes(q) ||
        c.cardDescription.toLowerCase().includes(q)
    );
  }

  if (status === "got") filtered = filtered.filter((c) => c.got);
  else if (status === "need") filtered = filtered.filter((c) => c.collecting && !c.got);
  else if (status === "collecting") filtered = filtered.filter((c) => c.collecting);

  if (variantFilter && variantFilter !== "all") {
    filtered = filtered.filter((c) => c.variant === variantFilter);
  }

  filtered.sort((a, b) => {
    if (sortBy === "cardNo") return parseInt(a.cardNo) - parseInt(b.cardNo);
    if (sortBy === "playerName") return a.playerName.localeCompare(b.playerName);
    return a.variant.localeCompare(b.variant);
  });

  return filtered;
}
