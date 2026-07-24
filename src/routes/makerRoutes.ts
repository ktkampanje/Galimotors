import { Router } from "express";
import { createMaker, getMakers, updateMaker, deleteMaker } from "../controllers/makerController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", getMakers);
router.post("/", authenticate, authorize(["SUPER_ADMIN"]), createMaker);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN"]), updateMaker);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteMaker);

export default router;
