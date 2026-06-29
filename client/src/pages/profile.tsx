import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Download, Upload, FileJson, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import type { Item } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  exportLibraryJSON,
  exportLibraryCSV,
  exportCollectionsJSON,
  importFromFile,
  type ImportResult,
} from "@/lib/importExport";
import { localStore } from "@/lib/localStore";

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};
const TYPE_COLORS: Record<string, string> = {
  anime: "hsl(255 70% 55%)",
  manga: "hsl(340 60% 55%)",
  movie: "hsl(30 70% 55%)",
  series: "hsl(190 60% 50%)",
  book: "hsl(160 50% 48%)",
};

export default function ProfilePage() {
  const { data: items } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const qc = useQueryClient();

  const total = (items || []).length;
  const completed = (items || []).filter(i => i.status === "completed").length;
  const rated = (items || []).filter(i => i.rating != null);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const byType = ["anime", "manga", "movie", "series", "book"].map(t => ({
    type: t,
    count: (items || []).filter(i => i.mediaType === t).length,
  })).filter(x => x.count > 0);

  // ── Import state ───────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const result = await importFromFile(file, importMode);
    setImportResult(result);
    setImporting(false);
    // Clear input so the same file can be re-selected
    e.target.value = "";

    if (result.ok) {
      // Refresh React Query caches from the freshly-imported localStore
      qc.setQueryData(["/api/items"], localStore.getItems());
      qc.setQueryData(["/api/collections"], localStore.getCollections());
      // Invalidate any cached collection-detail queries so they re-read localStore
      qc.removeQueries({ predicate: q => {
        const k = q.queryKey as any[];
        return k[0] === "/api/collections" && k[2] === "items";
      }});
    }
  }

  return (
    <div className="max-w-xl space-y-8 animate-page-in">
      {/* Stats header */}
      <div>
        <h1 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Stats
        </h1>
        <p className="text-sm text-muted-foreground">Your library at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: total },
          { label: "Completed", value: completed },
          { label: "Avg rating", value: avgRating ? `★ ${avgRating}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Breakdown by type */}
      {byType.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BarChart3 size={12} />
            Library breakdown
          </p>
          {byType.map(({ type, count }) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14">{TYPE_LABELS[type]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${total > 0 ? (count / total) * 100 : 0}%`,
                    backgroundColor: TYPE_COLORS[type],
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      {byType.length === 0 && total === 0 && (
        <p className="text-sm text-muted-foreground">Nothing in your library yet. Use the search to add items.</p>
      )}

      {/* ── Export ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Export
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Download your library and collections as files.</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ExportButton
            icon={<FileJson size={14} />}
            label="Full backup"
            sublabel="JSON · library + collections"
            onClick={exportLibraryJSON}
          />
          <ExportButton
            icon={<FileText size={14} />}
            label="Library CSV"
            sublabel="Spreadsheet-ready"
            onClick={exportLibraryCSV}
          />
          <ExportButton
            icon={<FileJson size={14} />}
            label="Collections"
            sublabel="JSON · collections only"
            onClick={exportCollectionsJSON}
          />
        </div>
      </div>

      {/* ── Import ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Import
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Restore from a Framestack JSON backup. Use <span className="text-foreground font-medium">Replace</span> to fully overwrite, or <span className="text-foreground font-medium">Merge</span> to add without removing existing data.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["replace", "merge"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setImportMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                importMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "replace" ? "Replace" : "Merge"}
            </button>
          ))}
        </div>

        {/* Drop zone / file picker */}
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-card hover:bg-secondary/30 transition-colors cursor-pointer p-6 text-center"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const dt = new DataTransfer();
            dt.items.add(file);
            if (fileInputRef.current) {
              fileInputRef.current.files = dt.files;
              fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }}
        >
          <Upload size={20} className="text-muted-foreground/60" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {importing ? "Importing…" : "Drop JSON file here"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="sr-only"
            onChange={handleImportFile}
          />
        </label>

        {/* Import result banner */}
        {importResult && (
          <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ${
            importResult.ok
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}>
            {importResult.ok
              ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              : <AlertCircle size={16} className="shrink-0 mt-0.5" />
            }
            <span>
              {importResult.ok
                ? `Imported ${importResult.itemCount} item${importResult.itemCount !== 1 ? "s" : ""} and ${importResult.collectionCount} collection${importResult.collectionCount !== 1 ? "s" : ""} successfully.`
                : importResult.error
              }
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function ExportButton({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-secondary/40 transition-all p-3 text-left group"
    >
      <div className="shrink-0 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>
      </div>
      <Download size={12} className="ml-auto shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}
