/**
 * QuotesTab — per-owner quote collection.
 *
 * Board view: masonry 2-col layout, author filter pills, featured hero quote
 * List view: compact single-column
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Quote as QuoteIcon,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  User,
  LayoutGrid,
  List,
  Sparkles,
} from "lucide-react";

// ── Stable author → hue mapping ───────────────────────────────────────────────
// Each author gets a consistent subtle tint derived from their name
function authorHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

// ── Author Combobox ───────────────────────────────────────────────────────────
function AuthorCombobox({
  value,
  onChange,
  authors,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  authors: string[];
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setFilter(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = authors.filter(a => a.toLowerCase().includes(filter.toLowerCase()));
  const showNew = filter.trim() && !authors.some(a => a.toLowerCase() === filter.trim().toLowerCase());

  function select(name: string) {
    onChange(name);
    setFilter(name);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          value={filter}
          onChange={e => { setFilter(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Author name…"
          className="w-full pl-8 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          data-testid="input-quote-author"
        />
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (filtered.length > 0 || showNew) && (
        <div
          className="absolute z-50 top-full mt-1 w-full rounded-xl border border-white/10 overflow-hidden shadow-xl"
          style={{ background: "hsl(230 18% 11%)" }}
        >
          {filtered.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => select(a)}
              className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors flex items-center gap-2"
              data-testid={`option-author-${a}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: accent }}
              />
              {a}
            </button>
          ))}
          {showNew && (
            <button
              type="button"
              onClick={() => select(filter.trim())}
              className="w-full text-left px-3 py-2 text-sm text-white/50 hover:bg-white/8 transition-colors flex items-center gap-2 border-t border-white/5"
              data-testid="option-author-new"
            >
              <Plus size={11} style={{ color: accent }} />
              Add "{filter.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quote Form (add or edit) ──────────────────────────────────────────────────
function QuoteForm({
  owner,
  accent,
  authors,
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  owner: string;
  accent: string;
  authors: string[];
  initial?: { text: string; author: string };
  onSubmit: (text: string, author: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");

  return (
    <div
      className="rounded-2xl border border-white/10 p-4 space-y-3"
      style={{ background: `${accent}08` }}
    >
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type the quote here…"
        rows={3}
        className="bg-white/5 border-white/10 text-sm placeholder:text-white/25 resize-none focus:border-white/25"
        data-testid="textarea-quote-text"
        autoFocus
      />
      <AuthorCombobox value={author} onChange={setAuthor} authors={authors} accent={accent} />
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-white/50 hover:text-white text-xs"
        >
          <X size={11} className="mr-1" /> Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!text.trim() || !author.trim() || isPending}
          onClick={() => onSubmit(text.trim(), author.trim())}
          style={{ background: accent }}
          className="text-white font-semibold gap-1.5 hover:opacity-90 border-0 text-xs"
          data-testid="button-save-quote"
        >
          <Check size={11} />
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Board Quote Card ──────────────────────────────────────────────────────────
function BoardCard({
  quote,
  accent,
  authors,
  owner,
  isFeatured,
}: {
  quote: Quote;
  accent: string;
  authors: string[];
  owner: string;
  isFeatured?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hue = authorHue(quote.author);
  const cardTint = `hsla(${hue}, 55%, 55%, 0.06)`;
  const authorColor = `hsl(${hue}, 65%, 68%)`;
  const markColor = `hsla(${hue}, 55%, 65%, 0.18)`;

  const updateMutation = useMutation({
    mutationFn: async ({ text, author }: { text: string; author: string }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${quote.id}`, { text, author });
      return res.json() as Promise<Quote>;
    },
    onSuccess: (updated: Quote) => {
      qc.setQueryData<Quote[]>(["/api/quotes", owner], (old = []) =>
        old.map(q => q.id === updated.id ? updated : q)
      );
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/quotes/${quote.id}`, {});
    },
    onSuccess: () => {
      qc.setQueryData<Quote[]>(["/api/quotes", owner], (old = []) =>
        old.filter(q => q.id !== quote.id)
      );
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (editing) {
    return (
      <QuoteForm
        owner={owner}
        accent={accent}
        authors={authors}
        initial={{ text: quote.text, author: quote.author }}
        onSubmit={(text, author) => updateMutation.mutate({ text, author })}
        onCancel={() => setEditing(false)}
        isPending={updateMutation.isPending}
      />
    );
  }

  if (isFeatured) {
    return (
      <div
        className="relative rounded-2xl border border-white/8 p-6 overflow-hidden group"
        style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}06 100%)` }}
        data-testid={`card-quote-featured-${quote.id}`}
      >
        {/* Sparkle badge */}
        <div
          className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${accent}20`, color: accent }}
        >
          <Sparkles size={8} />
          Featured
        </div>

        {/* Big decorative quote mark */}
        <span
          className="block font-serif text-7xl leading-none mb-1 select-none pointer-events-none"
          style={{ color: `${accent}22` }}
          aria-hidden
        >
          "
        </span>

        <p
          className="text-base leading-relaxed text-white/90 font-medium"
          style={{ fontStyle: "italic", fontFamily: "'Satoshi', sans-serif" }}
        >
          {quote.text}
        </p>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/8">
          <div className="flex items-center gap-2">
            <span className="w-4 h-px" style={{ background: accent }} />
            <span className="text-xs font-bold" style={{ color: accent }}>{quote.author}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
              data-testid={`button-edit-quote-${quote.id}`}
              title="Edit"
            >
              <Pencil size={11} />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => deleteMutation.mutate()}
                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-1.5 py-0.5 rounded bg-red-400/10 transition-colors"
                  data-testid={`button-confirm-delete-quote-${quote.id}`}
                >Delete</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-white/40 hover:text-white/60 px-1 transition-colors"
                >Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-400/10 text-white/40 hover:text-red-400 transition-all"
                data-testid={`button-delete-quote-${quote.id}`}
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group rounded-2xl border border-white/6 hover:border-white/12 transition-all duration-200 p-4 relative break-inside-avoid"
      style={{ background: cardTint }}
      data-testid={`card-quote-${quote.id}`}
    >
      {/* Opening quote mark */}
      <span
        className="block font-serif text-4xl leading-none mb-0.5 select-none pointer-events-none"
        style={{ color: markColor }}
        aria-hidden
      >
        "
      </span>

      <p
        className="text-sm leading-relaxed text-white/82"
        style={{ fontStyle: "italic", fontFamily: "'Satoshi', sans-serif" }}
      >
        {quote.text}
      </p>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-px" style={{ background: authorColor }} />
          <span className="text-[11px] font-semibold" style={{ color: authorColor }}>
            {quote.author}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => setEditing(true)}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
            data-testid={`button-edit-quote-${quote.id}`}
            title="Edit"
          >
            <Pencil size={11} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteMutation.mutate()}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-1.5 py-0.5 rounded bg-red-400/10 transition-colors"
                data-testid={`button-confirm-delete-quote-${quote.id}`}
              >Delete</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-white/40 hover:text-white/60 px-1 transition-colors"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-400/10 text-white/40 hover:text-red-400 transition-all"
              data-testid={`button-delete-quote-${quote.id}`}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List Quote Row ─────────────────────────────────────────────────────────────
function ListRow({
  quote,
  accent,
  authors,
  owner,
}: {
  quote: Quote;
  accent: string;
  authors: string[];
  owner: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hue = authorHue(quote.author);
  const authorColor = `hsl(${hue}, 65%, 68%)`;

  const updateMutation = useMutation({
    mutationFn: async ({ text, author }: { text: string; author: string }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${quote.id}`, { text, author });
      return res.json() as Promise<Quote>;
    },
    onSuccess: (updated: Quote) => {
      qc.setQueryData<Quote[]>(["/api/quotes", owner], (old = []) =>
        old.map(q => q.id === updated.id ? updated : q)
      );
      setEditing(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/quotes/${quote.id}`, {});
    },
    onSuccess: () => {
      qc.setQueryData<Quote[]>(["/api/quotes", owner], (old = []) =>
        old.filter(q => q.id !== quote.id)
      );
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="mb-3">
        <QuoteForm
          owner={owner}
          accent={accent}
          authors={authors}
          initial={{ text: quote.text, author: quote.author }}
          onSubmit={(text, author) => updateMutation.mutate({ text, author })}
          onCancel={() => setEditing(false)}
          isPending={updateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-white/4 transition-colors duration-150 border border-transparent hover:border-white/6"
      data-testid={`row-quote-${quote.id}`}
    >
      {/* Author dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0 mt-1.5"
        style={{ background: authorColor }}
      />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-relaxed text-white/80"
          style={{ fontStyle: "italic", fontFamily: "'Satoshi', sans-serif" }}
        >
          "{quote.text}"
        </p>
        <span className="text-[11px] font-semibold mt-0.5 block" style={{ color: authorColor }}>
          {quote.author}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 mt-0.5">
        <button
          onClick={() => setEditing(true)}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
          data-testid={`button-edit-quote-list-${quote.id}`}
          title="Edit"
        >
          <Pencil size={11} />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteMutation.mutate()}
              className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-1.5 py-0.5 rounded bg-red-400/10 transition-colors"
              data-testid={`button-confirm-delete-quote-list-${quote.id}`}
            >Delete</button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] text-white/40 hover:text-white/60 px-1 transition-colors"
            >Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-400/10 text-white/40 hover:text-red-400 transition-all"
            data-testid={`button-delete-quote-list-${quote.id}`}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Masonry Board ─────────────────────────────────────────────────────────────
// CSS columns-based masonry (no JS layout calc needed)
function MasonryBoard({
  quotes,
  accent,
  authors,
  owner,
  featuredId,
}: {
  quotes: Quote[];
  accent: string;
  authors: string[];
  owner: string;
  featuredId: number | null;
}) {
  const featured = quotes.find(q => q.id === featuredId);
  const rest = quotes.filter(q => q.id !== featuredId);

  return (
    <div className="space-y-3">
      {/* Featured hero card — full width */}
      {featured && (
        <BoardCard
          key={`featured-${featured.id}`}
          quote={featured}
          accent={accent}
          authors={authors}
          owner={owner}
          isFeatured
        />
      )}

      {/* Masonry 2-col */}
      {rest.length > 0 && (
        <div
          className="columns-2 gap-3"
          style={{ columnFill: "balance" }}
        >
          {rest.map(q => (
            <div key={q.id} className="mb-3">
              <BoardCard
                quote={q}
                accent={accent}
                authors={authors}
                owner={owner}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function QuotesTab({
  owner,
  accent,
}: {
  owner: "jack" | "sally";
  accent: string;
}) {
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [activeAuthor, setActiveAuthor] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: allQuotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", owner],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/quotes/${owner}`, undefined);
      return res.json();
    },
  });

  // Unique authors sorted alphabetically
  const authors = useMemo(
    () => [...new Set(allQuotes.map(q => q.author))].sort(),
    [allQuotes]
  );

  // Featured = most recently added (index 0)
  const featuredId = allQuotes.length > 0 ? allQuotes[0].id : null;

  // Filter by author
  const visibleQuotes = activeAuthor
    ? allQuotes.filter(q => q.author === activeAuthor)
    : allQuotes;

  const addMutation = useMutation({
    mutationFn: async ({ text, author }: { text: string; author: string }) => {
      const res = await apiRequest("POST", "/api/quotes", { owner, text, author });
      return res.json() as Promise<Quote>;
    },
    onSuccess: (newQuote: Quote) => {
      qc.setQueryData<Quote[]>(["/api/quotes", owner], (old = []) => [newQuote, ...old]);
      setAdding(false);
      toast({ title: "Quote added ✨" });
    },
    onError: () => toast({ title: "Failed to add quote", variant: "destructive" }),
  });

  const ownerLabel = owner === "jack" ? "Jack" : "Sally";

  return (
    <div className="space-y-4 animate-page-in">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QuoteIcon size={14} style={{ color: accent }} />
          <span className="text-sm font-bold">Quotes</span>
          {allQuotes.length > 0 && (
            <span className="text-[10px] text-white/30 font-mono">{allQuotes.length}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg overflow-hidden border border-white/8 text-white/40">
            <button
              onClick={() => setView("board")}
              className={cn(
                "w-7 h-7 flex items-center justify-center transition-colors",
                view === "board" ? "bg-white/10 text-white/80" : "hover:bg-white/5"
              )}
              data-testid="button-view-board"
              title="Board view"
            >
              <LayoutGrid size={12} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "w-7 h-7 flex items-center justify-center transition-colors border-l border-white/8",
                view === "list" ? "bg-white/10 text-white/80" : "hover:bg-white/5"
              )}
              data-testid="button-view-list"
              title="List view"
            >
              <List size={12} />
            </button>
          </div>

          {!adding && (
            <Button
              size="sm"
              onClick={() => setAdding(true)}
              style={{ background: accent }}
              className="text-white font-semibold gap-1.5 hover:opacity-90 border-0 text-xs"
              data-testid="button-add-quote"
            >
              <Plus size={11} />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <QuoteForm
          owner={owner}
          accent={accent}
          authors={authors}
          onSubmit={(text, author) => addMutation.mutate({ text, author })}
          onCancel={() => setAdding(false)}
          isPending={addMutation.isPending}
        />
      )}

      {/* Author filter pills */}
      {authors.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveAuthor(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 border",
              activeAuthor === null
                ? "border-white/20 bg-white/10 text-white/90"
                : "border-white/6 bg-transparent text-white/35 hover:text-white/60 hover:border-white/12"
            )}
            data-testid="filter-all-authors"
          >
            All
          </button>
          {authors.map(a => {
            const hue = authorHue(a);
            const color = `hsl(${hue}, 65%, 68%)`;
            const isActive = activeAuthor === a;
            return (
              <button
                key={a}
                onClick={() => setActiveAuthor(isActive ? null : a)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 border flex items-center gap-1.5"
                )}
                style={{
                  borderColor: isActive ? color : "rgba(255,255,255,0.06)",
                  background: isActive ? `hsla(${hue}, 55%, 55%, 0.15)` : "transparent",
                  color: isActive ? color : "rgba(255,255,255,0.35)",
                }}
                data-testid={`filter-author-${a}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: color, opacity: isActive ? 1 : 0.5 }}
                />
                {a}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
      ) : allQuotes.length === 0 && !adding ? (
        <div className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl select-none" style={{ filter: `drop-shadow(0 0 12px ${accent}66)` }}>
            💬
          </span>
          <p className="text-sm font-semibold text-white/60">No quotes yet</p>
          <p className="text-xs text-white/30">
            Add {ownerLabel}'s favourite quotes — they'll live here forever.
          </p>
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className="rounded-xl border border-white/5 p-6 text-center text-xs text-white/30">
          No quotes from this author.
        </div>
      ) : view === "board" ? (
        <MasonryBoard
          quotes={visibleQuotes}
          accent={accent}
          authors={authors}
          owner={owner}
          featuredId={activeAuthor ? null : featuredId}
        />
      ) : (
        <div className="rounded-2xl border border-white/6 overflow-hidden divide-y divide-white/4">
          {visibleQuotes.map(q => (
            <ListRow
              key={q.id}
              quote={q}
              accent={accent}
              authors={authors}
              owner={owner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
