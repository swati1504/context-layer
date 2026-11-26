import type { Metadata } from "next";
import Link from "next/link";
import { Clipping } from "@/components/FeedBits";
import Enter from "./Enter";

export const metadata: Metadata = {
  title: "Context Layer: understand the story, not just the headline",
  description: "Tech news in plain words. Every claim links to the exact passage it came from, and the assistant says so when the sources don't answer you.",
};

const QUOTE = "Customers who do not opt out by March 3 will have their backups scanned and used to train the company's models.";

export default function Welcome() {
  return (
    <main className="welcome">
      <section className="w-hero">
        <h1 className="hero">Tech news you can actually follow.</h1>
        <p className="lede">Context Layer explains each story in plain words, shows the exact passage behind every claim, and says so when the sources don’t answer your question.</p>
        <div className="w-cta"><Enter className="btn big">Open today’s feed</Enter><Link className="btn sec-btn big" href="/week">See this week in tech</Link></div>
      </section>

      <section className="w-list" aria-label="What makes it different">
        <article className="w-item">
          <div>
            <h2>Every claim links to where it came from</h2>
            <p>Each sentence in a summary comes with the original passage. One click opens the article, scrolled to those words. If we can’t find the passage, the claim doesn’t appear.</p>
          </div>
          <Clipping quote={QUOTE} />
        </article>

        <article className="w-item">
          <div>
            <h2>Highlight anything that confuses you</h2>
            <p>Select a word or sentence and get a plain-language explanation, grounded in the story you are reading. No jargon lookup in another tab.</p>
          </div>
          <div className="w-demo"><p>The company will use <span className="term">federated learning</span> to train on customer data.</p><p className="termdef"><b>federated learning:</b> training a model on many devices without collecting their raw data in one place.</p></div>
        </article>

        <article className="w-item">
          <div>
            <h2>An assistant that admits what it can’t answer</h2>
            <p>Ask a follow-up and every answer cites the article. When the story doesn’t cover it, the assistant says that instead of guessing.</p>
          </div>
          <div className="w-demo"><p className="q">Can I opt out?</p><p>Yes, by March 3 in your account settings <span className="cite">1</span></p><p className="q">What is the Work tab?</p><p className="muted">The story doesn’t say, so we can’t answer that.</p></div>
        </article>

        <article className="w-item">
          <div>
            <h2>This week in tech, three stories that matter</h2>
            <p>One page, once a week: what changed, who it affects, and what to do about it. Built from the same checked sources.</p>
          </div>
          <div className="w-demo"><p className="q">Who this affects</p><p>Anyone with cloud backups, and teams that store customer data there.</p></div>
        </article>

        <article className="w-item">
          <div>
            <h2>A feed that tells you why</h2>
            <p>Pick your interests and stories are ranked for you. Every story says why it’s there, such as “Because you picked AI” or “Covered by 3 outlets”. The rules are simple and visible.</p>
          </div>
          <div className="w-demo"><span className="reason">Because you picked AI</span><p className="muted" style={{ marginTop: 12 }}>Ranked by your interests, what you read or saved, how many outlets cover it, and how new it is.</p></div>
        </article>
      </section>
      <p className="fine" style={{ marginTop: 16 }}>Examples above are illustrative, not from a real story.</p>

      <section className="w-end">
        <h2>Start with today’s stories</h2>
        <p>No account needed. Paste any news link to get the same treatment.</p>
        <Enter className="btn big">Open today’s feed</Enter>
      </section>
    </main>
  );
}
