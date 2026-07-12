import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, MoreVertical, Trash2, Archive, Copy, ChevronDown, ChevronRight,
  Pencil, CheckSquare, Square, Star, Bookmark, X, CalendarIcon, Flag,
  RotateCcw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TodoList {
  id: number;
  name: string;
  description: string | null;
  is_template: number;
  is_archived: number;
  created_by: string;
  created_at: string;
}

interface TodoItem {
  id: number;
  list_id: number;
  parent_id: number | null;
  title: string;
  notes: string | null;
  category: string | null;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  checked: number;
  sort_order: number;
}

type Priority = "high" | "medium" | "low";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  high:   { label: "High",   color: "text-red-400",    icon: "🔴" },
  medium: { label: "Medium", color: "text-amber-400",  icon: "🟡" },
  low:    { label: "Low",    color: "text-slate-400",  icon: "🔵" },
};

// The Umzugsplanung seed data from Sally
const SEED_ITEMS: Omit<TodoItem, "id" | "list_id">[] = [
  // Adressen
  { parent_id: null, title: "Adresse anpassen", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 0 },
  { parent_id: -1,   title: "Bank Raiffeisen", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 1 },
  { parent_id: -1,   title: "Frontobel 3. Säule", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 2 },
  { parent_id: -1,   title: "EVG 2. Säule (Pension)", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 3 },
  { parent_id: -1,   title: "Yuh / PostFinance", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 4 },
  { parent_id: -1,   title: "Arbeitgeber (IQAir)", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 5 },
  { parent_id: -1,   title: "Krankenkasse (Grund + Zusatz)", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 6 },
  { parent_id: -1,   title: "Hausratversicherung", notes: null, category: "Adressen", priority: "medium", due_date: null, checked: 0, sort_order: 7 },
  { parent_id: -1,   title: "Haftpflichtversicherung", notes: null, category: "Adressen", priority: "medium", due_date: null, checked: 0, sort_order: 8 },
  { parent_id: -1,   title: "Internet-Provider", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 9 },
  { parent_id: -1,   title: "Salt (Mobile/Internet)", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 10 },
  { parent_id: -1,   title: "Kredit / Kreditkarte", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 11 },
  { parent_id: -1,   title: "SBB (SwissPass)", notes: null, category: "Adressen", priority: "medium", due_date: null, checked: 0, sort_order: 12 },
  { parent_id: -1,   title: "Zahnarzt / Ärzte", notes: null, category: "Adressen", priority: "medium", due_date: null, checked: 0, sort_order: 13 },
  { parent_id: null, title: "Postumleitung einrichten", notes: "Dauer festlegen (z.B. 3–6 Monate)", category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 14 },
  { parent_id: null, title: "Auto ummelden", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 15 },
  { parent_id: -2,   title: "Verkehrsamt", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 16 },
  { parent_id: -2,   title: "Versicherung", notes: null, category: "Adressen", priority: "high", due_date: null, checked: 0, sort_order: 17 },
  // Umzug
  { parent_id: null, title: "Wohnungsbesichtigung planen", notes: null, category: "Umzug", priority: "medium", due_date: null, checked: 1, sort_order: 18 },
  { parent_id: null, title: "Reinigung alte Wohnung", notes: "Endreinigung ggf. Firma buchen", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 19 },
  { parent_id: null, title: "Besichtigungen alte Wohnung organisieren", notes: "Termine koordinieren", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 20 },
  { parent_id: null, title: "Strom & Nebenkosten alte Wohnung", notes: "Zählerstände erfassen", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 21 },
  { parent_id: null, title: "Besitz aussortieren", notes: "Keller inkludiert", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 22 },
  { parent_id: null, title: "Besitz entsorgen", notes: "Recyclinghof / Sperrgut", category: "Umzug", priority: "medium", due_date: null, checked: 0, sort_order: 23 },
  { parent_id: null, title: "Umzugskartons organisieren", notes: "Melanie / Sebi", category: "Umzug", priority: "medium", due_date: null, checked: 0, sort_order: 24 },
  { parent_id: null, title: "Lösung für Meerschweine", notes: "Temporärer Transport", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 25 },
  { parent_id: null, title: "Transporter organisieren", notes: "Jessie (Arbeit)", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 26 },
  { parent_id: null, title: "Schlüsselübergabe planen", notes: "Mit Vermieter abstimmen", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 27 },
  { parent_id: null, title: "Wohnung kündigen", notes: "Kündigungsfrist prüfen", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 28 },
  { parent_id: null, title: "Parkplatz abmelden", notes: "Parkkarte abgeben", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 29 },
  { parent_id: null, title: "Besitzaufteilung klären", notes: "Liste mit Marcel erstellen", category: "Umzug", priority: "high", due_date: null, checked: 0, sort_order: 30 },
  // Behörden
  { parent_id: null, title: "Einwohnerkontrolle anmelden", notes: "Frist in CH beachten", category: "Behörden", priority: "high", due_date: null, checked: 0, sort_order: 31 },
  { parent_id: null, title: "Serafe Adresse ändern", notes: "Radio/TV", category: "Behörden", priority: "medium", due_date: null, checked: 0, sort_order: 32 },
  { parent_id: null, title: "Steueramt Adresse aktualisieren", notes: null, category: "Behörden", priority: "medium", due_date: null, checked: 0, sort_order: 33 },
  // Finanzen
  { parent_id: null, title: "Daueraufträge prüfen/anpassen", notes: "Miete, Versicherungen", category: "Finanzen", priority: "high", due_date: null, checked: 0, sort_order: 34 },
  { parent_id: null, title: "Abos aktualisieren", notes: "Netflix, Spotify, etc.", category: "Finanzen", priority: "low", due_date: null, checked: 0, sort_order: 35 },
  { parent_id: null, title: "Gemeinsame Konten/Verträge klären", notes: null, category: "Finanzen", priority: "high", due_date: null, checked: 0, sort_order: 36 },
  // Neue Wohnung
  { parent_id: null, title: "Internet neue Wohnung aktivieren", notes: "Termin vereinbaren", category: "Neue Wohnung", priority: "high", due_date: null, checked: 0, sort_order: 37 },
  { parent_id: null, title: "Strom anmelden neue Wohnung", notes: null, category: "Neue Wohnung", priority: "high", due_date: null, checked: 0, sort_order: 38 },
  { parent_id: null, title: "Möbelplanung / Setup", notes: null, category: "Neue Wohnung", priority: "medium", due_date: null, checked: 0, sort_order: 39 },
  { parent_id: null, title: "Übergabeprotokoll prüfen", notes: "Schäden dokumentieren", category: "Neue Wohnung", priority: "high", due_date: null, checked: 0, sort_order: 40 },
  // Organisation
  { parent_id: null, title: "Wichtige Dokumente sammeln", notes: "Digital + physisch", category: "Organisation", priority: "high", due_date: null, checked: 0, sort_order: 41 },
  { parent_id: null, title: "Schlüssel & Zugänge prüfen", notes: null, category: "Organisation", priority: "medium", due_date: null, checked: 0, sort_order: 42 },
  { parent_id: null, title: "Backup persönlicher Daten", notes: null, category: "Organisation", priority: "medium", due_date: null, checked: 0, sort_order: 43 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function progressOf(items: TodoItem[], listId?: number) {
  const top = items.filter(i => !i.parent_id);
  if (!top.length) return 0;
  const done = top.filter(i => i.checked).length;
  return Math.round((done / top.length) * 100);
}

function formatDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(d: string | null) {
  if (!d) return false;
  return new Date(d + "T23:59:59") < new Date();
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Flag size={10} /> {cfg.label}
    </span>
  );
}

interface ItemRowProps {
  item: TodoItem;
  subtasks: TodoItem[];
  onCheck: (id: number, checked: boolean) => void;
  onEdit: (item: TodoItem) => void;
  onDelete: (id: number) => void;
  onAddSubtask: (parentId: number) => void;
}

function ItemRow({ item, subtasks, onCheck, onEdit, onDelete, onAddSubtask }: ItemRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = subtasks.length > 0;
  const doneSubs = subtasks.filter(s => s.checked).length;

  return (
    <div className="group">
      {/* Main row */}
      <div className={`flex items-start gap-2 py-2 px-3 rounded-lg transition-colors hover:bg-white/5 ${item.checked ? "opacity-50" : ""}`}>
        {/* Expand toggle */}
        <button
          onClick={() => hasSubtasks && setExpanded(v => !v)}
          className="mt-0.5 w-4 shrink-0 text-slate-500 hover:text-slate-300"
        >
          {hasSubtasks ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5 inline-block" />}
        </button>

        {/* Checkbox */}
        <button
          onClick={() => onCheck(item.id, !item.checked)}
          className="mt-0.5 shrink-0 transition-colors text-slate-500 hover:text-violet-400"
          data-testid={`todo-check-${item.id}`}
        >
          {item.checked
            ? <CheckSquare size={16} className="text-violet-400" />
            : <Square size={16} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium leading-snug ${item.checked ? "line-through text-slate-500" : "text-slate-100"}`}>
              {item.title}
            </span>
            {item.priority !== "medium" && <PriorityBadge priority={item.priority} />}
            {item.due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(item.due_date) && !item.checked ? "text-red-400" : "text-slate-500"}`}>
                <CalendarIcon size={10} />
                {formatDate(item.due_date)}
              </span>
            )}
            {hasSubtasks && (
              <span className="text-xs text-slate-500">{doneSubs}/{subtasks.length}</span>
            )}
          </div>
          {item.notes && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onAddSubtask(item.id)} className="p-1 hover:text-violet-400 text-slate-500 transition-colors" title="Add subtask">
            <Plus size={13} />
          </button>
          <button onClick={() => onEdit(item)} className="p-1 hover:text-violet-400 text-slate-500 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 hover:text-red-400 text-slate-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {hasSubtasks && expanded && (
        <div className="ml-10 border-l border-white/10 pl-3">
          {subtasks.map(sub => (
            <div key={sub.id} className={`group/sub flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors hover:bg-white/5 ${sub.checked ? "opacity-50" : ""}`}>
              <button onClick={() => onCheck(sub.id, !sub.checked)} className="mt-0.5 shrink-0 text-slate-500 hover:text-violet-400 transition-colors">
                {sub.checked ? <CheckSquare size={14} className="text-violet-400" /> : <Square size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs leading-snug ${sub.checked ? "line-through text-slate-500" : "text-slate-200"}`}>
                    {sub.title}
                  </span>
                  {sub.priority !== "medium" && <PriorityBadge priority={sub.priority} />}
                  {sub.due_date && (
                    <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(sub.due_date) && !sub.checked ? "text-red-400" : "text-slate-500"}`}>
                      <CalendarIcon size={10} /> {formatDate(sub.due_date)}
                    </span>
                  )}
                </div>
                {sub.notes && <p className="text-xs text-slate-500 mt-0.5">{sub.notes}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0">
                <button onClick={() => onEdit(sub)} className="p-1 hover:text-violet-400 text-slate-500 transition-colors"><Pencil size={12} /></button>
                <button onClick={() => onDelete(sub.id)} className="p-1 hover:text-red-400 text-slate-500 transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Edit Dialog ─────────────────────────────────────────────────────────

interface ItemEditDialogProps {
  item: Partial<TodoItem> & { list_id: number };
  onSave: (data: Partial<TodoItem>) => void;
  onClose: () => void;
}

function ItemEditDialog({ item, onSave, onClose }: ItemEditDialogProps) {
  const [title, setTitle] = useState(item.title ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [priority, setPriority] = useState<Priority>((item.priority as Priority) ?? "medium");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");

  function handleSave() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), notes: notes || null, category: category || null, priority, due_date: dueDate || null });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#12131a] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{item.id ? "Edit task" : item.parent_id ? "Add subtask" : "Add task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
            autoFocus
          />
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 text-sm resize-none"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Priority</label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1b26] border-white/10">
                  <SelectItem value="high" className="text-red-400">🔴 High</SelectItem>
                  <SelectItem value="medium" className="text-amber-400">🟡 Medium</SelectItem>
                  <SelectItem value="low" className="text-slate-400">🔵 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Due date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-white/5 border-white/10 text-slate-100 h-9 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category (optional)</label>
            <Input
              placeholder="e.g. Adressen, Umzug…"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {item.id ? "Save changes" : "Add"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-400 hover:text-slate-200">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New List Dialog ──────────────────────────────────────────────────────────

interface NewListDialogProps {
  templates: TodoList[];
  createdBy: string;
  onClose: () => void;
  onCreated: (list: TodoList) => void;
}

function NewListDialog({ templates, createdBy, onClose, onCreated }: NewListDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [fromTemplate, setFromTemplate] = useState<number | null>(null);
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/todo-lists", data); return r.json(); },
    onSuccess: (list: TodoList) => { qc.setQueryData(["/api/todo-lists", false], (old: TodoList[] = []) => [list, ...old]); onCreated(list); onClose(); },
  });
  const cloneMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => { const r = await apiRequest("POST", `/api/todo-lists/${id}/clone`, data); return r.json(); },
    onSuccess: (list: TodoList) => { qc.setQueryData(["/api/todo-lists", false], (old: TodoList[] = []) => [list, ...old]); onCreated(list); onClose(); },
  });

  function handleCreate() {
    if (!name.trim()) return;
    if (fromTemplate) {
      cloneMutation.mutate({ id: fromTemplate, name: name.trim(), created_by: createdBy });
    } else {
      createMutation.mutate({ name: name.trim(), description: description || null, is_template: isTemplate ? 1 : 0, is_archived: 0, created_by: createdBy });
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#12131a] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">New todo list</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {templates.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Use a template (optional)</label>
              <Select value={fromTemplate ? String(fromTemplate) : "none"} onValueChange={v => setFromTemplate(v === "none" ? null : Number(v))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1b26] border-white/10">
                  <SelectItem value="none">Start from scratch</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Input
            placeholder="List name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
            autoFocus
          />
          {!fromTemplate && (
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 resize-none text-sm"
              rows={2}
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} className="accent-violet-500" />
            <span className="text-sm text-slate-400">Save as template</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={createMutation.isPending || cloneMutation.isPending} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {createMutation.isPending || cloneMutation.isPending ? "Creating…" : "Create"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-400 hover:text-slate-200">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TodoTabProps {
  currentUser: string;
}

export default function TodoTab({ currentUser }: TodoTabProps) {
  const qc = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [editingItem, setEditingItem] = useState<(Partial<TodoItem> & { list_id: number }) | null>(null);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [isSeedingList, setIsSeedingList] = useState(false);

  // Fetch all lists
  const { data: allLists = [] } = useQuery<TodoList[]>({
    queryKey: ["/api/todo-lists", showArchived],
    queryFn: async () => { const r = await apiRequest("GET", `/api/todo-lists?archived=${showArchived}`); return r.json(); },
    staleTime: 5000,
  });

  const templates = allLists.filter(l => l.is_template);
  const activeLists = allLists.filter(l => !l.is_template);
  const selectedList = allLists.find(l => l.id === selectedListId) ?? activeLists[0] ?? null;

  // Fetch items for selected list
  const { data: allItems = [] } = useQuery<TodoItem[]>({
    queryKey: ["/api/todo-lists", selectedList?.id, "items"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/todo-lists/${selectedList!.id}/items`); return r.json(); },
    enabled: !!selectedList,
    staleTime: 3000,
  });

  // Organize items
  const topLevelItems = useMemo(() => allItems.filter(i => !i.parent_id), [allItems]);
  const subtaskMap = useMemo(() => {
    const map: Record<number, TodoItem[]> = {};
    for (const item of allItems.filter(i => i.parent_id)) {
      if (!map[item.parent_id!]) map[item.parent_id!] = [];
      map[item.parent_id!].push(item);
    }
    return map;
  }, [allItems]);

  // Categories from items
  const categories = useMemo(() => {
    const cats = new Set(allItems.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [allItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return topLevelItems.filter(item => {
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterPriority !== "all" && item.priority !== filterPriority) return false;
      return true;
    });
  }, [topLevelItems, filterCategory, filterPriority]);

  const progress = progressOf(allItems);
  const totalDone = topLevelItems.filter(i => i.checked).length;

  // Mutations
  const createItem = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", `/api/todo-lists/${selectedList!.id}/items`, data); return r.json(); },
    onSuccess: (item: TodoItem) => {
      qc.setQueryData(["/api/todo-lists", selectedList!.id, "items"], (old: TodoItem[] = []) => [...old, item]);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: any) => { const r = await apiRequest("PATCH", `/api/todo-items/${id}`, data); return r.json(); },
    onSuccess: (item: TodoItem) => {
      qc.setQueryData(["/api/todo-lists", selectedList!.id, "items"], (old: TodoItem[] = []) =>
        old.map(i => i.id === item.id ? item : i)
      );
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/todo-items/${id}`); return id; },
    onSuccess: (_: any, id: number) => {
      qc.setQueryData(["/api/todo-lists", selectedList!.id, "items"], (old: TodoItem[] = []) =>
        old.filter(i => i.id !== id && i.parent_id !== id)
      );
    },
  });

  const updateList = useMutation({
    mutationFn: async ({ id, ...data }: any) => { const r = await apiRequest("PATCH", `/api/todo-lists/${id}`, data); return r.json(); },
    onSuccess: (list: TodoList) => {
      qc.setQueryData(["/api/todo-lists", showArchived], (old: TodoList[] = []) =>
        old.map(l => l.id === list.id ? list : l)
      );
    },
  });

  const deleteList = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/todo-lists/${id}`); return id; },
    onSuccess: (_: any, id: number) => {
      qc.setQueryData(["/api/todo-lists", showArchived], (old: TodoList[] = []) => old.filter(l => l.id !== id));
      if (selectedListId === id) setSelectedListId(null);
    },
  });

  const cloneList = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("POST", `/api/todo-lists/${id}/clone`, { name, created_by: currentUser }).then(r => r.json()),
    onSuccess: (list: TodoList) => {
      qc.setQueryData(["/api/todo-lists", showArchived], (old: TodoList[] = []) => [list, ...old]);
      setSelectedListId(list.id);
    },
  });

  // Seed the Umzugsplanung list
  async function seedUmzugsplanung() {
    setIsSeedingList(true);
    try {
      const listResp = await apiRequest("POST", "/api/todo-lists", {
        name: "Umzugsplanung",
        description: "Moving checklist — created by Sally",
        is_template: 0,
        is_archived: 0,
        created_by: "sally",
      });
      const list: TodoList = await listResp.json();
      qc.setQueryData(["/api/todo-lists", showArchived], (old: TodoList[] = []) => [list, ...old]);

      // Process items in order; negative parent_id = back-ref to Nth most recent top-level
      let lastTopIds: number[] = [];
      for (const seed of SEED_ITEMS) {
        const parentId = seed.parent_id as number | null;
        if (parentId === null || parentId === undefined) {
          // top-level
          const createdResp = await apiRequest("POST", `/api/todo-lists/${list.id}/items`, {
            ...seed, parent_id: null, list_id: list.id,
          });
          const createdItem: TodoItem = await createdResp.json();
          lastTopIds.push(createdItem.id);
        } else if (parentId < 0) {
          // subtask: parent_id -1 = last top, -2 = second to last, etc.
          const parentRealId = lastTopIds[lastTopIds.length + parentId];
          if (parentRealId) {
            await apiRequest("POST", `/api/todo-lists/${list.id}/items`, {
              ...seed, parent_id: parentRealId, list_id: list.id,
            });
          }
        }
      }
      setSelectedListId(list.id);
    } finally {
      setIsSeedingList(false);
    }
  }

  function handleSaveItem(data: Partial<TodoItem>) {
    if (editingItem?.id) {
      updateItem.mutate({ id: editingItem.id, ...data });
    } else {
      createItem.mutate({ ...data, parent_id: editingItem?.parent_id ?? null, sort_order: allItems.length });
    }
    setEditingItem(null);
    setAddingSubtaskTo(null);
  }

  function handleAddSubtask(parentId: number) {
    setEditingItem({ list_id: selectedList!.id, parent_id: parentId });
  }

  const openList = selectedList;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col md:flex-row min-h-[500px] md:h-full md:min-h-0 overflow-visible md:overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-56 shrink-0 md:border-r border-b md:border-b-0 border-white/8 flex flex-col bg-[#0e0f18]/60 max-h-48 md:max-h-none overflow-y-auto">
        <div className="p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Todo Lists</span>
          <button
            onClick={() => setShowNewList(true)}
            className="w-6 h-6 rounded-md bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 flex items-center justify-center transition-colors"
            data-testid="button-new-todo-list"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {activeLists.length === 0 && allLists.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-slate-500 mb-3">No lists yet</p>
              <Button
                size="sm"
                onClick={seedUmzugsplanung}
                disabled={isSeedingList}
                className="w-full bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 border border-violet-500/20 text-xs h-8"
              >
                {isSeedingList ? "Creating…" : "📋 Load Umzugsplanung"}
              </Button>
            </div>
          )}
          {activeLists.map(list => {
            const isActive = list.id === (openList?.id);
            return (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors group relative ${isActive ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                data-testid={`todo-list-${list.id}`}
              >
                <div className="flex items-center gap-2">
                  <CheckSquare size={13} className={isActive ? "text-violet-400" : "text-slate-600"} />
                  <span className="flex-1 truncate text-xs">{list.name}</span>
                  {list.is_template ? <Bookmark size={10} className="text-amber-400 shrink-0" /> : null}
                </div>
              </button>
            );
          })}

          {templates.length > 0 && (
            <>
              <div className="px-2 pt-4 pb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Templates</span>
              </div>
              {templates.map(list => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group ${list.id === openList?.id ? "bg-amber-500/10 text-amber-300" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
                >
                  <div className="flex items-center gap-2">
                    <Bookmark size={12} className="text-amber-500/60 shrink-0" />
                    <span className="truncate">{list.name}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Toggle archived */}
        <div className="p-2 border-t border-white/8">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="w-full text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
          >
            <Archive size={11} />
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!openList ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center">
              <CheckSquare size={28} className="text-violet-400/60" />
            </div>
            <div>
              <h3 className="text-slate-300 font-medium mb-1">No list selected</h3>
              <p className="text-slate-500 text-sm">Create a new list or pick one from the sidebar</p>
            </div>
            <Button onClick={() => setShowNewList(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus size={15} /> New list
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-white/8 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-slate-100 truncate">{openList.name}</h2>
                    {openList.is_template ? <Badge className="bg-amber-500/20 text-amber-300 text-xs border-0 h-5">Template</Badge> : null}
                    {openList.is_archived ? <Badge className="bg-slate-500/20 text-slate-400 text-xs border-0 h-5">Archived</Badge> : null}
                    <span className="text-xs text-slate-500">by {openList.created_by}</span>
                  </div>
                  {openList.description && <p className="text-sm text-slate-500 mt-0.5">{openList.description}</p>}
                  {/* Progress bar */}
                  {topLevelItems.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 max-w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{totalDone}/{topLevelItems.length} done</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => setEditingItem({ list_id: openList.id, parent_id: null })}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/20 h-8 gap-1.5 text-xs"
                  >
                    <Plus size={13} /> Add task
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200">
                        <MoreVertical size={15} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1a1b26] border-white/10 text-slate-300">
                      {!openList.is_template && (
                        <DropdownMenuItem onClick={() => cloneList.mutate({ id: openList.id, name: `${openList.name} (copy)` })}>
                          <Copy size={13} className="mr-2" /> Duplicate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => updateList.mutate({ id: openList.id, is_template: openList.is_template ? 0 : 1 })}>
                        <Bookmark size={13} className="mr-2" /> {openList.is_template ? "Remove from templates" : "Save as template"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateList.mutate({ id: openList.id, is_archived: openList.is_archived ? 0 : 1 })}>
                        {openList.is_archived ? <RotateCcw size={13} className="mr-2" /> : <Archive size={13} className="mr-2" />}
                        {openList.is_archived ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { if (confirm("Delete this list and all its tasks?")) deleteList.mutate(openList.id); }}
                        className="text-red-400 focus:text-red-400"
                      >
                        <Trash2 size={13} className="mr-2" /> Delete list
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Filter bar */}
              {(categories.length > 0 || topLevelItems.length > 3) && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => setFilterCategory(null)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${!filterCategory ? "bg-violet-600/30 text-violet-300" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterCategory === cat ? "bg-violet-600/30 text-violet-300" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                    >
                      {cat}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Select value={filterPriority} onValueChange={v => setFilterPriority(v as Priority | "all")}>
                      <SelectTrigger className="h-7 text-xs bg-transparent border-white/10 text-slate-500 w-28 hover:border-white/20">
                        <Flag size={11} className="mr-1" /><SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1b26] border-white/10 text-slate-300 text-xs">
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="high">🔴 High</SelectItem>
                        <SelectItem value="medium">🟡 Medium</SelectItem>
                        <SelectItem value="low">🔵 Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
              {filteredItems.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-slate-500 text-sm">
                    {topLevelItems.length === 0 ? "No tasks yet — add one above" : "No tasks match the current filters"}
                  </p>
                </div>
              )}
              {filteredItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  subtasks={subtaskMap[item.id] ?? []}
                  onCheck={(id, checked) => updateItem.mutate({ id, checked: checked ? 1 : 0 })}
                  onEdit={setEditingItem}
                  onDelete={id => deleteItem.mutate(id)}
                  onAddSubtask={handleAddSubtask}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {showNewList && (
        <NewListDialog
          templates={templates}
          createdBy={currentUser}
          onClose={() => setShowNewList(false)}
          onCreated={list => setSelectedListId(list.id)}
        />
      )}
      {editingItem && (
        <ItemEditDialog
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => { setEditingItem(null); setAddingSubtaskTo(null); }}
        />
      )}
    </div>
  );
}
