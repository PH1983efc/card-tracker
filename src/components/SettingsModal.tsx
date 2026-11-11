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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#071a37] border border-sky-300/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-blue-100/55 hover:text-white" aria-label="Close settings">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-sky-400/15 rounded-xl flex items-center justify-center">
            <Info className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">How It Works</h2>
            <p className="text-sm text-blue-100/70">Backend information</p>
          </div>
        </div>
        <p className="text-sm text-blue-100/85 mb-6 leading-relaxed">
          Your card collections and purchase orders are stored in the tracker database. Changes are saved directly to Neon.
        </p>
        <div className="space-y-4">
          <div className="bg-[#0b2347]/80 border border-sky-300/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-400">GET /api/cards</h3>
            </div>
            <p className="text-xs text-blue-100/70 leading-relaxed">Loads all four collections from the database.</p>
          </div>
          <div className="bg-[#0b2347]/80 border border-sky-300/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-blue-400">POST /api/update</h3>
            </div>
            <p className="text-xs text-blue-100/70 leading-relaxed">Saves card ownership changes using the permanent database card ID.</p>
          </div>
          <div className="bg-[#0b2347]/80 border border-sky-300/20 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-100/85 mb-2">Database</h3>
            <p className="text-xs text-blue-100/70">Neon PostgreSQL. Preview uses the isolated testing branch; Production uses the live database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
