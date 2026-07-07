import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Loader2, BookOpen, Tv, Film, Star, Book, Check, Library, Mic2 } from "lucide-react";
import type { Item } from "@shared/schema";
import { cn } from "@/lib/utils";
import { searchAll, type SearchResult } from "@/lib/search";
import { apiRequest } from "@/lib/queryClient";
import { localStore } from "@/lib/localStore";

const TYPE_ICONS: Record<string, any> = {
  anime: Star, manga: BookOpen, movie: Film, series: Tv, book: Book, podcast: Mic2,
};
const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book", podcast: "Podcast",
};

// Particle burst on "Add" button
function BurstParticles({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = ["✦", "★", "♥", "✿", "◆", "✸"];
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {particles.map((char, i) => {
        const angle = (360 / particles.length) * i;
        const rad = (angle * Math.PI) / 180;
        const tx = `translateX(${Math.cos(rad) * 28}px) translateY(${Math.sin(rad) * 28}px)`;
        return (
          <span
            key={i}
            className="absolute text-[10px] font-bold"
            style={{
              color: `hsl(${(i * 50) % 360} 80% 65%)`,
              opacity: 0,
              animation: `burst-out 0.5s ${i * 40}ms ease-out forwards`,
              ["--tx" as any]: tx,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export default function SearchDialog({
  open, onOpenChange,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("anime");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, "adding" | "added">>({});
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
    else { setQuery(""); setResults([]); setItemStates({}); setBurstKey(null); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchAll(query, filterType);
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [query, filterType]);

  function isInLibrary(result: SearchResult): boolean {
    const cached = qc.getQueryData<Item[]>(["/api/items"]) ?? [];
    if (cached.some(i => i.externalId === result.externalId && i.externalSource === result.externalSource)) return true;
    return localStore.hasExternalId(result.externalId, result.externalSource);
  }

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
      const next = [...localStore.getItems().filter(i => i.id !== newItem.id), newItem];
      localStore.replaceItems(next);
      qc.setQueryData(["/api/items"], next);
    } catch {
      const localItem = localStore.addItem(payload);
      qc.setQueryData(["/api/items"], localStore.getItems());
    }

    setItemStates(s => ({ ...s, [key]: "added" }));
    setBurstKey(key);
    setTimeout(() => setBurstKey(null), 600);
    toast({ title: `✨ ${result.title} added!` });
  }

  const filteredResults = results;

  return (
    <>
      {/* Inject burst keyframe once */}
      <style>{`
        @keyframes burst-out {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: var(--tx) scale(0); }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Search size={15} className="text-primary" />
              Search & add to library
            </DialogTitle>
          </DialogHeader>

          {/* Search controls */}
          <div className="px-5 py-3 border-b border-border shrink-0 flex gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 shrink-0 rounded-xl" data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anime">🎌 Anime</SelectItem>
                <SelectItem value="manga">📖 Manga</SelectItem>
                <SelectItem value="movie">🎬 Movie</SelectItem>
                <SelectItem value="series">📺 Series</SelectItem>
                <SelectItem value="book">📚 Book</SelectItem>
                <SelectItem value="podcast">🎧 Podcast</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                data-testid="input-search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${TYPE_LABELS[filterType] ?? "media"}…`}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Searching…</span>
              </div>
            )}

            {!loading && query && filteredResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Search size={32} className="mb-3 opacity-20" />
                <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs mt-1 opacity-60">Try a different term or category</p>
              </div>
            )}

            {!loading && !query && (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <span className="text-4xl mb-3">🔍</span>
                <p className="text-sm">Pick a category, then type to search</p>
              </div>
            )}

            {!loading && filteredResults.length > 0 && (
              <ul className="divide-y divide-border" role="list">
                {filteredResults.map((result) => {
                  const key = result.externalId + result.externalSource;
                  const Icon = TYPE_ICONS[result.mediaType] || Star;
                  const state = itemStates[key];
                  const alreadyInLib = isInLibrary(result);
                  const isAdded = state === "added" || alreadyInLib;
                  const isAdding = state === "adding";
                  const isBursting = burstKey === key;

                  return (
                    <li
                      key={key}
                      data-testid={`result-item-${key}`}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 transition-all duration-200",
                        isAdded ? "opacity-50" : "hover:bg-secondary/40",
                        isBursting && "animate-pop-in"
                      )}
                    >
                      {/* Cover */}
                      <div className="w-10 h-14 rounded-lg shrink-0 overflow-hidden bg-secondary flex items-center justify-center">
                        {result.coverUrl ? (
                          <img src={result.coverUrl} alt={result.title}
                            className="w-full h-full object-cover" loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <Icon size={16} className="text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{result.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-border bg-secondary/60 text-muted-foreground uppercase tracking-wide">
                            {TYPE_LABELS[result.mediaType]}
                          </span>
                          {result.year && <span className="text-xs text-muted-foreground">{result.year}</span>}
                          {result.author && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{result.author}</span>}
                          {result.studio && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{result.studio}</span>}
                          {alreadyInLib && (
                            <span className="text-[10px] text-primary/70 flex items-center gap-0.5">
                              <Library size={9} />
                              In library
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add button with burst */}
                      <div className="relative shrink-0">
                        <BurstParticles active={isBursting} />
                        <Button
                          size="sm"
                          variant={isAdded ? "secondary" : "default"}
                          onClick={() => !isAdded && addItem(result)}
                          disabled={isAdding || isAdded}
                          data-testid={`button-add-${key}`}
                          className={cn(
                            "h-8 px-3 text-xs rounded-xl transition-all duration-200",
                            isAdded && "text-green-400 border-green-500/30 bg-green-500/10",
                            isBursting && "scale-110"
                          )}
                        >
                          {isAdding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isAdded ? (
                            <><Check size={12} className="mr-1" />Added</>
                          ) : (
                            <><Plus size={12} className="mr-1" />Add</>
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
