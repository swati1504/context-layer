// Topic-level stock photos from Unsplash. We search by topic (not by story) so images are relevant but never misleading,
// and pick one deterministically per story so the feed does not repeat the same picture.
export type Photo = { src: string; credit: string; creditUrl: string; alt: string };

export const TOPIC_QUERY: Record<string, string> = {
  "AI at work": "people working on laptops office",
  "Privacy": "security camera surveillance",
  "Apps I use": "smartphone apps screen",
  "Big Tech": "data center servers",
  "Money and business": "stock market trading screen",
  "Chips and hardware": "microchip circuit board",
  "Kids and school": "children classroom tablet",
  "Health and medicine": "hospital doctor technology",
  "Science and space": "telescope night sky laboratory",
  "Policy and law": "courthouse justice",
  "Creators and media": "video creator studio camera",
  "Startups": "startup team whiteboard",
  "Security": "cybersecurity padlock code",
  general: "technology abstract light",
};

type Raw = { alt_description?: string | null; urls: { regular: string }; user: { name: string; links: { html: string } } };
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function topicPhotos(topic: string): Promise<Photo[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const q = TOPIC_QUERY[topic] ?? TOPIC_QUERY.general;
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24&orientation=landscape&content_filter=high`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: Raw[] };
    return (j.results ?? []).map((p) => ({
      src: p.urls.regular.replace(/w=\d+/, "w=800"),
      credit: p.user.name,
      creditUrl: `${p.user.links.html}?utm_source=context_layer&utm_medium=referral`,
      alt: p.alt_description ?? topic,
    }));
  } catch { return []; }
}

export async function pickPhoto(topic: string, seed: string): Promise<Photo | null> {
  const list = await topicPhotos(topic);
  return list.length ? list[hash(seed) % list.length] : null;
}
