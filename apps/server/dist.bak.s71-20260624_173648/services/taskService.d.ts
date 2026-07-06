import { TaskJob } from '../shared/types';
export declare class TaskService {
    getTask(taskId: string): Promise<TaskJob | undefined>;
    updateProgress(taskId: string, progress: number, currentStep: number): Promise<void>;
    completeTask(taskId: string, resultData?: Record<string, unknown>): Promise<void>;
    failTask(taskId: string, errorMsg: string): Promise<void>;
}
export declare const taskService: TaskService;
