import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import type { Collection, Item } from "@shared/schema";
import { STATUS_LABELS, STATUS_COLORS, getStatusesForMediaType, getMediaGroup, getExactMediaGroup } from "@shared/schema";
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
import { Plus, MoreHorizontal, Trash2, Edit3, ChevronRight, Layers, Sparkles, BookOpen, Film, Star, Tv, Book, Search as SearchIcon, Check, ArrowUpDown } from "lucide-react";
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
    label: "Together 🏠",
    emoji: "🏠",
    accent: "hsl(20 90% 60%)",
    emptyMsg: "Nothing shared yet. Start building your joint universe.",
  },
};

const TYPE_ICONS: Record<string, any> = {
  anime: Star, manga: BookOpen, movie: Film, series: Tv, book: Book,
};

// Per-type section config for the collections page
const MEDIA_TYPE_SECTIONS: Array<{
  key: string;
  label: string;
  Icon: any;
  statusOrder: string[];
}> = [
  { key: "anime",  label: "Anime",  Icon: Star,     statusOrder: ["watching", "completed", "want_to_rewatch", "dropped"] },
  { key: "movie",  label: "Movie",  Icon: Film,     statusOrder: ["watching", "completed", "want_to_rewatch", "dropped"] },
  { key: "series", label: "Series", Icon: Tv,       statusOrder: ["watching", "completed", "want_to_rewatch", "dropped"] },
  { key: "manga",  label: "Manga",  Icon: BookOpen, statusOrder: ["reading", "completed", "wishlist", "owned"] },
  { key: "book",   label: "Book",   Icon: Book,     statusOrder: ["reading", "completed", "wishlist", "owned"] },
];

// Tab config (media types + custom)
type TabKey = "anime" | "movie" | "series" | "manga" | "book" | "custom";
const COLLECTION_TABS: Array<{ key: TabKey; label: string; Icon: any }> = [
  { key: "anime",  label: "Anime",  Icon: Star },
  { key: "movie",  label: "Movie",  Icon: Film },
  { key: "series", label: "Series", Icon: Tv },
  { key: "manga",  label: "Manga",  Icon: BookOpen },
  { key: "book",   label: "Book",   Icon: Book },
  { key: "custom", label: "Custom", Icon: Sparkles },
];

