import { SiteLayout } from "../components/SiteLayout";

export function meta() {
  return [{ title: "Contact — Lucid Detailing" }];
}

export default function Contact() {
  return (
    <SiteLayout active="contact">
      <section className="page-hero">
        <div className="hero-glow"></div>
        <p className="eyebrow reveal">Get in touch</p>
        <h1 className="reveal">Let's talk detailing.</h1>
        <p className="page-sub reveal">
          Questions, custom requests, or fleet work — reach out and we'll get right back to you.
        </p>
      </section>

      <section className="contact-grid">
        <a className="contact-card reveal" href="tel:+18044268373">
          <span className="contact-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
          <h3>Call or text</h3>
          <p>(804) 426-8373</p>
        </a>
        <a className="contact-card reveal" href="mailto:contact@luciddetailingva.com">
          <span className="contact-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <h3>Email</h3>
          <p className="contact-email">contact@luciddetailingva.com</p>
        </a>
        <a className="contact-card reveal" href="https://instagram.com/luciddetailingva" target="_blank" rel="noopener">
          <span className="contact-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <h3>Instagram</h3>
          <p>@luciddetailingva</p>
        </a>
      </section>

      <section className="cta">
        <div className="cta-inner reveal">
          <h2>Ready to book?</h2>
          <p>Pick your service and we'll handle the rest.</p>
          <div className="cta-actions">
            <a href="/book" className="btn btn-silver btn-lg">
              Book a Detail
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
