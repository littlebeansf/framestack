/**
 * Client-side auth gate.
 * The password is never stored — only its SHA-256 hash is hardcoded.
 * The session is persisted in localStorage as the hash itself.
 */

const HASH = "5d7d2cd2be3a4b37350cdcecf978343b9f3146967f87bebd58c8921cb1c36859";
const LS_KEY = "framestack_auth";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tryLogin(password: string): Promise<boolean> {
  const hash = await sha256(password);
  if (hash === HASH) {
    try { localStorage.setItem(LS_KEY, hash); } catch {}
    return true;
  }
  return false;
}

export function isAuthenticated(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === HASH;
  } catch {
    return false;
  }
}

export function logout(): void {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
