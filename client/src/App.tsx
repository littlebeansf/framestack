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
// Timeline (ms)  [~1.8× slower than original]:
//   0–1080   Jack's heart draws in from the left
//   720–1800 Sally's heart draws in from the right
//   1800     both slide toward center
//   2520     merged heart fades in, individuals fade out
//   2880     glasses draw on merged heart
//   3420     eyes pop, stars twinkle, crown appears
//   3780     names tag fades in
//   4680     done
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
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black select-none">
      <style>{`
        /* ── draw keyframe ── */
        @keyframes draw-heart {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes twinkle {
          0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
          60%  { opacity: 1; transform: scale(1.3) rotate(10deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

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
        <g style={{ animation: "jack-slide 3.6s cubic-bezier(0.34,1.2,0.64,1) 0.09s both" }}>
          {/* heart outline */}
          <path
            d={HEART}
            stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: HEART_LEN,
              strokeDashoffset: HEART_LEN,
              animation: "draw-heart 1.17s cubic-bezier(0.4,0,0.2,1) 0.09s forwards",
            }}
          />
          {/* glasses left lens */}
          <circle cx="-8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.63s ease 0.99s forwards" }}
          />
          {/* glasses right lens */}
          <circle cx="8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.63s ease 1.17s forwards" }}
          />
          {/* bridge */}
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.4s forwards" }}
          />
          {/* left arm */}
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.48s forwards" }}
          />
          {/* right arm */}
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.48s forwards" }}
          />
          {/* eyes — tiny stars */}
          <circle cx="-8" cy="4" r="2" fill={JACK_BLUE}
            style={{ opacity: 0, animation: "fade-in-up 0.45s ease 1.58s forwards" }}
          />
          <circle cx="8" cy="4" r="2" fill={JACK_BLUE}
            style={{ opacity: 0, animation: "fade-in-up 0.45s ease 1.58s forwards" }}
          />
          {/* tiny "J" label above */}
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif"
            fontWeight="700" fill={JACK_BLUE} letterSpacing="1"
            style={{ opacity: 0, animation: "fade-in-up 0.54s ease 1.35s forwards" }}
          >JACK</text>
        </g>

        {/* ── SALLY'S HEART (pink, right) ───────────────────────────── */}
        <g style={{ animation: "sally-slide 3.6s cubic-bezier(0.34,1.2,0.64,1) 0.09s both" }}>
          {/* heart outline */}
          <path
            d={HEART}
            stroke={SALLY_PINK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: HEART_LEN,
              strokeDashoffset: HEART_LEN,
              animation: "draw-heart 1.17s cubic-bezier(0.4,0,0.2,1) 0.63s forwards",
            }}
          />
          {/* glasses */}
          <circle cx="-8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.63s ease 1.48s forwards" }}
          />
          <circle cx="8" cy="4" r="7"
            stroke={GLASS_CLR} strokeWidth="1.6"
            style={{ strokeDasharray: 44, strokeDashoffset: 44, animation: "draw-heart 0.63s ease 1.66s forwards" }}
          />
          <path d="M-1 4 H1" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.87s forwards" }}
          />
          <path d="M-15 4 H-20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.94s forwards" }}
          />
          <path d="M15 4 H20" stroke={GLASS_CLR} strokeWidth="1.6" strokeLinecap="round"
            style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: "draw-heart 0.36s ease 1.94s forwards" }}
          />
          {/* eyes */}
          <circle cx="-8" cy="4" r="2" fill={SALLY_PINK}
            style={{ opacity: 0, animation: "fade-in-up 0.45s ease 2.05s forwards" }}
          />
          <circle cx="8" cy="4" r="2" fill={SALLY_PINK}
            style={{ opacity: 0, animation: "fade-in-up 0.45s ease 2.05s forwards" }}
          />
          {/* tiny "S" label above */}
          <text x="0" y="-20" textAnchor="middle" fontSize="7" fontFamily="Cabinet Grotesk, sans-serif"
            fontWeight="700" fill={SALLY_PINK} letterSpacing="1"
            style={{ opacity: 0, animation: "fade-in-up 0.54s ease 1.8s forwards" }}
          >SALLY</text>
        </g>

        {/* ── MERGE RING PULSES ─────────────────────────────────────── */}
        {[0, 120, 240].map((delay, i) => (
          <circle key={i} cx="0" cy="0" r="0"
            stroke={TOGETHER} strokeWidth="1.2" opacity="0"
            style={{ animation: `ring-pulse 1.26s ease-out ${2.92 + i * 0.22}s forwards` }}
          />
        ))}

        {/* ── MERGED HEART (purple, centre) ────────────────────────── */}
        <g style={{ opacity: 0, animation: "merge-pop 0.99s cubic-bezier(0.34,1.4,0.64,1) 2.84s forwards" }}>
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
            style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "draw-heart 0.72s ease 3.51s forwards" }}
          />
          <circle cx="11" cy="5" r="9.5"
            stroke={GLASS_CLR} strokeWidth="1.8"
            style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "draw-heart 0.72s ease 3.74s forwards" }}
          />
          {/* bridge */}
          <path d="M-1.5 5 H1.5" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.36s ease 4.0s forwards" }}
          />
          {/* arms */}
          <path d="M-20.5 5 H-26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.36s ease 4.07s forwards" }}
          />
          <path d="M20.5 5 H26" stroke={GLASS_CLR} strokeWidth="1.8" strokeLinecap="round"
            style={{ strokeDasharray: 8, strokeDashoffset: 8, animation: "draw-heart 0.36s ease 4.07s forwards" }}
          />

          {/* spiral eyes — heart eyes (two tiny swirls) */}
          {/* left eye: star/heart */}
          <text x="-11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER}
            style={{ opacity: 0, animation: "fade-in-up 0.54s ease 4.14s forwards" }}
          >♥</text>
          <text x="11" y="9" textAnchor="middle" fontSize="7" fill={TOGETHER}
            style={{ opacity: 0, animation: "fade-in-up 0.54s ease 4.14s forwards" }}
          >♥</text>

          {/* ── CROWN on top ── */}
          <g style={{ opacity: 0, animation: "crown-drop 0.9s cubic-bezier(0.34,1.4,0.64,1) 4.1s forwards" }}>
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
            [-38, -28, "✦", JACK_BLUE,  4.36, 9],
            [ 42, -22, "✦", SALLY_PINK, 4.5, 9],
            [-44,  10, "✸", TOGETHER,   4.64, 8],
            [ 46,  14, "✸", JACK_BLUE,  4.46, 8],
            [ -4,  42, "★", SALLY_PINK, 4.72, 10],
            [  0, -48, "·", TOGETHER,   4.28, 14],
          ].map(([x, y, char, color, delay, size], i) => (
            <text key={i}
              x={x as number} y={y as number}
              textAnchor="middle" fontSize={size as number}
              fill={color as string} fontWeight="bold"
              style={{ opacity: 0, animation: `twinkle 1.26s ease ${delay}s forwards`, transformOrigin: `${x}px ${y}px` }}
            >{char}</text>
          ))}

          {/* ── small heart between them before merge — the "click" ── */}
          {/* tiny beating heart at dead centre */}
          <path d="M0 3 C-4 -1 -7 -1 -7 -4 C-7 -7 -4 -8 0 -5 C4 -8 7 -7 7 -4 C7 -1 4 -1 0 3Z"
            stroke={TOGETHER} strokeWidth="1.2" strokeOpacity="0.4"
            style={{ opacity: 0, animation: "fade-in-up 0.72s ease 4.28s forwards" }}
          />
        </g>
      </svg>

      {/* Name tag */}
      <div
        className="mt-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase"
        style={{ opacity: 0, animation: "name-in 1.08s ease 4.5s forwards" }}
      >
        <span style={{ color: JACK_BLUE }}>Jack</span>
        <span style={{ color: TOGETHER, fontSize: 14 }}>♥</span>
        <span style={{ color: SALLY_PINK }}>Sally</span>
      </div>

      {/* App name */}
      <div
        className="mt-3 text-[10px] text-white/50 tracking-[0.3em] uppercase font-semibold"
        style={{ opacity: 0, animation: "fade-in-up 0.9s ease 4.72s forwards" }}
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
            <Route path="/jack">{() => <JackPage sub="profile" />}</Route>
            <Route path="/jack/collections">{() => <JackPage sub="collections" />}</Route>
            <Route path="/sally">{() => <SallyPage sub="profile" />}</Route>
            <Route path="/sally/collections">{() => <SallyPage sub="collections" />}</Route>
            <Route path="/together">{() => <TogetherPage sub="profile" />}</Route>
            <Route path="/together/collections">{() => <TogetherPage sub="collections" />}</Route>
            <Route path="/together/links">{() => <TogetherPage sub="links" />}</Route>
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
