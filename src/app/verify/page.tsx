import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "How we verify – Context Layer" };
const TIER: Record<string, string> = { primary: "Primary source", reporting: "Reporting", "other-side": "Other sides" };

export default function Verify() {
  return (
    <main className="narrow prose">
      <h1 className="page-title">How we verify every card</h1>
      <p>A summary is only useful if you can trust it. So a card is not a summary you have to take on faith. Every claim on it points back to the exact passage in the original article.</p>

      <h2>What happens when you tap Get context</h2>
      <ol>
        <li><b>We only read approved sources.</b> The link has to come from a site on the list below. Anything else is declined, because we cannot verify it.</li>
        <li><b>We read the full article.</b> We fetch the page and pull out the article text.</li>
        <li><b>A language model drafts the card.</b> It has to attach an exact quote from the article to every claim, and it may not use outside knowledge.</li>
        <li><b>Our code checks the quotes.</b> If a quote is not found word for word in the article, the claim is removed before you see the card.</li>
        <li><b>You can check it yourself.</b> Tap Show where this comes from to see the passage, or open the article scrolled to that passage.</li>
      </ol>
      <p>The counter at the top of each card, such as 6 of 7 claims verified, shows how many claims survived the check and how many were removed.</p>

      <h2>What we measured</h2>
      <p>Before adding the automatic check, we audited 60 claims by hand against their articles.</p>
      <div className="stat">
        <div><strong>57 of 60</strong><span>claims supported by the article</span></div>
        <div><strong>1</strong><span>claim made up</span></div>
        <div><strong>2</strong><span>claims we could not find</span></div>
      </div>
      <p>That is why the quote check exists. A claim that cannot point to the article does not get shown.</p>

      <h2>What a card does not do</h2>
      <ul>
        <li>It does not tell you what to think or what to buy.</li>
        <li>It does not check whether the article itself is right. It checks that the card matches the article.</li>
        <li>The note on why a story matters to you is written for your profile from the verified claims. It is a possibility, not a prediction.</li>
      </ul>

      <h2>Approved sources</h2>
      <p>These sites can be read today. Some block automated readers, and paywalled sites cannot be read, so a few may fail for a given story.</p>
      <ul className="srcs">
        {Object.values(SOURCES).map((s) => <li key={s.name}>{s.name}<small>{TIER[s.tier]}</small></li>)}
      </ul>

      <h2>Think a claim is wrong?</h2>
      <p>Every claim has a Report a wrong claim button. Reported claims are marked as under review and checked by a person.</p>
    </main>
  );
}
