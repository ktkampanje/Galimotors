import { Router } from "express";
import { createMaker, getMakers, updateMaker, deleteMaker } from "../controllers/makerController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", getMakers);
// Sub-admins add cars daily, so they can add/fix makers that are missing.
// Deleting stays a super-admin action — cars reference these rows.
router.post("/", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), createMaker);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateMaker);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteMaker);

export default router;
