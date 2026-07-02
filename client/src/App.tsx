import { useState, useEffect } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH — two nerd-hearts slide in, merge, become one together-heart
// Timeline (ms):
//   0–600   Jack's heart draws in from the left
//   400–1000 Sally's heart draws in from the right
//   1000    both slide toward center (CSS translate animation)
//   1400    merged heart fades in, individuals fade out
//   1600    glasses draw on merged heart
//   1900    eyes pop, stars twinkle, crown appears
//   2100    names tag fades in
//   2600    done
// ─────────────────────────────────────────────────────────────────────────────

const JACK_BLUE  = "hsl(220 80% 62%)";
const SALLY_PINK = "hsl(330 75% 65%)";
const TOGETHER   = "hsl(255 70% 65%)";
const GLASS_CLR  = "hsl(220 15% 78%)";

// Heart path centred at (0,0), ~50 wide, ~42 tall — scale with transform
// Built so cx=0,cy=0 is the visual centre
const HEART = "M0 13 C-15 2 -26 2 -26 -8 C-26 -18 -18 -22 -10 -17 C-5 -13 0 -8 0 -8 C0 -8 5 -13 10 -17 C18 -22 26 -18 26 -8 C26 2 15 2 0 13Z";
// perimeter ≈ 116
const HEART_LEN = 118;

function AnimationSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background select-none">
      <style>{`
        /* ── slide animations ── */
        @keyframes jack-slide {
          0%   { transform: translate(-90px, 0) scale(1); opacity: 1; }
          55%  { transform: translate(-90px, 0) scale(1); opacity: 1; }
          80%  { transform: translate(-2px, 0)  scale(0.92); opacity: 1; }
          92%  { transform: translate(-2px, 0)  scale(0.92); opacity: 1; }
          100% { transform: translate(-2px, 0)  scale(0.92); opacity: 0; }
        }
        @keyframes sally-slide {
          0%   { transform: translate(90px, 0) scale(1); opacity: 1; }
          55%  { transform: translate(90px, 0) scale(1); opacity: 1; }
          80%  { transform: translate(2px, 0)  scale(0.92); opacity: 1; }
          92%  { transform: translate(2px, 0)  scale(0.92); opacity: 1; }
          100% { transform: translate(2px, 0)  scale(0.92); opacity: 0; }
        }
        /* ── merged heart ── */
        @keyframes merge-pop {
          0%   { opacity: 0; transform: scale(0.5); }
          60%  { transform: scale(1.12); }
          80%  { transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* ── crown bounce ── */
        @keyframes crown-drop {
          0%   { opacity: 0; transform: translateY(-14px) rotate(-8deg) scale(0.5); }
          60%  { transform: translateY(3px) rotate(4deg) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        /* ── little sparkle rings that pulse out from merge point ── */
        @keyframes ring-pulse {
          0%   { r: 0; opacity: 0.8; }
          100% { r: 55; opacity: 0; }
        }
        /* ── name tag ── */
        @keyframes name-in {
          from { opacity: 0; letter-spacing: 0.35em; }
          to   { opacity: 1; letter-spacing: 0.18em; }
        }
      `}</style>

      {/* Main SVG canvas — 320 wide, 220 tall */}
      <svg
        viewBox="-160 -100 320 200"
        width={340}
        height={220}
        fill="none"
        style={{ overflow: "visible" }}
        aria-label="Two nerd hearts becoming one"
      >
        {/* ── JACK'S HEART (blue, left) ─────────────────────────────── */}
        <g style={{ animation: "jack-slide 2.0s cubic-bezier(0.34,1.2,0.64,1) 0.05s both" }}>
          {/* heart outline */}
          <path
            d={HEART}
            stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: HEART_LEN,
              strokeDashoffset: HEART_LEN,
              animation: "draw-heart 0.65s cubic-bezier(0.4,0,0.2,1) 0.05s forwards",
            }}
          />
          {/* glasses left lens */}
          <circle cx="-8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.35s ease 0.55s forwards" }}
          />
          {/* glasses right lens */}
          <circle cx="8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.35s ease 0.65s forwards" }}
          />
          {/* bridge */}
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 0.78s forwards" }}
          />
          {/* left arm */}
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 0.82s forwards" }}
          />
          {/* right arm */}
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 0.82s forwards" }}
          />
          {/* eyes — tiny stars */}
          <circle cx="-8" cy="4" r="2" fill={JACK_BLUE}
            style={{ opacity: 0, animation: "fade-in-up 0.25s ease 0.88s forwards" }}
          />
          <circle cx="8" cy="4" r="2" fill={JACK_BLUE}
            style={{ opacity: 0, animation: "fade-in-up 0.25s ease 0.88s forwards" }}
          />
          {/* tiny "J" label above */}
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif"
            fontWeight="700" fill={JACK_BLUE} letterSpacing="1"
            style={{ opacity: 0, animation: "fade-in-up 0.3s ease 0.75s forwards" }}
          >JACK</text>
        </g>

        {/* ── SALLY'S HEART (pink, right) ───────────────────────────── */}
        <g style={{ animation: "sally-slide 2.0s cubic-bezier(0.34,1.2,0.64,1) 0.05s both" }}>
          {/* heart outline */}
          <path
            d={HEART}
            stroke={SALLY_PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: HEART_LEN,
              strokeDashoffset: HEART_LEN,
              animation: "draw-heart 0.65s cubic-bezier(0.4,0,0.2,1) 0.35s forwards",
            }}
          />
          {/* glasses */}
          <circle cx="-8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.35s ease 0.82s forwards" }}
          />
          <circle cx="8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.35s ease 0.92s forwards" }}
          />
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 1.04s forwards" }}
          />
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 1.08s forwards" }}
          />
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.2s ease 1.08s forwards" }}
          />
          {/* eyes */}
          <circle cx="-8" cy="4" r="2" fill={SALLY_PINK}
            style={{ opacity: 0, animation: "fade-in-up 0.25s ease 1.14s forwards" }}
          />
          <circle cx="8" cy="4" r="2" fill={SALLY_PINK}
            style={{ opacity: 0, animation: "fade-in-up 0.25s ease 1.14s forwards" }}
          />
          {/* tiny "S" label above */}
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif"
            fontWeight="700" fill={SALLY_PINK} letterSpacing="1"
            style={{ opacity: 0, animation: "fade-in-up 0.3s ease 1.0s forwards" }}
          >SALLY</text>
        </g>

        {/* ── MERGE RING PULSES ─────────────────────────────────────── */}
        {[0, 120, 240].map((delay, i) => (
          <circle key={i} cx="0" cy="0" r="0"
            stroke={TOGETHER} strokeWidth="1.2" opacity="0"
            style={{ animation: `ring-pulse 0.7s ease-out ${1.62 + i * 0.12}s forwards` }}
          />
        ))}

        {/* ── MERGED HEART (purple, centre) ────────────────────────── */}
        <g style={{ opacity: 0, animation: "merge-pop 0.55s cubic-bezier(0.34,1.4,0.64,1) 1.58s forwards" }}>
          {/* bigger heart — scale 1.45 */}
          <g transform="scale(1.45)">
            {/* heart fill with subtle gradient effect via two strokes */}
            <path d={HEART}
              stroke={TOGETHER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              strokeOpacity="0.25" fill="none"
            />
            <path d={HEART}
              stroke={TOGETHER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          </g>

          {/* big glasses — wider to match merged heart */}
          <circle cx="-11" cy="5" r="9.5"
            stroke={GLASS_CLR} strokeWidth="1.8"
            style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "draw-heart 0.4s ease 1.95s forwards" }}
          />
          <circle cx="11" cy="5" r="9.5"
            stroke={GLASS_CLR} strokeWidth="1.8"
            style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "draw-heart 0.4s ease 2.08s forwards" }}
          />
          {/* bridge */}
          <path d="M-1.5 5 H1.5" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.2s ease 2.22s forwards" }}
          />
          {/* arms */}
          <path d="M-20.5 5 H-26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.2s ease 2.26s forwards" }}
          />
          <path d="M20.5 5 H26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.2s ease 2.26s forwards" }}
          />

          {/* spiral eyes — heart eyes (two tiny swirls) */}
          {/* left eye: star/heart */}
          <text x="-11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER}
            style={{ opacity: 0, animation: "fade-in-up 0.3s ease 2.3s forwards" }}
          >♥</text>
          <text x="11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER}
            style={{ opacity: 0, animation: "fade-in-up 0.3s ease 2.3s forwards" }}
          >♥</text>

          {/* ── CROWN on top ── */}
          <g style={{ opacity: 0, animation: "crown-drop 0.5s cubic-bezier(0.34,1.4,0.64,1) 2.28s forwards" }}>
            {/* crown base bar */}
            <path d="M-14 -22 H14" stroke={TOGETHER} strokeWidth="1.8" strokeLinecap="round" />
            {/* crown points: left, centre, right */}
            <path d="M-14 -22 L-18 -32 L-8 -26 L0 -36 L8 -26 L18 -32 L14 -22"
              stroke={TOGETHER} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
            />
            {/* tiny gems on each point */}
            <circle cx="-18" cy="-32" r="2" fill={JACK_BLUE} />
            <circle cx="0"   cy="-36" r="2.5" fill={TOGETHER} />
            <circle cx="18"  cy="-32" r="2" fill={SALLY_PINK} />
          </g>

          {/* ── scattered sparkles around the merged heart ── */}
          {[
            [-38, -28, "✦", JACK_BLUE,  2.42, 9],
            [ 42, -22, "✦", SALLY_PINK, 2.50, 9],
            [-44,  10, "✸", TOGETHER,   2.58, 8],
            [ 46,  14, "✸", JACK_BLUE,  2.48, 8],
            [ -4,  42, "★", SALLY_PINK, 2.62, 10],
            [  0, -48, "·", TOGETHER,   2.38, 14],
          ].map(([x, y, char, color, delay, size], i) => (
            <text key={i}
              x={x as number} y={y as number}
              textAnchor="middle" fontSize={size as number}
              fill={color as string} fontWeight="bold"
              style={{ opacity: 0, animation: `twinkle 0.7s ease ${delay}s forwards`, transformOrigin: `${x}px ${y}px` }}
            >{char}</text>
          ))}

          {/* ── small heart between them before merge — the "click" ── */}
          {/* tiny beating heart at dead centre */}
          <path d="M0 3 C-4 -1 -7 -1 -7 -4 C-7 -7 -4 -8 0 -5 C4 -8 7 -7 7 -4 C7 -1 4 -1 0 3Z"
            stroke={TOGETHER} strokeWidth="1.2" strokeOpacity="0.4"
            style={{ opacity: 0, animation: "fade-in-up 0.4s ease 2.38s forwards" }}
          />
        </g>
      </svg>

      {/* Name tag */}
      <div
        className="mt-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase"
        style={{ opacity: 0, animation: "name-in 0.6s ease 2.5s forwards" }}
      >
        <span style={{ color: JACK_BLUE }}>Jack</span>
        <span style={{ color: TOGETHER, fontSize: 14 }}>♥</span>
        <span style={{ color: SALLY_PINK }}>Sally</span>
      </div>

      {/* App name */}
      <div
        className="mt-3 text-[10px] text-muted-foreground tracking-[0.3em] uppercase font-semibold"
        style={{ opacity: 0, animation: "fade-in-up 0.5s ease 2.62s forwards" }}
      >
        Framestack
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
