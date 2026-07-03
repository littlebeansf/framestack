import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import SecretMessagesTab from "@/components/SecretMessages";
import OwnerIntro from "@/components/OwnerIntro";
import { navHistory } from "@/lib/navHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile",     label: "Profile",     path: "/sally" },
  { id: "collections", label: "Collections", path: "/sally/collections" },
  { id: "messages",    label: "💌 Letters",  path: "/sally/messages" },
];
const accent = "hsl(330 75% 65%)";
const jackAccent = "hsl(220 80% 60%)";

export default function SallyPage({ sub }: { sub?: string }) {
  const [, setLocation] = useLocation();
  const tab = sub === "collections" ? "collections" : sub === "messages" ? "messages" : "profile";
  const [showIntro, setShowIntro] = useState(() => !navHistory.prev.startsWith("/sally"));
  const onDone = useCallback(() => setShowIntro(false), []);

  return (
    <div className="animate-page-in">
      {showIntro && <OwnerIntro owner="sally" accent={accent} onDone={onDone} />}

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

      {tab === "profile" && <OwnerProfilePage owner="sally" />}
      {tab === "collections" && <OwnerCollectionsPage owner="sally" />}
      {tab === "messages" && (
        <SecretMessagesTab
          owner="sally"
          accentOwner={accent}
          accentOther={jackAccent}
        />
      )}
    </div>
  );
}
