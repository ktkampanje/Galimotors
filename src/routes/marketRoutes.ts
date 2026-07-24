import { Router } from "express";
import { getMarkets, createMarket, updateMarket, deleteMarket } from "../controllers/marketController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Public route - customers can browse markets
router.get("/", getMarkets);

// Admin routes - only SUPER_ADMIN can manage markets
router.post("/", authenticate, authorize(["SUPER_ADMIN"]), createMarket);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN"]), updateMarket);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteMarket);

export default router;
