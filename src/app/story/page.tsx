import type { Metadata } from "next";
import { connection } from "next/server";
import { lookupCard } from "@/lib/cardService";
import StoryClient from "./StoryClient";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ u?: string }> }): Promise<Metadata> {
  await connection();
  const { u } = await searchParams;
  if (!u) return { title: "Context Layer" };
  let card = null;
  try { card = await lookupCard(u); } catch {}
  if (!card) return { title: "Context Layer: understand the story, not just the headline" };
  const title = card.headline;
  const description = card.summary.text.slice(0, 200);
  const img = `/api/og?t=${encodeURIComponent(title)}`;
  return {
    title: `${title} | Context Layer`,
    description,
    openGraph: { title, description, type: "article", images: [{ url: img, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default function Page() { return <StoryClient />; }
