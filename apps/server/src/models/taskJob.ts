import { getDb } from './db';
import { TaskJob } from '@ai-script/shared-types';

export class TaskJobModel {
  async create(job: TaskJob): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO task_jobs (id, novel_id, type, status, progress, total_steps,
       current_step, result_data, error_msg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job.id, job.novelId, job.type, job.status, job.progress, job.totalSteps,
       job.currentStep, JSON.stringify(job.resultData), job.errorMsg,
       job.createdAt, job.updatedAt]
    );
  }

  async findById(id: string): Promise<TaskJob | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM task_jobs WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToTaskJob(row);
  }

  async updateProgress(id: string, progress: number, currentStep: number): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE task_jobs SET progress = ?, current_step = ?, updated_at = ? WHERE id = ?',
      [progress, currentStep, Date.now(), id]
    );
  }

  async complete(id: string, resultData?: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE task_jobs SET status = ?, progress = 100, result_data = ?,
       completed_at = ?, updated_at = ? WHERE id = ?`,
      ['completed', JSON.stringify(resultData), Date.now(), Date.now(), id]
    );
  }

  async fail(id: string, errorMsg: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE task_jobs SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?',
      ['failed', errorMsg, Date.now(), id]
    );
  }

  private mapRowToTaskJob(row: any): TaskJob {
    return {
      id: row.id,
      novelId: row.novel_id,
      type: row.type,
      status: row.status,
      progress: row.progress,
      totalSteps: row.total_steps,
      currentStep: row.current_step,
      resultData: JSON.parse(row.result_data || '{}'),
      errorMsg: row.error_msg,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}

export const taskJobModel = new TaskJobModel();
