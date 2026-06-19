import { SiteLayout } from "../components/SiteLayout";
import { BIKE_PRICE, SERVICE_CARDS, SERVICES, SIZES } from "../lib/catalog";

export function meta() {
  return [{ title: "Services & Pricing — Lucid Detailing" }];
}

function SvcIcon({ icon }: { icon: string }) {
  if (icon === "interior")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8z" />
        <path d="M18.5 13l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z" />
      </svg>
    );
  if (icon === "exterior")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12l1.7-4A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.8 1l1.7 4" />
        <rect x="3" y="12" width="18" height="5" rx="1.5" />
        <circle cx="7.5" cy="18.3" r="1.6" />
        <circle cx="16.5" cy="18.3" r="1.6" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="16" r="3" />
      <circle cx="18.5" cy="16" r="3" />
      <path d="M5.5 16l3-4.5h4.5l2.5 4.5M8.5 11.5h5M16 11.5h2.5" />
    </svg>
  );
}

export default function Services() {
  const carSizes = Object.entries(SIZES).filter(([k]) => k !== "bike");
  return (
    <SiteLayout active="services">
      <section className="page-hero">
        <div className="hero-glow"></div>
        <p className="eyebrow reveal">What we do</p>
        <h1 className="reveal">Services &amp; pricing.</h1>
        <p className="page-sub reveal">
          Premium, hand-finished detailing tailored to your vehicle. Prices below are for a small
          car — size pricing is shown further down.
        </p>
      </section>

      <section className="services">
        <div className="service-grid">
          {SERVICE_CARDS.map((svc) => (
            <article className="card reveal" key={svc.title}>
              <div className="card-glow"></div>
              <span className="svc-ic">
                <SvcIcon icon={svc.icon} />
              </span>
              <h3>{svc.title}</h3>
              <ul className="svc-includes">
                {svc.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
                <li className="svc-more">&amp; more</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-section">
        <div className="section-head reveal">
          <p className="eyebrow">Packages</p>
          <h2>Simple, honest pricing.</h2>
          <p className="section-sub">
            Starting prices for a small car. Medium adds $25, large adds $50. Bikes are a flat $
            {BIKE_PRICE}.
          </p>
        </div>

        <div className="price-grid">
          <div className="price-card reveal">
            <h3>Full Detail</h3>
            <p className="price-tag">
              ${SERVICES.full.price}
              <span>+</span>
            </p>
            <p className="price-desc">Interior &amp; exterior — the complete treatment.</p>
            <a href="/book?service=full" className="btn btn-silver btn-sm">
              Book Full Detail
            </a>
          </div>
          <div className="price-card reveal">
            <h3>Interior Detail</h3>
            <p className="price-tag">
              ${SERVICES.interior.price}
              <span>+</span>
            </p>
            <p className="price-desc">Deep clean inside — seats, carpets, surfaces, glass.</p>
            <a href="/book?service=interior" className="btn btn-ghost btn-sm">
              Book Interior
            </a>
          </div>
          <div className="price-card reveal">
            <h3>Exterior Detail</h3>
            <p className="price-tag">
              ${SERVICES.exterior.price}
              <span>+</span>
            </p>
            <p className="price-desc">Wash, decontaminate, and a flawless exterior finish.</p>
            <a href="/book?service=exterior" className="btn btn-ghost btn-sm">
              Book Exterior
            </a>
          </div>
          <div className="price-card reveal">
            <h3>Bike Detail</h3>
            <p className="price-tag">${BIKE_PRICE}</p>
            <p className="price-desc">Full detail for bikes &amp; motorcycles.</p>
            <a href="/book?size=bike" className="btn btn-ghost btn-sm">
              Book Bike Detail
            </a>
          </div>
        </div>

        <div className="size-note reveal">
          <h4>Car size pricing</h4>
          <ul>
            {carSizes.map(([key, s]) => (
              <li key={key}>
                <span>{s.label}</span>
                <strong>{s.surcharge ? `+ $${s.surcharge}` : "Base price"}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="center-cta reveal">
          <a href="/book" className="btn btn-silver btn-lg">
            Book your detail
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
