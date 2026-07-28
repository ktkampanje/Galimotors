import { Router } from "express";
import { createBodyType, getBodyTypes, updateBodyType, deleteBodyType } from "../controllers/bodyTypeController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", getBodyTypes);
// Sub-admins add cars daily, so they can add/fix body types that are
// missing. Deleting stays a super-admin action — cars reference these rows.
router.post("/", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), createBodyType);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateBodyType);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteBodyType);

export default router;
