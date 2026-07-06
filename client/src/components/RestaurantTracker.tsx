/**
 * RestaurantTracker — Together's shared restaurant board.
 *
 * Two views: Map (Leaflet) and Card list.
 * Add by clicking the map or via the form. Edit/delete from card or map popup.
 * Status: want_to_go (🔖) | been (✅)
 * Filter pills: All / Want to go / Been
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Restaurant } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin, List, Star, Pencil, Trash2, X, Check, Plus,
  Map as MapIcon, ChevronDown,
} from "lucide-react";

// Leaflet CSS — injected once
let leafletCssInjected = false;
function ensureLeafletCss() {
  if (leafletCssInjected) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  leafletCssInjected = true;
}

const ACCENT = "hsl(20 90% 60%)";          // orange together accent
const BEEN_COLOR = "#4ade80";               // green
const WANT_COLOR = "#a78bfa";               // violet
const JACK_BLUE = "hsl(220 80% 60%)";
const SALLY_PINK = "hsl(330 75% 65%)";

// Default map center: Zürich
const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417];
const DEFAULT_ZOOM = 13;

type FilterStatus = "all" | "want_to_go" | "been";
type ViewMode = "map" | "list";

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 16,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  readonly?: boolean;
  size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(value === n ? null : n)}
          className={readonly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"}
          style={{ lineHeight: 1 }}
        >
          <Star
            size={size}
            fill={value && value >= n ? "#f59e0b" : "none"}
            stroke={value && value >= n ? "#f59e0b" : "#6b7280"}
          />
        </button>
      ))}
    </div>
  );
}

// ── Restaurant form (add + edit) ──────────────────────────────────────────────
interface FormState {
  name: string;
  address: string;
  cuisine: string;
  emoji: string;
  status: "want_to_go" | "been";
  rating: number | null;
  notes: string;
  addedBy: "jack" | "sally" | "";
  lat: number | null;
  lng: number | null;
}

const EMPTY_FORM: FormState = {
  name: "", address: "", cuisine: "", emoji: "", status: "want_to_go",
  rating: null, notes: "", addedBy: "", lat: null, lng: null,
};

function RestaurantForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: any) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div className="flex flex-col gap-3">
      {/* Name + emoji row */}
      <div className="flex gap-2">
        <Input
          data-testid="input-restaurant-emoji"
          placeholder="🍽️"
          value={f.emoji}
          onChange={e => set("emoji", e.target.value)}
          className="h-10 w-12 text-center text-lg px-1 flex-shrink-0"
          maxLength={2}
        />
        <Input
          data-testid="input-restaurant-name"
          placeholder="Restaurant name *"
          value={f.name}
          onChange={e => set("name", e.target.value)}
          className="h-10 text-sm flex-1"
          autoFocus
        />
      </div>

      {/* Address */}
      <Input
        data-testid="input-restaurant-address"
        placeholder="Address (optional)"
        value={f.address}
        onChange={e => set("address", e.target.value)}
        className="h-10 text-sm"
      />

      {/* Cuisine */}
      <Input
        data-testid="input-restaurant-cuisine"
        placeholder="Cuisine (e.g. Italian, Sushi, Thai)"
        value={f.cuisine}
        onChange={e => set("cuisine", e.target.value)}
        className="h-10 text-sm"
      />

      {/* Status */}
      <div className="flex gap-2">
        {(["want_to_go", "been"] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => set("status", s)}
            className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-all capitalize"
            style={
              f.status === s
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

      {/* Rating (only show if been) */}
      {f.status === "been" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rating</span>
          <StarRating value={f.rating} onChange={v => set("rating", v)} />
        </div>
      )}

      {/* Notes */}
      <textarea
        data-testid="input-restaurant-notes"
        placeholder="Notes (optional)"
        value={f.notes}
        onChange={e => set("notes", e.target.value)}
        className="w-full rounded-lg border border-border bg-background text-sm px-3 py-2 resize-none h-16
          placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Added by */}
      <div className="flex gap-2">
        {(["jack", "sally"] as const).map(who => (
          <button
            key={who}
            type="button"
            onClick={() => set("addedBy", f.addedBy === who ? "" : who)}
            className="px-3 h-8 rounded-lg text-xs font-semibold border transition-all capitalize"
            style={
              f.addedBy === who
                ? {
                    background: who === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
                    borderColor: who === "jack" ? JACK_BLUE : SALLY_PINK,
                    color: who === "jack" ? JACK_BLUE : SALLY_PINK,
                  }
                : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
            }
          >
            {who}
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">added by</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 mt-1">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="flex-1 h-9 text-sm"
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(f)}
          disabled={!f.name.trim() || isSaving}
          className="flex-1 h-9 text-sm font-semibold"
          style={{ background: ACCENT, color: "white" }}
        >
          {isSaving ? "Saving…" : <><Check size={14} className="mr-1" /> Save</>}
        </Button>
      </div>
    </div>
  );
}

