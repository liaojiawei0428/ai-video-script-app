"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskJobModel = exports.TaskJobModel = void 0;
const db_1 = require("./db");
class TaskJobModel {
    async create(job) {
        await (0, db_1.execute)(`INSERT INTO task_jobs (id, novel_id, type, status, progress, total_steps,
       current_step, result_data, error_msg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [job.id, job.novelId, job.type, job.status, job.progress, job.totalSteps || 0,
            job.currentStep || 0, JSON.stringify(job.resultData || null), job.errorMsg || '',
            job.createdAt, job.updatedAt]);
    }
    async findById(id) {
        const row = await (0, db_1.queryOne)('SELECT * FROM task_jobs WHERE id = ?', [id]);
        if (!row)
            return undefined;
        return this.mapRowToTaskJob(row);
    }
    async findLatestByNovelId(novelId) {
        const row = await (0, db_1.queryOne)('SELECT * FROM task_jobs WHERE novel_id = ? ORDER BY created_at DESC LIMIT 1', [novelId]);
        if (!row)
            return undefined;
        return this.mapRowToTaskJob(row);
    }
    async updateProgress(id, progress, currentStep) {
        await (0, db_1.execute)('UPDATE task_jobs SET progress = ?, current_step = ?, updated_at = ? WHERE id = ?', [progress, currentStep, Date.now(), id]);
    }
    async complete(id, resultData) {
        await (0, db_1.execute)(`UPDATE task_jobs SET status = ?, progress = 100, result_data = ?,
       completed_at = ?, updated_at = ? WHERE id = ?`, ['completed', JSON.stringify(resultData), Date.now(), Date.now(), id]);
    }
    async fail(id, errorMsg) {
        await (0, db_1.execute)('UPDATE task_jobs SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?', ['failed', errorMsg, Date.now(), id]);
    }
    async cancel(id) {
        await (0, db_1.execute)('UPDATE task_jobs SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?', ['failed', '任务已被用户取消', Date.now(), id]);
    }
    mapRowToTaskJob(row) {
        return {
            id: row.id,
            novelId: row.novel_id,
            type: row.type,
            status: row.status,
            progress: row.progress,
            totalSteps: row.total_steps,
            currentStep: row.current_step,
            resultData: typeof row.result_data === 'string' ? JSON.parse(row.result_data || '{}') : (row.result_data || {}),
            errorMsg: row.error_msg,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
        };
    }
}
exports.TaskJobModel = TaskJobModel;
exports.taskJobModel = new TaskJobModel();
