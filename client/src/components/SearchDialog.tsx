import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Loader2, BookOpen, Tv, Film, Star, Book } from "lucide-react";
import { MEDIA_TYPES, STATUSES, type MediaType } from "@shared/schema";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, any> = {
  anime: Star,
  manga: BookOpen,
  movie: Film,
  series: Tv,
  book: Book,
};

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime",
  manga: "Manga",
  movie: "Movie",
  series: "Series",
  book: "Book",
};

const STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  wishlist: "Wishlist",
};

interface SearchResult {
  externalId: string;
  externalSource: string;
  title: string;
  coverUrl?: string;
  year?: string;
  mediaType: MediaType;
  genres?: string;
  author?: string;
  studio?: string;
  episodes?: number;
}

export default function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const typeParam = filterType !== "all" ? `&type=${filterType}` : "";
        const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}${typeParam}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query, filterType]);

  async function addItem(result: SearchResult) {
    const key = result.externalId + result.externalSource;
    setAdding(key);
    try {
      const res = await apiRequest("POST", "/api/items", {
        title: result.title,
        mediaType: result.mediaType,
        status: "wishlist",
        coverUrl: result.coverUrl,
        year: result.year,
        externalId: result.externalId,
        externalSource: result.externalSource,
        genres: result.genres,
        author: result.author,
        studio: result.studio,
        episodes: result.episodes,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add");
      }
      await qc.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Added to library", description: result.title });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(null);
    }
  }

  const filteredResults = filterType === "all"
    ? results
    : results.filter(r => r.mediaType === filterType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">Search & add to library</DialogTitle>
        </DialogHeader>

        {/* Search bar + type filter */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              data-testid="input-search"
              className="pl-9"
              placeholder="Search anime, manga, movies, series, books…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32 shrink-0" data-testid="select-search-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MEDIA_TYPES.map(t => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <Loader2 size={16} className="animate-spin" />
              Searching…
            </div>
          )}

          {!loading && query && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No results found for "{query}"</p>
              <p className="text-xs mt-1">Try a different search term or media type</p>
            </div>
          )}

          {!loading && !query && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search size={32} className="mb-3 opacity-30" />
              <p className="text-sm">Type to search across all media</p>
              <p className="text-xs mt-1">Anime, manga, movies, series, and books</p>
            </div>
          )}

          {!loading && filteredResults.length > 0 && (
            <ul className="divide-y divide-border" role="list">
              {filteredResults.map((result) => {
                const key = result.externalId + result.externalSource;
                const Icon = TYPE_ICONS[result.mediaType] || Star;
                return (
                  <li
                    key={key}
                    data-testid={`result-item-${key}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/40 transition-colors"
                  >
                    {/* Cover */}
                    <div className="w-10 h-14 rounded shrink-0 overflow-hidden bg-secondary flex items-center justify-center">
                      {result.coverUrl ? (
                        <img
                          src={result.coverUrl}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Icon size={16} className="text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", `badge-${result.mediaType}`)}>
                          {TYPE_LABELS[result.mediaType]}
                        </span>
                        {result.year && (
                          <span className="text-xs text-muted-foreground">{result.year}</span>
                        )}
                        {result.author && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{result.author}</span>
                        )}
                        {result.studio && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{result.studio}</span>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addItem(result)}
                      disabled={adding === key}
                      data-testid={`button-add-${key}`}
                      className="shrink-0 h-8 px-3 text-xs"
                    >
                      {adding === key ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <Plus size={12} className="mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
