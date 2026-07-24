import { Router } from "express";
import { 
  getDistricts, createDistrict, updateDistrict, deleteDistrict,
  getDistances, updateDistanceByDistricts 
} from "../controllers/locationController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Districts - Public read, Admin write
router.get("/districts", getDistricts);
router.post("/districts", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), createDistrict);
router.put("/districts/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateDistrict);
router.delete("/districts/:id", authenticate, authorize(["SUPER_ADMIN"]), deleteDistrict);

// Distances - Public read, Admin write
router.get("/distances", getDistances);
router.put("/distances", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateDistanceByDistricts);

export default router;
