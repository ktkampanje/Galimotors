import prisma from '../lib/prisma';

interface FilterStats {
  condition: Record<string, number>;
  transmission: Record<string, number>;
  fuelType: Record<string, number>;
  year: Record<string, number>;
  priceRanges: {
    under_5m: number;
    '5m_15m': number;
    '15m_30m': number;
    '30m_50m': number;
    above_50m: number;
  };
  yearRanges: {
    '2020_and_newer': number;
    '2015_2019': number;
    '2010_2014': number;
    '2005_2009': number;
    before_2005: number;
  };
  district: Record<string, number>;
}

/**
 * Calculate fresh filter statistics from database
 */
export async function calculateFilterStats(): Promise<FilterStats> {
  const whereClause = {
    status: 'AVAILABLE',
    deletedAt: null
  };

  const [
    conditionStats,
    transmissionStats,
    fuelTypeStats,
    yearStats,
    districtStats,
    priceUnder5M,
    price5M_15M,
    price15M_30M,
    price30M_50M,
    priceAbove50M
  ] = await Promise.all([
    prisma.car.groupBy({ by: ['condition'], where: whereClause, _count: { id: true } }),
    prisma.car.groupBy({ by: ['transmission'], where: whereClause, _count: { id: true } }),
    prisma.car.groupBy({ by: ['fuelType'], where: whereClause, _count: { id: true } }),
    prisma.car.groupBy({ by: ['year'], where: whereClause, _count: { id: true }, orderBy: { year: 'desc' } }),
    prisma.car.groupBy({ by: ['district'], where: whereClause, _count: { id: true } }),
    prisma.car.count({ where: { ...whereClause, basePrice: { lt: 5000000 } } }),
    prisma.car.count({ where: { ...whereClause, basePrice: { gte: 5000000, lt: 15000000 } } }),
    prisma.car.count({ where: { ...whereClause, basePrice: { gte: 15000000, lt: 30000000 } } }),
    prisma.car.count({ where: { ...whereClause, basePrice: { gte: 30000000, lt: 50000000 } } }),
    prisma.car.count({ where: { ...whereClause, basePrice: { gte: 50000000 } } })
  ]);

  // Calculate year ranges
  const year2020AndNewer = yearStats.filter(item => item.year && item.year >= 2020).reduce((sum, item) => sum + item._count.id, 0);
  const year2015_2019 = yearStats.filter(item => item.year && item.year >= 2015 && item.year <= 2019).reduce((sum, item) => sum + item._count.id, 0);
  const year2010_2014 = yearStats.filter(item => item.year && item.year >= 2010 && item.year <= 2014).reduce((sum, item) => sum + item._count.id, 0);
  const year2005_2009 = yearStats.filter(item => item.year && item.year >= 2005 && item.year <= 2009).reduce((sum, item) => sum + item._count.id, 0);
  const yearBefore2005 = yearStats.filter(item => item.year && item.year < 2005).reduce((sum, item) => sum + item._count.id, 0);

  return {
    condition: conditionStats.reduce((acc, item) => {
      if (item.condition) acc[item.condition] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    
    transmission: transmissionStats.reduce((acc, item) => {
      if (item.transmission) acc[item.transmission] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    
    fuelType: fuelTypeStats.reduce((acc, item) => {
      if (item.fuelType) acc[item.fuelType] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    
    year: yearStats.reduce((acc, item) => {
      if (item.year) acc[item.year] = item._count.id;
      return acc;
    }, {} as Record<string, number>),

    priceRanges: {
      under_5m: priceUnder5M,
      '5m_15m': price5M_15M,
      '15m_30m': price15M_30M,
      '30m_50m': price30M_50M,
      above_50m: priceAbove50M
    },

    yearRanges: {
      '2020_and_newer': year2020AndNewer,
      '2015_2019': year2015_2019,
      '2010_2014': year2010_2014,
      '2005_2009': year2005_2009,
      before_2005: yearBefore2005
    },

    district: districtStats.reduce((acc, item) => {
      if (item.district) acc[item.district] = item._count.id;
      return acc;
    }, {} as Record<string, number>)
  };
}

/**
 * Update the cached filter statistics in database
 */
export async function updateFilterStatsCache(): Promise<FilterStats> {
  const stats = await calculateFilterStats();
  
  await prisma.filterStatsCache.upsert({
    where: { id: 'STATS_SINGLETON' },
    update: {
      stats: JSON.stringify(stats),
      updatedAt: new Date()
    },
    create: {
      id: 'STATS_SINGLETON',
      stats: JSON.stringify(stats),
      updatedAt: new Date()
    }
  });

  return stats;
}

/**
 * Get cached filter statistics (or calculate if not cached)
 */
export async function getFilterStatsFromCache(): Promise<FilterStats> {
  try {
    const cached = await prisma.filterStatsCache.findUnique({
      where: { id: 'STATS_SINGLETON' }
    });

    if (cached) {
      return JSON.parse(cached.stats);
    }

    // No cache exists, calculate and store
    return await updateFilterStatsCache();
  } catch (error) {
    console.error('Error getting cached filter stats, calculating fresh:', error);
    // Fallback to fresh calculation if cache fails
    return await calculateFilterStats();
  }
}

/**
 * Invalidate cache - call this after car CRUD operations
 */
export async function invalidateFilterStatsCache(): Promise<void> {
  try {
    await updateFilterStatsCache();
    console.log('✅ Filter stats cache updated');
  } catch (error) {
    console.error('❌ Failed to update filter stats cache:', error);
  }
}
