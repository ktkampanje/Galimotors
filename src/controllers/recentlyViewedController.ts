import { Request, Response } from "express";
import prisma from "../lib/prisma";

const getCustomerId = (req: Request) =>
  (req as any).customer?.customerId || (req as any).customer?.id;

// Track car view (requires authentication)
export const trackCarView = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carId } = req.body;

    if (!carId) {
      return res.status(400).json({ error: "Car ID is required" });
    }

    // Check if car exists
    const car = await prisma.car.findUnique({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({ error: "Car not found" });
    }

    // Upsert recently viewed (update timestamp if already exists)
    await prisma.recentlyViewed.upsert({
      where: {
        customerId_carId: {
          customerId,
          carId,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        customerId,
        carId,
      },
    });

    res.json({ message: "View tracked successfully" });
  } catch (error) {
    console.error("Track car view error:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
};

// Get recently viewed cars
export const getRecentlyViewed = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const limit = parseInt(req.query.limit as string) || 12;

    const recentlyViewed = await prisma.recentlyViewed.findMany({
      where: { customerId },
      orderBy: { viewedAt: "desc" },
      take: limit,
      include: {
        customer: false,
      },
    });

    // Get car details for each viewed car
    const carIds = recentlyViewed.map((rv) => rv.carId);

    const cars = await prisma.car.findMany({
      where: {
        id: { in: carIds },
        status: "AVAILABLE", // Only show available cars
      },
      include: {
        maker: { select: { id: true, name: true, logoUrl: true } },
        model: { select: { id: true, name: true } },
        bodyType: { select: { id: true, name: true } },
        images: true,
        seller: {
          select: {
            name: true,
            verifiedByPlatform: true,
            district: true,
          },
        },
      },
    });

    // Sort cars by view order
    const sortedCars = carIds
      .map((carId) => cars.find((car) => car.id === carId))
      .filter((car) => car !== undefined);

    res.json({
      recentlyViewed: sortedCars,
      total: sortedCars.length,
    });
  } catch (error) {
    console.error("Get recently viewed error:", error);
    res.status(500).json({ error: "Failed to fetch recently viewed cars" });
  }
};

// Clear recently viewed history
export const clearRecentlyViewed = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    await prisma.recentlyViewed.deleteMany({
      where: { customerId },
    });

    res.json({ message: "Recently viewed history cleared" });
  } catch (error) {
    console.error("Clear recently viewed error:", error);
    res.status(500).json({ error: "Failed to clear history" });
  }
};

// Remove specific car from recently viewed
export const removeFromRecentlyViewed = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carId } = req.params;

    await prisma.recentlyViewed.delete({
      where: {
        customerId_carId: {
          customerId,
          carId,
        },
      },
    });

    res.json({ message: "Car removed from recently viewed" });
  } catch (error) {
    console.error("Remove from recently viewed error:", error);
    res.status(500).json({ error: "Failed to remove car" });
  }
};

// Sync recently viewed from local storage
export const syncRecentlyViewed = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carIds } = req.body;

    if (!Array.isArray(carIds)) {
      return res.status(400).json({ error: "carIds must be an array" });
    }

    if (carIds.length === 0) {
      return res.json({ message: "No history to sync", synced: 0 });
    }

    // Verify cars exist
    const cars = await prisma.car.findMany({
      where: { id: { in: carIds } },
      select: { id: true },
    });
    
    const validCarIds = cars.map((c) => c.id);

    // Upsert to handle existing
    let syncedCount = 0;
    for (const carId of validCarIds) {
      await prisma.recentlyViewed.upsert({
        where: {
          customerId_carId: {
            customerId,
            carId,
          },
        },
        update: {}, // keep existing viewedAt
        create: {
          customerId,
          carId,
          viewedAt: new Date(),
        },
      });
      syncedCount++;
    }

    res.json({ message: "Recently viewed synced successfully", synced: syncedCount });
  } catch (error) {
    console.error("Sync recently viewed error:", error);
    res.status(500).json({ error: "Failed to sync history" });
  }
};
