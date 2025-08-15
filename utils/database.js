const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Parse Railway DATABASE_URL if available
 * Format: mysql://user:password@host:port/database
 */
const parseRailwayDatabaseUrl = (url) => {
    if (!url) return null;
    
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            user: parsed.username,
            password: parsed.password,
            database: parsed.pathname.slice(1), // Remove leading slash
            port: parseInt(parsed.port) || 3306
        };
    } catch (error) {
        console.warn('Failed to parse DATABASE_URL:', error.message);
        return null;
    }
};

// Railway database configuration with fallbacks
const getRailwayDbConfig = () => {
    // First try Railway DATABASE_URL (preferred for Railway)
    const railwayUrl = parseRailwayDatabaseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
    
    if (railwayUrl) {
        console.log('Using Railway DATABASE_URL configuration');
        return {
            ...railwayUrl,
            waitForConnections: true,
            connectionLimit: process.env.NODE_ENV === 'production' ? 15 : 10,
            queueLimit: 0,
            charset: 'utf8mb4',
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
            // Railway-specific optimizations
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }
    
    // Fallback to individual environment variables
    console.log('Using individual environment variables for database configuration');
    return {
        host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'root',
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'posyandu_db',
        port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
        waitForConnections: true,
        connectionLimit: process.env.NODE_ENV === 'production' ? 15 : 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
    };
};

// Database configuration
const dbConfig = getRailwayDbConfig();

// Create connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Execute a database query with parameters and Railway-optimized error handling
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {number} retries - Number of retry attempts for connection issues
 * @returns {Promise} Query result
 */
const executeQuery = async (query, params = [], retries = 2) => {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const [results] = await pool.execute(query, params);
            return results;
        } catch (error) {
            lastError = error;
            
            // Check if it's a connection-related error that might benefit from retry
            const isConnectionError = error.code === 'ECONNRESET' || 
                                    error.code === 'PROTOCOL_CONNECTION_LOST' ||
                                    error.code === 'ENOTFOUND' ||
                                    error.fatal === true;
            
            if (isConnectionError && attempt < retries) {
                console.warn(`Database query attempt ${attempt + 1} failed, retrying...`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            
            // Log detailed error for Railway debugging
            console.error('Database query error:', {
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                error: error.message,
                code: error.code,
                sqlState: error.sqlState,
                attempt: attempt + 1,
                isRailway: !!process.env.DATABASE_URL
            });
            
            throw error;
        }
    }
    
    throw lastError;
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
 * Test database connection with retry logic for Railway
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async (maxRetries = 3, retryDelay = 2000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const connection = await pool.getConnection();
            await connection.ping();
            
            // Test basic query execution
            const [result] = await connection.execute('SELECT 1 as test');
            connection.release();
            
            console.log(`Database connection successful (attempt ${attempt}/${maxRetries})`);
            if (process.env.NODE_ENV === 'production') {
                console.log('Railway MySQL connection established');
            }
            return true;
        } catch (error) {
            lastError = error;
            console.warn(`Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                console.log(`Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                // Exponential backoff
                retryDelay *= 1.5;
            }
        }
    }
    
    console.error('Database connection failed after all retry attempts:', lastError);
    return false;
};

/**
 * Initialize database connection with Railway-specific handling
 * @returns {Promise<boolean>} Initialization status
 */
const initializeConnection = async () => {
    console.log('Initializing database connection...');
    
    // Log configuration (without sensitive data)
    const configInfo = {
        host: dbConfig.host,
        database: dbConfig.database,
        port: dbConfig.port,
        connectionLimit: dbConfig.connectionLimit,
        isRailway: !!process.env.DATABASE_URL || !!process.env.MYSQL_URL,
        environment: process.env.NODE_ENV || 'development'
    };
    console.log('Database configuration:', configInfo);
    
    const isConnected = await testConnection();
    
    if (!isConnected) {
        console.error('Failed to establish database connection');
        if (process.env.NODE_ENV === 'production') {
            console.error('Railway MySQL connection failed. Check environment variables:');
            console.error('- DATABASE_URL or MYSQL_URL should be set by Railway');
            console.error('- Verify MySQL service is running in Railway project');
        }
        return false;
    }
    
    return true;
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
    initializeConnection,
    closePool,
    getPoolStats,
    // Railway-specific utilities
    parseRailwayDatabaseUrl,
    getRailwayDbConfig
};