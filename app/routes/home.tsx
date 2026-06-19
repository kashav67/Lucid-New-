import type { Route } from "./+types/home";
import { SiteLayout } from "../components/SiteLayout";
import { db, reviewsList } from "../lib/db";

export function meta() {
  return [{ title: "Lucid Detailing — Premium Car Detailing" }];
}

export async function loader() {
  const gallery = (
    await db().prepare("SELECT * FROM gallery ORDER BY id DESC").all<{
      id: number;
      title: string | null;
      before_img: string;
      after_img: string;
    }>()
  ).results;
  const reviews = await reviewsList();
  return { gallery, reviews };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { gallery, reviews } = loaderData;
  return (
    <SiteLayout>
      <section className="hero" id="top">
        <div className="hero-glow"></div>
        <div className="hero-inner">
          <h1 className="hero-title reveal" id="heroTitle">
            <span className="ht-tagline shine" data-text="Reflect Excellence.">
              Reflect Excellence.
            </span>
            <span className="ht-logo grad" aria-hidden="true">
              Lucid
            </span>
          </h1>
          <p className="hero-sub reveal">
            Precision detailing that brings out a depth of shine you can see your reflection in.
            Interior to ceramic — done right, every time.
          </p>
          <div className="hero-actions reveal">
            <a href="/book" className="btn btn-silver">
              Book a Detail
            </a>
            <a href="/services" className="btn btn-ghost">
              View Services
            </a>
          </div>
        </div>
        <a href={`#${reviews.length ? "reviews" : "work"}`} className="scroll-cue" aria-label="Scroll down">
          <span>Scroll</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </section>

      {reviews.length > 0 && (
        <section className="reviews compact" id="reviews">
          <div className="section-head reveal">
            <h2>Don't just take our word for it</h2>
          </div>
          <div className="rv-row-wrap reveal">
            <div className="rv-row">
              {reviews.map((r) => (
                <figure className="rv-card" key={r.id}>
                  <div className="rv-stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < r.stars ? undefined : "off"}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="rv-body">“{r.body}”</p>
                  <div className="rv-foot">
                    <span className="rv-name">{r.name}</span>
                    <span className="rv-when">{r.when}</span>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="work" id="work">
        <div className="section-head reveal">
          <h2>The Lucid Effect</h2>
        </div>
        {gallery.length > 0 ? (
          <div className="ba-row-wrap reveal">
            <div className="ba-row">
              {gallery.map((g) => (
                <figure className="ba-card" key={g.id}>
                  <img className="ba-c-before" src={`/img/${g.before_img}`} alt="before" />
                  <img className="ba-c-after" src={`/img/${g.after_img}`} alt="after" />
                  <span className="ba-c-tag before">Before</span>
                  <span className="ba-c-tag after">After</span>
                  {g.title && <figcaption className="ba-c-title">{g.title}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        ) : (
          <div className="work-grid">
            <div className="work-tile reveal"></div>
            <div className="work-tile reveal"></div>
            <div className="work-tile reveal"></div>
            <div className="work-tile reveal"></div>
          </div>
        )}
      </section>

      <section className="cta">
        <div className="cta-inner reveal">
          <h2>Ready for the shine?</h2>
          <p>Book your detail today and see the difference precision makes.</p>
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
