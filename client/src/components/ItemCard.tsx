import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";
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
  watching: "hsl(190 75% 55%)",
  reading: "hsl(255 75% 70%)",
  completed: "hsl(160 65% 50%)",
  on_hold: "hsl(30 85% 65%)",
  dropped: "hsl(0 65% 60%)",
  wishlist: "hsl(220 8% 55%)",
};

const STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  wishlist: "Wishlist",
};

export default function ItemCard({ item }: { item: Item }) {
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/items/${item.id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Removed from library", description: item.title });
    },
  });

  const Icon = TYPE_ICONS[item.mediaType] || Star;
  const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.wishlist;

  return (
    <>
      <div
        data-testid={`card-item-${item.id}`}
        className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-border/80 transition-all hover:shadow-lg hover:shadow-black/20 cursor-pointer"
        onClick={() => setEditOpen(true)}
      >
        {/* Cover */}
        <div className="relative aspect-[2/3] bg-secondary overflow-hidden">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.classList.add("no-cover");
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon size={32} className="text-muted-foreground/40" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Status indicator */}
          <div
            className="absolute top-2 left-2 w-2 h-2 rounded-full shadow-sm"
            style={{ backgroundColor: statusColor }}
            title={STATUS_LABELS[item.status]}
          />

          {/* Rating badge */}
          {item.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Star size={9} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-[10px] font-medium leading-none">{item.rating}</span>
            </div>
          )}

          {/* Menu button (visible on hover) */}
          <div
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid={`button-item-menu-${item.id}`}
                  className="w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
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
