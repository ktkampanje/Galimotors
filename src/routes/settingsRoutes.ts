import { Router } from "express";
import { 
  getGlobalSettings, updateGlobalSettings, 
  getFuelPrices, updateFuelPrice 
} from "../controllers/settingsController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Publicly readable for calculator
router.get("/global", getGlobalSettings);
router.get("/fuel", getFuelPrices);

// Admin-only updates
router.put("/global", authenticate, authorize(["SUPER_ADMIN"]), updateGlobalSettings);
router.put("/fuel", authenticate, authorize(["SUPER_ADMIN"]), updateFuelPrice);

export default router;
