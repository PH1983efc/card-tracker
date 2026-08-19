"use client";

import { X, Info, Server, Database } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) return null;

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
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Info className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">How It Works</h2>
            <p className="text-sm text-gray-400">Backend information</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
          This card tracker reads your collection live from Google Sheets. When
          you toggle a card, the change is saved back to the sheet instantly.
        </p>

        <div className="space-y-4">
          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-400">
                GET /api/read
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Reads all cards from the Master sheet in your Google Spreadsheet.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-blue-400">
                POST /api/update
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Toggles the &ldquo;Got&rdquo; status of a card. Updates the cell
              directly in your Google Sheet.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-2">
              Environment Variables
            </h3>
            <div className="space-y-1">
              <code className="block text-[11px] text-indigo-300 bg-gray-900 px-2 py-1 rounded">
                GOOGLE_SERVICE_ACCOUNT_EMAIL
              </code>
              <code className="block text-[11px] text-indigo-300 bg-gray-900 px-2 py-1 rounded">
                GOOGLE_PRIVATE_KEY
              </code>
              <code className="block text-[11px] text-indigo-300 bg-gray-900 px-2 py-1 rounded">
                SHEET_ID
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
