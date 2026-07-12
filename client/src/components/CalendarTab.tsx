/**
 * CalendarTab — shared calendar + event planner for Together.
 *
 * Month grid with event dots, upcoming list, create/edit/delete dialog.
 * Categories: date | trip | anniversary | concert | birthday | reminder | other
 */

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2,
  CalendarDays, Clock, MapPin, AlignLeft, Star,
} from "lucide-react";
import type { Event, TodoItem } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = "hsl(20 90% 60%)";
const JACK_COLOR  = "hsl(220 80% 60%)";
const SALLY_COLOR = "hsl(330 75% 65%)";

const CATEGORIES = [
  { id: "date",        label: "Date night",   emoji: "🍷", color: "hsl(340 80% 60%)" },
  { id: "trip",        label: "Trip",         emoji: "✈️", color: "hsl(200 80% 55%)" },
  { id: "anniversary", label: "Anniversary",  emoji: "💞", color: "hsl(355 85% 65%)" },
  { id: "concert",     label: "Concert",      emoji: "🎵", color: "hsl(270 70% 65%)" },
  { id: "birthday",    label: "Birthday",     emoji: "🎂", color: "hsl(40 90% 60%)"  },
  { id: "reminder",    label: "Reminder",     emoji: "🔔", color: "hsl(50 90% 60%)"  },
  { id: "other",       label: "Other",        emoji: "📌", color: "hsl(200 20% 55%)" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

function creatorColor(by: string) {
  if (by === "jack")  return JACK_COLOR;
  if (by === "sally") return SALLY_COLOR;
  return ACCENT;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function isoToDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string) {
  return isoToDate(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function formatShort(iso: string) {
  return isoToDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  // Monday-first: 0=Mon … 6=Sun
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── Event dot cluster ─────────────────────────────────────────────────────────

function EventDots({ evts }: { evts: Event[] }) {
  const shown = evts.slice(0, 4);
  return (
    <div className="flex gap-0.5 justify-center flex-wrap mt-0.5">
      {shown.map(e => (
        <div
          key={e.id}
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: getCat(e.category).color }}
          title={e.title}
        />
      ))}
    </div>
  );
}

// ── Event chip (in day detail panel) ─────────────────────────────────────────

function EventChip({
  event, onEdit, onDelete,
}: { event: Event; onEdit: (e: Event) => void; onDelete: (id: number) => void }) {
  const cat = getCat(event.category);
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5 border border-border/40 bg-background/30 group transition-all hover:border-border/70"
      style={{ borderLeft: `3px solid ${cat.color}` }}
    >
      <span className="text-base leading-none flex-shrink-0 mt-0.5">{cat.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{event.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {event.time && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={10} />{event.time}
            </span>
          )}
          {event.end_date && event.end_date !== event.date && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              → {formatShort(event.end_date)}
            </span>
          )}
          <span className="text-[11px] font-medium" style={{ color: creatorColor(event.created_by) }}>
            {event.created_by}
          </span>
        </div>
        {event.notes && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{event.notes}</p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(event)} className="p-1 rounded hover:bg-border/40 text-muted-foreground hover:text-foreground">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(event.id)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Create / Edit dialog ──────────────────────────────────────────────────────

type DialogMode = { mode: "create"; date: string } | { mode: "edit"; event: Event };

function EventDialog({
  initial,
  onClose,
  onSaved,
}: { initial: DialogMode; onClose: () => void; onSaved: (e: Event) => void }) {
  const isEdit = initial.mode === "edit";
  const existing = isEdit ? initial.event : null;

  const [title,    setTitle]    = useState(existing?.title    ?? "");
  const [date,     setDate]     = useState(existing?.date     ?? (initial.mode === "create" ? initial.date : ""));
  const [endDate,  setEndDate]  = useState(existing?.end_date ?? "");
  const [time,     setTime]     = useState(existing?.time     ?? "");
  const [cat,      setCat]      = useState<CategoryId>((existing?.category as CategoryId) ?? "other");
  const [notes,    setNotes]    = useState(existing?.notes    ?? "");
  const [createdBy, setCreatedBy] = useState<"jack"|"sally"|"together">(
    (existing?.created_by as any) ?? "together"
  );
  const [loading, setLoading]   = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setLoading(true);
    try {
      let saved: Event;
      if (isEdit && existing) {
        const r = await apiRequest("PATCH", `/api/events/${existing.id}`, {
          title: title.trim(), date, end_date: endDate || null,
          time: time || null, category: cat, notes: notes || null, created_by: createdBy,
        });
        saved = await r.json();
      } else {
        const r = await apiRequest("POST", "/api/events", {
          title: title.trim(), date, end_date: endDate || null,
          time: time || null, category: cat, notes: notes || null, created_by: createdBy,
        });
        saved = await r.json();
      }
      onSaved(saved);
    } catch {
      toast({ title: "Couldn't save event", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}>
      <div className="rounded-2xl border border-border/60 w-full max-w-md" style={{ background: "hsl(230 15% 9%)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/30">
          <p className="font-bold text-base">{isEdit ? "Edit event" : "New event"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's happening?"
              className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Category</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    cat === c.id ? "border-transparent" : "border-border/40 text-muted-foreground hover:border-border/70"
                  )}
                  style={cat === c.id ? { background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55` } : {}}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">End date <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border" />
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Time <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Added by</label>
              <div className="mt-1.5 flex gap-1.5">
                {(["jack", "sally", "together"] as const).map(who => (
                  <button
                    key={who}
                    type="button"
                    onClick={() => setCreatedBy(who)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all",
                      createdBy === who ? "border-transparent" : "border-border/40 text-muted-foreground"
                    )}
                    style={createdBy === who ? {
                      background: `${creatorColor(who)}22`,
                      color: creatorColor(who),
                      border: `1px solid ${creatorColor(who)}55`,
                    } : {}}
                  >
                    {who}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Notes <span className="normal-case font-normal opacity-60">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any details…"
              className="mt-1 w-full bg-background/40 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-border resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !date}
              className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: ACCENT, color: "white" }}
            >
              {isEdit ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Upcoming strip ─────────────────────────────────────────────────────────────

function UpcomingStrip({
  events, onEdit, onDelete,
}: { events: Event[]; onEdit: (e: Event) => void; onDelete: (id: number) => void }) {
  const today = todayISO();
  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  // Group by date
  const groups = upcoming.reduce<Record<string, Event[]>>((acc, e) => {
    (acc[e.date] = acc[e.date] ?? []).push(e);
    return acc;
  }, {});

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Star size={13} style={{ color: ACCENT }} />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upcoming</p>
      </div>
      <div className="space-y-3">
        {Object.entries(groups).map(([date, evts]) => (
          <div key={date}>
            <p className="text-[11px] text-muted-foreground font-semibold mb-1.5 pl-1">{formatDisplay(date)}</p>
            <div className="space-y-1.5">
              {evts.map(e => <EventChip key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main CalendarTab ──────────────────────────────────────────────────────────

export default function CalendarTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const today = todayISO();
  const [year,  setYear]  = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode | null>(null);

  const eventsKey = ["/api/events"];
  const { data: allEvents = [] } = useQuery<Event[]>({
    queryKey: eventsKey,
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/events");
      return r.json();
    },
    staleTime: 30_000,
  });

  // Fetch all todo items that have due dates (across all lists)
  const { data: todoDueItems = [] } = useQuery<any[]>({
    queryKey: ["/api/todo-due-dates"],
    queryFn: () => apiRequest("GET", "/api/todo-due-dates"),
    staleTime: 30_000,
  });

  // Map: ISO due_date → todo items[]
  const todoByDate = useMemo(() => {
    const map: Record<string, { id: number; title: string; checked: boolean; list_name: string; priority: string }[]> = {};
    for (const item of todoDueItems) {
      if (item.due_date) {
        (map[item.due_date] = map[item.due_date] ?? []).push(item);
      }
    }
    return map;
  }, [todoDueItems]);

  // Map: ISO date → events[]

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    allEvents.forEach(e => {
      (map[e.date] = map[e.date] ?? []).push(e);
      // Multi-day: fill in-between dates with same event
      if (e.end_date && e.end_date > e.date) {
        const cur = isoToDate(e.date);
        const end = isoToDate(e.end_date);
        const d = new Date(cur);
        d.setDate(d.getDate() + 1);
        while (d <= end) {
          const iso = d.toISOString().slice(0, 10);
          (map[iso] = map[iso] ?? []).push(e);
          d.setDate(d.getDate() + 1);
        }
      }
    });
    return map;
  }, [allEvents]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  function handleDayClick(iso: string) {
    setSelectedDay(prev => prev === iso ? null : iso);
  }

  async function handleDelete(id: number) {
    await apiRequest("DELETE", `/api/events/${id}`);
    qc.setQueryData(eventsKey, (old: Event[] = []) => old.filter(e => e.id !== id));
    toast({ title: "Event deleted" });
    setDialog(null);
  }

  function handleSaved(event: Event) {
    qc.setQueryData(eventsKey, (old: Event[] = []) => {
      const exists = old.some(e => e.id === event.id);
      return exists ? old.map(e => e.id === event.id ? event : e) : [...old, event];
    });
    setDialog(null);
    toast({ title: dialog?.mode === "edit" ? "Event updated" : "Event created" });
  }

  // Build calendar grid
  const totalDays  = daysInMonth(year, month);
  const startDay   = firstDayOfMonth(year, month);
  const totalCells = Math.ceil((startDay + totalDays) / 7) * 7;
  const cells: (number | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startDay + 1;
    return d >= 1 && d <= totalDays ? d : null;
  });

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];
  const selectedTodos  = selectedDay ? (todoByDate[selectedDay] ?? []) : [];
  const todayCellISO = `${year}-${String(month + 1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;

  return (
    <div className="animate-page-in space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} style={{ color: ACCENT }} />
          <h2 className="text-base font-bold">Calendar</h2>
        </div>
        <button
          onClick={() => setDialog({ mode: "create", date: today })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }}
        >
          <Plus size={14} /> New event
        </button>
      </div>

      {/* Upcoming strip */}
      <UpcomingStrip events={allEvents} onEdit={e => setDialog({ mode: "edit", event: e })} onDelete={handleDelete} />

      {/* Month navigator */}
      <div className="rounded-2xl border border-border/50 bg-background/30 overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-bold">{MONTH_NAMES[month]} {year}</p>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day name header */}
        <div className="grid grid-cols-7 border-b border-border/20">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-2">{d}</div>
          ))}
        </div>

        {/* Grid cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`e-${i}`} className="aspect-square border-b border-r border-border/10 last:border-r-0" />;
            }
            const iso = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dayEvts = eventsByDate[iso] ?? [];
            const dayTodos = todoByDate[iso] ?? [];
            const isToday    = iso === today;
            const isSelected = iso === selectedDay;
            const isWeekend  = [5, 6].includes(i % 7); // Sat/Sun

            return (
              <button
                key={iso}
                onClick={() => handleDayClick(iso)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-start pt-1.5 border-b border-r border-border/10 last:border-r-0 transition-all text-xs font-medium hover:bg-border/20",
                  isWeekend && "text-muted-foreground/70",
                  isSelected && "!bg-orange-500/10",
                )}
                style={isToday ? { color: ACCENT, fontWeight: 700 } : {}}
              >
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full text-xs leading-none",
                  isToday && "text-white",
                )}
                  style={isToday ? { background: ACCENT } : {}}
                >
                  {day}
                </span>
                {dayEvts.length > 0 && <EventDots evts={dayEvts} />}
                {dayTodos.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {dayTodos.slice(0, 3).map((t, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${t.checked ? "bg-green-500/60" : t.priority === "high" ? "bg-red-400/80" : "bg-violet-400/80"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="rounded-2xl border border-border/50 bg-background/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <p className="text-sm font-bold">{formatDisplay(selectedDay)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDialog({ mode: "create", date: selectedDay })}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background: `${ACCENT}18`, color: ACCENT }}
              >
                <Plus size={11} /> Add
              </button>
              <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {selectedEvents.length === 0 && selectedTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events — click Add to plan something</p>
            ) : null}
            {selectedEvents.map(e => (
              <EventChip
                key={e.id}
                event={e}
                onEdit={ev => setDialog({ mode: "edit", event: ev })}
                onDelete={handleDelete}
              />
            ))}
            {selectedTodos.length > 0 && (
              <div className="space-y-1.5">
                {selectedTodos.length > 0 && selectedEvents.length > 0 && (
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2 mb-1">Todo due dates</p>
                )}
                {selectedTodos.map(todo => (
                  <div key={todo.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${todo.checked ? "opacity-50 border-white/5 bg-white/3" : "border-violet-500/20 bg-violet-500/5"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${todo.checked ? "bg-green-500/60" : todo.priority === "high" ? "bg-red-400" : "bg-violet-400"}`} />
                    <span className={`flex-1 truncate ${todo.checked ? "line-through text-slate-500" : "text-slate-200"}`}>{todo.title}</span>
                    <span className="text-xs text-slate-500 truncate">{todo.list_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category legend */}
      <div className="flex flex-wrap gap-2 pb-2">
        {CATEGORIES.map(c => (
          <span key={c.id} className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* Dialog */}
      {dialog && (
        <EventDialog
          initial={dialog}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
