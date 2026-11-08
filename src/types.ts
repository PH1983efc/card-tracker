export interface Card {
  /** Stable PostgreSQL identity used for updates. */
  databaseId: string;
  /** Original card ID from the source spreadsheet. */
  id: string;
  year: string;
  cardSet: string;
  cardNo: string;
  playerName: string;
  cardDescription: string;
  variant: string;
  collecting: boolean;
  got: boolean;
  /** Number of copies currently ordered but not yet received. */
  onOrderQuantity: number;
  imageUrl?: string;
  rowIndex: number;
  sheet: string;
}

export interface Collection {
  name: string;
  year: string;
  cards: Card[];
  totalCards: number;
  gotCards: number;
  collectingCards: number;
}

export type SortBy = "cardNo" | "playerName" | "variant";
export type FilterStatus = "all" | "got" | "need" | "collecting";
export type ViewMode = "grid" | "list";
