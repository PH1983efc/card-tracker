"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Card, Collection, SortBy, FilterStatus } from "../types";

function toBool(v: string | undefined) {
  return v?.trim().toUpperCase() === "TRUE";
}

function cleanName(name: string) {
  return (name || "").replace(/,\s*$/, "").trim();
}

// ✅ FIXED: Each sheet has different column layouts
function parseMaster(rows: string[][]): Card[] {
  return rows.slice(1).map((row, i) => ({
    id: row[0] || "",
    year: row[1] || "",
    cardSet: row[2] || "",
    cardNo: row[3] || "",
    playerName: cleanName(row[4] || ""),
    cardDescription: row[5] || "",
    variant: row[6] || "Base",
    collecting: toBool(row[7]),
    got: toBool(row[8]),
    imageUrl: row[9] || undefined,
    rowIndex: i + 2,
    sheet: "master",
  }));
}

function parseDonruss(rows: string[][]): Card[] {
  // ["Card ID","Year","Card No.","Player","Team","Card","Got","Image URL"]
  return rows.slice(1).map((row, i) => ({
    id: row[0] || "",
    year: row[1] || "",
    cardSet: "Donruss International",
    cardNo: row[2] || "",
    playerName: cleanName(row[3] || ""),
    cardDescription: "",
    variant: row[5] || "Base",
    collecting: true, // No collecting column in Donruss
    got: toBool(row[6]),
    imageUrl: row[7] || undefined,
    rowIndex: i + 2,
    sheet: "donruss",
  }));
}

function parseToppsNow(rows: string[][]): Card[] {
  // ["Card ID","Year","Card Set","Card No.","Player Name","Print Run","Variant","Date & Description","Collecting","Got","Image"]
  return rows.slice(1).map((row, i) => ({
    id: row[0] || "",
    year: row[1] || "",
    cardSet: row[2] || "Topps Now",
    cardNo: row[3] || "",
    playerName: cleanName(row[4] || ""),
    cardDescription: row[7] || "",
    variant: row[6] || "Base",
    collecting: toBool(row[8]),
    got: toBool(row[9]),
    imageUrl: row[10] || undefined,
    rowIndex: i + 2,
    sheet: "topps-now",
  }));
}

function parseExtraCollections(rows: string[][]): Card[] {
  // ["Card ID","Year","Card Set","Card No.","Player Name","Variant","Collecting","Got","Image"]
  return rows
    .slice(1)
    .filter((row) => row.length >= 6 && row[0])
    .map((row, i) => ({
      id: row[0] || "",
      year: row[1] || "",
      cardSet: row[2] || "",
      cardNo: row[3] || "",
      playerName: cleanName(row[4] || ""),
      cardDescription: "",
      variant: row[5] || "Base",
      collecting: toBool(row[6]),
      got: toBool(row[7]),
      imageUrl: row[8] || undefined,
      rowIndex: i + 2,
      sheet: "extra-collections",
    }));
}

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

  // ✅ FIXED: Fetch ALL 4 sheets in parallel instead of just Master
  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const sheets = [
        { key: "master", parser: parseMaster },
        { key: "donruss", parser: parseDonruss },
        { key: "topps-now", parser: parseToppsNow },
        { key: "extra-collections", parser: parseExtraCollections },
      ];

      const results = await Promise.all(
        sheets.map(async ({ key }) => {
          const res = await fetch(`/api/sheets?sheet=${key}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${key}`);
          return res.json();
        })
      );

      const next: Record<string, Card[]> = {};
      sheets.forEach(({ key, parser }, i) => {
        const data = results[i];
        if (!data.success) throw new Error(data.error || `Failed to load ${key}`);
        const rows: string[][] = data.rows || [];
        next[key] = parser(rows);
      });

      setCardsBySheet(next);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load cards";
      setError(message);
      setCardsBySheet({
        master: [],
        donruss: [],
        "topps-now": [],
        "extra-collections": [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const toggleGot = useCallback(
    async (card: Card, got: boolean) => {
      const key = `${card.sheet}-${card.rowIndex}`;
      setUpdating((prev) => new Set(prev).add(key));

      // Optimistic update
      setCardsBySheet((prev) => ({
        ...prev,
        [card.sheet]: prev[card.sheet].map((c) =>
          c.rowIndex === card.rowIndex ? { ...c, got } : c
        ),
      }));

      try {
        const res = await fetch("/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheet: card.sheet,
            rowIndex: card.rowIndex,
            got,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Update failed");
      } catch {
        // Revert on error
        setCardsBySheet((prev) => ({
          ...prev,
          [card.sheet]: prev[card.sheet].map((c) =>
            c.rowIndex === card.rowIndex ? { ...c, got: !got } : c
          ),
        }));
      } finally {
        setUpdating((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  // ✅ Get all cards from all sheets
  const allCards = useMemo(() => {
    return Object.values(cardsBySheet).flat();
  }, [cardsBySheet]);

  // ✅ Build collections grouped by year + card set (now includes all sheets)
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
      gotCards: colCards.filter((c) => c.got).length,
      collectingCards: colCards.filter((c) => c.collecting).length,
    }));
  }, [allCards]);

  return {
    cards: allCards,
    collections,
    loading,
    error,
    updating,
    toggleGot,
    refetch: fetchCards,
  };
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
    if (sortBy === "cardNo") {
      const an = parseInt(a.cardNo) || 0;
      const bn = parseInt(b.cardNo) || 0;
      return an - bn;
    }
    if (sortBy === "playerName") return a.playerName.localeCompare(b.playerName);
    return a.variant.localeCompare(b.variant);
  });

  return filtered;
}