// ── Restaurant card ───────────────────────────────────────────────────────────
function RestaurantCard({
  restaurant,
  onEdit,
  onDelete,
  onStatusToggle,
}: {
  restaurant: Restaurant;
  onEdit: () => void;
  onDelete: () => void;
  onStatusToggle: () => void;
}) {
  const been = restaurant.status === "been";
  return (
    <div
      data-testid={`card-restaurant-${restaurant.id}`}
      className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card"
    >
      <div className="flex items-start gap-2">
        {/* Emoji */}
        <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{restaurant.emoji ?? "🍽️"}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">{restaurant.name}</p>
            {/* Status badge */}
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={
                been
                  ? { background: `${BEEN_COLOR}22`, color: BEEN_COLOR }
                  : { background: `${WANT_COLOR}22`, color: WANT_COLOR }
              }
            >
              {been ? "✅ Been" : "🔖 Want to go"}
            </span>
          </div>
          {restaurant.cuisine && (
            <p className="text-[11px] text-muted-foreground">{restaurant.cuisine}</p>
          )}
          {restaurant.address && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
              <MapPin size={9} className="flex-shrink-0" />
              {restaurant.address}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            data-testid={`button-edit-restaurant-${restaurant.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
              hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            data-testid={`button-delete-restaurant-${restaurant.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
              hover:bg-destructive/15 hover:text-destructive transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Rating */}
      {been && restaurant.rating != null && (
        <StarRating value={restaurant.rating} readonly size={13} />
      )}

      {/* Notes */}
      {restaurant.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
          {restaurant.notes}
        </p>
      )}

      {/* Footer: addedBy + quick status toggle */}
      <div className="flex items-center gap-2 mt-1">
        {restaurant.addedBy && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{
              background: restaurant.addedBy === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
              color: restaurant.addedBy === "jack" ? JACK_BLUE : SALLY_PINK,
            }}
          >
            {restaurant.addedBy}
          </span>
        )}
        <button
          onClick={onStatusToggle}
          className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
          style={
            been
              ? { borderColor: WANT_COLOR, color: WANT_COLOR }
              : { borderColor: BEEN_COLOR, color: BEEN_COLOR }
          }
        >
          {been ? "Mark as want to go" : "Mark as been ✅"}
        </button>
      </div>
    </div>
  );
}

