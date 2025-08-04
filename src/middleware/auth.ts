import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConnection } from '../config/database';
import { AppError, asyncHandler } from './errorHandler';
import { logger } from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
export const authenticateToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new AppError('Token akses diperlukan', 401);
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { userId, username, role } = decoded;

    // Optional: Verify user still exists and is active in database
    const db = getConnection();
    const [users] = await db.execute(
      'SELECT id, username, role, is_active FROM users WHERE id = ? AND is_active = true',
      [userId]
    );

    const user = (users as any[])[0];
    if (!user) {
      throw new AppError('User tidak ditemukan atau tidak aktif', 401);
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token sudah kadaluarsa', 401);
      } else {
        throw new AppError('Token tidak valid', 401);
      }
    }
    throw error;
  }
});

// Authorization middleware for specific roles
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('User tidak terautentikasi', 401);
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt`, {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      });

      throw new AppError('Akses ditolak. Anda tidak memiliki izin untuk mengakses resource ini', 403);
    }

    next();
  };
};

// Optional middleware to check if user is admin
export const requireAdmin = authorizeRoles('admin');

// Optional middleware to check if user is health worker or admin
export const requireHealthWorker = authorizeRoles('admin', 'health_worker');

// Middleware to extract user info from token without requiring authentication
// Useful for optional authentication scenarios
export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { userId, username, role } = decoded;

      const db = getConnection();
      const [users] = await db.execute(
        'SELECT id, username, role, is_active FROM users WHERE id = ? AND is_active = true',
        [userId]
      );

      const user = (users as any[])[0];
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role
        };
      }
    } catch (error) {
      // Ignore token errors in optional auth
      logger.debug('Optional auth token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  next();
});

// Rate limiting middleware for auth endpoints
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [ip, data] of attempts.entries()) {
      if (now > data.resetTime) {
        attempts.delete(ip);
      }
    }

    const current = attempts.get(key);
    
    if (!current) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > current.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxAttempts) {
      logger.warn(`Rate limit exceeded for IP: ${key}`, {
        ip: key,
        attempts: current.count,
        endpoint: req.path
      });

      throw new AppError('Terlalu banyak percobaan login. Coba lagi dalam 15 menit', 429);
    }

    current.count++;
    next();
  };
};

export default {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireHealthWorker,
  optionalAuth,
  authRateLimit
};