import { Request, Response } from "express";
import { ciContains } from "../lib/searchFilters";
import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { invalidateFilterStatsCache } from "../services/filterStatsCacheService";
import { deleteCloudinaryImages } from "../services/cloudinaryService";

const validCarFields = new Set([
  "title",
  "basePrice",
  "sellerAskingPrice",
  "currency",
  "negotiable",
  "makerId",
  "modelId",
  "bodyTypeId",
  "year",
  "condition",
  "fuelType",
  "transmission",
  "mileage",
  "engineSize",
  "chassisNumber",
  "modelCode",
  "steering",
  "exteriorColor",
  "interiorColor",
  "seatingCapacity",
  "doors",
  "driveTrain",
  "district",
  "fuelConsumptionKmPL",
  "logbookAvailable",
  "dutyPaid",
  "registered",
  "registrationNumber",
  "registrationYear",
  "platformInspectedBadge",
  "isFeatured",
  "urgentSaleBadge",
  "status",
  "reservationFeeRequired",
  "reservationExpiry",
  "reservedByLeadId",
  "sellerId",
  "marketId",
  "attendantId",
  "verifiedByAdmin",
  "inspectionNotes",
  "commissionAmount",
  "commissionStatus",
]);

const nullableCarFields = new Set([
  "sellerAskingPrice",
  "makerId",
  "modelId",
  "bodyTypeId",
  "engineSize",
  "chassisNumber",
  "modelCode",
  "exteriorColor",
  "interiorColor",
  "registrationNumber",
  "marketId",
  "attendantId",
  "inspectionNotes",
  "reservedByLeadId",
]);

const numberCarFields = new Set([
  "basePrice",
  "sellerAskingPrice",
  "fuelConsumptionKmPL",
  "commissionAmount",
]);
const intCarFields = new Set([
  "year",
  "mileage",
  "seatingCapacity",
  "doors",
  "registrationYear",
]);

const normalizeCarData = (input: Record<string, any>) => {
  const data: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!validCarFields.has(key)) continue;

    if (value === "" && nullableCarFields.has(key)) {
      data[key] = null;
      continue;
    }

    if (value === "" || value === undefined) continue;

    if (numberCarFields.has(key)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) data[key] = parsed;
      continue;
    }

    if (intCarFields.has(key)) {
      const parsed = parseInt(String(value), 10);
      if (!Number.isNaN(parsed)) data[key] = parsed;
      continue;
    }

    data[key] = value;
  }

  return data;
};

export const createCar = async (req: Request, res: Response) => {
  try {
    const { images, ...carData } = req.body;
    const user = (req as any).user; // Get authenticated user

    // Identity is NEVER taken from the request body for restricted roles.
    // A seller lists under their own profile, full stop; an attendant lists
    // into their own market, for a seller of that market. Without this, any
    // seller could submit cars in another seller's name.
    if (user?.role === "SELLER") {
      const profile = await prisma.seller.findUnique({ where: { userId: user.userId } });
      if (!profile) {
        return res.status(403).json({ message: "Your login has no seller profile linked. Ask the administrator to link it from the Users page." });
      }
      carData.sellerId = profile.id;
      carData.marketId = profile.marketId || null;
      carData.attendantId = null;
    } else if (user?.role === "MARKET_ATTENDANT") {
      const attendant = await prisma.marketAttendant.findUnique({ where: { userId: user.userId } });
      if (!attendant) {
        return res.status(403).json({ message: "Your login has no attendant profile linked. Ask the administrator to link it from the Users page." });
      }
      carData.marketId = attendant.marketId;
      carData.attendantId = attendant.id;
      if (carData.sellerId) {
        const chosenSeller = await prisma.seller.findUnique({ where: { id: carData.sellerId }, select: { marketId: true } });
        if (!chosenSeller || chosenSeller.marketId !== attendant.marketId) {
          return res.status(400).json({ message: "That seller is not registered under your market. You can only list cars for sellers in your market." });
        }
      }
    }
    // Marketing flags are an admin decision — strip them from restricted
    // submissions so an approved car can't smuggle in Featured/Urgent badges.
    if (user && (user.role === "SELLER" || user.role === "MARKET_ATTENDANT")) {
      delete carData.isFeatured;
      delete carData.urgentSaleBadge;
      delete carData.platformInspectedBadge;
    }

    const normalizedCarData = normalizeCarData(carData);

    // Input validation
    if (!carData.title || !carData.basePrice || !carData.sellerId) {
      return res.status(400).json({
        message: "Missing required fields: title, basePrice, sellerId",
      });
    }

    // Price validation (MK 100,000 - 100,000,000)
    const price = parseFloat(carData.basePrice);
    if (price < 100000 || price > 100000000) {
      return res.status(400).json({
        message: "Price must be between MK 100,000 and MK 100,000,000",
      });
    }

    // Year validation (1990 to current year + 1)
    if (carData.year) {
      const currentYear = new Date().getFullYear();
      if (carData.year < 1990 || carData.year > currentYear + 1) {
        return res.status(400).json({
          message: `Year must be between 1990 and ${currentYear + 1}`,
        });
      }
    }

    // Mileage validation (0 to 500,000 km)
    if (carData.mileage && (carData.mileage < 0 || carData.mileage > 500000)) {
      return res
        .status(400)
        .json({ message: "Mileage must be between 0 and 500,000 km" });
    }

    // Verify seller exists and is approved
    const seller = await prisma.seller.findUnique({
      where: { id: carData.sellerId },
    });
    if (!seller) {
      return res.status(400).json({ message: "Seller not found" });
    }
    if (seller.sellerStatus !== "APPROVED") {
      return res.status(400).json({ message: "Seller is not approved" });
    }

    // Determine status based on user role
    let carStatus = "AVAILABLE"; // Default for SUPER_ADMIN and SUB_ADMIN

    if (user && (user.role === "SELLER" || user.role === "MARKET_ATTENDANT")) {
      carStatus = "PENDING_APPROVAL"; // Requires admin approval
    } else if (carData.status) {
      carStatus = carData.status; // Admins can set any status
    }

    // Create car with images
    const car = await prisma.car.create({
      data: {
        ...normalizedCarData,
        status: carStatus,
        verifiedByAdmin:
          user && (user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN"),
        images: images
          ? {
              create: images.map((img: any) => ({
                url: img.url,
                isPrimary: img.isPrimary || false,
              })),
            }
          : undefined,
      } as any,
      include: {
        images: true,
        maker: true,
        model: true,
        bodyType: true,
      },
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        userId: user?.userId,
        action: "CREATE_CAR",
        entityType: "Car",
        entityId: car.id,
        newValue: JSON.stringify({
          title: car.title,
          status: carStatus,
          createdBy: user?.role,
        }),
      },
    });

    // Invalidate filter stats cache after creating car
    invalidateFilterStatsCache();

    res.status(201).json(car);
  } catch (error) {
    console.error("Failed to create car:", error);
    res.status(500).json({ message: "Failed to create car" });
  }
};

