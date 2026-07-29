import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import seoService from "../services/seoService";
import prisma from "../lib/prisma";
import { getSiteUrl } from "../lib/siteUrl";

const router = Router();

// ── SPA shell cache ────────────────────────────────────────────────────
// The function bundle does not contain the built dealership index.html, so
// the shell is fetched once from this deployment's own static hosting and
// cached in memory (per lambda). Stale copies are acceptable — only the
// <head> meta region gets replaced per request.
let shellCache: { html: string; fetchedAt: number } = { html: "", fetchedAt: 0 };
const SHELL_TTL_MS = 10 * 60 * 1000;

const getShell = async (): Promise<string | null> => {
  const now = Date.now();
  if (shellCache.html && now - shellCache.fetchedAt < SHELL_TTL_MS) return shellCache.html;

  try {
    const res = await fetch(`${getSiteUrl()}/index.html`);
    if (res.ok) {
      const html = await res.text();
      if (html.includes('<div id="root">')) {
        shellCache = { html, fetchedAt: now };
        return html;
      }
    }
  } catch { /* fall through */ }

  // Local development: the static host isn't serving — read the built file.
  try {
    const disk = fs.readFileSync(
      path.resolve(process.cwd(), "dealership-app/dist/index.html"),
      "utf8",
    );
    shellCache = { html: disk, fetchedAt: now };
    return disk;
  } catch { /* fall through */ }

  return shellCache.html || null;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Swap the marked meta region of the SPA shell for this car's tags. This is
 * what makes a shared car link unfurl as the CAR (photo, title, price) on
 * WhatsApp/Facebook instead of the generic site card — crawlers never run
 * the SPA's JavaScript, they only read this HTML.
 */
const injectCarMeta = (shell: string, car: any): string => {
  const title = `${car.title} — GaliMotors`;
  const description = seoService.generateCarMetaDescription(car);
  const canonicalUrl = seoService.generateCarCanonicalUrl(car);
  const image = seoService.toOgImage(
    car.images?.find((img: any) => img.isPrimary)?.url || car.images?.[0]?.url,
  );

  const block = `<!-- seo:start -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="GaliMotors" />
    <meta property="og:locale" content="en_MW" />
    <meta property="product:price:amount" content="${escapeHtml(car.basePrice ?? 0)}" />
    <meta property="product:price:currency" content="MWK" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="twitter:title" content="${escapeHtml(title)}" />
    <meta property="twitter:description" content="${escapeHtml(description)}" />
    <meta property="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(seoService.generateCarJsonLD(car))}</script>
    <!-- seo:end -->`;

  return shell.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, block);
};

// Dynamic XML Sitemap
router.get("/sitemap.xml", async (req: Request, res: Response) => {
  try {
    const sitemap = await seoService.generateSitemap();
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error("Failed to generate sitemap", error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt
router.get("/robots.txt", (req: Request, res: Response) => {
  try {
    const robotsTxt = seoService.generateRobotsTxt();
    res.header('Content-Type', 'text/plain');
    res.send(robotsTxt);
  } catch (error) {
    console.error("Failed to generate robots.txt", error);
    res.status(500).send('Error generating robots.txt');
  }
});

// Car detail pages: serve the SPA shell with THIS car's meta injected.
// vercel.json rewrites /cars/:maker/:model/:ref to the function so these
// requests reach Express; every other page stays fully static.
router.get("/cars/:makerSlug/:modelSlug/:ref", async (req: Request, res: Response) => {
  try {
    const shell = await getShell();
    if (!shell) return res.redirect("/");

    res.header("Content-Type", "text/html; charset=utf-8");
    // Per-URL edge cache; previews and crawls are served from the edge.
    res.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    // The static index.html is served without a CSP; keep the injected
    // variant identical so car pages don't render differently.
    res.removeHeader("Content-Security-Policy");

    const ref = String(req.params.ref || "").replace(/[^a-zA-Z0-9-]/g, "");
    const car = ref.length >= 6
      ? await prisma.car.findFirst({
          where: {
            id: { startsWith: ref },
            deletedAt: null,
            status: { in: ["AVAILABLE", "RESERVED", "SOLD"] },
          },
          include: { maker: true, model: true, bodyType: true, images: true },
        })
      : null;

    if (!car) {
      // Correct status for crawlers; the SPA still boots and shows its own
      // not-found screen for humans.
      return res.status(404).send(shell);
    }

    res.send(injectCarMeta(shell, car));
  } catch (error) {
    console.error("Failed to render car page meta", error);
    const shell = shellCache.html;
    if (shell) return res.status(200).type("html").send(shell);
    res.redirect("/");
  }
});

// SEO data for car pages (used by frontend)
router.get("/seo/car/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Try to find by UUID first, then by slug
    let car = await prisma.car.findUnique({
      where: { id },
      include: {
        maker: true,
        model: true,
        bodyType: true,
        images: true
      }
    });

    // If not found by UUID, try to find by slug (extract UUID from slug)
    if (!car && id.includes('/')) {
      const uuidShort = id.split('/').pop();
      if (uuidShort) {
        car = await prisma.car.findFirst({
          where: {
            id: { startsWith: uuidShort }
          },
          include: {
            maker: true,
            model: true,
            bodyType: true,
            images: true
          }
        });
      }
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const seoData = {
      canonicalUrl: seoService.generateCarCanonicalUrl(car),
      metaDescription: seoService.generateCarMetaDescription(car),
      openGraph: seoService.generateCarOpenGraph(car),
      jsonLD: {
        product: seoService.generateCarJsonLD(car),
        breadcrumb: seoService.generateBreadcrumbJsonLD(car),
        organization: await seoService.generateOrganizationJsonLD()
      },
      slug: seoService.generateCarSlug(car)
    };

    res.json(seoData);
  } catch (error) {
    console.error("Failed to generate SEO data", error);
    res.status(500).json({ error: 'Error generating SEO data' });
  }
});

export default router;
