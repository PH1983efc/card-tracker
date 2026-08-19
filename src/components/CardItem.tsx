"use client";

import { Check, Loader2, ImageIcon } from "lucide-react";
import type { Card, ViewMode } from "../types";
import { useState } from "react";

interface CardItemProps {
  card: Card;
  viewMode: ViewMode;
  updating: boolean;
  onToggleGot: (id: string, got: boolean, rowIndex: number) => void;
}

function getVariantColor(variant: string): string {
  const v = variant.toLowerCase();
  if (v.includes("gold"))
    return "from-yellow-500/20 to-amber-600/20 border-yellow-500/30";
  if (v.includes("netbuster"))
    return "from-red-500/20 to-orange-600/20 border-red-500/30";
  if (v.includes("voltage"))
    return "from-yellow-400/20 to-lime-500/20 border-yellow-400/30";
  if (v.includes("premier league parallel"))
    return "from-purple-500/20 to-pink-600/20 border-purple-500/30";
  if (v.includes("foil") || v.includes("refractor"))
    return "from-cyan-500/20 to-blue-600/20 border-cyan-500/30";
  if (v.includes("rainbow"))
    return "from-pink-500/20 to-purple-600/20 border-pink-500/30";
  if (v.includes("base"))
    return "from-gray-500/10 to-gray-600/10 border-gray-500/20";
  return "from-indigo-500/10 to-blue-600/10 border-indigo-500/20";
}

function getVariantBadgeColor(variant: string): string {
  const v = variant.toLowerCase();
  if (v.includes("gold")) return "bg-yellow-500/20 text-yellow-300";
  if (v.includes("netbuster")) return "bg-red-500/20 text-red-300";
  if (v.includes("voltage")) return "bg-yellow-400/20 text-yellow-200";
  if (v.includes("premier league parallel"))
    return "bg-purple-500/20 text-purple-300";
  if (v.includes("foil") || v.includes("refractor"))
    return "bg-cyan-500/20 text-cyan-300";
  if (v.includes("rainbow")) return "bg-pink-500/20 text-pink-300";
  if (v.includes("base")) return "bg-gray-500/20 text-gray-300";
  return "bg-indigo-500/20 text-indigo-300";
}

export default function CardItem({
  card,
  viewMode,
  updating,
  onToggleGot,
}: CardItemProps) {
  const [imgError, setImgError] = useState(false);

  if (viewMode === "list") {
    return (
      <div
        className={`flex items-center gap-4 p-3 rounded-xl border transition-all hover:bg-white/[0.02] ${
          card.got
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-white/5 bg-gray-900/30"
        }`}
      >
        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
          #{card.cardNo}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {card.playerName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getVariantBadgeColor(
                card.variant
              )}`}
            >
              {card.variant}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {card.cardDescription}
            </span>
          </div>
        </div>

        {card.collecting && (
          <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
            Collecting
          </span>
        )}

        <button
          onClick={() => onToggleGot(card.id, !card.got, card.rowIndex)}
          disabled={updating}
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            card.got
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
          } ${updating ? "opacity-50" : ""}`}
        >
          {updating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={`group relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 bg-gradient-to-br ${getVariantColor(
        card.variant
      )} ${card.got ? "ring-2 ring-emerald-500/50" : ""}`}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-gray-800/50">
        {card.imageUrl && !imgError ? (
          <img
            src={card.imageUrl}
            alt={card.playerName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
            <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
            <span className="text-3xl font-black opacity-20">
              #{card.cardNo}
            </span>
          </div>
        )}

        {card.got && (
          <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
              <Check className="h-8 w-8 text-white" strokeWidth={3} />
            </div>
          </div>
        )}

        <div
          className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md ${getVariantBadgeColor(
            card.variant
          )}`}
        >
          {card.variant}
        </div>

        {card.collecting && (
          <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-500/80 text-white backdrop-blur-md">
            Collecting
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">
              {card.playerName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              #{card.cardNo} · {card.cardDescription}
            </p>
          </div>
          <button
            onClick={() => onToggleGot(card.id, !card.got, card.rowIndex)}
            disabled={updating}
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              card.got
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white"
            } ${updating ? "opacity-50" : ""}`}
          >
            {updating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
