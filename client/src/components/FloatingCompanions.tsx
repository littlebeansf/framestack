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

function JackCreature({ mood, animClass, onClick }: {
  mood: MoodKey; animClass: string; onClick: () => void;
}) {
  const def = getMoodDef(mood);
  const c = def.color;

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

function SallyCreature({ mood, animClass, onClick }: {
  mood: MoodKey; animClass: string; onClick: () => void;
}) {
  const def = getMoodDef(mood);
  const c = def.color;

  function Eye({ cx, mood: m }: { cx: number; mood: MoodKey }) {
    const base = (
      <>
        <ellipse cx={cx} cy={-8} rx={4.5} ry={4.5} fill="rgba(255,255,255,0.92)" />
        <ellipse cx={cx} cy={-7} rx={2.8} ry={3.2} fill={c} />
        <circle  cx={cx} cy={-8} r={1.5}  fill="rgba(0,0,0,0.7)" />
        <circle  cx={cx + 1.2} cy={-9} r={0.9} fill="rgba(255,255,255,0.9)" />
        <circle  cx={cx - 0.8} cy={-7.5} r={0.45} fill="rgba(255,255,255,0.7)" />
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
}: {
  owner: "jack" | "sally";
  speech: string;
  bubbleSide: "left" | "right";
  onCreatureClick: () => void;
  onMoodChange: (k: MoodKey) => void;
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
      <div className="relative">
        <MiniParticles particles={particles} active={particlesActive} color={def.color} />
        {owner === "jack"
          ? <JackCreature mood={currentMood} animClass={animClass} onClick={handleClick} />
          : <SallyCreature mood={currentMood} animClass={animClass} onClick={handleClick} />
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


// ── Make Love animation — shown when both are on "horny" ─────────────────────

const HORNY_LABELS = [
  "( ͡° ͜ʖ ͡°)", "oh my—", "getting hot…", "finally!!",
  "it's happening", "👀👀👀", "no thoughts", "🌶️🌶️🌶️",
];

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

  const bothSameMood = jackMood === sallyMood;
  const sharedMood   = jackMood; // same as sallyMood when bothSameMood
  const bothHorny    = jackMood === "horny" && sallyMood === "horny";

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
          transform: bothHorny ? (isRight ? "rotate(8deg) translateX(6px)" : "rotate(-8deg) translateX(-6px)") : "none",
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          transformOrigin: "bottom center",
        }}>
          <CompanionPanel
            owner="jack"
            speech={jackSpeech}
            bubbleSide={jackBubble}
            onCreatureClick={handleJackClick}
            onMoodChange={(k) => { jackMoodRef.current = k; setJackMood(k); }}
          />
        </div>

        {/* Center — sync effect or make love animation */}
        <div className="relative self-stretch" style={{ width: 8 }}>
          {bothSameMood && sharedMood === "horny"
            ? <MakeLoveAnimation />
            : bothSameMood && <SyncEffect mood={sharedMood} />
          }
        </div>

        {/* Sally */}
        <div style={{
          transform: bothHorny ? (isRight ? "rotate(-8deg) translateX(-6px)" : "rotate(8deg) translateX(6px)") : "none",
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          transformOrigin: "bottom center",
        }}>
          <CompanionPanel
            owner="sally"
            speech={sallySpeech}
            bubbleSide={sallyBubble}
            onCreatureClick={handleSallyClick}
            onMoodChange={(k) => { sallyMoodRef.current = k; setSallyMood(k); }}
          />
        </div>
      </div>
    </div>
  );
}
