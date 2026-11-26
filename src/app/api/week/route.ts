import { NextResponse, connection } from "next/server";
import { getWeek } from "@/lib/week";

export const maxDuration = 60;

export async function GET() {
  await connection();
  try { return NextResponse.json({ week: await getWeek() }); } catch (e) { console.error("week failed:", e instanceof Error ? e.message : e); return NextResponse.json({ week: null }, { status: 500 }); }
}