export const getCars = async (req: Request, res: Response) => {
  try {
    const {
      makerId,
      modelId,
      bodyTypeId,
      minPrice,
      maxPrice,
      status,
      featured,
      search,
      reference,
      fuelType,
      transmission,
      district,
      condition,
    } = req.query;

    // Parse + clamp paging. Unclamped, ?limit=100000 fetched the whole table
    // and ?limit=abc produced NaN skip/take, which made Prisma throw a 500.
    const parsedPage = Number.parseInt(String(req.query.page ?? 1), 10);
    const parsedLimit = Number.parseInt(String(req.query.limit ?? 100), 10);
    const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const user = (req as any).user;
    // Admins may pull a larger page — the inventory screen filters
    // client-side and was silently cut at the public 100-row cap.
    const maxTake = user ? 500 : 100;
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, maxTake) : 100;
    const skip = (pageNum - 1) * take;
    const where: Prisma.CarWhereInput = {
      deletedAt: null,
    };

    // Role-based filtering and status defaults
    if (user) {
      if (user.role === "SELLER") {
        const sellerProfile = await prisma.seller.findUnique({
          where: { userId: user.userId },
        });
        if (sellerProfile) {
          where.sellerId = sellerProfile.id;
        } else {
          // If no profile found for seller, return nothing safely
          where.id = "none";
        }
        if (status) where.status = status as string;
      } else if (user.role === "MARKET_ATTENDANT") {
        const attendantProfile = await prisma.marketAttendant.findUnique({
          where: { userId: user.userId },
        });
        if (attendantProfile) {
          where.marketId = attendantProfile.marketId;
        } else {
          where.id = "none";
        }
        if (status) where.status = status as string;
      } else {
        // SUPER_ADMIN or SUB_ADMIN
        if (status) where.status = status as string;
      }
    } else {
      // Public request — ALWAYS AVAILABLE only. Ignoring the client's status
      // param is deliberate and load-bearing: without this, an unauthenticated
      // `?status=PENDING_APPROVAL` (or HIDDEN) would expose unapproved and
      // rejected listings, bypassing the seller/attendant approval gate.
      where.status = "AVAILABLE";
    }

    // Exact-id set filter (?ids=a,b,c) — used by guest favorites, which store
    // car ids in localStorage and need exactly those cars back. Before this
    // existed the client sent id params the API ignored, so a guest's
    // favorites page showed the ENTIRE inventory as "liked".
    if (req.query.ids) {
      const ids = String(req.query.ids)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (ids.length > 0) where.id = { in: ids };
    }

    if (makerId) where.makerId = makerId as string;
    if (modelId) where.modelId = modelId as string;
    if (bodyTypeId) where.bodyTypeId = bodyTypeId as string;
    // Admin-managed category badge (Best Seller, New Arrival, …) — the
    // homepage's per-category "See all" lands here with this filter set.
    if (req.query.categoryId) {
      where.categories = { some: { categoryId: req.query.categoryId as string } };
    }
    if (featured === "true") where.isFeatured = true;
    if (fuelType) where.fuelType = fuelType as string;
    if (transmission) where.transmission = transmission as string;
    if (district) where.district = district as string;
    if (condition) where.condition = condition as string;

    if (minPrice || maxPrice) {
      where.basePrice = {
        gte: minPrice ? Number(minPrice) : undefined,
        lte: maxPrice ? Number(maxPrice) : undefined,
      };
    }

    if (reference) {
      where.id = { startsWith: reference as string };
    } else if (search) {
      const searchTerm = search as string;
      where.OR = [
        { title: ciContains(searchTerm) },
        { inspectionNotes: ciContains(searchTerm) },
        { id: { startsWith: searchTerm } },
      ];
    }

    // Public listings render cards, which need one image; `images: true`
    // shipped every photo of every car (up to 20 each — ~20x the payload).
    // Authenticated admin requests keep the full set: the inventory editor
    // prefills its photo slots from car.images.
    // Ordered rather than filtered on isPrimary, so a car whose primary flag
    // was never set still returns its first image instead of none.
    const imagesInclude = user
      ? true
      : ({
          select: { url: true, isPrimary: true },
          orderBy: { isPrimary: 'desc' as const },
          take: 1,
        });

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        include: {
          maker: true,
          model: true,
          bodyType: true,
          images: imagesInclude,
          categories: {
            include: { category: true },
            orderBy: { assignedAt: 'desc' },
          },
          // Hide seller contact info from public API
          seller: {
            select: { name: true, district: true, verifiedByPlatform: true },
          },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.car.count({ where }),
    ]);

    // sellerAskingPrice is the seller's bottom line — the margin GaliMotors
    // makes is the gap between it and the negotiated price. A customer who
    // can see it knows exactly how far the price can fall. Admin-only.
    const publicCars = user
      ? cars
      : cars.map(({ sellerAskingPrice, ...rest }) => rest);

    res.json({
      cars: publicCars,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
        // The homepage infinite scroll reads this; it was missing here, so
        // filtered and search views silently stopped after the first page.
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cars" });
  }
};

