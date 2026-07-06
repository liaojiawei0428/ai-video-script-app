export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;
    constructor(code: string, message: string, statusCode?: number, details?: Record<string, unknown>);
}
export declare const ErrorCodes: {
    readonly NOVEL_NOT_FOUND: {
        readonly code: "NOVEL_NOT_FOUND";
        readonly statusCode: 404;
    };
    readonly TASK_NOT_FOUND: {
        readonly code: "TASK_NOT_FOUND";
        readonly statusCode: 404;
    };
    readonly INVALID_FILE_TYPE: {
        readonly code: "INVALID_FILE_TYPE";
        readonly statusCode: 400;
    };
    readonly FILE_TOO_LARGE: {
        readonly code: "FILE_TOO_LARGE";
        readonly statusCode: 413;
    };
    readonly DEEPSEEK_API_ERROR: {
        readonly code: "DEEPSEEK_API_ERROR";
        readonly statusCode: 502;
    };
    readonly RATE_LIMIT_EXCEEDED: {
        readonly code: "RATE_LIMIT_EXCEEDED";
        readonly statusCode: 429;
    };
    readonly INTERNAL_ERROR: {
        readonly code: "INTERNAL_ERROR";
        readonly statusCode: 500;
    };
    readonly VALIDATION_ERROR: {
        readonly code: "VALIDATION_ERROR";
        readonly statusCode: 400;
    };
};
