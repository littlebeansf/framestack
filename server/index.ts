import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import session from "express-session";
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

// ── Session ────────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(session({
  name: "__Host-fs",
  secret: process.env.SESSION_SECRET || "framestack-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// ── Password gate ──────────────────────────────────────────────────────────────
const PASSWORD = process.env.SITE_PASSWORD!;

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
  .logo{
    font-size:2.2rem;
    line-height:1;
  }
  h1{
    font-size:1.1rem;
    font-weight:700;
    letter-spacing:-.01em;
    color:#e2e4f0;
  }
  p{
    font-size:.8rem;
    color:#6b7099;
    text-align:center;
    line-height:1.5;
  }
  form{width:100%;display:flex;flex-direction:column;gap:.75rem}
  input{
    width:100%;
    background:#1c1f36;
    border:1px solid #2a2d4a;
    border-radius:10px;
    padding:.65rem 1rem;
    font-size:.9rem;
    color:#e2e4f0;
    outline:none;
    transition:border-color .15s;
  }
  input:focus{border-color:#7c5cfc}
  button{
    width:100%;
    background:#7c5cfc;
    color:#fff;
    border:none;
    border-radius:10px;
    padding:.7rem;
    font-size:.9rem;
    font-weight:700;
    cursor:pointer;
    transition:opacity .15s;
  }
  button:hover{opacity:.85}
  .err{
    font-size:.78rem;
    color:#f87171;
    text-align:center;
    display:none;
  }
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

function isAuthenticated(req: Request): boolean {
  return (req.session as any).authed === true;
}

// Handle login POST
app.post("/__auth", express.urlencoded({ extended: false }), (req: Request, res: Response) => {
  if (req.body?.password === PASSWORD) {
    (req.session as any).authed = true;
    res.redirect(req.query.next ? String(req.query.next) : "/");
  } else {
    res.status(401).send(LOGIN_HTML.replace("{{ERR_CLASS}}", "show"));
  }
});

// Gate every request
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/__auth") return next();
  if (isAuthenticated(req)) return next();
  res.status(401).send(LOGIN_HTML.replace("{{ERR_CLASS}}", ""));
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
