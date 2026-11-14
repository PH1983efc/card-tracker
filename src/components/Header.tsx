"use client";

import { RefreshCw, Download, Settings, ShieldCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  totalCards: number;
  gotCards: number;
  collectingCards: number;
  onRefresh: () => void;
  onExport: () => void;
  onSettings: () => void;
  loading: boolean;
}

export default function Header({ totalCards, gotCards, collectingCards, onRefresh, onExport, onSettings, loading }: HeaderProps) {
  const router = useRouter();
  const needCards = Math.max(0, collectingCards - gotCards);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  const progress = collectingCards > 0 ? Math.round((gotCards / collectingCards) * 100) : 0;

  return (
    <header className="relative z-50 border-b border-sky-300/15 bg-[#04132b]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(14,165,233,.13),transparent_60%)] pointer-events-none"/>
      <div className="relative mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-300/30 bg-gradient-to-br from-sky-400/25 to-blue-950 text-sm font-black tracking-tight text-sky-100 shadow-lg shadow-sky-950/40">
            EFC
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black uppercase italic leading-tight tracking-tight text-white sm:text-xl">Everton <span className="text-sky-400">Card Tracker</span></p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.24em] text-blue-100/45 sm:text-xs">Our Blues. Our Collection.</p>
          </div>
        </div>

        <div className="hidden items-center gap-5 lg:flex">
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/45">Total</p><p className="text-lg font-black text-white">{totalCards.toLocaleString()}</p></div>
          <div className="h-8 w-px bg-white/10"/>
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/45">Collected</p><p className="text-lg font-black text-emerald-300">{gotCards.toLocaleString()}</p></div>
          <div className="h-8 w-px bg-white/10"/>
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/45">Still needed</p><p className="text-lg font-black text-amber-200">{needCards.toLocaleString()}</p></div>
          <div className="h-8 w-px bg-white/10"/>
          <div className="min-w-32"><div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-blue-100/50"><span>Progress</span><span className="text-white">{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#18365d]"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-500" style={{width:`${progress}%`}}/></div></div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button onClick={onRefresh} disabled={loading} title="Refresh cards" aria-label="Refresh cards" className="rounded-xl p-2.5 text-blue-100/65 transition hover:bg-white/10 hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? "animate-spin" : ""}`}/></button>
          <button onClick={onExport} title="Export collection" aria-label="Export collection" className="rounded-xl p-2.5 text-blue-100/65 transition hover:bg-white/10 hover:text-white"><Download className="h-4 w-4 sm:h-5 sm:w-5"/></button>
          <button onClick={onSettings} title="Settings" aria-label="Settings" className="rounded-xl p-2.5 text-blue-100/65 transition hover:bg-white/10 hover:text-white"><Settings className="h-4 w-4 sm:h-5 sm:w-5"/></button>
          <button onClick={logout} title="Lock tracker" aria-label="Lock tracker" className="rounded-xl p-2.5 text-blue-100/65 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4 sm:h-5 sm:w-5"/></button>
        </div>
      </div>

      <div className="relative flex items-center gap-4 border-t border-white/5 px-4 py-2 text-[11px] sm:hidden">
        <span className="text-blue-100/60">Cards <strong className="ml-1 text-white">{totalCards.toLocaleString()}</strong></span>
        <span className="text-blue-100/60">Got <strong className="ml-1 text-emerald-300">{gotCards.toLocaleString()}</strong></span>
        <span className="text-blue-100/60">Need <strong className="ml-1 text-amber-200">{needCards.toLocaleString()}</strong></span>
        <span className="ml-auto flex items-center gap-1 text-sky-200"><ShieldCheck size={13}/>{progress}%</span>
      </div>
    </header>
  );
}
