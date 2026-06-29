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

  /**
   * v3.0.52 (BUG-123): 获取单个 task 的排队状态 (用于前端 UI 实时刷新)
   *   - 接受 taskId (从 imageConversationId / videoConversationId / shotId 等传过来)
   *   - 自动在 imageLimiter + videoLimiter 两个 limiter 中查找
   *   - 返回 position (1-based, null = 不在队列), etaSeconds (估算等待秒数)
   *   - 同时返回全局限流状态 (image/video active+waiting+limit) 给前端展示
   */
  async getQueueStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { getAgnesImageLimiter, getAgnesVideoLimiter } = await import('../utils/rateLimiter');

      const imageLimiter = getAgnesImageLimiter();
      const videoLimiter = getAgnesVideoLimiter();

      const imageInfo = imageLimiter.getTaskQueueInfo(taskId);
      const videoInfo = videoLimiter.getTaskQueueInfo(taskId);

      // 哪个 limiter 在排队用哪个
      const inImageQueue = imageInfo.position !== null;
      const inVideoQueue = videoInfo.position !== null;

      res.json({
        success: true,
        data: {
          taskId,
          inQueue: inImageQueue || inVideoQueue,
          // image limiter 中的位置 (null = 不在 image 队列)
          image: {
            position: imageInfo.position,
            etaSeconds: imageInfo.etaSeconds,
          },
          // video limiter 中的位置 (null = 不在 video 队列)
          video: {
            position: videoInfo.position,
            etaSeconds: videoInfo.etaSeconds,
          },
          // 全局限流状态 (用于前端展示总进度)
          global: {
            image: imageLimiter.getStatus(),
            video: videoLimiter.getStatus(),
          },
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
