import { NextResponse } from "next/server";
import { pickPhoto } from "@/lib/photo";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const topic = (q.get("topic") ?? "general").slice(0, 40);
  const seed = (q.get("seed") ?? topic).slice(0, 500);
  const photo = await pickPhoto(topic, seed);
  return NextResponse.json({ photo }, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
