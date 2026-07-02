import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Item } from "@shared/schema";
import { MEDIA_TYPES } from "@shared/schema";
import ItemCard from "@/components/ItemCard";
import { cn } from "@/lib/utils";
import { Search, BookOpen, Library, SlidersHorizontal, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};

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

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const filtered = (items || []).filter(item => {
    if (typeFilter !== "all" && item.mediaType !== typeFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title);
    if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortBy === "year") return (b.year ?? "0").localeCompare(a.year ?? "0");
    if (sortBy === "recent") return b.id - a.id;
    return 0;
  });

  const filters = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Type</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn("w-full text-left text-sm px-2 py-1.5 rounded-md transition-all duration-150",
              typeFilter === "all" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            All types
          </button>
          {MEDIA_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn("w-full text-left text-sm px-2 py-1.5 rounded-md transition-all duration-150 flex items-center gap-2",
                typeFilter === t ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <span className={cn("inline-block w-2 h-2 rounded-sm shrink-0", `badge-${t}`)} />
              {TYPE_LABELS[t]}
              <span className="ml-auto text-xs opacity-50">{(items || []).filter(i => i.mediaType === t).length}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 h-full animate-page-in">
      {/* Desktop sidebar filters */}
      <aside className="hidden lg:block w-44 shrink-0">
        <div className="sticky top-0">
          <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Library size={15} />
            Shared Library
          </h2>
          {filters}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Filter by title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-library-search"
            />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Sort: Recent</SelectItem>
              <SelectItem value="title">Sort: Title</SelectItem>
              <SelectItem value="rating">Sort: Rating</SelectItem>
              <SelectItem value="year">Sort: Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filters sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden h-9 gap-2">
                <SlidersHorizontal size={14} />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{filters}</div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Count */}
        <p className="text-xs text-muted-foreground mb-4">
          {isLoading ? "Loading…" : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`}
          {(typeFilter !== "all" || search) && (items || []).length > 0
            ? ` of ${(items || []).length} total`
            : ""}
        </p>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground animate-page-in">
            {(items || []).length === 0 ? (
              <>
                <div className="relative mb-5">
                  <Sparkles size={44} className="opacity-10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={22} className="text-primary opacity-60" />
                  </div>
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">The library is empty</p>
                <p className="text-xs max-w-[240px] leading-relaxed">
                  Hit the search icon in the sidebar to find anime, manga, movies, series and books — then add them here.
                </p>
              </>
            ) : (
              <>
                <BookOpen size={40} className="mb-4 opacity-15" />
                <p className="font-medium text-foreground text-sm">No matches</p>
                <p className="text-xs mt-1">Try changing or clearing your filters.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
