import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import OwnerIntro from "@/components/OwnerIntro";
import LinkList from "@/components/LinkList";
import RestaurantTracker from "@/components/RestaurantTracker";
import { navHistory } from "@/lib/navHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile",     label: "Our Space",    path: "/together" },
  { id: "collections", label: "Watchlists",   path: "/together/collections" },
  { id: "links",       label: "Links",        path: "/together/links" },
  { id: "restaurants", label: "🍽️ Eats",      path: "/together/restaurants" },
];
const accent = "hsl(20 90% 60%)";

export default function TogetherPage({ sub }: { sub?: string }) {
  const [, setLocation] = useLocation();
  const tab = sub === "collections" ? "collections" : sub === "links" ? "links" : sub === "restaurants" ? "restaurants" : "profile";
  // Show intro only when arriving from a different owner section (or fresh load)
  const [showIntro, setShowIntro] = useState(() => !navHistory.prev.startsWith("/together"));
  const onDone = useCallback(() => setShowIntro(false), []);

  return (
    <div className="animate-page-in">
      {showIntro && <OwnerIntro owner="together" accent={accent} onDone={onDone} />}

      <div className="flex gap-1 p-1 rounded-2xl bg-secondary/60 border border-border mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setLocation(t.path)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 btn-bounce",
              tab === t.id ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            style={tab === t.id ? { background: accent, boxShadow: `0 2px 10px ${accent}55` } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile"     && <OwnerProfilePage owner="together" />}
      {tab === "collections" && <OwnerCollectionsPage owner="together" />}
      {tab === "links"       && <LinkList />}
      {tab === "restaurants" && <RestaurantTracker />}
    </div>
  );
}
