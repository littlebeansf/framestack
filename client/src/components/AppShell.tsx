import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { navHistory } from "@/lib/navHistory";
import { getAuthToken } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Library, Search, Menu, Sun, Moon, Sparkles, Download } from "lucide-react";
import SearchDialog from "@/components/SearchDialog";
import type { Profile } from "@shared/schema";

// Default emojis — used until profile data loads
const DEFAULT_EMOJIS: Record<string, string> = {
  jack: "🐻",
  sally: "🌸",
  together: "🏠",
};

// Static nav items — emoji overridden by live profile data
const NAV_ITEMS_BASE = [
  { href: "/library", label: "Library", owner: null,       emoji: "📚", accent: "hsl(255 70% 65%)" },
  { href: "/jack",    label: "Jack",    owner: "jack",      emoji: "🐻", accent: "hsl(220 80% 60%)" },
  { href: "/sally",  label: "Sally",   owner: "sally",     emoji: "🌸", accent: "hsl(330 75% 65%)" },
  { href: "/together",label: "Together",owner: "together",  emoji: "🏠", accent: "hsl(20 90% 60%)" },
];

// ── Floating particles ────────────────────────────────────────────────────────
const PARTICLE_COLORS = [
  "hsl(255 70% 65%)", "hsl(220 80% 60%)", "hsl(330 75% 65%)", "hsl(20 90% 60%)",
];

// Mini SVG icons for floating particles
function ParticleSVG({ type, color, size }: { type: "book" | "camera" | "heart"; color: string; size: number }) {
  if (type === "book") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
        <line x1="3" y1="6" x2="17" y2="6" stroke={color} strokeWidth="1" />
        <line x1="7" y1="2" x2="7" y2="18" stroke={color} strokeWidth="1" />
        <line x1="9" y1="9" x2="15" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
        <line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "camera") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="6" width="16" height="11" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M7 6V5a1 1 0 011-1h4a1 1 0 011 1v1" stroke={color} strokeWidth="1.5" />
        <circle cx="10" cy="12" r="3" stroke={color} strokeWidth="1.5" fill="none" />
        <circle cx="10" cy="12" r="1.2" fill={color} />
      </svg>
    );
  }
  // heart — nerd heart shape from splash animation, scaled down
  return (
    <svg width={size} height={size} viewBox="-18 -5 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 13 C-15 2 -18 -5 -8 -5 C-4 -5 0 2 0 2 C0 2 4 -5 8 -5 C18 -5 15 2 0 13Z"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="-5" cy="0" r="2.2" fill={color} opacity="0.8" />
      <rect x="-6.8" y="0.8" width="1.5" height="2" fill={color} opacity="0.8" />
    </svg>
  );
}

const PARTICLE_TYPES: Array<"book" | "camera" | "heart"> = ["book", "camera", "heart"];

function FloatingParticles() {
  const particles = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      type: PARTICLE_TYPES[i % PARTICLE_TYPES.length] as "book" | "camera" | "heart",
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      left: `${5 + (i * 87) % 90}%`,
      size: 14 + (i * 5) % 12,
      dur: `${10 + (i * 3.7) % 12}s`,
      delay: `${-(i * 1.9) % 14}s`,
      dx: `${-30 + (i * 11) % 60}px`,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="particle select-none absolute"
          style={{
            left: p.left,
            bottom: "-30px",
            opacity: 0,
            "--dur": p.dur,
            "--delay": p.delay,
            "--dx": p.dx,
          } as React.CSSProperties}
        >
          <ParticleSVG type={p.type} color={p.color} size={p.size} />
        </div>
      ))}
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5 group cursor-default">
      <svg
        width="26" height="26" viewBox="0 0 32 32" fill="none" aria-label="Framestack"
        className="transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-110"
      >
        <rect x="2" y="8" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" />
        <rect x="8" y="4" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.4" />
        <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="font-extrabold text-[1rem] tracking-tight text-foreground transition-colors group-hover:text-primary"
        style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
      >
        Framestack
      </span>
    </div>
  );
}

