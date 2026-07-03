import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Static assets (JS/CSS/images) are served without auth so the login page
  // can load its own assets. Only .html falls through to the auth gate.
  app.use("/assets", express.static(path.join(distPath, "assets")));
  app.use("/favicon.svg",       express.static(path.join(distPath, "favicon.svg")));
  app.use("/favicon-32.png",    express.static(path.join(distPath, "favicon-32.png")));
  app.use("/favicon-512.png",   express.static(path.join(distPath, "favicon-512.png")));
  app.use("/apple-touch-icon.png", express.static(path.join(distPath, "apple-touch-icon.png")));

  // index.html and all other HTML routes go through the auth gate (registered in index.ts)
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
