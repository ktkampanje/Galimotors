import prisma from '../lib/prisma';
import { Request } from 'express';

interface LogActivityParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityLogService {
  // Log an activity with full context
  async logActivity(params: LogActivityParams) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
          newValue: params.newValue ? JSON.stringify(params.newValue) : null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  // Log activity from Express request
  async logFromRequest(req: Request, action: string, entityType: string, entityId?: string, oldValue?: any, newValue?: any) {
    const userId = (req as any).user?.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    await this.logActivity({
      userId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
      userAgent
    });
  }

  // Get activity logs with filtering
  async getActivityLogs(filters: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = filters;

    const where: any = {};
    
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.activityLog.count({ where })
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get activity summary for dashboard
  async getActivitySummary(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await prisma.activityLog.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        action: true,
        entityType: true,
        createdAt: true
      }
    });

    // Group by action
    const actionCounts = activities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by entity type
    const entityCounts = activities.reduce((acc, activity) => {
      acc[activity.entityType] = (acc[activity.entityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by day
    const dailyCounts = activities.reduce((acc, activity) => {
      const day = activity.createdAt.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActivities: activities.length,
      actionCounts,
      entityCounts,
      dailyCounts,
      period: `${days} days`
    };
  }

  // Security event logging
  async logSecurityEvent(type: 'LOGIN_FAILED' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY', details: any, req?: Request) {
    const ipAddress = req?.ip || req?.connection.remoteAddress || req?.headers['x-forwarded-for'] as string;
    const userAgent = req?.headers['user-agent'];

    await this.logActivity({
      action: `SECURITY_${type}`,
      entityType: 'SECURITY',
      newValue: details,
      ipAddress,
      userAgent
    });
  }

  // Export logs to CSV format
  async exportToCsv(filters: any): Promise<string> {
    const { logs } = await this.getActivityLogs({ ...filters, limit: 10000 });
    
    const headers = ['Date', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'User Agent'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.createdAt.toISOString(),
        log.userId || '',
        log.action,
        log.entityType,
        log.entityId || '',
        log.ipAddress || '',
        `"${log.userAgent || ''}"` // Wrap in quotes to handle commas
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

export default new ActivityLogService();