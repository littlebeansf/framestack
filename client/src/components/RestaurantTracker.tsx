/**
 * RestaurantTracker — Together's shared restaurant board.
 *
 * Map: CartoDB Positron tiles (minimalist, light/clean).
 * Address: free-text → geocoded via Nominatim (OSM) → lat/lng stored.
 * Cuisine: predefined tag chips (multi-select).
 * Status: want_to_go | been
 * Views: Map | List
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Restaurant } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin, List, Star, Pencil, Trash2, X, Check, Plus,
  Map as MapIcon, Loader2,
} from "lucide-react";

// ── Leaflet CSS (injected once) ───────────────────────────────────────────────
let leafletCssInjected = false;
function ensureLeafletCss() {
  if (leafletCssInjected) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  leafletCssInjected = true;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT     = "hsl(20 90% 60%)";
const BEEN_COLOR = "#4ade80";
const WANT_COLOR = "#a78bfa";
const JACK_BLUE  = "hsl(220 80% 60%)";
const SALLY_PINK = "hsl(330 75% 65%)";

const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417]; // Zürich
const DEFAULT_ZOOM = 13;

// Predefined cuisine tags
const CUISINE_TAGS = [
  { id: "italian",   label: "🍕 Italian" },
  { id: "asian",     label: "🥢 Asian" },
  { id: "japanese",  label: "🍣 Japanese" },
  { id: "chinese",   label: "🥟 Chinese" },
  { id: "thai",      label: "🌶️ Thai" },
  { id: "indian",    label: "🍛 Indian" },
  { id: "mexican",   label: "🌮 Mexican" },
  { id: "french",    label: "🥐 French" },
  { id: "american",  label: "🍔 American" },
  { id: "mediterranean", label: "🫒 Mediterranean" },
  { id: "middle_eastern", label: "🧆 Middle Eastern" },
  { id: "greek",     label: "🫙 Greek" },
  { id: "spanish",   label: "🥘 Spanish" },
  { id: "swiss",     label: "🧀 Swiss" },
  { id: "seafood",   label: "🦞 Seafood" },
  { id: "vegetarian", label: "🥗 Vegetarian" },
  { id: "vegan",     label: "🌱 Vegan" },
  { id: "steak",     label: "🥩 Steak" },
  { id: "pizza",     label: "🍕 Pizza" },
  { id: "sushi",     label: "🍱 Sushi" },
  { id: "ramen",     label: "🍜 Ramen" },
  { id: "burger",    label: "🍔 Burger" },
  { id: "cocktail_bar", label: "🍹 Bar" },
  { id: "cafe",      label: "☕ Café" },
  { id: "brunch",    label: "🥞 Brunch" },
  { id: "other",     label: "✨ Other" },
];

function getCuisineLabel(id: string) {
  return CUISINE_TAGS.find(t => t.id === id)?.label ?? id;
}

type FilterStatus = "all" | "want_to_go" | "been";
type ViewMode = "map" | "list";

// ── Nominatim autocomplete types ────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=0`;
    const r = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false, size = 16 }: {
  value: number | null; onChange?: (v: number | null) => void; readonly?: boolean; size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={readonly}
          onClick={() => onChange?.(value === n ? null : n)}
          className={readonly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"}
          style={{ lineHeight: 1 }}
        >
          <Star size={size} fill={value && value >= n ? "#f59e0b" : "none"} stroke={value && value >= n ? "#f59e0b" : "#6b7280"} />
        </button>
      ))}
    </div>
  );
}

// ── Cuisine tag picker ────────────────────────────────────────────────────────
function CuisinePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {CUISINE_TAGS.map(tag => {
        const sel = value.includes(tag.id);
        return (
          <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
            style={sel
              ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
              : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))", background: "transparent" }
            }
          >
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Address autocomplete (Nominatim) ───────────────────────────────────────
function AddressField({ address, setAddress, onGeocoded }: {
  address: string;
  setAddress: (v: string) => void;
  onGeocoded: (lat: number, lng: number, displayName: string) => void;
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
      setSuggestions(results);
      setOpen(results.length > 0);
      setSearching(false);
    }, 350);
  }

  function handleSelect(result: NominatimResult) {
    setAddress(result.display_name);
    setSuggestions([]);
    setOpen(false);
    onGeocoded(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          data-testid="input-restaurant-address"
          placeholder="Search address or place name…"
          value={address}
          onChange={e => handleChange(e.target.value)}
          className="h-10 text-sm pr-8"
          autoComplete="off"
        />
        {searching && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.place_id}
              type="button"
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

// ── Restaurant form ───────────────────────────────────────────────────────────
interface FormState {
  name: string;
  address: string;
  tags: string[];        // cuisine tags (was "cuisine" string)
  emoji: string;
  status: "want_to_go" | "been";
  rating: number | null;
  notes: string;
  addedBy: "jack" | "sally" | "";
  lat: number | null;
  lng: number | null;
}

const EMPTY_FORM: FormState = {
  name: "", address: "", tags: [], emoji: "", status: "want_to_go",
  rating: null, notes: "", addedBy: "", lat: null, lng: null,
};

function RestaurantForm({ initial, onSave, onCancel, isSaving, onGeocoded: onParentGeocoded }: {
  initial: FormState; onSave: (f: FormState) => void; onCancel: () => void; isSaving: boolean;
  onGeocoded?: (lat: number, lng: number) => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: any) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div className="flex flex-col gap-3">
      {/* Name + emoji */}
      <div className="flex gap-2">
        <Input data-testid="input-restaurant-emoji" placeholder="🍽️" value={f.emoji}
          onChange={e => set("emoji", e.target.value)} className="h-10 w-12 text-center text-lg px-1 flex-shrink-0" maxLength={2} />
        <Input data-testid="input-restaurant-name" placeholder="Restaurant name *" value={f.name}
          onChange={e => set("name", e.target.value)} className="h-10 text-sm flex-1" autoFocus />
      </div>

      {/* Address autocomplete */}
      <AddressField
        address={f.address}
        setAddress={v => set("address", v)}
        onGeocoded={(lat, lng, displayName) => { setF(prev => ({ ...prev, lat, lng, address: displayName })); onParentGeocoded?.(lat, lng); }}
      />
      {f.lat != null && f.lng != null && (
        <p className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
          <MapPin size={9} /> Pinned ({f.lat.toFixed(4)}, {f.lng.toFixed(4)})
        </p>
      )}

      {/* Cuisine tags */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cuisine</p>
        <CuisinePicker value={f.tags} onChange={v => set("tags", v)} />
      </div>

      {/* Status */}
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
          >
            {s === "been" ? "✅ Been" : "🔖 Want to go"}
          </button>
        ))}
      </div>

      {/* Rating (only when been) */}
      {f.status === "been" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rating</span>
          <StarRating value={f.rating} onChange={v => set("rating", v)} />
        </div>
      )}

      {/* Notes */}
      <textarea data-testid="input-restaurant-notes" placeholder="Notes (optional)"
        value={f.notes} onChange={e => set("notes", e.target.value)}
        className="w-full rounded-lg border border-border bg-background text-sm px-3 py-2 resize-none h-16
          placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Added by */}
      <div className="flex gap-2 items-center">
        {(["jack", "sally"] as const).map(who => (
          <button key={who} type="button" onClick={() => set("addedBy", f.addedBy === who ? "" : who)}
            className="px-3 h-8 rounded-lg text-xs font-semibold border transition-all capitalize"
            style={f.addedBy === who
              ? { background: who === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
                  borderColor: who === "jack" ? JACK_BLUE : SALLY_PINK,
                  color: who === "jack" ? JACK_BLUE : SALLY_PINK }
              : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
            }
          >{who}</button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">added by</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 mt-1">
        <Button variant="ghost" onClick={onCancel} className="flex-1 h-9 text-sm" disabled={isSaving}>Cancel</Button>
        <Button onClick={() => onSave(f)} disabled={!f.name.trim() || isSaving}
          className="flex-1 h-9 text-sm font-semibold" style={{ background: ACCENT, color: "white" }}>
          {isSaving ? "Saving…" : <><Check size={14} className="mr-1" />Save</>}
        </Button>
      </div>
    </div>
  );
}

// ── Restaurant card ───────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, onEdit, onDelete, onStatusToggle }: {
  restaurant: Restaurant; onEdit: () => void; onDelete: () => void; onStatusToggle: () => void;
}) {
  const been = restaurant.status === "been";
  const tags: string[] = (() => { try { return JSON.parse(restaurant.cuisine ?? "[]"); } catch { return restaurant.cuisine ? [restaurant.cuisine] : []; } })();

  return (
    <div data-testid={`card-restaurant-${restaurant.id}`}
      className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{restaurant.emoji ?? "🍽️"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">{restaurant.name}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={been
                ? { background: `${BEEN_COLOR}22`, color: BEEN_COLOR }
                : { background: `${WANT_COLOR}22`, color: WANT_COLOR }
              }
            >{been ? "✅ Been" : "🔖 Want"}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map(t => (
                <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${ACCENT}15`, color: ACCENT }}>
                  {getCuisineLabel(t)}
                </span>
              ))}
            </div>
          )}
          {restaurant.address && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
              <MapPin size={9} className="flex-shrink-0" />{restaurant.address}
            </p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} data-testid={`button-edit-restaurant-${restaurant.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
              hover:bg-secondary hover:text-foreground transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} data-testid={`button-delete-restaurant-${restaurant.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
              hover:bg-destructive/15 hover:text-destructive transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {been && restaurant.rating != null && <StarRating value={restaurant.rating} readonly size={13} />}

      {restaurant.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">{restaurant.notes}</p>
      )}

      <div className="flex items-center gap-2 mt-1">
        {restaurant.addedBy && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{ background: restaurant.addedBy === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
              color: restaurant.addedBy === "jack" ? JACK_BLUE : SALLY_PINK }}>
            {restaurant.addedBy}
          </span>
        )}
        <button onClick={onStatusToggle} className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
          style={been ? { borderColor: WANT_COLOR, color: WANT_COLOR } : { borderColor: BEEN_COLOR, color: BEEN_COLOR }}>
          {been ? "↩ Want to go" : "Mark as been ✅"}
        </button>
      </div>
    </div>
  );
}

// ── Leaflet map (OpenStreetMap standard — reliable in sandbox) ───────────────
function LeafletMap({ restaurants, filterStatus, panTo }: {
  restaurants: Restaurant[];
  filterStatus: FilterStatus;
  panTo: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pendingMarkerRef = useRef<any>(null);
  const panToRef = useRef(panTo);
  panToRef.current = panTo;

  useEffect(() => {
    ensureLeafletCss();
    let mounted = true;

    import("leaflet").then(L => {
      if (!mounted || !mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM,
        zoomControl: true, attributionControl: true,
      });

      // OpenStreetMap standard tiles — always available, no CSP issues
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" style="color:#666">OpenStreetMap</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      mounted = false;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // Markers — re-render when restaurants or filter changes
  useEffect(() => {
    const run = () => {
      import("leaflet").then(L => {
        if (!mapInstanceRef.current) return;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const shown = filterStatus === "all" ? restaurants : restaurants.filter(r => r.status === filterStatus);

        shown.forEach(r => {
          if (r.lat == null || r.lng == null) return;
          const been = r.status === "been";
          const color = been ? BEEN_COLOR : WANT_COLOR;
          const emoji = r.emoji ?? "🍽️";

          const tags: string[] = (() => { try { return JSON.parse(r.cuisine ?? "[]"); } catch { return r.cuisine ? [r.cuisine] : []; } })();
          const tagStr = tags.map(getCuisineLabel).join(", ");

          const icon = L.divIcon({
            className: "",
            html: `<div style="width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid ${color};box-shadow:0 2px 10px ${color}66;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">${emoji}</div>`,
            iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
          });

          const popup = L.popup({ maxWidth: 220 }).setContent(`
            <div style="font-family:system-ui;padding:4px 0;min-width:160px;">
              <div style="font-weight:700;font-size:13px;margin-bottom:3px">${emoji} ${r.name}</div>
              ${tagStr ? `<div style="font-size:10px;margin-bottom:3px;color:${been ? "#16a34a" : "#7c3aed"}">${tagStr}</div>` : ""}
              ${r.address ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">📍 ${r.address}</div>` : ""}
              ${r.rating ? `<div style="font-size:11px">${"⭐".repeat(Math.round(r.rating))}</div>` : ""}
              ${r.notes ? `<div style="font-size:10px;margin-top:4px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:4px">${r.notes}</div>` : ""}
            </div>
          `);

          markersRef.current.push(
            L.marker([r.lat, r.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(popup)
          );
        });

        if (markersRef.current.length > 0) {
          try {
            mapInstanceRef.current.fitBounds(
              L.featureGroup(markersRef.current).getBounds().pad(0.25), { maxZoom: 15, animate: false }
            );
          } catch {}
        }
      });
    };

    if (mapInstanceRef.current) run();
    else { const t = setTimeout(run, 300); return () => clearTimeout(t); }
  }, [restaurants, filterStatus]);

  // Pan to location when address is selected from autocomplete
  useEffect(() => {
    if (!panTo) return;
    import("leaflet").then(L => {
      if (!mapInstanceRef.current) return;
      pendingMarkerRef.current?.remove();
      pendingMarkerRef.current = null;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${ACCENT};border:3px solid white;box-shadow:0 2px 8px #0009;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;">+</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      pendingMarkerRef.current = L.marker([panTo.lat, panTo.lng], { icon }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView([panTo.lat, panTo.lng], 15, { animate: true });
    });
  }, [panTo]);

  return (
    <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-border" style={{ height: "340px" }} />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function RestaurantTracker() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [view, setView]                   = useState<ViewMode>("list");
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [filterTag, setFilterTag]         = useState<string | null>(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const key = ["/api/restaurants"];

  const { data: all = [], isLoading } = useQuery<Restaurant[]>({
    queryKey: key, staleTime: 30_000,
    queryFn: async () => { const r = await apiRequest("GET", "/api/restaurants", undefined); return r.json(); },
  });

  const beenCount = all.filter(r => r.status === "been").length;
  const wantCount = all.filter(r => r.status === "want_to_go").length;

  // Collect all used tags from all restaurants
  const usedTags = useMemo(() => {
    const set = new Set<string>();
    all.forEach(r => { try { JSON.parse(r.cuisine ?? "[]").forEach((t: string) => set.add(t)); } catch {} });
    return [...set];
  }, [all]);

  const filtered = useMemo(() => {
    let list = filterStatus === "all" ? all : all.filter(r => r.status === filterStatus);
    if (filterTag) list = list.filter(r => { try { return JSON.parse(r.cuisine ?? "[]").includes(filterTag); } catch { return false; } });
    return list;
  }, [all, filterStatus, filterTag]);

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/restaurants", body),
    onSuccess: async (res) => {
      const created: Restaurant = await res.json();
      qc.setQueryData(key, (old: Restaurant[] = []) => [created, ...old]);
      toast({ title: "Restaurant added" });
      setShowAddForm(false); setPendingLatLng(null);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiRequest("PATCH", `/api/restaurants/${id}`, body),
    onSuccess: async (res) => {
      const updated: Restaurant = await res.json();
      qc.setQueryData(key, (old: Restaurant[] = []) => old.map(r => r.id === updated.id ? updated : r));
      toast({ title: "Updated" }); setEditingRestaurant(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/restaurants/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(key, (old: Restaurant[] = []) => old.filter(r => r.id !== id));
      toast({ title: "Removed" });
    },
  });

  function handleSave(f: FormState, restaurantId?: number) {
    const body = {
      name: f.name,
      address: f.address || null,
      lat: f.lat, lng: f.lng,
      status: f.status,
      cuisine: JSON.stringify(f.tags),   // stored as JSON array string in the cuisine column
      emoji: f.emoji || null,
      rating: f.rating,
      notes: f.notes || null,
      addedBy: f.addedBy || null,
    };
    if (restaurantId) updateMutation.mutate({ id: restaurantId, body });
    else createMutation.mutate(body);
  }

  function handleStatusToggle(r: Restaurant) {
    updateMutation.mutate({ id: r.id, body: { status: r.status === "been" ? "want_to_go" : "been" } });
  }

  // pendingLatLng is now driven by the address autocomplete (onGeocoded callback)
  // The map shows the pin via panTo={pendingLatLng}

  function formInitialFromRestaurant(r: Restaurant): FormState {
    return {
      name: r.name, address: r.address ?? "", emoji: r.emoji ?? "",
      status: r.status as "want_to_go" | "been",
      rating: r.rating ?? null, notes: r.notes ?? "",
      addedBy: (r.addedBy as "jack" | "sally" | "") ?? "",
      lat: r.lat ?? null, lng: r.lng ?? null,
      tags: (() => { try { return JSON.parse(r.cuisine ?? "[]"); } catch { return r.cuisine ? [r.cuisine] : []; } })(),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <span className="text-2xl">🍽️</span>
          <div>
            <h2 className="font-bold text-foreground text-base leading-tight">Restaurants</h2>
            <p className="text-[11px] text-muted-foreground">{beenCount} visited · {wantCount} to try</p>
          </div>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border ml-auto">
          {([["list", <List size={12} />, "List"], ["map", <MapIcon size={12} />, "Map"]] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v as ViewMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === v ? "text-white" : "text-muted-foreground"}`}
              style={view === v ? { background: ACCENT } : {}}
              data-testid={`button-view-${v}`}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap items-center">
        {([
          ["all", `All (${all.length})`],
          ["want_to_go", `🔖 Want (${wantCount})`],
          ["been", `✅ Been (${beenCount})`],
        ] as [FilterStatus, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilterStatus(id)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={filterStatus === id
              ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
              : { borderColor: "transparent", background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
            }
            data-testid={`button-filter-${id}`}
          >{label}</button>
        ))}

        {/* Tag filter — only show if there are used tags */}
        {usedTags.length > 0 && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={() => setFilterTag(null)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={filterTag === null
                ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
                : { borderColor: "transparent", background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
              }
            >All cuisines</button>
            {usedTags.map(t => (
              <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                style={filterTag === t
                  ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
                  : { borderColor: "transparent", background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
                }
              >{getCuisineLabel(t)}</button>
            ))}
          </>
        )}
      </div>

      {/* Map */}
      {view === "map" && (
        <div className="flex flex-col gap-2">
          <LeafletMap
            restaurants={all}
            filterStatus={filterStatus}
            panTo={pendingLatLng}
          />
        </div>
      )}

      {/* Add form */}
      {showAddForm && !editingRestaurant && (
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <p className="text-sm font-bold text-foreground mb-3">Add restaurant</p>
          <RestaurantForm
            initial={EMPTY_FORM}
            onSave={f => handleSave(f)}
            onCancel={() => { setShowAddForm(false); setPendingLatLng(null); }}
            isSaving={createMutation.isPending}
            onGeocoded={(lat, lng) => { setPendingLatLng({ lat, lng }); }}
          />
        </div>
      )}

      {/* Add button */}
      {!showAddForm && !editingRestaurant && (
        <Button data-testid="button-add-restaurant"
          onClick={() => { setShowAddForm(true); setEditingRestaurant(null); }}
          className="w-full h-10 text-sm font-semibold rounded-xl flex items-center gap-2"
          style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
          <Plus size={15} /> Add restaurant
        </Button>
      )}

      {/* Edit form */}
      {editingRestaurant && (
        <div className="p-4 rounded-xl border border-border bg-secondary/20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Edit restaurant</p>
            <button onClick={() => setEditingRestaurant(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <RestaurantForm
            initial={formInitialFromRestaurant(editingRestaurant)}
            onSave={f => handleSave(f, editingRestaurant.id)}
            onCancel={() => setEditingRestaurant(null)}
            isSaving={updateMutation.isPending}
            onGeocoded={(lat, lng) => { setPendingLatLng({ lat, lng }); }}
          />
        </div>
      )}

      {/* List */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          {isLoading && [1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-secondary/40 animate-pulse" />)}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center text-muted-foreground">
              <span className="text-4xl">🍽️</span>
              <p className="text-sm font-semibold text-foreground">No restaurants yet</p>
              <p className="text-xs max-w-[220px]">
                {filterStatus === "all" && !filterTag ? "Add your first restaurant above." : "No matches for this filter."}
              </p>
            </div>
          )}

          {!isLoading && filtered.map(r => (
            <RestaurantCard key={r.id} restaurant={r}
              onEdit={() => { setEditingRestaurant(r); setShowAddForm(false); }}
              onDelete={() => deleteMutation.mutate(r.id)}
              onStatusToggle={() => handleStatusToggle(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