export const getCarById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { trackView = "true" } = req.query;

    const car = await prisma.car.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        maker: true,
        model: true,
        bodyType: true,
        images: true,
        features: { include: { feature: true } },
        categories: {
          include: { category: true },
          orderBy: { assignedAt: 'desc' },
        },
        // Hide seller contact info from public API
        seller: {
          select: { name: true, district: true, verifiedByPlatform: true },
        },
      },
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Privilege scope: full admins see everything; a seller or attendant is
    // privileged only for THEIR OWN car (own seller profile / own market).
    // For everyone else — including other sellers — the car behaves exactly
    // like the public view: hidden statuses 404, internal prices stripped.
    const user = (req as any).user;
    let privileged = false;
    if (user) {
      if (user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN") {
        privileged = true;
      } else if (user.role === "SELLER") {
        const profile = await prisma.seller.findUnique({ where: { userId: user.userId }, select: { id: true } });
        privileged = !!profile && car.sellerId === profile.id;
      } else if (user.role === "MARKET_ATTENDANT") {
        const profile = await prisma.marketAttendant.findUnique({ where: { userId: user.userId }, select: { marketId: true } });
        privileged = !!profile && !!car.marketId && car.marketId === profile.marketId;
      }
    }

    // Approval gate: a car pending approval or hidden/rejected is invisible
    // to the unprivileged even by direct ID. Without this a seller's
    // unapproved listing was fully viewable to anyone holding its link.
    const PUBLIC_VISIBLE_STATUSES = ["AVAILABLE", "RESERVED", "SOLD"];
    if (!privileged && !PUBLIC_VISIBLE_STATUSES.includes(car.status)) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Track view count (only if trackView is true and not from admin)
    if (trackView === "true") {
      await prisma.car.update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
      });

      // Update the car object with incremented view count
      car.viewsCount = car.viewsCount + 1;
    }

    // Seller's bottom line is internal — see the note in getCars.
    if (!privileged) {
      const { sellerAskingPrice, ...publicCar } = car;
      return res.json(publicCar);
    }

    res.json(car);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch car details" });
  }
};

export const updateCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { images, ...carData } = req.body;
    const normalizedCarData = normalizeCarData(carData);

    const existingCar = await prisma.car.findUnique({
      where: { id },
      select: { status: true, soldAt: true, images: { select: { url: true } } },
    });
    if (!existingCar) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Stamp soldAt on the transition to SOLD. Without it the nightly storage
    // lifecycle (archive + photo purge) never fires for cars sold via the
    // edit form — only markAsSold set it.
    if (normalizedCarData.status === "SOLD" && existingCar.status !== "SOLD" && !existingCar.soldAt) {
      (normalizedCarData as any).soldAt = new Date();
    }

    // If images are provided, update them
    if (images) {
      // Replaced photos must also leave Cloudinary — deleting only the DB
      // rows orphaned the assets there forever.
      const incomingUrls = new Set(images.map((img: any) => img.url));
      const removedUrls = existingCar.images
        .map((img) => img.url)
        .filter((url) => !incomingUrls.has(url));
      if (removedUrls.length > 0) {
        deleteCloudinaryImages(removedUrls).catch((err) =>
          console.error("Failed to delete replaced images from Cloudinary:", err)
        );
      }

      // Delete existing images
      await prisma.image.deleteMany({ where: { carId: id } });

      // Create new images
      await prisma.image.createMany({
        data: images.map((img: any) => ({
          carId: id,
          url: img.url,
          isPrimary: img.isPrimary || false,
        })),
      });
    }

    const car = await prisma.car.update({
      where: { id },
      data: normalizedCarData as any,
      include: {
        images: true,
        maker: true,
        model: true,
        bodyType: true,
      },
    });

    // Invalidate filter stats cache after updating car
    invalidateFilterStatsCache();

    res.json(car);
  } catch (error) {
    res.status(500).json({ message: "Failed to update car" });
  }
};

