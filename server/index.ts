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

// HTML gate removed — auth is now handled in the React frontend (App.tsx).
// The React login screen posts to /port/5000/__auth (prod) or /__auth (dev)
// and stores the returned token in memory + sessionStorage.


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
