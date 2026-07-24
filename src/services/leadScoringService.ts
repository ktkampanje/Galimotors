// Lead Scoring Algorithm Service
import prisma from '../lib/prisma';
import { validateMalawianPhone } from '../middleware/sanitize';

interface LeadScoringFactors {
  inquiryQuality: number;
  customerProfile: number;
  carMatchScore: number;
  timingFactors: number;
  engagementLevel: number;
  totalScore: number;
}

export class LeadScoringService {

  // Calculate lead quality score
  async calculateLeadScore(leadId: string): Promise<{ score: number; factors: LeadScoringFactors; priority: string }> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          car: {
            include: {
              maker: true,
              model: true,
              bodyType: true
            }
          }
        }
      });

      if (!lead) {
        throw new Error('Lead not found');
      }

      const factors: LeadScoringFactors = {
        inquiryQuality: 0,
        customerProfile: 0,
        carMatchScore: 0,
        timingFactors: 0,
        engagementLevel: 0,
        totalScore: 0
      };

      // 1. Inquiry Quality Analysis (30 points max)
      factors.inquiryQuality = await this.analyzeInquiryQuality(lead);

      // 2. Customer Profile Analysis (25 points max)
      factors.customerProfile = await this.analyzeCustomerProfile(lead);

      // 3. Car Match Score (20 points max)
      factors.carMatchScore = await this.analyzeCarMatch(lead);

      // 4. Timing Factors (15 points max)
      factors.timingFactors = this.analyzeTimingFactors(lead);

      // 5. Engagement Level (10 points max)
      factors.engagementLevel = await this.analyzeEngagementLevel(lead);

      // Calculate total score
      factors.totalScore = Math.round(
        factors.inquiryQuality + 
        factors.customerProfile + 
        factors.carMatchScore + 
        factors.timingFactors + 
        factors.engagementLevel
      );

      // Determine priority level
      let priority = 'LOW';
      if (factors.totalScore >= 80) priority = 'CRITICAL';
      else if (factors.totalScore >= 60) priority = 'HIGH';
      else if (factors.totalScore >= 40) priority = 'MEDIUM';

      return {
        score: factors.totalScore,
        factors,
        priority
      };
    } catch (error) {
      console.error('Lead scoring error:', error);
      throw error;
    }
  }

  // Analyze inquiry quality
  private async analyzeInquiryQuality(lead: any): Promise<number> {
    let score = 0;

    // Message length and content quality
    if (lead.message) {
      const messageLength = lead.message.length;
      
      // Longer messages indicate more serious interest
      if (messageLength > 100) score += 10;
      else if (messageLength > 50) score += 7;
      else if (messageLength > 20) score += 4;

      // Check for specific keywords indicating serious intent
      const seriousKeywords = [
        'viewing', 'test drive', 'inspection', 'purchase', 'buy', 'financing',
        'loan', 'cash', 'when can i', 'available', 'negotiate', 'final price'
      ];

      const messageText = lead.message.toLowerCase();
      const keywordMatches = seriousKeywords.filter(keyword => 
        messageText.includes(keyword)
      ).length;

      score += Math.min(15, keywordMatches * 3); // Max 15 points for keywords

      // Check for questions (indicates engagement)
      const questionMarks = (lead.message.match(/\?/g) || []).length;
      score += Math.min(5, questionMarks * 2); // Max 5 points for questions
    }

    return Math.min(30, score);
  }

  // Analyze customer profile
  private async analyzeCustomerProfile(lead: any): Promise<number> {
    let score = 0;

    // Phone number format (Malawian numbers indicate local customers)
    if (validateMalawianPhone(lead.buyerPhone)) {
      score += 10; // Valid local number
    }

    // Check customer history
    const customerHistory = await prisma.lead.findMany({
      where: {
        buyerPhone: lead.buyerPhone,
        id: { not: lead.id }
      }
    });

    if (customerHistory.length === 0) {
      // First-time inquirer - often more serious
      score += 10;
    } else if (customerHistory.length <= 2) {
      // Limited history - still good
      score += 5;
    } else {
      // Many inquiries might indicate browsing without buying intent
      score += 2;
    }

    // Email provided (indicates more serious customer)
    if (lead.buyerEmail && lead.buyerEmail.includes('@')) {
      score += 5;
    }

    return Math.min(25, score);
  }

  // Analyze car match with customer profile
  private async analyzeCarMatch(lead: any): Promise<number> {
    let score = 0;

    const car = lead.car;
    
    // Price range analysis
    if (car.basePrice < 2000000) {
      score += 15; // More affordable cars have higher conversion
    } else if (car.basePrice < 5000000) {
      score += 10; // Mid-range cars
    } else {
      score += 5; // Luxury cars (lower conversion but higher value)
    }

    // Popular car types (higher conversion probability)
    const popularMakers = ['Toyota', 'Honda', 'Nissan', 'Mazda'];
    if (popularMakers.includes(car.maker?.name)) {
      score += 3;
    }

    // Car condition indicators
    if (car.platformInspectedBadge) score += 2;
    if (car.logbookAvailable) score += 1;

    return Math.min(20, score);
  }

  // Analyze timing factors
  private analyzeTimingFactors(lead: any): number {
    let score = 0;

    const inquiryTime = new Date(lead.createdAt);
    const hour = inquiryTime.getHours();
    const dayOfWeek = inquiryTime.getDay();

    // Business hours inquiries (more serious)
    if (hour >= 8 && hour <= 18) {
      score += 8;
    } else if (hour >= 19 && hour <= 21) {
      score += 5; // Evening inquiries still good
    } else {
      score += 2; // Late night/early morning less serious
    }

    // Weekday vs weekend
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      score += 5; // Weekday inquiries often more serious
    } else {
      score += 3; // Weekend browsing
    }

    // Urgency indicators
    if (lead.car.urgentSaleBadge) {
      score += 2; // Urgent sales create urgency in buyers
    }

    return Math.min(15, score);
  }

  // Analyze engagement level (would need session tracking in real implementation)
  private async analyzeEngagementLevel(lead: any): Promise<number> {
    let score = 0;

    // For now, use available data
    // In a full implementation, you'd track:
    // - Time spent on car page
    // - Number of images viewed
    // - Other cars viewed in session
    // - Return visits

    // Lead type analysis
    if (lead.type === 'PAID_VIEWING_REQUEST') {
      score += 8; // Willing to pay for viewing = high intent
    } else if (lead.type === 'PAID_RESERVATION') {
      score += 10; // Highest intent
    } else {
      score += 3; // Basic inquiry
    }

    // Car popularity (high-demand cars get more inquiries)
    if (lead.car.viewsCount > 20) {
      score += 2; // Popular car, customer acted quickly
    }

    return Math.min(10, score);
  }

  // Get prioritized leads for admin dashboard
  async getPrioritizedLeads(limit: number = 50) {
    try {
      // Get recent leads
      const leads = await prisma.lead.findMany({
        where: {
          status: { in: ['NEW', 'CONTACTED'] }
        },
        include: {
          car: {
            include: {
              maker: true,
              model: true,
              bodyType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2 // Get more to allow for scoring and sorting
      });

      // Score all leads
      const scoredLeads = await Promise.all(
        leads.map(async (lead) => {
          const scoring = await this.calculateLeadScore(lead.id);
          return {
            ...lead,
            leadScore: scoring.score,
            leadPriority: scoring.priority,
            scoringFactors: scoring.factors
          };
        })
      );

      // Sort by score (highest first) and take requested limit
      const prioritizedLeads = scoredLeads
        .sort((a, b) => b.leadScore - a.leadScore)
        .slice(0, limit);

      return {
        leads: prioritizedLeads,
        summary: {
          total: prioritizedLeads.length,
          critical: prioritizedLeads.filter(l => l.leadPriority === 'CRITICAL').length,
          high: prioritizedLeads.filter(l => l.leadPriority === 'HIGH').length,
          medium: prioritizedLeads.filter(l => l.leadPriority === 'MEDIUM').length,
          low: prioritizedLeads.filter(l => l.leadPriority === 'LOW').length,
          averageScore: Math.round(
            prioritizedLeads.reduce((sum, lead) => sum + lead.leadScore, 0) / prioritizedLeads.length
          )
        }
      };
    } catch (error) {
      console.error('Failed to get prioritized leads:', error);
      throw error;
    }
  }

  // Update lead score when lead data changes
  async updateLeadScore(leadId: string) {
    try {
      const scoring = await this.calculateLeadScore(leadId);
      
      // Store the score in the database (you might want to add a leadScore field to the Lead model)
      // For now, we'll just return the score
      return scoring;
    } catch (error) {
      console.error('Failed to update lead score:', error);
      throw error;
    }
  }

  // Get lead scoring insights for admin
  async getLeadScoringInsights() {
    try {
      // Get recent leads for analysis
      const recentLeads = await prisma.lead.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        include: {
          car: {
            include: {
              maker: true,
              model: true
            }
          }
        }
      });

      // Score all recent leads
      const scoredLeads = await Promise.all(
        recentLeads.map(async (lead) => {
          const scoring = await this.calculateLeadScore(lead.id);
          return { ...lead, scoring };
        })
      );

      // Generate insights
      const insights = {
        totalLeads: scoredLeads.length,
        averageScore: Math.round(
          scoredLeads.reduce((sum, lead) => sum + lead.scoring.score, 0) / scoredLeads.length
        ),
        scoreDistribution: {
          critical: scoredLeads.filter(l => l.scoring.score >= 80).length,
          high: scoredLeads.filter(l => l.scoring.score >= 60 && l.scoring.score < 80).length,
          medium: scoredLeads.filter(l => l.scoring.score >= 40 && l.scoring.score < 60).length,
          low: scoredLeads.filter(l => l.scoring.score < 40).length
        },
        topPerformingCars: this.getTopPerformingCars(scoredLeads),
        conversionPredictions: this.generateConversionPredictions(scoredLeads)
      };

      return insights;
    } catch (error) {
      console.error('Failed to get lead scoring insights:', error);
      throw error;
    }
  }

  // Helper: Get cars that generate highest-quality leads
  private getTopPerformingCars(scoredLeads: any[]) {
    const carPerformance = scoredLeads.reduce((acc, lead) => {
      const carId = lead.car.id;
      if (!acc[carId]) {
        acc[carId] = {
          car: lead.car,
          leadCount: 0,
          totalScore: 0,
          averageScore: 0
        };
      }
      acc[carId].leadCount++;
      acc[carId].totalScore += lead.scoring.score;
      acc[carId].averageScore = Math.round(acc[carId].totalScore / acc[carId].leadCount);
      return acc;
    }, {});

    return Object.values(carPerformance)
      .sort((a: any, b: any) => b.averageScore - a.averageScore)
      .slice(0, 10);
  }

  // Helper: Generate conversion predictions
  private generateConversionPredictions(scoredLeads: any[]) {
    const highQualityLeads = scoredLeads.filter(l => l.scoring.score >= 60);
    const mediumQualityLeads = scoredLeads.filter(l => l.scoring.score >= 40 && l.scoring.score < 60);
    const lowQualityLeads = scoredLeads.filter(l => l.scoring.score < 40);

    return {
      highQuality: {
        count: highQualityLeads.length,
        predictedConversionRate: '65%',
        estimatedSales: Math.round(highQualityLeads.length * 0.65)
      },
      mediumQuality: {
        count: mediumQualityLeads.length,
        predictedConversionRate: '35%',
        estimatedSales: Math.round(mediumQualityLeads.length * 0.35)
      },
      lowQuality: {
        count: lowQualityLeads.length,
        predictedConversionRate: '15%',
        estimatedSales: Math.round(lowQualityLeads.length * 0.15)
      }
    };
  }
}

export default new LeadScoringService();