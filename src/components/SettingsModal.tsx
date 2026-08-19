import { X, Info, Server, Database, Sheet } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Info className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">How Saving Works</h2>
            <p className="text-sm text-gray-400">Backend integration guide</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
          When you toggle a card, the page calls your backend. You need two API routes:
        </p>

        <div className="space-y-4">
          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-400">GET /api/read</h3>
            </div>
            <code className="text-xs text-gray-400 block bg-black/30 rounded-lg p-3 overflow-x-auto">
              {'{ "success": true, "rows": [["id","year","set",...], ...] }'}
            </code>
          </div>

          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-blue-400">POST /api/update</h3>
            </div>
            <code className="text-xs text-gray-400 block bg-black/30 rounded-lg p-3 overflow-x-auto">
              {'{ "id": "card-id", "got": true }'}
            </code>
          </div>

          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sheet className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-bold text-purple-400">Your Setup (Vercel + Google Sheets)</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              You already have this working. Make sure <code className="text-indigo-400">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code className="text-indigo-400">GOOGLE_PRIVATE_KEY</code> and <code className="text-indigo-400">SHEET_ID</code> are set in your Vercel environment variables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
