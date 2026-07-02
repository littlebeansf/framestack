import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import type { Collection, Item } from "@shared/schema";
import { STATUS_LABELS, STATUS_COLORS, getStatusesForMediaType, getMediaGroup } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Edit3, ChevronRight, Layers, Sparkles, BookOpen, Film, Star, Tv, Book, Search as SearchIcon, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const OWNER_META: Record<string, { label: string; emoji: string; accent: string; emptyMsg: string }> = {
  jack: {
    label: "Jack's Collections",
    emoji: "🐻",
    accent: "hsl(220 80% 60%)",
    emptyMsg: "No custom collections yet. Make one before you forget what you wanted to watch.",
  },
  sally: {
    label: "Sally's Collections",
    emoji: "🌸",
    accent: "hsl(330 75% 65%)",
    emptyMsg: "No custom collections yet. Time to organise your fictional universe.",
  },
  together: {
    label: "Together 🫶",
    emoji: "🫶",
    accent: "hsl(20 90% 60%)",
    emptyMsg: "Nothing shared yet. Start building your joint universe.",
  },
};

const TYPE_ICONS: Record<string, any> = {
  anime: Star, manga: BookOpen, movie: Film, series: Tv, book: Book,
};

const MEDIA_GROUP_LABELS: Record<string, string> = {
  anime: "Anime · Movie · Series",
  book: "Manga · Book",
};

