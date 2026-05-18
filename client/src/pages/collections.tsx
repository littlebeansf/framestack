import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import type { Collection } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderOpen, Plus, MoreHorizontal, Trash2, Edit3, ChevronRight } from "lucide-react";

function SkeletonCollection() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="h-4 skeleton rounded w-1/2" />
      <div className="h-3 skeleton rounded w-3/4" />
      <div className="h-3 skeleton rounded w-1/4" />
    </div>
  );
}

function CreateEditDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: Collection;
}) {
  const [form, setForm] = useState({ name: existing?.name ?? "", description: existing?.description ?? "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        if (existing) {
          const res = await apiRequest("PATCH", `/api/collections/${existing.id}`, form);
          return await res.json();
        }
        const res = await apiRequest("POST", "/api/collections", form);
        return await res.json();
      } catch {
        // backend offline — use local store
        if (existing) {
          return localStore.updateCollection(existing.id, form) ?? { ...existing, ...form };
        }
        return localStore.addCollection({ ...form, userId: 1, description: form.description || null });
      }
    },
    onSuccess: (result: any) => {
      if (existing) {
        qc.setQueryData<any[]>(["/api/collections"], (old = []) =>
          old.map(c => c.id === existing.id ? { ...c, ...result } : c)
        );
      } else {
        qc.setQueryData<any[]>(["/api/collections"], (old = []) => [...old, result]);
      }
      toast({ title: existing ? "Collection updated" : "Collection created" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Reset form when opening
  if (open && form.name === "" && existing?.name) {
    setForm({ name: existing.name, description: existing.description ?? "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit collection" : "New collection"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              data-testid="input-collection-name"
              placeholder="e.g. Summer watchlist"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              data-testid="textarea-collection-description"
              placeholder="What's this collection about?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim()}
            data-testid="button-save-collection"
          >
            {mutation.isPending ? "Saving…" : existing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiRequest("DELETE", `/api/collections/${id}`);
      } catch {
        localStore.deleteCollection(id);
      }
      return id;
    },
    onSuccess: (id: number) => {
      qc.setQueryData<any[]>(["/api/collections"], (old = []) => old.filter(c => c.id !== id));
      toast({ title: "Collection deleted" });
    },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <FolderOpen size={20} className="text-primary" />
            Collections
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize your media into themed lists</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          data-testid="button-new-collection"
          className="gap-1.5"
        >
          <Plus size={15} />
          New collection
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCollection key={i} />)}
        </div>
      ) : (collections || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <FolderOpen size={40} className="mb-4 opacity-20" />
          <p className="font-medium text-foreground text-sm">No collections yet</p>
          <p className="text-xs mt-1 max-w-xs">Create a collection to group related media — like "Recs from friends" or "Summer watchlist".</p>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="mt-4 gap-1.5" variant="outline">
            <Plus size={14} />
            Create your first collection
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(collections || []).map(col => (
            <div
              key={col.id}
              data-testid={`card-collection-${col.id}`}
              className="group relative rounded-lg border border-border bg-card p-4 hover:border-border/60 hover:shadow-md hover:shadow-black/20 transition-all cursor-pointer"
              onClick={() => setLocation(`/collections/${col.id}`)}
            >
              {/* Cover swatch using first item cover if available */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderOpen size={14} className="text-primary shrink-0" />
                    <h3 className="font-semibold text-sm text-foreground truncate">{col.name}</h3>
                  </div>
                  {col.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{col.description}</p>
                  )}
                </div>

                <div
                  className="shrink-0 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        data-testid={`button-col-menu-${col.id}`}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Collection options"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => setEditTarget(col)}>
                        <Edit3 size={13} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate(col.id)}
                      >
                        <Trash2 size={13} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ChevronRight size={14} className="text-muted-foreground/50" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateEditDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editTarget && (
        <CreateEditDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          existing={editTarget}
        />
      )}
    </div>
  );
}
