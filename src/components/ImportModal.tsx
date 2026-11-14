"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, Plus, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";

type Collection = "master" | "donruss" | "topps-now" | "extra-collections";
type Row = {
  year: string; cardSet: string; cardNo: string; playerName: string;
  cardDescription: string; variant: string; collecting: boolean; got: boolean;
  imageUrl: string; team: string; printRun: string; sourceCardId: string;
};
type Check = { row: number; missing: string[]; duplicateInFile: boolean; duplicateInDatabase: boolean; valid: boolean };

const emptyRow = (): Row => ({
  year: "", cardSet: "", cardNo: "", playerName: "", cardDescription: "",
  variant: "Base", collecting: true, got: false, imageUrl: "", team: "", printRun: "", sourceCardId: "",
});
const aliases: Record<keyof Row, string[]> = {
  year: ["year"], cardSet: ["card set","set","card_set","collection name"],
  cardNo: ["card no","card number","card #","number","card_no"],
  playerName: ["player","player name","name","player_name"],
  cardDescription: ["description","card description","date & description","card_description"],
  variant: ["variant","parallel","card"], collecting: ["collecting","collect"],
  got: ["got","owned","collected"], imageUrl: ["image","image url","image_url","url"],
  team: ["team"], printRun: ["print run","print_run"], sourceCardId: ["card id","card_id","source card id","id"],
};
const collections: { value: Collection; label: string }[] = [
  { value: "master", label: "Everton Cards" }, { value: "donruss", label: "Donruss" },
  { value: "topps-now", label: "Topps Now" }, { value: "extra-collections", label: "Extra Collections" },
];

function mapRows(source: Record<string, unknown>[]): Row[] {
  return source.map((item) => {
    const normalized: any = {};
    const keys = Object.keys(item);
    for (const [field, names] of Object.entries(aliases)) {
      const key = keys.find((candidate) => names.includes(candidate.trim().toLowerCase()));
      if (key !== undefined) normalized[field] = item[key];
    }
    const row = { ...emptyRow(), ...normalized };
    row.collecting = typeof row.collecting === "boolean" ? row.collecting : !["false","no","0"].includes(String(row.collecting).toLowerCase());
    row.got = typeof row.got === "boolean" ? row.got : ["true","yes","1"].includes(String(row.got).toLowerCase());
    for (const key of ["year","cardSet","cardNo","playerName","cardDescription","variant","imageUrl","team","printRun","sourceCardId"] as const) row[key] = String(row[key] ?? "").trim();
    return row;
  }).filter((r) => Object.values(r).some((v) => v !== "" && v !== false && v !== "Base" && v !== true));
}

