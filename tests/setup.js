// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';

// Use main database for tests (in a real project, you'd want a separate test database)
// For now, we'll use the main database to avoid setup complexity
if (!process.env.DB_NAME) {
  process.env.DB_NAME = 'posyandu_db';
}

// Increase timeout for database operations
jest.setTimeout(30000);