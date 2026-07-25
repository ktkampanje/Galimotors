import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  listErrors,
  resolveError,
  resolveAllErrors,
  clearResolvedErrors,
} from "../services/errorLogService";

// System Errors — admin visibility into server failures. Admin-only.
const router = Router();
router.use(authenticate);
router.use(authorize(["SUPER_ADMIN", "SUB_ADMIN"]));

router.get("/", async (req, res) => {
  try {
    const showResolved = req.query.resolved === "true";
    res.json(await listErrors(showResolved));
  } catch {
    res.status(500).json({ message: "Failed to list errors" });
  }
});

router.patch("/:id/resolve", async (req, res) => {
  try {
    res.json(await resolveError(req.params.id));
  } catch {
    res.status(500).json({ message: "Failed to resolve error" });
  }
});

router.post("/resolve-all", async (_req, res) => {
  try {
    res.json(await resolveAllErrors());
  } catch {
    res.status(500).json({ message: "Failed to resolve errors" });
  }
});

router.delete("/resolved", async (_req, res) => {
  try {
    res.json(await clearResolvedErrors());
  } catch {
    res.status(500).json({ message: "Failed to clear resolved errors" });
  }
});

export default router;
