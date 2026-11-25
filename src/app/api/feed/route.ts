import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";
export const revalidate = 900;
export async function GET() {
  try {
    return NextResponse.json({ items: await getFeed() });
  } catch (e) {
    console.error("feed failed:", e);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
