import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pricing – Context Layer" };

export default function Pricing() {
  return (
    <main className="wide-page">
      <header className="plans-head">
        <h1 className="page-title">Simple pricing</h1>
        <p>Start free. Upgrade when you read the news every day.</p>
      </header>
      <div className="plans">
        <section className="plan">
          <h3>Free</h3>
          <div className="price">$0</div>
          <small className="plan-sub">no account needed</small>
          <ul>
            <li>5 pasted links a month, plus every story in the feed</li>
            <li>Source passages attached to every claim</li>
            <li>A feed ranked by your interests, with reasons</li>
            <li>Save stories in this browser</li>
          </ul>
          <Link className="btn sec-btn plan-cta" href="/">Start reading</Link>
        </section>
        <section className="plan feat">
          <h3>Plus</h3>
          <div className="price">$4.99<small> / month</small></div>
          <small className="plan-sub">or $39 a year</small>
          <ul>
            <li>Unlimited pasted links</li>
            <li className="soon"><span className="chip">Planned</span>follow companies and topics</li>
            <li className="soon"><span className="chip">Planned</span>daily digest of what you follow</li>
            <li className="soon"><span className="chip">Planned</span>saved history synced across devices</li>
            <li className="soon"><span className="chip">Planned</span>ask a follow-up question, and see what changed since you last read</li>
          </ul>
          <Link className="btn plan-cta" href="/">Try it free first</Link>
        </section>
        <section className="plan">
          <h3>Teams and classes</h3>
          <div className="price">Let&rsquo;s talk</div>
          <small className="plan-sub">for schools and workplaces</small>
          <ul>
            <li className="soon"><span className="chip">Planned</span>shared reading lists</li>
            <li className="soon"><span className="chip">Planned</span>Plus for everyone in the group</li>
            <li className="soon"><span className="chip">Planned</span>help getting started</li>
          </ul>
          <Link className="btn sec-btn plan-cta" href="/">See how it works</Link>
        </section>
      </div>
      <p className="plans-note">Plus is not open yet. This page shows the planned plans for our Product Studio demo, and the upgrade screen is a simulation.</p>
    </main>
  );
}
