import { Request, Response, NextFunction } from 'express';
import activityLogService from '../services/activityLogService';

// Middleware to automatically log API activities
export const logActivity = (entityType: string, action?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Determine action from HTTP method if not provided
      const logAction = action || getActionFromMethod(req.method);
      
      // Extract entity ID from params or response
      const entityId = req.params.id || body?.id;
      
      // Log the activity asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await activityLogService.logFromRequest(
            req,
            logAction,
            entityType,
            entityId,
            req.method === 'PUT' ? req.body : undefined, // Old value for updates
            req.method !== 'DELETE' ? body : undefined   // New value for creates/updates
          );
        } catch (error) {
          console.error('Activity logging failed:', error);
        }
      });
      
      // Call original json method
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Helper function to determine action from HTTP method
function getActionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST': return 'CREATE';
    case 'PUT': return 'UPDATE';
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    case 'GET': return 'VIEW';
    default: return 'ACTION';
  }
}

// Middleware for login attempts
export const logLoginAttempt = async (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(body: any) {
    setImmediate(async () => {
      const success = res.statusCode === 200;
      const action = success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED';
      
      await activityLogService.logFromRequest(
        req,
        action,
        'AUTH',
        req.body.email,
        undefined,
        { email: req.body.email, success }
      );
    });
    
    return originalJson.call(this, body);
  };
  
  next();
};

// Middleware for security events
export const logSecurityEvent = (eventType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await activityLogService.logSecurityEvent(
      eventType as any,
      {
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query
      },
      req
    );
    next();
  };
};