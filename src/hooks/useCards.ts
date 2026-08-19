import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Collection, SortBy, FilterStatus } from '../types';

const API_BASE = '';

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/read`);
      const data = await res.json();

      if (!data.success) throw new Error('Failed to load cards');

      const rows: string[][] = data.rows;
      const parsed: Card[] = rows.slice(1).map((row) => ({
        id: row[0] || '',
        year: row[1] || '',
        cardSet: row[2] || '',
        cardNo: row[3] || '',
        playerName: (row[4] || '').replace(/,\s*$/, ''),
        cardDescription: row[5] || '',
        variant: row[6] || '',
        collecting: row[7] === 'TRUE',
        got: row[8] === 'TRUE',
        imageUrl: row[9] || undefined,
      }));

      setCards(parsed);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const toggleGot = useCallback(async (cardId: string, got: boolean) => {
    setUpdating((prev) => new Set(prev).add(cardId));
    
    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, got } : c))
    );

    try {
      const res = await fetch(`${API_BASE}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, got }),
      });
      const data = await res.json();
      if (!data.success) throw new Error('Update failed');
    } catch {
      // Revert on failure
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, got: !got } : c))
      );
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
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

    return Array.from(map.entries()).map(([name, cards]) => ({
      name,
      year: cards[0]?.year || '',
      cards,
      totalCards: cards.length,
      gotCards: cards.filter((c) => c.got).length,
      collectingCards: cards.filter((c) => c.collecting).length,
    }));
  }, [cards]);

  return { cards, collections, loading, error, updating, toggleGot, refetch: fetchCards };
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

  if (status === 'got') filtered = filtered.filter((c) => c.got);
  else if (status === 'need') filtered = filtered.filter((c) => c.collecting && !c.got);
  else if (status === 'collecting') filtered = filtered.filter((c) => c.collecting);

  if (variantFilter && variantFilter !== 'all') {
    filtered = filtered.filter((c) => c.variant === variantFilter);
  }

  filtered.sort((a, b) => {
    if (sortBy === 'cardNo') return parseInt(a.cardNo) - parseInt(b.cardNo);
    if (sortBy === 'playerName') return a.playerName.localeCompare(b.playerName);
    return a.variant.localeCompare(b.variant);
  });

  return filtered;
}
