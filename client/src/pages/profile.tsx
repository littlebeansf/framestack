import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BarChart3 } from "lucide-react";
import type { Item } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};
const TYPE_COLORS: Record<string, string> = {
  anime: "hsl(255 70% 55%)",
  manga: "hsl(340 60% 55%)",
  movie: "hsl(30 70% 55%)",
  series: "hsl(190 60% 50%)",
  book: "hsl(160 50% 48%)",
};

export default function ProfilePage() {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    queryFn: () => apiRequest("GET", "/api/items").then(r => r.json()),
  });

  const total = (items || []).length;
  const completed = (items || []).filter(i => i.status === "completed").length;
  const rated = (items || []).filter(i => i.rating != null);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const byType = ["anime", "manga", "movie", "series", "book"].map(t => ({
    type: t,
    count: (items || []).filter(i => i.mediaType === t).length,
  })).filter(x => x.count > 0);

  return (
    <div className="max-w-xl space-y-8 animate-page-in">
      <div>
        <h1 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Stats
        </h1>
        <p className="text-sm text-muted-foreground">Your library at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: total },
          { label: "Completed", value: completed },
          { label: "Avg rating", value: avgRating ? `★ ${avgRating}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* By type breakdown */}
      {byType.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BarChart3 size={12} />
            Library breakdown
          </p>
          {byType.map(({ type, count }) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14">{TYPE_LABELS[type]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${total > 0 ? (count / total) * 100 : 0}%`,
                    backgroundColor: TYPE_COLORS[type],
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      {byType.length === 0 && total === 0 && (
        <p className="text-sm text-muted-foreground">Nothing in your library yet. Use the search to add items.</p>
      )}
    </div>
  );
}
