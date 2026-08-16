import { Request, Response, NextFunction } from 'express';

let maintenanceMode = false;

export function isMaintenanceMode() {
  return maintenanceMode;
}

export function setMaintenanceMode(value: boolean) {
  maintenanceMode = value;
}

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!maintenanceMode) return next();

  const isAuth = req.path.startsWith('/api/auth');
  const isSuperAdmin = (req as any).userRole === 'superadmin';

  if (isAuth || isSuperAdmin) return next();

  res.status(503).json({
    error: 'System is currently under maintenance. Please try again later.',
    maintenance: true,
  });
}
