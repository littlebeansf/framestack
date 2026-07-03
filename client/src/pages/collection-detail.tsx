import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import type { Collection } from "@shared/schema";
import type { ItemWithStatus } from "@shared/schema";
import { STATUS_LABELS, STATUS_COLORS, getStatusesForMediaType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FolderOpen, Clock, ChevronDown } from "lucide-react";
import ItemCard from "@/components/ItemCard";
import { calcCollectionTimeStats, formatDuration } from "@/lib/timeEstimate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// ── Status Chip (inline changer) ──────────────────────────────────────────────

function StatusChip({
  item,
  collectionId,
  onStatusChange,
}: {
  item: ItemWithStatus;
  collectionId: number;
  onStatusChange: (itemId: number, status: string) => void;
}) {
  const statuses = getStatusesForMediaType(item.mediaType);
  const currentStatus = item.collectionStatus;
  const color = currentStatus ? (STATUS_COLORS[currentStatus] ?? "hsl(220 8% 55%)") : "hsl(220 8% 55%)";
  const label = currentStatus ? (STATUS_LABELS[currentStatus] ?? currentStatus) : "Set status";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-all hover:opacity-80"
          style={{
            backgroundColor: currentStatus ? `${color}25` : "hsl(220 8% 20%)",
            color: currentStatus ? color : "hsl(220 8% 65%)",
            border: `1px solid ${currentStatus ? `${color}55` : "hsl(220 8% 30%)"}`,
          }}
          onClick={e => e.stopPropagation()}
          data-testid={`button-status-chip-${item.id}`}
        >
          {currentStatus && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="truncate max-w-[72px]">{label}</span>
          <ChevronDown size={9} className="shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40" onClick={e => e.stopPropagation()}>
        {statuses.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={() => onStatusChange(item.id, s)}
            className="flex items-center gap-2 text-xs"
            data-testid={`status-option-${s}`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[s] ?? "hsl(220 8% 55%)" }}
            />
            {STATUS_LABELS[s] ?? s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Time Bar ─────────────────────────────────────────────────────────────────

function CollectionTimeBar({ items }: { items: ItemWithStatus[] }) {
  const stats = calcCollectionTimeStats(items);
  if (!stats.hasEstimate || items.length === 0) return null;

  const segments = [
    { frac: stats.completedFrac,  color: "hsl(160 65% 45%)",  label: "Completed" },
    { frac: stats.inProgressFrac, color: "hsl(255 70% 65%)",  label: "In progress" },
    { frac: stats.notStartedFrac, color: "hsl(220 8% 30%)",   label: "Not started" },
  ].filter(s => s.frac > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock size={13} />
          <span className="text-xs font-medium">Estimated time</span>
        </div>
        <span className="text-sm font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {formatDuration(stats.totalMinutes)}
        </span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-secondary">
        {segments.map((s, i) => (
          <div
            key={i}
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${s.frac * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

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
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/collections");
      return res.json();
    },
    staleTime: 30_000,
  });
  const collection = (allCollections || []).find(c => c.id === id);

  const { data: items, isLoading } = useQuery<ItemWithStatus[]>({
    queryKey: ["/api/collections", id, "items"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/collections/${id}/items`);
        const data: ItemWithStatus[] = await res.json();
        data.forEach(i => localStore.addItemToCollection(id, i.id));
        return data;
      } catch {
        // Fallback: items without status
        return localStore.getCollectionItems(id) as ItemWithStatus[];
      }
    },
    enabled: !!id,
    staleTime: 30_000,
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

  const statusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: number; status: string }) => {
      await apiRequest("PATCH", `/api/collections/${id}/items/${itemId}/status`, { status });
      return { itemId, status };
    },
    onSuccess: ({ itemId, status }) => {
      qc.setQueryData<ItemWithStatus[]>(["/api/collections", id, "items"], (old = []) =>
        old.map(i => i.id === itemId ? { ...i, collectionStatus: status } : i)
      );
      toast({ title: STATUS_LABELS[status] ?? status, description: "Status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const handleStatusChange = (itemId: number, status: string) => {
    statusMutation.mutate({ itemId, status });
  };

  const itemList = items || [];

  // Back destination: go directly to the collections tab of the owner (preserves nav state)
  const backPath = collection?.owner
    ? `/${collection.owner}/collections`
    : "/library";

  return (
    <div className="animate-page-in space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => setLocation(backPath)}
          data-testid="button-back-collections"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          {collection?.owner === "jack" ? "Jack's Collections" : collection?.owner === "sally" ? "Sally's Collections" : collection?.owner === "together" ? "Together's Watchlists" : "Collections"}
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
            {collection?.isDefault && collection.mediaGroup && (
              <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium capitalize">
                {collection.mediaGroup}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-1">
            {itemList.length} item{itemList.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Time bar */}
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
          <p className="text-xs mt-1 max-w-xs">
            {collection?.isDefault
              ? "Go to your profile or Together area and add items from the library mirror."
              : "Open an item from the library and add it to this collection."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {itemList.map((item, i) => (
            <div key={item.id} className="flex flex-col gap-1">
              <ItemCard
                item={item}
                index={i}
                collectionId={id}
                collectionStatus={item.collectionStatus}
                onRemoveFromCollection={(itemId) => removeMutation.mutate(itemId)}
                onStatusChange={handleStatusChange}
              />
              {/* Status chip below card */}
              <StatusChip
                item={item}
                collectionId={id}
                onStatusChange={handleStatusChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
