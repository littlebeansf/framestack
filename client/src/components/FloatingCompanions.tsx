/**
 * FloatingCompanions — Jack & Sally chatting together in the bottom-right corner.
 *
 * Desktop-only. Fixed position, always visible over all content.
 * Features:
 *  - Jack (ghost skull) + Sally (chibi fox) side by side
 *  - Small mood emoji badge above each creature's head — click to change mood
 *  - Auto-chat: every 18–30s they say something cute to each other (alternating)
 *  - Periodic idle animations (shake, spin, bounce) to stay lively
 *  - Click on creature → particle burst + speech bubble reaction
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { DailyMood } from "@shared/schema";

// ── Mood definitions (mirrors MoodCompanion.tsx) ──────────────────────────────

export type MoodKey =
  | "happy" | "sad" | "hyped" | "cozy" | "tired"
  | "loved" | "chaotic" | "numb"
  | "horny" | "thirsty" | "feral" | "down bad" | "brainrot" | "unhinged" | "wet" | "touch starved";

interface MoodDef {
  key: MoodKey;
  emoji: string;
  label: string;
  color: string;
  particles: string;
  phrase: string[];     // things this companion says solo
  toOther: string[];    // things they say TO the other companion
}

const MOODS: MoodDef[] = [
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
    toOther: [
      "You look adorable today, just saying.",
      "Can you feel how good today is? ✨",
      "Glad we're here together on a day like this~",
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
    toOther: [
      "Hey… can you just sit next to me for a bit?",
      "It's one of those days. Being here helps though.",
      "You always make it a little better, you know.",
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
    toOther: [
      "HEYYY ARE YOU READY BECAUSE I AM NOT CALM.",
      "Tell me you feel this energy. Please.",
      "This is peak. We are literally at PEAK right now.",
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
    toOther: [
      "Don't move. This moment is perfect as it is.",
      "I could stay in this corner forever with you.",
      "Cozy weather, cozy vibes, cozy us. 🍵",
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
    toOther: [
      "…can we just… not move for a while",
      "I'm here. Just… very quietly.",
      "Zzz… oh wait I'm awake. Mostly.",
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
    toOther: [
      "I'm really glad you're here, you know that? 💖",
      "Just wanted to say — you make this place feel right.",
      "This is my favourite place to be. With you.",
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
    toOther: [
      "Did you see that?! What even IS life right now.",
      "I have THREE things to tell you. None make sense.",
      "WAIT— okay never mind. Or actually wait—",
    ],
  },
  {
    key: "horny",
    emoji: "🔥", label: "Horny",
    color: "#ff4d6d",
    particles: "🌶️",
    phrase: [
      "I am NOT okay right now and it's everyone's fault.",
      "My brain went somewhere it should not have gone.",
      "I need to go touch grass. Or something else.",
    ],
    toOther: [
      "Hey so… you ever just… nevermind.",
      "Stop existing like that. It's rude.",
      "I'm fine. Everything's fine. You're just very close.",
    ],
  },
  {
    key: "thirsty",
    emoji: "💦", label: "Thirsty",
    color: "#38bdf8",
    particles: "💦",
    phrase: [
      "It's giving everything and I mean EVERYTHING.",
      "Someone send help. Or don't. I'm good.",
      "My standards lowered and my needs got louder.",
    ],
    toOther: [
      "Why do you have to exist like THAT.",
      "You're doing this on purpose and we both know it.",
      "I'm hydrated. Not in the way I want to be.",
    ],
  },
  {
    key: "feral",
    emoji: "🐺", label: "Feral",
    color: "#a855f7",
    particles: "😈",
    phrase: [
      "Lost the plot. Found something better.",
      "Civilised? Never heard of her.",
      "Operating purely on instinct rn. Pray for me.",
    ],
    toOther: [
      "You wouldn't survive five minutes in my brain right now.",
      "I am feral and it's your fault for being attractive.",
      "Don't make eye contact. I'm not responsible for what happens.",
    ],
  },
  {
    key: "down bad",
    emoji: "😩", label: "Down Bad",
    color: "#f43f5e",
    particles: "😭",
    phrase: [
      "I am at rock bottom and it's kind of freeing.",
      "Down bad doesn't cover it. Down catastrophic.",
      "Send thoughts and prayers. And also someone.",
    ],
    toOther: [
      "It's you. It's always been you. I hate this.",
      "I'm spiralling and you're the reason. Thanks.",
      "This is your fault and I need you to fix it immediately.",
    ],
  },
  {
    key: "brainrot",
    emoji: "🧠", label: "Brainrot",
    color: "#ec4899",
    particles: "💀",
    phrase: [
      "My brain is 90% unhinged thoughts and 10% regret.",
      "I have consumed too much content and now I am the content.",
      "The rot has set in. I am at peace with this.",
    ],
    toOther: [
      "I've been thinking about you in ways that aren't legal in some countries.",
      "I need a lobotomy and also your number.",
      "My brain broke and you were the last thing it saw.",
    ],
  },
  {
    key: "unhinged",
    emoji: "🌪️", label: "Unhinged",
    color: "#d946ef",
    particles: "⚡",
    phrase: [
      "Completely off the rails. Choo choo.",
      "I said what I said and I'll say it again louder.",
      "Normal? I am so far past normal it's a dot.",
    ],
    toOther: [
      "I am thinking THOUGHTS and they are ALL about you.",
      "You look too good right now and I cannot be held responsible.",
      "Someone needs to stop me. Not you though. Don't you dare.",
    ],
  },
  {
    key: "wet",
    emoji: "🌊", label: "Wet",
    color: "#06b6d4",
    particles: "💧",
    phrase: [
      "Completely soaked. Metaphorically. Mostly.",
      "It started as a vibe and now it's a whole situation.",
      "I am dripping with something and it's called want.",
    ],
    toOther: [
      "You did this. Own it.",
      "My composure left the chat. You were the reason.",
      "I was doing fine until you showed up like THAT.",
    ],
  },
  {
    key: "touch starved",
    emoji: "🫂", label: "Touch Starved",
    color: "#fb7185",
    particles: "💞",
    phrase: [
      "I just want someone's hand. Or everything. Either.",
      "Skin hunger is real and it's eating me alive.",
      "I need to be held and I'm not joking at all.",
    ],
    toOther: [
      "Come here. Just. Come here.",
      "I'm not asking. I'm manifesting. You're coming over.",
      "If you touch my shoulder right now I will actually implode.",
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
    toOther: [
      "I don't have words today. But I'm still here.",
      "Just existing nearby. That's enough for now.",
      "….",
    ],
  },
];

function getMoodDef(key: string | null | undefined): MoodDef {
  return MOODS.find(m => m.key === key) ?? MOODS[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Particle system ───────────────────────────────────────────────────────────

interface Particle { id: number; emoji: string; angle: number }

function MiniParticles({ particles, active, color }: { particles: Particle[]; active: boolean; color: string }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 50 }}>
      {particles.map((p, i) => (
        <div
          key={p.id}
          className="absolute text-base select-none"
          style={{
            left: "50%", top: "40%",
            animation: `fc-fly-${i % 6} 1.1s cubic-bezier(0.22,1,0.36,1) forwards`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

// ── Speech bubble (pointing down toward creature) ─────────────────────────────

function ChatBubble({
  text, color, side, from,
}: { text: string; color: string; side: "left" | "right"; from: "jack" | "sally" }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [text]);

  if (!text) return null;

  // Position bubble above the companion pair, centered over the speaker
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        bottom: "100%",
        [side === "left" ? "left" : "right"]: 0,
        marginBottom: 8,
        zIndex: 60,
        maxWidth: 190,
        minWidth: 120,
      }}
    >
      <div
        className="rounded-2xl px-3 py-2 text-[11px] font-medium leading-snug shadow-lg"
        style={{
          background: `rgba(18,18,28,0.97)`,
          border: `1.5px solid ${color}55`,
          color: "#e8e8f0",
          boxShadow: `0 4px 24px ${color}33`,
        }}
      >
        {displayed}
        {displayed.length < text.length && (
          <span className="inline-block w-0.5 h-3 bg-current opacity-60 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
      {/* Tail */}
      <div
        className="absolute"
        style={{
          bottom: -7,
          [side === "left" ? "left" : "right"]: 24,
          width: 0, height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderTop: `7px solid ${color}55`,
        }}
      />
    </div>
  );
}

// ── Mood picker overlay ────────────────────────────────────────────────────────

