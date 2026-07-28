import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * Seller directory, scoped by who is asking:
 *  - SUPER_ADMIN / SUB_ADMIN: everyone.
 *  - MARKET_ATTENDANT: only sellers registered under their market (that's
 *    the pool they can list cars for).
 *  - SELLER: only their own profile — other sellers' names and phone
 *    numbers are not theirs to browse.
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let where: any = undefined;

    if (user.role === 'SELLER') {
      where = { userId: user.userId };
    } else if (user.role === 'MARKET_ATTENDANT') {
      const attendant = await prisma.marketAttendant.findUnique({
        where: { userId: user.userId },
        select: { marketId: true },
      });
      where = attendant ? { marketId: attendant.marketId } : { id: 'none' };
    }

    const sellers = await prisma.seller.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(sellers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
});

// Create seller. Admins can create anywhere; a market attendant can register
// a seller ONLY into their own market (the market comes from their profile,
// never the request). Security: role escalation is blocked — the optional
// login's role can never come from the request body unrestricted.
const CREATABLE_SELLER_ROLES = ['SELLER', 'MARKET_ATTENDANT'];

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'SUB_ADMIN', 'MARKET_ATTENDANT']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
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
      sellerStatus: 'APPROVED' // Staff-created sellers are auto-approved
    };

    let allowLoginCreation = true;
    if (user.role === 'MARKET_ATTENDANT') {
      const attendant = await prisma.marketAttendant.findUnique({
        where: { userId: user.userId },
        select: { marketId: true },
      });
      if (!attendant) {
        return res.status(403).json({ error: 'Your login has no attendant profile linked.' });
      }
      safeSellerData.marketId = attendant.marketId;
      // Handing out logins stays an admin power.
      allowLoginCreation = false;
    }

    if (allowLoginCreation && createUser && userEmail && userPassword) {
      // Transaction: Create User then Create Seller
      const { hashPassword } = require('../utils/auth');
      const hashedPassword = await hashPassword(userPassword);

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
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
            userId: newUser.id
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
