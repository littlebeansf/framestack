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

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Check auth on mount (sync from localStorage)
  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  // Still checking
  if (authed === null) return null;

  if (!authed) {
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
