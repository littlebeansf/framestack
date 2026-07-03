/**
 * QuotesTab — per-owner quote collection.
 *
 * Features:
 *  - Add a quote: textarea + author field (combobox: pick existing or type new)
 *  - Edit inline (click pencil on any card)
 *  - Delete with confirm
 *  - Cards display quote + author, ordered newest-first
 *  - Author dropdown is derived from all existing authors for this owner
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Quote as QuoteIcon, Plus, Pencil, Trash2, Check, X, ChevronDown, User } from "lucide-react";

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

  // Keep filter in sync when value changes externally (e.g. on edit open)
  useEffect(() => { setFilter(value); }, [value]);

  // Close on outside click
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

// ── Quote Card ────────────────────────────────────────────────────────────────
function QuoteCard({
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

  return (
    <div
      className="group rounded-2xl border border-white/6 bg-white/3 hover:bg-white/5 hover:border-white/10 transition-all duration-200 p-5 relative"
      data-testid={`card-quote-${quote.id}`}
    >
      {/* Opening quote mark */}
      <span
        className="absolute top-3 left-4 text-4xl font-serif leading-none select-none pointer-events-none"
        style={{ color: `${accent}30` }}
        aria-hidden
      >
        "
      </span>

      <p
        className="text-sm leading-relaxed text-white/85 pt-3 pl-3 pr-8"
        style={{ fontStyle: "italic", fontFamily: "'Satoshi', sans-serif" }}
      >
        {quote.text}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-px" style={{ background: accent }} />
          <span className="text-xs font-semibold" style={{ color: accent }}>
            {quote.author}
          </span>
        </div>

        {/* Actions — visible on hover */}
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
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-white/40 hover:text-white/60 px-1 transition-colors"
              >
                Cancel
              </button>
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

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function QuotesTab({
  owner,
  accent,
}: {
  owner: "jack" | "sally";
  accent: string;
}) {
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: allQuotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", owner],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/quotes/${owner}`, undefined);
      return res.json();
    },
  });

  // Derive unique authors from existing quotes (sorted alphabetically)
  const authors = [...new Set(allQuotes.map(q => q.author))].sort();

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
    <div className="space-y-5 animate-page-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QuoteIcon size={14} style={{ color: accent }} />
          <span className="text-sm font-bold">Quotes</span>
          {allQuotes.length > 0 && (
            <span className="text-[10px] text-white/30 font-mono">
              {allQuotes.length}
            </span>
          )}
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
            Add quote
          </Button>
        )}
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

      {/* List */}
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
      ) : (
        <div className="grid gap-3">
          {allQuotes.map(q => (
            <QuoteCard
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