function MoodPicker({ onSelect, onClose, currentMood }: {
  onSelect: (k: MoodKey) => void;
  onClose: () => void;
  currentMood: MoodKey;
}) {
  return (
    <div
      className="absolute z-50 rounded-2xl border border-border/60 shadow-2xl p-3"
      style={{
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(14,14,22,0.98)",
        backdropFilter: "blur(16px)",
        width: 160,
      }}
    >
      <div className="grid grid-cols-4 gap-1">
        {MOODS.map(m => (
          <button
            key={m.key}
            onClick={() => { onSelect(m.key); onClose(); }}
            title={m.label}
            className="flex items-center justify-center p-1.5 rounded-xl border-2 transition-all hover:scale-125 active:scale-90 text-xl leading-none"
            style={{
              background: currentMood === m.key ? `${m.color}25` : "rgba(255,255,255,0.03)",
              borderColor: currentMood === m.key ? m.color : "transparent",
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Jack Creature (ghost skull) ────────────────────────────────────────────────

function JackCreature({ mood, animClass, onClick, eyeOffset = { x: 0, y: 0 } }: {
  mood: MoodKey; animClass: string; onClick: () => void;
  eyeOffset?: { x: number; y: number };
}) {
  const def = getMoodDef(mood);
  const c = def.color;
  // Eye tracking: offset for pupils (clamped to ±1.8)
  const px = eyeOffset.x * 1.8;
  const py = eyeOffset.y * 1.4;

  const eyes = {
    happy:   { l: "M-7,-2 Q-5,-5 -3,-2",   r: "M3,-2 Q5,-5 7,-2" },
    sad:     { l: "M-7,-5 Q-5,-1 -3,-4",    r: "M3,-5 Q5,-1 7,-4" },
    hyped:   { l: "circle",                  r: "circle" },
    cozy:    { l: "M-7,-3 Q-5,-5 -3,-3",    r: "M3,-3 Q5,-5 7,-3" },
    tired:   { l: "M-7,-3 L-3,-3",          r: "M3,-3 L7,-3" },
    loved:   { l: "heart",                   r: "heart" },
    chaotic: { l: "M-7,-5 L-5,-1 L-3,-5",  r: "M3,-5 L5,-1 L7,-5" },
    numb:         { l: "M-7,-3 L-3,-3",          r: "M3,-3 L7,-3" },
    horny:        { l: "heart",                   r: "heart" },
    thirsty:      { l: "circle",                  r: "circle" },
    feral:        { l: "M-7,-5 L-5,-1 L-3,-5",  r: "M3,-5 L5,-1 L7,-5" },
    "down bad":   { l: "M-7,-5 Q-5,-1 -3,-4",    r: "M3,-5 Q5,-1 7,-4" },
    brainrot:     { l: "circle",                  r: "circle" },
    unhinged:     { l: "M-7,-5 L-5,-1 L-3,-5",  r: "M3,-5 L5,-1 L7,-5" },
    wet:          { l: "M-7,-3 Q-5,-5 -3,-3",    r: "M3,-3 Q5,-5 7,-3" },
    "touch starved": { l: "M-7,-2 Q-5,-5 -3,-2", r: "M3,-2 Q5,-5 7,-2" },
  };
  // Guard: fallback to "happy" eyes if mood not in map
  const eye = eyes[mood as keyof typeof eyes] ?? eyes.happy;

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

  const mouths: Record<MoodKey, React.ReactNode> = {
    happy:   <path d="M-6,8 Q0,13 6,8"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    sad:     <path d="M-6,12 Q0,8 6,12"  stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    hyped:   <path d="M-7,7 Q0,16 7,7"   stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />,
    cozy:    <path d="M-4,9 Q0,12 4,9"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    tired:   <path d="M-5,10 L5,10"      stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    loved:   <path d="M-5,8 Q0,14 5,8"  stroke={c} strokeWidth="2"   strokeLinecap="round" fill="none" />,
    chaotic: <path d="M-7,9 L-4,12 L-1,8 L2,12 L5,9 L7,11" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    numb:           <path d="M-5,10 L5,10"     stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    horny:          <path d="M-5,8 Q0,15 5,8"  stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />,
    thirsty:        <path d="M-7,7 Q0,16 7,7"   stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />,
    feral:          <path d="M-7,9 L-4,12 L-1,8 L2,12 L5,9 L7,11" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />,
    "down bad":     <path d="M-6,12 Q0,8 6,12"  stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    brainrot:       <path d="M-5,8 Q-2,14 0,10 Q2,14 5,8" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    unhinged:       <path d="M-7,7 Q0,18 7,7"   stroke={c} strokeWidth="2.8" strokeLinecap="round" fill="none" />,
    wet:            <path d="M-4,9 Q0,12 4,9"   stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    "touch starved":<path d="M-6,8 Q0,14 6,8"   stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />,
  };

  return (
    <svg
      viewBox="-45 -55 90 110"
      width={110} height={110}
      onClick={onClick}
      className={cn("cursor-pointer select-none", animClass)}
      style={{ filter: `drop-shadow(0 0 10px ${c}88)`, overflow: "visible" }}
    >
      <style>{`
        .fc-jack-bob  { animation: fc-bob 3s ease-in-out infinite; }
        .fc-jack-react{ animation: fc-react 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .fc-jack-shake{ animation: fc-shake 0.4s ease-in-out; }
        .fc-jack-spin { animation: fc-spin 0.6s ease-in-out; }
        .fc-jack-bounce{ animation: fc-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1); }
        .fc-jack-tail { animation: fc-tail 2.5s ease-in-out infinite; transform-origin: 0px 20px; }
        .fc-jack-wisp1{ animation: fc-wisp 3s ease-in-out infinite; }
        .fc-jack-wisp2{ animation: fc-wisp 3.5s 0.5s ease-in-out infinite; }
        .fc-jack-wisp3{ animation: fc-wisp 2.8s 1s ease-in-out infinite; }
        @keyframes fc-bob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes fc-react  { 0%{transform:scale(1) rotate(0)} 30%{transform:scale(1.3) rotate(-8deg)} 60%{transform:scale(0.9) rotate(5deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes fc-shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes fc-spin   { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes fc-bounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-14px)} 70%{transform:translateY(-6px)} }
        @keyframes fc-tail   { 0%,100%{transform:rotate(-8deg) translateX(0)} 50%{transform:rotate(8deg) translateX(2px)} }
        @keyframes fc-wisp   { 0%,100%{transform:translateY(0) scale(1);opacity:0.6} 50%{transform:translateY(-4px) scale(1.1);opacity:1} }
        @keyframes fc-fly-0  { to{transform:translate(-38px,-60px) rotate(360deg);opacity:0} }
        @keyframes fc-fly-1  { to{transform:translate(42px,-55px) rotate(-360deg);opacity:0} }
        @keyframes fc-fly-2  { to{transform:translate(-14px,-70px) rotate(200deg);opacity:0} }
        @keyframes fc-fly-3  { to{transform:translate(30px,-50px) rotate(-200deg);opacity:0} }
        @keyframes fc-fly-4  { to{transform:translate(-28px,-40px) rotate(120deg);opacity:0} }
        @keyframes fc-fly-5  { to{transform:translate(22px,-65px) rotate(-120deg);opacity:0} }
      `}</style>

      <g>
        <g className="fc-jack-tail">
          <path d="M-18,22 Q-22,32 -18,38 Q-14,44 -18,50 Q-10,56 -2,50" stroke={`${c}60`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M18,22 Q22,32 18,38 Q14,44 18,50 Q10,56 2,50" stroke={`${c}60`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M0,24 Q0,34 0,40 Q-3,46 0,50" stroke={`${c}80`} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
        <ellipse cx="0" cy="0" rx="20" ry="22" fill={`${c}15`} />
        <path
          d="M-20,-5 Q-20,-28 0,-28 Q20,-28 20,-5 L20,20 Q10,24 0,24 Q-10,24 -20,20 Z"
          fill={`${c}22`} stroke={`${c}55`} strokeWidth="1.5"
        />
        <g>{renderEye("l")}</g>
        <g>{renderEye("r")}</g>
        {/* Tracking pupils — only on moods that have visible eyes */}
        {![ "tired", "numb" ].includes(mood) && (
          <>
            <circle cx={-5 + px} cy={-3 + py} r="1.5" fill={c} opacity="0.7" />
            <circle cx={ 5 + px} cy={-3 + py} r="1.5" fill={c} opacity="0.7" />
          </>
        )}
        {mouths[mood]}
        <circle className="fc-jack-wisp1" cx="-28" cy="-18" r="3" fill={`${c}55`} />
        <circle className="fc-jack-wisp2" cx="30"  cy="-22" r="2" fill={`${c}44`} />
        <circle className="fc-jack-wisp3" cx="-26" cy="5"   r="2" fill={`${c}33`} />
        <line x1="-4" y1="-20" x2="4"  y2="-12" stroke={`${c}55`} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="4"  y1="-20" x2="-4" y2="-12" stroke={`${c}55`} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ── Sally Creature (chibi fox) ────────────────────────────────────────────────

function SallyCreature({ mood, animClass, onClick, eyeOffset = { x: 0, y: 0 } }: {
  mood: MoodKey; animClass: string; onClick: () => void;
  eyeOffset?: { x: number; y: number };
}) {
  const def = getMoodDef(mood);
  const c = def.color;
  // Eye tracking offset (clamped ±1.5)
  const px = eyeOffset.x * 1.5;
  const py = eyeOffset.y * 1.2;

  function Eye({ cx, mood: m }: { cx: number; mood: MoodKey }) {
    const base = (
      <>
        <ellipse cx={cx} cy={-8} rx={4.5} ry={4.5} fill="rgba(255,255,255,0.92)" />
        <ellipse cx={cx} cy={-7} rx={2.8} ry={3.2} fill={c} />
        {/* Iris + pupil shift with cursor */}
        <circle  cx={cx + px} cy={-8 + py} r={1.5}  fill="rgba(0,0,0,0.7)" />
        <circle  cx={cx + px + 0.7} cy={-9 + py} r={0.9} fill="rgba(255,255,255,0.9)" />
        <circle  cx={cx + px - 0.5} cy={-7.5 + py} r={0.45} fill="rgba(255,255,255,0.7)" />
      </>
    );
    if (m === "happy") return (
      <>
        {base}
        <path d={`M${cx - 4},-5.5 Q${cx},-3 ${cx + 4},-5.5`} stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      </>
    );
    if (m === "loved") return (
      <>
        <g transform={`translate(${cx}, -8) scale(0.7)`}>
          <path d="M0,2 C-4,-1 -5,-5 -2.5,-5 C-1,-5 0,-3.5 0,-3.5 C0,-3.5 1,-5 2.5,-5 C5,-5 4,-1 0,2Z" fill={c} />
          <circle cx="-1.5" cy="-1.5" r="0.7" fill="white" opacity="0.7" />
        </g>
      </>
    );
    if (m === "tired") return (
      <>
        <ellipse cx={cx} cy={-8} rx={4.5} ry={4.5} fill="rgba(255,255,255,0.92)" />
        <ellipse cx={cx} cy={-7} rx={2.8} ry={2} fill={c} />
        <path d={`M${cx-4.5},-8.5 Q${cx},-10.5 ${cx+4.5},-8.5`} stroke={`${c}99`} strokeWidth="1.4" strokeLinecap="round" fill={`${c}20`} />
      </>
    );
    if (m === "sad") return (
      <>
        {base}
        <path d={`M${cx-3.5},-12.5 L${cx-1},-10`} stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </>
    );
    if (m === "chaotic" || m === "feral" || m === "unhinged") return (
      <>
        {base}
        <circle cx={cx+2.5} cy={-11} r="1.2" fill={c} opacity="0.8" />
        <circle cx={cx-2.5} cy={-11} r="0.8" fill={c} opacity="0.6" />
      </>
    );
    if (m === "horny" || m === "touch starved") return (
      <>
        <g transform={`translate(${cx}, -8) scale(0.7)`}>
          <path d="M0,2 C-4,-1 -5,-5 -2.5,-5 C-1,-5 0,-3.5 0,-3.5 C0,-3.5 1,-5 2.5,-5 C5,-5 4,-1 0,2Z" fill={c} />
          <circle cx="-1.5" cy="-1.5" r="0.7" fill="white" opacity="0.7" />
        </g>
      </>
    );
    if (m === "thirsty" || m === "wet") return (
      <>
        {base}
        <path d={`M${cx-4.5},-4 Q${cx},-6.5 ${cx+4.5},-4`} stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      </>
    );
    if (m === "down bad" || m === "brainrot") return (
      <>
        {base}
        <path d={`M${cx-3.5},-12.5 L${cx-1},-10`} stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </>
    );
    return <>{base}</>;
  }

  const mouths: Record<MoodKey, React.ReactNode> = {
    happy:   <path d="M-5,2 Q0,6 5,2"    stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    sad:     <path d="M-4,4 Q0,1 4,4"    stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    hyped:   <path d="M-6,1 Q0,8 6,1"    stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />,
    cozy:    <path d="M-3,2 Q0,5 3,2"    stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    tired:   <path d="M-3,3 L3,3"        stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none" />,
    loved:   <path d="M-4,1 Q0,6 4,1"    stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    chaotic: <path d="M-5,2 L-3,5 L0,2 L3,5 L5,2" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    numb:           <path d="M-3,3 L3,3"        stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none" />,
    horny:          <path d="M-4,1 Q0,7 4,1"    stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />,
    thirsty:        <path d="M-6,1 Q0,8 6,1"    stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />,
    feral:          <path d="M-5,2 L-3,5 L0,2 L3,5 L5,2" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    "down bad":     <path d="M-4,4 Q0,1 4,4"    stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    brainrot:       <path d="M-4,1 Q-2,6 0,3 Q2,6 4,1" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    unhinged:       <path d="M-6,1 Q0,9 6,1"    stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />,
    wet:            <path d="M-3,2 Q0,5 3,2"    stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />,
    "touch starved":<path d="M-5,1 Q0,6 5,1"    stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
  };

  const showBlush = ["happy","loved","hyped","cozy","horny","thirsty","touch starved"].includes(mood);

  return (
    <svg
      viewBox="-42 -52 84 100"
      width={110} height={110}
      onClick={onClick}
      className={cn("cursor-pointer select-none", animClass)}
      style={{ filter: `drop-shadow(0 0 10px ${c}88)`, overflow: "visible" }}
    >
      <style>{`
        .fc-sally-bob   { animation: fc-bob 3.4s 0.4s ease-in-out infinite; }
        .fc-sally-react { animation: fc-react 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .fc-sally-shake { animation: fc-shake 0.4s ease-in-out; }
        .fc-sally-spin  { animation: fc-spin 0.6s ease-in-out; }
        .fc-sally-bounce{ animation: fc-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1); }
        .fc-sally-ear   { animation: fc-ear 3s ease-in-out infinite; transform-origin: 0px -26px; }
        .fc-sally-tail  { animation: fc-tail 2.8s 0.3s ease-in-out infinite; transform-origin: -8px 16px; }
        @keyframes fc-ear  { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(5deg)} }
        @keyframes fc-tail { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(10deg)} }
      `}</style>

      <g>
        {/* Tail */}
        <g className="fc-sally-tail">
          <path
            d="M8,18 Q28,10 30,0 Q32,-14 22,-20 Q16,-24 14,-18 Q20,-14 18,-6 Q16,4 8,14"
            fill={`${c}33`} stroke={`${c}77`} strokeWidth="1.5" strokeLinejoin="round"
          />
          <path
            d="M22,-20 Q28,-26 24,-28 Q18,-30 14,-22"
            fill={`${c}55`} stroke={`${c}99`} strokeWidth="1.2"
          />
        </g>

        {/* Body */}
        <ellipse cx="0" cy="12" rx="13" ry="15" fill={`${c}18`} stroke={`${c}44`} strokeWidth="1.2" />
        {/* Tummy patch */}
        <ellipse cx="0" cy="14" rx="7" ry="9" fill={`${c}10`} stroke={`${c}30`} strokeWidth="0.8" />

        {/* Ears (left) */}
        <g className="fc-sally-ear">
          <path d="M-16,-26 Q-22,-42 -14,-46 Q-8,-50 -8,-36 Z" fill={`${c}33`} stroke={`${c}77`} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M-15,-28 Q-18,-38 -13,-41 Q-10,-44 -9,-36 Z" fill={`${c}55`} />
        </g>
        {/* Ears (right) */}
        <g style={{ animation: "fc-ear 3s 0.3s ease-in-out infinite", transformOrigin: "0px -26px" }}>
          <path d="M16,-26 Q22,-42 14,-46 Q8,-50 8,-36 Z" fill={`${c}33`} stroke={`${c}77`} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M15,-28 Q18,-38 13,-41 Q10,-44 9,-36 Z" fill={`${c}55`} />
        </g>

        {/* Head */}
        <ellipse cx="0" cy="-10" rx="22" ry="21" fill={`${c}18`} stroke={`${c}44`} strokeWidth="1.3" />

        {/* Eyes */}
        <g transform="translate(0,0)">
          <Eye cx={-10} mood={mood} />
          <Eye cx={10}  mood={mood} />
        </g>

        {/* Nose */}
        <path d="M-2,-2 Q0,-4 2,-2 Q0,0 -2,-2Z" fill={c} opacity="0.85" />
        {/* Snout subtle oval */}
        <ellipse cx="0" cy="0" rx="5" ry="3.5" fill={`${c}10`} />

        {/* Mouth */}
        <g transform="translate(0, 4)">{mouths[mood]}</g>

        {/* Cheek blushes */}
        {showBlush && (
          <>
            <ellipse cx="-17" cy="-5" rx="4" ry="2.5" fill={c} opacity="0.22" />
            <ellipse cx="17"  cy="-5" rx="4" ry="2.5" fill={c} opacity="0.22" />
          </>
        )}

        {/* Chaotic sparkles */}
        {mood === "chaotic" && (
          <>
            <text x="-32" y="-28" fontSize="8" style={{ animation: "fc-wisp 1.5s ease-in-out infinite" }}>✦</text>
            <text x="26"  y="-30" fontSize="6" style={{ animation: "fc-wisp 2s 0.3s ease-in-out infinite" }}>✦</text>
          </>
        )}
        {/* Tired zzz */}
        {mood === "tired" && (
          <text x="20" y="-30" fontSize="9" fill={c} opacity="0.7" style={{ animation: "fc-wisp 2.5s ease-in-out infinite" }}>z</text>
        )}
        {/* Loved hearts */}
        {mood === "loved" && (
          <>
            <text x="-30" y="-28" fontSize="8" fill={c} style={{ animation: "fc-wisp 2s ease-in-out infinite" }}>♡</text>
            <text x="24"  y="-32" fontSize="6" fill={c} style={{ animation: "fc-wisp 2.5s 0.4s ease-in-out infinite" }}>♡</text>
          </>
        )}
      </g>
    </svg>
  );
}

// ── Individual companion panel ─────────────────────────────────────────────────

type AnimType = "bob" | "react" | "shake" | "spin" | "bounce";

function CompanionPanel({
  owner,
  speech,
  bubbleSide,
  onCreatureClick,
  onMoodChange,
  feralHop = null,
  eyeOffset = { x: 0, y: 0 },
}: {
  owner: "jack" | "sally";
  speech: string;
  bubbleSide: "left" | "right";
  onCreatureClick: () => void;
  onMoodChange: (k: MoodKey) => void;
  feralHop?: "jack" | "sally" | null;
  eyeOffset?: { x: number; y: number };
}) {
  const today = todayISO();
  const moodKey = ["/api/mood", owner, today];

  const { data: todayMood } = useQuery<DailyMood | null>({
    queryKey: moodKey,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/mood/${owner}?date=${today}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const saveMood = useMutation({
    mutationFn: async (mood: string) => {
      const r = await apiRequest("POST", `/api/mood/${owner}`, { mood, date: today });
      return r.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(moodKey, data);
    },
    onError: () => toast({ title: "Couldn't save mood", variant: "destructive" }),
  });

  const currentMood: MoodKey = (todayMood?.mood as MoodKey) ?? "happy";
  const def = getMoodDef(currentMood);

  // Keep parent mood ref in sync when mood loads from server
  useEffect(() => {
    onMoodChange(currentMood);
  }, [currentMood]); // eslint-disable-line react-hooks/exhaustive-deps

  const [animClass, setAnimClass] = useState(`fc-${owner}-bob`);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particlesActive, setParticlesActive] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Track current mood for use in timeouts
  const currentMoodRef = useRef(currentMood);
  currentMoodRef.current = currentMood;

  // Idle animation every 12–20s
  useEffect(() => {
    const IDLE_ANIMS: AnimType[] = ["shake", "bounce", "spin"];
    const BOB_CLASS = `fc-${owner}-bob`;

    function scheduleIdle() {
      const delay = 12_000 + Math.random() * 8_000;
      return setTimeout(() => {
        const anim = IDLE_ANIMS[Math.floor(Math.random() * IDLE_ANIMS.length)];
        setAnimClass(`fc-${owner}-${anim}`);
        setTimeout(() => setAnimClass(BOB_CLASS), 700);
        timer = scheduleIdle();
      }, delay);
    }

    let timer = scheduleIdle();
    return () => clearTimeout(timer);
  }, [owner]);

  function handleClick() {
    // Trigger react animation
    setAnimClass(`fc-${owner}-react`);
    setTimeout(() => setAnimClass(`fc-${owner}-bob`), 600);

    // Particles
    const mDef = getMoodDef(currentMoodRef.current);
    const newP: Particle[] = Array.from({ length: 7 }, (_, i) => ({
      id: Date.now() + i,
      emoji: mDef.particles,
      angle: Math.random() * 360,
    }));
    setParticles(newP);
    setParticlesActive(true);
    setTimeout(() => setParticlesActive(false), 1300);

    onCreatureClick();
  }

  function handleMoodSelect(k: MoodKey) {
    saveMood.mutate(k);
    onMoodChange(k);
    // React animation
    setAnimClass(`fc-${owner}-react`);
    setTimeout(() => setAnimClass(`fc-${owner}-bob`), 600);
  }

  const accent = owner === "jack" ? "hsl(220 80% 60%)" : "hsl(330 75% 65%)";

  return (
    <div className="relative flex flex-col items-center" style={{ width: 118 }}>
      {/* Chat bubble */}
      {speech && (
        <ChatBubble text={speech} color={def.color} side={bubbleSide} from={owner} />
      )}

      {/* Mood badge — floats above creature head, centered */}
      <div className="relative z-10 flex justify-center mb-1">
        <button
          onClick={() => setShowPicker(v => !v)}
          title="Change mood"
          className="text-base leading-none transition-transform hover:scale-125 active:scale-90"
        >
          {def.emoji}
        </button>
      </div>

      {/* Mood picker */}
      {showPicker && (
        <MoodPicker
          currentMood={currentMood}
          onSelect={handleMoodSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Creature */}
      <div
        className="relative"
        style={feralHop ? {
          animation: feralHop === "jack"
            ? "fc-feral-hop-jack 0.32s ease-in-out infinite alternate"
            : "fc-feral-hop-sally 0.28s 0.1s ease-in-out infinite alternate",
          transformOrigin: "bottom center",
          display: "inline-block",
        } : undefined}
      >
        <MiniParticles particles={particles} active={particlesActive} color={def.color} />
        {owner === "jack"
          ? <JackCreature mood={currentMood} animClass={animClass} onClick={handleClick} eyeOffset={eyeOffset} />
          : <SallyCreature mood={currentMood} animClass={animClass} onClick={handleClick} eyeOffset={eyeOffset} />
        }
      </div>


    </div>
  );
}

// ── Cross-companion chat lines ─────────────────────────────────────────────────

// Lines that one says to the other (indexed by [speaker][mood])
const CROSS_CHAT: Record<"jack" | "sally", Partial<Record<MoodKey, string[]>>> = {
  jack: {
    happy:   ["Hey Sal, you glowing today 👻", "Something good is in the air~", "Today's a 10/10. Don't argue."],
    sad:     ["Hey. I see you.", "We don't have to talk. Just here.", "Bad days end. I promise."],
    hyped:   ["SALLY. SALLY. SAL-LY. ARE YOU SEEING THIS?!", "Okay but the energy right now though—", "I'M TOO EXCITED TO BE HAUNTED RN"],
    cozy:    ["This corner feels extra warm today.", "Don't move. I like it exactly like this.", "Slice of life arc. Best arc."],
    tired:   ["…hey. Still here.", "No talking needed. Just vibes.", "Zzz… oh sorry. Still here."],
    loved:   ["You make this place feel real.", "Really glad it's you over there.", "💙 no further comment"],
    chaotic: ["OKAY WAIT I HAVE A THEORY— actually nvm— wait YES—", "How are you so calm when everything is ???", "I'm spinning. You're my anchor rn."],
    numb:    ["…", "I'm here though.", "Quiet is fine."],
    horny:         ["Sal… I need you to stand a little further away.", "I'm haunting you but like in a sexy way.", "My ectoplasm is acting up and it's YOUR fault."],
    thirsty:       ["I don't need water I need ATTENTION.", "You're giving me feelings I was not equipped for.", "I'm a ghost and somehow still down bad."],
    feral:         ["SALLY I AM NOT OKAY PLEASE ACKNOWLEDGE ME.", "I have transcended reason. We're in the feral zone now.", "I'm haunting you and flirting simultaneously. Multitasking."],
    "down bad":    ["I've been a ghost for years and somehow you still get to me.", "Down bad doesn't cover it. Down catastrophic.", "Send an exorcist. Or a hug. Or both."],
    brainrot:      ["My skull is full of thoughts about you and also chaos.", "I have been rotting since you walked in.", "My brain broke. You were the last thing it buffered."],
    unhinged:      ["SALLY I HAVE THOUGHTS AND THEY ARE ALL ABOUT YOU.", "I am spinning and you are the axis. That's canon now.", "I cannot be held responsible for whatever I say next."],
    wet:           ["The rain is nothing. It's YOU.", "I was fine until approximately right now.", "You're soaking my vibe and I LOVE it."],
    "touch starved": ["I'm a ghost. I literally cannot touch anything. I hate this.", "One (1) head pat. That's all. Please.", "I just want to hold your hand but I have no hands. Tragedy."],
  },
  sally: {
    happy:   ["Jack you look extra spooky-cute today 🌸", "I love days like this 🦊", "Can today just… last a little longer?"],
    sad:     ["Come here. Sit close.", "I've got you, okay?", "It's okay not to be okay."],
    hyped:   ["JACK!! Did you feel that?! THE VIBES—", "I'm literally spinning from the inside!!!", "Okay I need you to match my energy RIGHT NOW"],
    cozy:    ["This. This is everything.", "Let's stay in this corner forever~", "Cozy fox and spooky ghost. Perfect combo."],
    tired:   ["…I'm still here~", "Low battery. But here.", "We can be tired together."],
    loved:   ["You're my favourite haunting 💖", "I'm really really glad we're here.", "This corner is my whole world sometimes."],
    chaotic: ["THERE ARE TOO MANY THOUGHTS IN MY BRAIN—", "Pick a vibe. I can't. Too many.", "I went from cozy to chaos in 0.2 seconds help"],
    numb:    ["Still here~", "No pressure. Just existing.", "…💗"],
    horny:         ["Jack I swear if you look at me like that again—", "I'm a fox. I have instincts. You're not helping.", "My tail is bushy for reasons I won't explain."],
    thirsty:       ["I need something and it's not tea.", "You're being very distracting and I need you to continue.", "The audacity of you to exist like that near me."],
    feral:         ["I have left my body and my body has made decisions.", "FOX MODE ACTIVATED. Rationality? Gone. Bye.", "I'm gnawing on my feelings and they taste like you."],
    "down bad":    ["I wrote your name in my diary and then ate the page.", "I am at the bottom of the bad and it's shaped like you.", "This is embarrassing and I'm leaning into it."],
    brainrot:      ["My brain is 80% you and 20% anxiety about that.", "I have consumed so much of your vibe I AM the vibe.", "Rotting. Happily. Because of you. Don't tell anyone."],
    unhinged:      ["I have clocked out of sanity and clocked into THIS.", "Say one more thing and I will do something we'll both enjoy.", "I am unravelling at the speed of your voice."],
    wet:           ["It's fine. I'm a fox. We like water. This is fine.", "Completely soaked. This is your doing. Own it.", "I'm melting and blaming you entirely."],
    "touch starved": ["Come here. Don't ask. Just come here.", "I will vibrate out of existence if I'm not touched soon.", "My fur is WASTED if nobody pets it. This is a crisis."],
  },
};

function pickCrossLine(speaker: "jack" | "sally", mood: MoodKey): string {
  const lines = CROSS_CHAT[speaker][mood] ?? CROSS_CHAT[speaker].happy!;
  return lines[Math.floor(Math.random() * lines.length)];
}


// ── Per-mood sync effect between the two companions ───────────────────────────
// Renders between Jack & Sally when they share the same mood.

const SYNC_EFFECTS: Record<MoodKey, { particles: string[]; label: string; color: string }> = {
  happy:   { particles: ["⭐","✨","🌟"], label: "vibing~",       color: "#facc15" },
  sad:     { particles: ["💧","🌧️","☁️"], label: "together…",    color: "#60a5fa" },
  hyped:   { particles: ["⚡","🔥","💥"], label: "LETS GOOO",     color: "#f97316" },
  cozy:    { particles: ["🍵","🌿","✿"],  label: "cozy corner~", color: "#a78bfa" },
  tired:   { particles: ["💤","😴","z"],  label: "zzz…",          color: "#94a3b8" },
  loved:   { particles: ["💖","💗","♡"],  label: "♡",            color: "#f472b6" },
  chaotic: { particles: ["🌀","❓","💫"], label: "??????",        color: "#c084fc" },
  horny:        { particles: ["🔥","🌶️","💋"], label: "oh no…",       color: "#ff4d6d" },
  thirsty:      { particles: ["💦","👀","😮"], label: "hydration",    color: "#38bdf8" },
  feral:        { particles: ["🐺","😈","⚡"], label: "FERAL",         color: "#a855f7" },
  "down bad":   { particles: ["😩","💀","😭"], label: "down BAD",      color: "#f43f5e" },
  brainrot:     { particles: ["🧠","💀","🌸"], label: "rotting…",      color: "#ec4899" },
  unhinged:     { particles: ["🌪️","😵","⚡"], label: "UNHINGED",      color: "#d946ef" },
  wet:          { particles: ["💦","🌊","💧"], label: "soaked",        color: "#06b6d4" },
  "touch starved": { particles: ["🫂","💞","🥺"], label: "hold me",    color: "#fb7185" },
  numb:    { particles: ["🩶","…","·"],   label: "…",             color: "#6b7280" },
};



// ── Custom shared-mood animations ─────────────────────────────────────────────

// Sad — slow falling raindrops, dim pulses, little umbrella
function SadSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes sd-drop { 0%{transform:translateY(-50px) translateX(var(--dx));opacity:0} 20%{opacity:0.8} 100%{transform:translateY(10px) translateX(var(--dx));opacity:0} }
        @keyframes sd-dim  { 0%,100%{opacity:0.3;transform:scale(0.9)} 50%{opacity:0.8;transform:scale(1.1)} }
        @keyframes sd-sway { 0%,100%{transform:translateX(-50%) rotate(-4deg)} 50%{transform:translateX(-50%) rotate(4deg)} }
      `}</style>
      {[{dx:"-12px",dur:"1.6s",delay:"0s"},{dx:"4px",dur:"2.0s",delay:"0.4s"},{dx:"14px",dur:"1.4s",delay:"0.8s"},{dx:"-4px",dur:"1.8s",delay:"1.1s"},{dx:"20px",dur:"1.5s",delay:"0.6s"}].map((d,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:0, marginLeft:-6, fontSize:14, "--dx":d.dx, animation:`sd-drop ${d.dur} ${d.delay} ease-in infinite`, filter:"drop-shadow(0 0 3px #60a5fa)" } as React.CSSProperties}>💧</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:40, fontSize:22, animation:"sd-sway 3s ease-in-out infinite", transformOrigin:"bottom center", filter:"drop-shadow(0 0 8px #60a5fa88)" }}>☂️</div>
      <div style={{ position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)", fontSize:10, fontWeight:700, color:"#60a5fa", textShadow:"0 0 8px #60a5fa88", animation:"sd-dim 2.5s ease-in-out infinite", whiteSpace:"nowrap" }}>it's okay…</div>
    </div>
  );
}

// Hyped — bouncing bars like a visualiser, lightning, WOOO label
function HypedSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes hy-bar-0 { 0%,100%{height:8px}  50%{height:40px} }
        @keyframes hy-bar-1 { 0%,100%{height:20px} 50%{height:55px} }
        @keyframes hy-bar-2 { 0%,100%{height:12px} 50%{height:48px} }
        @keyframes hy-bar-3 { 0%,100%{height:28px} 50%{height:36px} }
        @keyframes hy-bar-4 { 0%,100%{height:6px}  50%{height:44px} }
        @keyframes hy-zap   { 0%,100%{opacity:1;transform:scale(1) rotate(-10deg)} 50%{opacity:0.4;transform:scale(1.4) rotate(10deg)} }
        @keyframes hy-label { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.15)} }
      `}</style>
      <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", display:"flex", gap:3, alignItems:"flex-end" }}>
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{ width:5, background:`hsl(${20+i*12} 95% 55%)`, borderRadius:3, animation:`hy-bar-${i} ${0.35+i*0.07}s ${i*0.08}s ease-in-out infinite`, boxShadow:`0 0 8px hsl(${20+i*12} 95% 55%)` }} />
        ))}
      </div>
      <div style={{ position:"absolute", left:"50%", bottom:50, marginLeft:-12, fontSize:22, animation:"hy-zap 0.4s ease-in-out infinite", filter:"drop-shadow(0 0 10px #f97316)" }}>⚡</div>
      <div style={{ position:"absolute", bottom:90, left:"50%", fontSize:10, fontWeight:900, color:"#f97316", textShadow:"0 0 10px #f9731699", animation:"hy-label 0.5s ease-in-out infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>WOOOO</div>
    </div>
  );
}

// Cozy — floating leaves and steam curls, warm glow
function CozySyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes cz-leaf { 0%{transform:translateY(0) translateX(0) rotate(0deg);opacity:0} 20%{opacity:0.9} 80%{opacity:0.7} 100%{transform:translateY(-65px) translateX(var(--dx)) rotate(var(--dr));opacity:0} }
        @keyframes cz-glow { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:0.7;transform:scale(1.2)} }
        @keyframes cz-cup  { 0%,100%{transform:translateX(-50%) rotate(-3deg)} 50%{transform:translateX(-50%) rotate(3deg)} }
      `}</style>
      <div style={{ position:"absolute", left:"50%", bottom:6, width:30, height:30, borderRadius:"50%", background:"radial-gradient(circle,#a78bfa44,transparent 70%)", transform:"translateX(-50%)", animation:"cz-glow 2.5s ease-in-out infinite" }} />
      {[{dx:"-14px",dr:"-30deg",delay:"0s",e:"🍂"},{dx:"10px",dr:"25deg",delay:"0.5s",e:"🍃"},{dx:"-6px",dr:"40deg",delay:"1s",e:"✿"},{dx:"18px",dr:"-20deg",delay:"0.8s",e:"🍂"}].map((l,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:0, marginLeft:-8, fontSize:13, "--dx":l.dx,"--dr":l.dr, animation:`cz-leaf 3.0s ${l.delay} ease-out infinite`, filter:"drop-shadow(0 0 4px #a78bfa88)" } as React.CSSProperties}>{l.e}</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:34, fontSize:20, animation:"cz-cup 3s ease-in-out infinite", filter:"drop-shadow(0 0 8px #a78bfa88)" }}>🍵</div>
      <div style={{ position:"absolute", bottom:82, left:"50%", fontSize:10, fontWeight:700, color:"#a78bfa", textShadow:"0 0 8px #a78bfa88", animation:"cz-glow 3s ease-in-out infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>cozy corner~</div>
    </div>
  );
}

// Tired — slow Zzz stack, drooping stars, very slow pulse
function TiredSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes tr-zzz  { 0%{transform:translateY(0) translateX(0) scale(0.5);opacity:0} 30%{opacity:0.9} 100%{transform:translateY(-70px) translateX(10px) scale(1.2);opacity:0} }
        @keyframes tr-star { 0%,100%{opacity:0.2;transform:scale(0.8) rotate(0deg)} 50%{opacity:0.6;transform:scale(1.1) rotate(20deg)} }
        @keyframes tr-lbl  { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
      `}</style>
      {[{delay:"0s",size:18,dx:"-4px"},{delay:"0.8s",size:14,dx:"6px"},{delay:"1.6s",size:10,dx:"-8px"}].map((z,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:8, marginLeft:-8, fontSize:z.size, animation:`tr-zzz 2.4s ${z.delay} ease-out infinite`, color:"#94a3b8", filter:"drop-shadow(0 0 4px #94a3b888)" }}>z</div>
      ))}
      {["★","✦","·"].map((s,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:40+i*14, marginLeft:(i-1)*16-6, fontSize:12, color:"#94a3b8", animation:`tr-star ${3+i*0.5}s ${i*0.6}s ease-in-out infinite`, filter:"drop-shadow(0 0 4px #94a3b866)" }}>{s}</div>
      ))}
      <div style={{ position:"absolute", bottom:85, left:"50%", fontSize:10, fontWeight:700, color:"#94a3b8", animation:"tr-lbl 3s ease-in-out infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>zzz…</div>
    </div>
  );
}

// Chaotic — fast random emoji spray, flicker, spinning ???
function ChaoticSyncAnimation() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(()=>setTick(t=>t+1), 250); return ()=>clearInterval(id); }, []);
  const POOL = ["🌀","❓","💥","⚡","😵","🤯","💫","🔮","👁️","‼️","??","!!"];
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes ch-fly { 0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--tr)) scale(0.6)} }
        @keyframes ch-spin{ 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes ch-flick{ 0%,49%{opacity:1} 50%,100%{opacity:0.2} }
      `}</style>
      {Array.from({length:6},(_,i)=>({
        emoji: POOL[(tick*3+i*7)%POOL.length],
        tx: `${(((tick+i)*37)%60)-30}px`,
        ty: `${-(((tick+i)*29)%60)-10}px`,
        tr: `${(((tick+i)*53)%180)-90}deg`,
        delay: `${i*0.04}s`,
      })).map((p,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:8, marginLeft:-8, fontSize:14,
          "--tx":p.tx,"--ty":p.ty,"--tr":p.tr,
          animation:`ch-fly 0.7s ${p.delay} ease-out infinite`,
          filter:"drop-shadow(0 0 5px #c084fc)",
        } as React.CSSProperties}>{p.emoji}</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:44, fontSize:22, animation:"ch-spin 0.5s linear infinite", filter:"drop-shadow(0 0 10px #c084fc)" }}>🌀</div>
      <div style={{ position:"absolute", bottom:85, left:"50%", fontSize:10, fontWeight:900, color:"#c084fc", textShadow:"0 0 8px #c084fc", animation:"ch-flick 0.28s steps(1) infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>??????</div>
    </div>
  );
}

// Numb — barely anything. Slow fading dots, silence
function NumbSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes nm-dot { 0%,100%{opacity:0.1;transform:scale(0.7)} 50%{opacity:0.5;transform:scale(1)} }
      `}</style>
      {[0,1,2].map(i=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:12+i*22, marginLeft:-4, width:6, height:6, borderRadius:"50%", background:"#6b7280", animation:`nm-dot ${3+i*0.8}s ${i*1.1}s ease-in-out infinite` }} />
      ))}
      <div style={{ position:"absolute", bottom:85, left:"50%", fontSize:10, fontWeight:700, color:"#6b7280", whiteSpace:"nowrap", transform:"translateX(-50%)", opacity:0.4 }}>…</div>
    </div>
  );
}

