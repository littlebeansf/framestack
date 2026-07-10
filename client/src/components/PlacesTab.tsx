/**
 * PlacesTab — unified location catalog.
 *
 * Combines:
 *   • /api/places   → generic saved places (cafés, museums, nature, home, etc.)
 *   • /api/restaurants → eats (restaurants, bars, cafés with cuisine/rating/status)
 *
 * Both shown on a shared Leaflet map + list view with unified filtering.
 * Category "eats" renders the full restaurant form (cuisine tags, status, rating).
 * All other categories use the simple place form.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  MapPin, List, Star, Pencil, Trash2, X, Check, Plus,
  Map as MapIcon, Loader2, Lock, LockOpen,
} from "lucide-react";
import type { Restaurant } from "@shared/schema";

// ── Leaflet CSS injection ─────────────────────────────────────────────────────
let _leafletCssInjected = false;
function ensureLeafletCss() {
  if (_leafletCssInjected) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  _leafletCssInjected = true;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT      = "hsl(20 90% 60%)";
const BEEN_COLOR  = "#4ade80";
const WANT_COLOR  = "#a78bfa";
const JACK_BLUE   = "hsl(220 80% 60%)";
const SALLY_PINK  = "hsl(330 75% 65%)";
const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417]; // Zürich
const DEFAULT_ZOOM = 13;

// ── Place categories ──────────────────────────────────────────────────────────
const PLACE_CATEGORIES = [
  { id: "eats",    label: "Eats",         emoji: "🍽️",  color: "#f59e0b", mapColor: "#f59e0b" },
  { id: "cafe",    label: "Café",         emoji: "☕",  color: "#8b5cf6", mapColor: "#8b5cf6" },
  { id: "bar",     label: "Bar",          emoji: "🍸",  color: "#ec4899", mapColor: "#ec4899" },
  { id: "nature",  label: "Nature",       emoji: "🌿",  color: "#22c55e", mapColor: "#22c55e" },
  { id: "museum",  label: "Museum",       emoji: "🏛️", color: "#3b82f6", mapColor: "#3b82f6" },
  { id: "shop",    label: "Shop",         emoji: "🛍️", color: "#f97316", mapColor: "#f97316" },
  { id: "home",    label: "Home",         emoji: "🏠",  color: "#64748b", mapColor: "#64748b" },
  { id: "event",   label: "Event venue",  emoji: "🎪",  color: "#e11d48", mapColor: "#e11d48" },
  { id: "travel",  label: "Travel",       emoji: "✈️", color: "#0ea5e9", mapColor: "#0ea5e9" },
  { id: "other",   label: "Other",        emoji: "📍",  color: "#94a3b8", mapColor: "#94a3b8" },
] as const;

type PlaceCategoryId = typeof PLACE_CATEGORIES[number]["id"];

function catMeta(id: string) {
  return PLACE_CATEGORIES.find(c => c.id === id) ?? PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1];
}

// ── Cuisine tags (for Eats) ───────────────────────────────────────────────────
const CUISINE_TAGS = [
  { id: "italian",    label: "🍕 Italian" },
  { id: "asian",      label: "🥢 Asian" },
  { id: "japanese",   label: "🍣 Japanese" },
  { id: "chinese",    label: "🥟 Chinese" },
  { id: "thai",       label: "🌶️ Thai" },
  { id: "indian",     label: "🍛 Indian" },
  { id: "mexican",    label: "🌮 Mexican" },
  { id: "french",     label: "🥐 French" },
  { id: "american",   label: "🍔 American" },
  { id: "mediterranean", label: "🫒 Mediterranean" },
  { id: "middle_eastern", label: "🧆 Middle Eastern" },
  { id: "greek",      label: "🫙 Greek" },
  { id: "spanish",    label: "🥘 Spanish" },
  { id: "swiss",      label: "🧀 Swiss" },
  { id: "seafood",    label: "🦞 Seafood" },
  { id: "vegetarian", label: "🥗 Vegetarian" },
  { id: "vegan",      label: "🌱 Vegan" },
  { id: "steak",      label: "🥩 Steak" },
  { id: "pizza",      label: "🍕 Pizza" },
  { id: "sushi",      label: "🍱 Sushi" },
  { id: "ramen",      label: "🍜 Ramen" },
  { id: "burger",     label: "🍔 Burger" },
  { id: "cocktail_bar", label: "🍹 Bar" },
  { id: "cafe",       label: "☕ Café" },
  { id: "brunch",     label: "🥞 Brunch" },
  { id: "other",      label: "✨ Other" },
];

function getCuisineLabel(id: string) {
  return CUISINE_TAGS.find(t => t.id === id)?.label ?? id;
}

// ── Unified item type ─────────────────────────────────────────────────────────

type PlaceSource = "place" | "restaurant";

interface UnifiedPlace {
  _source: PlaceSource;
  id: number;
  name: string;
  emoji: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: string;           // PLACE_CATEGORIES id; restaurants always "eats"
  notes: string | null;
  added_by: string | null;
  created_at: number;
  // restaurant-only extras
  cuisine_tags?: string[];
  status?: "want_to_go" | "been";
  rating?: number | null;
}

function toUnified(item: any, source: PlaceSource): UnifiedPlace {
  if (source === "restaurant") {
    let tags: string[] = [];
    try { tags = JSON.parse(item.cuisine ?? "[]"); } catch { tags = item.cuisine ? [item.cuisine] : []; }
    return {
      _source: "restaurant",
      id: item.id,
      name: item.name,
      emoji: item.emoji ?? null,
      address: item.address ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      category: "eats",
      notes: item.notes ?? null,
      added_by: item.addedBy ?? item.added_by ?? null,
      created_at: item.createdAt ?? item.created_at ?? 0,
      cuisine_tags: tags,
      status: item.status ?? "want_to_go",
      rating: item.rating ?? null,
    };
  }
  return {
    _source: "place",
    id: item.id,
    name: item.name,
    emoji: item.emoji ?? null,
    address: item.address ?? null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    category: item.category ?? "other",
    notes: item.notes ?? null,
    added_by: item.added_by ?? null,
    created_at: item.created_at ?? 0,
  };
}

// ── Nominatim autocomplete ────────────────────────────────────────────────────
interface NominatimResult { place_id: number; display_name: string; lat: string; lon: string; }

async function searchNominatim(q: string): Promise<NominatimResult[]> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=0`,
      { headers: { "Accept-Language": "en" } }
    );
    return r.json();
  } catch { return []; }
}

function AddressField({
  address, setAddress, onGeocoded,
}: {
  address: string;
  setAddress: (v: string) => void;
  onGeocoded: (lat: number, lng: number, name: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleChange(v: string) {
    setAddress(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim() || v.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchNominatim(v.trim());
      setSuggestions(results); setOpen(results.length > 0); setSearching(false);
    }, 350);
  }

  function handleSelect(r: NominatimResult) {
    setAddress(r.display_name); setSuggestions([]); setOpen(false);
    onGeocoded(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder="Search address or place name…"
          value={address} onChange={e => handleChange(e.target.value)}
          className="h-10 text-sm pr-8" autoComplete="off"
        />
        {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button key={s.place_id} type="button"
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-secondary transition-colors border-b border-border/50 last:border-b-0 flex items-start gap-2"
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
            >
              <MapPin size={11} className="flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
              <span className="text-foreground leading-snug">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly, size = 16 }: {
  value: number | null; onChange?: (v: number | null) => void; readonly?: boolean; size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" disabled={readonly}
          onClick={() => onChange?.(value === n ? null : n)}
          className={readonly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"}
        >
          <Star size={size} fill={value && value >= n ? "#f59e0b" : "none"} stroke={value && value >= n ? "#f59e0b" : "#6b7280"} />
        </button>
      ))}
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────
interface PlaceFormState {
  name: string;
  emoji: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string;
  notes: string;
  // eats-only
  cuisine_tags: string[];
  status: "want_to_go" | "been";
  rating: number | null;
}

const EMPTY_FORM: PlaceFormState = {
  name: "", emoji: "", address: "", lat: null, lng: null,
  category: "eats", notes: "",
  cuisine_tags: [], status: "want_to_go", rating: null,
};

// ── Add/Edit form ─────────────────────────────────────────────────────────────
function PlaceForm({
  initial, onSave, onCancel, isSaving, onGeocoded,
}: {
  initial?: Partial<PlaceFormState>;
  onSave: (data: PlaceFormState) => void;
  onCancel: () => void;
  isSaving?: boolean;
  onGeocoded?: (lat: number, lng: number) => void;
}) {
  const [f, setF] = useState<PlaceFormState>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof PlaceFormState, v: any) => setF(p => ({ ...p, [k]: v }));
  const isEats = f.category === "eats";
  const meta = catMeta(f.category);

  return (
    <div className="rounded-2xl border border-border p-4 flex flex-col gap-3"
      style={{ background: "hsl(var(--surface))" }}>

      {/* Name + emoji row */}
      <div className="flex gap-2">
        <input
          value={f.emoji} onChange={e => set("emoji", e.target.value)}
          placeholder={meta.emoji} maxLength={2}
          className="w-12 h-10 rounded-xl bg-secondary border border-border text-center text-lg flex-shrink-0 outline-none focus:border-primary"
        />
        <input
          value={f.name} onChange={e => set("name", e.target.value)}
          placeholder="Place name" autoFocus
          className="flex-1 h-10 px-3 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary text-foreground"
        />
      </div>

      {/* Category picker */}
      <div className="flex flex-wrap gap-1.5">
        {PLACE_CATEGORIES.map(cat => (
          <button key={cat.id} type="button" onClick={() => set("category", cat.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
            style={f.category === cat.id
              ? { background: `${cat.color}22`, borderColor: `${cat.color}66`, color: cat.color }
              : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Address autocomplete */}
      <AddressField
        address={f.address} setAddress={v => set("address", v)}
        onGeocoded={(lat, lng, name) => { setF(p => ({ ...p, lat, lng, address: name })); onGeocoded?.(lat, lng); }}
      />
      {f.lat != null && (
        <p className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
          <MapPin size={9} /> Pinned ({f.lat.toFixed(4)}, {f.lng!.toFixed(4)})
        </p>
      )}

      {/* Eats-only: cuisine tags */}
      {isEats && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cuisine</p>
          <div className="flex flex-wrap gap-1.5">
            {CUISINE_TAGS.map(tag => {
              const sel = f.cuisine_tags.includes(tag.id);
              return (
                <button key={tag.id} type="button"
                  onClick={() => set("cuisine_tags", sel ? f.cuisine_tags.filter(t => t !== tag.id) : [...f.cuisine_tags, tag.id])}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                  style={sel
                    ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))", background: "transparent" }
                  }
                >{tag.label}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Eats-only: status */}
      {isEats && (
        <div className="flex gap-2">
          {(["want_to_go", "been"] as const).map(s => (
            <button key={s} type="button" onClick={() => set("status", s)}
              className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-all"
              style={f.status === s
                ? s === "been"
                  ? { background: `${BEEN_COLOR}22`, borderColor: BEEN_COLOR, color: BEEN_COLOR }
                  : { background: `${WANT_COLOR}22`, borderColor: WANT_COLOR, color: WANT_COLOR }
                : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
            >{s === "been" ? "✅ Been" : "🔖 Want to go"}</button>
          ))}
        </div>
      )}

      {/* Eats-only: rating */}
      {isEats && f.status === "been" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rating</span>
          <StarRating value={f.rating} onChange={v => set("rating", v)} />
        </div>
      )}

      {/* Notes */}
      <textarea
        value={f.notes} onChange={e => set("notes", e.target.value)}
        placeholder="Notes (optional)" rows={2}
        className="px-3 py-2 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary w-full resize-none text-foreground"
      />

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => { if (f.name.trim()) onSave(f); }}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

// ── Place card (list view) ────────────────────────────────────────────────────
function PlaceCard({ place, onEdit, onDelete, onStatusToggle }: {
  place: UnifiedPlace;
  onEdit: () => void;
  onDelete: () => void;
  onStatusToggle?: () => void;
}) {
  const meta = catMeta(place.category);
  const emoji = place.emoji || meta.emoji;
  const isEats = place.category === "eats";
  const been = place.status === "been";

  return (
    <div className="group rounded-2xl border border-border/50 hover:border-border transition-all p-3.5"
      style={{ background: "hsl(var(--surface))" }}>
      <div className="flex items-start gap-3">
        {/* Emoji + category dot */}
        <div className="relative flex-shrink-0">
          <span className="text-2xl leading-none">{emoji}</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card"
            style={{ background: meta.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">{place.name}</p>
            {isEats && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={been
                  ? { background: `${BEEN_COLOR}22`, color: BEEN_COLOR }
                  : { background: `${WANT_COLOR}22`, color: WANT_COLOR }
                }>
                {been ? "✅ Been" : "🔖 Want"}
              </span>
            )}
          </div>

          {place.address && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
              <MapPin size={9} className="flex-shrink-0" />{place.address}
            </p>
          )}

          {isEats && place.cuisine_tags && place.cuisine_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {place.cuisine_tags.map(t => (
                <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${ACCENT}15`, color: ACCENT }}>
                  {getCuisineLabel(t)}
                </span>
              ))}
            </div>
          )}

          {isEats && been && place.rating != null && (
            <div className="mt-1">
              <StarRating value={place.rating} readonly size={12} />
            </div>
          )}

          {place.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{place.notes}</p>
          )}
        </div>

        {/* Action buttons — collapse when not hovered */}
        <div className="flex items-center gap-1 overflow-hidden max-w-0 group-hover:max-w-[5rem] transition-all duration-200 flex-shrink-0">
          <button onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex-shrink-0">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors flex-shrink-0">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Eats status toggle */}
      {isEats && onStatusToggle && (
        <div className="mt-2 flex justify-end">
          <button onClick={onStatusToggle}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
            style={been
              ? { borderColor: WANT_COLOR, color: WANT_COLOR }
              : { borderColor: BEEN_COLOR, color: BEEN_COLOR }
            }>
            {been ? "↩ Mark want to go" : "Mark as been ✅"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Leaflet map ───────────────────────────────────────────────────────────────
function PlacesMap({
  items, filterCat, panTo,
}: {
  items: UnifiedPlace[];
  filterCat: string;
  panTo: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pendingMarkerRef = useRef<any>(null);

  useEffect(() => {
    ensureLeafletCss();
    let mounted = true;
    import("leaflet").then(L => {
      if (!mounted || !mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, {
        center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: true, attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: "abc", maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" style="color:#666">OpenStreetMap</a>',
      }).addTo(map);
      mapInstanceRef.current = map;
    });
    return () => {
      mounted = false;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // Re-render markers
  useEffect(() => {
    const run = () => {
      import("leaflet").then(L => {
        if (!mapInstanceRef.current) return;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const shown = filterCat === "all" ? items : items.filter(p => p.category === filterCat);

        shown.forEach(p => {
          if (p.lat == null || p.lng == null) return;
          const meta = catMeta(p.category);
          const color = p.category === "eats"
            ? (p.status === "been" ? BEEN_COLOR : WANT_COLOR)
            : meta.color;
          const emoji = p.emoji || meta.emoji;

          const tagStr = p.cuisine_tags?.map(getCuisineLabel).join(", ") ?? "";

          const icon = L.divIcon({
            className: "",
            html: `<div style="width:34px;height:34px;border-radius:50%;background:#fff;border:2.5px solid ${color};box-shadow:0 2px 10px ${color}88;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer">${emoji}</div>`,
            iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -22],
          });

          const popup = L.popup({ maxWidth: 230 }).setContent(`
            <div style="font-family:system-ui;padding:4px 0;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:3px">${emoji} ${p.name}</div>
              ${tagStr ? `<div style="font-size:10px;margin-bottom:3px;color:#888">${tagStr}</div>` : ""}
              <div style="font-size:10px;margin-bottom:3px;color:${color};font-weight:600">${meta.label}</div>
              ${p.address ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">📍 ${p.address}</div>` : ""}
              ${p.rating ? `<div style="font-size:11px">${"⭐".repeat(Math.round(p.rating))}</div>` : ""}
              ${p.notes ? `<div style="font-size:10px;margin-top:4px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:4px">${p.notes}</div>` : ""}
            </div>
          `);

          markersRef.current.push(
            L.marker([p.lat, p.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(popup)
          );
        });

        if (markersRef.current.length > 0) {
          try {
            mapInstanceRef.current.fitBounds(
              L.featureGroup(markersRef.current).getBounds().pad(0.25),
              { maxZoom: 15, animate: false }
            );
          } catch {}
        }
      });
    };
    if (mapInstanceRef.current) run();
    else { const t = setTimeout(run, 300); return () => clearTimeout(t); }
  }, [items, filterCat]);

  // Pan to newly geocoded address
  useEffect(() => {
    if (!panTo) return;
    import("leaflet").then(L => {
      if (!mapInstanceRef.current) return;
      pendingMarkerRef.current?.remove();
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${ACCENT};border:3px solid white;box-shadow:0 2px 8px #0009;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:white">+</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      pendingMarkerRef.current = L.marker([panTo.lat, panTo.lng], { icon }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView([panTo.lat, panTo.lng], 15, { animate: true });
    });
  }, [panTo]);

  return (
    <div ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-border"
      style={{ height: "340px" }} />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PlacesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [view, setView]         = useState<"map" | "list">("list");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showForm, setShowForm]   = useState(false);
  const [editingItem, setEditingItem] = useState<UnifiedPlace | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const placesKey      = ["/api/places"];
  const restaurantsKey = ["/api/restaurants"];

  const { data: rawPlaces = [], isLoading: placesLoading } = useQuery<any[]>({
    queryKey: placesKey,
    queryFn: () => apiRequest("GET", "/api/places").then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: rawRestaurants = [], isLoading: restsLoading } = useQuery<any[]>({
    queryKey: restaurantsKey,
    queryFn: () => apiRequest("GET", "/api/restaurants").then(r => r.json()),
    staleTime: 30_000,
  });

  const isLoading = placesLoading || restsLoading;

  const allItems: UnifiedPlace[] = useMemo(() => [
    ...rawRestaurants.map(r => toUnified(r, "restaurant")),
    ...rawPlaces.map(p => toUnified(p, "place")),
  ].sort((a, b) => b.created_at - a.created_at), [rawPlaces, rawRestaurants]);

  const usedCats = useMemo(() => {
    const seen = new Set<string>();
    allItems.forEach(p => seen.add(p.category));
    return PLACE_CATEGORIES.filter(c => seen.has(c.id)).map(c => c.id);
  }, [allItems]);

  const filtered = filterCat === "all" ? allItems : allItems.filter(p => p.category === filterCat);

  // ── Create ────────────────────────────────────────────────────────────────
  const createPlaceMutation = useMutation({
    mutationFn: (data: PlaceFormState) =>
      apiRequest("POST", "/api/places", {
        name: data.name, emoji: data.emoji || null, address: data.address || null,
        lat: data.lat, lng: data.lng, category: data.category,
        notes: data.notes || null, added_by: "together",
      }).then(r => r.json()),
    onSuccess: (place: any) => {
      qc.setQueryData(placesKey, (old: any[] = []) => [place, ...old]);
      setShowForm(false); setPendingLatLng(null);
      toast({ title: "Place added" });
    },
  });

  const createRestaurantMutation = useMutation({
    mutationFn: (data: PlaceFormState) =>
      apiRequest("POST", "/api/restaurants", {
        name: data.name, emoji: data.emoji || null, address: data.address || null,
        lat: data.lat, lng: data.lng,
        cuisine: JSON.stringify(data.cuisine_tags),
        status: data.status, rating: data.rating,
        notes: data.notes || null,
      }).then(r => r.json()),
    onSuccess: (restaurant: any) => {
      qc.setQueryData(restaurantsKey, (old: any[] = []) => [restaurant, ...old]);
      setShowForm(false); setPendingLatLng(null);
      toast({ title: "Eats spot added" });
    },
  });

  function handleCreate(data: PlaceFormState) {
    if (data.category === "eats") createRestaurantMutation.mutate(data);
    else createPlaceMutation.mutate(data);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  const updatePlaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PlaceFormState }) =>
      apiRequest("PATCH", `/api/places/${id}`, {
        name: data.name, emoji: data.emoji || null, address: data.address || null,
        lat: data.lat, lng: data.lng, category: data.category, notes: data.notes || null,
      }).then(r => r.json()),
    onSuccess: (place: any) => {
      qc.setQueryData(placesKey, (old: any[] = []) => old.map(p => p.id === place.id ? place : p));
      setEditingItem(null);
      toast({ title: "Place updated" });
    },
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PlaceFormState }) =>
      apiRequest("PATCH", `/api/restaurants/${id}`, {
        name: data.name, emoji: data.emoji || null, address: data.address || null,
        lat: data.lat, lng: data.lng,
        cuisine: JSON.stringify(data.cuisine_tags),
        status: data.status, rating: data.rating, notes: data.notes || null,
      }).then(r => r.json()),
    onSuccess: (restaurant: any) => {
      qc.setQueryData(restaurantsKey, (old: any[] = []) => old.map(r => r.id === restaurant.id ? restaurant : r));
      setEditingItem(null);
      toast({ title: "Eats spot updated" });
    },
  });

  function handleUpdate(item: UnifiedPlace, data: PlaceFormState) {
    if (item._source === "restaurant") updateRestaurantMutation.mutate({ id: item.id, data });
    else updatePlaceMutation.mutate({ id: item.id, data });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const deletePlaceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/places/${id}`),
    onSuccess: (_r, id) => {
      qc.setQueryData(placesKey, (old: any[] = []) => old.filter(p => p.id !== id));
      toast({ title: "Removed" });
    },
  });

  const deleteRestaurantMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/restaurants/${id}`),
    onSuccess: (_r, id) => {
      qc.setQueryData(restaurantsKey, (old: any[] = []) => old.filter(r => r.id !== id));
      toast({ title: "Removed" });
    },
  });

  function handleDelete(item: UnifiedPlace) {
    if (item._source === "restaurant") deleteRestaurantMutation.mutate(item.id);
    else deletePlaceMutation.mutate(item.id);
  }

  // ── Status toggle (eats only) ─────────────────────────────────────────────
  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/restaurants/${id}`, { status }).then(r => r.json()),
    onSuccess: (restaurant: any) => {
      qc.setQueryData(restaurantsKey, (old: any[] = []) => old.map(r => r.id === restaurant.id ? restaurant : r));
    },
  });

  function handleStatusToggle(item: UnifiedPlace) {
    if (item._source !== "restaurant") return;
    statusToggleMutation.mutate({
      id: item.id,
      status: item.status === "been" ? "want_to_go" : "been",
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const eatsTotal  = allItems.filter(p => p.category === "eats").length;
  const eatsBeen   = allItems.filter(p => p.category === "eats" && p.status === "been").length;
  const totalPinned = allItems.filter(p => p.lat != null).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Places</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allItems.length} saved · {totalPinned} on map
            {eatsTotal > 0 && ` · ${eatsBeen}/${eatsTotal} eats visited`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border">
            <button onClick={() => setView("list")}
              className="w-8 h-7 rounded-lg flex items-center justify-center transition-all"
              style={view === "list" ? { background: ACCENT, color: "white" } : { color: "hsl(var(--muted-foreground))" }}>
              <List size={14} />
            </button>
            <button onClick={() => setView("map")}
              className="w-8 h-7 rounded-lg flex items-center justify-center transition-all"
              style={view === "map" ? { background: ACCENT, color: "white" } : { color: "hsl(var(--muted-foreground))" }}>
              <MapIcon size={14} />
            </button>
          </div>
          {/* Add button */}
          <button
            data-testid="button-add-place"
            onClick={() => { setShowForm(true); setEditingItem(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: ACCENT }}
          >
            <Plus size={14} /> Add place
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <PlaceForm
          initial={{ category: filterCat !== "all" ? filterCat : "eats" }}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setPendingLatLng(null); }}
          isSaving={createPlaceMutation.isPending || createRestaurantMutation.isPending}
          onGeocoded={(lat, lng) => setPendingLatLng({ lat, lng })}
        />
      )}

      {/* Category filter */}
      {usedCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterCat("all")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
            style={filterCat === "all"
              ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT }
              : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }>
            All ({allItems.length})
          </button>
          {usedCats.map(catId => {
            const meta = catMeta(catId);
            const count = allItems.filter(p => p.category === catId).length;
            return (
              <button key={catId} onClick={() => setFilterCat(catId)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                style={filterCat === catId
                  ? { background: `${meta.color}22`, borderColor: `${meta.color}66`, color: meta.color }
                  : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
                }>
                {meta.emoji} {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Map view */}
      {view === "map" && (
        <PlacesMap items={allItems} filterCat={filterCat} panTo={pendingLatLng} />
      )}

      {/* List view */}
      {view === "list" && (
        <>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <MapPin size={36} className="text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold text-muted-foreground">
                {filterCat === "all" ? "No places saved yet" : `No ${catMeta(filterCat).label.toLowerCase()} places yet`}
              </p>
              {filterCat === "all" && (
                <p className="text-xs text-muted-foreground max-w-xs">
                  Save locations here — restaurants, cafés, nature spots, event venues and more — and link them to calendar events.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(place =>
                editingItem?.id === place.id && editingItem._source === place._source ? (
                  <PlaceForm
                    key={`${place._source}-${place.id}`}
                    initial={{
                      name: place.name, emoji: place.emoji ?? "",
                      address: place.address ?? "", lat: place.lat, lng: place.lng,
                      category: place.category, notes: place.notes ?? "",
                      cuisine_tags: place.cuisine_tags ?? [],
                      status: place.status ?? "want_to_go",
                      rating: place.rating ?? null,
                    }}
                    onSave={data => handleUpdate(place, data)}
                    onCancel={() => setEditingItem(null)}
                    isSaving={updatePlaceMutation.isPending || updateRestaurantMutation.isPending}
                  />
                ) : (
                  <PlaceCard
                    key={`${place._source}-${place.id}`}
                    place={place}
                    onEdit={() => setEditingItem(place)}
                    onDelete={() => handleDelete(place)}
                    onStatusToggle={place._source === "restaurant" ? () => handleStatusToggle(place) : undefined}
                  />
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
