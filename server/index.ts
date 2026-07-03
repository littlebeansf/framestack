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
  <form id="lf">
    <input id="pw" type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <div class="err {{ERR_CLASS}}" id="err">Wrong password — try again.</div>
    <button type="submit">Enter</button>
  </form>
  <script>
  // In the published pplx.app sandbox, static routes go to S3 (POST blocked).
  // Backend routes go through /port/5000/. Detect environment from the origin.
  (function(){
    // In the published sandbox we're at https://<slug>.pplx.app — backend is at /port/5000
    // In dev (localhost) both are on the same port so no prefix needed.
    var isProd = window.location.hostname.endsWith('.pplx.app');
    var authUrl = isProd ? '/port/5000/__auth' : '/__auth';
    document.getElementById('lf').addEventListener('submit', function(e){
      e.preventDefault();
      var pw = document.getElementById('pw').value;
      fetch(authUrl, {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: 'password=' + encodeURIComponent(pw)
      }).then(function(r){ return r.json(); }).then(function(d){
        if (d.token) {
          window.location.href = '/#__token=' + d.token;
        } else {
          document.getElementById('err').className = 'err show';
        }
      }).catch(function(){ document.getElementById('err').className = 'err show'; });
    });
  })();
  </script>
</div>
</body>
</html>`;

// Login POST — returns JSON {token} so the login page JS can set window.location.hash.
// Using JSON avoids the S3 CDN 405 that a native form POST to /__auth triggers
// in the published pplx.app sandbox (non-/port/5000 paths are CDN-only).
app.post("/__auth", express.urlencoded({ extended: false }), express.json(), (req: Request, res: Response) => {
  if (req.body?.password === PASSWORD) {
    res.json({ token: VALID_TOKEN });
  } else {
    res.status(401).json({ error: "Wrong password" });
  }
});

// ── HTML gate — always show login page for all non-excluded routes ─────────────
// API routes are protected separately below (x-auth-token header check).
// Static assets (/assets/*, favicons) are served freely by static.ts so the
// login page can load its own CSS/JS.
// NOTE: We intentionally do NOT check isHtmlRequest / Accept headers here.
// The CDN/proxy layer (pplx.app) may strip or modify Accept headers, causing
// isHtmlRequest to return false and bypass the login gate. Instead we
// unconditionally serve the login page for all non-excluded paths.
app.use((req: Request, res: Response, next: NextFunction) => {
  // Always allow: the auth endpoint itself, static assets, API routes
  if (req.path === "/__auth") return next();
  if (req.path.startsWith("/assets/")) return next();
  if (req.path.startsWith("/api/")) return next();
  if (["/favicon.svg", "/favicon-32.png", "/favicon-512.png", "/apple-touch-icon.png"].includes(req.path)) return next();

  // Unconditionally show login for everything else — no Accept-header check.
  // React reads the token from the URL hash after login and stores it.
  res.send(LOGIN_HTML.replace("{{ERR_CLASS}}", ""));
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
