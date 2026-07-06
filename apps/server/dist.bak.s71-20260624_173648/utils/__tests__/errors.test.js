"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
describe('AppError', () => {
    it('should create error with default status code 500', () => {
        const error = new errors_1.AppError('TEST_ERROR', 'Test message');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.message).toBe('Test message');
        expect(error.statusCode).toBe(500);
    });
    it('should create error with custom status code', () => {
        const error = new errors_1.AppError('NOT_FOUND', 'Not found', 404);
        expect(error.statusCode).toBe(404);
    });
    it('should include details', () => {
        const details = { field: 'test' };
        const error = new errors_1.AppError('VALIDATION', 'Invalid', 400, details);
        expect(error.details).toEqual(details);
    });
});
describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
        expect(errors_1.ErrorCodes.NOVEL_NOT_FOUND).toBeDefined();
        expect(errors_1.ErrorCodes.TASK_NOT_FOUND).toBeDefined();
        expect(errors_1.ErrorCodes.INTERNAL_ERROR).toBeDefined();
    });
});