export const deleteCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get car with images before deleting
    const car = await prisma.car.findUnique({
      where: { id },
      include: { images: true }
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Delete car from database (cascades to images)
    await prisma.car.delete({ where: { id } });

    // Delete images from Cloudinary (async, don't wait)
    if (car.images.length > 0) {
      const imageUrls = car.images.map(img => img.url);
      deleteCloudinaryImages(imageUrls).catch(error => {
        console.error('Failed to delete Cloudinary images:', error);
      });
    }

    // Invalidate filter stats cache after deleting car
    invalidateFilterStatsCache();

    res.json({ 
      message: "Car deleted successfully",
      imagesDeleted: car.images.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete car" });
  }
};

// Soft delete car
export const softDeleteCar = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Soft delete: Set deletedAt timestamp instead of actually deleting
    const car = await prisma.car.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Invalidate filter stats cache after soft deleting car
    invalidateFilterStatsCache();

    res.json({ message: "Car soft deleted successfully", car });
  } catch (error) {
    res.status(500).json({ message: "Failed to soft delete car" });
  }
};

// Restore soft deleted car
export const restoreCar = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const car = await prisma.car.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Invalidate filter stats cache after restoring car
    invalidateFilterStatsCache();

    res.json({ message: "Car restored successfully", car });
  } catch (error) {
    res.status(500).json({ message: "Failed to restore car" });
  }
};

// Create or extend reservation
export const createReservation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { leadId, hours = 24 } = req.body;

    // Check if car is available
    const car = await prisma.car.findUnique({ where: { id } });
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.status !== "AVAILABLE" && car.status !== "RESERVED") {
      return res
        .status(400)
        .json({ message: "Car is not available for reservation" });
    }

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Update car with reservation
    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        status: "RESERVED",
        reservationExpiry: expiryTime,
        reservedByLeadId: leadId,
        reservationFeeRequired: true,
      },
    });

    // Update lead status if provided
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          type: "PAID_RESERVATION",
          status: "VIEWING_SCHEDULED",
        },
      });
    }

    res.json({
      message: "Reservation created successfully",
      car: updatedCar,
      expiresAt: expiryTime,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to create reservation" });
  }
};

// Extend reservation
export const extendReservation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { additionalHours = 24 } = req.body;

    const car = await prisma.car.findUnique({ where: { id } });
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.status !== "RESERVED") {
      return res.status(400).json({ message: "Car is not currently reserved" });
    }

    // Extend from current expiry or now (whichever is later)
    const baseTime =
      car.reservationExpiry && car.reservationExpiry > new Date()
        ? car.reservationExpiry
        : new Date();

    const newExpiry = new Date(
      baseTime.getTime() + additionalHours * 60 * 60 * 1000,
    );

    const updatedCar = await prisma.car.update({
      where: { id },
      data: { reservationExpiry: newExpiry },
    });

    res.json({
      message: "Reservation extended successfully",
      car: updatedCar,
      expiresAt: newExpiry,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to extend reservation" });
  }
};

// Cancel reservation
export const cancelReservation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const car = await prisma.car.update({
      where: { id },
      data: {
        status: "AVAILABLE",
        reservationExpiry: null,
        reservedByLeadId: null,
        reservationFeeRequired: false,
      },
    });

    res.json({
      message: "Reservation cancelled successfully",
      car,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to cancel reservation" });
  }
};

// Mark car as sold
export const markAsSold = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { soldPrice, commissionAmount } = req.body;

    const car = await prisma.car.findUnique({
      where: { id },
      include: {
        seller: { select: { name: true, phone: true } },
      },
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        status: "SOLD",
        soldAt: new Date(), // Track when car was sold
        // A direct admin sale settles any pending seller sold-request too.
        soldRequestedAt: null,
        soldRequestedById: null,
        soldRequestedByName: null,
        ...(soldPrice && { basePrice: soldPrice }),
        ...(commissionAmount && {
          commissionAmount,
          commissionStatus: "PENDING",
        }),
      },
    });

    // Send notification to seller
    if (car.seller && car.seller.phone) {
      const notificationService =
        require("../services/notificationService").default;
      const sellerNotification = notificationService.templates.carSold(
        car.seller.name,
        car.title,
        Number(soldPrice || car.basePrice),
        Number(commissionAmount || 0),
      );
      await notificationService.sendNotification({
        to: car.seller.phone,
        message: sellerNotification.message,
        subject: sellerNotification.subject,
        type: "whatsapp",
      });
    }

    res.json({
      message: "Car marked as sold successfully",
      car: updatedCar,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to mark car as sold" });
  }
};

// Bulk update car status
export const bulkUpdateStatus = async (req: Request, res: Response) => {
  try {
    const { carIds, status } = req.body;

    if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
      return res.status(400).json({ message: "carIds array is required" });
    }

    // Same soldAt rule as updateCar: bulk-sold cars must enter the storage
    // lifecycle too. Only stamp cars not already sold, preserving original
    // sale dates on repeats.
    const result = await prisma.car.updateMany({
      where: { id: { in: carIds as string[] } },
      data: { status },
    });
    if (status === "SOLD") {
      await prisma.car.updateMany({
        where: { id: { in: carIds as string[] }, soldAt: null },
        data: { soldAt: new Date() },
      });
    }

    // Invalidate filter stats cache after bulk status update
    invalidateFilterStatsCache();

    res.json({
      message: `${result.count} cars updated successfully`,
      count: result.count,
    });
  } catch (error) {
    res.status(400).json({ message: "Failed to bulk update cars" });
  }
};

