"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskController = void 0;
const taskService_1 = require("../services/taskService");
exports.taskController = {
    async getProgress(req, res, next) {
        try {
            const { taskId } = req.params;
            const task = await taskService_1.taskService.getTask(taskId);
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'TASK_NOT_FOUND',
                        message: 'Task not found',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                    },
                });
            }
            res.json({
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status,
                    progress: task.progress,
                    currentStep: task.currentStep,
                    totalSteps: task.totalSteps,
                    errorMsg: task.errorMsg,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
};
