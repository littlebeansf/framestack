import { useState } from "react";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "Our Space" },
  { id: "collections", label: "Watchlists" },
];

export default function TogetherPage() {
  const [tab, setTab] = useState("profile");
  const accent = "hsl(20 90% 60%)";

  return (
    <div className="animate-page-in">
      <div className="flex gap-1 p-1 rounded-2xl bg-secondary/60 border border-border mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200",
              tab === t.id ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            style={tab === t.id ? { background: accent, boxShadow: `0 2px 10px ${accent}55` } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" ? <OwnerProfilePage owner="together" /> : <OwnerCollectionsPage owner="together" />}
    </div>
  );
}
