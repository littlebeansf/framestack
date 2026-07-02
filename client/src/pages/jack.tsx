import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import OwnerIntro from "@/components/OwnerIntro";
import { navHistory } from "@/lib/navHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "Profile", path: "/jack" },
  { id: "collections", label: "Collections", path: "/jack/collections" },
];
const accent = "hsl(220 80% 60%)";

export default function JackPage({ sub }: { sub?: string }) {
  const [, setLocation] = useLocation();
  const tab = sub === "collections" ? "collections" : "profile";
  // Show intro only when arriving from a different owner section (or fresh load)
  const [showIntro, setShowIntro] = useState(() => !navHistory.prev.startsWith("/jack"));
  const onDone = useCallback(() => setShowIntro(false), []);

  return (
    <div className="animate-page-in">
      {showIntro && <OwnerIntro owner="jack" accent={accent} onDone={onDone} />}

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

      {tab === "profile" ? <OwnerProfilePage owner="jack" /> : <OwnerCollectionsPage owner="jack" />}
    </div>
  );
}
