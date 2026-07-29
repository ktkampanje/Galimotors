import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { invalidateBusinessContactCache } from "../lib/businessContact";

const router = Router();

/**
 * Marketing tools for SUPER_ADMIN + SUB_ADMIN:
 *  - composed-ad history (save / list / delete)
 *  - a NARROW settings endpoint for the Facebook plumbing only.
 *
 * Why the narrow endpoint: PUT /api/settings/global is super-admin-only
 * because it carries bank details. Sub-admins run marketing day to day, so
 * pixel + page URL get their own gate without exposing payment settings.
 */
router.use(authenticate);
router.use(authorize(["SUPER_ADMIN", "SUB_ADMIN"]));

router.get("/ads", async (_req: AuthRequest, res: Response) => {
  try {
    const ads = await prisma.adPost.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
    res.json(ads);
  } catch (error) {
    console.error("Failed to list ads:", error);
    res.status(500).json({ message: "Failed to list ads" });
  }
});

router.post("/ads", async (req: AuthRequest, res: Response) => {
  try {
    const { caption, carId, channel } = req.body;
    if (!caption || !String(caption).trim()) {
      return res.status(400).json({ message: "The ad needs a caption" });
    }
    const chan = ["WHATSAPP", "FACEBOOK", "BOTH"].includes(channel) ? channel : "BOTH";
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });

    const ad = await prisma.adPost.create({
      data: {
        caption: String(caption).slice(0, 2000),
        carId: carId || null,
        channel: chan,
        createdById: req.user!.userId,
        createdByName: user?.name || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: "CREATE_AD",
        entityType: "AdPost",
        entityId: ad.id,
        newValue: JSON.stringify({ channel: chan, caption: ad.caption.slice(0, 120) }),
      },
    });

    res.status(201).json(ad);
  } catch (error) {
    console.error("Failed to save ad:", error);
    res.status(500).json({ message: "Failed to save ad" });
  }
});

router.delete("/ads/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.adPost.delete({ where: { id: req.params.id } });
    res.json({ message: "Ad removed" });
  } catch (error) {
    res.status(404).json({ message: "Ad not found" });
  }
});

// Facebook plumbing only — same validation rules as settingsController.
router.put("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const { metaPixelId, facebookUrl } = req.body;
    const data: any = {};

    if (metaPixelId !== undefined) {
      const pixel = String(metaPixelId).trim();
      if (pixel !== "" && !/^\d{15,16}$/.test(pixel)) {
        return res.status(400).json({
          message: "Meta Pixel ID must be a 15–16 digit number (find it in Meta Events Manager)",
          field: "metaPixelId",
        });
      }
      data.metaPixelId = pixel;
    }

    if (facebookUrl !== undefined) {
      const url = String(facebookUrl).trim();
      if (url !== "" && !/^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i.test(url)) {
        return res.status(400).json({
          message: "Enter a full Facebook page URL (https://facebook.com/yourpage)",
          field: "facebookUrl",
        });
      }
      data.facebookUrl = url;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const settings = await prisma.globalSettings.upsert({
      where: { id: "SETTINGS_SINGLETON" },
      update: data,
      create: {
        id: "SETTINGS_SINGLETON",
        driverAllowance: 20000,
        accommodationFee: 35000,
        ...data,
      },
    });
    invalidateBusinessContactCache();

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: "UPDATE_MARKETING_SETTINGS",
        entityType: "GlobalSettings",
        entityId: "SETTINGS_SINGLETON",
        newValue: JSON.stringify(data),
      },
    });

    res.json({ metaPixelId: settings.metaPixelId, facebookUrl: settings.facebookUrl });
  } catch (error) {
    console.error("Failed to update marketing settings:", error);
    res.status(500).json({ message: "Failed to update marketing settings" });
  }
});

export default router;
