// Minimal Supabase REST client (service role, server only). Everything degrades gracefully if keys are missing.
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const sbEnabled = !!(base && key);

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  if (!sbEnabled) return null;
  const { prefer, ...rest } = init;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...rest,
    cache: "no-store",
    headers: { apikey: key!, Authorization: `Bearer ${key}`, "content-type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res || !res.ok) {
    if (res) console.error("supabase", path, res.status, (await res.text()).slice(0, 200));
    return null;
  }
  return res;
}

export async function getCachedCard(url: string): Promise<unknown | null> {
  const r = await rest(`cards?url=eq.${encodeURIComponent(url)}&select=card&limit=1`);
  if (!r) return null;
  const rows = (await r.json()) as { card: unknown }[];
  return rows[0]?.card ?? null;
}
export async function saveCard(url: string, card: unknown) {
  await rest("cards", { method: "POST", body: JSON.stringify({ url, card }), prefer: "resolution=merge-duplicates,return=minimal" });
}
export async function insertEvent(e: { pid: string; event: string; props: unknown }) {
  await rest("events", { method: "POST", body: JSON.stringify(e), prefer: "return=minimal" });
}
export async function insertReport(r: { url: string; claim: string; reason: string; pid: string }) {
  await rest("reports", { method: "POST", body: JSON.stringify(r), prefer: "return=minimal" });
}
export async function listEvents(limit = 20000) {
  const r = await rest(`events?select=ts,pid,event,props&order=ts.desc&limit=${limit}`);
  return r ? ((await r.json()) as { ts: string; pid: string; event: string; props: Record<string, unknown> }[]) : [];
}
export async function listReports() {
  const r = await rest("reports?select=*&order=ts.desc&limit=200");
  return r ? ((await r.json()) as Record<string, unknown>[]) : [];
}
