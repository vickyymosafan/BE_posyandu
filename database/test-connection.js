const { testConnection, executeQuery, closePool } = require('../utils/database');

/**
 * Simple database connection test
 */
async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        
        // Test basic connection
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Database connection failed');
        }
        
        console.log('✓ Database connection successful');
        
        // Test query execution
        console.log('Testing query execution...');
        const result = await executeQuery('SELECT 1 as test');
        
        if (result && result[0] && result[0].test === 1) {
            console.log('✓ Query execution successful');
        } else {
            throw new Error('Query execution failed');
        }
        
        // Test table existence (if tables are created)
        try {
            const tables = await executeQuery(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE()
            `);
            
            console.log(`✓ Found ${tables.length} tables in database`);
            
            if (tables.length > 0) {
                console.log('Tables:');
                tables.forEach(table => {
                    console.log(`  - ${table.TABLE_NAME}`);
                });
            }
        } catch (error) {
            console.log('- No tables found (database may not be set up yet)');
        }
        
        console.log('\n✓ Database test completed successfully');
        
    } catch (error) {
        console.error('\n✗ Database test failed:', error.message);
        console.error('\nPlease check:');
        console.error('1. Database server is running');
        console.error('2. Credentials in .env file are correct');
        console.error('3. Database exists and is accessible');
        process.exit(1);
    } finally {
        await closePool();
    }
}

// Run test
testDatabaseConnection();