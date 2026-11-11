"use client";

import { Search, Grid3X3, List, SlidersHorizontal } from "lucide-react";
import type { SortBy, FilterStatus, ViewMode } from "../types";

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: FilterStatus;
  onStatusChange: (val: FilterStatus) => void;
  sortBy: SortBy;
  onSortChange: (val: SortBy) => void;
  viewMode: ViewMode;
  onViewChange: (val: ViewMode) => void;
  variantFilter: string;
  onVariantChange: (val: string) => void;
  variants: string[];
  resultCount: number;
}

const statusOptions: { value: FilterStatus; label: string; color: string }[] = [
  { value: "all", label: "All", color: "bg-gray-700" },
  { value: "collecting", label: "Collecting", color: "bg-sky-500" },
  { value: "got", label: "Got", color: "bg-emerald-600" },
  { value: "need", label: "Need", color: "bg-amber-600" },
];

export default function FilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewChange,
  variantFilter,
  onVariantChange,
  variants,
  resultCount,
}: FilterBarProps) {
  return (
    <div className="bg-[#071a37]/90 border border-sky-300/15 rounded-2xl p-4 space-y-4">
      {/* Row 1: Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-100/55" />
          <input
            type="text"
            placeholder="Search by player, card number, or variant..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0b2347]/80 border border-sky-300/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-blue-100/55 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50 transition-all"
          />
        </div>
        <div className="flex bg-[#0b2347]/80 border border-sky-300/20 rounded-xl overflow-hidden">
          <button
            onClick={() => onViewChange("grid")}
            className={`p-2.5 transition-all ${
              viewMode === "grid"
                ? "bg-sky-500 text-white"
                : "text-blue-100/70 hover:text-white"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={`p-2.5 transition-all ${
              viewMode === "list"
                ? "bg-sky-500 text-white"
                : "text-blue-100/70 hover:text-white"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Status + Sort + Variant */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                status === opt.value
                  ? `${opt.color} text-white shadow-lg`
                  : "bg-[#0b2347]/80 text-blue-100/70 hover:text-white hover:bg-[#102d56]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <SlidersHorizontal className="h-4 w-4 text-blue-100/55" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortBy)}
            className="bg-[#0b2347]/80 border border-sky-300/20 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-100/85 focus:outline-none focus:ring-1 focus:ring-sky-400 appearance-none cursor-pointer"
          >
            <option value="cardNo">Sort: Card No.</option>
            <option value="playerName">Sort: Player</option>
            <option value="variant">Sort: Variant</option>
          </select>
          <select
            value={variantFilter}
            onChange={(e) => onVariantChange(e.target.value)}
            className="bg-[#0b2347]/80 border border-sky-300/20 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-100/85 focus:outline-none focus:ring-1 focus:ring-sky-400 appearance-none cursor-pointer max-w-[180px] truncate"
          >
            <option value="all">All Variants</option>
            {variants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-blue-100/55 sm:ml-2">
          {resultCount} cards
        </span>
      </div>
    </div>
  );
}
