import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { getConnection } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
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

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'string.empty': 'Username wajib diisi',
    'any.required': 'Username wajib diisi'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password wajib diisi',
    'any.required': 'Password wajib diisi'
  })
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(100).required().messages({
    'string.empty': 'Username wajib diisi',
    'string.min': 'Username minimal 3 karakter',
    'string.max': 'Username maksimal 100 karakter',
    'any.required': 'Username wajib diisi'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email wajib diisi',
    'string.email': 'Format email tidak valid',
    'any.required': 'Email wajib diisi'
  }),
  password: Joi.string().min(6).required().messages({
    'string.empty': 'Password wajib diisi',
    'string.min': 'Password minimal 6 karakter',
    'any.required': 'Password wajib diisi'
  }),
  fullName: Joi.string().max(255).required().messages({
    'string.empty': 'Nama lengkap wajib diisi',
    'string.max': 'Nama lengkap maksimal 255 karakter',
    'any.required': 'Nama lengkap wajib diisi'
  }),
  role: Joi.string().valid('admin', 'health_worker').default('health_worker')
});

// JWT secret keys
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Helper functions
const generateTokens = (userId: number, username: string, role: string) => {
  const payload = { userId, username, role };

  const accessToken = jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );

  const refreshToken = jwt.sign(
    payload,
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
  );

  // Calculate expiry timestamp for access token
  const decoded = jwt.decode(accessToken) as any;
  const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + (15 * 60 * 1000); // Convert to milliseconds or default to 15 minutes

  return {
    accessToken,
    refreshToken,
    expiresAt
  };
};

// Login endpoint
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { username, password } = value;
  const db = getConnection();

  // Find user by username or email
  const [users] = await db.execute(
    'SELECT id, username, email, password_hash, full_name, role, is_active FROM users WHERE (username = ? OR email = ?) AND is_active = true',
    [username, username]
  );

  const user = (users as any[])[0];
  if (!user) {
    throw new AppError('Username atau password salah', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Username atau password salah', 401);
  }

  // Generate tokens
  const tokens = generateTokens(user.id, user.username, user.role);

  // Log successful login
  logger.info(`User ${user.username} logged in successfully`, {
    userId: user.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Store refresh token in database (optional - for token revocation)
  await db.execute(
    'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [user.id]
  );

  res.json({
    success: true,
    message: 'Login berhasil',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      tokens
    }
  });
}));

// Register endpoint (for admin to create new health workers)
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { username, email, password, fullName, role } = value;
  const db = getConnection();

  // Check if username or email already exists
  const [existingUsers] = await db.execute(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if ((existingUsers as any[]).length > 0) {
    throw new AppError('Username atau email sudah terdaftar', 409);
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Insert new user
  const [result] = await db.execute(
    'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    [username, email, passwordHash, fullName, role]
  );

  const userId = (result as any).insertId;

  // Log user creation
  logger.info(`New user created: ${username}`, {
    userId,
    role,
    createdBy: req.user?.id || 'system'
  });

  res.status(201).json({
    success: true,
    message: 'Pengguna berhasil didaftarkan',
    data: {
      user: {
        id: userId,
        username,
        email,
        fullName,
        role
      }
    }
  });
}));

// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token wajib disediakan', 400);
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const { userId, username, role } = decoded;

    const db = getConnection();

    // Verify user still exists and is active
    const [users] = await db.execute(
      'SELECT id, is_active FROM users WHERE id = ? AND is_active = true',
      [userId]
    );

    const user = (users as any[])[0];
    if (!user) {
      throw new AppError('User tidak ditemukan atau tidak aktif', 401);
    }

    // Generate new tokens
    const tokens = generateTokens(userId, username, role);

    logger.info(`Token refreshed for user ${username}`, {
      userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Token berhasil diperbarui',
      data: { tokens }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Refresh token tidak valid', 401);
    }
    throw error;
  }
}));

// Logout endpoint
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  // In a more sophisticated implementation, you might want to blacklist the token
  // For now, we'll just return success (client should remove token from storage)
  
  logger.info('User logged out', {
    userId: req.user?.id,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logout berhasil'
  });
}));

export default router;