function CoverMosaic({ covers }: { covers: string[] }) {
  const filled = covers.slice(0, 4);
  if (filled.length === 0) {
    return (
      <div className="w-16 h-20 rounded-xl bg-secondary flex items-center justify-center shrink-0">
        <Layers size={16} className="text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <div className="w-16 h-20 rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-border/40">
      {filled.map((src, i) => (
        <div key={i} className="overflow-hidden bg-secondary">
          <img src={src} alt="" className="w-full h-full object-cover" loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      ))}
      {Array.from({ length: 4 - filled.length }).map((_, i) => (
        <div key={`e${i}`} className="bg-secondary/60" />
      ))}
    </div>
  );
}

// ── Add-to-Collection Dialog (from library mirror) ────────────────────────────

function AddToCollectionDialog({
  open,
  onOpenChange,
  item,
  owner,
  ownerCollections,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: Item;
  owner: string;
  ownerCollections: Collection[];
  onAdd: (collectionId: number, status: string) => void;
}) {
  const statuses = getStatusesForMediaType(item.mediaType);
  const defaultStatus = statuses[0];
  const [selectedStatus, setSelectedStatus] = useState<string>(defaultStatus);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);

  // Pick sensible collection to preselect: default collection matching status
  const defaultCollections = ownerCollections.filter(c => c.isDefault && c.mediaGroup === getMediaGroup(item.mediaType));
  const customCollections = ownerCollections.filter(c => !c.isDefault);

  const meta = OWNER_META[owner] || OWNER_META.together;
  const color = STATUS_COLORS[selectedStatus] ?? "hsl(220 8% 55%)";

  function handleAdd() {
    // If a specific collection is selected, add there; otherwise add to the default collection matching the status
    if (selectedCollection !== null) {
      onAdd(selectedCollection, selectedStatus);
    } else {
      const matchingDefault = defaultCollections.find(c => c.defaultStatus === selectedStatus);
      if (matchingDefault) {
        onAdd(matchingDefault.id, selectedStatus);
      } else if (defaultCollections[0]) {
        onAdd(defaultCollections[0].id, selectedStatus);
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold pr-4 leading-snug">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Cover + type */}
          <div className="flex gap-3 items-start">
            {item.coverUrl && (
              <img src={item.coverUrl} alt={item.title} className="w-12 h-16 rounded object-cover shrink-0" />
            )}
            <div>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium leading-none", `badge-${item.mediaType}`)}>
                {item.mediaType}
              </span>
              {item.year && <p className="text-[11px] text-muted-foreground mt-1">{item.year}</p>}
            </div>
          </div>

          {/* Status selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map(s => (
                <button
                  key={s}
                  onClick={() => { setSelectedStatus(s); setSelectedCollection(null); }}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all"
                  style={{
                    backgroundColor: selectedStatus === s ? `${STATUS_COLORS[s] ?? "hsl(220 8% 55%)"}25` : "transparent",
                    color: selectedStatus === s ? STATUS_COLORS[s] ?? "hsl(220 8% 65%)" : "hsl(220 8% 65%)",
                    borderColor: selectedStatus === s ? `${STATUS_COLORS[s] ?? "hsl(220 8% 55%)"}55` : "hsl(220 8% 25%)",
                  }}
                >
                  {selectedStatus === s && <Check size={9} />}
                  {STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>

          {/* Optional: pick a specific collection */}
          {(defaultCollections.length > 0 || customCollections.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Collection (optional)</p>
              <p className="text-[11px] text-muted-foreground/70">Defaults to the status-based collection for {meta.emoji}.</p>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {defaultCollections.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCollection(selectedCollection === c.id ? null : c.id)}
                    className={cn(
                      "flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border text-left transition-colors",
                      selectedCollection === c.id
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <span>{c.name}</span>
                    {c.defaultStatus === selectedStatus && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">auto</span>
                    )}
                  </button>
                ))}
                {customCollections.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCollection(selectedCollection === c.id ? null : c.id)}
                    className={cn(
                      "flex items-center text-xs px-3 py-1.5 rounded-lg border text-left transition-colors",
                      selectedCollection === c.id
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleAdd}
            style={{ background: meta.accent, color: "white", border: "none" }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Library Mirror ────────────────────────────────────────────────────────────

function LibraryMirror({ owner, ownerCollections }: { owner: string; ownerCollections: Collection[] }) {
  const { data: allItems } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<Item | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const filtered = (allItems || []).filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: async ({ collectionId, status }: { collectionId: number; status: string }) => {
      if (!addTarget) return;
      await apiRequest("POST", `/api/collections/${collectionId}/items`, {
        itemId: addTarget.id,
        status,
      });
      return { collectionId, status };
    },
    onSuccess: (result) => {
      if (!result || !addTarget) return;
      qc.setQueryData<any[]>(["/api/collections", result.collectionId, "items"], (old = []) => {
        if (old.some(i => i.id === addTarget.id)) return old;
        return [...old, { ...addTarget, collectionStatus: result.status }];
      });
      toast({ title: "Added!", description: `${addTarget.title} → ${STATUS_LABELS[result.status] ?? result.status}` });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const meta = OWNER_META[owner] || OWNER_META.together;
  const Icon = (type: string) => {
    const I = TYPE_ICONS[type] || Star;
    return <I size={20} className="text-muted-foreground/30" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search library…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-mirror-search"
          />
        </div>
      </div>

      {(allItems || []).length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Library is empty. Add items via the search button.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No items match "{search}".</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              data-testid={`mirror-item-${item.id}`}
              onClick={() => setAddTarget(item)}
              className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 text-left"
              title={`Add "${item.title}" to ${meta.emoji} collection`}
            >
              <div className="relative aspect-[2/3] bg-secondary">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {Icon(item.mediaType)}
                  </div>
                )}
                {/* Add overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                  <Plus
                    size={20}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg"
                  />
                </div>
              </div>
              <div className="px-1.5 py-1.5">
                <p className="text-[10px] font-medium text-foreground leading-tight line-clamp-2">{item.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {addTarget && (
        <AddToCollectionDialog
          open={!!addTarget}
          onOpenChange={v => !v && setAddTarget(null)}
          item={addTarget}
          owner={owner}
          ownerCollections={ownerCollections}
          onAdd={(collectionId, status) => {
            addMutation.mutate({ collectionId, status });
            setAddTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── Create/Edit Dialog ────────────────────────────────────────────────────────

function CreateEditDialog({
  open, onOpenChange, existing, owner,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; existing?: Collection; owner: string;
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();
  const meta = OWNER_META[owner] || OWNER_META.together;

  const mutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        const res = await apiRequest("PATCH", `/api/collections/${existing.id}`, form);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/collections", { ...form, owner, isDefault: false });
      return res.json();
    },
    onSuccess: (result: Collection) => {
      const current = qc.getQueryData<Collection[]>(["/api/collections", owner]) || [];
      if (existing) {
        qc.setQueryData(["/api/collections", owner], current.map(c => c.id === existing.id ? result : c));
      } else {
        qc.setQueryData(["/api/collections", owner], [...current, result]);
      }
      toast({ title: existing ? "Collection updated" : `Collection created ${meta.emoji}` });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{meta.emoji}</span>
            {existing ? "Edit collection" : `New ${owner === "together" ? "shared" : owner + "'s"} collection`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            data-testid="input-collection-name"
            placeholder="Collection name…"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Textarea
            data-testid="textarea-collection-description"
            placeholder="What's this about? (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="resize-none"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim()}
            data-testid="button-save-collection"
            style={{ background: meta.accent, color: "white", border: "none" }}
          >
            {mutation.isPending ? "Saving…" : existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Collection Card ────────────────────────────────────────────────────────────

function CollectionCard({
  col, meta, isDefault, onEdit, onDelete, onClick,
}: {
  col: Collection;
  meta: typeof OWNER_META[string];
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const qc = useQueryClient();
  const covers = (qc.getQueryData<any[]>(["/api/collections", col.id, "items"]) || [])
    .filter((i: any) => !!i.coverUrl).map((i: any) => i.coverUrl as string).slice(0, 4);
  const count = (qc.getQueryData<any[]>(["/api/collections", col.id, "items"]) || []).length;
  const statusColor = col.defaultStatus ? (STATUS_COLORS[col.defaultStatus] ?? null) : null;

  return (
    <div
      data-testid={`card-collection-${col.id}`}
      className={cn(
        "group relative rounded-2xl border border-border bg-card p-4",
        "hover:shadow-xl transition-all duration-300 cursor-pointer",
        "animate-card-in"
      )}
      onClick={onClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${meta.accent}55`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${meta.accent}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      <div className="flex items-start gap-3">
        <CoverMosaic covers={covers} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                {statusColor && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                )}
                <h3 className="font-bold text-sm text-foreground truncate">{col.name}</h3>
              </div>
              {col.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{col.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Layers size={9} />
                  {count} item{count !== 1 ? "s" : ""}
                </p>
                {isDefault && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {MEDIA_GROUP_LABELS[col.mediaGroup ?? ""] ?? col.mediaGroup}
                  </span>
                )}
              </div>
            </div>
            {!isDefault && (
              <div className="shrink-0 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid={`button-col-menu-${col.id}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit3 size={12} className="mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={onDelete}
                    >
                      <Trash2 size={12} className="mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </div>
            )}
            {isDefault && (
              <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OwnerCollectionsPage({ owner }: { owner: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [showMirror, setShowMirror] = useState(false);
  const [mirrorMediaGroup, setMirrorMediaGroup] = useState<"anime" | "book">("anime");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const meta = OWNER_META[owner] || OWNER_META.together;

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections", owner],
    queryFn: async () => {
      const base = API_BASE;
      const res = await fetch(`${base}/api/collections?owner=${owner}`);
      return res.json();
    },
  });

  const cols = collections || [];
  const defaultAnimeCols = cols.filter(c => c.isDefault && c.mediaGroup === "anime")
    .sort((a, b) => {
      const order = ["watching", "completed", "want_to_rewatch", "dropped"];
      return order.indexOf(a.defaultStatus ?? "") - order.indexOf(b.defaultStatus ?? "");
    });
  const defaultBookCols = cols.filter(c => c.isDefault && c.mediaGroup === "book")
    .sort((a, b) => {
      const order = ["reading", "completed", "wishlist", "owned"];
      return order.indexOf(a.defaultStatus ?? "") - order.indexOf(b.defaultStatus ?? "");
    });
  const customCols = cols.filter(c => !c.isDefault);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/collections/${id}`);
      return id;
    },
    onSuccess: (id: number) => {
      qc.setQueryData(["/api/collections", owner], cols.filter(c => c.id !== id));
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Cannot delete a default collection", variant: "destructive" }),
  });

  const mirrorCols = showMirror
    ? cols.filter(c => c.mediaGroup === mirrorMediaGroup || !c.isDefault)
    : [];

  return (
    <div className="max-w-3xl animate-page-in space-y-8">
      {/* ── Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <h1 className="text-xl font-extrabold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {meta.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cols.length} collection{cols.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowMirror(v => !v)}
            size="sm"
            variant="outline"
            data-testid="button-toggle-mirror"
            className="gap-1.5 text-xs"
          >
            <BookOpen size={13} />
            {showMirror ? "Hide library" : "Add from library"}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            data-testid="button-new-collection"
            className="gap-1.5 text-white border-none"
            style={{ background: meta.accent, boxShadow: `0 2px 12px ${meta.accent}55` }}
          >
            <Plus size={14} />
            New
          </Button>
        </div>
      </div>

      {/* ── Library Mirror */}
      {showMirror && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Library — add to {meta.emoji}</p>
            <div className="flex gap-1">
              {(["anime", "book"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setMirrorMediaGroup(g)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    mirrorMediaGroup === g
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {g === "anime" ? "Anime · Movie · Series" : "Manga · Book"}
                </button>
              ))}
            </div>
          </div>
          <LibraryMirror
            owner={owner}
            ownerCollections={cols.filter(c =>
              !c.isDefault || c.mediaGroup === mirrorMediaGroup
            )}
          />
        </div>
      )}

      {/* ── Anime/Movie/Series collections */}
      {defaultAnimeCols.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Star size={13} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Anime · Movie · Series
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {defaultAnimeCols.map((col, idx) => (
              <CollectionCard
                key={col.id}
                col={col}
                meta={meta}
                isDefault
                onEdit={() => {}}
                onDelete={() => {}}
                onClick={() => setLocation(`/collections/${col.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Manga/Book collections */}
      {defaultBookCols.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Manga · Book
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {defaultBookCols.map((col, idx) => (
              <CollectionCard
                key={col.id}
                col={col}
                meta={meta}
                isDefault
                onEdit={() => {}}
                onDelete={() => {}}
                onClick={() => setLocation(`/collections/${col.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Custom collections */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Custom collections
            </h2>
          </div>
        </div>

        {customCols.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <div className="text-4xl mb-3 animate-wiggle">{meta.emoji}</div>
            <p className="font-semibold text-foreground text-sm mb-1.5">No custom collections yet</p>
            <p className="text-xs max-w-[220px] leading-relaxed mb-4">{meta.emptyMsg}</p>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Plus size={13} />
              Create first collection
            </Button>
          </div>
        )}

        {customCols.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {customCols.map((col, idx) => (
              <CollectionCard
                key={col.id}
                col={col}
                meta={meta}
                isDefault={false}
                onEdit={() => setEditTarget(col)}
                onDelete={() => deleteMutation.mutate(col.id)}
                onClick={() => setLocation(`/collections/${col.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      )}

      <CreateEditDialog open={createOpen} onOpenChange={setCreateOpen} owner={owner} />
      {editTarget && (
        <CreateEditDialog
          open={!!editTarget}
          onOpenChange={v => !v && setEditTarget(null)}
          existing={editTarget}
          owner={owner}
        />
      )}
    </div>
  );
}
