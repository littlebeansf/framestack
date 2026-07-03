/**
 * OwnerIntro — unique SVG line-art load animations for each owner space.
 * Same drawing technique as the splash screen: strokeDasharray/strokeDashoffset
 * animations that draw strokes in sequence.
 *
 * Jack:    Skull Hello Kitty — round skull head draws in, cat ears pop,
 *          X eyes scratch, tiny bow on right ear, whisker dots, smile arc.
 *          Crossbones appear below. All in JACK_BLUE.
 *
 * Sally:   Cherry blossom — a branch strokes in, then 5 petals unfurl radially,
 *          stamens dot in, and petals blush with a fill-fade.
 *
 * Together: A house assembles — left wall → right wall → roof → chimney → door
 *           → window → a heart in the window glows in. Rings pulse out.
 */

import { useEffect } from "react";

// ── Shared colours (match App.tsx splash) ─────────────────────────────────────
const JACK_BLUE   = "hsl(220 80% 62%)";
const SALLY_PINK  = "hsl(330 75% 65%)";
const TOGETHER    = "hsl(20 90% 60%)";   // orange for Together
const VIOLET      = "hsl(255 70% 65%)";
const GLASS_CLR   = "hsl(220 15% 78%)";

// ── Duration helper ───────────────────────────────────────────────────────────
// Returns a CSS animation shorthand string using strokeDashoffset trick
// All dur/delay values are already pre-scaled ~1.8× vs the original
function dash(len: number, dur: number, delay: number): React.CSSProperties {
  return {
    strokeDasharray: len,
    strokeDashoffset: len,
    animation: `owner-draw ${dur}s cubic-bezier(0.4,0,0.2,1) ${delay}s forwards`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JACK — Skull Hello Kitty
// Composition: round skull head → cat ears (Hello Kitty rounded tips) →
//   X eyes (crossing lines) → dot nose → wavy smile arc →
//   whisker dots (3 per side) → bow on right ear →
//   subtle crossbones below → "JACK" label
// ─────────────────────────────────────────────────────────────────────────────
function JackAnimation() {
  // Main skull circle
  const SKULL_R   = 22;
  const SKULL_LEN = 2 * Math.PI * SKULL_R; // ≈ 138

  return (
    <svg viewBox="-55 -65 110 120" width={190} height={190} fill="none" style={{ overflow: "visible" }}>

      {/* Ring pulses */}
      {[0, 0.25, 0.5].map((d, i) => (
        <circle key={i} cx="0" cy="0" r="0"
          stroke={JACK_BLUE} strokeWidth="1"
          style={{ animation: `owner-ring 0.6s ease-out ${1.0 + d * 0.44}s forwards`, opacity: 0 }}
        />
      ))}

      {/* ── Skull head (large circle) ── */}
      <circle cx="0" cy="-2" r={SKULL_R}
        stroke={JACK_BLUE} strokeWidth="2.4" strokeLinecap="round"
        style={dash(Math.ceil(SKULL_LEN), 0.4, 0.04)}
      />

      {/* ── Left cat ear (Hello Kitty style — two arcs forming a rounded triangle) ── */}
      {/* outer ear arc */}
      <path d="M-22 -18 Q-32 -40 -14 -42 Q-6 -36 -10 -24"
        stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={dash(52, 0.2, 0.44)}
      />
      {/* inner ear fill line */}
      <path d="M-20 -20 Q-26 -36 -14 -38 Q-9 -34 -12 -25"
        stroke={JACK_BLUE} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" fill="none"
        style={dash(38, 0.13, 0.66)}
      />

      {/* ── Right cat ear ── */}
      <path d="M22 -18 Q32 -40 14 -42 Q6 -36 10 -24"
        stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={dash(52, 0.2, 0.51)}
      />
      <path d="M20 -20 Q26 -36 14 -38 Q9 -34 12 -25"
        stroke={JACK_BLUE} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" fill="none"
        style={dash(38, 0.13, 0.73)}
      />

      {/* ── X left eye ── */}
      <path d="M-12 -10 L-6 -4" stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round"
        style={dash(9, 0.1, 0.79)}
      />
      <path d="M-6 -10 L-12 -4" stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round"
        style={dash(9, 0.1, 0.88)}
      />

      {/* ── X right eye ── */}
      <path d="M6 -10 L12 -4" stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round"
        style={dash(9, 0.1, 0.84)}
      />
      <path d="M12 -10 L6 -4" stroke={JACK_BLUE} strokeWidth="2.2" strokeLinecap="round"
        style={dash(9, 0.1, 0.92)}
      />

      {/* ── Dot nose ── */}
      <circle cx="0" cy="1" r="1.8"
        fill={JACK_BLUE} fillOpacity="0.7"
        style={{ opacity: 0, animation: `owner-pop 0.36s ease 0.99s forwards` }}
      />

      {/* ── Wavy smile (skull-style, slightly jagged) ── */}
      <path d="M-9 8 Q-5 13 0 11 Q5 9 9 13"
        stroke={JACK_BLUE} strokeWidth="2" strokeLinecap="round" fill="none"
        style={dash(28, 0.16, 1.03)}
      />

      {/* ── Whisker dots — 3 each side ── */}
      {/* left whiskers */}
      {[[-32, -3], [-30, 2], [-32, 7]].map(([wx, wy], i) => (
        <circle key={`wl${i}`} cx={wx} cy={wy} r="1.4"
          fill={JACK_BLUE} fillOpacity="0.55"
          style={{ opacity: 0, animation: `owner-pop 0.09s ease ${2.52 + i * 0.1}s forwards` }}
        />
      ))}
      {/* right whiskers */}
      {[[32, -3], [30, 2], [32, 7]].map(([wx, wy], i) => (
        <circle key={`wr${i}`} cx={wx} cy={wy} r="1.4"
          fill={JACK_BLUE} fillOpacity="0.55"
          style={{ opacity: 0, animation: `owner-pop 0.2s ease ${2.58 + i * 0.1}s forwards` }}
        />
      ))}

      {/* ── Bow on right ear (two teardrops + centre knot) ── */}
      {/* left lobe of bow */}
      <path d="M10 -40 Q6 -46 10 -50 Q14 -46 10 -40Z"
        stroke={JACK_BLUE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={dash(28, 0.12, 1.19)}
      />
      {/* right lobe of bow */}
      <path d="M18 -40 Q22 -46 18 -50 Q14 -46 18 -40Z"
        stroke={JACK_BLUE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={dash(28, 0.12, 1.27)}
      />
      {/* bow knot centre */}
      <circle cx="14" cy="-43" r="2.2"
        stroke={JACK_BLUE} strokeWidth="1.4" fill="none"
        style={dash(14, 0.08, 1.35)}
      />

      {/* ── Subtle crack line on skull dome ── */}
      <path d="M-3 -24 Q0 -18 2 -22 Q4 -18 6 -24"
        stroke={JACK_BLUE} strokeWidth="1" strokeLinecap="round" fill="none" strokeOpacity="0.5"
        style={dash(20, 0.1, 1.41)}
      />

      {/* ── Crossbones below skull ── */}
      {/* left bone */}
      <path d="M-14 24 L14 38" stroke={JACK_BLUE} strokeWidth="1.8" strokeLinecap="round"
        style={dash(32, 0.13, 1.45)}
      />
      {/* right bone (opposite direction) */}
      <path d="M14 24 L-14 38" stroke={JACK_BLUE} strokeWidth="1.8" strokeLinecap="round"
        style={dash(32, 0.13, 1.52)}
      />
      {/* bone end knobs */}
      {[[-14,24],[14,38],[14,24],[-14,38]].map(([bx,by],i) => (
        <circle key={i} cx={bx} cy={by} r="3.5"
          stroke={JACK_BLUE} strokeWidth="1.6" fill="none"
          style={dash(22, 0.18, 3.6 + i * 0.09)}
        />
      ))}

      {/* "JACK" label */}
      <text x="0" y="58" textAnchor="middle"
        fontSize="8" fontFamily="Cabinet Grotesk, sans-serif" fontWeight="800"
        fill={JACK_BLUE} letterSpacing="2.5"
        style={{ opacity: 0, animation: `owner-fade-up 0.63s ease 1.74s forwards` }}
      >JACK</text>

      {/* Tiny stars scatter */}
      {[[-40,-45,"✦",JACK_BLUE,4.05,7],[42,-30,"✦",GLASS_CLR,4.14,6],[-34,22,"·",JACK_BLUE,4.23,10]].map(([x,y,ch,col,d,sz],i) => (
        <text key={i} x={x as number} y={y as number}
          textAnchor="middle" fontSize={sz as number} fill={col as string} fontWeight="bold"
          style={{ opacity: 0, animation: `owner-fade-up 0.32s ease ${d}s forwards` }}
        >{ch as string}</text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SALLY — Cherry Blossom Branch
// A bare branch draws in, then 5 petals stroke out from a shared centre,
// stamens dot in, petals get a blush fill. Small falling petals drift.
// All delays/durations scaled ~1.8× from original.
// ─────────────────────────────────────────────────────────────────────────────
function SallyAnimation() {
  // Branch path
  const BRANCH = "M-30 30 Q-15 10 0 -5 Q8 -15 18 -28";
  const BRANCH_LEN = 78;
  const SIDE_L  = "M0 -5 Q-14 -18 -22 -24";
  const SIDE_R  = "M0 -5 Q10 -4 20 2";

  // 5 petals at angles around centre (0,-28)
  const PETALS = [
    { angle: -90, d: "M0 0 Q4 -12 0 -22 Q-4 -12 0 0Z", len: 44 },
    { angle: -18, d: "M0 0 Q4 -12 0 -22 Q-4 -12 0 0Z", len: 44 },
    { angle:  54, d: "M0 0 Q4 -12 0 -22 Q-4 -12 0 0Z", len: 44 },
    { angle: 126, d: "M0 0 Q4 -12 0 -22 Q-4 -12 0 0Z", len: 44 },
    { angle: 198, d: "M0 0 Q4 -12 0 -22 Q-4 -12 0 0Z", len: 44 },
  ];
  const BLOOM_CX = 0, BLOOM_CY = -28;

  return (
    <svg viewBox="-55 -60 110 110" width={180} height={180} fill="none" style={{ overflow: "visible" }}>

      {/* Ring pulses */}
      {[0, 0.29, 0.58].map((d, i) => (
        <circle key={i} cx={BLOOM_CX} cy={BLOOM_CY} r="0"
          stroke={SALLY_PINK} strokeWidth="1"
          style={{ animation: `owner-ring 0.6s ease-out ${1.0 + d * 0.44}s forwards`, opacity: 0 }}
        />
      ))}

      {/* Branch */}
      <path d={BRANCH} stroke={`hsl(30 35% 45%)`} strokeWidth="2.8"
        strokeLinecap="round" fill="none"
        style={dash(BRANCH_LEN, 0.9, 0.09)}
      />
      <path d={SIDE_L} stroke={`hsl(30 35% 45%)`} strokeWidth="2" strokeLinecap="round" fill="none"
        style={dash(36, 0.24, 0.41)}
      />
      <path d={SIDE_R} stroke={`hsl(30 35% 45%)`} strokeWidth="1.6" strokeLinecap="round" fill="none"
        style={dash(24, 0.19, 0.46)}
      />
      {/* Small twig buds */}
      <path d="M-22 -24 Q-26 -30 -24 -34" stroke={`hsl(30 35% 45%)`} strokeWidth="1.4" strokeLinecap="round" fill="none"
        style={dash(14, 0.14, 0.57)}
      />
      <path d="M18 -28 Q22 -34 20 -38" stroke={`hsl(30 35% 45%)`} strokeWidth="1.4" strokeLinecap="round" fill="none"
        style={dash(14, 0.14, 0.6)}
      />

      {/* 5 petals — stroked first (outline), then fill fades in */}
      {PETALS.map((p, i) => (
        <g key={i} transform={`translate(${BLOOM_CX} ${BLOOM_CY}) rotate(${p.angle})`}>
          <path
            d={p.d}
            stroke={SALLY_PINK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            fill="none"
            style={dash(p.len, 0.54, 1.4 + i * 0.18)}
          />
          {/* petal fill — blush fade */}
          <path
            d={p.d}
            fill={SALLY_PINK} fillOpacity="0"
            stroke="none"
            style={{ animation: `owner-fill-blush 0.9s ease ${2.02 + i * 0.13}s forwards` }}
          />
        </g>
      ))}

      {/* Stamen dots */}
      {[[-3,-31],[3,-31],[0,-33],[-2,-29],[2,-29]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1.3"
          fill={`hsl(45 90% 65%)`}
          style={{ opacity: 0, animation: `owner-pop 0.36s ease ${2.2 + i * 0.11}s forwards` }}
        />
      ))}

      {/* Pistil centre */}
      <circle cx={BLOOM_CX} cy={BLOOM_CY} r="3"
        stroke={SALLY_PINK} strokeWidth="1.5" fill="none"
        style={dash(19, 0.18, 0.93)}
      />

      {/* Small blossom at side twig */}
      {[-4,-3,-2,-1,0].map((angle, i) => (
        <g key={i} transform={`translate(-24 -34) rotate(${-90 + i*72})`}>
          <path d="M0 0 Q1.5 -5 0 -9 Q-1.5 -5 0 0Z"
            stroke={SALLY_PINK} strokeWidth="1.2" fill="none" strokeLinecap="round"
            style={dash(18, 0.32, 1.62 + i * 0.11)}
          />
        </g>
      ))}

      {/* Falling petals */}
      {[
        { x: 28, y: -10, angle: 25, delay: 1.89 },
        { x: -38, y: 10, angle: -15, delay: 2.02 },
        { x: 14,  y: 28, angle: 40, delay: 2.12 },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.angle})`}
          style={{ opacity: 0, animation: `owner-fade-up 0.72s ease ${f.delay}s forwards` }}
        >
          <path d="M0 0 Q1.8 -5.5 0 -10 Q-1.8 -5.5 0 0Z"
            stroke={SALLY_PINK} strokeWidth="1.2" fill={SALLY_PINK} fillOpacity="0.25"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* "SALLY" label */}
      <text x="0" y="38" textAnchor="middle"
        fontSize="8" fontFamily="Cabinet Grotesk, sans-serif" fontWeight="800"
        fill={SALLY_PINK} letterSpacing="2.5"
        style={{ opacity: 0, animation: `owner-fade-up 0.63s ease 1.07s forwards` }}
      >SALLY</text>

      {/* Sparkle stars */}
      {[[36,-38,"✦",SALLY_PINK,2.2],[-40,-14,"✸",VIOLET,2.34],[30,22,"·",SALLY_PINK,2.48]].map(([x,y,ch,col,d],i) => (
        <text key={i} x={x as number} y={y as number}
          textAnchor="middle" fontSize={8} fill={col as string}
          style={{ opacity: 0, animation: `owner-fade-up 0.32s ease ${d}s forwards` }}
        >{ch as string}</text>
      ))}

      <style>{`
        @keyframes owner-fill-blush {
          from { fill-opacity: 0; }
          to   { fill-opacity: 0.18; }
        }
      `}</style>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGETHER — House assembles piece by piece
// Left wall → right wall → roof triangle → chimney → door → window frame
// → a nerd-heart inside the window glows in
// Ring pulses from the chimney top. "HOME" label traces.
// All delays/durations scaled ~1.8× from original.
// ─────────────────────────────────────────────────────────────────────────────
function TogetherAnimation() {
  // House geometry centred at (0, 0):
  const WALL_L   = "M-22 22 L-22 -5";
  const WALL_R   = "M22 22 L22 -5";
  const FLOOR    = "M-22 22 L22 22";
  const ROOF_L   = "M-22 -5 L0 -26";
  const ROOF_R   = "M0 -26 L22 -5";
  const CHIMNEY  = "M8 -26 L8 -36 L14 -36 L14 -22";
  const DOOR     = "M-5 22 L-5 10 Q0 7 5 10 L5 22";
  const WIN_L    = "M-18 5 L-18 -1 L-10 -1 L-10 5 Z";
  const WIN_R    = "M10 5 L10 -1 L18 -1 L18 5 Z";
  const WIN_CROSS_L = "M-14 -1 L-14 5 M-18 2 L-10 2";
  const WIN_CROSS_R = "M14 -1 L14 5 M10 2 L18 2";

  const SMOKE = [
    "M11 -38 Q8 -44 11 -50 Q14 -56 11 -60",
    "M11 -38 Q15 -46 12 -52",
  ];

  const MINI_HEART = "M0 5 C-5 1 -7 -1 -4 -4 C-2 -5 0 -3 0 -3 C0 -3 2 -5 4 -4 C7 -1 5 1 0 5Z";
  const MINI_HEART_LEN = 34;

  return (
    <svg viewBox="-55 -70 110 120" width={180} height={180} fill="none" style={{ overflow: "visible" }}>

      {/* Ring pulses from chimney */}
      {[0, 0.29, 0.58].map((d, i) => (
        <circle key={i} cx="11" cy="-38" r="0"
          stroke={TOGETHER} strokeWidth="1"
          style={{ animation: `owner-ring 0.6s ease-out ${1.23 + d * 0.44}s forwards`, opacity: 0 }}
        />
      ))}

      {/* Floor */}
      <path d={FLOOR} stroke={TOGETHER} strokeWidth="2" strokeLinecap="round"
        style={dash(44, 0.22, 0.04)}
      />

      {/* Walls */}
      <path d={WALL_L} stroke={TOGETHER} strokeWidth="2.2" strokeLinecap="round"
        style={dash(27, 0.19, 0.26)}
      />
      <path d={WALL_R} stroke={TOGETHER} strokeWidth="2.2" strokeLinecap="round"
        style={dash(27, 0.19, 0.32)}
      />

      {/* Roof */}
      <path d={ROOF_L} stroke={TOGETHER} strokeWidth="2.4" strokeLinecap="round"
        style={dash(30, 0.2, 0.48)}
      />
      <path d={ROOF_R} stroke={TOGETHER} strokeWidth="2.4" strokeLinecap="round"
        style={dash(30, 0.2, 0.54)}
      />

      {/* Chimney */}
      <path d={CHIMNEY} stroke={TOGETHER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={dash(50, 0.22, 0.7)}
      />

      {/* Smoke */}
      {SMOKE.map((d, i) => (
        <path key={i} d={d} stroke={GLASS_CLR} strokeWidth="1.4" strokeLinecap="round" fill="none"
          strokeOpacity="0.5"
          style={dash(28, 0.5, 2.12 + i * 0.22)}
        />
      ))}

      {/* Door */}
      <path d={DOOR} stroke={TOGETHER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={dash(38, 0.22, 0.79)}
      />
      {/* Door knob */}
      <circle cx="3.5" cy="16" r="1.2"
        fill={TOGETHER} fillOpacity="0.6"
        style={{ opacity: 0, animation: `owner-pop 0.32s ease 1.05s forwards` }}
      />

      {/* Windows */}
      <path d={WIN_L} stroke={TOGETHER} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={dash(38, 0.21, 0.85)}
      />
      <path d={WIN_R} stroke={TOGETHER} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={dash(38, 0.21, 0.92)}
      />
      <path d={WIN_CROSS_L} stroke={TOGETHER} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6"
        style={dash(18, 0.14, 1.0)}
      />
      <path d={WIN_CROSS_R} stroke={TOGETHER} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6"
        style={dash(18, 0.14, 1.03)}
      />

      {/* Window glow — soft fill */}
      <rect x="-18" y="-1" width="8" height="6" fill={TOGETHER} fillOpacity="0"
        style={{ animation: `owner-fill-blush 0.4s ease 1.08s forwards` }}
      />
      <rect x="10" y="-1" width="8" height="6" fill={TOGETHER} fillOpacity="0"
        style={{ animation: `owner-fill-blush 0.4s ease 1.08s forwards` }}
      />

      {/* Heart in the centre */}
      <path
        d={MINI_HEART}
        stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={dash(MINI_HEART_LEN, 0.68, 2.48)}
      />
      {/* Tiny glasses on mini heart */}
      <circle cx="-2" cy="1" r="2" stroke={GLASS_CLR} strokeWidth="1" fill="none"
        style={dash(13, 0.14, 1.43)}
      />
      <circle cx="2" cy="1" r="2" stroke={GLASS_CLR} strokeWidth="1" fill="none"
        style={dash(13, 0.14, 1.49)}
      />
      <path d="M0 1 H0.2" stroke={GLASS_CLR} strokeWidth="1" strokeLinecap="round"
        style={dash(2, 0.08, 1.55)}
      />

      {/* Heart glow fill */}
      <path d={MINI_HEART} fill={VIOLET} fillOpacity="0" stroke="none"
        style={{ animation: `owner-fill-blush 0.36s ease 1.44s forwards` }}
      />

      {/* Stars / sparkles */}
      {[[-38,-40,"✦",TOGETHER,2.52],[36,-20,"✸",VIOLET,2.66],[-28,30,"·",TOGETHER,2.79]].map(([x,y,ch,col,d],i)=>(
        <text key={i} x={x as number} y={y as number}
          textAnchor="middle" fontSize={8} fill={col as string}
          style={{ opacity: 0, animation: `owner-fade-up 0.32s ease ${d}s forwards` }}
        >{ch as string}</text>
      ))}

      {/* "HOME" label */}
      <text x="0" y="42" textAnchor="middle"
        fontSize="8" fontFamily="Cabinet Grotesk, sans-serif" fontWeight="800"
        fill={TOGETHER} letterSpacing="2.5"
        style={{ opacity: 0, animation: `owner-fade-up 0.63s ease 1.28s forwards` }}
      >HOME</text>
    </svg>
  );
}

// ── Global keyframes needed by all three ─────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes owner-draw {
    to { stroke-dashoffset: 0; }
  }
  @keyframes owner-fade-up {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes owner-pop {
    0%   { opacity: 0; transform: scale(0.4); }
    60%  { transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes owner-ring {
    0%   { r: 0; opacity: 0.6; }
    100% { r: 62; opacity: 0; }
  }
  @keyframes owner-fill-blush {
    from { fill-opacity: 0; }
    to   { fill-opacity: 0.22; }
  }
  @keyframes owner-intro-bg {
    0%   { opacity: 1; }
    88%  { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// ── Duration map per owner ───────────────────────────────────────────────────
// Durations are set to cover the full animation + 500ms hold before fade.
// Jack:     last element (stars) completes ~4.2s → 5000ms
// Sally:    last element (petal fill) completes ~3.44s → 4500ms
// Together: last element (heart draw + stars) completes ~3.2s → 4200ms
const OWNER_DURATION: Record<string, number> = {
  jack:     5000,
  sally:    4500,
  together: 4200,
};

// ── Main export ───────────────────────────────────────────────────────────────
export default function OwnerIntro({
  owner,
  accent,
  onDone,
}: {
  owner: string;
  accent: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const dur = OWNER_DURATION[owner] ?? 3000;
    const t = setTimeout(onDone, dur);
    return () => clearTimeout(t);
  }, [owner, onDone]);

  const dur = OWNER_DURATION[owner] ?? 3000;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      aria-hidden
      style={{
        backgroundColor: "#0b0c14",
        animation: `owner-intro-bg ${dur / 1000}s ease forwards`,
      }}
    >
      <style>{GLOBAL_STYLES}</style>
      <div
        style={{
          filter: `drop-shadow(0 0 28px ${accent}88)`,
          animation: "owner-intro-fade 0.32s ease forwards",
        }}
      >
        {owner === "jack"     && <JackAnimation />}
        {owner === "sally"    && <SallyAnimation />}
        {owner === "together" && <TogetherAnimation />}
      </div>
      <style>{`
        @keyframes owner-intro-fade {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
