/**
 * LinkList — Together's shared link board.
 *
 * Two-panel layout:
 *   Left  — named lists (create / delete). Each list has a name + optional emoji.
 *   Right — links inside the selected list (add URL+title, open, delete).
 *
 * API:
 *   GET    /api/link-lists                       → LinkList[]
 *   POST   /api/link-lists                       ← { name, emoji }
 *   DELETE /api/link-lists/:listId               (cascades links)
 *   GET    /api/link-lists/:listId/links         → Link[]
 *   POST   /api/link-lists/:listId/links         ← { url, title, addedBy? }
 *   DELETE /api/links/:id
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, API_BASE } from "@/lib/queryClient";
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

// ── Link row ──────────────────────────────────────────────────────────────────

function LinkRow({ link, onDelete }: { link: Link; onDelete: (id: number) => void }) {
  const [faviconError, setFaviconError] = useState(false);
  const href = ensureHttps(link.url);

  return (
    <div
      data-testid={`row-link-${link.id}`}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card
        hover:border-[hsl(20_90%_60%/0.35)] hover:bg-secondary/30 transition-all duration-150"
    >
      {/* Favicon */}
      <div className="w-6 h-6 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center bg-secondary">
        {link.favicon && !faviconError ? (
          <img
            src={link.favicon}
            alt=""
            className="w-5 h-5 object-contain"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <Link2 size={11} className="text-muted-foreground" />
        )}
      </div>

      {/* Title + host */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{link.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{prettyHost(link.url)}</p>
      </div>

      {/* AddedBy badge */}
      {link.addedBy && (
        <span
          className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{
            background: link.addedBy === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
            color: link.addedBy === "jack" ? JACK_BLUE : SALLY_PINK,
          }}
        >
          {link.addedBy}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`button-link-open-${link.id}`}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground
            hover:bg-secondary hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Open link"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={13} />
        </a>
        <button
          data-testid={`button-link-delete-${link.id}`}
          onClick={() => onDelete(link.id)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground
            hover:bg-destructive/15 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete link"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Right panel: links for a selected list ────────────────────────────────────

function LinksPanel({ list }: { list: LinkListType }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [addedBy, setAddedBy] = useState<"jack" | "sally" | "">("");

  const linksKey = ["/api/link-lists", list.id, "links"];

  const { data: links = [], isLoading } = useQuery<Link[]>({
    queryKey: linksKey,
    queryFn: () => fetch(`${API_BASE}/api/link-lists/${list.id}/links`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", `/api/link-lists/${list.id}/links`, body),
    onSuccess: async (res) => {
      const created: Link = await res.json();
      qc.setQueryData(linksKey, (old: Link[] = []) => [created, ...old]);
      setUrl("");
      setTitle("");
      setAddedBy("");
      toast({ title: "Link added" });
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/links/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(linksKey, (old: Link[] = []) => old.filter(l => l.id !== id));
      toast({ title: "Link removed" });
    },
  });

  function handleAdd() {
    const trimUrl = url.trim();
    const trimTitle = title.trim();
    if (!trimUrl || !trimTitle) return;
    addMutation.mutate({
      url: ensureHttps(trimUrl),
      title: trimTitle,
      addedBy: addedBy || null,
      favicon: trimUrl ? `https://www.google.com/s2/favicons?sz=64&domain=${ensureHttps(trimUrl)}` : null,
    });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{list.emoji ?? "🔗"}</span>
        <h3 className="font-bold text-foreground text-sm">{list.name}</h3>
        {links.length > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}22`, color: ACCENT }}>
            {links.length}
          </span>
        )}
      </div>

      {/* Add link form */}
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-secondary/30">
        <Input
          data-testid="input-link-url"
          placeholder="https://example.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <div className="flex gap-2">
          <Input
            data-testid="input-link-title"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-8 text-sm flex-1"
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          {/* Who added it */}
          <div className="flex gap-1 flex-shrink-0">
            {(["jack", "sally"] as const).map(who => (
              <button
                key={who}
                data-testid={`button-addedby-${who}`}
                type="button"
                onClick={() => setAddedBy(addedBy === who ? "" : who)}
                className="px-2.5 h-8 rounded-md text-xs font-semibold border transition-all capitalize"
                style={
                  addedBy === who
                    ? {
                        background: who === "jack" ? `${JACK_BLUE}22` : `${SALLY_PINK}22`,
                        borderColor: who === "jack" ? JACK_BLUE : SALLY_PINK,
                        color: who === "jack" ? JACK_BLUE : SALLY_PINK,
                      }
                    : {}
                }
              >
                {who}
              </button>
            ))}
          </div>
          <Button
            data-testid="button-link-add"
            onClick={handleAdd}
            disabled={!url.trim() || !title.trim() || addMutation.isPending}
            className="h-8 px-3 text-xs"
            style={{ background: ACCENT, color: "white" }}
          >
            <Plus size={13} />
          </Button>
        </div>
      </div>

      {/* Links list */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl skeleton" />
        ))}

        {!isLoading && links.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-muted-foreground">
            <Link2 size={22} style={{ color: ACCENT, opacity: 0.5 }} />
            <p className="text-sm">No links yet — add the first one above.</p>
          </div>
        )}

        {!isLoading && links.map(link => (
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function LinkList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Create-list form state
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  const listsKey = ["/api/link-lists"];

  const { data: lists = [], isLoading: listsLoading } = useQuery<LinkListType[]>({
    queryKey: listsKey,
    queryFn: () => fetch(`${API_BASE}/api/link-lists`).then(r => r.json()),
  });

  // Auto-select first list
  const selectedList = lists.find(l => l.id === selectedId) ?? lists[0] ?? null;

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/link-lists", body),
    onSuccess: async (res) => {
      const created: LinkListType = await res.json();
      qc.setQueryData(listsKey, (old: LinkListType[] = []) => [...old, created]);
      setSelectedId(created.id);
      setNewName("");
      setNewEmoji("");
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

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate({ name, emoji: newEmoji.trim() || null, createdAt: Date.now() });
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)] min-h-[400px]">
      {/* ── Left: lists sidebar ── */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-3">
        {/* Create list form */}
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-secondary/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New list</p>
          <div className="flex gap-1.5">
            <Input
              data-testid="input-list-emoji"
              placeholder="🔗"
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              className="h-8 w-12 text-center text-sm px-1"
              maxLength={2}
            />
            <Input
              data-testid="input-list-name"
              placeholder="List name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button
            data-testid="button-create-list"
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            className="h-7 text-xs w-full"
            style={{ background: ACCENT, color: "white" }}
          >
            <Plus size={12} className="mr-1" />
            Create
          </Button>
        </div>

        {/* Lists */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {listsLoading && [1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-xl skeleton" />
          ))}

          {!listsLoading && lists.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center text-muted-foreground">
              <FolderOpen size={20} style={{ opacity: 0.4 }} />
              <p className="text-xs">No lists yet</p>
            </div>
          )}

          {!listsLoading && lists.map(list => {
            const active = list.id === (selectedList?.id ?? null);
            return (
              <div
                key={list.id}
                data-testid={`button-list-${list.id}`}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150"
                style={
                  active
                    ? { background: `${ACCENT}22`, border: `1px solid ${ACCENT}55` }
                    : { border: "1px solid transparent" }
                }
                onClick={() => setSelectedId(list.id)}
              >
                <span className="text-base leading-none flex-shrink-0">{list.emoji ?? "🔗"}</span>
                <span
                  className="flex-1 text-sm font-semibold truncate"
                  style={active ? { color: ACCENT } : {}}
                >
                  {list.name}
                </span>
                {active && <ChevronRight size={12} style={{ color: ACCENT, opacity: 0.7 }} />}
                <button
                  data-testid={`button-delete-list-${list.id}`}
                  onClick={e => { e.stopPropagation(); deleteMutation.mutate(list.id); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground
                    hover:bg-destructive/15 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  aria-label="Delete list"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-border flex-shrink-0" />

      {/* ── Right: links panel ── */}
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
  );
}
