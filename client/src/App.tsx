import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, getAuthToken, setToken, isAuthenticated, API_BASE } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

// Lazy-load heavy page components to reduce initial bundle parse time
const LibraryPage        = lazy(() => import("@/pages/library"));
const JackPage           = lazy(() => import("@/pages/jack"));
const SallyPage          = lazy(() => import("@/pages/sally"));
const TogetherPage       = lazy(() => import("@/pages/together"));
const CollectionDetailPage = lazy(() => import("@/pages/collection-detail"));
const ProfilePage        = lazy(() => import("@/pages/profile"));
const NotFound           = lazy(() => import("@/pages/not-found"));
import AppShell from "@/components/AppShell";

// Minimal fallback — matches dark background so no flash
const PageFallback = () => (
  <div style={{ minHeight: "60vh", background: "transparent" }} />
);

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH — two nerd-hearts slide in, merge, become one together-heart
// ─────────────────────────────────────────────────────────────────────────────

const JACK_BLUE  = "hsl(220 80% 62%)";
const SALLY_PINK = "hsl(330 75% 65%)";
const TOGETHER   = "hsl(255 70% 65%)";
const GLASS_CLR  = "hsl(220 15% 78%)";

const HEART = "M0 13 C-15 2 -26 2 -26 -8 C-26 -18 -18 -22 -10 -17 C-5 -13 0 -8 0 -8 C0 -8 5 -13 10 -17 C18 -22 26 -18 26 -8 C26 2 15 2 0 13Z";
const HEART_LEN = 118;

function AnimationSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center select-none" style={{ background: "#0b0c14" }}>
      <style>{`
        @keyframes draw-heart { to { stroke-dashoffset: 0; } }
        @keyframes fade-in-up { from { opacity:0;transform:translateY(4px);} to{opacity:1;transform:translateY(0);} }
        @keyframes twinkle { 0%{opacity:0;transform:scale(0.4) rotate(-20deg);} 60%{opacity:1;transform:scale(1.3) rotate(10deg);} 100%{opacity:1;transform:scale(1) rotate(0deg);} }
        @keyframes jack-slide { 0%{transform:translate(-90px,0) scale(1);opacity:1;} 55%{transform:translate(-90px,0) scale(1);opacity:1;} 80%{transform:translate(-2px,0) scale(0.92);opacity:1;} 92%{transform:translate(-2px,0) scale(0.92);opacity:1;} 100%{transform:translate(-2px,0) scale(0.92);opacity:0;} }
        @keyframes sally-slide { 0%{transform:translate(90px,0) scale(1);opacity:1;} 55%{transform:translate(90px,0) scale(1);opacity:1;} 80%{transform:translate(2px,0) scale(0.92);opacity:1;} 92%{transform:translate(2px,0) scale(0.92);opacity:1;} 100%{transform:translate(2px,0) scale(0.92);opacity:0;} }
        @keyframes merge-pop { 0%{opacity:0;transform:scale(0.5);} 60%{transform:scale(1.12);} 80%{transform:scale(0.96);} 100%{opacity:1;transform:scale(1);} }
        @keyframes crown-drop { 0%{opacity:0;transform:translateY(-14px) rotate(-8deg) scale(0.5);} 60%{transform:translateY(3px) rotate(4deg) scale(1.1);} 100%{opacity:1;transform:translateY(0) rotate(0deg) scale(1);} }
        @keyframes ring-pulse { 0%{r:0;opacity:0.8;} 100%{r:55;opacity:0;} }
        @keyframes name-in { from{opacity:0;letter-spacing:0.35em;} to{opacity:1;letter-spacing:0.18em;} }
      `}</style>

      <svg viewBox="-160 -100 320 200" width={340} height={220} fill="none" style={{ overflow:"visible" }} aria-label="Two nerd hearts becoming one">
        {/* Jack */}
        <g style={{ animation:"jack-slide 3.6s cubic-bezier(0.34,1.2,0.64,1) 0.09s both" }}>
          <path d={HEART} stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray:HEART_LEN,strokeDashoffset:HEART_LEN,animation:"draw-heart 1.17s cubic-bezier(0.4,0,0.2,1) 0.09s forwards" }}/>
          <circle cx="-8" cy="4" r="7" stroke={GLASS_CLR} strokeWidth="1.6" style={{ strokeDasharray:44,strokeDashoffset:44,animation:"draw-heart 0.63s ease 0.99s forwards" }}/>
          <circle cx="8" cy="4" r="7" stroke={GLASS_CLR} strokeWidth="1.6" style={{ strokeDasharray:44,strokeDashoffset:44,animation:"draw-heart 0.63s ease 1.17s forwards" }}/>
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.4s forwards" }}/>
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.48s forwards" }}/>
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.48s forwards" }}/>
          <circle cx="-8" cy="4" r="2" fill={JACK_BLUE} style={{ opacity:0,animation:"fade-in-up 0.45s ease 1.58s forwards" }}/>
          <circle cx="8" cy="4" r="2" fill={JACK_BLUE} style={{ opacity:0,animation:"fade-in-up 0.45s ease 1.58s forwards" }}/>
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif" fontWeight="700" fill={JACK_BLUE} letterSpacing="1" style={{ opacity:0,animation:"fade-in-up 0.54s ease 1.35s forwards" }}>JACK</text>
        </g>
        {/* Sally */}
        <g style={{ animation:"sally-slide 3.6s cubic-bezier(0.34,1.2,0.64,1) 0.09s both" }}>
          <path d={HEART} stroke={SALLY_PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray:HEART_LEN,strokeDashoffset:HEART_LEN,animation:"draw-heart 1.17s cubic-bezier(0.4,0,0.2,1) 0.63s forwards" }}/>
          <circle cx="-8" cy="4" r="7" stroke={GLASS_CLR} strokeWidth="1.6" style={{ strokeDasharray:44,strokeDashoffset:44,animation:"draw-heart 0.63s ease 1.48s forwards" }}/>
          <circle cx="8" cy="4" r="7" stroke={GLASS_CLR} strokeWidth="1.6" style={{ strokeDasharray:44,strokeDashoffset:44,animation:"draw-heart 0.63s ease 1.66s forwards" }}/>
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.87s forwards" }}/>
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.94s forwards" }}/>
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round" style={{ strokeDasharray:6,strokeDashoffset:6,animation:"draw-heart 0.36s ease 1.94s forwards" }}/>
          <circle cx="-8" cy="4" r="2" fill={SALLY_PINK} style={{ opacity:0,animation:"fade-in-up 0.45s ease 2.05s forwards" }}/>
          <circle cx="8" cy="4" r="2" fill={SALLY_PINK} style={{ opacity:0,animation:"fade-in-up 0.45s ease 2.05s forwards" }}/>
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif" fontWeight="700" fill={SALLY_PINK} letterSpacing="1" style={{ opacity:0,animation:"fade-in-up 0.54s ease 1.8s forwards" }}>SALLY</text>
        </g>
        {/* Rings */}
        {[0,120,240].map((_,i) => (
          <circle key={i} cx="0" cy="0" r="0" stroke={TOGETHER} strokeWidth="1.2" opacity="0" style={{ animation:`ring-pulse 1.26s ease-out ${2.92+i*0.22}s forwards` }}/>
        ))}
        {/* Merged */}
        <g style={{ opacity:0,animation:"merge-pop 0.99s cubic-bezier(0.34,1.4,0.64,1) 2.84s forwards" }}>
          <g transform="scale(1.45)">
            <path d={HEART} stroke={TOGETHER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.25" fill="none"/>
            <path d={HEART} stroke={TOGETHER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
          <circle cx="-11" cy="5" r="9.5" stroke={GLASS_CLR} strokeWidth="1.8" style={{ strokeDasharray:60,strokeDashoffset:60,animation:"draw-heart 0.72s ease 3.51s forwards" }}/>
          <circle cx="11" cy="5" r="9.5" stroke={GLASS_CLR} strokeWidth="1.8" style={{ strokeDasharray:60,strokeDashoffset:60,animation:"draw-heart 0.72s ease 3.74s forwards" }}/>
          <path d="M-1.5 5 H1.5" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray:8,strokeDashoffset:8,animation:"draw-heart 0.36s ease 4.0s forwards" }}/>
          <path d="M-20.5 5 H-26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray:8,strokeDashoffset:8,animation:"draw-heart 0.36s ease 4.07s forwards" }}/>
          <path d="M20.5 5 H26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray:8,strokeDashoffset:8,animation:"draw-heart 0.36s ease 4.07s forwards" }}/>
          <text x="-11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER} style={{ opacity:0,animation:"fade-in-up 0.54s ease 4.14s forwards" }}>♥</text>
          <text x="11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER} style={{ opacity:0,animation:"fade-in-up 0.54s ease 4.14s forwards" }}>♥</text>
          <g style={{ opacity:0,animation:"crown-drop 0.9s cubic-bezier(0.34,1.4,0.64,1) 4.1s forwards" }}>
            <path d="M-14 -22 H14" stroke={TOGETHER} strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M-14 -22 L-18 -32 L-8 -26 L0 -36 L8 -26 L18 -32 L14 -22" stroke={TOGETHER} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
            <circle cx="-18" cy="-32" r="2" fill={JACK_BLUE}/>
            <circle cx="0" cy="-36" r="2.5" fill={TOGETHER}/>
            <circle cx="18" cy="-32" r="2" fill={SALLY_PINK}/>
          </g>
          {([[-38,-28,"✦",JACK_BLUE,4.36,9],[42,-22,"✦",SALLY_PINK,4.5,9],[-44,10,"✸",TOGETHER,4.64,8],[46,14,"✸",JACK_BLUE,4.46,8],[-4,42,"★",SALLY_PINK,4.72,10],[0,-48,"·",TOGETHER,4.28,14]] as const).map(([x,y,char,color,delay,size],i) => (
            <text key={i} x={x as number} y={y as number} textAnchor="middle" fontSize={size as number} fill={color as string} fontWeight="bold" style={{ opacity:0,animation:`twinkle 1.26s ease ${delay}s forwards`,transformOrigin:`${x}px ${y}px` }}>{char}</text>
          ))}
          <path d="M0 3 C-4 -1 -7 -1 -7 -4 C-7 -7 -4 -8 0 -5 C4 -8 7 -7 7 -4 C7 -1 4 -1 0 3Z" stroke={TOGETHER} strokeWidth="1.2" strokeOpacity="0.4" style={{ opacity:0,animation:"fade-in-up 0.72s ease 4.28s forwards" }}/>
        </g>
      </svg>
      <div className="mt-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase" style={{ opacity:0,animation:"name-in 1.08s ease 4.5s forwards" }}>
        <span style={{ color:JACK_BLUE }}>Jack</span>
        <span style={{ color:TOGETHER,fontSize:14 }}>♥</span>
        <span style={{ color:SALLY_PINK }}>Sally</span>
      </div>
      <div className="mt-3 text-[10px] text-white/50 tracking-[0.3em] uppercase font-semibold" style={{ opacity:0,animation:"fade-in-up 0.9s ease 4.72s forwards" }}>Framestack</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN — rendered by React, no server HTML gate needed.