// Bulk price update
export const bulkUpdatePrice = async (req: Request, res: Response) => {
  try {
    const { carIds, priceAdjustment, adjustmentType } = req.body;

    if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
      return res.status(400).json({ message: "carIds array is required" });
    }

    const carIdsArray = carIds as string[];

    if (adjustmentType === "percentage") {
      // Get all cars and update individually for percentage
      const cars = await prisma.car.findMany({
        where: { id: { in: carIdsArray } },
        select: { id: true, basePrice: true },
      });

      await Promise.all(
        cars.map((car) => {
          const newPrice = Number(car.basePrice) * (1 + priceAdjustment / 100);
          return prisma.car.update({
            where: { id: car.id },
            data: { basePrice: newPrice },
          });
        }),
      );

      // Invalidate filter stats cache after bulk price update
      invalidateFilterStatsCache();

      res.json({
        message: `${cars.length} cars updated with ${priceAdjustment}% price adjustment`,
        count: cars.length,
      });
    } else {
      // Fixed amount adjustment
      const cars = await prisma.car.findMany({
        where: { id: { in: carIdsArray } },
        select: { id: true, basePrice: true },
      });

      await Promise.all(
        cars.map((car) => {
          const newPrice = Number(car.basePrice) + priceAdjustment;
          return prisma.car.update({
            where: { id: car.id },
            data: { basePrice: Math.max(100000, newPrice) }, // Ensure minimum price
          });
        }),
      );

      // Invalidate filter stats cache after bulk price update
      invalidateFilterStatsCache();

      res.json({
        message: `${cars.length} cars updated with MK ${priceAdjustment} price adjustment`,
        count: cars.length,
      });
    }
  } catch (error) {
    res.status(400).json({ message: "Failed to bulk update prices" });
  }
};

