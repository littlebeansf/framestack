import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import OwnerProfilePage from "./owner-profile";
import OwnerCollectionsPage from "./owner-collections";
import OwnerIntro from "@/components/OwnerIntro";
import LinkList from "@/components/LinkList";
import GroceryTab from "@/components/GroceryTab";
import TodoTab from "@/components/TodoTab";
import CalendarTab from "@/components/CalendarTab";
import PlacesTab from "@/components/PlacesTab";
import { navHistory } from "@/lib/navHistory";
import { cn } from "@/lib/utils";

// ── Tab structure ─────────────────────────────────────────────────────────────
//
//  Top level:   Our Space | Catalogs | Activities
//
//  Catalogs:    Watchlists (collections) | Link Lists | Eats | Places
//  Activities:  Calendar | Grocery
//
// URL scheme:
//   /together                    → Our Space / profile
//   /together/catalogs           → Catalogs → Watchlists (default)
//   /together/catalogs/links     → Catalogs → Link Lists
//   /together/catalogs/eats      → Catalogs → Eats
//   /together/catalogs/places    → Catalogs → Places
//   /together/activities         → Activities → Calendar (default)
//   /together/activities/grocery → Activities → Grocery

const ACCENT = "hsl(20 90% 60%)";

type TopTab = "space" | "catalogs" | "activities";
type CatalogSub = "watchlists" | "links" | "places";
type ActivitySub = "calendar" | "grocery" | "todos";

// Derive active tabs from `sub` string passed from App.tsx
function parseSub(sub?: string): { top: TopTab; cat: CatalogSub; act: ActivitySub } {
  if (!sub || sub === "profile") return { top: "space", cat: "watchlists", act: "calendar" };
  if (sub === "catalogs")         return { top: "catalogs", cat: "watchlists", act: "calendar" };
  if (sub === "links")            return { top: "catalogs", cat: "links", act: "calendar" };
  if (sub === "places")           return { top: "catalogs", cat: "places", act: "calendar" };
  if (sub === "activities")       return { top: "activities", cat: "watchlists", act: "calendar" };
  if (sub === "grocery")          return { top: "activities", cat: "watchlists", act: "grocery" };
  if (sub === "calendar")         return { top: "activities", cat: "watchlists", act: "calendar" };
  if (sub === "todos")            return { top: "activities", cat: "watchlists", act: "todos" };
  // Legacy: keep old /together/collections working
  if (sub === "collections")      return { top: "catalogs", cat: "watchlists", act: "calendar" };
  if (sub === "restaurants")      return { top: "catalogs", cat: "places", act: "calendar" };
  return { top: "space", cat: "watchlists", act: "calendar" };
}

function topPath(top: TopTab): string {
  if (top === "space")      return "/together";
  if (top === "catalogs")   return "/together/catalogs";
  if (top === "activities") return "/together/activities";
  return "/together";
}

function catPath(cat: CatalogSub): string {
  if (cat === "watchlists") return "/together/catalogs";
  if (cat === "links")      return "/together/links";
  if (cat === "eats")       return "/together/eats";
  if (cat === "places")     return "/together/places";
  return "/together/catalogs";
}

function actPath(act: ActivitySub): string {
  if (act === "calendar") return "/together/activities";
  if (act === "grocery")  return "/together/grocery";
  if (act === "todos")    return "/together/todos";
  return "/together/activities";
}

// ── Pill tab bar ──────────────────────────────────────────────────────────────

function PillBar<T extends string>({
  tabs,
  active,
  onSelect,
  size = "md",
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
  size?: "md" | "sm";
}) {
  return (
    <div className={cn(
      "flex gap-1 p-1 rounded-2xl bg-secondary/60 border border-border w-fit",
      size === "sm" && "rounded-xl"
    )}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            "font-semibold transition-all duration-200 btn-bounce",
            size === "md" ? "px-4 py-1.5 rounded-xl text-sm" : "px-3 py-1 rounded-lg text-xs",
            active === t.id
              ? "text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={active === t.id ? { background: ACCENT, boxShadow: `0 2px 10px ${ACCENT}55` } : {}}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TogetherPage({ sub }: { sub?: string }) {
  const [, setLocation] = useLocation();
  const { top, cat, act } = parseSub(sub);

  const [showIntro, setShowIntro] = useState(() => !navHistory.prev.startsWith("/together"));
  const onDone = useCallback(() => setShowIntro(false), []);

  const TOP_TABS: { id: TopTab; label: string }[] = [
    { id: "space",      label: "Our Space" },
    { id: "catalogs",   label: "Catalogs" },
    { id: "activities", label: "Activities" },
  ];

  const CATALOG_TABS: { id: CatalogSub; label: string }[] = [
    { id: "watchlists", label: "Watchlists" },
    { id: "links",      label: "Link Lists" },
    { id: "places",     label: "Places" },
  ];

  const ACTIVITY_TABS: { id: ActivitySub; label: string }[] = [
    { id: "calendar", label: "📅 Calendar" },
    { id: "grocery",  label: "🛒 Grocery" },
    { id: "todos",    label: "✅ Todos" },
  ];

  function handleTopSelect(id: TopTab) {
    setLocation(topPath(id));
  }

  function handleCatSelect(id: CatalogSub) {
    setLocation(catPath(id));
  }

  function handleActSelect(id: ActivitySub) {
    setLocation(actPath(id));
  }

  return (
    <div className="animate-page-in">
      {showIntro && <OwnerIntro owner="together" accent={ACCENT} onDone={onDone} />}

      {/* ── Top-level tabs ── */}
      <PillBar tabs={TOP_TABS} active={top} onSelect={handleTopSelect} />

      {/* ── Catalogs sub-bar ── */}
      {top === "catalogs" && (
        <div className="mt-3">
          <PillBar tabs={CATALOG_TABS} active={cat} onSelect={handleCatSelect} size="sm" />
        </div>
      )}

      {/* ── Activities sub-bar ── */}
      {top === "activities" && (
        <div className="mt-3">
          <PillBar tabs={ACTIVITY_TABS} active={act} onSelect={handleActSelect} size="sm" />
        </div>
      )}

      {/* ── Content ── */}
      <div className="mt-6">
        {top === "space"      && <OwnerProfilePage owner="together" />}
        {top === "catalogs"   && cat === "watchlists" && <OwnerCollectionsPage owner="together" />}
        {top === "catalogs"   && cat === "links"      && <LinkList />}
        {top === "catalogs"   && cat === "places"     && <PlacesTab />}
        {top === "activities" && act === "calendar"   && <CalendarTab />}
        {top === "activities" && act === "grocery"    && <GroceryTab />}
        {top === "activities" && act === "todos"     && <TodoTab currentUser={activeUser} />}
      </div>
    </div>
  );
}
