import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "How we verify – Context Layer" };
const TIER: Record<string, string> = { primary: "Primary source", reporting: "Reporting", "other-side": "Other sides" };

export default function Verify() {
  return (
    <main className="narrow prose">
      <h1 className="page-title">How we check every story</h1>
      <p>A summary is only useful if you can trust it. So a card is not a summary you have to take on faith. Every claim on it points back to the exact passage in the original article.</p>

      <h2>What happens when you tap Get context</h2>
      <ol>
        <li><b>We read the original.</b> Paste any public article. If the story links to the company&rsquo;s own announcement, such as OpenAI&rsquo;s post, we read that first and use the reporter as a second source.</li>
        <li><b>A language model drafts the story.</b> It has to attach an exact quote to every claim, and it may not use outside knowledge.</li>
        <li><b>Our code finds each quote.</b> If a quote is not found word for word in the source, the claim is removed before you see it.</li>
        <li><b>A second check reads each claim against its quote.</b> Finding a quote is not enough, so we check that the quote supports the whole claim, including timing, scope, certainty and who said it. Claims that go further than their quote are removed.</li>
        <li><b>You can check it yourself.</b> Tap Show where this comes from to open the source at that passage.</li>
      </ol>
      <p>At the bottom of each story you will see how many source passages are attached. These are three different checks, and we do all of them except the last: finding the quote, checking that the quote supports the claim, and checking that the publisher is right. We do not judge whether the publisher is right.</p>

      <h2>On our source list, and outside it</h2>
      <p>We check whether the article supports the summary. The label only tells you whether the publisher is on our source list below. You can paste a link from any other public site too. We still check every quote against that page, and the story is labeled Outside our source list. If a page is behind a paywall or blocks automated readers, you can paste the article text instead.</p>

      <h2>What we measured</h2>
      <p>Before adding the automatic check, we audited 60 claims by hand against their articles.</p>
      <div className="stat">
        <div><strong>57 of 60</strong><span>claims supported by the article</span></div>
        <div><strong>1</strong><span>claim made up</span></div>
        <div><strong>2</strong><span>claims we could not find</span></div>
      </div>
      <p>That audit was of our first version, before the support check above. We have not yet re-run it on the new checks, so treat the numbers as the starting point, not the current score.</p>

      <h2>What a card does not do</h2>
      <ul>
        <li>It does not tell you what to think or what to buy.</li>
        <li>It does not check whether the article itself is right. It checks that the card matches the article.</li>
        <li>Your picks only change the order of the feed, and each story says why it is there.</li>
      </ul>

      <h2>Our source list</h2>
      <p>These outlets are on our source list. Some block automated readers, so a few stories may fail to load.</p>
      <ul className="srcs">
        {Object.values(SOURCES).map((s) => <li key={s.name}>{s.name}<small>{TIER[s.tier]}</small></li>)}
      </ul>

      <h2>Think a claim is wrong?</h2>
      <p>Use Report a problem at the bottom of any story. You can point to a specific claim and tell us what we missed. The team reviews every report.</p>
    </main>
  );
}
