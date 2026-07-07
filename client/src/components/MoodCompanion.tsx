/**
 * MoodCompanion — an animated daily mood pet for Jack & Sally.
 *
 * Jack's companion:  a little ghost skull — round head, hollow eyes that
 *   change shape with mood, wispy tail that sways, occasional spook reactions.
 *
 * Sally's companion: a little spirit fox — pointed ears, bushy tail, eyes
 *   that go star-shaped when happy, teardrops when sad, hearts when loving.
 *
 * Each companion:
 *  - Breathes (gentle bob) when idle
 *  - Reacts with a big animation burst when clicked
 *  - Expression, colour, ambient particles all change with mood
 *  - Mood picker: 8 moods with emoji + label, persisted daily to DB
 *  - Note: short optional thought for the day
 *  - Shows last 7 days as tiny mood history dots
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Pencil, Check, X } from "lucide-react";
import type { DailyMood } from "@shared/schema";

// ── Mood definitions ──────────────────────────────────────────────────────────

export type MoodKey =
  | "happy" | "sad" | "hyped" | "cozy" | "tired"
  | "loved" | "chaotic" | "numb";

interface MoodDef {
  key: MoodKey;
  emoji: string;
  label: string;
  color: string;      // glow / accent for this mood
  particles: string;  // emoji particle that floats up on click
  phrase: string[];   // random companion speech
}

export const MOODS: MoodDef[] = [
  {
    key: "happy",
    emoji: "✨", label: "Happy",
    color: "#facc15",
    particles: "⭐",
    phrase: [
      "Today feels like the first episode of a banger.",
      "I'm literally vibrating with good vibes rn.",
      "If happiness had a OST, today would be track 1.",
    ],
  },
  {
    key: "sad",
    emoji: "🌧️", label: "Sad",
    color: "#60a5fa",
    particles: "💧",
    phrase: [
      "It's okay. Even the best arcs have sad episodes.",
      "I'll sit with you. No words needed.",
      "Rain is just the sky's way of feeling things too.",
    ],
  },
  {
    key: "hyped",
    emoji: "⚡", label: "Hyped",
    color: "#f97316",
    particles: "⚡",
    phrase: [
      "LETS GOOOOO. New episode just dropped??",
      "The energy in here is unreal right now.",
      "You're giving main character arc. I love to see it.",
    ],
  },
  {
    key: "cozy",
    emoji: "🍵", label: "Cozy",
    color: "#a78bfa",
    particles: "🌿",
    phrase: [
      "Blanket? Check. Hot drink? Check. Perfect day.",
      "The world can wait. Today is for slow-living.",
      "Soft and warm, like a slice-of-life ending.",
    ],
  },
  {
    key: "tired",
    emoji: "😴", label: "Tired",
    color: "#94a3b8",
    particles: "💤",
    phrase: [
      "Rest is valid. Even Gojo sleeps.",
      "The grind can wait. Nap arc activated.",
      "Low battery mode. Recharging in progress.",
    ],
  },
  {
    key: "loved",
    emoji: "💖", label: "Loved",
    color: "#f472b6",
    particles: "💗",
    phrase: [
      "The warm fuzzy feeling that hits at episode endings.",
      "Surrounded by good people. Rare item acquired.",
      "Love is the best media of all, honestly.",
    ],
  },
  {
    key: "chaotic",
    emoji: "🌀", label: "Chaotic",
    color: "#c084fc",
    particles: "🌀",
    phrase: [
      "Everything is happening and I'm HERE for it.",
      "Current mood: plot twist in episode 11.",
      "Chaotic neutral and thriving. Don't ask.",
    ],
  },
  {
    key: "numb",
    emoji: "🩶", label: "Numb",
    color: "#6b7280",
    particles: "🩶",
    phrase: [
      "Not every day needs to be a plot point.",
      "Existing quietly. That's enough.",
      "The void isn't empty. It's just… still.",
    ],
  },
];

function getMoodDef(key: string | null | undefined): MoodDef {
  return MOODS.find(m => m.key === key) ?? MOODS[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Particle burst ────────────────────────────────────────────────────────────

interface Particle { id: number; x: number; y: number; emoji: string; angle: number; speed: number }

function ParticleBurst({ particles, active, color }: { particles: Particle[]; active: boolean; color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
      {active && particles.map(p => (
        <div
          key={p.id}
          className="absolute text-lg select-none"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            animation: `particle-fly-${p.id % 4} 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            transform: `rotate(${p.angle}deg)`,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

// ── Jack's companion: Ghost Skull ─────────────────────────────────────────────

function JackCreature({ mood, isReacting, onClick }: {
  mood: MoodKey; isReacting: boolean; onClick: () => void;
}) {
  const def = getMoodDef(mood);
  const c = def.color;

  // Eye shapes per mood
  const eyes = {
    happy:   { l: "M-7,-2 Q-5,-5 -3,-2",   r: "M3,-2 Q5,-5 7,-2" },   // happy arcs
    sad:     { l: "M-7,-5 Q-5,-1 -3,-4",    r: "M3,-5 Q5,-1 7,-4" },   // droopy
    hyped:   { l: "circle",                  r: "circle" },              // big rounds
    cozy:    { l: "M-7,-3 Q-5,-5 -3,-3",    r: "M3,-3 Q5,-5 7,-3" },   // soft squint
    tired:   { l: "M-7,-3 L-3,-3",          r: "M3,-3 L7,-3" },         // flat lines
    loved:   { l: "heart",                   r: "heart" },               // hearts
    chaotic: { l: "M-7,-5 L-5,-1 L-3,-5",  r: "M3,-5 L5,-1 L7,-5" }, // jagged
    numb:    { l: "M-7,-3 L-3,-3",          r: "M3,-3 L7,-3" },         // flat
  };
  const eye = eyes[mood];

  const renderEye = (side: "l" | "r") => {
    const ey = eye[side];
    const cx = side === "l" ? -5 : 5;
    if (ey === "circle") return <circle cx={cx} cy={-3} r={2.5} fill={c} />;
    if (ey === "heart") return (
      <g transform={`translate(${cx}, -4) scale(0.6)`}>
        <path d="M0,2 C0,2 -5,-2 -5,-5 C-5,-8 0,-7 0,-4 C0,-7 5,-8 5,-5 C5,-2 0,2 0,2Z" fill={c} />
      </g>
    );
    return <path d={ey} stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />;
  };

  // Mouth per mood
  const mouths: Record<MoodKey, React.ReactNode> = {
    happy:   <path d="M-6,8 Q0,13 6,8"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    sad:     <path d="M-6,12 Q0,8 6,12"  stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    hyped:   <path d="M-7,7 Q0,16 7,7"   stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />,
    cozy:    <path d="M-4,9 Q0,12 4,9"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    tired:   <path d="M-5,10 L5,10"      stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    loved:   <path d="M-5,8 Q0,14 5,8"  stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />,
    chaotic: <path d="M-7,9 L-4,12 L-1,8 L2,12 L5,9 L7,11" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    numb:    <path d="M-5,10 L5,10"     stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
  };

  return (
    <svg
      viewBox="-45 -55 90 110"
      width={160} height={160}
      onClick={onClick}
      className="cursor-pointer select-none"
      style={{ filter: `drop-shadow(0 0 ${isReacting ? 24 : 12}px ${c}88)`, transition: "filter 0.3s ease", overflow: "visible" }}
    >
      <style>{`
        .jack-companion { animation: companion-bob 3s ease-in-out infinite; }
        .jack-reacting  { animation: companion-react 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .jack-tail { animation: tail-sway 2.5s ease-in-out infinite; transform-origin: 0px 20px; }
        .jack-wisp1 { animation: wisp-float 3s ease-in-out infinite; transform-origin: center; }
        .jack-wisp2 { animation: wisp-float 3.5s 0.5s ease-in-out infinite; transform-origin: center; }
        .jack-wisp3 { animation: wisp-float 2.8s 1s ease-in-out infinite; transform-origin: center; }
        @keyframes companion-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes companion-react {
          0% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.35) rotate(-8deg); }
          60% { transform: scale(0.9) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes tail-sway {
          0%, 100% { transform: rotate(-8deg) translateX(0px); }
          50% { transform: rotate(8deg) translateX(2px); }
        }
        @keyframes wisp-float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
          50% { transform: translateY(-4px) scale(1.1); opacity: 1; }
        }
      `}</style>

      <g className={isReacting ? "jack-reacting" : "jack-companion"}>
        {/* Ghost tail wisps */}
        <g className="jack-tail">
          <path
            d="M-18,22 Q-22,32 -18,38 Q-14,44 -18,50 Q-10,56 -2,50"
            stroke={`${c}60`} strokeWidth="2.5" strokeLinecap="round" fill="none"
          />
          <path
            d="M18,22 Q22,32 18,38 Q14,44 18,50 Q10,56 2,50"
            stroke={`${c}60`} strokeWidth="2.5" strokeLinecap="round" fill="none"
          />
          <path
            d="M0,24 Q0,34 0,40 Q-3,46 0,50"
            stroke={`${c}80`} strokeWidth="2" strokeLinecap="round" fill="none"
          />
        </g>

        {/* Body (ghost blob) */}
        <ellipse cx="0" cy="0" rx="20" ry="22" fill={`${c}15`} />
        <path
          d="M-20,-5 Q-20,-28 0,-28 Q20,-28 20,-5 L20,20 Q10,24 0,24 Q-10,24 -20,20 Z"
          fill={`${c}22`} stroke={`${c}55`} strokeWidth="1.5"
        />

        {/* Eyes */}
        <g>{renderEye("l")}</g>
        <g>{renderEye("r")}</g>

        {/* Mouth */}
        {mouths[mood]}

        {/* Floating wisps around head */}
        <circle className="jack-wisp1" cx="-28" cy="-18" r="3" fill={`${c}55`} />
        <circle className="jack-wisp2" cx="30"  cy="-22" r="2" fill={`${c}44`} />
        <circle className="jack-wisp3" cx="-26" cy="5"   r="2" fill={`${c}33`} />

        {/* Skull cross on forehead */}
        <line x1="-4" y1="-20" x2="4" y2="-12" stroke={`${c}55`} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="4"  y1="-20" x2="-4" y2="-12" stroke={`${c}55`} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ── Sally's companion: Spirit Fox ─────────────────────────────────────────────

