"use client";

import { X, Download, FileSpreadsheet } from "lucide-react";
import type { Collection, Card } from "../types";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  cards: Card[];
}

export default function ExportModal({
  open,
  onClose,
  collections,
  cards,
}: ExportModalProps) {
  if (!open) return null;

  const handleExport = async (scope: "all" | string) => {
    try {
      const XLSX = await import("xlsx");
      const exportCards =
        scope === "all"
          ? cards
          : cards.filter((c) => `${c.year} – ${c.cardSet}` === scope);

      const data = exportCards.map((c) => ({
        "Card ID": c.id,
        Year: c.year,
        "Card Set": c.cardSet,
        "Card No.": c.cardNo,
        "Player Name": c.playerName,
        Description: c.cardDescription,
        Variant: c.variant,
        Collecting: c.collecting ? "Yes" : "No",
        Got: c.got ? "Yes" : "No",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cards");
      XLSX.writeFile(
        wb,
        `card-collection-${scope === "all" ? "all" : "collection"}.xlsx`
      );
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Download className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Export Collection</h2>
            <p className="text-sm text-gray-400">Download as Excel file</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleExport("all")}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-gray-800/50 hover:bg-gray-800 transition-all"
          >
            <FileSpreadsheet className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">All Cards</p>
              <p className="text-xs text-gray-500">
                {cards.length} cards across all collections
              </p>
            </div>
          </button>

          {collections.map((col) => (
            <button
              key={col.name}
              onClick={() => handleExport(col.name)}
              className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-gray-800/50 hover:bg-gray-800 transition-all"
            >
              <FileSpreadsheet className="h-5 w-5 text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {col.name}
                </p>
                <p className="text-xs text-gray-500">
                  {col.totalCards} cards · {col.gotCards} got
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