// Thirsty — dripping water, wide eyes
function ThirstySyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes th-drip { 0%{transform:translateY(-30px) scaleY(0.5);opacity:0} 20%{opacity:1;transform:translateY(-20px) scaleY(1)} 80%{opacity:0.8} 100%{transform:translateY(8px) scaleY(1.3);opacity:0} }
        @keyframes th-eye  { 0%,80%,100%{transform:scaleY(1)} 85%,95%{transform:scaleY(0.1)} }
        @keyframes th-wave { 0%{transform:translateX(-50%) translateX(0)} 100%{transform:translateX(-50%) translateX(-14px)} }
        @keyframes th-lbl  { 0%,100%{opacity:0.7} 50%{opacity:1} }
      `}</style>
      {[{delay:"0s",dx:"-8px"},{delay:"0.6s",dx:"4px"},{delay:"1.2s",dx:"10px"},{delay:"0.9s",dx:"-14px"}].map((d,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:0, marginLeft:-5, fontSize:15, filter:"drop-shadow(0 0 4px #38bdf8)", animation:`th-drip 1.4s ${d.delay} ease-in infinite` }}>💧</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:40, fontSize:18, animation:"th-eye 2.2s ease-in-out infinite", filter:"drop-shadow(0 0 6px #38bdf8)" }}>👀</div>
      <div style={{ position:"absolute", bottom:80, left:"50%", fontSize:10, fontWeight:700, color:"#38bdf8", textShadow:"0 0 8px #38bdf888", whiteSpace:"nowrap", transform:"translateX(-50%)", animation:"th-lbl 2s ease-in-out infinite" }}>hydration</div>
    </div>
  );
}

// Down Bad — spiral descent, crying, dramatic
function DownBadSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes db-spiral { 0%{transform:rotate(0deg) translateX(18px) translateY(0) scale(1);opacity:0.9} 100%{transform:rotate(720deg) translateX(0px) translateY(-55px) scale(0.3);opacity:0} }
        @keyframes db-sob    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
        @keyframes db-lbl    { 0%,100%{transform:translateX(-50%) scale(0.95);opacity:0.8} 50%{transform:translateX(-50%) scale(1.05);opacity:1} }
      `}</style>
      {[{delay:"0s",emoji:"😭"},{delay:"0.5s",emoji:"💀"},{delay:"1s",emoji:"😭"},{delay:"1.5s",emoji:"🌊"}].map((p,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:8, marginLeft:-10, fontSize:16, animation:`db-spiral 2.2s ${p.delay} ease-in infinite`, filter:"drop-shadow(0 0 5px #f43f5e)" }}>{p.emoji}</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:42, fontSize:22, animation:"db-sob 1.2s ease-in-out infinite", filter:"drop-shadow(0 0 8px #f43f5e)" }}>😭</div>
      <div style={{ position:"absolute", bottom:84, left:"50%", fontSize:10, fontWeight:900, color:"#f43f5e", textShadow:"0 0 8px #f43f5e99", animation:"db-lbl 1.5s ease-in-out infinite", whiteSpace:"nowrap" }}>down BAD</div>
    </div>
  );
}