function SallyCreature({ mood, isReacting, onClick }: {
  mood: MoodKey; isReacting: boolean; onClick: () => void;
}) {
  const def = getMoodDef(mood);
  const c = def.color;

  const eyeShapes: Record<MoodKey, React.ReactNode> = {
    happy:   <><path d="M-9,-2 Q-7,-5 -5,-2" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M5,-2 Q7,-5 9,-2" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" /></>,
    sad:     <><circle cx="-7" cy="-3" r="2" fill={c} opacity="0.9" /><circle cx="7" cy="-3" r="2" fill={c} opacity="0.9" /><path d="M-9,-7 Q-7,-5 -5,-7" stroke={c} strokeWidth="1.2" fill="none" /><path d="M5,-7 Q7,-5 9,-7" stroke={c} strokeWidth="1.2" fill="none" /></>,
    hyped:   <><circle cx="-7" cy="-3" r="3" fill={c} /><circle cx="7" cy="-3" r="3" fill={c} /><circle cx="-6" cy="-4" r="1" fill="white" /><circle cx="8" cy="-4" r="1" fill="white" /></>,
    cozy:    <><path d="M-9,-3 Q-7,-6 -5,-3" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M5,-3 Q7,-6 9,-3" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" /></>,
    tired:   <><path d="M-9,-3 L-5,-3" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M5,-3 L9,-3" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" /></>,
    loved: (
      <>
        <g transform="translate(-7,-5) scale(0.55)">
          <path d="M0,3 C0,3 -6,-2 -6,-6 C-6,-9 0,-8 0,-5 C0,-8 6,-9 6,-6 C6,-2 0,3 0,3Z" fill={c} />
        </g>
        <g transform="translate(7,-5) scale(0.55)">
          <path d="M0,3 C0,3 -6,-2 -6,-6 C-6,-9 0,-8 0,-5 C0,-8 6,-9 6,-6 C6,-2 0,3 0,3Z" fill={c} />
        </g>
      </>
    ),
    chaotic: (
      <>
        {/* star eyes */}
        {[[-7,-3],[7,-3]].map(([cx,cy],i) => (
          <g key={i} transform={`translate(${cx},${cy})`}>
            {[0,60,120].map(a => (
              <line key={a}
                x1={0} y1={-3} x2={0} y2={3}
                stroke={c} strokeWidth="1.5" strokeLinecap="round"
                transform={`rotate(${a})`}
              />
            ))}
          </g>
        ))}
      </>
    ),
    numb:    <><path d="M-9,-3 L-5,-3" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M5,-3 L9,-3" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" /></>,
  };

  const mouths: Record<MoodKey, React.ReactNode> = {
    happy:   <path d="M-6,8 Q0,13 6,8"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    sad:     <path d="M-5,12 Q0,8 5,12"  stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    hyped:   <path d="M-7,7 Q0,16 7,7"   stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />,
    cozy:    <path d="M-4,9 Q0,12 4,9"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    tired:   <path d="M-4,10 L4,10"      stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    loved:   <path d="M-5,8 Q0,14 5,8"   stroke={c} strokeWidth="2"   strokeLinecap="round" fill="none" />,
    chaotic: <path d="M-7,9 L-4,12 L-1,8 L2,12 L5,9 L7,11" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    numb:    <path d="M-4,10 L4,10"      stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
  };

  return (
    <svg
      viewBox="-50 -60 100 120"
      width={160} height={160}
      onClick={onClick}
      className="cursor-pointer select-none"
      style={{ filter: `drop-shadow(0 0 ${isReacting ? 24 : 12}px ${c}88)`, transition: "filter 0.3s ease", overflow: "visible" }}
    >
      <style>{`
        .sally-companion { animation: companion-bob 3.2s ease-in-out infinite; }
        .sally-reacting  { animation: companion-react 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .sally-tail { animation: fox-tail 2.8s ease-in-out infinite; transform-origin: -2px 18px; }
        .sally-ear-l { animation: ear-twitch 4s 0.5s ease-in-out infinite; transform-origin: -12px -30px; }
        .sally-ear-r { animation: ear-twitch 4s 1.5s ease-in-out infinite; transform-origin: 12px -30px; }
        .sally-petal1 { animation: petal-float 3s ease-in-out infinite; }
        .sally-petal2 { animation: petal-float 3.5s 0.7s ease-in-out infinite; }
        .sally-petal3 { animation: petal-float 4s 1.4s ease-in-out infinite; }
        @keyframes fox-tail {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes ear-twitch {
          0%, 85%, 100% { transform: rotate(0deg); }
          90% { transform: rotate(-8deg); }
          95% { transform: rotate(4deg); }
        }
        @keyframes petal-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-5px) rotate(10deg); opacity: 0.9; }
        }
      `}</style>

      <g className={isReacting ? "sally-reacting" : "sally-companion"}>

        {/* Tail */}
        <g className="sally-tail">
          <path
            d="M10,18 Q28,28 30,20 Q32,10 22,8 Q18,20 10,18Z"
            fill={`${c}30`} stroke={`${c}55`} strokeWidth="1.2"
          />
          {/* white tip */}
          <ellipse cx="27" cy="14" rx="5" ry="4" fill={`${c}22`} />
        </g>

        {/* Body */}
        <ellipse cx="0" cy="5" rx="18" ry="20" fill={`${c}18`} stroke={`${c}44`} strokeWidth="1.5" />

        {/* Head */}
        <circle cx="0" cy="-12" r="18" fill={`${c}20`} stroke={`${c}50`} strokeWidth="1.5" />

        {/* Ears */}
        <g className="sally-ear-l">
          <path d="M-12,-28 L-18,-48 L-4,-34 Z" fill={`${c}30`} stroke={`${c}55`} strokeWidth="1.2" />
          <path d="M-12,-30 L-16,-44 L-6,-34 Z" fill={`${c}55`} />
        </g>
        <g className="sally-ear-r">
          <path d="M12,-28 L18,-48 L4,-34 Z" fill={`${c}30`} stroke={`${c}55`} strokeWidth="1.2" />
          <path d="M12,-30 L16,-44 L6,-34 Z" fill={`${c}55`} />
        </g>

        {/* Snout */}
        <ellipse cx="0" cy="5" rx="7" ry="5" fill={`${c}15`} />
        {/* Nose */}
        <ellipse cx="0" cy="3" rx="2.5" ry="1.8" fill={`${c}90`} />

        {/* Eyes */}
        <g transform="translate(0, -14)">{eyeShapes[mood]}</g>

        {/* Mouth */}
        <g transform="translate(0, -14)">{mouths[mood]}</g>

        {/* Floating petals / sparkles around */}
        <g className="sally-petal1">
          <path d="M-30,-5 Q-28,-8 -25,-5 Q-28,-2 -30,-5Z" fill={`${c}55`} />
        </g>
        <g className="sally-petal2">
          <path d="M28,-10 Q30,-13 33,-10 Q30,-7 28,-10Z" fill={`${c}44`} />
        </g>
        <g className="sally-petal3">
          <circle cx="-32" cy="10" r="2" fill={`${c}40`} />
        </g>

        {/* Cheek blushes */}
        {(mood === "happy" || mood === "loved" || mood === "hyped") && (
          <>
            <ellipse cx="-13" cy="-7" rx="5" ry="3" fill={`${c}35`} />
            <ellipse cx="13"  cy="-7" rx="5" ry="3" fill={`${c}35`} />
          </>
        )}

        {/* Teardrop when sad */}
        {mood === "sad" && (
          <>
            <ellipse cx="-7" cy="-2" rx="1.5" ry="2.5" fill={`${c}70`} />
            <ellipse cx="7"  cy="-2" rx="1.5" ry="2.5" fill={`${c}70`} />
          </>
        )}
      </g>
    </svg>
  );
}

