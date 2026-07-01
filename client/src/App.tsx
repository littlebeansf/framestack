import { useState, useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { isAuthenticated } from "@/lib/auth";

import LibraryPage from "@/pages/library";
import CollectionsPage from "@/pages/collections";
import CollectionDetailPage from "@/pages/collection-detail";
import ProfilePage from "@/pages/profile";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import AppShell from "@/components/AppShell";

export function LogoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Framestack logo">
      <rect x="2" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <rect x="8" y="4" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" className="text-primary" strokeOpacity="0.5" />
      <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Splash screen — plays on every load ──────────────────────────────────────
function AnimationSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    // Total animation duration: draw heart (~0.9s) + glasses (~1.1s) + stars (~1.25s) + brief pause
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background"
      style={{ fontFamily: "'Satoshi', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Logo fades in */}
        <div style={{ animation: "fade-in-up 0.5s 0.1s ease both", opacity: 0 }}>
          <LogoIcon size={32} />
        </div>

        {/* Heart-nerd SVG animation */}
        <div style={{ animation: "fade-in-up 0.5s 0.2s ease both", opacity: 0 }}>
          <svg
            viewBox="0 0 120 120"
            width={110}
            height={110}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: "visible" }}
          >
            {/* Heart outline */}
            <path
              d="M60 95 C20 70 10 45 20 30 C30 15 50 15 60 30 C70 15 90 15 100 30 C110 45 100 70 60 95Z"
              stroke="hsl(255 70% 65%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{
                strokeDasharray: 270,
                strokeDashoffset: 270,
                animation: "draw-heart 0.9s ease forwards",
              }}
            />

            {/* Glasses frame left */}
            <circle cx="44" cy="62" r="11"
              stroke="hsl(220 12% 75%)"
              strokeWidth="2"
              fill="none"
              style={{
                strokeDasharray: 70,
                strokeDashoffset: 70,
                animation: "draw-heart 0.5s 0.6s ease forwards",
              }}
            />
            {/* Glasses frame right */}
            <circle cx="76" cy="62" r="11"
              stroke="hsl(220 12% 75%)"
              strokeWidth="2"
              fill="none"
              style={{
                strokeDasharray: 70,
                strokeDashoffset: 70,
                animation: "draw-heart 0.5s 0.7s ease forwards",
              }}
            />
            {/* Bridge */}
            <path d="M55 62 H65"
              stroke="hsl(220 12% 75%)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                strokeDasharray: 10,
                strokeDashoffset: 10,
                animation: "draw-heart 0.3s 0.9s ease forwards",
              }}
            />
            {/* Left arm */}
            <path d="M33 62 H26"
              stroke="hsl(220 12% 75%)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                strokeDasharray: 8,
                strokeDashoffset: 8,
                animation: "draw-heart 0.3s 1.0s ease forwards",
              }}
            />
            {/* Right arm */}
            <path d="M87 62 H94"
              stroke="hsl(220 12% 75%)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                strokeDasharray: 8,
                strokeDashoffset: 8,
                animation: "draw-heart 0.3s 1.0s ease forwards",
              }}
            />

            {/* Eyes */}
            <circle cx="44" cy="62" r="3"
              fill="hsl(255 70% 65%)"
              style={{ opacity: 0, animation: "fade-in-up 0.3s 1.05s ease forwards" }}
            />
            <circle cx="76" cy="62" r="3"
              fill="hsl(255 70% 65%)"
              style={{ opacity: 0, animation: "fade-in-up 0.3s 1.05s ease forwards" }}
            />

            {/* Stars */}
            {[[22, 28], [98, 32], [16, 72], [104, 68]].map(([x, y], i) => (
              <path
                key={i}
                d={`M${x} ${y} l1.5 3 3 0 -2.4 2 1 3.2 -2.6-1.8 -2.6 1.8 1-3.2 -2.4-2 3 0Z`}
                fill="hsl(255 70% 70%)"
                style={{
                  opacity: 0,
                  animation: `twinkle 0.6s ${0.85 + i * 0.15}s ease forwards`,
                  transformOrigin: `${x}px ${y}px`,
                }}
              />
            ))}
          </svg>
        </div>

        {/* Tagline */}
        <p
          className="text-xs text-muted-foreground tracking-widest uppercase"
          style={{ animation: "fade-in-up 0.5s 1.2s ease both", opacity: 0 }}
        >
          Your personal media universe
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  // Always show animation splash first, every load
  if (!splashDone) {
    return (
      <QueryClientProvider client={queryClient}>
        <AnimationSplash onDone={() => setSplashDone(true)} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  if (authed === null || !authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginPage onSuccess={() => setAuthed(true)} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppShell>
          <Switch>
            <Route path="/" component={LibraryPage} />
            <Route path="/library" component={LibraryPage} />
            <Route path="/collections" component={CollectionsPage} />
            <Route path="/collections/:id" component={CollectionDetailPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route component={NotFound} />
          </Switch>
        </AppShell>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