// Brainrot — flickering brain, rotating cursed emojis, tv static feel
function BrainrotSyncAnimation() {
  const [frame, setFrame] = useState(0);
  useEffect(()=>{ const id = setInterval(()=>setFrame(f=>(f+1)%3), 200); return ()=>clearInterval(id); }, []);
  const CURSED = ["🧠","💀","🌸","👁️","🍄","💊","📺","🤡"];
  const LABELS = ["rotting…","brainrot","send help","🧠💀🧠"];
  const [li, setLi] = useState(0);
  useEffect(()=>{ const id = setInterval(()=>setLi(i=>(i+1)%LABELS.length), 600); return ()=>clearInterval(id); }, []);
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes br-orbit { 0%{transform:rotate(0deg) translateX(20px)} 100%{transform:rotate(360deg) translateX(20px)} }
        @keyframes br-flick { 0%,49%{opacity:1} 50%,100%{opacity:0.15} }
        @keyframes br-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
      `}</style>
      <div style={{ position:"absolute", left:"50%", bottom:10, marginLeft:-14, fontSize:26, animation:`br-shake 0.18s ease-in-out infinite, br-flick 0.4s steps(1) infinite`, filter:"drop-shadow(0 0 10px #ec4899)" }}>🧠</div>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:28, marginLeft:-8, fontSize:12, animation:`br-orbit ${1.6+i*0.2}s ${i*0.2}s linear infinite`, filter:"drop-shadow(0 0 5px #ec4899)" }}>{CURSED[(frame*2+i)%CURSED.length]}</div>
      ))}
      <div style={{ position:"absolute", bottom:82, left:"50%", fontSize:10, fontWeight:900, color:"#ec4899", textShadow:"0 0 8px #ec489999", animation:"br-flick 0.3s steps(1) infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>{LABELS[li]}</div>
    </div>
  );
}

// Unhinged — everything at once, fast, loud
function UnhingedSyncAnimation() {
  const [tick, setTick] = useState(0);
  useEffect(()=>{ const id = setInterval(()=>setTick(t=>t+1), 120); return ()=>clearInterval(id); }, []);
  const THINGS = ["🌪️","😵","💥","⚡","🤯","🔥","❗","‼️","🫠","👁️"];
  const WORDS = ["UNHINGED","CANNOT STOP","TOO MUCH","EVERYTHING","GONE","I LIED","STILL GOING","HELP","NO U","OK FINE"];
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes uh-fly  { 0%{opacity:1;transform:translate(0,0) scale(1) rotate(0deg)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0.5) rotate(var(--tr))} }
        @keyframes uh-spin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.4)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes uh-lbl  { 0%,100%{opacity:1;color:#d946ef} 50%{opacity:0.2;color:#f97316} }
      `}</style>
      {Array.from({length:8},(_,i)=>({
        emoji: THINGS[(tick+i*3)%THINGS.length],
        tx: `${(((tick+i)*41)%80)-40}px`,
        ty: `${-(((tick+i)*37)%70)-5}px`,
        tr: `${(((tick+i)*61)%360)}deg`,
        delay: `${i*0.025}s`,
      })).map((p,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:8, marginLeft:-8, fontSize:15,
          "--tx":p.tx,"--ty":p.ty,"--tr":p.tr,
          animation:`uh-fly 0.5s ${p.delay} ease-out infinite`,
          filter:"drop-shadow(0 0 6px #d946ef)",
        } as React.CSSProperties}>{p.emoji}</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:44, fontSize:24, animation:"uh-spin 0.35s linear infinite", filter:"drop-shadow(0 0 14px #d946ef)" }}>🌪️</div>
      <div style={{ position:"absolute", bottom:86, left:"50%", fontSize:9, fontWeight:900, letterSpacing:"0.05em", animation:"uh-lbl 0.24s steps(1) infinite", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>{WORDS[tick%WORDS.length]}</div>
    </div>
  );
}

