import { queryOne, queryAll, execute } from './db';
import { Novel } from '../shared/types';

export class NovelModel {
  async create(novel: Novel): Promise<void> {
    await execute(
      `INSERT INTO novels (id, title, author, user_id, file_path, total_chars, total_words,
       genre, theme, style, tone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [novel.id, novel.title, novel.author, novel.userId || null, novel.filePath, novel.totalChars,
       novel.totalWords, novel.genre || '', novel.theme || '', novel.style || '', novel.tone || '',
       novel.status, novel.createdAt, novel.updatedAt]
    );
  }

  async findByUserId(userId: string): Promise<Novel[]> {
    const rows = await queryAll<any>(
      'SELECT * FROM novels WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
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

  async updateAnalysis(id: string, analysis: Partial<Novel>): Promise<void> {
    await execute(
      `UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?,
       scenes = ?, plot_points = ?, updated_at = ?
       WHERE id = ?`,
      [analysis.genre || '', analysis.theme || '', analysis.style || '', analysis.tone || '',
       JSON.stringify(analysis.scenes), JSON.stringify(analysis.plotPoints),
       Date.now(), id]
    );
  }

  async updateFullSummary(id: string, fullSummary: string): Promise<void> {
    await execute(
      'UPDATE novels SET full_summary = ?, updated_at = ? WHERE id = ?',
      [fullSummary, Date.now(), id]
    );
  }

  async list(): Promise<Novel[]> {
    const rows = await queryAll<any>('SELECT * FROM novels ORDER BY created_at DESC');
    return rows.map(row => this.mapRowToNovel(row));
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
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const novelModel = new NovelModel();
