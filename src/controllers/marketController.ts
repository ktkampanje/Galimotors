import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getMarkets = async (req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { sellers: true, attendants: true, cars: true }
        }
      }
    });
    res.json(markets);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch markets" });
  }
};

export const createMarket = async (req: Request, res: Response) => {
  try {
    const { name, district, description } = req.body;
    const market = await prisma.market.create({
      data: { name, district, description },
    });
    res.status(201).json(market);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "A market with this name already exists." });
    }
    res.status(500).json({ message: "Failed to create market" });
  }
};

export const updateMarket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, district, description } = req.body;
    const market = await prisma.market.update({
      where: { id },
      data: { name, district, description },
    });
    res.json(market);
  } catch (error) {
    res.status(500).json({ message: "Failed to update market" });
  }
};

export const deleteMarket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.market.delete({ where: { id } });
    res.json({ message: "Market deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete market" });
  }
};
