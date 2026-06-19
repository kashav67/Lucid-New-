import { isRouteErrorResponse, Links, Meta, Outlet } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/static/icon.png" },
  { rel: "apple-touch-icon", href: "/static/icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap",
  },
  { rel: "stylesheet", href: "/static/css/style.css" },
];

export const meta: Route.MetaFunction = () => [
  { title: "Lucid Detailing" },
  {
    name: "description",
    content:
      "Lucid Detailing — premium interior, exterior, ceramic coating and paint correction. Showroom shine, every time.",
  },
];

// Three.js import map used by the rain canvas (intro.js).
const IMPORT_MAP = JSON.stringify({
  imports: {
    three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
  },
});

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
        <noscript>
          <style>{`#site{opacity:1!important}#intro{display:none!important}`}</style>
        </noscript>
        <script type="importmap" dangerouslySetInnerHTML={{ __html: IMPORT_MAP }} />
      </head>
      <body>
        <canvas id="rain-canvas"></canvas>
        {children}
        {/* Vanilla site scripts (reused unchanged from the Flask app). */}
        <script type="module" src="/static/js/intro.js"></script>
        <script src="/static/js/site.js"></script>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  }
  return (
    <div id="site">
      <main className="page-hero short" style={{ textAlign: "center" }}>
        <h1>{message}</h1>
        <p className="page-sub">{details}</p>
        <a href="/" className="btn btn-silver">
          Back home
        </a>
      </main>
    </div>
  );
}
