import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";
import { STATUSES } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Star, Trash2, Edit3, BookOpen, Film, Tv, Book } from "lucide-react";
import ItemEditDialog from "./ItemEditDialog";

const TYPE_ICONS: Record<string, any> = {
  anime: Star,
  manga: BookOpen,
  movie: Film,
  series: Tv,
  book: Book,
};

const STATUS_COLORS: Record<string, string> = {
  watching:  "hsl(190 75% 55%)",
  reading:   "hsl(255 75% 70%)",
  completed: "hsl(160 65% 50%)",
  on_hold:   "hsl(30 85% 65%)",
  dropped:   "hsl(0 65% 60%)",
  wishlist:  "hsl(220 8% 55%)",
};

// Left-border accent + cover overlay per status
const STATUS_BORDER: Record<string, string> = {
  completed:  "hsl(160 65% 50%)",
  watching:   "hsl(190 75% 55%)",
  reading:    "hsl(255 75% 70%)",
  on_hold:    "hsl(30 85% 65%)",
  dropped:    "hsl(0 65% 60%)",
  wishlist:   "transparent",
};

// Cover overlay tint for not-started / hold / dropped — dims the cover slightly
const STATUS_OVERLAY: Record<string, string | null> = {
  completed:  null,
  watching:   null,
  reading:    null,
  on_hold:    "rgba(30,30,60,0.35)",
  dropped:    "rgba(60,10,10,0.40)",
  wishlist:   "rgba(0,0,0,0.25)",
};

const STATUS_LABELS: Record<string, string> = {
  watching:  "Watching",
  reading:   "Reading",
  completed: "Completed",
  on_hold:   "On Hold",
  dropped:   "Dropped",
  wishlist:  "Wishlist",
};

// Cycle through statuses on quick-click
const STATUS_CYCLE = STATUSES; // watching → reading → completed → on_hold → dropped → wishlist

export default function ItemCard({ item, index = 0 }: { item: Item; index?: number }) {
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest("DELETE", `/api/items/${item.id}`);
      } catch { /* offline — handled in onSuccess */ }
    },
    onSuccess: () => {
      // Always source from localStore — RQ cache may be empty if user hasn't
      // visited the library page yet this session (e.g. navigated straight to collection detail)
      const updated = localStore.getItems().filter(i => i.id !== item.id);
      localStore.replaceItems(updated);
      qc.setQueryData(["/api/items"], updated);
      toast({ title: "Removed from library", description: item.title });
    },
  });

  // Quick-cycle status on status-dot click (no dialog needed)
  const cycleStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      try {
        const res = await apiRequest("PATCH", `/api/items/${item.id}`, { status: newStatus });
        return await res.json();
      } catch {
        return localStore.updateItem(item.id, { status: newStatus }) ?? { ...item, status: newStatus };
      }
    },
    onSuccess: (updated: any) => {
      // Source from localStore to avoid stale/empty RQ cache overwriting persisted data
      const next = localStore.getItems().map(i => i.id === item.id ? { ...i, ...updated } : i);
      localStore.replaceItems(next);
      qc.setQueryData(["/api/items"], next);
      toast({ title: STATUS_LABELS[updated.status], description: item.title });
    },
  });

  function handleStatusDotClick(e: React.MouseEvent) {
    e.stopPropagation();
    const currentIdx = STATUS_CYCLE.indexOf(item.status as any);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    cycleStatusMutation.mutate(nextStatus);
  }

  const Icon = TYPE_ICONS[item.mediaType] || Star;
  const statusColor  = STATUS_COLORS[item.status]  || STATUS_COLORS.wishlist;
  const statusBorder = STATUS_BORDER[item.status]  || "transparent";
  const statusOverlay = STATUS_OVERLAY[item.status] ?? null;

  return (
    <>
      <div
        data-testid={`card-item-${item.id}`}
        className="group relative rounded-lg overflow-hidden bg-card border border-border cursor-pointer
          transition-all duration-300
          hover:shadow-xl hover:shadow-black/30
          hover:-translate-y-0.5
          animate-card-in"
        style={{
          animationDelay: `${index * 40}ms`,
          animationFillMode: "both",
          borderLeftColor: statusBorder,
          borderLeftWidth: statusBorder !== "transparent" ? "3px" : "1px",
        }}
        onClick={() => setEditOpen(true)}
      >
        {/* Cover */}
        <div className="relative aspect-[2/3] bg-secondary overflow-hidden">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary">
              <Icon size={28} className="text-muted-foreground/30" />
            </div>
          )}

          {/* Status overlay tint (dims not-started / on-hold / dropped) */}
          {statusOverlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: statusOverlay }} />
          )}

          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Status indicator dot — click to cycle */}
          <button
            className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full shadow-md transition-transform duration-150 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-white/40"
            style={{ backgroundColor: statusColor }}
            title={`${STATUS_LABELS[item.status]} — click to change`}
            onClick={handleStatusDotClick}
            aria-label={`Status: ${STATUS_LABELS[item.status]}`}
            data-testid={`button-status-${item.id}`}
          />

          {/* Rating badge */}
          {item.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star size={9} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-[10px] font-semibold leading-none">{item.rating}</span>
            </div>
          )}

          {/* Hover: quick actions overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Status label pill */}
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${statusColor}33`,
                color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}
            >
              {STATUS_LABELS[item.status]}
            </span>

            {/* Menu button */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid={`button-item-menu-${item.id}`}
                    className="w-7 h-7 rounded-md bg-black/70 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/90 transition-colors"
                    aria-label="Item options"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Edit3 size={13} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => deleteMutation.mutate()}
                  >
                    <Trash2 size={13} className="mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-2.5 py-2">
          <p
            className="text-xs font-medium text-foreground leading-tight line-clamp-2"
            title={item.title}
          >
            {item.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn("text-[10px] px-1 py-0.5 rounded font-medium leading-none", `badge-${item.mediaType}`)}>
              {item.mediaType}
            </span>
            {item.year && (
              <span className="text-[10px] text-muted-foreground">{item.year}</span>
            )}
          </div>
        </div>
      </div>

      <ItemEditDialog
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
