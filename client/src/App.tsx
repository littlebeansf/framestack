import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import LibraryPage from "@/pages/library";
import JackPage from "@/pages/jack";
import SallyPage from "@/pages/sally";
import TogetherPage from "@/pages/together";
import CollectionDetailPage from "@/pages/collection-detail";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import AppShell from "@/components/AppShell";

// ── Splash animation ──────────────────────────────────────────────────────────
function AnimationSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        {/* Logo */}
        <div style={{ animation: "fade-in-up 0.5s 0.1s ease both", opacity: 0 }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="8" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" />
            <rect x="8" y="4" width="20" height="14" rx="2.5" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.4" />
            <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Heart-nerd SVG */}
        <div style={{ animation: "fade-in-up 0.5s 0.2s ease both", opacity: 0 }}>
          <svg viewBox="0 0 120 120" width={110} height={110} fill="none" style={{ overflow: "visible" }}>
            {/* Heart */}
            <path
              d="M60 95 C20 70 10 45 20 30 C30 15 50 15 60 30 C70 15 90 15 100 30 C110 45 100 70 60 95Z"
              stroke="hsl(255 70% 65%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 270, strokeDashoffset: 270, animation: "draw-heart 0.9s ease forwards" }}
            />
            {/* Glasses */}
            <circle cx="44" cy="62" r="11" stroke="hsl(220 12% 75%)" strokeWidth="2"
              style={{ strokeDasharray: 70, strokeDashoffset: 70, animation: "draw-heart 0.5s 0.6s ease forwards" }} />
            <circle cx="76" cy="62" r="11" stroke="hsl(220 12% 75%)" strokeWidth="2"
              style={{ strokeDasharray: 70, strokeDashoffset: 70, animation: "draw-heart 0.5s 0.7s ease forwards" }} />
            <path d="M55 62 H65" stroke="hsl(220 12% 75%)" strokeWidth="2" strokeLinecap="round"
              style={{ strokeDasharray: 10, strokeDashoffset: 10, animation: "draw-heart 0.3s 0.9s ease forwards" }} />
            <path d="M33 62 H26" stroke="hsl(220 12% 75%)" strokeWidth="2" strokeLinecap="round"
              style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.3s 1.0s ease forwards" }} />
            <path d="M87 62 H94" stroke="hsl(220 12% 75%)" strokeWidth="2" strokeLinecap="round"
              style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.3s 1.0s ease forwards" }} />
            {/* Eyes */}
            <circle cx="44" cy="62" r="3" fill="hsl(255 70% 65%)"
              style={{ opacity: 0, animation: "fade-in-up 0.3s 1.05s ease forwards" }} />
            <circle cx="76" cy="62" r="3" fill="hsl(255 70% 65%)"
              style={{ opacity: 0, animation: "fade-in-up 0.3s 1.05s ease forwards" }} />
            {/* Stars */}
            {[[22, 28], [98, 32], [16, 72], [104, 68]].map(([x, y], i) => (
              <path key={i}
                d={`M${x} ${y} l1.5 3 3 0 -2.4 2 1 3.2 -2.6-1.8 -2.6 1.8 1-3.2 -2.4-2 3 0Z`}
                fill="hsl(255 70% 70%)"
                style={{ opacity: 0, animation: `twinkle 0.6s ${0.85 + i * 0.15}s ease forwards`, transformOrigin: `${x}px ${y}px` }}
              />
            ))}
          </svg>
        </div>

        {/* Names */}
        <div style={{ animation: "fade-in-up 0.5s 1.3s ease both", opacity: 0 }} className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
          <span style={{ color: "hsl(220 80% 60%)" }}>Jack</span>
          <span>✦</span>
          <span style={{ color: "hsl(330 75% 65%)" }}>Sally</span>
          <span>✦</span>
          <span style={{ color: "hsl(20 90% 60%)" }}>Together</span>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <QueryClientProvider client={queryClient}>
        <AnimationSplash onDone={() => setSplashDone(true)} />
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
            <Route path="/jack" component={JackPage} />
            <Route path="/sally" component={SallyPage} />
            <Route path="/together" component={TogetherPage} />
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
