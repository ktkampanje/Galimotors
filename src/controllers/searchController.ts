import { Request, Response } from "express";
import { ciContains } from "../lib/searchFilters";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.trim().length === 0) {
      return res.json({ cars: [], leads: [], sellRequests: [] });
    }

    const q = query.trim();

    // 1. Search Cars
    const cars = await prisma.car.findMany({
      where: {
        OR: [
          { title: ciContains(q) },
          { registrationNumber: ciContains(q) },
          { chassisNumber: ciContains(q) },
          { maker: { name: ciContains(q) } },
          { model: { name: ciContains(q) } },
          { id: { startsWith: q } }
        ]
      },
      select: {
        id: true,
        title: true,
        basePrice: true,
        maker: { select: { name: true } },
        model: { select: { name: true } }
      },
      take: 5
    });

    // 2. Search Leads
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { buyerName: ciContains(q) },
          { buyerPhone: ciContains(q) },
          { referenceNumber: ciContains(q) },
          { car: { title: ciContains(q) } },
          { id: { startsWith: q } }
        ]
      },
      select: {
        id: true,
        buyerName: true,
        referenceNumber: true,
        status: true,
        type: true,
        car: { select: { title: true } }
      },
      take: 5
    });

    // 3. Search Sell Requests
    const sellRequests = await prisma.sellRequest.findMany({
      where: {
        OR: [
          { name: ciContains(q) },
          { phone: ciContains(q) },
          { carDetails: ciContains(q) },
          { id: { startsWith: q } }
        ]
      },
      select: {
        id: true,
        name: true,
        carDetails: true
      },
      take: 3
    });

    res.json({ cars, leads, sellRequests });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Failed to perform global search" });
  }
};
