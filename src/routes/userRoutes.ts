import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import activityLogService from "../services/activityLogService";

const router = Router();

// Get all users (Super Admin only)
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    
    // Only Super Admin can view all users
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Super Admin required.' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    await activityLogService.logFromRequest(req, 'VIEW_USERS', 'User');

    res.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user (Super Admin only)
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    
    // Only Super Admin can create users
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Super Admin required.' });
    }

    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'SELLER', 'MARKET_ATTENDANT', 'CUSTOMER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      // Special Profile Creation
      if (role === 'SELLER') {
        const { phone, district, marketId, sellerType } = req.body;
        await tx.seller.create({
          data: {
            name,
            phone: phone || '0000000000', // Fallback if not provided
            district: district || 'Lilongwe',
            sellerType: sellerType || 'INDIVIDUAL',
            userId: newUser.id,
            sellerStatus: 'APPROVED' // Admin created sellers are auto-approved
          }
        });
      } else if (role === 'MARKET_ATTENDANT') {
        const { phone, marketId } = req.body;
        if (marketId) {
          await tx.marketAttendant.create({
            data: {
              name,
              phone: phone || '0000000000',
              marketId: marketId,
              userId: newUser.id
            }
          });
        }
      }

      return newUser;
    });

    await activityLogService.logFromRequest(
      req, 
      'CREATE_USER', 
      'User', 
      result.id, 
      null, 
      { name, email, role }
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (Super Admin only)
router.put("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    // Only Super Admin can update users
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Super Admin required.' });
    }

    // Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate role if provided
    if (role && !['SUPER_ADMIN', 'SUB_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email is taken by another user
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    await activityLogService.logFromRequest(
      req, 
      'UPDATE_USER', 
      'User', 
      id, 
      { name: existingUser.name, email: existingUser.email, role: existingUser.role },
      { name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Super Admin only)
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { id } = req.params;

    // Only Super Admin can delete users
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Super Admin required.' });
    }

    // Prevent self-deletion
    if (currentUser.userId === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user before deletion for logging
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await prisma.user.delete({
      where: { id }
    });

    await activityLogService.logFromRequest(
      req, 
      'DELETE_USER', 
      'User', 
      id, 
      userToDelete, 
      null
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get current user profile
router.get("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update current user profile
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { name, email, currentPassword, newPassword } = req.body;

    // Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id: currentUser.userId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set new password' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, existingUser.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Check if email is taken by another user
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    await activityLogService.logFromRequest(
      req, 
      'UPDATE_PROFILE', 
      'User', 
      currentUser.userId, 
      { name: existingUser.name, email: existingUser.email },
      { name: updatedUser.name, email: updatedUser.email }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;