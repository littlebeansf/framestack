import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import SecretMessagesTab from "@/components/SecretMessages";
import QuotesTab from "@/components/QuotesTab";
import OwnerIntro from "@/components/OwnerIntro";
import { navHistory } from "@/lib/navHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile",     label: "Profile",     path: "/jack" },
  { id: "collections", label: "Collections", path: "/jack/collections" },
  { id: "quotes",      label: "✦ Quotes",    path: "/jack/quotes" },
  { id: "messages",    label: "💌 Letters",  path: "/jack/messages" },
];
const accent      = "hsl(220 80% 60%)";
const sallyAccent = "hsl(330 75% 65%)";

export default function JackPage({ sub }: { sub?: string }) {
  const [, setLocation] = useLocation();
  const tab =
    sub === "collections" ? "collections" :
    sub === "quotes"      ? "quotes"      :
    sub === "messages"    ? "messages"    : "profile";

  const [showIntro, setShowIntro] = useState(() => !navHistory.prev.startsWith("/jack"));
  const onDone = useCallback(() => setShowIntro(false), []);

  return (
    <div className="animate-page-in">
      {showIntro && <OwnerIntro owner="jack" accent={accent} onDone={onDone} />}

      <div className="flex gap-1 p-1 rounded-2xl bg-secondary/60 border border-border mb-6 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setLocation(t.path)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 btn-bounce",
              tab === t.id ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            style={tab === t.id ? { background: accent, boxShadow: `0 2px 10px ${accent}55` } : {}}
            data-testid={`tab-jack-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile"     && <OwnerProfilePage owner="jack" />}
      {tab === "collections" && <OwnerCollectionsPage owner="jack" />}
      {tab === "quotes"      && <QuotesTab owner="jack" accent={accent} />}
      {tab === "messages"    && (
        <SecretMessagesTab owner="jack" accentOwner={accent} accentOther={sallyAccent} />
      )}
    </div>
  );
}
