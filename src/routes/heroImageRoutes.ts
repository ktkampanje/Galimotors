import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { deleteCloudinaryImage } from "../services/cloudinaryService";

// Homepage hero backdrop images. Admin-curated (see HeroImage in the schema);
// the public endpoint feeds the dealership hero marquee.
const router = Router();

// Public — ordered for the marquee.
router.get("/", async (_req: Request, res: Response) => {
  try {
    const images = await prisma.heroImage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    res.set("Cache-Control", "public, max-age=300");
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch hero images" });
  }
});

// Admin — add one image (already uploaded to Cloudinary via /upload/images).
router.post(
  "/",
  authenticate,
  authorize(["SUPER_ADMIN", "SUB_ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      const { url, sortOrder } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "Image url is required" });
      }
      const image = await prisma.heroImage.create({
        data: {
          url,
          sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        },
      });
      res.status(201).json(image);
    } catch (error) {
      res.status(500).json({ message: "Failed to add hero image" });
    }
  }
);

// Admin — reorder: [{ id, sortOrder }]
router.patch(
  "/reorder",
  authenticate,
  authorize(["SUPER_ADMIN", "SUB_ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      const { order } = req.body as { order: Array<{ id: string; sortOrder: number }> };
      if (!Array.isArray(order)) {
        return res.status(400).json({ message: "order array is required" });
      }
      await prisma.$transaction(
        order.map((o) =>
          prisma.heroImage.update({
            where: { id: o.id },
            data: { sortOrder: Number(o.sortOrder) || 0 },
          })
        )
      );
      res.json({ message: "Reordered" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reorder hero images" });
    }
  }
);

// Admin — remove one.
router.delete(
  "/:id",
  authenticate,
  authorize(["SUPER_ADMIN", "SUB_ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      const row = await prisma.heroImage.delete({ where: { id: req.params.id } });
      // The asset must leave Cloudinary too — deleting only the row
      // orphaned it there forever.
      deleteCloudinaryImage(row.url).catch((err) =>
        console.error("Failed to delete hero image from Cloudinary:", err)
      );
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete hero image" });
    }
  }
);

export default router;
