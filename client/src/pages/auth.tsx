import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, setAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const { login } = useAuth();

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { username: form.username, password: form.password }
        : form;
      const res = await apiRequest("POST", endpoint, body);
      return res.json() as Promise<{ token: string; user: any }>;
    },
    onSuccess: (data) => {
      setErrorMsg("");
      // Store token in the module-level store so apiRequest always sends it
      setAuthToken(data.token);
      // Store user + token in React context (in-memory, iframe-safe)
      login(data.token, data.user);
      if (mode === "register") {
        setSuccessMsg("Account created! Welcome to Framestack.");
      }
    },
    onError: (err: any) => {
      setSuccessMsg("");
      setErrorMsg(err.message || "Something went wrong");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    mutation.mutate();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrorMsg("");
    setSuccessMsg("");
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 bg-card border-r border-border relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, hsl(255,70%,45%) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, hsl(190,65%,40%) 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="8" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" />
              <rect x="8" y="4" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.45" />
              <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Framestack
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Your personal media universe.</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-3" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              One place for everything you watch, read, and love.
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Track anime, manga, movies, series, and books. Organize into collections. Never lose track of what's next.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Anime & Manga", sub: "Powered by Jikan / MAL" },
              { label: "Movies & Series", sub: "Powered by OMDb" },
              { label: "Books", sub: "Powered by Open Library" },
              { label: "Collections", sub: "Organize your lists" },
            ].map(({ label, sub }) => (
              <div key={label} className="rounded-lg bg-secondary/40 px-4 py-3 border border-border">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground relative z-10">
          Free to use. All data is private to your account.
        </p>
      </div>

      {/* Right: auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="8" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" />
              <rect x="8" y="4" width="20" height="14" rx="2" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeOpacity="0.45" />
              <path d="M7 15l4 4 6-7" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Framestack</span>
          </div>

          <div className="mb-7">
            <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to your library" : "Start tracking your media"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  data-testid="input-display-name"
                  placeholder="Your name"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="username"
                required
                autoComplete="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  data-testid="input-password"
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                data-testid="auth-error"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                data-testid="auth-success"
                className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400"
              >
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              data-testid="button-submit-auth"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? mode === "login" ? "Signing in…" : "Creating account…"
                : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            </span>
            <button
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              data-testid="button-switch-auth"
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