// A horizontal strip of up to 5 covers at the top of each collection card.
// Always visible — shows covers when available, faded placeholders otherwise.
function CoverStrip({ covers, accent, count }: { covers: string[]; accent: string; count: number }) {
  // Show up to 5 slots; fill with placeholder divs if fewer covers
  const slots = 5;
  const filled = covers.slice(0, slots);
  const empty  = slots - filled.length;

  return (
    <div className="flex gap-0.5 w-full h-20 rounded-xl overflow-hidden">
      {filled.map((src, i) => (
        <div
          key={i}
          className="relative flex-1 overflow-hidden bg-secondary min-w-0"
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => {
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
              // show the fallback sibling
              (el.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
            }}
          />
          {/* Fallback shown only if img errors */}
          <div
            className="absolute inset-0 items-center justify-center hidden"
            style={{ background: `${accent}18` }}
          >
            <Layers size={12} style={{ color: `${accent}60` }} />
          </div>
        </div>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <div
          key={`e${i}`}
          className="flex-1 flex items-center justify-center min-w-0"
          style={{ background: `${accent}${i === 0 && filled.length === 0 ? "14" : "08"}` }}
        >
          {i === 0 && filled.length === 0 && (
            <Layers size={14} style={{ color: `${accent}40` }} />
          )}
        </div>
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

  // Match default collections by exact media type (e.g. "anime", "movie", "series", "manga", "book")
  const exactGroup = getExactMediaGroup(item.mediaType);
  const defaultCollections = ownerCollections.filter(c => c.isDefault && c.mediaGroup === exactGroup);
  const customCollections = ownerCollections.filter(c => !c.isDefault);

  const meta = OWNER_META[owner] || OWNER_META.together;
  const color = STATUS_COLORS[selectedStatus] ?? "hsl(220 8% 55%)";

  function handleAdd() {
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

type SortMode = "recent" | "title" | "rating" | "year";

function LibraryMirror({ owner, ownerCollections, mediaGroup }: { owner: string; ownerCollections: Collection[]; mediaGroup: "anime" | "book" }) {
  const { data: allItems } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<Item | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [subTypeFilter, setSubTypeFilter] = useState<string>("all");
  // Track locally added items for instant visual feedback (itemId → collectionId)
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();

  const ANIME_TYPES = ["anime", "movie", "series"];
  const BOOK_TYPES = ["manga", "book"];
  const SUB_TYPES = mediaGroup === "anime"
    ? ["all", "anime", "movie", "series"]
    : ["all", "manga", "book"];

  const sorted = [...(allItems || [])].sort((a, b) => {
    if (sortMode === "title") return a.title.localeCompare(b.title);
    if (sortMode === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortMode === "year") return (b.year ?? 0) - (a.year ?? 0);
    return b.id - a.id; // recent
  });

  const filtered = sorted.filter(i => {
    const typeMatch = mediaGroup === "anime"
      ? ANIME_TYPES.includes(i.mediaType)
      : BOOK_TYPES.includes(i.mediaType);
    if (!typeMatch) return false;
    if (subTypeFilter !== "all" && i.mediaType !== subTypeFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addMutation = useMutation({
    mutationFn: async ({ collectionId, status, item }: { collectionId: number; status: string; item: Item }) => {
      await apiRequest("POST", `/api/collections/${collectionId}/items`, {
        itemId: item.id,
        status,
      });
      return { collectionId, status, item };
    },
    onSuccess: (result) => {
      const { collectionId, status, item } = result;
      qc.setQueryData<any[]>(["/api/collections", collectionId, "items"], (old = []) => {
        if (old.some(i => i.id === item.id)) return old;
        return [...old, { ...item, collectionStatus: status }];
      });
      setAddedItems(prev => new Set(prev).add(item.id));
      toast({ title: "Added!", description: `${item.title} → ${STATUS_LABELS[status] ?? status}` });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const meta = OWNER_META[owner] || OWNER_META.together;
  const Icon = (type: string) => {
    const I = TYPE_ICONS[type] || Star;
    return <I size={20} className="text-muted-foreground/30" />;
  };

  const SORT_LABELS: Record<SortMode, string> = {
    recent: "Recent",
    title: "Title",
    rating: "Rating",
    year: "Year",
  };

  return (
    <div className="space-y-3">
      {/* Search + Sort row */}
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
        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-mirror-sort"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
            >
              <ArrowUpDown size={11} />
              {SORT_LABELS[sortMode]}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-28">
            {(["recent", "title", "rating", "year"] as SortMode[]).map(s => (
              <DropdownMenuItem
                key={s}
                onClick={() => setSortMode(s)}
                className="text-xs flex items-center justify-between"
              >
                {SORT_LABELS[s]}
                {sortMode === s && <Check size={10} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sub-type filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {SUB_TYPES.map(t => (
          <button
            key={t}
            data-testid={`filter-subtype-${t}`}
            onClick={() => setSubTypeFilter(t)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize",
              subTypeFilter === t
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground/50 self-center">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {(allItems || []).length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Library is empty. Add items via the search button.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {search ? `No results for "${search}".` : `No ${subTypeFilter !== "all" ? subTypeFilter : (mediaGroup === "anime" ? "anime, movies or series" : "manga or books")} in the library yet.`}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {filtered.map((item) => {
            const isAdded = addedItems.has(item.id);
            return (
              <button
                key={item.id}
                data-testid={`mirror-item-${item.id}`}
                onClick={() => setAddTarget(item)}
                className={cn(
                  "group relative rounded-lg overflow-hidden bg-card border transition-all duration-200 text-left",
                  isAdded
                    ? "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                    : "border-border hover:border-primary/50 hover:shadow-lg"
                )}
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
                  {/* Added badge */}
                  {isAdded && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Check size={9} className="text-white" />
                    </div>
                  )}
                  {/* Add overlay on hover */}
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
            );
          })}
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
            const item = addTarget;
            setAddTarget(null);
            addMutation.mutate({ collectionId, status, item });
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
  col, meta, isDefault, onEdit, onDelete, onClick, itemsData,
}: {
  col: Collection;
  meta: typeof OWNER_META[string];
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  itemsData?: any[];
}) {
  const qc = useQueryClient();
  const cachedItems = itemsData ?? (qc.getQueryData<any[]>(["/api/collections", col.id, "items"]) || []);
  const covers = cachedItems
    .filter((i: any) => !!i.coverUrl).map((i: any) => i.coverUrl as string);
  const count = cachedItems.length;
  const statusColor = col.defaultStatus ? (STATUS_COLORS[col.defaultStatus] ?? null) : null;

  return (
    <div
      data-testid={`card-collection-${col.id}`}
      className={cn(
        "group relative rounded-2xl border border-border bg-card overflow-hidden",
        "hover:shadow-xl transition-all duration-300 cursor-pointer",
        "animate-card-rise"
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
      {/* Cover strip — always visible at the top */}
      <CoverStrip covers={covers} accent={meta.accent} count={count} />

      {/* Info row below the strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {statusColor && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
            )}
            <h3 className="font-bold text-sm text-foreground truncate">{col.name}</h3>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <Layers size={9} />
              {count} item{count !== 1 ? "s" : ""}
            </p>
            {col.description && (
              <p className="text-[10px] text-muted-foreground/40 truncate">{col.description}</p>
            )}
          </div>
        </div>

        {!isDefault ? (
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
        ) : (
          <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
        )}
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
  const [activeTab, setActiveTab] = useState<TabKey>("anime");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const meta = OWNER_META[owner] || OWNER_META.together;

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections", owner],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/collections?owner=${owner}`, {
        headers: getAuthToken() ? { "x-auth-token": getAuthToken() } : {},
      });
      return res.json();
    },
  });

  const cols = collections || [];

  // Prefetch items for ALL collections so CoverMosaic always has data
  const itemQueries = useQueries({
    queries: cols.map(col => ({
      queryKey: ["/api/collections", col.id, "items"],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/collections/${col.id}/items`, {
          headers: getAuthToken() ? { "x-auth-token": getAuthToken() } : {},
        });
        return res.json();
      },
      staleTime: 60_000,
    })),
  });

  // Build a map of collectionId → items array (from prefetched queries)
  const itemsByColId: Record<number, any[]> = {};
  cols.forEach((col, idx) => {
    const q = itemQueries[idx];
    if (q?.data) itemsByColId[col.id] = q.data;
  });

  // Per-type default collections (5 sections: anime / movie / series / manga / book)
  const defaultColsByType = (type: string) =>
    cols.filter(c => c.isDefault && c.mediaGroup === type)
      .sort((a, b) => {
        const section = MEDIA_TYPE_SECTIONS.find(s => s.key === type);
        const order = section?.statusOrder ?? [];
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

  // For mirror: pass all default collections matching the broad group + all custom
  const ANIME_BROAD = ["anime", "movie", "series"];
  const BOOK_BROAD  = ["manga", "book"];
  const mirrorOwnerCols = cols.filter(c =>
    !c.isDefault ||
    (mirrorMediaGroup === "anime" ? ANIME_BROAD : BOOK_BROAD).includes(c.mediaGroup ?? "")
  );

  return (
    <div className="max-w-3xl animate-page-in space-y-6">
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
            onClick={() => { setActiveTab("custom"); setCreateOpen(true); }}
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
            mediaGroup={mirrorMediaGroup}
            ownerCollections={mirrorOwnerCols}
          />
        </div>
      )}

      {/* ── Tab bar: Anime | Movie | Series | Manga | Book | Custom */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {COLLECTION_TABS.map(tab => {
          const Icon = tab.Icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              data-testid={`tab-collections-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0",
                isActive
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
              style={isActive ? { background: meta.accent, boxShadow: `0 2px 10px ${meta.accent}44` } : {}}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : activeTab === "custom" ? (
        /* ── Custom tab */
        <section className="space-y-3">
          {customCols.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <div className="text-4xl mb-3 animate-float emoji-pop">{meta.emoji}</div>
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
              {customCols.map((col) => (
                <CollectionCard
                  key={col.id}
                  col={col}
                  meta={meta}
                  isDefault={false}
                  itemsData={itemsByColId[col.id]}
                  onEdit={() => setEditTarget(col)}
                  onDelete={() => deleteMutation.mutate(col.id)}
                  onClick={() => setLocation(`/collections/${col.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ── Media type tab (anime / movie / series / manga / book) */
        <section className="space-y-3">
          {(() => {
            const typeCols = defaultColsByType(activeTab);
            const section = MEDIA_TYPE_SECTIONS.find(s => s.key === activeTab)!;
            const Icon = section.Icon;
            if (typeCols.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Icon size={32} className="mb-3 opacity-20" />
                  <p className="text-sm text-muted-foreground/60">No {section.label} collections yet</p>
                </div>
              );
            }
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {typeCols.map((col) => (
                  <CollectionCard
                    key={col.id}
                    col={col}
                    meta={meta}
                    isDefault
                    itemsData={itemsByColId[col.id]}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onClick={() => setLocation(`/collections/${col.id}`)}
                  />
                ))}
              </div>
            );
          })()}
        </section>
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
