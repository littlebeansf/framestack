/**
 * GroceryTab — shared grocery lists for Together.
 * Perf: optimistic check/uncheck, memoised rows, no transition-all.
 * Mobile: 44px+ tap targets, always-visible actions, bottom-sheet dialogs,
 *         16px inputs (no iOS zoom), no hover-only interactions.
 */

import { useState, useRef, useCallback, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Check, ChevronDown, ChevronRight,
  BookmarkPlus, BookmarkCheck, Copy, Pencil, X, MapPin, Euro,
  ShoppingCart, ListChecks, Archive, RotateCcw, CheckCircle2,
} from "lucide-react";
import type { GroceryList, GroceryItem } from "@shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCENT = "hsl(20 90% 60%)";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ checked, total, compact = false }: { checked: number; total: number; compact?: boolean }) {
  if (total === 0) return null;
  const pct  = Math.round((checked / total) * 100);
  const done = checked === total;
  const color = done ? "#22c55e" : ACCENT;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width .3s" }} />
        </div>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: done ? "#22c55e" : "hsl(var(--muted-foreground))" }}>
          {checked}/{total}
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: done ? "#22c55e" : ACCENT }}>
          {done ? "All done! 🎉" : `${pct}% done`}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{checked} / {total}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: done ? "#22c55e" : `linear-gradient(90deg,${ACCENT},hsl(40 95% 65%))`,
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );
}

// ── Price summary ─────────────────────────────────────────────────────────────

function PriceSummary({ items }: { items: GroceryItem[] }) {
  const priced = items.filter(i => i.price != null);
  if (priced.length === 0) return null;
  const total     = priced.reduce((s, i) => s + (i.price ?? 0), 0);
  const spent     = priced.filter(i => i.checked).reduce((s, i) => s + (i.price ?? 0), 0);
  const remaining = total - spent;
  const hasChecked = priced.some(i => i.checked);
  return (
    <div className="mt-3 rounded-xl border border-border/40 bg-background/30 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: ACCENT }}>€{total.toFixed(2)}</p>
        </div>
        {hasChecked && (
          <>
            <div className="w-px h-6 bg-border/40" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Spent</p>
              <p className="text-sm font-semibold tabular-nums text-green-400">€{spent.toFixed(2)}</p>
            </div>
            <div className="w-px h-6 bg-border/40" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Left</p>
              <p className="text-sm font-semibold tabular-nums text-muted-foreground">€{remaining.toFixed(2)}</p>
            </div>
          </>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground/50 text-right flex-shrink-0">
        {priced.length}/{items.length} priced
      </div>
    </div>
  );
}

// ── Item row — memoised, optimistic toggle ────────────────────────────────────

const ItemRow = memo(function ItemRow({
  item, listId, readOnly,
  onToggle, onDelete,
}: {
  item: GroceryItem;
  listId: number;
  readOnly?: boolean;
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name,     setName]    = useState(item.name);
  const [location, setLocation] = useState(item.location ?? "");
  const [price,    setPrice]    = useState(item.price != null ? String(item.price) : "");
  const qc = useQueryClient();
  const itemKey = ["/api/grocery/lists", listId, "items"];

  async function save() {
    const r = await apiRequest("PATCH", `/api/grocery/items/${item.id}`, {
      name, location: location || null, price: price ? parseFloat(price) : null,
    });
    const updated = await r.json();
    qc.setQueryData(itemKey, (old: GroceryItem[] = []) => old.map(i => i.id === item.id ? updated : i));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-3">
        <input
          className="w-full bg-transparent font-medium outline-none border-b border-border pb-1"
          style={{ fontSize: 16 }}
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Item name" autoFocus
        />
        <div className="flex gap-2">
          <div className="flex items-center gap-1 flex-1 text-muted-foreground">
            <MapPin size={12} />
            <input className="bg-transparent text-sm outline-none flex-1" style={{ fontSize: 16 }} value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Euro size={12} />
            <input className="bg-transparent text-sm outline-none w-16" style={{ fontSize: 16 }} value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01" min="0" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground px-3 py-2 rounded-lg min-h-[36px]">Cancel</button>
          <button onClick={save} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]" style={{ background: "hsl(20 90% 60% / 0.15)", color: ACCENT }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2 border",
        item.checked ? "border-border/30 bg-background/20 opacity-60" : "border-border/50 bg-background/40",
      )}
      style={{ minHeight: 48 }}
    >
      {/* Big tap target for check */}
      <button
        onClick={readOnly ? undefined : () => onToggle?.(item.id)}
        className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-full border-2",
          item.checked ? "border-transparent bg-green-500" : "border-border",
        )}
        style={{ width: 28, height: 28, touchAction: "manipulation" }}
        aria-label={item.checked ? "Uncheck" : "Check"}
      >
        {item.checked && <Check size={13} className="text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2">
        <p className={cn("text-sm font-medium truncate", item.checked && "line-through text-muted-foreground")}>{item.name}</p>
        {(item.location || item.price != null) && (
          <div className="flex items-center gap-2 mt-0.5">
            {item.location && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin size={9} />{item.location}</span>}
            {item.price != null && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Euro size={9} />{item.price.toFixed(2)}</span>}
          </div>
        )}
      </div>

      {/* Actions — always visible (no hover:opacity trick — mobile has no hover) */}
      {!readOnly && (
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg text-muted-foreground active:bg-border/40"
            style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}
            aria-label="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete?.(item.id)}
            className="p-2 rounded-lg text-muted-foreground active:text-red-400"
            style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}
            aria-label="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
});