// ── Nav Item ──────────────────────────────────────────────────────────────────
function NavItem({ href, label, emoji, accent, active, onClick }: {
  href: string; label: string; emoji: string; accent: string;
  active: boolean; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <li>
      <Link href={href} onClick={onClick} data-testid={`nav-${label.toLowerCase()}`}>
        <span
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer select-none",
            active
              ? "text-white shadow-sm"
              : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/60"
          )}
          style={active ? { background: accent, boxShadow: `0 2px 12px ${accent}55` } : {}}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Emoji bounces on hover */}
          <span
            className="text-base leading-none transition-transform duration-200"
            style={{
              display: "inline-block",
              transform: hovered && !active ? "scale(1.35) rotate(-8deg)" : "scale(1) rotate(0deg)",
              transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {emoji}
          </span>
          {label}
          {active && (
            <Sparkles
              size={11}
              className="ml-auto opacity-70"
              style={{ animation: "gentle-float 2s ease-in-out infinite" }}
            />
          )}
        </span>
      </Link>
    </li>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => !document.documentElement.classList.contains("light"));

  // Track navigation history so owner pages can decide whether to show intro animation
  const prevLocationRef = useRef(location);
  useEffect(() => {
    navHistory.set(prevLocationRef.current);
    prevLocationRef.current = location;
  }, [location]);

  // Fetch live profile emoji for each owner so nav icon matches profile
  const authH = () => getAuthToken() ? { "x-auth-token": getAuthToken() } : {};
  const { data: jackProfile }     = useQuery<Profile>({ queryKey: ["/api/profiles", "jack"],     queryFn: async () => { const r = await fetch(`${API_BASE}/api/profiles/jack`,     { headers: authH() }); return r.json(); }, staleTime: 60_000 });
  const { data: sallyProfile }    = useQuery<Profile>({ queryKey: ["/api/profiles", "sally"],    queryFn: async () => { const r = await fetch(`${API_BASE}/api/profiles/sally`,    { headers: authH() }); return r.json(); }, staleTime: 60_000 });
  const { data: togetherProfile } = useQuery<Profile>({ queryKey: ["/api/profiles", "together"], queryFn: async () => { const r = await fetch(`${API_BASE}/api/profiles/together`, { headers: authH() }); return r.json(); }, staleTime: 60_000 });

  const profileEmojis: Record<string, string> = {
    jack:     jackProfile?.avatarEmoji     ?? DEFAULT_EMOJIS.jack,
    sally:    sallyProfile?.avatarEmoji    ?? DEFAULT_EMOJIS.sally,
    together: togetherProfile?.avatarEmoji ?? DEFAULT_EMOJIS.together,
  };

  const NAV_ITEMS = NAV_ITEMS_BASE.map(item =>
    item.owner ? { ...item, emoji: profileEmojis[item.owner] } : item
  );

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("light", !next);
  }

  function isActive(href: string) {
    if (href === "/library") return location === "/" || location === "/library";
    if (href === "/jack") return location === "/jack" || location === "/jack/collections";
    if (href === "/sally") return location === "/sally" || location === "/sally/collections";
    if (href === "/together") return location === "/together" || location === "/together/collections" || location === "/together/links";
    return location === href;
  }

  const sidebar = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <Logo />
      </div>

      {/* Search */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={() => { setSearchOpen(true); setSidebarOpen(false); }}
          data-testid="button-search"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground bg-secondary/60 hover:bg-secondary hover:text-foreground transition-all border border-transparent hover:border-primary/20 group search-pulse"
        >
          <Search
            size={14}
            className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12"
          />
          <span>Search & add…</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <ul className="flex-1 px-3 py-3 space-y-0.5" role="list">
        <li className="px-3 pb-1.5 pt-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Spaces</span>
        </li>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={() => setSidebarOpen(false)} />
        ))}
      </ul>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 space-y-0.5">
        {/* Backup download — always visible so data is never lost */}
        <a
          href={`${API_BASE}/api/export`}
          data-testid="button-export"
          onClick={e => {
            e.preventDefault();
            const token = getAuthToken();
            const apiUrl = `${API_BASE}/api/export`;
            const filename = `framestack-backup-${new Date().toISOString().slice(0,10)}.json`;
            // Use fetch with x-auth-token header, then trigger a blob download
            fetch(apiUrl, { headers: token ? { 'x-auth-token': token } : {} })
              .then(r => {
                if (!r.ok) throw new Error(`Export failed: ${r.status}`);
                return r.blob();
              })
              .then(blob => {
                const u = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = u;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(u);
              })
              .catch(err => console.error('[export]', err));
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all group cursor-pointer"
        >
          <Download size={14} className="transition-transform duration-200 group-hover:translate-y-0.5" />
          Export backup
        </a>

        <button
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all group"
        >
          <span className="transition-transform duration-300 group-hover:rotate-[360deg]">
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </span>
          {darkMode ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden">
      {/* Floating particles (subtle, behind everything) */}
      <FloatingParticles />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background relative z-10">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-52 bg-sidebar-background border-r border-sidebar-border z-50"
            onClick={e => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            data-testid="button-mobile-menu"
            className="p-1.5 rounded-lg hover:bg-secondary transition-transform active:scale-90"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Logo />
          <button
            onClick={() => setSearchOpen(true)}
            data-testid="button-mobile-search"
            className="p-1.5 rounded-lg hover:bg-secondary transition-transform active:scale-90"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
