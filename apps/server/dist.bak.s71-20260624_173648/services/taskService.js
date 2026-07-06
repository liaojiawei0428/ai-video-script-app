"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = exports.TaskService = void 0;
const taskJob_1 = require("../models/taskJob");
class TaskService {
    async getTask(taskId) {
        return taskJob_1.taskJobModel.findById(taskId);
    }
    async updateProgress(taskId, progress, currentStep) {
        await taskJob_1.taskJobModel.updateProgress(taskId, progress, currentStep);
    }
    async completeTask(taskId, resultData) {
        await taskJob_1.taskJobModel.complete(taskId, resultData);
    }
    async failTask(taskId, errorMsg) {
        await taskJob_1.taskJobModel.fail(taskId, errorMsg);
    }
}
exports.TaskService = TaskService;
exports.taskService = new TaskService();