// ── Add item form ─────────────────────────────────────────────────────────────

function AddItemForm({ listId }: { listId: number }) {
  const qc = useQueryClient();
  const [name,     setName]     = useState("");
  const [location, setLocation] = useState("");
  const [price,    setPrice]    = useState("");
  const [expanded, setExpanded] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemKey = ["/api/grocery/lists", listId, "items"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const items = qc.getQueryData<GroceryItem[]>(itemKey) ?? [];
    const r = await apiRequest("POST", `/api/grocery/lists/${listId}/items`, {
      name: name.trim(), location: location.trim() || null,
      price: price ? parseFloat(price) : null, sort_order: items.length,
    });
    const item = await r.json();
    qc.setQueryData(itemKey, [...items, item]);
    setName(""); setLocation(""); setPrice("");
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex gap-2 items-center">
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Add item…"
          className="flex-1 bg-background/40 border border-border/50 rounded-xl px-3 outline-none focus:border-border placeholder:text-muted-foreground/50"
          style={{ fontSize: 16, height: 44 }}
        />
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="rounded-xl border border-border/40 text-muted-foreground flex items-center justify-center"
          style={{ width: 44, height: 44, touchAction: "manipulation" }}
        >
          <ChevronDown size={15} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          type="submit"
          className="rounded-xl border border-border/40 text-muted-foreground flex items-center justify-center"
          style={{ width: 44, height: 44, touchAction: "manipulation" }}
        >
          <Plus size={15} />
        </button>
      </div>
      {expanded && (
        <div className="flex gap-2 mt-2">
          <div className="flex items-center gap-1.5 flex-1 bg-background/40 border border-border/50 rounded-xl px-3" style={{ height: 44 }}>
            <MapPin size={12} className="text-muted-foreground flex-shrink-0" />
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/50" style={{ fontSize: 16 }} />
          </div>
          <div className="flex items-center gap-1.5 bg-background/40 border border-border/50 rounded-xl px-3 w-28" style={{ height: 44 }}>
            <Euro size={12} className="text-muted-foreground flex-shrink-0" />
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01" min="0" className="bg-transparent outline-none w-full placeholder:text-muted-foreground/50" style={{ fontSize: 16 }} />
          </div>
        </div>
      )}
    </form>
  );
}

// ── List card — active ────────────────────────────────────────────────────────

