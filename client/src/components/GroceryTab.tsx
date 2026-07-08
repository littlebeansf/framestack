/**
 * GroceryTab — shared grocery lists for Together.
 *
 * Features:
 * - Create lists for a specific date
 * - Add items with name, optional location, optional price
 * - Checklist tracking with progress bar
 * - Save any list as a template
 * - Create new list from a template
 * - Delete lists / items
 * - Inline item editing
 */

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Check, ChevronDown, ChevronRight,
  BookmarkPlus, BookmarkCheck, Copy, Pencil, X, MapPin, Euro, ShoppingCart, ListChecks,
} from "lucide-react";
import type { GroceryList, GroceryItem } from "@shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item, listId, readOnly,
}: { item: GroceryItem; listId: number; readOnly?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [location, setLocation] = useState(item.location ?? "");
  const [price, setPrice] = useState(item.price != null ? String(item.price) : "");
  const itemKey = ["/api/grocery/lists", listId, "items"];

  async function toggle() {
    const r = await apiRequest("PATCH", `/api/grocery/items/${item.id}`, { checked: item.checked ? 0 : 1 });
    const updated = await r.json();
    qc.setQueryData(itemKey, (old: GroceryItem[] = []) =>
      old.map(i => i.id === item.id ? updated : i)
    );
  }

  async function save() {
    const r = await apiRequest("PATCH", `/api/grocery/items/${item.id}`, {
      name, location: location || null, price: price ? parseFloat(price) : null,
    });
    const updated = await r.json();
    qc.setQueryData(itemKey, (old: GroceryItem[] = []) =>
      old.map(i => i.id === item.id ? updated : i)
    );
    setEditing(false);
  }

  async function remove() {
    await apiRequest("DELETE", `/api/grocery/items/${item.id}`);
    qc.setQueryData(itemKey, (old: GroceryItem[] = []) => old.filter(i => i.id !== item.id));
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-3">
        <input
          className="w-full bg-transparent text-sm font-medium outline-none border-b border-border pb-1"
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Item name"
          autoFocus
        />
        <div className="flex gap-2">
          <div className="flex items-center gap-1 flex-1 text-muted-foreground">
            <MapPin size={12} />
            <input className="bg-transparent text-xs outline-none flex-1" value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Euro size={12} />
            <input className="bg-transparent text-xs outline-none w-16" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01" min="0" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg">Cancel</button>
          <button onClick={save} className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: "hsl(20 90% 60% / 0.15)", color: "hsl(20 90% 60%)" }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-all group",
        item.checked
          ? "border-border/30 bg-background/20 opacity-60"
          : "border-border/50 bg-background/40 hover:border-border",
      )}
    >
      {/* Checkbox */}
      <button
        onClick={readOnly ? undefined : toggle}
        className={cn(
          "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
          item.checked
            ? "border-transparent bg-green-500"
            : "border-border hover:border-foreground/50",
        )}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", item.checked && "line-through text-muted-foreground")}>{item.name}</p>
        {(item.location || item.price != null) && (
          <div className="flex items-center gap-2 mt-0.5">
            {item.location && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin size={9} />{item.location}
              </span>
            )}
            {item.price != null && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Euro size={9} />{item.price.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={remove} className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add item form ─────────────────────────────────────────────────────────────

function AddItemForm({ listId }: { listId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemKey = ["/api/grocery/lists", listId, "items"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const items = qc.getQueryData<GroceryItem[]>(itemKey) ?? [];
    const r = await apiRequest("POST", `/api/grocery/lists/${listId}/items`, {
      name: name.trim(),
      location: location.trim() || null,
      price: price ? parseFloat(price) : null,
      sort_order: items.length,
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
          className="flex-1 bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border placeholder:text-muted-foreground/50"
        />
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="p-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
          title="Add location / price"
        >
          <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          type="submit"
          className="p-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {expanded && (
        <div className="flex gap-2 mt-2">
          <div className="flex items-center gap-1.5 flex-1 bg-background/40 border border-border/50 rounded-xl px-3 py-2">
            <MapPin size={12} className="text-muted-foreground flex-shrink-0" />
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground/50" />
          </div>
          <div className="flex items-center gap-1.5 bg-background/40 border border-border/50 rounded-xl px-3 py-2 w-28">
            <Euro size={12} className="text-muted-foreground flex-shrink-0" />
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01" min="0" className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground/50" />
          </div>
        </div>
      )}
    </form>
  );
}

// ── List card ─────────────────────────────────────────────────────────────────

function ListCard({
  list, onDelete, onSaveAsTemplate,
}: {
  list: GroceryList;
  onDelete: (id: number) => void;
  onSaveAsTemplate: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemKey = ["/api/grocery/lists", list.id, "items"];

  const { data: items = [] } = useQuery<GroceryItem[]>({
    queryKey: itemKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/grocery/lists/${list.id}/items`);
      return r.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  const checked = items.filter(i => i.checked).length;
  const total   = items.length;
  const pct     = total ? Math.round((checked / total) * 100) : 0;
  const done    = total > 0 && checked === total;

  const accent = "hsl(20 90% 60%)";

  return (
    <div className={cn(
      "rounded-2xl border transition-all overflow-hidden",
      done ? "border-green-500/30 bg-green-500/5" : "border-border/60 bg-background/40",
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        >
          {open
            ? <ChevronDown size={16} />
            : <ChevronRight size={16} />
          }
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-semibold truncate", done && "text-green-400")}>{list.name}</p>
            {done && <Check size={12} className="text-green-400 flex-shrink-0" strokeWidth={3} />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(list.date)}</p>
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20 h-1.5 rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: done ? "#22c55e" : accent }}
              />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{checked}/{total}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onSaveAsTemplate(list.id)}
            title="Save as template"
            className="p-1.5 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookmarkPlus size={13} />
          </button>
          <button
            onClick={() => onDelete(list.id)}
            title="Delete list"
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">No items yet — add one below</p>
          )}
          {items.map(item => (
            <ItemRow key={item.id} item={item} listId={list.id} />
          ))}
          <AddItemForm listId={list.id} />
        </div>
      )}
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, onDelete, onUse,
}: {
  template: GroceryList;
  onDelete: (id: number) => void;
  onUse: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemKey = ["/api/grocery/lists", template.id, "items"];

  const { data: items = [] } = useQuery<GroceryItem[]>({
    queryKey: itemKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/grocery/lists/${template.id}/items`);
      return r.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <div className="rounded-2xl border border-border/40 bg-background/30 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        <BookmarkCheck size={14} className="text-muted-foreground flex-shrink-0" />
        <p className="text-sm font-medium flex-1 truncate">{template.name}</p>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onUse(template.id)}
            title="Use template"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: "hsl(20 90% 60% / 0.12)", color: "hsl(20 90% 60%)" }}
          >
            <Copy size={11} /> Use
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")} />
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {items.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-1">Empty template</p>
            : items.map(item => (
              <ItemRow key={item.id} item={item} listId={template.id} readOnly />
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Create list dialog ────────────────────────────────────────────────────────

function CreateListDialog({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (list: GroceryList) => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const r = await apiRequest("POST", "/api/grocery/lists", {
        name: name.trim(), date, is_template: 0, created_by: "together",
      });
      onCreated(await r.json());
    } catch {
      toast({ title: "Couldn't create list", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-2xl border border-border/60 p-6 w-full max-w-sm" style={{ background: "hsl(230 15% 9%)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-base">New grocery list</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">List name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Weekly shop, Saturday market…"
              className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50" style={{ background: "hsl(20 90% 60%)", color: "white" }}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Use template dialog ───────────────────────────────────────────────────────

function UseTemplateDialog({
  template, onClose, onCreated,
}: { template: GroceryList; onClose: () => void; onCreated: (list: GroceryList) => void }) {
  const [name, setName] = useState(template.name);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await apiRequest("POST", `/api/grocery/lists/${template.id}/use-template`, {
        name: name.trim(), date, created_by: "together",
      });
      onCreated(await r.json());
    } catch {
      toast({ title: "Couldn't use template", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-2xl border border-border/60 p-6 w-full max-w-sm" style={{ background: "hsl(230 15% 9%)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-base">Use template: {template.name}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">List name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "hsl(20 90% 60%)", color: "white" }}>
              Create list
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main GroceryTab ───────────────────────────────────────────────────────────

export default function GroceryTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [useTemplate, setUseTemplate] = useState<GroceryList | null>(null);
  const [section, setSection] = useState<"lists" | "templates">("lists");

  const listsKey = ["/api/grocery/lists"];
  const { data: allData = [] } = useQuery<GroceryList[]>({
    queryKey: listsKey,
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/grocery/lists");
      return r.json();
    },
    staleTime: 30_000,
  });

  const lists     = allData.filter(l => !l.is_template).sort((a, b) => b.date.localeCompare(a.date));
  const templates = allData.filter(l =>  l.is_template);

  function handleCreated(list: GroceryList) {
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => [...old, list]);
    setShowCreate(false);
    setUseTemplate(null);
  }

  async function handleDelete(id: number) {
    await apiRequest("DELETE", `/api/grocery/lists/${id}`);
    qc.setQueryData(listsKey, (old: GroceryList[] = []) => old.filter(l => l.id !== id));
    toast({ title: "List deleted" });
  }

  async function handleSaveAsTemplate(id: number) {
    const list = allData.find(l => l.id === id);
    if (!list) return;
    const r = await apiRequest("PATCH", `/api/grocery/lists/${id}`, { is_template: 1 });
    const updated = await r.json();
    qc.setQueryData(listsKey, (old: GroceryList[] = []) =>
      old.map(l => l.id === id ? updated : l)
    );
    toast({ title: `"${list.name}" saved as template`, description: "Find it in the Templates tab." });
    setSection("templates");
  }

  const accent = "hsl(20 90% 60%)";

  return (
    <div className="space-y-4 animate-page-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} style={{ color: accent }} />
          <h2 className="text-base font-bold">Grocery Lists</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
        >
          <Plus size={14} /> New list
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border/40 p-1 gap-1 bg-background/30">
        {[
          { id: "lists", label: "Lists", icon: ListChecks, count: lists.length },
          { id: "templates", label: "Templates", icon: BookmarkCheck, count: templates.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id as "lists" | "templates")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all",
              section === tab.id
                ? "text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            style={section === tab.id ? { background: `${accent}18`, color: accent } : {}}
          >
            <tab.icon size={13} />
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: `${accent}22`, color: accent }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lists */}
      {section === "lists" && (
        <div className="space-y-3">
          {lists.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No lists yet</p>
              <p className="text-xs mt-1 opacity-70">Create one above or use a template</p>
            </div>
          )}
          {lists.map(list => (
            <ListCard
              key={list.id}
              list={list}
              onDelete={handleDelete}
              onSaveAsTemplate={handleSaveAsTemplate}
            />
          ))}
        </div>
      )}

      {/* Templates */}
      {section === "templates" && (
        <div className="space-y-3">
          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookmarkCheck size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No templates yet</p>
              <p className="text-xs mt-1 opacity-70">Save a list as template via the bookmark icon</p>
            </div>
          )}
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onDelete={handleDelete}
              onUse={id => setUseTemplate(allData.find(l => l.id === id)!)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <CreateListDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {useTemplate && (
        <UseTemplateDialog
          template={useTemplate}
          onClose={() => setUseTemplate(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
