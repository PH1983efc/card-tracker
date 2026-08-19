import { useState } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { Card, Collection, SortBy, FilterStatus } from '../types';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  cards: Card[];
}

export default function ExportModal({ open, onClose, collections, cards }: ExportModalProps) {
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(
    new Set(collections.map((c) => c.name))
  );
  const [sortBy, setSortBy] = useState<SortBy>('cardNo');
  const [status, setStatus] = useState<FilterStatus>('all');

  const toggleCollection = (name: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExport = () => {
    let filtered = cards.filter((c) => {
      const key = `${c.year} – ${c.cardSet}`;
      return selectedCollections.has(key);
    });

    if (status === 'got') filtered = filtered.filter((c) => c.got);
    else if (status === 'need') filtered = filtered.filter((c) => c.collecting && !c.got);
    else if (status === 'collecting') filtered = filtered.filter((c) => c.collecting);

    filtered.sort((a, b) => {
      if (sortBy === 'cardNo') return parseInt(a.cardNo) - parseInt(b.cardNo);
      if (sortBy === 'playerName') return a.playerName.localeCompare(b.playerName);
      return a.variant.localeCompare(b.variant);
    });

    const data = filtered.map((c) => ({
      'Card No.': c.cardNo,
      'Player': c.playerName,
      'Set': c.cardSet,
      'Year': c.year,
      'Variant': c.variant,
      'Description': c.cardDescription,
      'Collecting': c.collecting ? 'Yes' : 'No',
      'Got': c.got ? '✅ Yes' : '❌ No',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cards');
    XLSX.writeFile(wb, 'card-collection.xlsx');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Export to Excel</h2>
            <p className="text-sm text-gray-400">Pick collections to include and how to sort.</p>
          </div>
        </div>

        {/* Collections */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
            Collections to Include
          </label>
          <div className="max-h-40 overflow-y-auto space-y-1 border border-white/5 rounded-xl p-2 bg-gray-800/30">
            {collections.map((col) => (
              <label key={col.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCollections.has(col.name)}
                  onChange={() => toggleCollection(col.name)}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300 truncate">{col.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{col.totalCards}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sort + Status */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="cardNo">Card No.</option>
              <option value="playerName">Player Name</option>
              <option value="variant">Variant</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FilterStatus)}
              className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Cards</option>
              <option value="collecting">Collecting</option>
              <option value="got">Got</option>
              <option value="need">Need</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Download className="h-5 w-5" />
          Export {selectedCollections.size} collection{selectedCollections.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
