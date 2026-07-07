import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Profile, Item, Collection } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart3, Edit3, Star, Zap, BookOpen, Tv, Film, ScrollText, Sparkles,
  Music, BookMarked, Flame, X, Plus, Mic2, Check, ChevronDown, ChevronUp,
  ExternalLink, Palette, Image as ImageIcon, Wand2, Tag, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  "🐻","🌸","🫶","🌙","⚡","🔥","🌊","🍄","🐉","🦋",
  "🎭","🌺","🦊","🐺","🐙","🌹","💀","🎪","🤖","🐸",
  "🎯","🍒","🦄","🐋","🌵","🏔️","🎸","🌟","🍜","🦑",
  "🐈","🧿","🫧","🪩","🕯️","🐝","🦇","🌈","🪐","💫",
];

const COLOR_PRESETS = [
  { label: "Violet",    accent: "hsl(255 70% 65%)",  banner: "hsl(260 50% 12%)" },
  { label: "Blue",      accent: "hsl(220 80% 60%)",  banner: "hsl(225 60% 10%)" },
  { label: "Pink",      accent: "hsl(330 75% 65%)",  banner: "hsl(315 50% 10%)" },
  { label: "Orange",    accent: "hsl(20 90% 60%)",   banner: "hsl(25 60% 10%)"  },
  { label: "Teal",      accent: "hsl(180 65% 52%)",  banner: "hsl(185 55% 9%)"  },
  { label: "Red",       accent: "hsl(0 72% 60%)",    banner: "hsl(0 55% 10%)"   },
  { label: "Gold",      accent: "hsl(45 90% 56%)",   banner: "hsl(40 60% 9%)"   },
  { label: "Lime",      accent: "hsl(85 70% 52%)",   banner: "hsl(90 55% 8%)"   },
  { label: "Crimson",   accent: "hsl(348 80% 58%)",  banner: "hsl(345 55% 9%)"  },
  { label: "Cyan",      accent: "hsl(195 90% 50%)",  banner: "hsl(200 70% 8%)"  },
  { label: "Amber",     accent: "hsl(35 95% 55%)",   banner: "hsl(32 65% 8%)"   },
  { label: "Lavender",  accent: "hsl(280 65% 68%)",  banner: "hsl(275 45% 11%)" },
];

const BG_STYLES: Array<{ id: string; label: string; preview: string }> = [
  { id: "aurora",  label: "Aurora",  preview: "from-purple-900 via-pink-900 to-indigo-900" },
  { id: "waves",   label: "Waves",   preview: "from-blue-900 via-cyan-800 to-teal-900" },
  { id: "ember",   label: "Ember",   preview: "from-red-950 via-orange-900 to-yellow-900" },
  { id: "forest",  label: "Forest",  preview: "from-green-950 via-emerald-900 to-lime-950" },
  { id: "midnight",label: "Midnight",preview: "from-slate-950 via-indigo-950 to-slate-900" },
  { id: "rose",    label: "Rose",    preview: "from-rose-950 via-pink-900 to-fuchsia-950" },
  { id: "cosmic",  label: "Cosmic",  preview: "from-violet-950 via-purple-900 to-black" },
  { id: "solid",   label: "Solid",   preview: "from-gray-900 to-gray-900" },
  { id: "custom",  label: "Custom",  preview: "" },
];

const VIBE_PRESETS = [
  "night owl", "weeb", "bookworm", "cinephile", "audiophile",
  "crybaby", "dropout arc", "main character", "npc energy", "lore enjoyer",
  "hyperfixation mode", "chronically online", "skip intro hater", "3am thoughts",
  "plot armour", "1-star hospitality", "emotional damage", "certified binge-watcher",
];

const MEDIA_TYPE_ICONS: Record<string, React.ReactNode> = {
  anime: <Star size={10} />,
  manga: <ScrollText size={10} />,
  movie: <Film size={10} />,
  series: <Tv size={10} />,
  book: <BookOpen size={10} />,
  podcast: <Mic2 size={10} />,
};
const MEDIA_TYPE_LABELS: Record<string, string> = {
  anime: "Anime", manga: "Manga", movie: "Movie", series: "Series", book: "Book", podcast: "Podcast",
};

// ── Background CSS generators ─────────────────────────────────────────────────

