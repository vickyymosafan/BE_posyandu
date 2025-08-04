import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

const config: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'posyandu_lansia',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10')
};

let pool: mysql.Pool;

export const createConnection = async (): Promise<mysql.Pool> => {
  try {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MySQL connection pool created successfully');
    return pool;
  } catch (error) {
    logger.error('Error creating MySQL connection pool:', error);
    throw error;
  }
};

export const getConnection = (): mysql.Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createConnection() first.');
  }
  return pool;
};

export const closeConnection = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('MySQL connection pool closed');
  }
};