import { SiteLayout } from "../components/SiteLayout";

export function meta() {
  return [{ title: "About — Lucid Detailing" }];
}

export default function About() {
  return (
    <SiteLayout active="about">
      <section className="page-hero">
        <div className="hero-glow"></div>
        <p className="eyebrow reveal">Why Lucid</p>
        <h1 className="reveal">Obsessed with the details others miss.</h1>
        <p className="page-sub reveal">
          We treat every vehicle like it's our own — no shortcuts, just meticulous work and a finish
          you can see yourself in.
        </p>
      </section>

      <section className="about">
        <div className="about-card reveal">
          <div className="visual-panel"></div>
          <div className="visual-shine"></div>
          <div className="about-text">
            <h2>Craft over convenience.</h2>
            <p>
              We're a local mobile detailing service that takes the work seriously. Every car gets
              the same hands-on attention — we take our time, use products that are safe for your
              paint, and don't rush or cut corners. The goal is simple: hand it back looking better
              than you expected, every time.
            </p>
            <ul className="check-list">
              <li>Premium, paint-safe products only</li>
              <li>Mobile service available at your door</li>
              <li>Meticulous, hand-finished work every time</li>
            </ul>
            <a href="/book" className="btn btn-silver">
              Book a detail
            </a>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-inner reveal">
          <h2>See the difference.</h2>
          <p>Experience detailing done the right way.</p>
          <div className="cta-actions">
            <a href="/book" className="btn btn-silver btn-lg">
              Book Now
            </a>
            <a href="/contact" className="btn btn-ghost btn-lg">
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
