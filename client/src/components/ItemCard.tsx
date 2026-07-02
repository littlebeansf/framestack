import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";
import { STATUS_LABELS, STATUS_COLORS, getMediaGroup } from "@shared/schema";
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

export default function ItemCard({
  item,
  index = 0,
  // Collection-context props (when shown inside a collection)
  collectionId,
  collectionStatus,
  onStatusChange,
  onRemoveFromCollection,
}: {
  item: Item;
  index?: number;
  collectionId?: number;
  collectionStatus?: string | null;
  onStatusChange?: (itemId: number, newStatus: string) => void;
  onRemoveFromCollection?: (itemId: number) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const inCollection = collectionId !== undefined;
  const statusColor = collectionStatus ? (STATUS_COLORS[collectionStatus] ?? "hsl(220 8% 55%)") : null;
  const statusLabel = collectionStatus ? (STATUS_LABELS[collectionStatus] ?? collectionStatus) : null;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest("DELETE", `/api/items/${item.id}`);
      } catch { /* offline — handled in onSuccess */ }
    },
    onSuccess: () => {
      const updated = localStore.getItems().filter(i => i.id !== item.id);
      localStore.replaceItems(updated);
      qc.setQueryData(["/api/items"], updated);
      toast({ title: "Removed from library", description: item.title });
    },
  });

  const Icon = TYPE_ICONS[item.mediaType] || Star;

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
          ...(statusColor ? {
            borderLeftColor: statusColor,
            borderLeftWidth: "3px",
          } : {}),
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

          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Rating badge */}
          {item.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star size={9} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-[10px] font-semibold leading-none">{item.rating}</span>
            </div>
          )}

          {/* Hover: quick actions overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Status pill (collection context only) */}
            {statusColor && statusLabel ? (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-[80px]"
                style={{
                  backgroundColor: `${statusColor}33`,
                  color: statusColor,
                  border: `1px solid ${statusColor}55`,
                }}
              >
                {statusLabel}
              </span>
            ) : <span />}

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
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Edit3 size={13} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {inCollection && onRemoveFromCollection && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRemoveFromCollection(item.id)}>
                        <Trash2 size={13} className="mr-2" />
                        Remove from collection
                      </DropdownMenuItem>
                    </>
                  )}
                  {!inCollection && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate()}
                      >
                        <Trash2 size={13} className="mr-2" />
                        Remove from library
                      </DropdownMenuItem>
                    </>
                  )}
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
