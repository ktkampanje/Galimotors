import { Router, Request, Response } from "express";
import seoService from "../services/seoService";
import prisma from "../lib/prisma";

const router = Router();

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
