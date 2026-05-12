import { getDb } from './db';
import { Novel } from '@ai-script/shared-types';

export class NovelModel {
  async create(novel: Novel): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO novels (id, title, author, file_path, total_chars, total_words,
       genre, theme, style, tone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [novel.id, novel.title, novel.author, novel.filePath, novel.totalChars,
       novel.totalWords, novel.genre, novel.theme, novel.style, novel.tone,
       novel.status, novel.createdAt, novel.updatedAt]
    );
  }

  async findById(id: string): Promise<Novel | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM novels WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToNovel(row);
  }

  async updateStatus(id: string, status: Novel['status']): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE novels SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), id]
    );
  }

  async updateAnalysis(id: string, analysis: Partial<Novel>): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?, updated_at = ?
       WHERE id = ?`,
      [analysis.genre, analysis.theme, analysis.style, analysis.tone, Date.now(), id]
    );
  }

  async list(): Promise<Novel[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM novels ORDER BY created_at DESC');
    return rows.map(row => this.mapRowToNovel(row));
  }

  private mapRowToNovel(row: any): Novel {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      filePath: row.file_path,
      totalChars: row.total_chars,
      totalWords: row.total_words,
      genre: row.genre,
      theme: row.theme,
      style: row.style,
      tone: row.tone,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const novelModel = new NovelModel();
