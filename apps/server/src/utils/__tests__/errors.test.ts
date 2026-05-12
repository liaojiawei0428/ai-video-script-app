import { AppError, ErrorCodes } from '../errors';

describe('AppError', () => {
  it('should create error with default status code 500', () => {
    const error = new AppError('TEST_ERROR', 'Test message');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(500);
  });

  it('should create error with custom status code', () => {
    const error = new AppError('NOT_FOUND', 'Not found', 404);
    expect(error.statusCode).toBe(404);
  });

  it('should include details', () => {
    const details = { field: 'test' };
    const error = new AppError('VALIDATION', 'Invalid', 400, details);
    expect(error.details).toEqual(details);
  });
});

describe('ErrorCodes', () => {
  it('should have all required error codes', () => {
    expect(ErrorCodes.NOVEL_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.TASK_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.INTERNAL_ERROR).toBeDefined();
  });
});
