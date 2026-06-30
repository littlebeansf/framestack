import { useState, useEffect, useRef } from "react";
import { tryLogin } from "@/lib/auth";
import { LogoIcon } from "@/App";

// ── Heart-nerd SVG animation ───────────────────────────────────────────────

function HeartNerd({ success }: { success: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 120, height: 120 }}
    >
      {/* Orbiting particles — appear on success */}
      {success && (
        <>
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary"
              style={{
                animation: `orbit 1.2s ease-out forwards`,
                animationDelay: `${i * 60}ms`,
                "--orbit-deg": `${deg}deg`,
                opacity: 0,
              } as any}
            />
          ))}
        </>
      )}

      <svg
        viewBox="0 0 120 120"
        width={120}
        height={120}
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
          className={success ? "heart-fill" : ""}
          style={{
            strokeDasharray: 270,
            strokeDashoffset: 270,
            animation: "draw-heart 0.9s ease forwards",
          }}
        />

        {/* Glasses frame left */}
        <circle
          cx="44" cy="62" r="11"
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
        <circle
          cx="76" cy="62" r="11"
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
        <path
          d="M55 62 H65"
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
        <path
          d="M33 62 H26"
          stroke="hsl(220 12% 75%)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 8,
            strokeDashoffset: 8,
            animation: "draw-heart 0.3s 1s ease forwards",
          }}
        />
        {/* Right arm */}
        <path
          d="M87 62 H94"
          stroke="hsl(220 12% 75%)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 8,
            strokeDashoffset: 8,
            animation: "draw-heart 0.3s 1s ease forwards",
          }}
        />

        {/* Eyes — cute dots inside glasses */}
        <circle
          cx="44" cy="62" r="3"
          fill="hsl(255 70% 65%)"
          style={{
            opacity: 0,
            animation: "fade-in-up 0.3s 1s ease forwards",
          }}
        />
        <circle
          cx="76" cy="62" r="3"
          fill="hsl(255 70% 65%)"
          style={{
            opacity: 0,
            animation: "fade-in-up 0.3s 1s ease forwards",
          }}
        />

        {/* Tiny stars */}
        {[[22, 28], [98, 32], [16, 72], [104, 68]].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y} l1.5 3 3 0 -2.4 2 1 3.2 -2.6-1.8 -2.6 1.8 1-3.2 -2.4-2 3 0Z`}
            fill="hsl(255 70% 70%)"
            style={{
              opacity: 0,
              animation: `twinkle 0.6s ${0.8 + i * 0.15}s ease forwards`,
              transformOrigin: `${x}px ${y}px`,
            }}
          />
        ))}

        {/* Success fill overlay */}
        {success && (
          <path
            d="M60 95 C20 70 10 45 20 30 C30 15 50 15 60 30 C70 15 90 15 100 30 C110 45 100 70 60 95Z"
            fill="hsl(255 70% 65%)"
            style={{
              opacity: 0,
              animation: "heart-pulse 0.5s ease forwards",
            }}
          />
        )}
      </svg>
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────────

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim() || loading) return;
    setLoading(true);
    setError(false);
    const ok = await tryLogin(pw);
    if (ok) {
      setSuccess(true);
      setTimeout(onSuccess, 900);
    } else {
      setError(true);
      setLoading(false);
      setPw("");
      // Shake animation
      inputRef.current?.classList.add("shake");
      setTimeout(() => inputRef.current?.classList.remove("shake"), 500);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4"
      style={{ fontFamily: "'Satoshi', sans-serif" }}
    >
      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 animate-page-in">
          <LogoIcon size={36} />
          <div className="text-center">
            <h1
              className="text-2xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
            >
              Framestack
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your personal media universe</p>
          </div>
        </div>

        {/* Heart nerd */}
        <div style={{ animation: "fade-in-up 0.6s 0.2s ease both" }}>
          <HeartNerd success={success} />
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full space-y-3"
          style={{ animation: "fade-in-up 0.5s 0.4s ease both", opacity: 0 }}
        >
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false); }}
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading || success}
              className={[
                "w-full rounded-lg border px-4 py-3 text-sm bg-card text-foreground",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
                "transition-all duration-200",
                error
                  ? "border-destructive/60 ring-1 ring-destructive/30"
                  : "border-border",
                success ? "border-green-500/50 ring-1 ring-green-500/30" : "",
              ].join(" ")}
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5 text-center animate-page-in">
                Wrong password
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!pw.trim() || loading || success}
            className={[
              "w-full rounded-lg py-3 text-sm font-semibold transition-all duration-200",
              "bg-primary text-primary-foreground",
              "hover:opacity-90 active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              success ? "bg-green-600" : "",
            ].join(" ")}
          >
            {success ? "Welcome ✓" : loading ? "Checking…" : "Enter"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground/30 text-center">
          Private collection
        </p>
      </div>
    </div>
  );
}
