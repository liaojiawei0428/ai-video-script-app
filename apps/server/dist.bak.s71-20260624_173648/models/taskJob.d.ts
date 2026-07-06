import { TaskJob } from '../shared/types';
export declare class TaskJobModel {
    create(job: TaskJob): Promise<void>;
    findById(id: string): Promise<TaskJob | undefined>;
    findLatestByNovelId(novelId: string): Promise<TaskJob | undefined>;
    updateProgress(id: string, progress: number, currentStep: number): Promise<void>;
    complete(id: string, resultData?: Record<string, unknown>): Promise<void>;
    fail(id: string, errorMsg: string): Promise<void>;
    cancel(id: string): Promise<void>;
    private mapRowToTaskJob;
}
export declare const taskJobModel: TaskJobModel;
