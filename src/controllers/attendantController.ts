import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAttendants = async (req: Request, res: Response) => {
  try {
    const attendants = await prisma.marketAttendant.findMany({
      orderBy: { name: 'asc' },
      include: {
        market: { select: { id: true, name: true, district: true } },
        seller: { select: { id: true, name: true } }
      }
    });
    res.json(attendants);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendants" });
  }
};

export const createAttendant = async (req: Request, res: Response) => {
  try {
    const { createUser, userEmail, userPassword, userRole, name, phone, marketId, sellerId } = req.body;
    
    if (createUser && userEmail && userPassword) {
      const { hashPassword } = require('../utils/auth');
      const hashedPassword = await hashPassword(userPassword);
      
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: userEmail,
            password: hashedPassword,
            name: name,
            role: userRole || 'MARKET_ATTENDANT'
          }
        });

        const attendant = await tx.marketAttendant.create({
          data: { name, phone, marketId, sellerId: sellerId || null, userId: user.id },
          include: {
            market: { select: { id: true, name: true, district: true } },
            seller: { select: { id: true, name: true } }
          }
        });
        
        return attendant;
      });
      res.status(201).json(result);
    } else {
      const attendant = await prisma.marketAttendant.create({
        data: { name, phone, marketId, sellerId: sellerId || null },
        include: {
          market: { select: { id: true, name: true, district: true } },
          seller: { select: { id: true, name: true } }
        }
      });
      res.status(201).json(attendant);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to create attendant" });
  }
};

export const updateAttendant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, marketId, sellerId } = req.body;
    const attendant = await prisma.marketAttendant.update({
      where: { id },
      data: { name, phone, marketId, sellerId: sellerId || null },
      include: {
        market: { select: { id: true, name: true, district: true } },
        seller: { select: { id: true, name: true } }
      }
    });
    res.json(attendant);
  } catch (error) {
    res.status(500).json({ message: "Failed to update attendant" });
  }
};

export const deleteAttendant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.marketAttendant.delete({ where: { id } });
    res.json({ message: "Attendant deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete attendant" });
  }
};
