// Port of base.html's #site wrapper: nav header + footer.
// Wrap each public page's content in <SiteLayout active="...">.

export function SiteLayout({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "services" | "about" | "contact";
}) {
  return (
    <div id="site">
      <header className="nav" id="nav">
        <a href="/" className="brand">
          <img className="brand-mark" src="/static/icon.png" alt="" />
          <span className="brand-text">
            LUCID<span className="brand-thin">DETAILING</span>
          </span>
        </a>
        <nav className="nav-links">
          <a href="/services" className={active === "services" ? "active" : undefined}>
            Services
          </a>
          <a href="/about" className={active === "about" ? "active" : undefined}>
            About
          </a>
          <a href="/contact" className={active === "contact" ? "active" : undefined}>
            Contact
          </a>
        </nav>
        <a href="/book" className="btn btn-silver btn-sm">
          Book Now
        </a>
        <button className="nav-toggle" id="navToggle" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      {children}

      <footer className="footer">
        <div className="footer-brand">
          LUCID<span className="brand-thin">DETAILING</span>
        </div>
        <nav className="footer-links">
          <a href="/services">Services</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/book">Book</a>
          <a href="/terms">Terms</a>
        </nav>
        <p>&copy; 2026 Lucid Detailing. All rights reserved.</p>
      </footer>
    </div>
  );
}
