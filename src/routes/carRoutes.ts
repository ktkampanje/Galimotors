import { Router } from "express";
import {
  createCar, getCars, getCarById, updateCar, deleteCar,
  softDeleteCar, restoreCar, createReservation, extendReservation,
  cancelReservation, markAsSold, bulkUpdateStatus, bulkUpdatePrice,
  getSimilarCars, getCarViewAnalytics, getSmartRankedCars,
  getHomepageCars, getMoreCars, approveCar, rejectCar, getPendingApprovalCars
} from "../controllers/carController";
import { addCategoryToCar, removeCategoryFromCar } from "../controllers/categoryController";
import { authenticate, authorize, optionalAuth } from "../middleware/auth";

const router = Router();

// Public routes - Static/named paths MUST come before /:id to avoid shadowing
router.get("/homepage", getHomepageCars);
router.get("/more", getMoreCars);
router.get("/smart-search", getSmartRankedCars);

// Admin routes - Approval workflow (GET must be before /:id)
router.get("/pending-approval", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getPendingApprovalCars);

// Public routes - Dynamic params
// optionalAuth so an admin token is honoured: sellers see their own stock,
// admins see all statuses and full image sets; the public gets the lean view.
router.get("/", optionalAuth, getCars);
// optionalAuth: the detail payload includes sellerAskingPrice for admins
// only; the controller strips it for everyone else.
router.get("/:id", optionalAuth, getCarById);
router.get("/:id/similar", getSimilarCars);
router.get("/:id/analytics", getCarViewAnalytics);

// Admin routes - Basic CRUD
// SELLERS and MARKET_ATTENDANTS can create cars (goes to PENDING_APPROVAL)
router.post("/", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"]), createCar);

// Only ADMINS can update, delete, and approve cars
router.put("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateCar);
router.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), deleteCar);

// Admin routes - Soft delete
router.post("/:id/soft-delete", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), softDeleteCar);
router.post("/:id/restore", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), restoreCar);

// Admin routes - Reservations
router.post("/:id/reserve", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), createReservation);
router.post("/:id/extend-reservation", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), extendReservation);
router.post("/:id/cancel-reservation", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), cancelReservation);

// Admin routes - Sales
router.post("/:id/mark-sold", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), markAsSold);

// Admin routes - Bulk operations (must be before /:id/... routes)
router.post("/bulk/update-status", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), bulkUpdateStatus);
router.post("/bulk/update-price", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), bulkUpdatePrice);

// Admin routes - Approval actions
router.post("/:id/approve", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), approveCar);
router.post("/:id/reject", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), rejectCar);

// Admin routes - Category management
router.post("/:id/categories", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), addCategoryToCar);
router.delete("/:id/categories/:categoryId", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), removeCategoryFromCar);

export default router;
