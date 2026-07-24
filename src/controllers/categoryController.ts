import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /categories - Get all categories with counts
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        cars: { select: { carId: true } },
      },
    });
    // Add carCount to each category
    const result = categories.map(cat => ({
      ...cat,
      carCount: cat.cars.length,
    }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// GET /categories/:id - Get single category with cars
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        cars: {
          include: { car: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

// POST /categories - Create new category (admin only)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, emoji, color, bgColor, rankBoost, sortOrder } = req.body;

    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check for duplicate slug
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ error: 'Category name already exists' });

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || undefined,
        emoji: emoji || '•',
        color: color || '#13293D',
        bgColor: bgColor || '#E8EEF4',
        rankBoost: rankBoost || 0,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

// PATCH /categories/:id - Update category (admin only)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, emoji, color, bgColor, rankBoost, sortOrder } = req.body;

    // Check if category exists
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    // If name changed, regenerate slug and check for duplicates
    let slug = existing.slug;
    if (name && name !== existing.name) {
      slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const duplicate = await prisma.category.findFirst({
        where: { slug, id: { not: id } },
      });
      if (duplicate) return res.status(409).json({ error: 'Category name already exists' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name || existing.name,
        slug,
        description: description !== undefined ? description : existing.description,
        emoji: emoji || existing.emoji,
        color: color || existing.color,
        bgColor: bgColor || existing.bgColor,
        rankBoost: rankBoost !== undefined ? rankBoost : existing.rankBoost,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// DELETE /categories/:id - Delete category (admin only)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// PATCH /categories/:id/reorder - Bulk reorder categories (admin only)
export const reorderCategories = async (req: Request, res: Response) => {
  try {
    const { order } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array' });

    // Update all categories atomically
    await Promise.all(
      order.map(({ id, sortOrder }) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      )
    );

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
};

// POST /cars/:id/categories - Add category to car (admin only)
export const addCategoryToCar = async (req: Request, res: Response) => {
  try {
    const { id: carId } = req.params;
    const { categoryId } = req.body;

    if (!categoryId) return res.status(400).json({ error: 'Category ID is required' });

    // Check if car exists
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return res.status(404).json({ error: 'Car not found' });

    // Check if category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Check if already assigned
    const existing = await prisma.carCategory.findUnique({
      where: { carId_categoryId: { carId, categoryId } },
    });
    if (existing) return res.status(409).json({ error: 'Category already assigned to car' });

    await prisma.carCategory.create({
      data: {
        carId,
        categoryId,
        assignedBy: (req as any).user?.userId,
      },
    });

    // Return updated car with categories
    const updated = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        categories: {
          include: { category: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    res.status(201).json(updated);
  } catch (error) {
    console.error('Error adding category to car:', error);
    res.status(500).json({ error: 'Failed to add category to car' });
  }
};

// DELETE /cars/:id/categories/:categoryId - Remove category from car (admin only)
export const removeCategoryFromCar = async (req: Request, res: Response) => {
  try {
    const { id: carId, categoryId } = req.params;

    const carCategory = await prisma.carCategory.findUnique({
      where: { carId_categoryId: { carId, categoryId } },
    });
    if (!carCategory) return res.status(404).json({ error: 'Category not assigned to car' });

    await prisma.carCategory.delete({
      where: { carId_categoryId: { carId, categoryId } },
    });

    // Return updated car
    const updated = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        categories: {
          include: { category: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error removing category from car:', error);
    res.status(500).json({ error: 'Failed to remove category from car' });
  }
};

// POST /categories/seed - Seed default categories (admin only, runs once)
export const seedCategories = async (req: Request, res: Response) => {
  try {
    // Check if categories already exist
    const count = await prisma.category.count();
    if (count > 0) return res.status(409).json({ error: 'Categories already seeded' });

    const defaultCategories = [
      {
        name: 'Verified',
        description: 'Verified by our team - trusted quality',
        emoji: '✓',
        color: '#1E7B4F',
        bgColor: '#E7F2EB',
        rankBoost: 10,
        sortOrder: 1,
      },
      {
        name: 'Best Seller',
        description: 'Most popular vehicle in its category',
        emoji: '🏆',
        color: '#D9A404',
        bgColor: '#FAF1DA',
        rankBoost: 5,
        sortOrder: 2,
      },
      {
        name: 'New Arrival',
        description: 'Recently added to inventory',
        emoji: '🆕',
        color: '#1C5D99',
        bgColor: '#E8F0F8',
        rankBoost: 3,
        sortOrder: 3,
      },
      {
        name: 'Limited Stock',
        description: 'Only a few units available',
        emoji: '⏰',
        color: '#B45309',
        bgColor: '#FBEFE0',
        rankBoost: 7,
        sortOrder: 4,
      },
      {
        name: 'Urgent Sale',
        description: 'Must sell - special pricing available',
        emoji: '⚡',
        color: '#B42318',
        bgColor: '#FBECEA',
        rankBoost: 2,
        sortOrder: 5,
      },
    ];

    const created = await Promise.all(
      defaultCategories.map((cat) =>
        prisma.category.create({
          data: {
            ...cat,
            slug: cat.name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, ''),
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Error seeding categories:', error);
    res.status(500).json({ error: 'Failed to seed categories' });
  }
};
