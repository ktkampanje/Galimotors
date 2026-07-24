// Smart Search Ranking Algorithm Service
import prisma from '../lib/prisma';

interface SearchCriteria {
  makerId?: string;
  modelId?: string;
  bodyTypeId?: string;
  minPrice?: number;
  maxPrice?: number;
  fuelType?: string;
  transmission?: string;
  district?: string;
  search?: string;
  condition?: string;
}

interface MarketData {
  averageViews: number;
  averageInquiries: number;
  averagePrice: number;
  totalCars: number;
}

export class SearchRankingService {
  
  // Calculate relevance score for a car based on search criteria
  calculateRelevanceScore(car: any, searchCriteria: SearchCriteria, marketData: MarketData): number {
    let score = 0;

    // Category Ranking Boosts (up to 10 points)
    if (car.categories && car.categories.length > 0) {
      const totalCategoryBoost = car.categories.reduce((sum: number, cc: any) => sum + (cc.category?.rankBoost || 0), 0);
      score += Math.min(10, totalCategoryBoost);
    }

    // Intent Matching (40 points max)
    if (searchCriteria.makerId && car.makerId === searchCriteria.makerId) {
      score += 40;
    }

    if (searchCriteria.modelId && car.modelId === searchCriteria.modelId) {
      score += 35;
    }

    if (searchCriteria.bodyTypeId && car.bodyTypeId === searchCriteria.bodyTypeId) {
      score += 30;
    }
    
    // Price range matching
    if (searchCriteria.minPrice && searchCriteria.maxPrice) {
      if (car.basePrice >= searchCriteria.minPrice && car.basePrice <= searchCriteria.maxPrice) {
        score += 25;
      }
    }
    
    if (searchCriteria.fuelType && car.fuelType === searchCriteria.fuelType) {
      score += 20;
    }
    
    if (searchCriteria.transmission && car.transmission === searchCriteria.transmission) {
      score += 15;
    }

    // Text search matching
    if (searchCriteria.search) {
      const searchTerm = searchCriteria.search.toLowerCase();
      const carText = `${car.title} ${car.maker?.name} ${car.model?.name}`.toLowerCase();
      if (carText.includes(searchTerm)) {
        score += 30;
      }
    }

    // Car Quality Score (30 points max)
    
    // Image quality
    const imageCount = car.images?.length || 0;
    if (imageCount >= 5) score += 15;
    else if (imageCount >= 3) score += 10;
    else if (imageCount >= 1) score += 5;
    
    // Verification badges
    if (car.platformInspectedBadge) score += 10;
    if (car.logbookAvailable) score += 3;
    if (car.dutyPaid) score += 3;
    if (car.registered) score += 3;
    
    // Description quality (assuming title length indicates description quality)
    if (car.title && car.title.length > 30) score += 6;

    // Seller Reputation (25 points max)
    if (car.seller?.verifiedByPlatform) score += 15;
    
    // Market Performance (20 points max)
    if (car.viewsCount > marketData.averageViews) {
      const viewBoost = Math.min(10, (car.viewsCount / marketData.averageViews) * 5);
      score += viewBoost;
    }
    
    if (car.inquiriesCount > marketData.averageInquiries) {
      const inquiryBoost = Math.min(10, (car.inquiriesCount / marketData.averageInquiries) * 5);
      score += inquiryBoost;
    }

    // Price Competitiveness (15 points max)
    const priceRatio = car.basePrice / marketData.averagePrice;
    if (priceRatio < 0.9) { // 10% below average = good deal
      score += 15;
    } else if (priceRatio < 1.1) { // Within 10% of average
      score += 10;
    } else if (priceRatio < 1.3) { // Within 30% of average
      score += 5;
    }

    // Recency Boost (10 points max)
    const daysSinceCreated = (Date.now() - new Date(car.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 7) score += 10;
    else if (daysSinceCreated <= 30) score += 5;
    else if (daysSinceCreated <= 90) score += 2;

    // Featured Status (5 points max)
    if (car.isFeatured) score += 5;
    
    // Urgent sale badge (slight boost for urgency)
    if (car.urgentSaleBadge) score += 3;

    return Math.round(score);
  }

  // Get market data for scoring calculations
  async getMarketData(searchCriteria: SearchCriteria): Promise<MarketData> {
    try {
      // Build where clause for market analysis
      const where: any = {
        status: 'AVAILABLE',
        deletedAt: null
      };

      // Apply filters to get relevant market segment
      if (searchCriteria.makerId) where.makerId = searchCriteria.makerId;
      if (searchCriteria.bodyTypeId) where.bodyTypeId = searchCriteria.bodyTypeId;
      if (searchCriteria.condition) where.condition = searchCriteria.condition;
      if (searchCriteria.minPrice || searchCriteria.maxPrice) {
        where.basePrice = {};
        if (searchCriteria.minPrice) where.basePrice.gte = searchCriteria.minPrice;
        if (searchCriteria.maxPrice) where.basePrice.lte = searchCriteria.maxPrice;
      }

      const marketStats = await prisma.car.aggregate({
        where,
        _avg: {
          viewsCount: true,
          inquiriesCount: true,
          basePrice: true
        },
        _count: {
          id: true
        }
      });

      return {
        averageViews: marketStats._avg.viewsCount || 0,
        averageInquiries: marketStats._avg.inquiriesCount || 0,
        averagePrice: marketStats._avg.basePrice || 0,
        totalCars: marketStats._count.id || 0
      };
    } catch (error) {
      console.error('Failed to get market data:', error);
      // Return default values if market data fails
      return {
        averageViews: 10,
        averageInquiries: 2,
        averagePrice: 2000000,
        totalCars: 100
      };
    }
  }

  // Get smart-ranked cars based on search criteria
  async getSmartRankedCars(searchCriteria: SearchCriteria, page: number = 1, limit: number = 20) {
    try {
      // Get market data for scoring
      const marketData = await this.getMarketData(searchCriteria);

      // Build where clause for car search
      const where: any = {
        status: 'AVAILABLE',
        deletedAt: null
      };

      if (searchCriteria.makerId) where.makerId = searchCriteria.makerId;
      if (searchCriteria.modelId) where.modelId = searchCriteria.modelId;
      if (searchCriteria.bodyTypeId) where.bodyTypeId = searchCriteria.bodyTypeId;
      if (searchCriteria.fuelType) where.fuelType = searchCriteria.fuelType;
      if (searchCriteria.transmission) where.transmission = searchCriteria.transmission;
      if (searchCriteria.district) where.district = searchCriteria.district;
      if (searchCriteria.condition) where.condition = searchCriteria.condition;

      if (searchCriteria.minPrice || searchCriteria.maxPrice) {
        where.basePrice = {};
        if (searchCriteria.minPrice) where.basePrice.gte = searchCriteria.minPrice;
        if (searchCriteria.maxPrice) where.basePrice.lte = searchCriteria.maxPrice;
      }

      if (searchCriteria.search) {
        where.OR = [
          { title: { contains: searchCriteria.search } },
          { maker: { name: { contains: searchCriteria.search } } },
          { model: { name: { contains: searchCriteria.search } } }
        ];
      }

      // Get cars with all necessary data
      const cars = await prisma.car.findMany({
        where,
        include: {
          maker: true,
          model: true,
          bodyType: true,
          images: true,
          categories: {
            include: { category: true }
          },
          seller: { select: { name: true, district: true, verifiedByPlatform: true } }
        },
        take: limit * 3 // Get more cars to allow for proper ranking
      });

      // Calculate relevance scores for all cars
      const scoredCars = cars.map(car => ({
        ...car,
        relevanceScore: this.calculateRelevanceScore(car, searchCriteria, marketData)
      }));

      // Sort by relevance score (highest first)
      const rankedCars = scoredCars.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply pagination
      const skip = (page - 1) * limit;
      const paginatedCars = rankedCars.slice(skip, skip + limit);

      // Get total count for pagination
      const total = await prisma.car.count({ where });

      return {
        cars: paginatedCars,
        marketData,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        rankingInfo: {
          totalScored: scoredCars.length,
          averageScore: scoredCars.reduce((sum, car) => sum + car.relevanceScore, 0) / scoredCars.length,
          topScore: rankedCars[0]?.relevanceScore || 0
        }
      };
    } catch (error) {
      console.error('Smart ranking failed:', error);
      throw error;
    }
  }

  // Get ranking explanation for a specific car
  getScoreBreakdown(car: any, searchCriteria: SearchCriteria, marketData: MarketData) {
    const breakdown = {
      intentMatching: 0,
      carQuality: 0,
      sellerReputation: 0,
      marketPerformance: 0,
      priceCompetitiveness: 0,
      recencyBoost: 0,
      featuredStatus: 0,
      total: 0
    };

    // Intent matching breakdown
    if (searchCriteria.makerId && car.makerId === searchCriteria.makerId) breakdown.intentMatching += 40;
    if (searchCriteria.modelId && car.modelId === searchCriteria.modelId) breakdown.intentMatching += 35;
    if (searchCriteria.bodyTypeId && car.bodyTypeId === searchCriteria.bodyTypeId) breakdown.intentMatching += 30;

    // Car quality breakdown
    const imageCount = car.images?.length || 0;
    if (imageCount >= 5) breakdown.carQuality += 15;
    if (car.platformInspectedBadge) breakdown.carQuality += 10;

    // Seller reputation
    if (car.seller?.verifiedByPlatform) breakdown.sellerReputation += 15;

    // Market performance
    if (car.viewsCount > marketData.averageViews) {
      breakdown.marketPerformance += Math.min(10, (car.viewsCount / marketData.averageViews) * 5);
    }

    // Price competitiveness
    const priceRatio = car.basePrice / marketData.averagePrice;
    if (priceRatio < 0.9) breakdown.priceCompetitiveness += 15;

    // Recency boost
    const daysSinceCreated = (Date.now() - new Date(car.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 7) breakdown.recencyBoost += 10;

    // Featured status
    if (car.isFeatured) breakdown.featuredStatus += 5;

    breakdown.total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

    return breakdown;
  }
}

export default new SearchRankingService();