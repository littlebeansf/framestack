import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Profile, Item, Collection } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Edit3, Check, X, Star, Zap, BookOpen, Tv, Film, ScrollText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";


const EMOJI_OPTIONS = [
  "🐻","🌸","🫶","🌙","⚡","🔥","🌊","🍄","🐉","🦋",
  "🎭","🌺","🦊","🐺","🐙","🌹","💀","🎪","🤖","🐸",
  "🎯","🍒","🦄","🐋","🌵","🏔️","🎸","🌟","🍜","🦑",
];

const COLOR_PRESETS = [
  { label: "Violet", accent: "hsl(255 70% 65%)", banner: "hsl(260 50% 12%)" },
  { label: "Blue", accent: "hsl(220 80% 60%)", banner: "hsl(225 60% 10%)" },
  { label: "Pink", accent: "hsl(330 75% 65%)", banner: "hsl(315 50% 10%)" },
  { label: "Orange", accent: "hsl(20 90% 60%)", banner: "hsl(25 60% 10%)" },
  { label: "Teal", accent: "hsl(180 65% 52%)", banner: "hsl(185 55% 9%)" },
  { label: "Red", accent: "hsl(0 72% 60%)", banner: "hsl(0 55% 10%)" },
  { label: "Gold", accent: "hsl(45 90% 56%)", banner: "hsl(40 60% 9%)" },
  { label: "Lime", accent: "hsl(85 70% 52%)", banner: "hsl(90 55% 8%)" },
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  anime: <Tv size={11} />,
  manga: <ScrollText size={11} />,
  movie: <Film size={11} />,
  series: <Tv size={11} />,
  book: <BookOpen size={11} />,
};
const TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book",
};

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur p-4 text-center space-y-1 hover:bg-white/8 transition-all">
      <p className="text-2xl font-extrabold" style={{ color }} data-testid={`stat-${label}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">{label}</p>
    </div>
  );
}

function EditProfileDialog({
  open, onOpenChange, profile, owner
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  profile: Profile; owner: string;
}) {
  const [form, setForm] = useState({
    displayName: profile.displayName,
    bio: profile.bio ?? "",
    avatarEmoji: profile.avatarEmoji ?? "🐻",
    accentColor: profile.accentColor ?? "hsl(255 70% 65%)",
    bannerColor: profile.bannerColor ?? "hsl(230 50% 12%)",
    catchphrase: profile.catchphrase ?? "",
    favoriteGenre: profile.favoriteGenre ?? "",
    currentlyObsessedWith: profile.currentlyObsessedWith ?? "",
    customStat1Label: profile.customStat1Label ?? "",
    customStat1Value: profile.customStat1Value ?? "",
    customStat2Label: profile.customStat2Label ?? "",
    customStat2Value: profile.customStat2Value ?? "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/profiles/${owner}`, form);
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/profiles", owner], data);
      toast({ title: "Profile updated ✨" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  function f(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{form.avatarEmoji}</span>
            Customise profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Avatar emoji */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => f("avatarEmoji", e)}
                  className={cn(
                    "w-9 h-9 rounded-xl text-lg transition-all border",
                    form.avatarEmoji === e
                      ? "bg-primary/20 border-primary scale-110"
                      : "border-border hover:bg-secondary hover:scale-105"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color preset */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Colour theme</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => { f("accentColor", p.accent); f("bannerColor", p.banner); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    form.accentColor === p.accent
                      ? "border-white/30 text-white scale-105"
                      : "border-border text-muted-foreground hover:scale-105"
                  )}
                  style={{ background: form.accentColor === p.accent ? p.accent : "transparent" }}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.accent }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Basic fields */}
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Display name</label>
              <Input value={form.displayName} onChange={e => f("displayName", e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Catchphrase</label>
              <Input value={form.catchphrase} onChange={e => f("catchphrase", e.target.value)} placeholder="Your iconic one-liner…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Bio</label>
              <Textarea value={form.bio} onChange={e => f("bio", e.target.value)} rows={3} className="resize-none" placeholder="Who are you, really?" />
            </div>
          </div>

          {/* Obsession fields */}
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Favourite genre</label>
              <Input value={form.favoriteGenre} onChange={e => f("favoriteGenre", e.target.value)} placeholder="e.g. Psychological horror" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Currently obsessed with</label>
              <Input value={form.currentlyObsessedWith} onChange={e => f("currentlyObsessedWith", e.target.value)} placeholder="e.g. Berserk (again)" />
            </div>
          </div>

          {/* Custom stats */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Custom stats (2 wild facts)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Input value={form.customStat1Label} onChange={e => f("customStat1Label", e.target.value)} placeholder="Label (e.g. Cries/week)" className="text-xs" />
                <Input value={form.customStat1Value} onChange={e => f("customStat1Value", e.target.value)} placeholder="Value (e.g. 7)" className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Input value={form.customStat2Label} onChange={e => f("customStat2Label", e.target.value)} placeholder="Label (e.g. Dropped shows)" className="text-xs" />
                <Input value={form.customStat2Value} onChange={e => f("customStat2Value", e.target.value)} placeholder="Value (e.g. 0 (a lie))" className="text-xs" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OwnerProfilePage({ owner }: { owner: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", owner],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/profiles/${owner}`, undefined);
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: allItems } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const { data: collections } = useQuery<Collection[]>({
    queryKey: ["/api/collections", owner],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/collections?owner=${owner}`, undefined);
      return res.json();
    },
    staleTime: 30_000,
  });

  if (profileLoading || !profile) {
    return (
      <div className="animate-page-in space-y-4">
        <div className="h-40 skeleton rounded-2xl" />
        <div className="h-6 skeleton rounded w-1/3" />
        <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}</div>
      </div>
    );
  }

  const accent = profile.accentColor || "hsl(255 70% 65%)";
  const banner = profile.bannerColor || "hsl(230 50% 12%)";

  const items = allItems || [];
  const total = items.length;
  const completed = items.filter(i => i.status === "completed").length;
  const collectionCount = (collections || []).length;

  const byType = ["anime", "manga", "movie", "series", "book"].map(t => ({
    type: t, count: items.filter(i => i.mediaType === t).length,
  })).filter(x => x.count > 0);

  return (
    <div className="max-w-2xl animate-page-in space-y-6">
      {/* ── Banner + Avatar ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ minHeight: 180 }}>
        {/* Banner */}
        <div
          className="absolute inset-0 banner-animated"
          style={{
            background: `linear-gradient(135deg, ${banner}, ${accent}44, ${banner} 70%)`,
          }}
        />
        {/* Decorative blobs */}
        <div className="absolute -top-6 -right-6 w-32 h-32 blob opacity-20" style={{ background: accent }} />
        <div className="absolute bottom-0 left-8 w-20 h-20 blob opacity-15" style={{ background: accent, animationDelay: "3s" }} />

        {/* Content */}
        <div className="relative z-10 p-6 flex items-end gap-5 pt-12">
          {/* Avatar — heartbeat on hover */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-xl border-2 border-white/10 shrink-0 cursor-default select-none emoji-pop"
            style={{ background: banner, boxShadow: `0 0 30px ${accent}66` }}
          >
            {profile.avatarEmoji || "🐻"}
          </div>

          {/* Name + catchphrase */}
          <div className="flex-1 min-w-0 pb-1">
            <h1
              className="text-2xl font-extrabold text-white leading-tight"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif", textShadow: `0 0 20px ${accent}88` }}
            >
              {profile.displayName}
            </h1>
            {profile.catchphrase && (
              <p className="text-sm text-white/60 italic mt-0.5">&ldquo;{profile.catchphrase}&rdquo;</p>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            data-testid="button-edit-profile"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/80 border border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm"
          >
            <Edit3 size={11} />
            Edit
          </button>
        </div>
      </div>

      {/* Bio + obsession */}
      {(profile.bio || profile.currentlyObsessedWith || profile.favoriteGenre) && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          {profile.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {profile.favoriteGenre && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground">
                <Star size={9} style={{ color: accent }} />
                {profile.favoriteGenre}
              </span>
            )}
            {profile.currentlyObsessedWith && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground">
                <Zap size={9} style={{ color: accent }} />
                Obsessing over: <span className="text-foreground font-semibold">{profile.currentlyObsessedWith}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: `linear-gradient(135deg, ${banner}cc, ${accent}11)`, border: `1px solid ${accent}30` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          <Sparkles size={9} className="inline mr-1" />Stats
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={total} label="In library" color={accent} />
          <StatCard value={completed} label="Completed" color={accent} />
          <StatCard value={collectionCount} label="Collections" color={accent} />
        </div>

        {/* Custom stats */}
        {(profile.customStat1Label || profile.customStat2Label) && (
          <div className="grid grid-cols-2 gap-3">
            {profile.customStat1Label && profile.customStat1Value && (
              <StatCard value={profile.customStat1Value} label={profile.customStat1Label} color={accent} />
            )}
            {profile.customStat2Label && profile.customStat2Value && (
              <StatCard value={profile.customStat2Value} label={profile.customStat2Label} color={accent} />
            )}
          </div>
        )}
      </div>

      {/* ── Library breakdown ── */}
      {byType.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <BarChart3 size={11} />
            Shared library breakdown
          </p>
          {byType.map(({ type, count }) => (
            <div key={type} className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground w-16 shrink-0">
                {TYPE_ICONS[type]}
                {TYPE_LABELS[type]}
              </span>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: accent }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-5 text-right font-mono">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editOpen && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={profile}
          owner={owner}
        />
      )}
    </div>
  );
}