function ListCard({ list, onDelete, onSaveAsTemplate, onComplete }: {
  list: GroceryList;
  onDelete: (id: number) => void;
  onSaveAsTemplate: (id: number) => void;
  onComplete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const itemKey = ["/api/grocery/lists", list.id, "items"];

  const { data: items = [] } = useQuery<GroceryItem[]>({
    queryKey: itemKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/grocery/lists/${list.id}/items`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const checked = items.filter(i => i.checked).length;
  const total   = items.length;
  const allDone = total > 0 && checked === total;

  // ── Optimistic toggle — instant UI, async server sync ──────────────────────
  const handleToggle = useCallback(async (itemId: number) => {
    const prev = qc.getQueryData<GroceryItem[]>(itemKey) ?? [];
    const target = prev.find(i => i.id === itemId);
    if (!target) return;
    const next = !target.checked;
    // Optimistic update
    qc.setQueryData(itemKey, prev.map(i => i.id === itemId ? { ...i, checked: next ? 1 : 0 } : i));
    try {
      const r = await apiRequest("PATCH", `/api/grocery/items/${itemId}`, { checked: next ? 1 : 0 });
      const updated = await r.json();
      qc.setQueryData(itemKey, (old: GroceryItem[] = []) => old.map(i => i.id === itemId ? updated : i));
    } catch {
      // Rollback on error
      qc.setQueryData(itemKey, prev);
    }
  }, [qc, itemKey]);

  const handleDelete = useCallback(async (itemId: number) => {
    qc.setQueryData(itemKey, (old: GroceryItem[] = []) => old.filter(i => i.id !== itemId));
    await apiRequest("DELETE", `/api/grocery/items/${itemId}`);
  }, [qc, itemKey]);

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden",
      allDone ? "border-green-500/40 bg-green-500/5" : "border-border/60 bg-background/40",
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 cursor-pointer select-none"
        style={{ minHeight: 56 }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-muted-foreground flex-shrink-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={cn("text-sm font-semibold truncate", allDone && "text-green-400")}>{list.name}</p>
            {allDone && <Check size={12} className="text-green-400 flex-shrink-0" strokeWidth={3} />}
          </div>
          <p className="text-[11px] text-muted-foreground">{formatDate(list.date)}</p>
        </div>

        <ProgressBar checked={checked} total={total} compact />

        {/* Actions — stop propagation to header click */}
        <div className="flex gap-0.5 ml-1" onClick={e => e.stopPropagation()}>
          {allDone && (
            <button
              onClick={() => onComplete(list.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
              style={{ background: "hsl(160 65% 50% / 0.15)", color: "hsl(160 65% 50%)", touchAction: "manipulation", minHeight: 36 }}
            >
              <Archive size={11} /> Done
            </button>
          )}
          <button onClick={() => onSaveAsTemplate(list.id)} className="p-2 rounded-lg text-muted-foreground" style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}>
            <BookmarkPlus size={13} />
          </button>
          <button onClick={() => onDelete(list.id)} className="p-2 rounded-lg text-muted-foreground" style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {open && <ProgressBar checked={checked} total={total} />}

      {open && (
        <div className="px-3 pb-4 space-y-1.5">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 text-center">No items yet — add one below</p>
          )}
          {items.map(item => (
            <ItemRow key={item.id} item={item} listId={list.id} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          <AddItemForm listId={list.id} />
          <PriceSummary items={items} />
        </div>
      )}
    </div>
  );
}

// ── Archived card ─────────────────────────────────────────────────────────────

function ArchivedCard({ list, onDelete, onRestore }: {
  list: GroceryList;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemKey = ["/api/grocery/lists", list.id, "items"];
  const { data: items = [] } = useQuery<GroceryItem[]>({
    queryKey: itemKey,
    queryFn: async () => { const r = await apiRequest("GET", `/api/grocery/lists/${list.id}/items`); return r.json(); },
    staleTime: 120_000,
  });

  return (
    <div className="rounded-2xl border border-border/30 bg-background/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 cursor-pointer" style={{ minHeight: 52 }} onClick={() => setOpen(v => !v)}>
        <span className="text-muted-foreground flex-shrink-0">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-muted-foreground">{list.name}</p>
          <p className="text-[11px] text-muted-foreground/60">{formatDate(list.date)}</p>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{items.length} items</span>
        <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onRestore(list.id)} className="p-2 rounded-lg text-muted-foreground" style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}><RotateCcw size={13} /></button>
          <button onClick={() => onDelete(list.id)} className="p-2 rounded-lg text-muted-foreground" style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}><Trash2 size={13} /></button>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {items.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-2">No items</p>
            : items.map(item => <ItemRow key={item.id} item={item} listId={list.id} readOnly />)
          }
          <PriceSummary items={items} />
        </div>
      )}
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onDelete, onUse }: {
  template: GroceryList;
  onDelete: (id: number) => void;
  onUse: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemKey = ["/api/grocery/lists", template.id, "items"];
  const { data: items = [] } = useQuery<GroceryItem[]>({
    queryKey: itemKey,
    queryFn: async () => { const r = await apiRequest("GET", `/api/grocery/lists/${template.id}/items`); return r.json(); },
    staleTime: 120_000,
  });

  return (
    <div className="rounded-2xl border border-border/40 bg-background/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 cursor-pointer" style={{ minHeight: 52 }} onClick={() => setOpen(v => !v)}>
        <BookmarkCheck size={14} className="text-muted-foreground flex-shrink-0" />
        <p className="text-sm font-medium flex-1 truncate">{template.name}</p>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onUse(template.id)}
            className="flex items-center gap-1 px-3 rounded-lg text-[11px] font-semibold"
            style={{ background: "hsl(20 90% 60% / 0.12)", color: ACCENT, touchAction: "manipulation", height: 36 }}
          >
            <Copy size={11} /> Use
          </button>
          <button onClick={() => onDelete(template.id)} className="p-2 rounded-lg text-muted-foreground" style={{ touchAction: "manipulation", minWidth: 36, minHeight: 36 }}><Trash2 size={12} /></button>
        </div>
        <ChevronDown size={14} className={cn("text-muted-foreground flex-shrink-0", open && "rotate-180")} style={{ transition: "transform .2s" }} />
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {items.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-2">Empty template</p>
            : items.map(item => <ItemRow key={item.id} item={item} listId={template.id} readOnly />)
          }
        </div>
      )}
    </div>
  );
}

// ── Bottom-sheet dialog (mobile-first) ────────────────────────────────────────

function SheetDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center" onClick={onClose} style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-border/60 p-5 sm:p-6"
        style={{ background: "hsl(230 15% 9%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 rounded-full bg-border/60 mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} className="text-muted-foreground p-1" style={{ touchAction: "manipulation" }}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Create list dialog ────────────────────────────────────────────────────────

function CreateListDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (list: GroceryList) => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const r = await apiRequest("POST", "/api/grocery/lists", { name: name.trim(), date, is_template: 0, created_by: "together" });
      onCreated(await r.json());
    } catch { toast({ title: "Couldn't create list", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  return (
    <SheetDialog title="New grocery list" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly shop…"
            className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 outline-none focus:border-border"
            style={{ fontSize: 16, height: 44 }} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 outline-none focus:border-border"
            style={{ fontSize: 16, height: 44 }} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border/50 text-sm text-muted-foreground" style={{ height: 44, touchAction: "manipulation" }}>Cancel</button>
          <button type="submit" disabled={loading || !name.trim()} className="flex-1 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: ACCENT, color: "white", height: 44, touchAction: "manipulation" }}>Create</button>
        </div>
      </form>
    </SheetDialog>
  );
}

// ── Use template dialog ───────────────────────────────────────────────────────

function UseTemplateDialog({ template, onClose, onCreated }: { template: GroceryList; onClose: () => void; onCreated: (list: GroceryList) => void }) {
  const [name, setName] = useState(template.name);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await apiRequest("POST", `/api/grocery/lists/${template.id}/use-template`, { name: name.trim(), date, created_by: "together" });
      onCreated(await r.json());
    } catch { toast({ title: "Couldn't use template", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  return (
    <SheetDialog title={`Use: ${template.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 outline-none focus:border-border"
            style={{ fontSize: 16, height: 44 }} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 outline-none focus:border-border"
            style={{ fontSize: 16, height: 44 }} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border/50 text-sm text-muted-foreground" style={{ height: 44, touchAction: "manipulation" }}>Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: ACCENT, color: "white", height: 44, touchAction: "manipulation" }}>Create list</button>
        </div>
      </form>
    </SheetDialog>
  );
}

// ── Main GroceryTab ───────────────────────────────────────────────────────────

type Section = "active" | "archive" | "templates";

export default function GroceryTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [useTemplate, setUseTemplate] = useState<GroceryList | null>(null);
  const [section, setSection] = useState<Section>("active");

  const listsKey = ["/api/grocery/lists"];
  const { data: allData = [] } = useQuery<GroceryList[]>({
    queryKey: listsKey,
    queryFn: async () => { const r = await apiRequest("GET", "/api/grocery/lists"); return r.json(); },
    staleTime: 30_000,
  });

  const active    = allData.filter(l => !l.is_template && !l.is_completed).sort((a, b) => b.date.localeCompare(a.date));
  const archived  = allData.filter(l => !l.is_template &&  l.is_completed).sort((a, b) => b.date.localeCompare(a.date));
  const templates = allData.filter(l =>  l.is_template);

  function handleCreated(list: GroceryList) {
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => [...old, list]);
    setShowCreate(false); setUseTemplate(null); setSection("active");
  }

  async function handleDeleteList(id: number) {
    await apiRequest("DELETE", `/api/grocery/lists/${id}`);
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => old.filter(l => l.id !== id));
    toast({ title: "Deleted" });
  }

  async function handleSaveAsTemplate(id: number) {
    const list = allData.find(l => l.id === id);
    if (!list) return;
    const r = await apiRequest("PATCH", `/api/grocery/lists/${id}`, { is_template: 1 });
    const updated = await r.json();
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => old.map(l => l.id === id ? updated : l));
    toast({ title: `"${list.name}" saved as template` });
    setSection("templates");
  }

  async function handleComplete(id: number) {
    const r = await apiRequest("PATCH", `/api/grocery/lists/${id}`, { is_completed: 1 });
    const updated = await r.json();
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => old.map(l => l.id === id ? updated : l));
    toast({ title: "List archived 🎉" });
    setSection("archive");
  }

  async function handleRestore(id: number) {
    const r = await apiRequest("PATCH", `/api/grocery/lists/${id}`, { is_completed: 0 });
    const updated = await r.json();
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => old.map(l => l.id === id ? updated : l));
    toast({ title: "Restored to Active" });
    setSection("active");
  }

  const tabs: { id: Section; label: string; icon: React.ElementType; count: number }[] = [
    { id: "active",    label: "Active",    icon: ListChecks,    count: active.length },
    { id: "archive",   label: "Archive",   icon: Archive,       count: archived.length },
    { id: "templates", label: "Templates", icon: BookmarkCheck, count: templates.length },
  ];

  return (
    <div className="space-y-4 animate-page-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} style={{ color: ACCENT }} />
          <h2 className="text-base font-bold">Grocery Lists</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-semibold"
          style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44`, height: 40, touchAction: "manipulation" }}
        >
          <Plus size={14} /> New list
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex rounded-xl border border-border/40 p-1 gap-1 bg-background/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium")}
            style={{
              height: 40,
              touchAction: "manipulation",
              ...(section === tab.id ? { background: `${ACCENT}18`, color: ACCENT } : { color: "hsl(var(--muted-foreground))" }),
            }}
          >
            <tab.icon size={13} />
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: `${ACCENT}22`, color: ACCENT }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Active */}
      {section === "active" && (
        <div className="space-y-3">
          {active.length === 0
            ? <div className="text-center py-12 text-muted-foreground"><ShoppingCart size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No active lists</p><p className="text-xs mt-1 opacity-60">Create one or use a template</p></div>
            : active.map(list => <ListCard key={list.id} list={list} onDelete={handleDeleteList} onSaveAsTemplate={handleSaveAsTemplate} onComplete={handleComplete} />)
          }
        </div>
      )}

      {/* Archive */}
      {section === "archive" && (
        <div className="space-y-3">
          {archived.length === 0
            ? <div className="text-center py-12 text-muted-foreground"><Archive size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No archived lists yet</p></div>
            : archived.map(list => <ArchivedCard key={list.id} list={list} onDelete={handleDeleteList} onRestore={handleRestore} />)
          }
        </div>
      )}

      {/* Templates */}
      {section === "templates" && (
        <div className="space-y-3">
          {templates.length === 0
            ? <div className="text-center py-12 text-muted-foreground"><BookmarkCheck size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No templates yet</p><p className="text-xs mt-1 opacity-60">Save a list via the bookmark icon</p></div>
            : templates.map(t => <TemplateCard key={t.id} template={t} onDelete={handleDeleteList} onUse={id => setUseTemplate(allData.find(l => l.id === id)!)} />)
          }
        </div>
      )}

      {showCreate && <CreateListDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {useTemplate && <UseTemplateDialog template={useTemplate} onClose={() => setUseTemplate(null)} onCreated={handleCreated} />}
    </div>
  );
}
