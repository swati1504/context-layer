import { NextResponse, connection } from "next/server";
import { getTrending } from "@/lib/trending";

export async function GET() {
  await connection();
  try { return NextResponse.json({ items: await getTrending() }); } catch { return NextResponse.json({ items: [] }); }
}
