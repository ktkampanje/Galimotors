import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

/**
 * Meta (Facebook) catalog feed — the URL pasted into Commerce Manager as a
 * scheduled data feed. Lets Meta run dynamic ads showing the LIVE inventory
 * and retarget a visitor with the exact car they viewed (paired with the
 * ViewContent pixel event, which sends the same car id).
 *
 * Public by design: Meta's crawler fetches it unauthenticated. Only
 * AVAILABLE, non-deleted cars with at least one image are included — Meta
 * rejects imageless rows.
 */
const router = Router();

// Same slug rule as the frontend's generateCarUrl, so feed links land on
// the SEO route the site actually serves.
const slug = (s?: string | null) =>
  (s || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "-");

const csvCell = (v: unknown): string => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get("/meta-catalog.csv", async (_req: Request, res: Response) => {
  try {
    const siteUrl = (
      process.env.PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5174"
    ).replace(/\/$/, "");

    const cars = await prisma.car.findMany({
      where: { status: "AVAILABLE", deletedAt: null },
      select: {
        id: true,
        title: true,
        basePrice: true,
        year: true,
        mileage: true,
        fuelType: true,
        transmission: true,
        district: true,
        condition: true,
        maker: { select: { name: true } },
        model: { select: { name: true } },
        images: {
          select: { url: true },
          orderBy: { isPrimary: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand",
    ].join(",");

    const rows = cars
      .filter((c) => c.images.length > 0)
      .map((c) => {
        const description = [
          c.year && `Year ${c.year}`,
          c.mileage && `${c.mileage.toLocaleString()} km`,
          c.fuelType,
          c.transmission === "AUTOMATIC" ? "Automatic" : c.transmission === "MANUAL" ? "Manual" : c.transmission,
          c.district && `Located in ${c.district}`,
          "Inspected by GaliMotors.",
        ].filter(Boolean).join(". ");

        const link = `${siteUrl}/cars/${slug(c.maker?.name)}/${slug(c.model?.name)}/${c.id.split("-")[0]}`;

        return [
          csvCell(c.id),
          csvCell(c.title),
          csvCell(description),
          "in stock",
          // Meta's condition enum is new/refurbished/used.
          c.condition === "Brand New" ? "new" : "used",
          csvCell(`${c.basePrice} MWK`),
          csvCell(link),
          csvCell(c.images[0].url),
          csvCell(c.maker?.name || "GaliMotors"),
        ].join(",");
      });

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send([header, ...rows].join("\n"));
  } catch (error) {
    console.error("Meta catalog feed error:", error);
    res.status(500).json({ message: "Failed to build catalog feed" });
  }
});

export default router;
