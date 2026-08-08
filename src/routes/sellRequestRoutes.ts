import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { sanitizePhone } from "../middleware/sanitize";
import { inquiryRateLimit } from "../middleware/security";
import notificationService from "../services/notificationService";

// "Sell Your Car" — owners asking GaliMotors to sell for them. Public submit,
// admin-only reading; follow-up to the seller happens on WhatsApp. Submitting
// alerts the business, since the seller has no account and no way to chase a
// request that nobody noticed.
const router = Router();

router.post("/", inquiryRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, phone, district, carDetails, expectedPrice } = req.body;

    if (!name?.trim() || !phone || !carDetails?.trim()) {
      return res
        .status(400)
        .json({ message: "Name, phone number and car details are required" });
    }

    const sanitizedPhone = sanitizePhone(String(phone));
    if (!sanitizedPhone) {
      return res.status(400).json({
        message:
          "Invalid Malawian phone number. Enter 10 digits starting with 08 or 09, e.g. 0952456789.",
      });
    }

    const parsedPrice = expectedPrice ? parseFloat(String(expectedPrice).replace(/,/g, "")) : null;

    const request = await prisma.sellRequest.create({
      data: {
        name: String(name).trim().slice(0, 120),
        phone: sanitizedPhone,
        district: district ? String(district).slice(0, 60) : null,
        carDetails: String(carDetails).trim().slice(0, 2000),
        expectedPrice: Number.isFinite(parsedPrice as number) ? parsedPrice : null,
      },
    });

    // Best-effort: a notification failure must not tell the seller their
    // submission was rejected, because it was saved successfully.
    try {
      const vehicle =
        request.carDetails.slice(0, 200) +
        (request.expectedPrice
          ? `\nAsking: MK ${Number(request.expectedPrice).toLocaleString()}`
          : "") +
        (request.district ? `\nDistrict: ${request.district}` : "");

      const alert = notificationService.templates.sellRequestSubmitted(
        request.name,
        request.phone,
        vehicle,
      );
      await notificationService.notifyAdmin(alert.subject, alert.message);
    } catch (notifyError) {
      console.error("Failed to alert admin about sell request:", notifyError);
    }

    res.status(201).json({ message: "Request received", request: { id: request.id } });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit sell request" });
  }
});

router.get(
  "/",
  authenticate,
  authorize(["SUPER_ADMIN", "SUB_ADMIN"]),
  async (_req: Request, res: Response) => {
    try {
      const requests = await prisma.sellRequest.findMany({
        orderBy: { createdAt: "desc" },
      });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sell requests" });
    }
  }
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["SUPER_ADMIN", "SUB_ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const allowed = ["NEW", "CONTACTED", "LISTED", "DECLINED"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: `Status must be one of ${allowed.join(", ")}` });
      }
      const request = await prisma.sellRequest.update({
        where: { id: req.params.id },
        data: { status },
      });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to update sell request" });
    }
  }
);

export default router;
