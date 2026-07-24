import { Router } from 'express';
import activityLogService from '../services/activityLogService';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All activity routes require super admin access
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN']));

// Get activity logs with filtering
router.get('/', async (req, res) => {
  try {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filters = {
      userId: userId as string,
      entityType: entityType as string,
      entityId: entityId as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    const result = await activityLogService.getActivityLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get activity summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const summary = await activityLogService.getActivitySummary(days);
    res.json(summary);
  } catch (error) {
    console.error('Failed to fetch activity summary:', error);
    res.status(500).json({ error: 'Failed to fetch activity summary' });
  }
});

// Export activity logs to CSV
router.get('/export', async (req, res) => {
  try {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate
    } = req.query;

    const filters = {
      userId: userId as string,
      entityType: entityType as string,
      entityId: entityId as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };

    const csv = await activityLogService.exportToCsv(filters);
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export activity logs:', error);
    res.status(500).json({ error: 'Failed to export activity logs' });
  }
});

export default router;