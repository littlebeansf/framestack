import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Library, FolderOpen, User, Search, Menu, Sun, Moon } from "lucide-react";
import SearchDialog from "@/components/SearchDialog";

const NAV_ITEMS = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/collections", label: "Collections", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: User },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Framestack">
        <rect x="2" y="8" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" />
        <rect x="8" y="4" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.45" />
        <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-bold text-[1.05rem] tracking-tight text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Framestack
      </span>
    </div>
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
    if (next) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
  }

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-border">
        <Logo />
      </div>

      {/* Search button */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={() => { setSearchOpen(true); setSidebarOpen(false); }}
          data-testid="button-search"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Search size={15} />
          <span>Search & add…</span>
          <span className="ml-auto text-xs opacity-50">⌘K</span>
        </button>
      </div>

      {/* Nav items */}
      <ul className="flex-1 px-3 py-2 space-y-1" role="list">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === "/library" && location === "/");
          return (
            <li key={href}>
              <Link
                href={href}
                data-testid={`nav-${label.toLowerCase()}`}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom: theme toggle */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <button
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {darkMode ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-sidebar-background">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 bg-sidebar-background border-r border-border z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            data-testid="button-mobile-menu"
            className="p-1.5 rounded-md hover:bg-secondary"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Logo />
          <button
            onClick={() => setSearchOpen(true)}
            data-testid="button-mobile-search"
            className="p-1.5 rounded-md hover:bg-secondary"
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
