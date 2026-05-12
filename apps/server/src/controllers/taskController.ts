import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/taskService';

export const taskController = {
  async getProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const task = await taskService.getTask(taskId);
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
    } catch (error) {
      next(error);
    }
  },
};
