import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Loader2, BookOpen, Tv, Film, Star, Book, Check } from "lucide-react";
import { MEDIA_TYPES } from "@shared/schema";
import { cn } from "@/lib/utils";
import { searchAll, type SearchResult } from "@/lib/search";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";

const TYPE_ICONS: Record<string, any> = {
  anime: Star, manga: BookOpen, movie: Film, series: Tv, book: Book,
};
const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};

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
  // Track state per result: null = idle, "adding" = in flight, "added" = done
  const [itemStates, setItemStates] = useState<Record<string, "adding" | "added">>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setItemStates({});
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const type = filterType !== "all" ? filterType : undefined;
        const data = await searchAll(query, type);
        setResults(data);
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
    setItemStates(s => ({ ...s, [key]: "adding" }));
    const payload = {
      title: result.title,
      mediaType: result.mediaType,
      status: "wishlist" as const,
      coverUrl: result.coverUrl ?? null,
      year: result.year ?? null,
      externalId: result.externalId,
      externalSource: result.externalSource,
      genres: result.genres ?? null,
      author: result.author ?? null,
      studio: result.studio ?? null,
      episodes: result.episodes ?? null,
      userId: 1,
      rating: null,
      notes: null,
    };
    try {
      const res = await apiRequest("POST", "/api/items", payload);
      const newItem = await res.json();
      qc.setQueryData<any[]>(["/api/items"], (old = []) => [...old, newItem]);
    } catch {
      const localItem = localStore.addItem(payload);
      qc.setQueryData<any[]>(["/api/items"], (old = []) => [...old, localItem]);
    }
    setItemStates(s => ({ ...s, [key]: "added" }));
    toast({ title: "Added to library", description: result.title });
    // Don't close the dialog — user can keep adding
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
              <p className="text-xs mt-1">Anime · Manga · Movies · Series · Books</p>
            </div>
          )}

          {!loading && filteredResults.length > 0 && (
            <ul className="divide-y divide-border" role="list">
              {filteredResults.map((result) => {
                const key = result.externalId + result.externalSource;
                const Icon = TYPE_ICONS[result.mediaType] || Star;
                const state = itemStates[key];
                const isAdded = state === "added";
                const isAdding = state === "adding";
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

                    {/* Add / Added button */}
                    <Button
                      size="sm"
                      variant={isAdded ? "secondary" : "outline"}
                      onClick={() => !isAdded && addItem(result)}
                      disabled={isAdding || isAdded}
                      data-testid={`button-add-${key}`}
                      className={cn(
                        "shrink-0 h-8 px-3 text-xs",
                        isAdded && "text-green-500 border-green-500/30"
                      )}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isAdded ? (
                        <>
                          <Check size={12} className="mr-1" />
                          Added
                        </>
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
