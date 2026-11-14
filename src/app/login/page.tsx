"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to sign in. Please try again.");
        return;
      }

      const requested = searchParams.get("next") || "/";
      const destination = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Unable to sign in. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06152c] px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-sky-300/15 bg-[#0b2140] p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/10 text-lg font-black text-sky-200">EFC</div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-sky-300/70">Our Blues. Our Collection.</p>
          <h1 className="mt-3 text-2xl font-black">Everton Card Tracker</h1>
          <p className="mt-2 text-sm text-blue-100/60">Enter your private password to continue.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-semibold text-blue-100/80" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-sky-200/15 bg-[#04132b] px-4 py-3 text-white outline-none transition placeholder:text-blue-100/30 focus:border-sky-400"
            placeholder="Your tracker password"
          />
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Unlock tracker"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-blue-100/40">Private collection · Read-only sharing can be enabled separately</p>
      </div>
    </main>
  );
}
