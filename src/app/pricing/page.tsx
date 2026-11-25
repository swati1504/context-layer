import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pricing – Context Layer" };

export default function Pricing() {
  return (
    <main className="shell prose">
      <h1 className="page-title">Simple pricing</h1>
      <p>Start free. Upgrade when you read the news every day.</p>
      <div className="plans">
        <section className="plan">
          <h3>Free</h3>
          <div className="price">$0</div>
          <small style={{ color: "var(--muted)" }}>no account needed</small>
          <ul>
            <li>5 cards a month</li>
            <li>Verified claims with quotes</li>
            <li>Personal profile and a ranked feed</li>
            <li>Save cards on this device</li>
          </ul>
          <Link className="btn sec-btn" style={{ display: "grid", placeItems: "center", textDecoration: "none" }} href="/">Start reading</Link>
        </section>
        <section className="plan feat">
          <h3>Plus</h3>
          <div className="price">$4.99<small> / month</small></div>
          <small style={{ color: "var(--muted)" }}>or $39 a year</small>
          <ul>
            <li>Unlimited cards</li>
            <li>Follow companies and topics</li>
            <li>Daily digest of what you follow</li>
            <li>Saved history synced across devices</li>
            <li>Coming soon: ask a follow-up question, and see what changed since you last read</li>
          </ul>
          <Link className="btn" style={{ display: "grid", placeItems: "center", textDecoration: "none" }} href="/">Join the waitlist</Link>
        </section>
        <section className="plan">
          <h3>Teams and classes</h3>
          <div className="price">Let&rsquo;s talk</div>
          <small style={{ color: "var(--muted)" }}>for schools and workplaces</small>
          <ul>
            <li>Shared reading lists</li>
            <li>Plus for everyone in the group</li>
            <li>Help getting started</li>
          </ul>
          <Link className="btn sec-btn" style={{ display: "grid", placeItems: "center", textDecoration: "none" }} href="/verify">See how it works</Link>
        </section>
      </div>
      <p style={{ fontSize: 14 }}>Plus is not open yet. This page shows the planned plans for our Product Studio demo, and the upgrade screen is a simulation.</p>
    </main>
  );
}
