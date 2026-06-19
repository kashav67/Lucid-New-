import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("services", "routes/services.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("terms", "routes/terms.tsx"),
  route("book", "routes/book.tsx"),

  // JSON resource routes (consumed by site.js)
  route("open-dates", "routes/open-dates.tsx"),
  route("slots", "routes/slots.tsx"),
  route("quote-travel", "routes/quote-travel.tsx"),
  route("address-suggest", "routes/address-suggest.tsx"),

  // Gallery images streamed from R2
  route("img/:key", "routes/img.$key.tsx"),

  // Site lock (secret URL) + admin
  route("812", "routes/812.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/logout", "routes/admin.logout.tsx"),
  route("admin/availability/toggle", "routes/admin.availability.toggle.tsx"),
  route("admin/availability/bulk", "routes/admin.availability.bulk.tsx"),
  route("admin/availability/hours", "routes/admin.availability.hours.tsx"),
  route("admin/booking/:id/update", "routes/admin.booking.$id.update.tsx"),
  route("admin/booking/:id/delete", "routes/admin.booking.$id.delete.tsx"),
  route("admin/review", "routes/admin.review.tsx"),
  route("admin/review/:id/delete", "routes/admin.review.$id.delete.tsx"),
  route("admin/customer/:id/update", "routes/admin.customer.$id.update.tsx"),
  route("admin/customer/:id/delete", "routes/admin.customer.$id.delete.tsx"),
  route("admin/gallery", "routes/admin.gallery.tsx"),
  route("admin/gallery/:id/delete", "routes/admin.gallery.$id.delete.tsx"),
] satisfies RouteConfig;