// Get similar cars based on multiple criteria
export const getSimilarCars = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Clamped so a malformed ?limit= can't produce slice(0, NaN) — which
    // returns an empty list — or let a caller request the whole table.
    const parsedLimit = Number.parseInt(String(req.query.limit ?? 8), 10);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 24)
        : 8;

    // Get the current car to base similarity on
    const currentCar = await prisma.car.findUnique({
      where: { id, deletedAt: null },
      select: {
        basePrice: true,
        year: true,
        makerId: true,
        modelId: true,
        bodyTypeId: true,
        fuelType: true,
        transmission: true,
        maker: { select: { name: true } },
        model: { select: { name: true } },
        bodyType: { select: { name: true } },
      },
    });

    if (!currentCar) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Define price range (±30% of current car price)
    const priceMin = currentCar.basePrice * 0.7;
    const priceMax = currentCar.basePrice * 1.3;

    // Define year range (±3 years)
    const yearMin = (currentCar.year || 2000) - 3;
    const yearMax = (currentCar.year || 2030) + 3;

    // Fetch the full candidate pool (same maker OR same body type) so scoring
    // ranks every real candidate. Scoring a pre-truncated slice would rank an
    // arbitrary subset and miss the best matches. MAX_CANDIDATES is a safety
    // bound; newest-first ordering means any truncation drops stale stock.
    const MAX_CANDIDATES = 300;

    const candidates = await prisma.car.findMany({
      where: {
        id: { not: id },
        status: "AVAILABLE",
        deletedAt: null,
        OR: [
          { makerId: currentCar.makerId },
          { bodyTypeId: currentCar.bodyTypeId },
        ],
      },
      // Selecting only what scoring and the car card need. `include` pulled
      // every image for every candidate (up to 20 each) when the card renders one.
      select: {
        id: true,
        title: true,
        basePrice: true,
        year: true,
        mileage: true,
        negotiable: true,
        district: true,
        condition: true,
        urgentSaleBadge: true,
        isFeatured: true,
        viewsCount: true,
        createdAt: true,
        makerId: true,
        modelId: true,
        bodyTypeId: true,
        fuelType: true,
        transmission: true,
        maker: { select: { name: true } },
        model: { select: { name: true } },
        bodyType: { select: { name: true } },
        seller: {
          select: { name: true, district: true, verifiedByPlatform: true },
        },
        images: {
          select: { url: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
          take: 1,
        },
        // Keeps badges consistent with the homepage car cards.
        categories: {
          select: {
            category: {
              select: { name: true, emoji: true, color: true, bgColor: true },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES,
    });

    // Calculate similarity scores
    const scoredCars = candidates.map((car) => {
      let score = 0;

      // Same maker (highest priority)
      if (car.makerId === currentCar.makerId) score += 50;

      // Same model (very high priority)
      if (car.modelId === currentCar.modelId) score += 30;

      // Same body type
      if (car.bodyTypeId === currentCar.bodyTypeId) score += 25;

      // Similar price range
      if (car.basePrice >= priceMin && car.basePrice <= priceMax) score += 20;

      // Similar year
      if (car.year && car.year >= yearMin && car.year <= yearMax) score += 15;

      // Same fuel type
      if (car.fuelType === currentCar.fuelType) score += 10;

      // Same transmission
      if (car.transmission === currentCar.transmission) score += 5;

      // Featured cars get slight boost
      if (car.isFeatured) score += 5;

      // Recently added cars get slight boost
      const daysSinceCreated =
        (Date.now() - car.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated <= 30) score += 3;

      // Popular cars (high view count) get slight boost
      if (car.viewsCount > 10) score += 2;

      return {
        ...car,
        similarityScore: score,
      };
    });

    // Sort by similarity score and take the top results. Array.sort is stable,
    // so equal scores keep the newest-first order the query returned.
    const topSimilarCars = scoredCars
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    res.json({
      similarCars: topSimilarCars,
      basedOn: {
        maker: currentCar.maker?.name,
        model: currentCar.model?.name,
        bodyType: currentCar.bodyType?.name,
        priceRange: {
          min: Math.round(priceMin),
          max: Math.round(priceMax),
        },
        yearRange: { min: yearMin, max: yearMax },
      },
      totalFound: scoredCars.length,
    });
  } catch (error) {
    console.error("Similar cars error:", error);
    res.status(500).json({ message: "Failed to fetch similar cars" });
  }
};

// Get car view analytics
export const getCarViewAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const car = await prisma.car.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        viewsCount: true,
        inquiriesCount: true,
        createdAt: true,
        basePrice: true,
      },
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Calculate view-to-inquiry conversion rate
    const conversionRate =
      car.inquiriesCount > 0 && car.viewsCount > 0
        ? ((car.inquiriesCount / car.viewsCount) * 100).toFixed(2)
        : 0;

    // Calculate days listed
    const daysListed = Math.floor(
      (Date.now() - car.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    res.json({
      car: {
        id: car.id,
        title: car.title,
        totalViews: car.viewsCount,
        totalInquiries: car.inquiriesCount,
        conversionRate: `${conversionRate}%`,
        daysListed,
        averageViewsPerDay:
          daysListed > 0 ? (car.viewsCount / daysListed).toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error("Car analytics error:", error);
    res.status(500).json({ message: "Failed to fetch car analytics" });
  }
};
// Get smart-ranked cars using intelligent algorithm
export const getSmartRankedCars = async (req: Request, res: Response) => {
  try {
    const {
      makerId,
      modelId,
      bodyTypeId,
      minPrice,
      maxPrice,
      fuelType,
      transmission,
      district,
      search,
      condition,
      page = 1,
      limit = 20,
      useSmartRanking = "true",
    } = req.query;

    // If smart ranking is disabled, fall back to regular getCars
    if (useSmartRanking !== "true") {
      return getCars(req, res);
    }

    const searchRankingService = (
      await import("../services/searchRankingService")
    ).default;

    const searchCriteria = {
      makerId: makerId as string,
      modelId: modelId as string,
      bodyTypeId: bodyTypeId as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      fuelType: fuelType as string,
      transmission: transmission as string,
      district: district as string,
      search: search as string,
      condition: condition as string,
    };

    const result = await searchRankingService.getSmartRankedCars(
      searchCriteria,
      Number(page),
      Number(limit),
    );

    res.json({
      ...result,
      smartRanking: true,
      searchCriteria,
    });
  } catch (error) {
    console.error("Smart ranking error:", error);
    // Fall back to regular search if smart ranking fails
    return getCars(req, res);
  }
};

// Get ranking explanation for a specific car
export const getCarRankingExplanation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const searchCriteria = req.body;

    const searchRankingService = (
      await import("../services/searchRankingService")
    ).default;

    // Get the car
    const car = await prisma.car.findUnique({
      where: { id, deletedAt: null },
      include: {
        maker: true,
        model: true,
        bodyType: true,
        images: true,
        seller: {
          select: { name: true, district: true, verifiedByPlatform: true },
        },
      },
    });

    if (!car) {
      return res.status(404).json({ error: "Car not found" });
    }

    // Get market data
    const marketData = await searchRankingService.getMarketData(searchCriteria);

    // Calculate scores
    const relevanceScore = searchRankingService.calculateRelevanceScore(
      car,
      searchCriteria,
      marketData,
    );
    const scoreBreakdown = searchRankingService.getScoreBreakdown(
      car,
      searchCriteria,
      marketData,
    );

    res.json({
      car: {
        id: car.id,
        title: car.title,
        basePrice: car.basePrice,
      },
      relevanceScore,
      scoreBreakdown,
      marketData,
      searchCriteria,
    });
  } catch (error) {
    console.error("Ranking explanation error:", error);
    res.status(500).json({ error: "Failed to get ranking explanation" });
  }
};

// Optimized endpoint for homepage - loads minimal data for fast initial page load
//
// Shape: { featured, recent, preview, total, hasMore }.
// The old per-category `sections` rows are gone — they tripled the label
// noise (heading + ribbon + pill for the same fact) and made page length
// scale with the number of admin categories. Categories still power the
// /cars sidebar filter; the homepage is now a fixed, bounded showroom.
const HOMEPAGE_CARD_SELECT = {
  id: true,
  title: true,
  basePrice: true,
  year: true,
  mileage: true,
  district: true,
  negotiable: true,
  urgentSaleBadge: true,
  maker: { select: { name: true } },
  model: { select: { name: true } },
  images: {
    where: { isPrimary: true },
    select: { url: true, isPrimary: true },
  },
} as const;

export const getHomepageCars = async (req: Request, res: Response) => {
  try {
    const availableWhere = { status: "AVAILABLE", deletedAt: null } as const;

    const [featured, recent, preview, total, categoryRows] = await Promise.all([
      // Featured strip (8, curated via the admin's Featured flag)
      prisma.car.findMany({
        where: { ...availableWhere, isFeatured: true },
        select: HOMEPAGE_CARD_SELECT,
        take: 8,
        orderBy: { createdAt: "desc" },
      }),

      // "New Arrivals" strip: newest 8. Field kept as `recent` so a stale
      // edge-cached payload from the previous shape still feeds the strip.
      prisma.car.findMany({
        where: availableWhere,
        select: HOMEPAGE_CARD_SELECT,
        take: 8,
        orderBy: { createdAt: "desc" },
      }),

      // "All Vehicles" two-row preview: the NEXT newest cars (9–18), so the
      // strip and the grid form one continuous sequence with no duplicates,
      // and "Browse all" continues from car 19.
      prisma.car.findMany({
        where: availableWhere,
        select: HOMEPAGE_CARD_SELECT,
        skip: 8,
        take: 10,
        orderBy: { createdAt: "desc" },
      }),

      // Total count for the "Browse all N vehicles" CTA
      prisma.car.count({ where: availableWhere }),

      // One strip per admin category, in the drag-to-reorder sortOrder from
      // the admin Categories screen, 8 newest-assigned cars each. Rendered
      // as ONE-ROW strips between the browse tiles and the All Vehicles
      // preview — the admin owns which categories show and in what order.
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          cars: {
            where: { car: availableWhere },
            orderBy: { assignedAt: "desc" },
            take: 8,
            select: { car: { select: HOMEPAGE_CARD_SELECT } },
          },
        },
      }),
    ]);

    const sections = categoryRows
      .map((c) => ({ id: c.id, name: c.name, cars: c.cars.map((cc) => cc.car) }))
      // Empty categories render nothing. Two names are excluded by policy:
      // "New Arrival" is covered by the automatic New Arrivals strip, and
      // "Verified" must never be a section — every car on this site is
      // verified by the brand promise, and a Verified section implies the
      // cars outside it are not.
      .filter((s) => s.cars.length > 0 && !/new\s*arrivals?|verified/i.test(s.name));

    res.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
    res.json({ featured, recent, preview, sections, total, hasMore: total > 8 });
  } catch (error) {
    console.error("Homepage cars error:", error);
    res.status(500).json({ message: "Failed to fetch homepage cars" });
  }
};