// ── Mood history mini-strip ───────────────────────────────────────────────────

function MoodHistoryStrip({ history, accent }: { history: DailyMood[]; accent: string }) {
  if (!history.length) return null;
  const last7 = history.slice(0, 7).reverse();

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {last7.map((h, i) => {
        const def = getMoodDef(h.mood);
        const isToday = h.date === todayISO();
        return (
          <div key={h.id} className="flex flex-col items-center gap-0.5 group relative" title={`${h.date}: ${def.label}`}>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-base transition-all border-2",
                isToday ? "scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"
              )}
              style={{
                background: `${def.color}22`,
                borderColor: isToday ? def.color : `${def.color}44`,
                boxShadow: isToday ? `0 0 10px ${def.color}55` : "none",
              }}
            >
              {def.emoji}
            </div>
            <span className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 whitespace-nowrap">
              {h.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Speech bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ text, accent, owner }: { text: string; accent: string; owner: string }) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(false);
    setDisplayText("");
    if (!text) return;

    const timeout = setTimeout(() => {
      setVisible(true);
      // Typewriter effect
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, 28);
      return () => clearInterval(interval);
    }, 200);

    timerRef.current = timeout;
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  if (!visible) return null;

  return (
    <div
      className="relative px-4 py-3 rounded-2xl text-sm font-medium max-w-[220px] text-center leading-snug"
      style={{
        background: `${accent}18`,
        border: `1px solid ${accent}40`,
        color: "rgba(255,255,255,0.85)",
        animation: "bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      }}
    >
      <style>{`
        @keyframes bubble-pop {
          from { transform: scale(0.7); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes particle-fly-0 { to { transform: translate(-50px, -90px) rotate(360deg); opacity: 0; } }
        @keyframes particle-fly-1 { to { transform: translate(60px, -80px) rotate(-360deg); opacity: 0; } }
        @keyframes particle-fly-2 { to { transform: translate(-20px, -100px) rotate(200deg); opacity: 0; } }
        @keyframes particle-fly-3 { to { transform: translate(40px, -70px) rotate(-200deg); opacity: 0; } }
      `}</style>
      {/* Tail */}
      <div
        className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `8px solid ${accent}40`,
        }}
      />
      {displayText}
      {displayText.length < text.length && (
        <span className="inline-block w-1 h-3 bg-current opacity-70 ml-0.5 animate-pulse" />
      )}
    </div>
  );
}

