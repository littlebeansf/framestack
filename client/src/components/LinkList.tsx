/**
 * LinkList — Together's shared link board.
 *
 * Mobile: single-column stacked — lists screen → tap to open links screen, back button to return.
 * Desktop: two-panel side-by-side (sidebar + links panel).
 *
 * API:
 *   GET    /api/link-lists                       → LinkList[]
 *   POST   /api/link-lists                       ← { name, emoji }
 *   PATCH  /api/link-lists/:listId               ← { name, emoji }
 *   DELETE /api/link-lists/:listId               (cascades links)
 *   GET    /api/link-lists/:listId/links         → Link[]
 *   POST   /api/link-lists/:listId/links         ← { url, title, addedBy?, icon?, favicon? }
 *   DELETE /api/links/:id
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LinkList as LinkListType, Link } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Link2,
  Plus,
  Trash2,
  ExternalLink,
  FolderOpen,
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Clock,
  Pencil,
  Check,
  X,
  ChevronRight,
} from "lucide-react";

const ACCENT = "hsl(20 90% 60%)";
const JACK_BLUE = "hsl(220 80% 60%)";
const SALLY_PINK = "hsl(330 75% 65%)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function ensureHttps(url: string) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

// ── Icon badge ────────────────────────────────────────────────────────────────

function IconBadge({ icon }: { icon: string }) {
  const isEmoji = [...icon].length <= 2;
  return isEmoji ? (
    <span className="flex-shrink-0 text-base leading-none">{icon}</span>
  ) : (
    <span
      className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize"
      style={{ background: `${ACCENT}25`, color: ACCENT }}
    >
      {icon}
    </span>
  );
}

// ── Sort toggle ───────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc" | "recent";

function SortToggle({ sort, onToggle }: { sort: SortDir; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={sort === "recent" ? "Sort A→Z" : sort === "asc" ? "Sort Z→A" : "Sort by recent"}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
      data-testid="button-sort"
    >
      {sort === "recent" ? <Clock size={14} /> : sort === "asc" ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
    </button>
  );
}

// ── Link row ──────────────────────────────────────────────────────────────────

function LinkRow({ link, onDelete }: { link: Link; onDelete: (id: number) => void }) {
  const [faviconError, setFaviconError] = useState(false);
  const href = ensureHttps(link.url);

  return (
    <div
      data-testid={`row-link-${link.id}`}
      className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border bg-card
        active:bg-secondary/40 transition-all duration-100"
    >
      {/* Favicon */}
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-secondary">
        {link.favicon && !faviconError ? (
          <img
            src={link.favicon}
            alt=""
            className="w-6 h-6 object-contain"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <Link2 size={13} className="text-muted-foreground" />
        )}
      </div>

      {/* Title + host */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {link.icon && <IconBadge icon={link.icon} />}
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{link.title}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{prettyHost(link.url)}</p>
      </div>

      {/* AddedBy badge — hidden on very small screens */}
      {link.addedBy && (
        <span
          className="hidden sm:inline-flex flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{
            background: link.addedBy === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
            color: link.addedBy === "jack" ? JACK_BLUE : SALLY_PINK,
          }}
        >
          {link.addedBy}
        </span>
      )}

      {/* Actions — always visible (no hover-only on mobile) */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`button-link-open-${link.id}`}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground
            hover:bg-secondary hover:text-foreground active:bg-secondary transition-colors"
          aria-label="Open link"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
        <button
          data-testid={`button-link-delete-${link.id}`}
          onClick={() => onDelete(link.id)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground
            hover:bg-destructive/15 hover:text-destructive active:bg-destructive/20 transition-colors"
          aria-label="Delete link"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Add-link form (collapsible on mobile) ─────────────────────────────────────

function AddLinkForm({ listId, onAdded }: { listId: number; onAdded: (link: Link) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [addedBy, setAddedBy] = useState<"jack" | "sally" | "">("");
  const [icon, setIcon] = useState("");

  const addMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", `/api/link-lists/${listId}/links`, body),
    onSuccess: async (res) => {
      const created: Link = await res.json();
      onAdded(created);
      setUrl(""); setTitle(""); setAddedBy(""); setIcon("");
      setOpen(false);
      toast({ title: "Link added" });
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  function handleAdd() {
    const trimUrl = url.trim();
    const trimTitle = title.trim();
    if (!trimUrl || !trimTitle) return;
    addMutation.mutate({
      url: ensureHttps(trimUrl),
      title: trimTitle,
      addedBy: addedBy || null,
      icon: icon.trim() || null,
      favicon: `https://www.google.com/s2/favicons?sz=64&domain=${ensureHttps(trimUrl)}`,
    });
  }

  // Collapsed state — just a + button
  if (!open) {
    return (
      <Button
        data-testid="button-show-add-link"
        onClick={() => setOpen(true)}
        className="w-full h-10 text-sm font-semibold rounded-xl flex items-center gap-2"
        style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
      >
        <Plus size={15} />
        Add link
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-secondary/30">
      <Input
        data-testid="input-link-url"
        placeholder="https://example.com"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="h-10 text-sm"
        autoFocus
        inputMode="url"
        onKeyDown={e => e.key === "Enter" && handleAdd()}
      />
      <div className="flex gap-2">
        <Input
          data-testid="input-link-title"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="h-10 text-sm flex-1"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <Input
          data-testid="input-link-icon"
          placeholder="🏷️"
          value={icon}
          onChange={e => setIcon(e.target.value)}
          className="h-10 text-sm w-14 text-center px-1"
          maxLength={8}
          title="Optional emoji or short label"
        />
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex gap-1 flex-shrink-0">
          {(["jack", "sally"] as const).map(who => (
            <button
              key={who}
              data-testid={`button-addedby-${who}`}
              type="button"
              onClick={() => setAddedBy(addedBy === who ? "" : who)}
              className="px-3 h-10 rounded-lg text-xs font-semibold border transition-all capitalize"
              style={
                addedBy === who
                  ? {
                      background: who === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
                      borderColor: who === "jack" ? JACK_BLUE : SALLY_PINK,
                      color: who === "jack" ? JACK_BLUE : SALLY_PINK,
                    }
                  : { borderColor: "hsl(var(--border))" }
              }
            >
              {who}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setOpen(false); setUrl(""); setTitle(""); setIcon(""); setAddedBy(""); }}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Cancel"
        >
          <X size={15} />
        </button>
        <Button
          data-testid="button-link-add"
          onClick={handleAdd}
          disabled={!url.trim() || !title.trim() || addMutation.isPending}
          className="h-10 px-4 text-sm ml-auto flex-shrink-0"
          style={{ background: ACCENT, color: "white" }}
        >
          {addMutation.isPending ? "…" : <><Plus size={14} /> Add</>}
        </Button>
      </div>
    </div>
  );
}

// ── Links panel (right pane / full-screen on mobile) ──────────────────────────

function LinksPanel({
  list,
  onBack,
}: {
  list: LinkListType;
  onBack?: () => void; // mobile only
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [linkSort, setLinkSort] = useState<SortDir>("recent");

  const linksKey = ["/api/link-lists", list.id, "links"];

  const { data: links = [], isLoading } = useQuery<Link[]>({
    queryKey: linksKey,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/link-lists/${list.id}/links`, undefined);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/links/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(linksKey, (old: Link[] = []) => old.filter(l => l.id !== id));
      toast({ title: "Link removed" });
    },
  });

  const sorted = useMemo(() => {
    const copy = [...links];
    if (linkSort === "asc") copy.sort((a, b) => a.title.localeCompare(b.title));
    if (linkSort === "desc") copy.sort((a, b) => b.title.localeCompare(a.title));
    return copy;
  }, [links, linkSort]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Back button — mobile only */}
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
              hover:bg-secondary active:bg-secondary transition-colors flex-shrink-0 md:hidden"
            aria-label="Back to lists"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="text-xl leading-none flex-shrink-0">{list.emoji ?? "🔗"}</span>
        <h3 className="font-bold text-foreground text-base truncate flex-1">{list.name}</h3>
        {links.length > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            {links.length}
          </span>
        )}
        <SortToggle
          sort={linkSort}
          onToggle={() => setLinkSort(s => s === "recent" ? "asc" : s === "asc" ? "desc" : "recent")}
        />
      </div>

      {/* Add link form */}
      <AddLinkForm
        listId={list.id}
        onAdded={link => qc.setQueryData(linksKey, (old: Link[] = []) => [link, ...old])}
      />

      {/* Links list */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto pb-4">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />
        ))}

        {!isLoading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center text-muted-foreground">
            <Link2 size={28} style={{ color: ACCENT, opacity: 0.4 }} />
            <p className="text-sm">No links yet — tap "Add link" above.</p>
          </div>
        )}

        {!isLoading && sorted.map(link => (
          <LinkRow
            key={link.id}
            link={link}
            onDelete={id => deleteMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Inline list name editor ───────────────────────────────────────────────────

function ListNameEditor({
  list,
  listsKey,
  onDone,
}: {
  list: LinkListType;
  listsKey: string[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [emoji, setEmoji] = useState(list.emoji ?? "");
  const [name, setName] = useState(list.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const patchMutation = useMutation({
    mutationFn: (body: object) => apiRequest("PATCH", `/api/link-lists/${list.id}`, body),
    onSuccess: async (res) => {
      const updated: LinkListType = await res.json();
      qc.setQueryData(listsKey, (old: LinkListType[] = []) =>
        old.map(l => l.id === updated.id ? updated : l)
      );
      toast({ title: "List updated" });
      onDone();
    },
    onError: () => toast({ title: "Failed to update list", variant: "destructive" }),
  });

  function handleSave() {
    const trimName = name.trim();
    if (!trimName) return;
    patchMutation.mutate({ name: trimName, emoji: emoji.trim() || null });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onDone();
  }

  return (
    <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
      <Input
        placeholder="🔗"
        value={emoji}
        onChange={e => setEmoji(e.target.value)}
        className="h-8 w-10 text-center text-sm px-1 flex-shrink-0"
        maxLength={2}
        onKeyDown={handleKeyDown}
      />
      <Input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        className="h-8 text-sm flex-1 min-w-0"
        onKeyDown={handleKeyDown}
        data-testid="input-list-rename"
      />
      <button
        onClick={handleSave}
        disabled={!name.trim() || patchMutation.isPending}
        className="w-8 h-8 rounded-md flex items-center justify-center text-green-500
          hover:bg-green-500/15 active:bg-green-500/20 transition-colors flex-shrink-0"
        aria-label="Save"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onDone}
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground
          hover:bg-secondary active:bg-secondary/60 transition-colors flex-shrink-0"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Lists sidebar ─────────────────────────────────────────────────────────────

function ListsSidebar({
  lists,
  listsLoading,
  listsKey,
  selectedId,
  editingId,
  listSort,
  onSelect,
  onEdit,
  onDelete,
  onSortToggle,
  onEditDone,
  onCreate,
}: {
  lists: LinkListType[];
  listsLoading: boolean;
  listsKey: string[];
  selectedId: number | null;
  editingId: number | null;
  listSort: SortDir;
  onSelect: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onSortToggle: () => void;
  onEditDone: () => void;
  onCreate: (name: string, emoji: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newEmoji.trim());
    setNewName("");
    setNewEmoji("");
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Create list form */}
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-secondary/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New list</p>
          <SortToggle sort={listSort} onToggle={onSortToggle} />
        </div>
        <div className="flex gap-1.5">
          <Input
            data-testid="input-list-emoji"
            placeholder="🔗"
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            className="h-10 w-12 text-center text-lg px-1 flex-shrink-0"
            maxLength={2}
          />
          <Input
            data-testid="input-list-name"
            placeholder="List name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-10 text-sm flex-1"
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
        </div>
        <Button
          data-testid="button-create-list"
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="h-9 text-sm w-full font-semibold"
          style={{ background: ACCENT, color: "white" }}
        >
          <Plus size={14} className="mr-1" />
          Create
        </Button>
      </div>

      {/* Lists */}
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {listsLoading && [1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-secondary/40 animate-pulse" />
        ))}

        {!listsLoading && lists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center text-muted-foreground">
            <FolderOpen size={22} style={{ opacity: 0.35 }} />
            <p className="text-xs">No lists yet</p>
          </div>
        )}

        {!listsLoading && lists.map(list => {
          const active = list.id === selectedId;
          const isEditing = editingId === list.id;

          return (
            <div
              key={list.id}
              data-testid={`button-list-${list.id}`}
              className="group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
              style={
                active
                  ? { background: `${ACCENT}22`, border: `1px solid ${ACCENT}55` }
                  : { border: "1px solid transparent" }
              }
              onClick={() => { if (!isEditing) onSelect(list.id); }}
            >
              {isEditing ? (
                <ListNameEditor
                  list={list}
                  listsKey={listsKey}
                  onDone={onEditDone}
                />
              ) : (
                <>
                  <span className="text-lg leading-none flex-shrink-0">{list.emoji ?? "🔗"}</span>
                  <span
                    className="flex-1 text-sm font-semibold truncate"
                    style={active ? { color: ACCENT } : {}}
                  >
                    {list.name}
                  </span>
                  <ChevronRight size={13} className="flex-shrink-0 text-muted-foreground opacity-40" />
                  {/* Action buttons — always shown on mobile (touch), hover on desktop */}
                  <button
                    data-testid={`button-edit-list-${list.id}`}
                    onClick={e => { e.stopPropagation(); onEdit(list.id); }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground
                      hover:bg-secondary hover:text-foreground active:bg-secondary/60 transition-colors
                      opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                    aria-label="Rename list"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    data-testid={`button-delete-list-${list.id}`}
                    onClick={e => { e.stopPropagation(); onDelete(list.id); }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground
                      hover:bg-destructive/15 hover:text-destructive active:bg-destructive/20 transition-colors
                      opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                    aria-label="Delete list"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LinkList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Mobile: null = lists view, number = links view
  const [mobileView, setMobileView] = useState<"lists" | "links">("lists");
  const [listSort, setListSort] = useState<SortDir>("recent");

  const listsKey = ["/api/link-lists"];

  const { data: listsRaw = [], isLoading: listsLoading } = useQuery<LinkListType[]>({
    queryKey: listsKey,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/link-lists", undefined);
      return res.json();
    },
  });

  const lists = useMemo(() => {
    const copy = [...listsRaw];
    if (listSort === "asc") copy.sort((a, b) => a.name.localeCompare(b.name));
    if (listSort === "desc") copy.sort((a, b) => b.name.localeCompare(a.name));
    return copy;
  }, [listsRaw, listSort]);

  const selectedList = lists.find(l => l.id === selectedId) ?? lists[0] ?? null;

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/link-lists", body),
    onSuccess: async (res) => {
      const created: LinkListType = await res.json();
      qc.setQueryData(listsKey, (old: LinkListType[] = []) => [...old, created]);
      setSelectedId(created.id);
      toast({ title: "List created" });
    },
    onError: () => toast({ title: "Failed to create list", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/link-lists/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(listsKey, (old: LinkListType[] = []) => old.filter(l => l.id !== id));
      if (selectedList?.id === id) setSelectedId(null);
      toast({ title: "List deleted" });
    },
  });

  function handleSelect(id: number) {
    setSelectedId(id);
    setMobileView("links");
  }

  function handleBack() {
    setMobileView("lists");
    setEditingId(null);
  }

  return (
    <>
      {/* ── Mobile layout: stacked screens ── */}
      <div className="md:hidden flex flex-col" style={{ minHeight: "60vh" }}>
        {mobileView === "lists" || !selectedList ? (
          <ListsSidebar
            lists={lists}
            listsLoading={listsLoading}
            listsKey={listsKey as string[]}
            selectedId={selectedList?.id ?? null}
            editingId={editingId}
            listSort={listSort}
            onSelect={handleSelect}
            onEdit={id => { setSelectedId(id); setEditingId(id); }}
            onDelete={id => deleteMutation.mutate(id)}
            onSortToggle={() => setListSort(s => s === "recent" ? "asc" : s === "asc" ? "desc" : "recent")}
            onEditDone={() => setEditingId(null)}
            onCreate={(name, emoji) => createMutation.mutate({ name, emoji: emoji || null, createdAt: Date.now() })}
          />
        ) : (
          <LinksPanel list={selectedList} onBack={handleBack} />
        )}
      </div>

      {/* ── Desktop layout: two-panel ── */}
      <div
        className="hidden md:flex gap-4"
        style={{ height: "calc(100vh - 14rem)", minHeight: "400px" }}
      >
        {/* Left sidebar */}
        <div className="w-60 flex-shrink-0 flex flex-col">
          <ListsSidebar
            lists={lists}
            listsLoading={listsLoading}
            listsKey={listsKey as string[]}
            selectedId={selectedList?.id ?? null}
            editingId={editingId}
            listSort={listSort}
            onSelect={id => setSelectedId(id)}
            onEdit={id => { setSelectedId(id); setEditingId(id); }}
            onDelete={id => deleteMutation.mutate(id)}
            onSortToggle={() => setListSort(s => s === "recent" ? "asc" : s === "asc" ? "desc" : "recent")}
            onEditDone={() => setEditingId(null)}
            onCreate={(name, emoji) => createMutation.mutate({ name, emoji: emoji || null, createdAt: Date.now() })}
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-border flex-shrink-0" />

        {/* Right panel */}
        <div className="flex-1 min-w-0">
          {selectedList ? (
            <LinksPanel list={selectedList} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}18` }}>
                <Link2 size={24} style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Create a list to get started</p>
              <p className="text-xs max-w-[220px]">
                Organise links into named lists — date night spots, recipes, travel ideas, anything.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
