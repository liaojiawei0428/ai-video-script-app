import { queryOne, queryAll, execute } from './db';
import { Novel } from '../shared/types';

export class NovelModel {
  async create(novel: Novel): Promise<void> {
    await execute(
      `INSERT INTO novels (id, title, author, user_id, file_path, total_chars, total_words,
       genre, theme, style, tone, status, created_at, updated_at, style_id, style_bible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [novel.id, novel.title, novel.author, novel.userId || null, novel.filePath, novel.totalChars,
       novel.totalWords, novel.genre || '', novel.theme || '', novel.style || '', novel.tone || '',
       novel.status, novel.createdAt, novel.updatedAt, (novel as any).styleId || 'realistic',
       (novel as any).styleBible ? JSON.stringify((novel as any).styleBible) : null]
    );
  }

  async findByUserId(userId: string, opts: { q?: string; status?: string } = {}): Promise<Novel[]> {
    const wheres: string[] = ['user_id = ?'];
    const params: any[] = [userId];
    if (opts.q && opts.q.trim()) {
      wheres.push('(title LIKE ? OR author LIKE ? OR genre LIKE ?)');
      const like = `%${opts.q.trim()}%`;
      params.push(like, like, like);
    }
    if (opts.status && opts.status !== 'all') {
      wheres.push('status = ?');
      params.push(opts.status);
    }
    const rows = await queryAll<any>(
      `SELECT * FROM novels WHERE ${wheres.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    return rows.map(row => this.mapRowToNovel(row));
  }

  async findById(id: string): Promise<Novel | undefined> {
    const row = await queryOne<any>('SELECT * FROM novels WHERE id = ?', [id]);
    if (!row) return undefined;
    return this.mapRowToNovel(row);
  }

  async updateStatus(id: string, status: Novel['status']): Promise<void> {
    await execute(
      'UPDATE novels SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), id]
    );
  }

  /**
   * S72 v3.0.33 通用部分字段更新 (P0 #3 outlineStatus/plotGraphStatus + P2 #9 autoGenerateEpisodes 配置用)
   * @param fields 字段名 → 值, 例 { outlineStatus: 'failed', plotGraphStatus: 'completed' }
   */
  async updateFields(id: string, fields: Record<string, any>): Promise<void> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    // S72 v3.0.33 P2 #9 修复 (ADR-0002): 自动 camelCase → snake_case 转换 (修 P0 #3 bug: outlineStatus → outline_status)
    const toCol = (k: string) => k.replace(/([A-Z])/g, '_$1').toLowerCase();
    const setClause = keys.map(k => `${toCol(k)} = ?`).join(', ');
    const values = keys.map(k => fields[k]);
    await execute(
      `UPDATE novels SET ${setClause}, updated_at = ? WHERE id = ?`,
      [...values, Date.now(), id]
    );
  }

  async updateAnalysis(id: string, analysis: Partial<Novel>): Promise<void> {
    await execute(
      `UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?,
       scenes = ?, plot_points = ?, updated_at = ?
       WHERE id = ?`,
      [analysis.genre || '', analysis.theme || '', analysis.style || '', analysis.tone || '',
       JSON.stringify(analysis.scenes ?? []), JSON.stringify(analysis.plotPoints ?? []),
       Date.now(), id]
    );
  }

  async updateFullSummary(id: string, fullSummary: string): Promise<void> {
    await execute(
      'UPDATE novels SET full_summary = ?, updated_at = ? WHERE id = ?',
      [fullSummary, Date.now(), id]
    );
  }

  async updateAnalysisReport(id: string, analysisReport: string): Promise<void> {
    await execute(
      'UPDATE novels SET analysis_report = ?, updated_at = ? WHERE id = ?',
      [analysisReport, Date.now(), id]
    );
  }

  async list(): Promise<Novel[]> {
    const rows = await queryAll<any>('SELECT * FROM novels ORDER BY created_at DESC');
    return rows.map(row => this.mapRowToNovel(row));
  }

  async findManyByStatus(statuses: string[]): Promise<Novel[]> {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => '?').join(',');
    const rows = await queryAll<any>(
      `SELECT * FROM novels WHERE status IN (${placeholders}) ORDER BY updated_at ASC LIMIT 50`,
      statuses
    );
    return rows.map(row => this.mapRowToNovel(row));
  }

  async updateOutline(id: string, outlineText: string): Promise<void> {
    await execute(
      'UPDATE novels SET outline_text = ?, outline_confirmed = 0, outline_confirmed_at = NULL, updated_at = ? WHERE id = ?',
      [outlineText, Date.now(), id]
    );
  }

  async confirmOutline(id: string, outlineText: string): Promise<void> {
    await execute(
      'UPDATE novels SET outline_text = ?, outline_confirmed = 1, outline_confirmed_at = ?, updated_at = ? WHERE id = ?',
      [outlineText, Date.now(), Date.now(), id]
    );
  }

  async updatePlotGraph(id: string, plotGraph: string): Promise<void> {
    await execute(
      'UPDATE novels SET plot_graph = ?, plot_graph_generated_at = ?, updated_at = ? WHERE id = ?',
      [plotGraph, Date.now(), Date.now(), id]
    );
  }

  private mapRowToNovel(row: any): Novel {
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
    } as any;
  }
}

export const novelModel = new NovelModel();
