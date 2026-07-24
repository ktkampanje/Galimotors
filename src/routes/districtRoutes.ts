import { Router } from "express";
import { getDistricts } from "../controllers/districtController";

const router = Router();

// Public route - Get all districts with car counts
router.get("/", getDistricts);

export default router;
