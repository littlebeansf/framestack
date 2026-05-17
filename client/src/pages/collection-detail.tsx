import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Collection, Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, Trash2 } from "lucide-react";
import ItemCard from "@/components/ItemCard";

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

export default function CollectionDetailPage() {
  const [, params] = useRoute("/collections/:id");
  const id = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: collection } = useQuery<Collection>({
    queryKey: ["/api/collections", id],
    queryFn: () => apiRequest("GET", `/api/collections`).then(r => r.json()).then((cols: Collection[]) => cols.find(c => c.id === id)),
    enabled: !!id,
  });

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/collections", id, "items"],
    queryFn: () => apiRequest("GET", `/api/collections/${id}/items`).then(r => r.json()),
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: number) =>
      apiRequest("DELETE", `/api/collections/${id}/items/${itemId}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/collections", id, "items"] });
      toast({ title: "Removed from collection" });
    },
  });

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
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
            {(items || []).length} item{(items || []).length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (items || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <FolderOpen size={40} className="mb-4 opacity-20" />
          <p className="font-medium text-foreground text-sm">This collection is empty</p>
          <p className="text-xs mt-1 max-w-xs">Open an item from your library and add it to this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {(items || []).map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
