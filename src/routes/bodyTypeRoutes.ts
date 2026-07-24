import { Router } from "express";
import { createBodyType, getBodyTypes, updateBodyType, deleteBodyType } from "../controllers/bodyTypeController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", getBodyTypes);
router.post("/", authenticate, authorize(["SUPER_ADMIN"]), createBodyType);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN"]), updateBodyType);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteBodyType);

export default router;
