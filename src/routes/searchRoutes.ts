import express from "express";
import { globalSearch } from "../controllers/searchController";
// Admin-wide search: any signed-in admin role may use it; the controller
// only returns records those roles already see on their own screens.
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticate, globalSearch);

export default router;