// Optimized endpoint for loading more cars (pagination)
export const getMoreCars = async (req: Request, res: Response) => {
  try {
    const parsedPage = Number.parseInt(String(req.query.page ?? 1), 10);
    const parsedLimit = Number.parseInt(String(req.query.limit ?? 24), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 48) : 24;
    const skip = (page - 1) * take;

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where: {
          status: "AVAILABLE",
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          basePrice: true,
          year: true,
          mileage: true,
          district: true,
          inquiriesCount: true,
          urgentSaleBadge: true,
          platformInspectedBadge: true,
          maker: { select: { name: true } },
          model: { select: { name: true } },
          // Same badge data the first 24 cars carry — without it, category
          // chips silently vanished on every lazily loaded batch.
          categories: {
            select: { category: { select: { name: true, emoji: true, color: true, bgColor: true } } },
            orderBy: { assignedAt: 'desc' },
          },
          images: {
            where: { isPrimary: true },
            select: { url: true, isPrimary: true },
          },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.car.count({
        where: {
          status: "AVAILABLE",
          deletedAt: null,
        },
      }),
    ]);

    res.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
    res.json({
      cars,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error("Load more cars error:", error);
    res.status(500).json({ message: "Failed to load more cars" });
  }
};

// ==========================================
// APPROVAL WORKFLOW FOR SELLERS & ATTENDANTS
// ==========================================

// Get cars pending approval
export const getPendingApprovalCars = async (req: Request, res: Response) => {
  try {
    const cars = await prisma.car.findMany({
      where: {
        status: "PENDING_APPROVAL",
        deletedAt: null,
      },
      include: {
        maker: { select: { id: true, name: true, logoUrl: true } },
        model: { select: { id: true, name: true } },
        bodyType: { select: { id: true, name: true } },
        seller: {
          select: { id: true, name: true, phone: true, sellerType: true },
        },
        images: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(cars);
  } catch (error) {
    console.error("Failed to fetch pending approval cars:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch pending approval cars" });
  }
};

// Approve a car listing
export const approveCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({ where: { id } });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ message: "Car is not pending approval" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        status: "AVAILABLE",
        verifiedByAdmin: true,
      },
      include: {
        maker: true,
        model: true,
        bodyType: true,
        seller: true,
        images: true,
      },
    });

    // Log the approval
    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "APPROVE_CAR",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({
          status: "AVAILABLE",
          approvedBy: user.userId,
        }),
      },
    });

    // Invalidate filter stats cache after approving car
    invalidateFilterStatsCache();

    res.json({ message: "Car approved successfully", car: updatedCar });
  } catch (error) {
    console.error("Failed to approve car:", error);
    res.status(500).json({ message: "Failed to approve car" });
  }
};

// Reject a car listing
export const rejectCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({ where: { id } });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ message: "Car is not pending approval" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        status: "HIDDEN",
        inspectionNotes: reason || "Rejected by admin",
      },
      include: {
        maker: true,
        model: true,
        bodyType: true,
        seller: true,
        images: true,
      },
    });

    // Log the rejection
    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "REJECT_CAR",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({
          status: "HIDDEN",
          rejectedBy: user.userId,
          reason,
        }),
      },
    });

    // Invalidate filter stats cache after rejecting car
    invalidateFilterStatsCache();

    res.json({ message: "Car rejected successfully", car: updatedCar });
  } catch (error) {
    console.error("Failed to reject car:", error);
    res.status(500).json({ message: "Failed to reject car" });
  }
};

