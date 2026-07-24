import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getFilterStatsFromCache } from "../services/filterStatsCacheService";

// ==========================================
// DISTRICTS
// ==========================================

export const getDistricts = async (req: Request, res: Response) => {
  try {
    // Get districts with sortOrder
    const districts = await prisma.district.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Get car counts from filter stats cache
    const filterStats = await getFilterStatsFromCache();
    const districtCounts = filterStats?.district || {};

    // Merge counts with district data. The charge flags MUST be included:
    // this endpoint feeds both the admin logistics editor and the customer
    // viewing-cost calculator, and when they were stripped here every reader
    // saw undefined — the admin's saved settings silently never applied.
    const districtsWithCounts = districts.map(district => ({
      id: district.id,
      name: district.name,
      priority: district.sortOrder,
      chargeFuel: district.chargeFuel,
      chargeDriverAllowance: district.chargeDriverAllowance,
      chargeAccommodation: district.chargeAccommodation,
      _count: {
        cars: districtCounts[district.name] || 0
      }
    }));

    res.json(districtsWithCounts);
  } catch (error) {
    console.error("Failed to fetch districts:", error);
    res.status(500).json({ message: "Failed to fetch districts" });
  }
};

export const createDistrict = async (req: Request, res: Response) => {
  try {
    const { name, chargeDriverAllowance, chargeAccommodation, chargeFuel } = req.body;
    // Set sortOrder to the next highest value
    const maxSort = await prisma.district.aggregate({ _max: { sortOrder: true } });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const data: any = { name, sortOrder: nextSort };
    if (chargeDriverAllowance !== undefined) data.chargeDriverAllowance = chargeDriverAllowance;
    if (chargeAccommodation !== undefined) data.chargeAccommodation = chargeAccommodation;
    if (chargeFuel !== undefined) data.chargeFuel = chargeFuel;

    const district = await prisma.district.create({
      data,
    });
    res.json(district);
  } catch (error) {
    res.status(400).json({ message: "Failed to create district" });
  }
};

export const updateDistrict = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sortOrder, chargeDriverAllowance, chargeAccommodation, chargeFuel } = req.body;

    const existingDistrict = await prisma.district.findUnique({ where: { id } });
    if (!existingDistrict) {
      return res.status(404).json({ message: "District not found" });
    }

    const newSortOrder = sortOrder !== undefined ? parseInt(sortOrder) : undefined;
    const oldSortOrder = existingDistrict.sortOrder;

    const result = await prisma.$transaction(async (tx) => {
      if (newSortOrder !== undefined && newSortOrder !== oldSortOrder) {
        if (newSortOrder < oldSortOrder) {
          // Shifting down: increment others in the range [new, old-1]
          await tx.district.updateMany({
            where: {
              sortOrder: {
                gte: newSortOrder,
                lt: oldSortOrder
              }
            },
            data: {
              sortOrder: { increment: 1 }
            }
          });
        } else {
          // Shifting up: decrement others in the range [old+1, new]
          await tx.district.updateMany({
            where: {
              sortOrder: {
                gt: oldSortOrder,
                lte: newSortOrder
              }
            },
            data: {
              sortOrder: { decrement: 1 }
            }
          });
        }
      }

      const data: any = {};
      if (name !== undefined) data.name = name;
      if (newSortOrder !== undefined) data.sortOrder = newSortOrder;
      if (chargeDriverAllowance !== undefined) data.chargeDriverAllowance = chargeDriverAllowance;
      if (chargeAccommodation !== undefined) data.chargeAccommodation = chargeAccommodation;
      if (chargeFuel !== undefined) data.chargeFuel = chargeFuel;

      return tx.district.update({
        where: { id },
        data,
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Update district failed:', error);
    res.status(400).json({ message: "Failed to update district" });
  }
};

export const deleteDistrict = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.district.delete({ where: { id } });
    res.json({ message: "District deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Failed to delete district" });
  }
};

// ==========================================
// DISTANCES (Lilongwe Base)
// ==========================================

export const getDistances = async (req: Request, res: Response) => {
  try {
    const distances = await prisma.distance.findMany();
    res.json(distances);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch distances" });
  }
};

export const upsertDistance = async (req: Request, res: Response) => {
  try {
    const { fromDistrictId, toDistrictId, distanceKm } = req.body;
    
    // In our system, 'from' is usually Lilongwe
    const distance = await prisma.distance.upsert({
      where: { id: req.body.id || 'new-distance' },
      update: { distanceKm },
      create: { fromDistrictId, toDistrictId, distanceKm },
    });
    
    res.json(distance);
  } catch (error) {
    res.status(400).json({ message: "Failed to update distance" });
  }
};

// Simplified upsert by district pair for easier frontend usage
export const updateDistanceByDistricts = async (req: Request, res: Response) => {
  try {
    const { fromDistrictId, toDistrictId, distanceKm } = req.body;
    
    // Find existing distance record
    const existing = await prisma.distance.findFirst({
      where: {
        fromDistrictId,
        toDistrictId
      }
    });

    if (existing) {
      const updated = await prisma.distance.update({
        where: { id: existing.id },
        data: { distanceKm }
      });
      return res.json(updated);
    }

    const created = await prisma.distance.create({
      data: { fromDistrictId, toDistrictId, distanceKm }
    });
    res.json(created);
  } catch (error) {
    res.status(400).json({ message: "Failed to sync distance" });
  }
};
