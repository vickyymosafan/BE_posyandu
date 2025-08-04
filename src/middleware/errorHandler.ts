import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode = 500, message } = err;

  // Log error details
  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  // Handle specific error types
  let errorMessage = message;
  let errorStatusCode = statusCode;

  // MySQL errors
  if (err.message.includes('ER_DUP_ENTRY')) {
    errorStatusCode = 409;
    if (err.message.includes('qr_code')) {
      errorMessage = 'QR Code sudah digunakan';
    } else if (err.message.includes('email')) {
      errorMessage = 'Email sudah terdaftar';
    } else {
      errorMessage = 'Data sudah ada dalam sistem';
    }
  } else if (err.message.includes('ER_NO_REFERENCED_ROW')) {
    errorStatusCode = 400;
    errorMessage = 'Data referensi tidak ditemukan';
  } else if (err.message.includes('ER_BAD_FIELD_ERROR')) {
    errorStatusCode = 400;
    errorMessage = 'Field tidak valid';
  }

  // JWT errors
  if (err.message.includes('jwt')) {
    errorStatusCode = 401;
    errorMessage = 'Token tidak valid';
  }

  // Validation errors
  if (err.message.includes('ValidationError')) {
    errorStatusCode = 400;
    errorMessage = 'Data tidak valid';
  }

  // Send error response
  res.status(errorStatusCode).json({
    success: false,
    message: errorStatusCode === 500 ? 'Terjadi kesalahan server' : errorMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.message 
    })
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};