// ── Main MoodCompanion component ──────────────────────────────────────────────

interface MoodCompanionProps {
  owner: "jack" | "sally";
  accent: string;
}

export default function MoodCompanion({ owner, accent }: MoodCompanionProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = todayISO();

  const moodKey = ["/api/mood", owner, today];
  const histKey = ["/api/mood", owner, "history"];

  const { data: todayMood } = useQuery<DailyMood | null>({
    queryKey: moodKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/mood/${owner}?date=${today}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: history = [] } = useQuery<DailyMood[]>({
    queryKey: histKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/mood/${owner}/history`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const saveMood = useMutation({
    mutationFn: async ({ mood, note }: { mood: string; note?: string }) => {
      const r = await apiRequest("POST", `/api/mood/${owner}`, { mood, note, date: today });
      return r.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(moodKey, data);
      qc.setQueryData(histKey, (old: DailyMood[] = []) => {
        const filtered = old.filter(m => m.date !== today);
        return [data, ...filtered];
      });
    },
    onError: () => toast({ title: "Couldn't save mood", variant: "destructive" }),
  });

  const currentMood: MoodKey = (todayMood?.mood as MoodKey) ?? "happy";
  const currentDef = getMoodDef(currentMood);

  // State
  const [isReacting, setIsReacting] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particlesActive, setParticlesActive] = useState(false);
  const [speech, setSpeech] = useState("");
  const [showPicker, setShowPicker] = useState(!todayMood);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(todayMood?.note ?? "");

  // When mood loads, show picker if not set yet
  useEffect(() => {
    if (todayMood === undefined) return; // still loading
    setShowPicker(todayMood === null);
    setNoteText(todayMood?.note ?? "");
  }, [todayMood]);

  const triggerReaction = useCallback(() => {
    setIsReacting(true);
    const phraseList = currentDef.phrase;
    setSpeech(phraseList[Math.floor(Math.random() * phraseList.length)]);

    // Spawn particles
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: 80 + Math.random() * 20 - 10,
      y: 60 + Math.random() * 20 - 10,
      emoji: currentDef.particles,
      angle: Math.random() * 360,
      speed: Math.random() * 60 + 40,
    }));
    setParticles(newParticles);
    setParticlesActive(true);

    setTimeout(() => setIsReacting(false), 500);
    setTimeout(() => setParticlesActive(false), 1400);
    setTimeout(() => setSpeech(""), 5000);
  }, [currentDef]);

  function handleMoodSelect(key: MoodKey) {
    saveMood.mutate({ mood: key, note: noteText || undefined });
    setShowPicker(false);
    setTimeout(() => {
      setIsReacting(true);
      const def = getMoodDef(key);
      setSpeech(def.phrase[Math.floor(Math.random() * def.phrase.length)]);
      setTimeout(() => setIsReacting(false), 500);
      setTimeout(() => setSpeech(""), 5000);
    }, 100);
  }

  function handleSaveNote() {
    saveMood.mutate({ mood: currentMood, note: noteText || undefined });
    setNoteOpen(false);
    toast({ title: "Note saved 📝" });
  }

  const glowColor = currentDef.color;

  return (
    <div
      className="rounded-3xl border p-6 space-y-5 relative overflow-hidden"
      style={{
        borderColor: `${glowColor}30`,
        background: `radial-gradient(ellipse at 50% 0%, ${glowColor}10 0%, transparent 70%)`,
      }}
    >
      {/* Ambient glow blob */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse, ${glowColor}18 0%, transparent 70%)`,
          filter: "blur(20px)",
          transition: "background 0.8s ease",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: glowColor }}>
            Daily companion
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {todayMood && (
            <button
              onClick={() => setNoteOpen(!noteOpen)}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1"
            >
              <Pencil size={9} /> Note
            </button>
          )}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            {showPicker ? "Cancel" : "Change mood"}
          </button>
        </div>
      </div>

      {/* Creature + speech */}
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="relative">
          <ParticleBurst particles={particles} active={particlesActive} color={glowColor} />
          {owner === "jack"
            ? <JackCreature mood={currentMood} isReacting={isReacting} onClick={triggerReaction} />
            : <SallyCreature mood={currentMood} isReacting={isReacting} onClick={triggerReaction} />
          }
        </div>
        {speech && <SpeechBubble text={speech} accent={glowColor} owner={owner} />}
        {!speech && todayMood && (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: glowColor }}>
            <span className="text-xl">{currentDef.emoji}</span>
            {currentDef.label}
          </div>
        )}
        {!todayMood && !showPicker && (
          <p className="text-xs text-muted-foreground italic">How are you feeling today? ↑ tap the companion or pick a mood below</p>
        )}
      </div>

      {/* Note field */}
      {noteOpen && (
        <div className="relative z-10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's thought</p>
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="A line about today…"
              rows={2}
              className="flex-1 rounded-xl border border-border bg-secondary/30 text-sm px-3 py-2 resize-none focus:outline-none focus:border-border/80 placeholder:text-muted-foreground/50"
              style={{ color: "rgba(255,255,255,0.8)" }}
            />
            <div className="flex flex-col gap-1">
              <button onClick={handleSaveNote} className="w-8 h-8 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-500/15 transition-colors"><Check size={13} /></button>
              <button onClick={() => setNoteOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"><X size={13} /></button>
            </div>
          </div>
          {todayMood?.note && noteText === todayMood.note && (
            <p className="text-xs text-muted-foreground italic">&ldquo;{todayMood.note}&rdquo;</p>
          )}
        </div>
      )}

      {/* Mood picker */}
      {showPicker && (
        <div className="relative z-10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">How are you feeling?</p>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => handleMoodSelect(m.key)}
                disabled={saveMood.isPending}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all duration-200 hover:scale-105 active:scale-95",
                  currentMood === m.key && !showPicker ? "scale-105" : ""
                )}
                style={{
                  background: currentMood === m.key ? `${m.color}22` : "rgba(255,255,255,0.03)",
                  borderColor: currentMood === m.key ? m.color : "transparent",
                  boxShadow: currentMood === m.key ? `0 0 12px ${m.color}44` : "none",
                }}
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mood history */}
      {history.length > 0 && (
        <div className="relative z-10 space-y-2 pt-2 border-t border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent</p>
          <MoodHistoryStrip history={history} accent={glowColor} />
          {todayMood?.note && !noteOpen && (
            <p className="text-[11px] text-muted-foreground italic text-center mt-1">
              &ldquo;{todayMood.note}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
