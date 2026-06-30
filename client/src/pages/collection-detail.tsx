import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import type { Collection, Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FolderOpen, Clock } from "lucide-react";
import ItemCard from "@/components/ItemCard";
import { calcCollectionTimeStats, formatDuration } from "@/lib/timeEstimate";

function SkeletonCard() {
  return (
    <div className="rounded-lg overflow-hidden bg-card border border-border">
      <div className="aspect-[2/3] skeleton" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 skeleton rounded w-full" />
        <div className="h-3 skeleton rounded w-2/3" />
      </div>
    </div>
  );
}

// ── Time Bar ─────────────────────────────────────────────────────────────────

function CollectionTimeBar({ items }: { items: Item[] }) {
  const stats = calcCollectionTimeStats(items);
  if (!stats.hasEstimate || items.length === 0) return null;

  const segments = [
    { frac: stats.completedFrac,  color: "hsl(160 65% 45%)",  label: "Completed" },
    { frac: stats.inProgressFrac, color: "hsl(255 70% 65%)",  label: "In progress" },
    { frac: stats.notStartedFrac, color: "hsl(220 8% 30%)",   label: "Not started" },
  ].filter(s => s.frac > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock size={13} />
          <span className="text-xs font-medium">Estimated time</span>
        </div>
        <span className="text-sm font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {formatDuration(stats.totalMinutes)}
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-secondary">
        {segments.map((s, i) => (
          <div
            key={i}
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${s.frac * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          stats.completedMinutes   > 0 && { color: "hsl(160 65% 45%)", label: "Completed",   mins: stats.completedMinutes },
          stats.inProgressMinutes  > 0 && { color: "hsl(255 70% 65%)", label: "In progress", mins: stats.inProgressMinutes },
          stats.notStartedMinutes  > 0 && { color: "hsl(220 8% 45%)",  label: "Not started", mins: stats.notStartedMinutes },
        ].filter(Boolean).map((seg: any) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[11px] text-muted-foreground">
              {seg.label} <span className="text-foreground/70">{formatDuration(seg.mins)}</span>
            </span>
          </div>
        ))}
        <span className="text-[10px] text-muted-foreground/40 ml-auto">estimated</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionDetailPage() {
  const [, params] = useRoute("/collections/:id");
  const id = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allCollections } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });
  const collection = (allCollections || []).find(c => c.id === id);

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/collections", id, "items"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/collections/${id}/items`);
        const data: Item[] = await res.json();
        data.forEach(i => localStore.addItemToCollection(id, i.id));
        return data;
      } catch {
        return localStore.getCollectionItems(id);
      }
    },
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: async (itemId: number) => {
      try {
        await apiRequest("DELETE", `/api/collections/${id}/items/${itemId}`);
      } catch { /* offline — just update cache */ }
      return itemId;
    },
    onSuccess: (itemId: number) => {
      qc.setQueryData<any[]>(["/api/collections", id, "items"], (old = []) =>
        old.filter(i => i.id !== itemId)
      );
      localStore.removeItemFromCollection(id, itemId);
      toast({ title: "Removed from collection" });
    },
  });

  const itemList = items || [];

  return (
    <div className="animate-page-in space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => setLocation("/collections")}
          data-testid="button-back-collections"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Collections
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <FolderOpen size={18} className="text-primary" />
              {collection?.name ?? "Collection"}
            </h1>
            {collection?.description && (
              <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-1">
            {itemList.length} item{itemList.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Time bar — shown when items are loaded */}
      {!isLoading && itemList.length > 0 && (
        <CollectionTimeBar items={itemList} />
      )}

      {/* Items grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : itemList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <FolderOpen size={40} className="mb-4 opacity-20" />
          <p className="font-medium text-foreground text-sm">This collection is empty</p>
          <p className="text-xs mt-1 max-w-xs">Open an item from your library and add it to this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {itemList.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