function getBannerBg(bgStyle: string, bgCustom: string, accent: string, banner: string): string {
  switch (bgStyle) {
    case "aurora":
      return `linear-gradient(135deg, #1a0533 0%, #0d1f4a 30%, #0a2a1a 60%, #2d0a3a 100%)`;
    case "waves":
      return `linear-gradient(160deg, #020b18 0%, #051e3e 40%, #0a3352 70%, #041224 100%)`;
    case "ember":
      return `linear-gradient(135deg, #1a0000 0%, #3d0f00 40%, #5c1a00 70%, #1a0000 100%)`;
    case "forest":
      return `linear-gradient(135deg, #020d05 0%, #0a2210 40%, #0d3314 70%, #020d05 100%)`;
    case "midnight":
      return `linear-gradient(135deg, #020408 0%, #080d1a 40%, #0d1129 70%, #020408 100%)`;
    case "rose":
      return `linear-gradient(135deg, #1a0010 0%, #3d0a2a 40%, #2a0535 70%, #1a0010 100%)`;
    case "cosmic":
      return `linear-gradient(135deg, #0d0020 0%, #1a0040 40%, #0a0028 70%, #050010 100%)`;
    case "custom":
      return bgCustom || `linear-gradient(135deg, ${banner}, ${accent}22)`;
    default: // solid or fallback
      return `linear-gradient(135deg, ${banner}, ${accent}22, ${banner} 80%)`;
  }
}

function getAnimationClass(bgStyle: string): string {
  switch (bgStyle) {
    case "aurora":  return "banner-aurora";
    case "waves":   return "banner-waves";
    case "ember":   return "banner-ember";
    case "cosmic":  return "banner-cosmic";
    default:        return "banner-animated";
  }
}

// ── Animated background overlays ──────────────────────────────────────────────

function StarfieldOverlay({ accent }: { accent: string }) {
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.8 + 0.4,
      delay: Math.random() * 4,
      dur: Math.random() * 3 + 2,
    })), []);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.5 }}>
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={`${s.x}%`} cy={`${s.y}%`} r={s.r}
          fill="white"
          style={{
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite alternate`,
            opacity: 0.6,
          }}
        />
      ))}
    </svg>
  );
}

function AuroraOverlay({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="aurora-blob-1 absolute" style={{ background: `${accent}55` }} />
      <div className="aurora-blob-2 absolute" style={{ background: `${accent}33` }} />
      <div className="aurora-blob-3 absolute" style={{ background: `${accent}22` }} />
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, color, icon }: { value: string | number; label: string; color: string; icon?: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur p-4 text-center space-y-1 hover:bg-white/10 transition-all group cursor-default"
      style={{ borderColor: `${color}20` }}
    >
      {icon && <div className="flex justify-center mb-1 opacity-60 group-hover:opacity-100 transition-opacity" style={{ color }}>{icon}</div>}
      <p className="text-2xl font-extrabold tracking-tight" style={{ color }} data-testid={`stat-${label}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</p>
    </div>
  );
}

// ── Vibe tags ─────────────────────────────────────────────────────────────────

function VibeTag({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
      style={{ background: `${accent}18`, borderColor: `${accent}40`, color: accent }}
    >
      {label}
    </span>
  );
}

// ── Top 3 picks card ──────────────────────────────────────────────────────────

interface Top3Item { title: string; type: string; emoji: string }