// ── Leaflet map panel ─────────────────────────────────────────────────────────
function LeafletMap({
  restaurants,
  filterStatus,
  onMapClick,
  pendingLatLng,
  editingPin,
}: {
  restaurants: Restaurant[];
  filterStatus: FilterStatus;
  onMapClick: (lat: number, lng: number) => void;
  pendingLatLng: { lat: number; lng: number } | null;
  editingPin: Restaurant | null;
}) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pendingMarkerRef = useRef<any>(null);

  // Lazy-load Leaflet
  useEffect(() => {
    ensureLeafletCss();

    let isMounted = true;
    import("leaflet").then(L => {
      if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: any) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      // Trigger marker re-render
      (mapInstanceRef as any)._ready = true;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when data/filter changes
  useEffect(() => {
    if (!mapInstanceRef.current) {
      const check = setInterval(() => {
        if (mapInstanceRef.current) { clearInterval(check); updateMarkers(); }
      }, 200);
      return () => clearInterval(check);
    }
    updateMarkers();
  }, [restaurants, filterStatus, editingPin]);

  // Update pending marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then(L => {
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
      if (pendingLatLng) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${ACCENT};border:3px solid white;box-shadow:0 2px 8px #0006;display:flex;align-items:center;justify-content:center;font-size:14px;">+</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        pendingMarkerRef.current = L.marker([pendingLatLng.lat, pendingLatLng.lng], { icon })
          .addTo(mapInstanceRef.current);
      }
    });
  }, [pendingLatLng]);

  function updateMarkers() {
    import("leaflet").then(L => {
      if (!mapInstanceRef.current) return;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const filtered = filterStatus === "all"
        ? restaurants
        : restaurants.filter(r => r.status === filterStatus);

      // If editing a specific pin, fit to it
      if (editingPin?.lat && editingPin?.lng) {
        mapInstanceRef.current.setView([editingPin.lat, editingPin.lng], 15, { animate: true });
      }

      filtered.forEach(r => {
        if (r.lat == null || r.lng == null) return;
        const been = r.status === "been";
        const color = been ? BEEN_COLOR : WANT_COLOR;
        const emoji = r.emoji ?? "🍽️";
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${color}22;border:2.5px solid ${color};
            box-shadow:0 2px 8px ${color}55;
            display:flex;align-items:center;justify-content:center;font-size:17px;
            cursor:pointer;
          ">${emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const popup = L.popup({ className: "framestack-popup" }).setContent(`
          <div style="font-family:system-ui;padding:2px 0;min-width:140px">
            <div style="font-weight:700;font-size:13px;margin-bottom:2px">${r.emoji ?? ""} ${r.name}</div>
            ${r.cuisine ? `<div style="font-size:11px;color:#888;margin-bottom:2px">${r.cuisine}</div>` : ""}
            ${r.address ? `<div style="font-size:11px;color:#888">📍 ${r.address}</div>` : ""}
            ${r.rating ? `<div style="margin-top:4px;font-size:12px">${"⭐".repeat(r.rating)}</div>` : ""}
            ${r.notes ? `<div style="font-size:11px;margin-top:4px;color:#aaa">${r.notes}</div>` : ""}
          </div>
        `);

        const marker = L.marker([r.lat, r.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(popup);

        markersRef.current.push(marker);
      });

      // Fit bounds if there are markers
      if (markersRef.current.length > 0 && !editingPin) {
        const group = L.featureGroup(markersRef.current);
        try {
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15 });
        } catch {}
      }
    });
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-border"
      style={{ height: "380px" }}
    />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function RestaurantTracker() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>("map");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  // Pending pin from map click (before form confirmed)
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const key = ["/api/restaurants"];

  const { data: all = [], isLoading } = useQuery<Restaurant[]>({
    queryKey: key,
    staleTime: 30_000,
    queryFn: async () => { const r = await apiRequest("GET", "/api/restaurants", undefined); return r.json(); },
  });

  const filtered = filterStatus === "all" ? all : all.filter(r => r.status === filterStatus);

  const beenCount = all.filter(r => r.status === "been").length;
  const wantCount = all.filter(r => r.status === "want_to_go").length;

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/restaurants", body),
    onSuccess: async (res) => {
      const created: Restaurant = await res.json();
      qc.setQueryData(key, (old: Restaurant[] = []) => [created, ...old]);
      toast({ title: "Restaurant added" });
      setShowAddForm(false);
      setPendingLatLng(null);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiRequest("PATCH", `/api/restaurants/${id}`, body),
    onSuccess: async (res) => {
      const updated: Restaurant = await res.json();
      qc.setQueryData(key, (old: Restaurant[] = []) => old.map(r => r.id === updated.id ? updated : r));
      toast({ title: "Updated" });
      setEditingRestaurant(null);
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
      name: f.name, address: f.address || null, lat: f.lat, lng: f.lng,
      status: f.status, cuisine: f.cuisine || null, emoji: f.emoji || null,
      rating: f.rating, notes: f.notes || null, addedBy: f.addedBy || null,
    };
    if (restaurantId) {
      updateMutation.mutate({ id: restaurantId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function handleStatusToggle(r: Restaurant) {
    const newStatus = r.status === "been" ? "want_to_go" : "been";
    updateMutation.mutate({ id: r.id, body: { status: newStatus } });
  }

  function handleMapClick(lat: number, lng: number) {
    // If currently adding, just update the pending pin
    setPendingLatLng({ lat, lng });
    setShowAddForm(true);
    setEditingRestaurant(null);
  }

  const addInitialForm: FormState = {
    ...EMPTY_FORM,
    lat: pendingLatLng?.lat ?? null,
    lng: pendingLatLng?.lng ?? null,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <span className="text-2xl">🍽️</span>
          <div>
            <h2 className="font-bold text-foreground text-base leading-tight">Restaurants</h2>
            <p className="text-[11px] text-muted-foreground">
              {beenCount} visited · {wantCount} to try
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border ml-auto">
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === "map" ? "text-white shadow-sm" : "text-muted-foreground"
            }`}
            style={view === "map" ? { background: ACCENT } : {}}
            data-testid="button-view-map"
          >
            <MapIcon size={12} /> Map
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === "list" ? "text-white shadow-sm" : "text-muted-foreground"
            }`}
            style={view === "list" ? { background: ACCENT } : {}}
            data-testid="button-view-list"
          >
            <List size={12} /> List
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "all", label: `All (${all.length})` },
          { id: "want_to_go", label: `🔖 Want to go (${wantCount})` },
          { id: "been", label: `✅ Been (${beenCount})` },
        ] as { id: FilterStatus; label: string }[]).map(p => (
          <button
            key={p.id}
            onClick={() => setFilterStatus(p.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={
              filterStatus === p.id
                ? { background: `${ACCENT}22`, borderColor: ACCENT, color: ACCENT }
                : { borderColor: "transparent", background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
            }
            data-testid={`button-filter-${p.id}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Map view */}
      {view === "map" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin size={11} style={{ color: ACCENT }} />
            Tap anywhere on the map to add a new restaurant at that location.
          </p>
          <LeafletMap
            restaurants={all}
            filterStatus={filterStatus}
            onMapClick={handleMapClick}
            pendingLatLng={showAddForm && !editingRestaurant ? pendingLatLng : null}
            editingPin={editingRestaurant}
          />
        </div>
      )}

      {/* Add form (shown below map or at top of list) */}
      {showAddForm && !editingRestaurant && (
        <div className="p-4 rounded-xl border border-border bg-secondary/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Add restaurant</p>
            {pendingLatLng && (
              <span className="text-[10px] text-muted-foreground font-mono">
                📍 {pendingLatLng.lat.toFixed(4)}, {pendingLatLng.lng.toFixed(4)}
              </span>
            )}
          </div>
          <RestaurantForm
            initial={addInitialForm}
            onSave={f => handleSave(f)}
            onCancel={() => { setShowAddForm(false); setPendingLatLng(null); }}
            isSaving={createMutation.isPending}
          />
        </div>
      )}

      {/* Add button (when form not open) */}
      {!showAddForm && (
        <Button
          data-testid="button-add-restaurant"
          onClick={() => { setShowAddForm(true); setEditingRestaurant(null); }}
          className="w-full h-10 text-sm font-semibold rounded-xl flex items-center gap-2"
          style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <Plus size={15} />
          Add restaurant
        </Button>
      )}

      {/* Edit form */}
      {editingRestaurant && (
        <div className="p-4 rounded-xl border border-border bg-secondary/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Edit restaurant</p>
            <button onClick={() => setEditingRestaurant(null)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>
          <RestaurantForm
            initial={{
              name: editingRestaurant.name,
              address: editingRestaurant.address ?? "",
              cuisine: editingRestaurant.cuisine ?? "",
              emoji: editingRestaurant.emoji ?? "",
              status: editingRestaurant.status as "want_to_go" | "been",
              rating: editingRestaurant.rating ?? null,
              notes: editingRestaurant.notes ?? "",
              addedBy: (editingRestaurant.addedBy as "jack" | "sally" | "") ?? "",
              lat: editingRestaurant.lat ?? null,
              lng: editingRestaurant.lng ?? null,
            }}
            onSave={f => handleSave(f, editingRestaurant.id)}
            onCancel={() => setEditingRestaurant(null)}
            isSaving={updateMutation.isPending}
          />
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          {isLoading && [1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-secondary/40 animate-pulse" />
          ))}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center text-muted-foreground">
              <span className="text-4xl">🍽️</span>
              <p className="text-sm font-semibold text-foreground">No restaurants yet</p>
              <p className="text-xs max-w-[220px]">
                {filterStatus === "all"
                  ? "Tap the map or use the button above to add your first restaurant."
                  : `No restaurants marked as "${filterStatus.replace("_", " ")}".`}
              </p>
            </div>
          )}

          {!isLoading && filtered.map(r => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
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
