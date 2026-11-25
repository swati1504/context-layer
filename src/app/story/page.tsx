"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ContextCard, { factsOf, type Card } from "@/components/ContextCard";
import Explainable from "@/components/Explainable";
import { addHistory } from "@/lib/profile";
import { log } from "@/lib/store";

const MSG: Record<string, string> = {
  blocked: "We could not open the original page. It may sit behind a paywall or block automated readers.",
  too_short: "We could not read enough of that page to build the story.",
  bad_url: "That link does not look right.",
  limit: "The daily card limit has been reached. Try again tomorrow.",
};

export default function Story() {
  const [state, setState] = useState<{ s: "load" | "done" | "err"; card?: Card; msg?: string }>({ s: "load" });
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("u") ?? "";
    setUrl(u);
    if (!u) { setState({ s: "err", msg: "No story link was given." }); return; }
    log("get_context_click", { url: u, via: "share" });
    fetch("/api/card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: u }) })
      .then(async (r) => ({ ok: r.ok, j: await r.json() }))
      .then(({ ok, j }) => {
        if (!ok) return setState({ s: "err", msg: MSG[j.error] ?? "Something went wrong building the story." });
        addHistory(j.card.tags);
        setState({ s: "done", card: j.card });
      })
      .catch(() => setState({ s: "err", msg: "Something went wrong building the story." }));
  }, []);
  return (
    <main className="narrow" style={{ paddingTop: 36 }}>
      <p className="fine" style={{ margin: "0 0 16px" }}><Link href="/">← Back to today’s tech news</Link></p>
      {state.s === "load" && <p className="skeleton" role="status">Reading the article and checking every quote. This takes about 15 seconds.</p>}
      {state.s === "err" && <p className="err" role="alert">{state.msg} <Link href="/">Go to the feed</Link></p>}
      {state.s === "done" && state.card && (
        <Explainable facts={factsOf(state.card)} headline={state.card.headline} url={url}>
          <ContextCard card={state.card} url={url} />
        </Explainable>
      )}
    </main>
  );
}
