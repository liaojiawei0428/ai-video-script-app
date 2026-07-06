"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.novelModel = exports.NovelModel = void 0;
const db_1 = require("./db");
class NovelModel {
    async create(novel) {
        await (0, db_1.execute)(`INSERT INTO novels (id, title, author, user_id, file_path, total_chars, total_words,
       genre, theme, style, tone, status, created_at, updated_at, style_id, style_bible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [novel.id, novel.title, novel.author, novel.userId || null, novel.filePath, novel.totalChars,
            novel.totalWords, novel.genre || '', novel.theme || '', novel.style || '', novel.tone || '',
            novel.status, novel.createdAt, novel.updatedAt, novel.styleId || 'realistic',
            novel.styleBible ? JSON.stringify(novel.styleBible) : null]);
    }
    async findByUserId(userId, opts = {}) {
        const wheres = ['user_id = ?'];
        const params = [userId];
        if (opts.q && opts.q.trim()) {
            wheres.push('(title LIKE ? OR author LIKE ? OR genre LIKE ?)');
            const like = `%${opts.q.trim()}%`;
            params.push(like, like, like);
        }
        if (opts.status && opts.status !== 'all') {
            wheres.push('status = ?');
            params.push(opts.status);
        }
        const rows = await (0, db_1.queryAll)(`SELECT * FROM novels WHERE ${wheres.join(' AND ')} ORDER BY created_at DESC LIMIT 200`, params);
        return rows.map(row => this.mapRowToNovel(row));
    }
    async findById(id) {
        const row = await (0, db_1.queryOne)('SELECT * FROM novels WHERE id = ?', [id]);
        if (!row)
            return undefined;
        return this.mapRowToNovel(row);
    }
    async updateStatus(id, status) {
        await (0, db_1.execute)('UPDATE novels SET status = ?, updated_at = ? WHERE id = ?', [status, Date.now(), id]);
    }
    async updateAnalysis(id, analysis) {
        await (0, db_1.execute)(`UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?,
       scenes = ?, plot_points = ?, updated_at = ?
       WHERE id = ?`, [analysis.genre || '', analysis.theme || '', analysis.style || '', analysis.tone || '',
            JSON.stringify(analysis.scenes ?? []), JSON.stringify(analysis.plotPoints ?? []),
            Date.now(), id]);
    }
    async updateFullSummary(id, fullSummary) {
        await (0, db_1.execute)('UPDATE novels SET full_summary = ?, updated_at = ? WHERE id = ?', [fullSummary, Date.now(), id]);
    }
    async updateAnalysisReport(id, analysisReport) {
        await (0, db_1.execute)('UPDATE novels SET analysis_report = ?, updated_at = ? WHERE id = ?', [analysisReport, Date.now(), id]);
    }
    async list() {
        const rows = await (0, db_1.queryAll)('SELECT * FROM novels ORDER BY created_at DESC');
        return rows.map(row => this.mapRowToNovel(row));
    }
    async findManyByStatus(statuses) {
        if (statuses.length === 0)
            return [];
        const placeholders = statuses.map(() => '?').join(',');
        const rows = await (0, db_1.queryAll)(`SELECT * FROM novels WHERE status IN (${placeholders}) ORDER BY updated_at ASC LIMIT 50`, statuses);
        return rows.map(row => this.mapRowToNovel(row));
    }
    async updateOutline(id, outlineText) {
        await (0, db_1.execute)('UPDATE novels SET outline_text = ?, outline_confirmed = 0, outline_confirmed_at = NULL, updated_at = ? WHERE id = ?', [outlineText, Date.now(), id]);
    }
    async confirmOutline(id, outlineText) {
        await (0, db_1.execute)('UPDATE novels SET outline_text = ?, outline_confirmed = 1, outline_confirmed_at = ?, updated_at = ? WHERE id = ?', [outlineText, Date.now(), Date.now(), id]);
    }
    async updatePlotGraph(id, plotGraph) {
        await (0, db_1.execute)('UPDATE novels SET plot_graph = ?, plot_graph_generated_at = ?, updated_at = ? WHERE id = ?', [plotGraph, Date.now(), Date.now(), id]);
    }
    mapRowToNovel(row) {
        return {
            id: row.id,
            title: row.title,
            author: row.author,
            userId: row.user_id,
            filePath: row.file_path,
            totalChars: row.total_chars,
            totalWords: row.total_words,
            genre: row.genre,
            theme: row.theme,
            style: row.style,
            tone: row.tone,
            scenes: typeof row.scenes === 'string' ? JSON.parse(row.scenes || '[]') : (row.scenes || []),
            plotPoints: typeof row.plot_points === 'string' ? JSON.parse(row.plot_points || '[]') : (row.plot_points || []),
            fullSummary: row.full_summary || '',
            novelExcerpts: row.novel_excerpts || '',
            analysisReport: row.analysis_report || '',
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            // v2.5.18: 映射 style_id 和 style_bible (之前遗漏导致风格圣经丢失)
            styleId: row.style_id || 'realistic',
            styleBible: row.style_bible ? (typeof row.style_bible === 'string' ? JSON.parse(row.style_bible) : row.style_bible) : null,
        };
    }
}
exports.NovelModel = NovelModel;
exports.novelModel = new NovelModel();
