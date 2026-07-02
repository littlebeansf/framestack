import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import { useToast } from "@/hooks/use-toast";
import type { Item, Collection } from "@shared/schema";
import { MEDIA_TYPES } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, X } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};

export default function ItemEditDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState({
    notes: item.notes ?? "",
    mediaType: item.mediaType,
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    setForm({
      notes: item.notes ?? "",
      mediaType: item.mediaType,
    });
  }, [item]);

  // Only non-default collections for manual adding
  const { data: allCollections } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });
  const customCollections = (allCollections || []).filter(c => !c.isDefault);

  // Track which collections this item belongs to
  const [itemColIds, setItemColIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    apiRequest("GET", `/api/items/${item.id}/collections`)
      .then(r => r.json())
      .then((cols: Collection[]) => setItemColIds(new Set(cols.filter(c => !c.isDefault).map(c => c.id))))
      .catch(() => {
        setItemColIds(new Set(localStore.getItemCollectionIds(item.id)));
      });
  }, [open, item.id]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        const res = await apiRequest("PATCH", `/api/items/${item.id}`, data);
        return await res.json();
      } catch {
        return localStore.updateItem(item.id, data) ?? { ...item, ...data };
      }
    },
    onSuccess: (updated: any) => {
      const next = localStore.getItems().map(i => i.id === item.id ? { ...i, ...updated } : i);
      localStore.replaceItems(next);
      qc.setQueryData(["/api/items"], next);
      toast({ title: "Updated", description: item.title });
      onOpenChange(false);
    },
  });

  const addToColMutation = useMutation({
    mutationFn: async (collectionId: number) => {
      try {
        await apiRequest("POST", `/api/collections/${collectionId}/items`, { itemId: item.id });
      } catch { /* offline — update state only */ }
      return collectionId;
    },
    onSuccess: (collectionId: number) => {
      setItemColIds(prev => new Set([...prev, collectionId]));
      localStore.addItemToCollection(collectionId, item.id);
      qc.setQueryData<any[]>(["/api/collections", collectionId, "items"], (old = []) => {
        if (old.some(i => i.id === item.id)) return old;
        return [...old, item];
      });
      toast({ title: "Added to collection" });
    },
  });

  const removeFromColMutation = useMutation({
    mutationFn: async ({ collectionId }: { collectionId: number }) => {
      try {
        await apiRequest("DELETE", `/api/collections/${collectionId}/items/${item.id}`);
      } catch { /* offline — update state only */ }
      return collectionId;
    },
    onSuccess: (collectionId: number) => {
      setItemColIds(prev => { const s = new Set(prev); s.delete(collectionId); return s; });
      localStore.removeItemFromCollection(collectionId, item.id);
      qc.setQueryData<any[]>(["/api/collections", collectionId, "items"], (old = []) =>
        old.filter(i => i.id !== item.id)
      );
      toast({ title: "Removed from collection" });
    },
  });

  const availableCollections = customCollections.filter(c => !itemColIds.has(c.id));
  const currentCollections = customCollections.filter(c => itemColIds.has(c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-snug pr-6">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cover + meta */}
          <div className="flex gap-4">
            <div className="w-20 h-28 rounded overflow-hidden bg-secondary shrink-0">
              {item.coverUrl && (
                <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 space-y-2.5">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.author && <span>by {item.author}</span>}
                {item.studio && <span>{item.studio}</span>}
                {item.episodes && <span>{item.episodes} eps</span>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Media type</Label>
                <Select value={form.mediaType} onValueChange={v => setForm(f => ({ ...f, mediaType: v }))}>
                  <SelectTrigger data-testid="select-type" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              data-testid="textarea-notes"
              placeholder="Your thoughts, where you left off, recommendations…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <Separator />

          {/* Custom Collections */}
          <div className="space-y-2">
            <Label className="text-xs">Custom Collections</Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Status-based collections are managed per-owner. Add to a custom collection below.
            </p>

            {currentCollections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {currentCollections.map(col => (
                  <Badge
                    key={col.id}
                    variant="secondary"
                    data-testid={`badge-collection-${col.id}`}
                    className="text-xs gap-1 pr-1"
                  >
                    {col.name}
                    <button
                      onClick={() => removeFromColMutation.mutate({ collectionId: col.id })}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      aria-label={`Remove from ${col.name}`}
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {availableCollections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableCollections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => addToColMutation.mutate(col.id)}
                    data-testid={`button-add-to-col-${col.id}`}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
                  >
                    <FolderPlus size={10} />
                    {col.name}
                  </button>
                ))}
              </div>
            )}

            {customCollections.length === 0 && (
              <p className="text-xs text-muted-foreground">No custom collections yet. Create one from a profile's Collections tab.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
            data-testid="button-save-item"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
