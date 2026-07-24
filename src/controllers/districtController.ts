import { Request, Response } from "express";
import prisma from "../lib/prisma";

/**
 * Get all unique districts with car counts
 * Districts are derived from the district field in cars
 */
export const getDistricts = async (req: Request, res: Response) => {
  try {
    // Get all unique districts from available cars
    const districts = await prisma.car.groupBy({
      by: ['district'],
      where: {
        status: 'AVAILABLE',
        deletedAt: null,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    // Format the response
    const formattedDistricts = districts.map((district, index) => ({
      id: district.district,
      name: district.district,
      priority: index + 1,
      _count: {
        cars: district._count.id,
      },
    }));

    res.json(formattedDistricts);
  } catch (error) {
    console.error("Error fetching districts:", error);
    res.status(500).json({ error: "Failed to fetch districts" });
  }
};