function Top3Card({ items, accent }: { items: Top3Item[]; accent: string }) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ borderColor: `${accent}25`, background: `${accent}08` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
        <Heart size={10} /> All-time top 3
      </p>
      <div className="space-y-2">
        {[0, 1, 2].map(i => {
          const item = items[i];
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: `${accent}${i === 0 ? "40" : i === 1 ? "28" : "18"}`, color: accent }}
              >
                {i + 1}
              </span>
              {item ? (
                <>
                  <span className="text-lg leading-none">{item.emoji || "🎬"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90 truncate leading-tight">{item.title}</p>
                    <p className="text-[10px] text-white/40 capitalize">{MEDIA_TYPE_LABELS[item.type] || item.type}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-white/25 italic">empty slot</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Diary entry card ──────────────────────────────────────────────────────────

function DiaryCard({ text, accent }: { text: string; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200;
  const display = (!isLong || expanded) ? text : text.slice(0, 200) + "…";

  return (
    <div
      className="rounded-2xl border p-5 space-y-3 relative overflow-hidden"
      style={{ borderColor: `${accent}20`, background: "rgba(255,255,255,0.03)" }}
    >
      {/* Decorative corner */}
      <div className="absolute top-3 right-3 text-2xl opacity-20 select-none rotate-12">📖</div>
      <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
        <BookMarked size={10} /> Diary
      </p>
      <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap font-light"
        style={{ fontFamily: "'Satoshi', 'Cabinet Grotesk', sans-serif" }}>
        {display}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={{ color: accent }}
        >
          {expanded ? <><ChevronUp size={10} /> Show less</> : <><ChevronDown size={10} /> Read more</>}
        </button>
      )}
    </div>
  );
}

// ── Sealed opinion card ───────────────────────────────────────────────────────

function OpinionCard({ text, accent }: { text: string; accent: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className="rounded-2xl border p-5 space-y-3 relative overflow-hidden cursor-pointer group"
      style={{ borderColor: `${accent}25`, background: `${accent}06` }}
      onClick={() => setRevealed(!revealed)}
    >
      <div className="absolute top-2 right-3 text-xl opacity-20 select-none">🔥</div>
      <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
        <Flame size={10} /> Unpopular opinion
        <span className="ml-auto text-white/30 text-[9px] italic">{revealed ? "click to reseal" : "tap to reveal"}</span>
      </p>
      <div className="relative">
        <p
          className="text-sm text-white/80 leading-relaxed font-medium transition-all duration-500"
          style={{ filter: revealed ? "blur(0px)" : "blur(6px)", userSelect: revealed ? "text" : "none" }}
        >
          {text}
        </p>
        {!revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white/40 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
              🤐 sealed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Music card ────────────────────────────────────────────────────────────────

function MusicCard({ url, label, accent }: { url: string; label: string; accent: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border p-4 transition-all hover:scale-[1.02] active:scale-[0.98] group"
      style={{ borderColor: `${accent}25`, background: `${accent}08` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform"
        style={{ background: `${accent}22` }}
      >
        🎵
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accent }}>Currently listening</p>
        <p className="text-sm font-semibold text-white/85 truncate">{label || url}</p>
      </div>
      <ExternalLink size={13} className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
    </a>
  );
}

// ── Progress bar row ──────────────────────────────────────────────────────────

function BarRow({ type, count, total, accent }: { type: string; count: number; total: number; accent: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs text-white/50 w-20 shrink-0 font-medium">
        <span style={{ color: accent }}>{MEDIA_TYPE_ICONS[type]}</span>
        {MEDIA_TYPE_LABELS[type]}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
        />
      </div>
      <span className="text-xs text-white/40 w-5 text-right font-mono">{count}</span>
    </div>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

type FormState = {
  displayName: string; bio: string; avatarEmoji: string; avatarUrl: string;
  accentColor: string; bannerColor: string; catchphrase: string;
  favoriteGenre: string; currentlyObsessedWith: string;
  customStat1Label: string; customStat1Value: string;
  customStat2Label: string; customStat2Value: string;
  // New fields
  diaryEntry: string; unpopularOpinion: string;
  vibeTags: string;   // JSON array
  top3: string;       // JSON array
  bgStyle: string; bgCustom: string;
  profileMusicUrl: string; profileMusicLabel: string;
};

function EditProfileDialog({
  open, onOpenChange, profile, owner,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  profile: Profile; owner: string;
}) {
  const [form, setForm] = useState<FormState>({
    displayName: profile.displayName,
    bio: profile.bio ?? "",
    avatarEmoji: profile.avatarEmoji ?? "🐻",
    avatarUrl: (profile as any).avatarUrl ?? "",
    accentColor: profile.accentColor ?? "hsl(255 70% 65%)",
    bannerColor: profile.bannerColor ?? "hsl(230 50% 12%)",
    catchphrase: profile.catchphrase ?? "",
    favoriteGenre: profile.favoriteGenre ?? "",
    currentlyObsessedWith: profile.currentlyObsessedWith ?? "",
    customStat1Label: profile.customStat1Label ?? "",
    customStat1Value: profile.customStat1Value ?? "",
    customStat2Label: profile.customStat2Label ?? "",
    customStat2Value: profile.customStat2Value ?? "",
    diaryEntry: (profile as any).diaryEntry ?? "",
    unpopularOpinion: (profile as any).unpopularOpinion ?? "",
    vibeTags: (profile as any).vibeTags ?? "[]",
    top3: (profile as any).top3 ?? "[]",
    bgStyle: (profile as any).bgStyle ?? "solid",
    bgCustom: (profile as any).bgCustom ?? "",
    profileMusicUrl: (profile as any).profileMusicUrl ?? "",
    profileMusicLabel: (profile as any).profileMusicLabel ?? "",
  });

  const { toast } = useToast();
  const qc = useQueryClient();
  const [section, setSection] = useState<"identity" | "personality" | "diary" | "visual" | "top3">("identity");

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

  function f(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Vibe tags
  const vibeTags: string[] = useMemo(() => { try { return JSON.parse(form.vibeTags); } catch { return []; } }, [form.vibeTags]);
  function addTag(tag: string) {
    if (vibeTags.includes(tag) || vibeTags.length >= 12) return;
    f("vibeTags", JSON.stringify([...vibeTags, tag]));
  }
  function removeTag(tag: string) {
    f("vibeTags", JSON.stringify(vibeTags.filter(t => t !== tag)));
  }

  // Top 3
  const top3Items: Top3Item[] = useMemo(() => { try { const p = JSON.parse(form.top3); return Array.isArray(p) ? p : []; } catch { return []; } }, [form.top3]);
  function setTop3(i: number, field: keyof Top3Item, val: string) {
    const arr: Top3Item[] = [
      top3Items[0] ?? { title: "", type: "anime", emoji: "" },
      top3Items[1] ?? { title: "", type: "anime", emoji: "" },
      top3Items[2] ?? { title: "", type: "anime", emoji: "" },
    ];
    arr[i] = { ...arr[i], [field]: val };
    f("top3", JSON.stringify(arr));
  }

  const SECTIONS = [
    { id: "identity",    label: "Identity" },
    { id: "personality", label: "Vibe" },
    { id: "diary",       label: "Diary" },
    { id: "top3",        label: "Top 3" },
    { id: "visual",      label: "Visual" },
  ] as const;

  const accent = form.accentColor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-xl">{form.avatarEmoji}</span>
            Customise profile
          </DialogTitle>
        </DialogHeader>

        {/* Section tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-2 border-b border-border flex-wrap">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                section === s.id ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
              style={section === s.id ? { background: accent } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── IDENTITY ── */}
          {section === "identity" && (
            <>
              {/* Avatar */}
              <div>
                <label className="label-xs">Avatar emoji</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => f("avatarEmoji", e)}
                      className={cn(
                        "w-9 h-9 rounded-xl text-lg transition-all border",
                        form.avatarEmoji === e
                          ? "border-primary bg-primary/20 scale-110"
                          : "border-border hover:bg-secondary hover:scale-105"
                      )}
                    >{e}</button>
                  ))}
                </div>
              </div>

              {/* Avatar image URL */}
              <div>
                <label className="label-xs">Profile picture URL <span className="opacity-50">(overrides emoji)</span></label>
                <Input
                  value={form.avatarUrl}
                  onChange={e => f("avatarUrl", e.target.value)}
                  placeholder="https://… (jpg, png, gif)"
                  className="mt-1 text-sm"
                />
                {form.avatarUrl && (
                  <div className="mt-2 w-16 h-16 rounded-2xl overflow-hidden border border-border">
                    <img src={form.avatarUrl} alt="preview" className="w-full h-full object-cover" onError={e => (e.target as any).style.display = "none"} />
                  </div>
                )}
              </div>

              {/* Basic */}
              <div className="grid gap-3">
                <div>
                  <label className="label-xs">Display name</label>
                  <Input value={form.displayName} onChange={e => f("displayName", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="label-xs">Catchphrase</label>
                  <Input value={form.catchphrase} onChange={e => f("catchphrase", e.target.value)} placeholder="Your iconic one-liner…" className="mt-1" />
                </div>
                <div>
                  <label className="label-xs">Bio</label>
                  <Textarea value={form.bio} onChange={e => f("bio", e.target.value)} rows={3} className="resize-none mt-1" placeholder="Who are you, really?" />
                </div>
                <div>
                  <label className="label-xs">Favourite genre</label>
                  <Input value={form.favoriteGenre} onChange={e => f("favoriteGenre", e.target.value)} placeholder="e.g. Psychological horror" className="mt-1" />
                </div>
                <div>
                  <label className="label-xs">Currently obsessed with</label>
                  <Input value={form.currentlyObsessedWith} onChange={e => f("currentlyObsessedWith", e.target.value)} placeholder="e.g. Berserk (again)" className="mt-1" />
                </div>
              </div>

              {/* Music */}
              <div>
                <label className="label-xs">Currently listening <span className="opacity-50">(Spotify / YouTube link)</span></label>
                <div className="grid gap-2 mt-1">
                  <Input value={form.profileMusicUrl} onChange={e => f("profileMusicUrl", e.target.value)} placeholder="https://open.spotify.com/…" />
                  <Input value={form.profileMusicLabel} onChange={e => f("profileMusicLabel", e.target.value)} placeholder="Label e.g. 'Bladee — Icedancer'" />
                </div>
              </div>

              {/* Custom stats */}
              <div>
                <label className="label-xs">Wild custom stats</label>
                <div className="grid grid-cols-2 gap-3 mt-2">
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
            </>
          )}

          {/* ── PERSONALITY / VIBE ── */}
          {section === "personality" && (
            <>
              <div>
                <label className="label-xs">Vibe tags <span className="opacity-50">(max 12)</span></label>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">Click to add / remove. Or type your own below.</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {VIBE_PRESETS.map(t => {
                    const active = vibeTags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => active ? removeTag(t) : addTag(t)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                          active
                            ? "text-white border-transparent"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                        style={active ? { background: accent, borderColor: accent } : {}}
                      >
                        {active ? <><Check size={9} className="inline mr-1" />{t}</> : t}
                      </button>
                    );
                  })}
                </div>
                {/* Custom tag input */}
                <div className="flex gap-2">
                  <Input
                    id="custom-tag-input"
                    placeholder="Custom tag…"
                    className="text-xs h-8"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        addTag((e.target as HTMLInputElement).value.trim());
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => {
                      const el = document.getElementById("custom-tag-input") as HTMLInputElement;
                      if (el?.value.trim()) { addTag(el.value.trim()); el.value = ""; }
                    }}
                  >
                    <Plus size={12} />
                  </Button>
                </div>
                {vibeTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                    {vibeTags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
                      >
                        {t}
                        <button onClick={() => removeTag(t)} className="hover:opacity-70"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label-xs">Unpopular opinion 🔥 <span className="opacity-50">(revealed on tap)</span></label>
                <Textarea
                  value={form.unpopularOpinion}
                  onChange={e => f("unpopularOpinion", e.target.value)}
                  rows={3}
                  className="resize-none mt-1 text-sm"
                  placeholder="Chainsaw Man is overrated. There, I said it."
                />
              </div>
            </>
          )}

          {/* ── DIARY ── */}
          {section === "diary" && (
            <div>
              <label className="label-xs">Diary entry</label>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">Shown as a personal journal entry on your profile. Can be long!</p>
              <Textarea
                value={form.diaryEntry}
                onChange={e => f("diaryEntry", e.target.value)}
                rows={10}
                className="resize-none text-sm font-light leading-relaxed"
                placeholder={"Today I finished Re:Zero season 3 and I'm not okay.\n\nThe way Subaru just—\n\n(3000 words of feelings follow)"}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{form.diaryEntry.length} chars</p>
            </div>
          )}

          {/* ── TOP 3 ── */}
          {section === "top3" && (
            <div className="space-y-4">
              <p className="text-[10px] text-muted-foreground">Pin your all-time top 3 — any media type.</p>
              {[0, 1, 2].map(i => {
                const item = top3Items[i] ?? { title: "", type: "anime", emoji: "" };
                return (
                  <div key={i} className="space-y-2 p-3 rounded-xl border border-border bg-secondary/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</p>
                    <div className="grid grid-cols-[2fr_1fr_2rem] gap-2">
                      <Input
                        value={item.title}
                        onChange={e => setTop3(i, "title", e.target.value)}
                        placeholder="Title"
                        className="text-sm h-9"
                      />
                      <select
                        value={item.type}
                        onChange={e => setTop3(i, "type", e.target.value)}
                        className="rounded-lg border border-border bg-background text-xs px-2 h-9"
                      >
                        {Object.keys(MEDIA_TYPE_LABELS).map(t => (
                          <option key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <Input
                        value={item.emoji}
                        onChange={e => setTop3(i, "emoji", e.target.value)}
                        placeholder="🎬"
                        className="text-center px-0 h-9 text-base"
                        maxLength={4}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VISUAL ── */}
          {section === "visual" && (
            <>
              {/* Colour theme */}
              <div>
                <label className="label-xs">Accent colour</label>
                <div className="flex flex-wrap gap-2 mt-2">
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
                      style={form.accentColor === p.accent ? { background: p.accent } : {}}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.accent }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background style */}
              <div>
                <label className="label-xs">Banner background</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {BG_STYLES.map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => f("bgStyle", bg.id)}
                      className={cn(
                        "rounded-xl overflow-hidden border-2 transition-all h-12 relative",
                        form.bgStyle === bg.id ? "border-white/60 scale-105" : "border-transparent hover:border-white/20"
                      )}
                    >
                      {bg.id === "custom" ? (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <Wand2 size={16} className="text-muted-foreground" />
                        </div>
                      ) : (
                        <div className={cn("w-full h-full bg-gradient-to-br", bg.preview)} />
                      )}
                      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] text-white/80 font-bold">
                        {bg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom gradient */}
              {form.bgStyle === "custom" && (
                <div>
                  <label className="label-xs">Custom CSS gradient</label>
                  <Input
                    value={form.bgCustom}
                    onChange={e => f("bgCustom", e.target.value)}
                    placeholder="linear-gradient(135deg, #1a0533, #0d1f4a)"
                    className="mt-1 text-xs font-mono"
                  />
                  {form.bgCustom && (
                    <div className="mt-2 h-12 rounded-xl" style={{ background: form.bgCustom }} />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} style={{ background: accent }}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main profile page ─────────────────────────────────────────────────────────

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

  const { data: allItems } = useQuery<Item[]>({ queryKey: ["/api/items"], staleTime: 30_000 });
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
        <div className="h-56 skeleton rounded-3xl" />
        <div className="h-6 skeleton rounded w-1/3" />
        <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}</div>
      </div>
    );
  }

  const accent = profile.accentColor || "hsl(255 70% 65%)";
  const banner = profile.bannerColor || "hsl(230 50% 12%)";
  const bgStyle = (profile as any).bgStyle || "solid";
  const bgCustom = (profile as any).bgCustom || "";
  const avatarUrl = (profile as any).avatarUrl || "";
  const diaryEntry = (profile as any).diaryEntry || "";
  const unpopularOpinion = (profile as any).unpopularOpinion || "";
  const profileMusicUrl = (profile as any).profileMusicUrl || "";
  const profileMusicLabel = (profile as any).profileMusicLabel || "";

  const vibeTags: string[] = useMemo(() => {
    try { const p = JSON.parse((profile as any).vibeTags ?? "[]"); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [(profile as any).vibeTags]);

  const top3Items: Top3Item[] = useMemo(() => {
    try { const p = JSON.parse((profile as any).top3 ?? "[]"); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [(profile as any).top3]);

  const items = allItems || [];
  const ownerItems = items.filter(i => (i as any).addedBy === owner || owner === "together" || !owner);
  const libraryItems = items; // shared library

  const total = libraryItems.length;
  const completed = libraryItems.filter(i => i.status === "completed").length;
  const collectionCount = (collections || []).length;
  const dropped = libraryItems.filter(i => i.status === "dropped").length;

  const byType = ["anime", "manga", "movie", "series", "book", "podcast"]
    .map(t => ({ type: t, count: libraryItems.filter(i => i.mediaType === t).length }))
    .filter(x => x.count > 0);

  const bannerBg = getBannerBg(bgStyle, bgCustom, accent, banner);
  const animClass = getAnimationClass(bgStyle);
  const isAurora = bgStyle === "aurora" || bgStyle === "cosmic";

  return (
    <div className="max-w-2xl animate-page-in space-y-5">

      {/* ── Hero banner ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ minHeight: 220 }}>
        {/* BG */}
        <div className={cn("absolute inset-0", animClass)} style={{ background: bannerBg }} />

        {/* Overlays */}
        <StarfieldOverlay accent={accent} />
        {isAurora && <AuroraOverlay accent={accent} />}

        {/* Floating blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 blob opacity-15" style={{ background: accent }} />
        <div className="absolute bottom-0 left-4 w-24 h-24 blob opacity-10" style={{ background: accent, animationDelay: "3s" }} />
        <div className="absolute top-4 left-1/2 w-16 h-16 blob opacity-8" style={{ background: accent, animationDelay: "6s" }} />

        {/* Content */}
        <div className="relative z-10 p-6 pt-8 flex flex-col sm:flex-row items-start sm:items-end gap-5">

          {/* Avatar */}
          <div
            className="w-24 h-24 rounded-2xl shrink-0 overflow-hidden border-2 shadow-2xl emoji-pop cursor-default select-none flex items-center justify-center"
            style={{ borderColor: `${accent}55`, boxShadow: `0 0 40px ${accent}55`, background: banner }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = "none"; }} />
            ) : (
              <span className="text-5xl leading-none">{profile.avatarEmoji || "🐻"}</span>
            )}
          </div>

          {/* Name area */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-3xl font-extrabold text-white leading-tight"
              style={{
                fontFamily: "'Cabinet Grotesk', sans-serif",
                textShadow: `0 0 30px ${accent}99, 0 2px 4px #0006`,
              }}
            >
              {profile.displayName}
            </h1>
            {profile.catchphrase && (
              <p className="text-sm text-white/55 italic mt-1">
                &ldquo;{profile.catchphrase}&rdquo;
              </p>
            )}
            {/* Vibe tags inline */}
            {vibeTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {vibeTags.slice(0, 6).map(t => (
                  <span
                    key={t}
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ background: `${accent}22`, borderColor: `${accent}44`, color: accent }}
                  >
                    {t}
                  </span>
                ))}
                {vibeTags.length > 6 && (
                  <span className="text-[10px] text-white/30 self-center">+{vibeTags.length - 6} more</span>
                )}
              </div>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            data-testid="button-edit-profile"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/80 border border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm self-start"
          >
            <Edit3 size={11} /> Edit
          </button>
        </div>

        {/* Bio strip at bottom */}
        {profile.bio && (
          <div className="relative z-10 px-6 pb-5">
            <p className="text-sm text-white/60 leading-relaxed max-w-md">{profile.bio}</p>
          </div>
        )}
      </div>

      {/* ── Quick obsession pills ── */}
      {(profile.favoriteGenre || profile.currentlyObsessedWith) && (
        <div className="flex flex-wrap gap-2">
          {profile.favoriteGenre && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground font-medium">
              <Star size={10} style={{ color: accent }} /> {profile.favoriteGenre}
            </span>
          )}
          {profile.currentlyObsessedWith && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-foreground font-semibold">
              <Zap size={10} style={{ color: accent }} /> Obsessing: {profile.currentlyObsessedWith}
            </span>
          )}
        </div>
      )}

      {/* ── Music ── */}
      {profileMusicUrl && (
        <MusicCard url={profileMusicUrl} label={profileMusicLabel} accent={accent} />
      )}

      {/* ── Stats grid ── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: `linear-gradient(135deg, ${banner}cc, ${accent}0d)`, border: `1px solid ${accent}25` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
          <Sparkles size={9} /> Stats
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={total} label="In library" color={accent} icon={<BookOpen size={14} />} />
          <StatCard value={completed} label="Completed" color={accent} icon={<Check size={14} />} />
          <StatCard value={collectionCount} label="Collections" color={accent} icon={<Sparkles size={14} />} />
          <StatCard value={dropped} label="Dropped" color={accent} icon={<Flame size={14} />} />
        </div>

        {/* Custom stats */}
        {(profile.customStat1Label || profile.customStat2Label) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
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
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${accent}15` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
            <BarChart3 size={10} /> Library breakdown
          </p>
          {byType.map(({ type, count }) => (
            <BarRow key={type} type={type} count={count} total={total} accent={accent} />
          ))}
        </div>
      )}

      {/* ── Two-column: Top 3 + diary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {top3Items.filter(t => t.title).length > 0 && (
          <Top3Card items={top3Items} accent={accent} />
        )}
        {diaryEntry && (
          <DiaryCard text={diaryEntry} accent={accent} />
        )}
      </div>

      {/* ── All vibe tags ── */}
      {vibeTags.length > 6 && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ borderColor: `${accent}20`, background: `${accent}06` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
            <Tag size={10} className="inline mr-1" /> Vibe
          </p>
          <div className="flex flex-wrap gap-1.5">
            {vibeTags.map(t => <VibeTag key={t} label={t} accent={accent} />)}
          </div>
        </div>
      )}

      {/* ── Sealed opinion ── */}
      {unpopularOpinion && (
        <OpinionCard text={unpopularOpinion} accent={accent} />
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
