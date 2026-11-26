import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Free plan: 3 follow-up questions per story. The count lives in a signed cookie the browser cannot edit,
// so it holds even if someone changes local storage. Clearing cookies still starts over: there are no accounts to tie it to.
export const ASK_FREE = 3;
const NAME = "cl_q";
const secret = () => process.env.ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");
const key = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 8);

export function readCounts(req: Request): Record<string, number> {
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(NAME + "="))?.slice(NAME.length + 1);
  if (!raw) return {};
  const [v, sig] = raw.split(".");
  try {
    if (!v || !sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(sign(v)))) return {};
    return JSON.parse(Buffer.from(v, "base64url").toString());
  } catch { return {}; }
}
export const usedFor = (req: Request, url: string) => readCounts(req)[key(url)] ?? 0;

export function bumpCookie(req: Request, url: string): string {
  const c = readCounts(req);
  c[key(url)] = (c[key(url)] ?? 0) + 1;
  const entries = Object.entries(c).slice(-40);
  const v = Buffer.from(JSON.stringify(Object.fromEntries(entries))).toString("base64url");
  return `${NAME}=${v}.${sign(v)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`;
}
