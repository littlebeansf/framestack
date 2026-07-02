import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Library, Search, Menu, Sun, Moon, Heart, Sparkles } from "lucide-react";
import SearchDialog from "@/components/SearchDialog";

const NAV_ITEMS = [
  { href: "/library", label: "Library", emoji: "📚", glyph: <Library size={15} />, accent: "hsl(255 70% 65%)" },
  { href: "/jack", label: "Jack", emoji: "🐻", glyph: null, accent: "hsl(220 80% 60%)" },
  { href: "/sally", label: "Sally", emoji: "🌸", glyph: null, accent: "hsl(330 75% 65%)" },
  { href: "/together", label: "Together", emoji: "🫶", glyph: null, accent: "hsl(20 90% 60%)" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-label="Framestack">
        <rect x="2" y="8" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" />
        <rect x="8" y="4" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.4" />
        <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-extrabold text-[1rem] tracking-tight text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Framestack
      </span>
    </div>
  );
}

function NavItem({ href, label, emoji, accent, active, onClick }: {
  href: string; label: string; emoji: string; accent: string;
  active: boolean; onClick?: () => void;
}) {
  return (
    <li>
      <Link href={href} onClick={onClick} data-testid={`nav-${label.toLowerCase()}`}>
        <span
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer",
            active
              ? "text-white shadow-sm"
              : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/60"
          )}
          style={active ? { background: accent, boxShadow: `0 2px 12px ${accent}55` } : {}}
        >
          <span className="text-base leading-none">{emoji}</span>
          {label}
          {active && <Sparkles size={11} className="ml-auto opacity-70" />}
        </span>
      </Link>
    </li>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => !document.documentElement.classList.contains("light"));

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("light", !next);
  }

  function isActive(href: string) {
    if (href === "/library") return location === "/" || location === "/library";
    if (href === "/jack") return location.startsWith("/jack");
    if (href === "/sally") return location.startsWith("/sally");
    if (href === "/together") return location.startsWith("/together");
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
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground bg-secondary/60 hover:bg-secondary hover:text-foreground transition-all border border-transparent hover:border-primary/20"
        >
          <Search size={14} />
          <span>Search & add…</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <ul className="flex-1 px-3 py-3 space-y-0.5" role="list">
        {/* Divider label */}
        <li className="px-3 pb-1.5 pt-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Spaces</span>
        </li>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={() => setSidebarOpen(false)} />
        ))}
      </ul>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <button
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all"
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background">
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} data-testid="button-mobile-menu" className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <Logo />
          <button onClick={() => setSearchOpen(true)} data-testid="button-mobile-search" className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Search">
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