// Posts to the backend auth endpoint; on success stores the token and
// transitions to the main app. Works regardless of how the page was served.
// ─────────────────────────────────────────────────────────────────────────────

// The auth endpoint lives in Express at /__auth.
// In the published pplx.app sandbox:
//   - The page is served from S3 at https://<slug>.pplx.app/
//   - Express runs behind /port/5000/
// In dev (localhost:5000): both are on the same origin, no prefix needed.
function authUrl(): string {
  if (typeof window === "undefined") return "/__auth";
  return window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000/__auth"
    : "/__auth";
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const res = await fetch(authUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `password=${encodeURIComponent(pw)}`,
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        onLogin();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0b0c14", fontFamily:"'Satoshi',system-ui,sans-serif", color:"#e2e4f0" }}>
      <div style={{ background:"#13152a", border:"1px solid #2a2d4a", borderRadius:20, padding:"2.5rem 2rem", width:340, display:"flex", flexDirection:"column", alignItems:"center", gap:"1.5rem", boxShadow:"0 8px 40px #0005" }}>
        <div style={{ fontSize:"2.2rem" }}>🎬</div>
        <h1 style={{ fontSize:"1.1rem", fontWeight:700, letterSpacing:"-0.01em" }}>Framestack</h1>
        <p style={{ fontSize:"0.8rem", color:"#6b7099", textAlign:"center", lineHeight:1.5 }}>Your personal media universe.<br/>Enter the password to continue.</p>
        <form onSubmit={handleSubmit} style={{ width:"100%", display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            autoFocus
            autoComplete="current-password"
            data-testid="input-password"
            style={{ width:"100%", background:"#1c1f36", border:`1px solid ${error ? "#f87171" : "#2a2d4a"}`, borderRadius:10, padding:"0.65rem 1rem", fontSize:"0.9rem", color:"#e2e4f0", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" }}
          />
          {error && <p style={{ fontSize:"0.78rem", color:"#f87171", textAlign:"center" }}>Wrong password — try again.</p>}
          <button
            type="submit"
            disabled={loading || !pw}
            data-testid="button-login"
            style={{ width:"100%", background: loading ? "#5a3fcc" : "#7c5cfc", color:"#fff", border:"none", borderRadius:10, padding:"0.7rem", fontSize:"0.9rem", fontWeight:700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition:"opacity 0.15s" }}
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  // Re-render trigger when auth state changes
  const [authed, setAuthed] = useState(() => isAuthenticated());

  // Always show splash first, then check auth
  if (!splashDone) {
    return (
      <QueryClientProvider client={queryClient}>
        <AnimationSplash onDone={() => setSplashDone(true)} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Splash done but not logged in → show login screen
  if (!authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginScreen onLogin={() => setAuthed(true)} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Authenticated → main app
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={LibraryPage} />
            <Route path="/library" component={LibraryPage} />
            <Route path="/jack">{() => <JackPage sub="profile" />}</Route>
            <Route path="/jack/collections">{() => <JackPage sub="collections" />}</Route>
            <Route path="/jack/quotes">{() => <JackPage sub="quotes" />}</Route>
            <Route path="/jack/messages">{() => <JackPage sub="messages" />}</Route>
            <Route path="/sally">{() => <SallyPage sub="profile" />}</Route>
            <Route path="/sally/collections">{() => <SallyPage sub="collections" />}</Route>
            <Route path="/sally/quotes">{() => <SallyPage sub="quotes" />}</Route>
            <Route path="/sally/messages">{() => <SallyPage sub="messages" />}</Route>
            <Route path="/together">{() => <TogetherPage sub="profile" />}</Route>
            {/* Catalogs group */}
            <Route path="/together/catalogs">{() => <TogetherPage sub="catalogs" />}</Route>
            <Route path="/together/links">{() => <TogetherPage sub="links" />}</Route>
            <Route path="/together/places">{() => <TogetherPage sub="places" />}</Route>
            {/* Activities group */}
            <Route path="/together/activities">{() => <TogetherPage sub="activities" />}</Route>
            <Route path="/together/calendar">{() => <TogetherPage sub="calendar" />}</Route>
            <Route path="/together/grocery">{() => <TogetherPage sub="grocery" />}</Route>
            <Route path="/together/todos">{() => <TogetherPage sub="todos" />}</Route>
            {/* Legacy redirects (keep working) */}
            <Route path="/together/collections">{() => <TogetherPage sub="collections" />}</Route>
            <Route path="/together/restaurants">{() => <TogetherPage sub="restaurants" />}</Route>
            <Route path="/collections/:id" component={CollectionDetailPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </AppShell>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
