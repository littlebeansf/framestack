import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, MapPin, X, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Place {
  id: number;
  name: string;
  emoji: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: string;
  notes: string | null;
  added_by: string;
  created_at: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = "hsl(20 90% 60%)";

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { id: "cafe",       label: "Café",       emoji: "☕" },
  { id: "bar",        label: "Bar",        emoji: "🍸" },
  { id: "nature",     label: "Nature",     emoji: "🌿" },
  { id: "museum",     label: "Museum",     emoji: "🏛️" },
  { id: "shop",       label: "Shop",       emoji: "🛍️" },
  { id: "home",       label: "Home",       emoji: "🏠" },
  { id: "event",      label: "Event venue",emoji: "🎪" },
  { id: "travel",     label: "Travel",     emoji: "✈️" },
  { id: "other",      label: "Other",      emoji: "📍" },
];

function categoryMeta(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ── Place form ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  address: string;
  category: string;
  notes: string;
  emoji: string;
}

const EMPTY_FORM: FormState = { name: "", address: "", category: "other", notes: "", emoji: "" };

function PlaceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormState>;
  onSave: (data: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div
      className="rounded-2xl border border-border p-4 flex flex-col gap-3"
      style={{ background: "hsl(var(--surface))" }}
    >
      {/* Name + emoji */}
      <div className="flex gap-2">
        <input
          value={form.emoji}
          onChange={e => set("emoji", e.target.value)}
          placeholder="📍"
          maxLength={2}
          className="w-12 h-10 rounded-xl bg-secondary border border-border text-center text-lg flex-shrink-0 outline-none focus:border-primary"
          style={{ color: "hsl(var(--foreground))" }}
        />
        <input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder="Place name"
          className="flex-1 h-10 px-3 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary"
          style={{ color: "hsl(var(--foreground))" }}
          autoFocus
        />
      </div>

      {/* Address */}
      <input
        value={form.address}
        onChange={e => set("address", e.target.value)}
        placeholder="Address (optional)"
        className="h-10 px-3 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary w-full"
        style={{ color: "hsl(var(--foreground))" }}
      />

      {/* Category */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => set("category", cat.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
            style={
              form.category === cat.id
                ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT }
                : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            <span>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <textarea
        value={form.notes}
        onChange={e => set("notes", e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="px-3 py-2 rounded-xl bg-secondary border border-border text-sm outline-none focus:border-primary w-full resize-none"
        style={{ color: "hsl(var(--foreground))" }}
      />

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => { if (form.name.trim()) onSave(form); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: ACCENT }}
        >
          <Check size={13} /> Save
        </button>
      </div>
    </div>
  );
}

// ── Place card ────────────────────────────────────────────────────────────────

function PlaceCard({
  place,
  onEdit,
  onDelete,
}: {
  place: Place;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = categoryMeta(place.category);
  const displayEmoji = place.emoji || meta.emoji;

  return (
    <div
      className="group flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-transparent hover:border-border transition-all duration-150"
      style={{ background: "hsl(var(--surface))" }}
    >
      {/* Emoji */}
      <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{displayEmoji}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{place.name}</p>
        {place.address && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{place.address}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ background: `${ACCENT}18`, color: ACCENT }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>
        {place.notes && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{place.notes}</p>
        )}
      </div>

      {/* Actions — collapse on non-hover, expand on hover */}
      <div className="flex items-center gap-1 overflow-hidden max-w-0 group-hover:max-w-[5rem] transition-all duration-200 flex-shrink-0">
        <button
          data-testid={`button-edit-place-${place.id}`}
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Edit place"
        >
          <Pencil size={13} />
        </button>
        <button
          data-testid={`button-delete-place-${place.id}`}
          onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors flex-shrink-0"
          aria-label="Delete place"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PlacesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const placesKey = ["/api/places"];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: places = [], isLoading } = useQuery<Place[]>({
    queryKey: placesKey,
    queryFn: () => apiRequest("GET", "/api/places").then(r => r.json()),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      apiRequest("POST", "/api/places", {
        name: data.name,
        emoji: data.emoji || null,
        address: data.address || null,
        category: data.category,
        notes: data.notes || null,
        added_by: "together",
      }).then(r => r.json()),
    onSuccess: (place: Place) => {
      qc.setQueryData(placesKey, (old: Place[] = []) => [place, ...old]);
      setShowForm(false);
      toast({ title: "Place added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      apiRequest("PATCH", `/api/places/${id}`, {
        name: data.name,
        emoji: data.emoji || null,
        address: data.address || null,
        category: data.category,
        notes: data.notes || null,
      }).then(r => r.json()),
    onSuccess: (place: Place) => {
      qc.setQueryData(placesKey, (old: Place[] = []) =>
        old.map(p => p.id === place.id ? place : p)
      );
      setEditingId(null);
      toast({ title: "Place updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/places/${id}`),
    onSuccess: (_r, id) => {
      qc.setQueryData(placesKey, (old: Place[] = []) => old.filter(p => p.id !== id));
      toast({ title: "Place removed" });
    },
  });

  const filtered = filterCat === "all" ? places : places.filter(p => p.category === filterCat);
  const usedCats = [...new Set(places.map(p => p.category))];

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Places</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saved locations — link them to calendar events
          </p>
        </div>
        <button
          data-testid="button-add-place"
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: ACCENT }}
        >
          <Plus size={14} /> Add place
        </button>
      </div>

      {/* New place form */}
      {showForm && (
        <PlaceForm
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Category filter */}
      {usedCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat("all")}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
            style={
              filterCat === "all"
                ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT }
                : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            All
          </button>
          {usedCats.map(cat => {
            const meta = categoryMeta(cat);
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                style={
                  filterCat === cat
                    ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT }
                    : { background: "hsl(var(--secondary))", borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
                }
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <MapPin size={36} className="text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-muted-foreground">
            {filterCat === "all" ? "No places saved yet" : "No places in this category"}
          </p>
          {filterCat === "all" && (
            <p className="text-xs text-muted-foreground max-w-xs">
              Save locations here and link them to events in your calendar.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(place =>
            editingId === place.id ? (
              <PlaceForm
                key={place.id}
                initial={{
                  name: place.name,
                  address: place.address ?? "",
                  category: place.category,
                  notes: place.notes ?? "",
                  emoji: place.emoji ?? "",
                }}
                onSave={data => updateMutation.mutate({ id: place.id, data })}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PlaceCard
                key={place.id}
                place={place}
                onEdit={() => setEditingId(place.id)}
                onDelete={() => deleteMutation.mutate(place.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
