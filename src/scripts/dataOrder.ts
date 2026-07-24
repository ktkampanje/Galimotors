/**
 * Table order for export/import, arranged so that every row's foreign-key
 * parents are written before it. Getting this wrong is the usual reason a
 * data migration half-completes and leaves dangling references.
 *
 * FilterStatsCache is deliberately absent — it's a derived cache that the
 * server rebuilds on boot.
 */
export const EXPORT_ORDER = [
  // ── independent reference data ──
  "user",
  "customer",
  "market",
  "maker",
  "bodyType",
  "feature",
  "category",
  "district",
  "distance",
  "fuelPrice",
  "globalSettings",
  "heroImage",
  "staticPage",
  "sellRequest",

  // ── depend on the above ──
  "model", // → maker
  "seller", // → market, user
  "marketAttendant", // → market, seller, user
  "car", // → maker, model, bodyType, seller, market, attendant
  "image", // → car
  "carFeature", // → car, feature
  "carCategory", // → car, category
  "lead", // → car, customer
  "negotiationOffer", // → lead
  "viewingMessage", // → lead
  "recentlyViewed", // → customer
  "favorite", // → customer
  "activityLog", // → user (optional)
] as const;
