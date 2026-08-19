export interface Card {
  id: string;
  year: string;
  cardSet: string;
  cardNo: string;
  playerName: string;
  cardDescription: string;
  variant: string;
  collecting: boolean;
  got: boolean;
  imageUrl?: string;
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
