"use client";

import { Folder, ChevronRight } from "lucide-react";
import type { Collection } from "../types";

interface CollectionSidebarProps {
  collections: Collection[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export default function CollectionSidebar({
  collections,
  selected,
  onSelect,
}: CollectionSidebarProps) {
  const totalGot = collections.reduce((s, c) => s + c.gotCards, 0);
  const totalCards = collections.reduce((s, c) => s + c.totalCards, 0);

  return (
    <div className="bg-[#071a37]/90 border border-sky-300/15 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-sky-300/15">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Folder className="h-4 w-4 text-sky-300" />
          Collections
        </h2>
      </div>

      <div className="p-2 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* All cards button */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            selected === null
              ? "bg-sky-500/20 border border-sky-400/30 text-white"
              : "hover:bg-sky-400/10 text-blue-100/70 border border-transparent"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">All Collections</p>
            <p className="text-xs text-blue-100/55">
              {totalCards} cards · {totalGot} got
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
        </button>

        {/* Individual collections */}
        {collections.map((col) => {
          const progress =
            col.collectingCards > 0
              ? Math.round((col.gotCards / col.collectingCards) * 100)
              : 0;
          return (
            <button
              key={col.name}
              onClick={() => onSelect(col.name)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                selected === col.name
                  ? "bg-sky-500/20 border border-sky-400/30 text-white"
                  : "hover:bg-sky-400/10 text-blue-100/70 border border-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{col.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-[#102d56] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-blue-100/55 font-medium">
                    {col.gotCards}/{col.collectingCards}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