// ==========================================
// SOLD-APPROVAL WORKFLOW
// ==========================================
// Sellers and attendants cannot flip a car to SOLD themselves — a wrong (or
// malicious) "sold" would silently pull a live listing off the site. They
// file a request; an admin approves it, and only then does the car become
// SOLD and disappear from the storefront.

/**
 * Whether this seller/attendant user governs this specific car:
 * sellers own cars under their seller profile; attendants govern
 * every car in their market.
 */
const canManageCar = async (
  user: { userId: string; role: string },
  car: { sellerId: string; marketId: string | null },
): Promise<boolean> => {
  if (user.role === "SELLER") {
    const profile = await prisma.seller.findUnique({ where: { userId: user.userId }, select: { id: true } });
    return !!profile && car.sellerId === profile.id;
  }
  if (user.role === "MARKET_ATTENDANT") {
    const profile = await prisma.marketAttendant.findUnique({ where: { userId: user.userId }, select: { marketId: true } });
    return !!profile && !!car.marketId && car.marketId === profile.marketId;
  }
  return false;
};

// Seller/attendant: ask the admin to mark this car sold
export const requestSold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({ where: { id, deletedAt: null } });
    if (!car) return res.status(404).json({ message: "Car not found" });

    if (!(await canManageCar(user, car))) {
      return res.status(403).json({ message: "You can only manage your own cars" });
    }
    if (car.status === "SOLD") {
      return res.status(400).json({ message: "This car is already sold" });
    }
    if (car.status === "PENDING_APPROVAL" || car.status === "HIDDEN") {
      return res.status(400).json({ message: "The listing must be approved and live before it can be marked sold" });
    }
    if (car.soldRequestedAt) {
      return res.status(400).json({ message: "A sold request is already awaiting admin approval" });
    }

    const requester = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        soldRequestedAt: new Date(),
        soldRequestedById: user.userId,
        soldRequestedByName: requester?.name || user.role,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "REQUEST_SOLD",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({ title: car.title, requestedBy: requester?.name }),
      },
    });

    res.json({ message: "Sold request sent — an admin will confirm the sale", car: updatedCar });
  } catch (error) {
    console.error("Failed to request sold:", error);
    res.status(500).json({ message: "Failed to request sold" });
  }
};

// Seller/attendant: withdraw their own pending sold request
export const cancelSoldRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({ where: { id, deletedAt: null } });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (!(await canManageCar(user, car))) {
      return res.status(403).json({ message: "You can only manage your own cars" });
    }
    if (!car.soldRequestedAt) {
      return res.status(400).json({ message: "There is no pending sold request on this car" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: { soldRequestedAt: null, soldRequestedById: null, soldRequestedByName: null },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "CANCEL_SOLD_REQUEST",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({ title: car.title }),
      },
    });

    res.json({ message: "Sold request withdrawn", car: updatedCar });
  } catch (error) {
    console.error("Failed to cancel sold request:", error);
    res.status(500).json({ message: "Failed to cancel sold request" });
  }
};

// Admin: list cars with a pending sold request
export const getSoldRequests = async (_req: Request, res: Response) => {
  try {
    const cars = await prisma.car.findMany({
      where: {
        soldRequestedAt: { not: null },
        status: { not: "SOLD" },
        deletedAt: null,
      },
      include: {
        maker: { select: { id: true, name: true } },
        model: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true, phone: true } },
        market: { select: { id: true, name: true } },
        images: true,
      },
      orderBy: { soldRequestedAt: "asc" },
    });
    res.json(cars);
  } catch (error) {
    console.error("Failed to fetch sold requests:", error);
    res.status(500).json({ message: "Failed to fetch sold requests" });
  }
};

// Admin: approve — the car becomes SOLD and leaves the storefront
export const approveSoldRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({
      where: { id, deletedAt: null },
      include: { seller: { select: { name: true, phone: true } } },
    });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (!car.soldRequestedAt) {
      return res.status(400).json({ message: "This car has no pending sold request" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: {
        status: "SOLD",
        soldAt: car.soldAt ?? new Date(),
        soldRequestedAt: null,
        soldRequestedById: null,
        soldRequestedByName: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "APPROVE_SOLD",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({ title: car.title, requestedBy: car.soldRequestedByName }),
      },
    });

    invalidateFilterStatsCache();
    res.json({ message: "Sale confirmed — the car is now marked sold", car: updatedCar });
  } catch (error) {
    console.error("Failed to approve sold request:", error);
    res.status(500).json({ message: "Failed to approve sold request" });
  }
};

// Admin: reject — the request is cleared, the car stays live
export const rejectSoldRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = (req as any).user;

    const car = await prisma.car.findUnique({ where: { id, deletedAt: null } });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (!car.soldRequestedAt) {
      return res.status(400).json({ message: "This car has no pending sold request" });
    }

    const updatedCar = await prisma.car.update({
      where: { id },
      data: { soldRequestedAt: null, soldRequestedById: null, soldRequestedByName: null },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: "REJECT_SOLD",
        entityType: "Car",
        entityId: id,
        newValue: JSON.stringify({ title: car.title, requestedBy: car.soldRequestedByName, reason: reason || null }),
      },
    });

    res.json({ message: "Sold request declined — the listing stays live", car: updatedCar });
  } catch (error) {
    console.error("Failed to reject sold request:", error);
    res.status(500).json({ message: "Failed to reject sold request" });
  }
};