export default function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [collection, setCollection] = useState<Collection>("master");
  const [rows, setRows] = useState<Row[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [manual, setManual] = useState<Row>(emptyRow());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const summary = useMemo(() => ({
    ready: checks.filter((c) => c.valid).length,
    duplicates: checks.filter((c) => c.duplicateInFile || c.duplicateInDatabase).length,
    incomplete: checks.filter((c) => c.missing.length).length,
  }), [checks]);

  if (!open) return null;

  async function loadFile(file?: File) {
    if (!file) return;
    setError(""); setMessage(""); setChecks([]);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Please keep import files under 8 MB.");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const parsed = mapRows(source);
      if (!parsed.length) throw new Error("No card rows were found. The first row must contain column headings.");
      if (parsed.length > 5000) throw new Error("This import is limited to 5,000 rows at a time.");
      setRows(parsed);
      setMessage(`Loaded ${parsed.length.toLocaleString()} rows from ${file.name}. Check the preview before importing.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  }

  function addManual() {
    if (!manual.year.trim() || !manual.cardSet.trim() || !manual.cardNo.trim() || !manual.playerName.trim()) {
      setError("Year, card set, card number and player name are required.");
      return;
    }
    setRows((current) => [...current, { ...manual }]);
    setManual(emptyRow()); setChecks([]); setError("");
    setMessage("Manual card added to the preview. It has not been saved to Neon yet.");
  }

  async function preview() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", collection, rows }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not validate this import.");
      setChecks(data.checks);
      setMessage(`Preview complete: ${data.summary.ready} ready, ${data.summary.duplicates} duplicates, ${data.summary.incomplete} incomplete.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview failed."); }
    finally { setBusy(false); }
  }

  async function importRows() {
    if (!checks.length || !summary.ready) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", collection, rows }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Import failed.");
      setMessage(`Saved ${data.inserted} cards to Neon. ${data.skipped} rows were skipped because they were incomplete or duplicates.`);
      setRows([]); setChecks([]); onImported();
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-sky-300/20 bg-[#071a37] p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">Collection management</p><h2 className="mt-1 text-2xl font-black text-white">Import cards</h2><p className="mt-1 text-sm text-blue-100/60">CSV or Excel · Preview first · Save to Neon only when you're ready</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-blue-100/60 hover:bg-white/10 hover:text-white" aria-label="Close"><X/></button>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-blue-100/80">Add to collection
            <select value={collection} onChange={(e) => {setCollection(e.target.value as Collection); setChecks([]);}} className="mt-2 w-full rounded-xl border border-sky-300/20 bg-[#04132b] p-3 text-white">
              {collections.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-sky-300/30 bg-[#04132b] p-4 text-sm text-blue-100/80 hover:border-sky-300/60">
            <span className="flex items-center gap-2 font-bold text-sky-200"><Upload size={17}/> Choose CSV or Excel file</span>
            <span className="mt-1 text-xs text-blue-100/50">.csv, .xlsx or .xls · first worksheet · max 8 MB</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="mt-3 block w-full text-xs" onChange={(e) => void loadFile(e.target.files?.[0])}/>
          </label>
        </div>

        <div className="mb-5 rounded-xl border border-sky-300/15 bg-[#0b2347]/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-white"><Plus size={17}/> Add one card manually</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {([
              ["year","Year"],["cardSet","Card set"],["cardNo","Card number"],["playerName","Player name"],
              ["variant","Variant"],["team","Team"],["printRun","Print run"],["sourceCardId","Source card ID"],
              ["cardDescription","Description"],["imageUrl","Image URL"],
            ] as [keyof Row,string][]).map(([key,label]) => <label key={key} className="text-xs text-blue-100/65">{label}
              <input value={String(manual[key])} onChange={(e) => setManual((r) => ({...r,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-sky-300/15 bg-[#04132b] px-2.5 py-2 text-sm text-white"/>
            </label>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-blue-100/75">
            <label className="flex items-center gap-2"><input type="checkbox" checked={manual.collecting} onChange={(e) => setManual((r) => ({...r,collecting:e.target.checked}))}/> Collecting</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={manual.got} onChange={(e) => setManual((r) => ({...r,got:e.target.checked}))}/> Already own</label>
            <button onClick={addManual} className="ml-auto rounded-lg bg-sky-500 px-4 py-2 font-bold text-white hover:bg-sky-400">Add to preview</button>
          </div>
        </div>

        {rows.length > 0 && <div className="mb-4 rounded-xl border border-sky-300/15 bg-[#04132b] p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-white"><FileSpreadsheet size={17}/> Import preview</h3><span className="text-xs text-blue-100/55">{rows.length.toLocaleString()} rows loaded</span></div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#0b2347] text-blue-100/70"><tr>{["#","Year","Set","Card no.","Player","Variant","Status"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0,100).map((r,i) => {
                const check = checks[i];
                return <tr key={i} className="border-t border-white/5 text-blue-100/80"><td className="p-2">{i+1}</td><td className="p-2">{r.year}</td><td className="p-2">{r.cardSet}</td><td className="p-2">{r.cardNo}</td><td className="p-2">{r.playerName}</td><td className="p-2">{r.variant}</td><td className="p-2">{!check ? "Not checked" : check.valid ? "Ready" : check.missing.length ? `Missing: ${check.missing.join(", ")}` : "Duplicate"}</td></tr>;
              })}</tbody>
            </table>
            {rows.length > 100 && <p className="p-2 text-xs text-blue-100/45">Showing first 100 rows. All {rows.length.toLocaleString()} rows will be checked.</p>}
          </div>
          {checks.length > 0 && <div className="mt-3 flex flex-wrap gap-3 text-xs"><span className="text-emerald-300">Ready: {summary.ready}</span><span className="text-amber-200">Duplicates: {summary.duplicates}</span><span className="text-red-300">Incomplete: {summary.incomplete}</span></div>}
        </div>}

        {error && <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"><AlertTriangle className="mr-2 inline" size={16}/>{error}</p>}
        {message && <p className="mb-3 rounded-lg border border-sky-300/15 bg-sky-400/10 p-3 text-sm text-sky-100">{message}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-blue-100/70 hover:bg-white/5">Close</button>
          <button onClick={() => void preview()} disabled={busy || !rows.length} className="rounded-lg border border-sky-300/30 px-4 py-2.5 text-sm font-bold text-sky-200 disabled:opacity-40">{busy ? "Checking…" : "Check & preview"}</button>
          <button onClick={() => void importRows()} disabled={busy || !checks.length || !summary.ready} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-40">{busy ? "Working…" : `Import ${summary.ready} cards to Neon`}</button>
        </div>
        <p className="mt-4 text-xs text-blue-100/40">Duplicate cards and rows missing year, set, card number or player name are skipped. Importing is transactional: if a database write fails, the entire batch is rolled back.</p>
      </section>
    </div>
  );
}
