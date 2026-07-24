import { Request, Response } from 'express';
import { getFilterStatsFromCache } from '../services/filterStatsCacheService';

export const getFilterStats = async (req: Request, res: Response) => {
  try {
    // Get stats from cache (instant response)
    const stats = await getFilterStatsFromCache();
    res.json(stats);
  } catch (error) {
    console.error('Failed to fetch filter stats:', error);
    res.status(500).json({ message: 'Failed to fetch filter statistics' });
  }
};
