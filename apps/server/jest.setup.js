// Jest setup file
jest.setTimeout(30000);

// Mock environment variables
process.env.DEEPSEEK_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
