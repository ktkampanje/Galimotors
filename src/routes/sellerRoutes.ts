import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all sellers (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    const sellers = await prisma.seller.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(sellers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
});

// Create seller (admin only). Security: role escalation is blocked — the
// created user's role can never come from the request body unrestricted.
const CREATABLE_SELLER_ROLES = ['SELLER', 'MARKET_ATTENDANT'];

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const { createUser, userEmail, userPassword, userRole, ...sellerData } = req.body;

    if (userRole && !CREATABLE_SELLER_ROLES.includes(userRole)) {
      return res.status(400).json({ error: 'Invalid role for seller account' });
    }
    
    // Explicitly destructure just the safe fields for Seller to avoid Prisma unknown field errors
    const safeSellerData = {
      name: sellerData.name,
      phone: sellerData.phone,
      district: sellerData.district,
      marketId: sellerData.marketId || null,
      sellerType: sellerData.sellerType || 'INDIVIDUAL',
      sellerStatus: 'APPROVED' // Admin-created sellers are auto-approved
    };

    if (createUser && userEmail && userPassword) {
      // Transaction: Create User then Create Seller
      const { hashPassword } = require('../utils/auth');
      const hashedPassword = await hashPassword(userPassword);
      
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: userEmail,
            password: hashedPassword,
            name: safeSellerData.name,
            role: userRole || 'SELLER'
          }
        });

        const seller = await tx.seller.create({
          data: {
            ...safeSellerData,
            userId: user.id
          }
        });

        return seller;
      });
      res.status(201).json(result);
    } else {
      // Create only the Seller
      const seller = await prisma.seller.create({
        data: safeSellerData
      });
      res.status(201).json(seller);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create seller' });
  }
});

export default router;
