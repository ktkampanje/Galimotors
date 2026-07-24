import { Router } from "express";
import { getAttendants, createAttendant, updateAttendant, deleteAttendant } from "../controllers/attendantController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, getAttendants);
router.post("/", authenticate, authorize(["SUPER_ADMIN"]), createAttendant);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN"]), updateAttendant);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteAttendant);

export default router;
