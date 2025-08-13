const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'posyandu_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Execute a database query with parameters
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const executeQuery = async (query, params = []) => {
    try {
        const [results] = await pool.execute(query, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

/**
 * Execute multiple queries in a transaction
 * @param {Array} queries - Array of {query, params} objects
 * @returns {Promise} Transaction result
 */
const executeTransaction = async (queries) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const { query, params = [] } of queries) {
            const [result] = await connection.execute(query, params);
            results.push(result);
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        await connection.rollback();
        console.error('Transaction error:', error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Get a single connection from the pool
 * @returns {Promise} Database connection
 */
const getConnection = async () => {
    try {
        return await pool.getConnection();
    } catch (error) {
        console.error('Failed to get database connection:', error);
        throw error;
    }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('Database connection successful');
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};

/**
 * Close all connections in the pool
 * @returns {Promise} Close result
 */
const closePool = async () => {
    try {
        await pool.end();
        console.log('Database pool closed');
    } catch (error) {
        console.error('Error closing database pool:', error);
        throw error;
    }
};

/**
 * Get pool statistics
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
    return {
        totalConnections: pool.pool._allConnections.length,
        freeConnections: pool.pool._freeConnections.length,
        acquiringConnections: pool.pool._acquiringConnections.length
    };
};

module.exports = {
    pool,
    executeQuery,
    executeTransaction,
    getConnection,
    testConnection,
    closePool,
    getPoolStats
};