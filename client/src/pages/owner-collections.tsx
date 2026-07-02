import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import type { Collection, Item } from "@shared/schema";
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
import { Plus, MoreHorizontal, Trash2, Edit3, ChevronRight, Layers, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const OWNER_META: Record<string, { label: string; emoji: string; accent: string; emptyMsg: string }> = {
  jack: {
    label: "Jack's Collections",
    emoji: "🐻",
    accent: "hsl(220 80% 60%)",
    emptyMsg: "No collections yet. Make one before you forget what you wanted to watch.",
  },
  sally: {
    label: "Sally's Collections",
    emoji: "🌸",
    accent: "hsl(330 75% 65%)",
    emptyMsg: "No collections yet. Time to organise your fictional universe.",
  },
  together: {
    label: "Together 🫶",
    emoji: "🫶",
    accent: "hsl(20 90% 60%)",
    emptyMsg: "Nothing shared yet. Start building your joint universe.",
  },
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
      const res = await apiRequest("POST", "/api/collections", { ...form, owner });
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

export default function OwnerCollectionsPage({ owner }: { owner: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
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

  const { data: allItems } = useQuery<Item[]>({ queryKey: ["/api/items"] });

  function getCovers(colId: number): string[] {
    const cached = qc.getQueryData<Item[]>(["/api/collections", colId, "items"]);
    return (cached || []).filter(i => !!i.coverUrl).map(i => i.coverUrl!).slice(0, 4);
  }
  function getCount(colId: number): number {
    const cached = qc.getQueryData<Item[]>(["/api/collections", colId, "items"]);
    return cached ? cached.length : 0;
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/collections/${id}`);
      return id;
    },
    onSuccess: (id: number) => {
      const current = qc.getQueryData<Collection[]>(["/api/collections", owner]) || [];
      qc.setQueryData(["/api/collections", owner], current.filter(c => c.id !== id));
      toast({ title: "Deleted" });
    },
  });

  return (
    <div className="max-w-3xl animate-page-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <h1 className="text-xl font-extrabold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {meta.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(collections || []).length} collection{(collections || []).length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
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

      {/* Empty */}
      {!isLoading && (collections || []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <div className="text-5xl mb-4 animate-wiggle">{meta.emoji}</div>
          <p className="font-semibold text-foreground text-sm mb-1.5">Nothing here yet</p>
          <p className="text-xs max-w-[220px] leading-relaxed mb-5">{meta.emptyMsg}</p>
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(collections || []).map((col, idx) => {
            const covers = getCovers(col.id);
            const count = getCount(col.id);
            return (
              <div
                key={col.id}
                data-testid={`card-collection-${col.id}`}
                className={cn(
                  "group relative rounded-2xl border border-border bg-card p-4",
                  "hover:shadow-xl transition-all duration-300 cursor-pointer",
                  "animate-card-in"
                )}
                style={{
                  animationDelay: `${idx * 60}ms`,
                  animationFillMode: "both",
                  // subtle accent glow on hover via CSS custom property workaround
                }}
                onClick={() => setLocation(`/collections/${col.id}`)}
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
                        <h3 className="font-bold text-sm text-foreground truncate mb-0.5">{col.name}</h3>
                        {col.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{col.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-2 flex items-center gap-1">
                          <Layers size={9} />
                          {count} item{count !== 1 ? "s" : ""}
                        </p>
                      </div>
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
                            <DropdownMenuItem onClick={() => setEditTarget(col)}>
                              <Edit3 size={12} className="mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(col.id)}
                            >
                              <Trash2 size={12} className="mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
