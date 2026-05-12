import { taskJobModel } from '../models/taskJob';
import { TaskJob } from '@ai-script/shared-types';

export class TaskService {
  async getTask(taskId: string): Promise<TaskJob | undefined> {
    return taskJobModel.findById(taskId);
  }

  async updateProgress(
    taskId: string,
    progress: number,
    currentStep: number
  ): Promise<void> {
    await taskJobModel.updateProgress(taskId, progress, currentStep);
  }

  async completeTask(
    taskId: string,
    resultData?: Record<string, unknown>
  ): Promise<void> {
    await taskJobModel.complete(taskId, resultData);
  }

  async failTask(taskId: string, errorMsg: string): Promise<void> {
    await taskJobModel.fail(taskId, errorMsg);
  }
}

export const taskService = new TaskService();
