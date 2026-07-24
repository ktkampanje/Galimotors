import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createMaker = async (req: Request, res: Response) => {
  try {
    const { name, logoUrl } = req.body;
    const maker = await prisma.maker.create({
      data: { name, logoUrl },
    });
    res.status(201).json(maker);
  } catch (error) {
    res.status(500).json({ message: "Failed to create maker" });
  }
};

export const getMakers = async (req: Request, res: Response) => {
  try {
    const makers = await prisma.maker.findMany({
      include: {
        models: true,
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

    // Malawian market priority order. Positions 1-8 are a fixed business
    // ordering; 9+ continue by how common the make is on Malawian roads.
    // Anything absent falls through to car-count then alphabetical sorting.
    const priorityOrder: Record<string, number> = {
      'Toyota': 1,
      'Nissan': 2,
      'Honda': 3,
      'Mazda': 4,
      'Ford': 5,
      'BMW': 6,
      'Mercedes-Benz': 7,
      'Volkswagen': 8,
      // Continuing by prevalence in Malawi
      'Mitsubishi': 9,
      'Isuzu': 10,
      'Suzuki': 11,
      'Subaru': 12,
      'Hyundai': 13,
      'Kia': 14,
      'Land Rover': 15,
      'Lexus': 16,
      'Mahindra': 17,
      'Tata': 18,
      // Commercial / haulage
      'Hino': 19,
      'UD': 20,
      'Scania': 21,
      'MAN': 22,
      'Iveco': 23,
      'Volvo': 24,
      // Aliases, in case a make is later added under a variant spelling
      'VW': 8,
      'Mercedes': 7,
      'Benz': 7,
      'Landrover': 15,
    };

    // Sort by: 1) Market priority, 2) Car count, 3) Alphabetically
    const sortedMakers = makers.sort((a, b) => {
      const aPriority = priorityOrder[a.name] || 99;
      const bPriority = priorityOrder[b.name] || 99;
      
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

    res.json(sortedMakers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch makers" });
  }
};

export const updateMaker = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, logoUrl } = req.body;
    const maker = await prisma.maker.update({
      where: { id },
      data: { name, logoUrl },
    });
    res.json(maker);
  } catch (error) {
    res.status(500).json({ message: "Failed to update maker" });
  }
};

export const deleteMaker = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.maker.delete({ where: { id } });
    res.json({ message: "Maker deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete maker" });
  }
};
