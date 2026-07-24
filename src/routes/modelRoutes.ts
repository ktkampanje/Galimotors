import { Router } from "express";
import { createModel, getModelsByMaker, updateModel, deleteModel } from "../controllers/modelController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/maker/:makerId", getModelsByMaker);
router.post("/", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), createModel);
router.put("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateModel);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), deleteModel);

export default router;
