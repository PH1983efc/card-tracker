import { Folder, ChevronRight } from 'lucide-react';
import { Collection } from '../types';

interface CollectionSidebarProps {
  collections: Collection[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export default function CollectionSidebar({ collections, selected, onSelect }: CollectionSidebarProps) {
  const totalGot = collections.reduce((s, c) => s + c.gotCards, 0);
  const totalCards = collections.reduce((s, c) => s + c.totalCards, 0);

  return (
    <div className="bg-gray-900/50 border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Folder className="h-4 w-4 text-indigo-400" />
          Collections
        </h2>
      </div>

      <div className="p-2 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* All cards button */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            selected === null
              ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
              : 'hover:bg-white/5 text-gray-400 border border-transparent'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">All Collections</p>
            <p className="text-xs text-gray-500">{totalCards} cards · {totalGot} got</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
        </button>

        {/* Individual collections */}
        {collections.map((col) => {
          const progress = col.collectingCards > 0 ? Math.round((col.gotCards / col.collectingCards) * 100) : 0;
          return (
            <button
              key={col.name}
              onClick={() => onSelect(col.name)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                selected === col.name
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                  : 'hover:bg-white/5 text-gray-400 border border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{col.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{col.gotCards}/{col.collectingCards}</span>
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
