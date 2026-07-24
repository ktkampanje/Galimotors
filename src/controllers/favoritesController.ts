import { Request, Response } from "express";
import prisma from "../lib/prisma";

const getCustomerId = (req: Request) =>
  (req as any).customer?.customerId || (req as any).customer?.id;

// Add car to favorites
export const addFavorite = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carId } = req.body;

    if (!carId) {
      return res.status(400).json({ error: "Car ID is required" });
    }

    // Check if car exists
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return res.status(404).json({ error: "Car not found" });
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        customerId_carId: {
          customerId,
          carId,
        },
      },
    });

    if (existing) {
      return res.status(200).json({
        message: "Already in favorites",
        favorite: existing,
      });
    }

    // Add to favorites
    const favorite = await prisma.favorite.create({
      data: {
        customerId,
        carId,
      },
    });

    res.status(201).json({
      message: "Added to favorites",
      favorite,
    });
  } catch (error) {
    console.error("Add favorite error:", error);
    res.status(500).json({ error: "Failed to add favorite" });
  }
};

// Remove car from favorites
export const removeFavorite = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        customerId_carId: {
          customerId,
          carId,
        },
      },
    });

    if (!favorite) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    await prisma.favorite.delete({
      where: {
        id: favorite.id,
      },
    });

    res.json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("Remove favorite error:", error);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
};

// Get all favorites for customer
export const getFavorites = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    const favorites = await prisma.favorite.findMany({
      where: { customerId },
      orderBy: { addedAt: "desc" },
    });

    // Fetch car details separately
    const favoriteCars = await Promise.all(
      favorites.map(async (fav) => {
        const car = await prisma.car.findUnique({
          where: { id: fav.carId },
          include: {
            maker: { select: { name: true } },
            model: { select: { name: true } },
            bodyType: { select: { name: true } },
            images: true,
          },
        });

        if (!car) return null;

        return {
          favoriteId: fav.id,
          addedAt: fav.addedAt,
          car: {
            ...car,
            makerSlug: car.maker?.name
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, "-"),
            modelSlug: car.model?.name
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, "-"),
            uuidShort: car.id.substring(0, 8),
          },
        };
      }),
    );

    // Filter out null values (deleted cars)
    const validFavorites = favoriteCars.filter((f) => f !== null);

    res.json({
      favorites: validFavorites,
      count: validFavorites.length,
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
};

// Check if car is favorited
export const checkFavorite = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        customerId_carId: {
          customerId,
          carId,
        },
      },
    });

    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({ error: "Failed to check favorite" });
  }
};

// Clear all favorites
export const clearFavorites = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    await prisma.favorite.deleteMany({
      where: { customerId },
    });

    res.json({ message: "All favorites cleared" });
  } catch (error) {
    console.error("Clear favorites error:", error);
    res.status(500).json({ error: "Failed to clear favorites" });
  }
};

// Sync multiple favorites from local storage
export const syncFavorites = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { carIds } = req.body;

    if (!Array.isArray(carIds)) {
      return res.status(400).json({ error: "carIds must be an array" });
    }

    if (carIds.length === 0) {
      return res.json({ message: "No favorites to sync", synced: 0 });
    }

    // Verify all cars exist
    const cars = await prisma.car.findMany({
      where: { id: { in: carIds } },
      select: { id: true },
    });
    
    const validCarIds = cars.map((c) => c.id);

    // Get existing favorites to avoid duplicates
    const existing = await prisma.favorite.findMany({
      where: { customerId, carId: { in: validCarIds } },
      select: { carId: true },
    });
    
    const existingIds = new Set(existing.map((e) => e.carId));
    const newCarIds = validCarIds.filter((id) => !existingIds.has(id));

    if (newCarIds.length === 0) {
      return res.json({ message: "Favorites already synced", synced: 0 });
    }

    await prisma.favorite.createMany({
      data: newCarIds.map((carId) => ({
        customerId,
        carId,
      })),
    });

    res.json({ message: "Favorites synced successfully", synced: newCarIds.length });
  } catch (error) {
    console.error("Sync favorites error:", error);
    res.status(500).json({ error: "Failed to sync favorites" });
  }
};