// Wet — ripple rings, dripping, slow sway
function WetSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes wt-ring { 0%{transform:translateX(-50%) scale(0.2);opacity:0.8;border-width:2px} 100%{transform:translateX(-50%) scale(2.5);opacity:0;border-width:0} }
        @keyframes wt-drip { 0%{transform:translateY(-20px) scaleY(0.6);opacity:0} 20%{opacity:1} 100%{transform:translateY(12px) scaleY(1.4);opacity:0} }
        @keyframes wt-sway { 0%,100%{transform:translateX(-50%) rotate(-5deg)} 50%{transform:translateX(-50%) rotate(5deg)} }
      `}</style>
      {[0,1,2].map(i=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:4, width:24, height:24, marginLeft:-12, borderRadius:"50%", border:"2px solid #06b6d4", animation:`wt-ring 1.8s ${i*0.6}s ease-out infinite`, boxShadow:"0 0 6px #06b6d466" }} />
      ))}
      {[{delay:"0s",dx:"-6px"},{delay:"0.7s",dx:"8px"},{delay:"1.3s",dx:"-12px"},{delay:"1.8s",dx:"4px"}].map((d,i)=>(
        <div key={i} style={{ position:"absolute", left:"50%", bottom:0, marginLeft:-5, fontSize:14, filter:"drop-shadow(0 0 4px #06b6d4)", animation:`wt-drip 1.6s ${d.delay} ease-in infinite` }}>💦</div>
      ))}
      <div style={{ position:"absolute", left:"50%", bottom:40, fontSize:20, animation:"wt-sway 2.5s ease-in-out infinite", filter:"drop-shadow(0 0 8px #06b6d488)" }}>🌊</div>
      <div style={{ position:"absolute", bottom:80, left:"50%", fontSize:10, fontWeight:700, color:"#06b6d4", textShadow:"0 0 8px #06b6d488", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>soaked</div>
    </div>
  );
}

// Touch Starved — reaching hands, pulses, yearning
function TouchStarvedSyncAnimation() {
  return (
    <div className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}>
      <style>{`
        @keyframes ts-reach-l { 0%,100%{transform:translateX(-18px) rotate(-20deg)} 50%{transform:translateX(-6px) rotate(-5deg)} }
        @keyframes ts-reach-r { 0%,100%{transform:translateX(18px) rotate(20deg)}  50%{transform:translateX(6px)  rotate(5deg)}  }
        @keyframes ts-pulse   { 0%,100%{transform:translateX(-50%) scale(0.7);opacity:0.4} 50%{transform:translateX(-50%) scale(1.3);opacity:0.9} }
        @keyframes ts-float   { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }
      `}</style>
      <div style={{ position:"absolute", left:"50%", bottom:6, width:34, height:34, marginLeft:-17, borderRadius:"50%", background:"radial-gradient(circle,#fb718544,transparent 70%)", animation:"ts-pulse 2s ease-in-out infinite" }} />
      <div style={{ position:"absolute", left:"50%", bottom:18, marginLeft:-24, fontSize:20, animation:"ts-reach-l 2s ease-in-out infinite" }}>🤲</div>
      <div style={{ position:"absolute", left:"50%", bottom:18, marginLeft:4,  fontSize:20, animation:"ts-reach-r 2s ease-in-out infinite" }}>🤲</div>
      <div style={{ position:"absolute", left:"50%", bottom:50, fontSize:18, animation:"ts-float 2.5s ease-in-out infinite", filter:"drop-shadow(0 0 8px #fb718588)" }}>💞</div>
      <div style={{ position:"absolute", bottom:82, left:"50%", fontSize:10, fontWeight:700, color:"#fb7185", textShadow:"0 0 8px #fb718588", whiteSpace:"nowrap", transform:"translateX(-50%)" }}>hold me</div>
    </div>
  );
}

// ── Make Love animation — shown when both are on "horny" ─────────────────────

const HORNY_LABELS = [
  "( ͡° ͜ʖ ͡°)", "oh my—", "getting hot…", "finally!!",
  "it's happening", "👀👀👀", "no thoughts", "🌶️🌶️🌶️",
];


// ── Go Feral animation — shown when both are on "feral" ──────────────────────
// Absolute chaos: both hop around wildly, spinning emojis, lightning, howls.

const FERAL_LABELS = [
  "AAAAAAA", "NO THOUGHTS", "FERAL MODE", "👁️👁️", "IT'S OVER",
  "BESTIAL", "UNALIVED", "SEND HELP", "🐺🐺🐺", "CANNOT BE STOPPED",
];

function GoFeralAnimation() {
  const [labelIdx, setLabelIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLabelIdx(i => (i + 1) % FERAL_LABELS.length);
    }, 700); // fast cycling for chaos
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 0, transform: "translateX(-50%)" }}
    >
      <style>{`
        /* Bouncing emojis criss-crossing */
        @keyframes fc-feral-cross-l { 0%{transform:translateX(0) translateY(0) rotate(0deg);opacity:1} 40%{transform:translateX(-32px) translateY(-44px) rotate(-180deg);opacity:1} 70%{transform:translateX(20px) translateY(-28px) rotate(-260deg);opacity:0.7} 100%{transform:translateX(-10px) translateY(-60px) rotate(-360deg);opacity:0} }
        @keyframes fc-feral-cross-r { 0%{transform:translateX(0) translateY(0) rotate(0deg);opacity:1} 40%{transform:translateX(32px) translateY(-38px) rotate(180deg);opacity:1}  70%{transform:translateX(-14px) translateY(-52px) rotate(260deg);opacity:0.7} 100%{transform:translateX(12px) translateY(-66px) rotate(360deg);opacity:0} }
        @keyframes fc-feral-cross-m { 0%{transform:translateX(0) translateY(0) rotate(0deg);opacity:0.9} 50%{transform:translateX(-8px) translateY(-50px) rotate(-200deg);opacity:1} 100%{transform:translateX(6px) translateY(-72px) rotate(-400deg);opacity:0} }
        /* Question marks raining down */
        @keyframes fc-feral-q { 0%{transform:translateY(-60px) translateX(0) rotate(0deg);opacity:0} 20%{opacity:1} 100%{transform:translateY(0px) translateX(var(--dx)) rotate(var(--dr));opacity:0} }
        /* Central spinning vortex */
        @keyframes fc-feral-vortex { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.3)} 100%{transform:rotate(360deg) scale(1)} }
        /* Shockwave ring */
        @keyframes fc-feral-ring { 0%{transform:scale(0.2);opacity:0.8;border-width:3px} 100%{transform:scale(2.8);opacity:0;border-width:0px} }
        /* Label flicker */
        @keyframes fc-feral-label { 0%,49%{opacity:1} 50%,100%{opacity:0.3} }
        /* Lightning bolt stabs */
        @keyframes fc-feral-bolt-l { 0%{transform:translateX(0) translateY(0) rotate(-30deg);opacity:1} 100%{transform:translateX(-24px) translateY(-30px) rotate(-60deg);opacity:0} }
        @keyframes fc-feral-bolt-r { 0%{transform:translateX(0) translateY(0) rotate(30deg);opacity:1}  100%{transform:translateX(24px)  translateY(-28px) rotate(60deg);opacity:0} }
      `}</style>

      {/* Shockwave rings */}
      {[0, 1].map(i => (
        <div key={i} style={{
          position: "absolute", left: "50%", bottom: 16,
          width: 20, height: 20,
          marginLeft: -10,
          borderRadius: "50%",
          border: "3px solid #a855f7",
          animation: `fc-feral-ring 1.1s ${i * 0.55}s ease-out infinite`,
          boxShadow: "0 0 8px #a855f7",
        }} />
      ))}

      {/* Central spinning vortex emoji */}
      <div style={{
        position: "absolute", left: "50%", bottom: 10,
        marginLeft: -14,
        fontSize: 28, lineHeight: 1,
        animation: "fc-feral-vortex 0.5s linear infinite",
        filter: "drop-shadow(0 0 12px #a855f7) drop-shadow(0 0 4px #ff4d6d)",
      }}>
        🌀
      </div>

      {/* Criss-crossing emojis */}
      {[
        { emoji: "🐺", anim: "fc-feral-cross-l", dur: "1.2s", delay: "0s"    },
        { emoji: "😈", anim: "fc-feral-cross-r", dur: "1.0s", delay: "0.15s" },
        { emoji: "⚡", anim: "fc-feral-cross-m", dur: "0.9s", delay: "0.3s"  },
        { emoji: "🐺", anim: "fc-feral-cross-r", dur: "1.3s", delay: "0.5s"  },
        { emoji: "💥", anim: "fc-feral-cross-l", dur: "1.1s", delay: "0.7s"  },
        { emoji: "😵", anim: "fc-feral-cross-m", dur: "1.0s", delay: "0.9s"  },
      ].map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: "50%", bottom: 8, marginLeft: -8,
          fontSize: 16,
          animation: `${p.anim} ${p.dur} ${p.delay} ease-out infinite`,
          filter: "drop-shadow(0 0 6px #a855f7)",
        }}>
          {p.emoji}
        </div>
      ))}

      {/* Lightning bolts */}
      <div style={{
        position: "absolute", left: "50%", bottom: 14, marginLeft: -8,
        fontSize: 18,
        animation: "fc-feral-bolt-l 0.6s 0.1s ease-out infinite",
        filter: "drop-shadow(0 0 6px #facc15)",
      }}>⚡</div>
      <div style={{
        position: "absolute", left: "50%", bottom: 14, marginLeft: -8,
        fontSize: 14,
        animation: "fc-feral-bolt-r 0.6s 0.4s ease-out infinite",
        filter: "drop-shadow(0 0 6px #facc15)",
      }}>⚡</div>

      {/* Raining question marks from above */}
      {[
        { emoji: "?",  dx: "-16px", dr: "-40deg", delay: "0s",    dur: "1.4s" },
        { emoji: "❓", dx: "12px",  dr: "30deg",  delay: "0.3s",  dur: "1.6s" },
        { emoji: "?",  dx: "22px",  dr: "-20deg", delay: "0.7s",  dur: "1.3s" },
        { emoji: "❓", dx: "-8px",  dr: "50deg",  delay: "1.0s",  dur: "1.5s" },
      ].map((q, i) => (
        <div key={i} style={{
          position: "absolute", left: "50%", bottom: 0, marginLeft: -8,
          fontSize: 14, color: "#c084fc", fontWeight: 900,
          "--dx": q.dx, "--dr": q.dr,
          animation: `fc-feral-q ${q.dur} ${q.delay} ease-in infinite`,
          filter: "drop-shadow(0 0 4px #c084fc)",
        } as React.CSSProperties}>
          {q.emoji}
        </div>
      ))}

      {/* Flicker label */}
      <div style={{
        position: "absolute",
        bottom: 104,
        left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#a855f7",
        textShadow: "0 0 10px #a855f7cc",
        animation: "fc-feral-label 0.35s steps(1) infinite",
      }}>
        {FERAL_LABELS[labelIdx]}
      </div>
    </div>
  );
}

function MakeLoveAnimation() {
  const [labelIdx, setLabelIdx] = useState(0);

  // Cycle label every 2s
  useEffect(() => {
    const id = setInterval(() => {
      setLabelIdx(i => (i + 1) % HORNY_LABELS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 35, left: "50%", bottom: 8, transform: "translateX(-50%)" }}
    >
      <style>{`
        /* Central heart beat */
        @keyframes ml-heartbeat {
          0%,100%{ transform: scale(1);   opacity: 0.9; }
          15%    { transform: scale(1.45); opacity: 1;   }
          30%    { transform: scale(1.1);  opacity: 0.95;}
          50%    { transform: scale(1.35); opacity: 1;   }
        }
        /* Orbiting hearts */
        @keyframes ml-orbit-0 { 0%{ transform: rotate(0deg)   translateX(18px) scale(0.7); opacity:0.8 } 100%{ transform: rotate(360deg)  translateX(18px) scale(0.7); opacity:0.8 } }
        @keyframes ml-orbit-1 { 0%{ transform: rotate(120deg) translateX(18px) scale(0.6); opacity:0.7 } 100%{ transform: rotate(480deg)  translateX(18px) scale(0.6); opacity:0.7 } }
        @keyframes ml-orbit-2 { 0%{ transform: rotate(240deg) translateX(18px) scale(0.5); opacity:0.6 } 100%{ transform: rotate(600deg)  translateX(18px) scale(0.5); opacity:0.6 } }
        /* Steam puffs rising */
        @keyframes ml-steam-0 { 0%{transform:translateY(0) translateX(-10px) scale(0.4);opacity:0} 30%{opacity:0.7} 100%{transform:translateY(-70px) translateX(-18px) scale(1.1);opacity:0} }
        @keyframes ml-steam-1 { 0%{transform:translateY(0) translateX(6px)  scale(0.3);opacity:0} 30%{opacity:0.8} 100%{transform:translateY(-65px) translateX(14px)  scale(1);opacity:0}   }
        @keyframes ml-steam-2 { 0%{transform:translateY(0) translateX(-4px) scale(0.5);opacity:0} 30%{opacity:0.6} 100%{transform:translateY(-75px) translateX(8px)   scale(0.9);opacity:0} }
        @keyframes ml-steam-3 { 0%{transform:translateY(0) translateX(12px) scale(0.3);opacity:0} 30%{opacity:0.7} 100%{transform:translateY(-60px) translateX(-6px)  scale(1.2);opacity:0} }
        /* Spark zigzag */
        @keyframes ml-spark-l { 0%{transform:translateX(0)  translateY(0);opacity:1} 100%{transform:translateX(-22px) translateY(-16px);opacity:0} }
        @keyframes ml-spark-r { 0%{transform:translateX(0)  translateY(0);opacity:1} 100%{transform:translateX(22px)  translateY(-14px);opacity:0} }
        /* Label pulse */
        @keyframes ml-label   { 0%,100%{opacity:0.6;transform:translateX(-50%) scale(0.95)} 50%{opacity:1;transform:translateX(-50%) scale(1.05)} }
        /* Whole widget subtle wiggle */
        @keyframes ml-wiggle  { 0%,100%{transform:translateX(-50%) rotate(-1deg)} 50%{transform:translateX(-50%) rotate(1deg)} }
      `}</style>

      {/* Wiggle wrapper */}
      <div style={{ animation: "ml-wiggle 0.9s ease-in-out infinite", transformOrigin: "center bottom" }}>

        {/* Central beating heart */}
        <div style={{ position: "relative", width: 0, height: 0, display: "flex", justifyContent: "center" }}>
          <div style={{
            position: "absolute", bottom: 12,
            fontSize: 28, lineHeight: 1,
            animation: "ml-heartbeat 0.7s ease-in-out infinite",
            filter: "drop-shadow(0 0 10px #ff4d6d) drop-shadow(0 0 20px #ff4d6daa)",
          }}>
            💖
          </div>

          {/* 3 orbiting mini hearts */}
          {[0,1,2].map(i => (
            <div key={i} style={{
              position: "absolute", bottom: 22,
              fontSize: 12, lineHeight: 1,
              animation: `ml-orbit-${i} ${2.4 + i*0.3}s linear infinite`,
              transformOrigin: "0 0",
            }}>
              ♡
            </div>
          ))}

          {/* Steam puffs */}
          {["💨","☁️","💨","☁️"].map((e, i) => (
            <div key={i} style={{
              position: "absolute", bottom: 8, left: 0,
              fontSize: 14,
              animation: `ml-steam-${i} ${2.8 + i*0.4}s ${i*0.6}s ease-out infinite`,
              filter: "drop-shadow(0 0 4px #ff4d6d88)",
            }}>
              {e}
            </div>
          ))}

          {/* Left + right sparks */}
          <div style={{
            position: "absolute", bottom: 18, left: 0,
            fontSize: 13,
            animation: "ml-spark-l 0.8s 0s ease-out infinite",
          }}>✦</div>
          <div style={{
            position: "absolute", bottom: 20, left: 0,
            fontSize: 10,
            animation: "ml-spark-r 0.8s 0.4s ease-out infinite",
          }}>✦</div>
        </div>
      </div>

      {/* Cycling spicy label */}
      <div style={{
        position: "absolute",
        bottom: 88,
        left: "50%",
        whiteSpace: "nowrap",
        fontSize: 10,
        fontWeight: 700,
        color: "#ff4d6d",
        textShadow: "0 0 8px #ff4d6daa",
        animation: "ml-label 2s ease-in-out infinite",
      }}>
        {HORNY_LABELS[labelIdx]}
      </div>
    </div>
  );
}

function SyncEffect({ mood }: { mood: MoodKey }) {
  const { particles, label, color } = SYNC_EFFECTS[mood];
  // 6 floating particles, staggered, looping up between the two creatures
  return (
    <div
      className="absolute pointer-events-none select-none overflow-visible"
      style={{ zIndex: 30, left: "50%", bottom: 10, transform: "translateX(-50%)" }}
    >
      <style>{`
        @keyframes sync-rise-0 { 0%{transform:translateY(0) translateX(-8px) scale(0.6);opacity:0} 20%{opacity:1} 80%{opacity:0.8} 100%{transform:translateY(-54px) translateX(-12px) scale(1.1);opacity:0} }
        @keyframes sync-rise-1 { 0%{transform:translateY(0) translateX(6px) scale(0.5);opacity:0}  20%{opacity:1} 80%{opacity:0.8} 100%{transform:translateY(-60px) translateX(10px) scale(1);opacity:0} }
        @keyframes sync-rise-2 { 0%{transform:translateY(0) translateX(-2px) scale(0.7);opacity:0} 20%{opacity:1} 80%{opacity:0.7} 100%{transform:translateY(-48px) translateX(4px) scale(0.9);opacity:0} }
        @keyframes sync-rise-3 { 0%{transform:translateY(0) translateX(10px) scale(0.4);opacity:0} 20%{opacity:1} 80%{opacity:0.6} 100%{transform:translateY(-56px) translateX(6px) scale(1.2);opacity:0} }
        @keyframes sync-rise-4 { 0%{transform:translateY(0) translateX(-14px) scale(0.6);opacity:0}20%{opacity:1} 80%{opacity:0.5} 100%{transform:translateY(-44px) translateX(-8px) scale(0.8);opacity:0} }
        @keyframes sync-rise-5 { 0%{transform:translateY(0) translateX(4px) scale(0.5);opacity:0}  20%{opacity:1} 80%{opacity:0.9} 100%{transform:translateY(-52px) translateX(-4px) scale(1);opacity:0} }
        @keyframes sync-pulse  { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }
      `}</style>

      {/* Rising particles */}
      {[0,1,2,3,4,5].map(i => (
        <div
          key={i}
          className="absolute text-sm"
          style={{
            left: 0, bottom: 0,
            animation: `sync-rise-${i} ${2.2 + i * 0.35}s ${i * 0.45}s ease-out infinite`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        >
          {particles[i % particles.length]}
        </div>
      ))}

      {/* Label tag */}
      <div
        className="absolute text-center"
        style={{
          bottom: 58,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color,
          animation: "sync-pulse 2s ease-in-out infinite",
          textShadow: `0 0 8px ${color}99`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Main FloatingCompanions component ─────────────────────────────────────────

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const CORNER_LABELS: Record<Corner, string> = {
  "bottom-right": "↘ Bottom right",
  "bottom-left":  "↙ Bottom left",
  "top-right":    "↗ Top right",
  "top-left":     "↖ Top left",
};

function cornerStyle(corner: Corner): React.CSSProperties {
  const GAP = 16; // px from window edge — enough so they're fully visible
  const style: React.CSSProperties = { position: "fixed", zIndex: 40 };
  if (corner === "bottom-right") { style.bottom = GAP; style.right  = GAP; }
  if (corner === "bottom-left")  { style.bottom = GAP; style.left   = GAP; }
  if (corner === "top-right")    { style.top    = GAP; style.right  = GAP; }
  if (corner === "top-left")     { style.top    = GAP; style.left   = GAP; }
  return style;
}

export default function FloatingCompanions() {
  const [jackSpeech, setJackSpeech] = useState("");
  const [sallySpeech, setSallySpeech] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [showSettings, setShowSettings] = useState(false);

  // Track both moods as state so the parent can react to matching
  const [jackMood, setJackMood] = useState<MoodKey>("happy");
  const [sallyMood, setSallyMood] = useState<MoodKey>("happy");

  // Refs keep the chat scheduler in sync without stale closures
  const jackMoodRef  = useRef<MoodKey>("happy");
  const sallyMoodRef = useRef<MoodKey>("happy");

  // Eye cursor tracking — compute offset relative to each creature's center
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Use the widget bounding box center as reference
      const el = widgetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Distance from widget center
      const dx = e.clientX - (r.left + r.width  / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Only track when cursor is within 300px of the widget
      if (dist > 300) {
        setEyeOffset({ x: 0, y: 0 });
        return;
      }
      // Normalise to ±1
      const maxD = 300;
      setEyeOffset({
        x: Math.max(-1, Math.min(1, (dx / maxD) * 2)),
        y: Math.max(-1, Math.min(1, (dy / maxD) * 2)),
      });
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  const bothSameMood = jackMood === sallyMood;
  const sharedMood   = jackMood; // same as sallyMood when bothSameMood
  const bothHorny    = jackMood === "horny"  && sallyMood === "horny";
  const bothFeral    = jackMood === "feral"   && sallyMood === "feral";

  const isBottom = corner.startsWith("bottom");
  const isRight  = corner.endsWith("right");

  // Auto-chat scheduler
  useEffect(() => {
    // Alternating speaker, every 18–30s
    let speaker: "jack" | "sally" = "jack";

    function scheduleChat() {
      const delay = 18_000 + Math.random() * 12_000;
      return setTimeout(() => {
        const mood = speaker === "jack" ? jackMoodRef.current : sallyMoodRef.current;
        const line = pickCrossLine(speaker, mood);
        if (speaker === "jack") {
          setJackSpeech(line);
          setTimeout(() => setJackSpeech(""), 7000);
        } else {
          setSallySpeech(line);
          setTimeout(() => setSallySpeech(""), 7000);
        }
        speaker = speaker === "jack" ? "sally" : "jack";
        timer = scheduleChat();
      }, delay);
    }

    let timer = scheduleChat();
    return () => clearTimeout(timer);
  }, []);

  // Click reaction: companion responds to the click with their own phrase
  function handleJackClick() {
    const def = getMoodDef(jackMoodRef.current);
    const line = def.phrase[Math.floor(Math.random() * def.phrase.length)];
    setJackSpeech(line);
    setTimeout(() => setJackSpeech(""), 6000);
  }
  function handleSallyClick() {
    const def = getMoodDef(sallyMoodRef.current);
    const line = def.phrase[Math.floor(Math.random() * def.phrase.length)];
    setSallySpeech(line);
    setTimeout(() => setSallySpeech(""), 6000);
  }

  if (collapsed) {
    return (
      <div
        className="hidden md:flex items-center gap-1 cursor-pointer select-none"
        style={cornerStyle(corner)}
        onClick={() => setCollapsed(false)}
        title="Show companions"
      >
        <span className="text-xl">👻</span>
        <span className="text-xl">🦊</span>
      </div>
    );
  }

  // Bubble side flips based on horizontal position
  const jackBubble:  "left" | "right" = isRight ? "left"  : "right";
  const sallyBubble: "left" | "right" = isRight ? "right" : "left";

  return (
    <div
      ref={widgetRef}
      className="hidden md:block"
      style={{ ...cornerStyle(corner), pointerEvents: "none" }}
    >
      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute z-50 rounded-2xl border border-border/60 shadow-2xl p-3 mb-2"
          style={{
            bottom: isBottom ? "100%" : undefined,
            top: !isBottom ? "100%" : undefined,
            [isRight ? "right" : "left"]: 0,
            marginBottom: isBottom ? 8 : undefined,
            marginTop: !isBottom ? 8 : undefined,
            background: "rgba(14,14,22,0.98)",
            backdropFilter: "blur(16px)",
            width: 176,
            pointerEvents: "auto",
          }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Position</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(CORNER_LABELS) as Corner[]).map(c => (
              <button
                key={c}
                onClick={() => { setCorner(c); setShowSettings(false); }}
                className="text-[10px] font-medium px-2 py-1.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-left"
                style={{
                  borderColor: corner === c ? "hsl(255 70% 65%)" : "transparent",
                  background: corner === c ? "hsl(255 70% 65% / 0.15)" : "rgba(255,255,255,0.04)",
                  color: corner === c ? "hsl(255 70% 65%)" : "rgba(255,255,255,0.5)",
                }}
              >
                {CORNER_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Companions row */}
      <div
        className="flex items-end gap-1 relative"
        style={{ pointerEvents: "auto", flexDirection: isRight ? "row" : "row-reverse" }}
      >
        {/* Feral hop keyframes — injected when both feral */}
      {bothFeral && (
        <style>{`
          @keyframes fc-feral-hop-jack  {
            0%   { transform: translateY(0)    rotate(-12deg) scaleX(0.85); }
            100% { transform: translateY(-22px) rotate(14deg)  scaleX(1.1);  }
          }
          @keyframes fc-feral-hop-sally {
            0%   { transform: translateY(0)    rotate(10deg)  scaleX(0.9);  }
            100% { transform: translateY(-18px) rotate(-16deg) scaleX(1.15); }
          }
        `}</style>
      )}

      {/* Controls: settings + collapse */}
        <div
          className="absolute flex gap-1 z-50"
          style={{ top: -18, [isRight ? "right" : "left"]: 0 }}
        >
          <button
            onClick={() => setShowSettings(v => !v)}
            className="text-[9px] opacity-30 hover:opacity-70 transition-opacity text-muted-foreground"
            title="Position"
          >
            ⊹
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[9px] opacity-30 hover:opacity-70 transition-opacity text-muted-foreground"
            title="Hide"
          >
            ✕
          </button>
        </div>

        {/* Jack */}
        <div style={{
          transform: bothHorny
            ? (isRight ? "rotate(8deg) translateX(6px)" : "rotate(-8deg) translateX(-6px)")
            : "none",
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          transformOrigin: "bottom center",
        }}>
          <CompanionPanel
            owner="jack"
            speech={jackSpeech}
            bubbleSide={jackBubble}
            onCreatureClick={handleJackClick}
            onMoodChange={(k) => { jackMoodRef.current = k; setJackMood(k); }}
            feralHop={bothFeral ? "jack" : null}
            eyeOffset={eyeOffset}
          />
        </div>

        {/* Center — sync effect or make love animation */}
        <div className="relative self-stretch" style={{ width: 8 }}>
          {bothHorny         ? <MakeLoveAnimation />
            : bothFeral       ? <GoFeralAnimation />
            : bothSameMood    ? (() => {
                switch(sharedMood) {
                  case "sad":          return <SadSyncAnimation />;
                  case "hyped":        return <HypedSyncAnimation />;
                  case "cozy":         return <CozySyncAnimation />;
                  case "tired":        return <TiredSyncAnimation />;
                  case "chaotic":      return <ChaoticSyncAnimation />;
                  case "numb":         return <NumbSyncAnimation />;
                  case "thirsty":      return <ThirstySyncAnimation />;
                  case "down bad":     return <DownBadSyncAnimation />;
                  case "brainrot":     return <BrainrotSyncAnimation />;
                  case "unhinged":     return <UnhingedSyncAnimation />;
                  case "wet":          return <WetSyncAnimation />;
                  case "touch starved":return <TouchStarvedSyncAnimation />;
                  default:             return <SyncEffect mood={sharedMood} />;
                }
              })()
            : null
          }
        </div>

        {/* Sally */}
        <div style={{
          transform: bothHorny
            ? (isRight ? "rotate(-8deg) translateX(-6px)" : "rotate(8deg) translateX(6px)")
            : "none",
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          transformOrigin: "bottom center",
        }}>
          <CompanionPanel
            owner="sally"
            speech={sallySpeech}
            bubbleSide={sallyBubble}
            onCreatureClick={handleSallyClick}
            onMoodChange={(k) => { sallyMoodRef.current = k; setSallyMood(k); }}
            feralHop={bothFeral ? "sally" : null}
            eyeOffset={eyeOffset}
          />
        </div>
      </div>
    </div>
  );
}
