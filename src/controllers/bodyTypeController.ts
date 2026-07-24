import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createBodyType = async (req: Request, res: Response) => {
  try {
    const { name, iconUrl } = req.body;
    const bodyType = await prisma.bodyType.create({
      data: { name, iconUrl },
    });
    res.status(201).json(bodyType);
  } catch (error) {
    res.status(500).json({ message: "Failed to create body type" });
  }
};

export const getBodyTypes = async (req: Request, res: Response) => {
  try {
    const bodyTypes = await prisma.bodyType.findMany({
      include: {
        _count: {
          select: {
            cars: {
              where: {
                status: 'AVAILABLE',
                deletedAt: null
              }
            }
          }
        }
      }
    });

    // Malawian market priority order for body types
    const priorityOrder: Record<string, number> = {
      'SUV': 1,
      'Coupe': 2,
      'Sedan': 3,
      'Pickup': 4,
      'Hatchback': 5,
      'Station Wagon': 6,
      'Minivan': 7,
      'Van': 8,
      'Bus': 9,
      'Truck': 10,
    };

    // Sort by: 1) Market priority, 2) Car count, 3) Alphabetically
    const sortedBodyTypes = bodyTypes.sort((a, b) => {
      // Find priority (case-insensitive)
      let aPriority = 99;
      let bPriority = 99;
      
      for (const [key, value] of Object.entries(priorityOrder)) {
        if (key.toLowerCase() === a.name.trim().toLowerCase()) aPriority = value;
        if (key.toLowerCase() === b.name.trim().toLowerCase()) bPriority = value;
      }

      // First sort by market priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then by car count (most popular first)
      const countDiff = b._count.cars - a._count.cars;
      if (countDiff !== 0) return countDiff;
      
      // Finally alphabetically
      return a.name.localeCompare(b.name);
    });

    res.json(sortedBodyTypes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch body types" });
  }
};

export const updateBodyType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, iconUrl } = req.body;
    const bodyType = await prisma.bodyType.update({
      where: { id },
      data: { name, iconUrl },
    });
    res.json(bodyType);
  } catch (error) {
    res.status(500).json({ message: "Failed to update body type" });
  }
};

export const deleteBodyType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.bodyType.delete({ where: { id } });
    res.json({ message: "Body type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete body type" });
  }
};
