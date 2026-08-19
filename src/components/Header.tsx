"use client";

import { Layers, RefreshCw, Download, Settings } from "lucide-react";

interface HeaderProps {
  totalCards: number;
  gotCards: number;
  collectingCards: number;
  onRefresh: () => void;
  onExport: () => void;
  onSettings: () => void;
  loading: boolean;
}

export default function Header({
  totalCards,
  gotCards,
  collectingCards,
  onRefresh,
  onExport,
  onSettings,
  loading,
}: HeaderProps) {
  const needCards = collectingCards - gotCards;
  const progress =
    collectingCards > 0 ? Math.round((gotCards / collectingCards) * 100) : 0;

  return (
    <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Card Tracker
              </h1>
              <p className="text-xs text-gray-500 leading-tight">
                Collection Manager
              </p>
            </div>
          </div>

          {/* Stats - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Total
                </p>
                <p className="text-lg font-bold text-white">
                  {totalCards.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Got
                </p>
                <p className="text-lg font-bold text-emerald-400">
                  {gotCards.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Need
                </p>
                <p className="text-lg font-bold text-amber-400">
                  {Math.max(0, needCards).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Progress
              </p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white">
                  {progress}%
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              title="Refresh"
            >
              <RefreshCw
                className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onExport}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              title="Export"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={onSettings}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stats - Mobile */}
        <div className="md:hidden pb-3 flex items-center gap-4 text-xs">
          <span className="text-gray-400">
            Total: <strong className="text-white">{totalCards}</strong>
          </span>
          <span className="text-gray-400">
            Got: <strong className="text-emerald-400">{gotCards}</strong>
          </span>
          <span className="text-gray-400">
            Need:{" "}
            <strong className="text-amber-400">{Math.max(0, needCards)}</strong>
          </span>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white font-bold">{progress}%</span>
          </div>
        </div>
      </div>
    </header>
  );
}
