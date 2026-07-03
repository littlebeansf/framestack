import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Auth token ────────────────────────────────────────────────────────────────
// A simple static token derived from the password. No sessions needed — the
// React app reads the token from the URL after login and attaches it as a
// header on every API request. This works across the S3 + Express proxy split
// in the published sandbox where session cookies don't survive.
const PASSWORD = process.env.SITE_PASSWORD!;
// Stable token: sha256-like hash of the password (deterministic, no JWT lib needed)
function makeToken(pw: string): string {
  // simple but adequate: interleave char codes + rotate
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  // second pass for extra diffusion
  let h2 = 0xdeadbeef;
  for (let i = pw.length - 1; i >= 0; i--) {
    h2 ^= pw.charCodeAt(i);
    h2 = (Math.imul(h2, 0x01000193) >>> 0);
  }
  return `${h.toString(16).padStart(8,"0")}${h2.toString(16).padStart(8,"0")}${pw.length.toString(16)}`;
}
const VALID_TOKEN = PASSWORD ? makeToken(PASSWORD) : "";

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Framestack</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:#0b0c14;
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;
    font-family:'Satoshi',system-ui,sans-serif;
    color:#e2e4f0;
  }
  .card{
    background:#13152a;
    border:1px solid #2a2d4a;
    border-radius:20px;
    padding:2.5rem 2rem;
    width:340px;
    display:flex;flex-direction:column;align-items:center;gap:1.5rem;
    box-shadow:0 8px 40px #0005;
  }
  .logo{font-size:2.2rem;line-height:1}
  h1{font-size:1.1rem;font-weight:700;letter-spacing:-.01em;color:#e2e4f0}
  p{font-size:.8rem;color:#6b7099;text-align:center;line-height:1.5}
  form{width:100%;display:flex;flex-direction:column;gap:.75rem}
  input{
    width:100%;background:#1c1f36;border:1px solid #2a2d4a;border-radius:10px;
    padding:.65rem 1rem;font-size:.9rem;color:#e2e4f0;outline:none;transition:border-color .15s;
  }
  input:focus{border-color:#7c5cfc}
  button{
    width:100%;background:#7c5cfc;color:#fff;border:none;border-radius:10px;
    padding:.7rem;font-size:.9rem;font-weight:700;cursor:pointer;transition:opacity .15s;
  }
  button:hover{opacity:.85}
  .err{font-size:.78rem;color:#f87171;text-align:center;display:none}
  .err.show{display:block}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🎬</div>
  <h1>Framestack</h1>
  <p>Your personal media universe.<br>Enter the password to continue.</p>
  <form method="POST" action="/__auth">
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <div class="err {{ERR_CLASS}}">Wrong password — try again.</div>
    <button type="submit">Enter</button>
  </form>
</div>
</body>
</html>`;

// ── Login POST — validates password, redirects with token in URL hash ──────────
app.post("/__auth", express.urlencoded({ extended: false }), (req: Request, res: Response) => {
  if (req.body?.password === PASSWORD) {
    // Pass token via URL hash so the React SPA can read it from window.location.hash
    // and store it in memory (no localStorage/cookie needed)
    res.redirect(`/#__token=${VALID_TOKEN}`);
  } else {
    res.status(401).send(LOGIN_HTML.replace("{{ERR_CLASS}}", "show"));
  }
});

// ── HTML gate — show login page for unauthenticated requests to index.html ────
// API routes are protected separately below (x-auth-token header check).
// Static assets (/assets/*, favicons) are served freely by static.ts so the
// login page can load its own CSS/JS.
function isHtmlRequest(req: Request): boolean {
  const accept = req.headers.accept || "";
  return accept.includes("text/html");
}

app.use((req: Request, res: Response, next: NextFunction) => {
  // Always allow: the auth endpoint itself, static assets, API routes
  if (req.path === "/__auth") return next();
  if (req.path.startsWith("/assets/")) return next();
  if (req.path.startsWith("/api/")) return next();
  if (["/favicon.svg", "/favicon-32.png", "/favicon-512.png", "/apple-touch-icon.png"].includes(req.path)) return next();

  // For HTML navigation — check if the browser already knows the token via referrer
  // We can't check session here; instead just serve the login page for non-API requests
  // if they don't carry a valid x-auth-token. HTML requests come from browser nav, not
  // from the React app — so we always show login page (React reads token from hash).
  if (isHtmlRequest(req)) {
    // Serve login page — React will re-attach token from URL hash after login
    res.send(LOGIN_HTML.replace("{{ERR_CLASS}}", ""));
    return;
  }

  next();
});

// ── API auth middleware — check x-auth-token header ────────────────────────────
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers["x-auth-token"] as string | undefined;
  if (!token || token !== VALID_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); },
  );
})();
