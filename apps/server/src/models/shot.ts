import { queryAll, execute, queryOne } from './db';
import { Shot } from '../shared/types';

export class ShotModel {
  async create(shot: Shot): Promise<void> {
    await execute(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status, image_url, character_ids, style_id, image_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location || '',
       shot.timeOfDay, shot.description || '', shot.cameraAngle, shot.cameraMove, shot.lighting || '',
       shot.durationSec, shot.audioNote || '', shot.dialogue || '', shot.action || '', shot.status,
       (shot as any).imageUrl || '',
       JSON.stringify((shot as any).characterIds || []),
       (shot as any).styleId || null,
       (shot as any).imagePrompt || null]
    );
  }

  async findByEpisodeId(episodeId: string): Promise<Shot[]> {
    const rows = await queryAll<any>(
      'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number',
      [episodeId]
    );
    return rows.map(row => this.mapRowToShot(row));
  }

  async findById(id: string): Promise<Shot | undefined> {
    const row = await queryOne<any>('SELECT * FROM shots WHERE id = ?', [id]);
    if (!row) return undefined;
    return this.mapRowToShot(row);
  }

  async update(id: string, data: Partial<Shot>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.shotNumber !== undefined) { fields.push('shot_number = ?'); values.push(data.shotNumber); }
    if (data.sceneType !== undefined) { fields.push('scene_type = ?'); values.push(data.sceneType); }
    if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location); }
    if (data.timeOfDay !== undefined) { fields.push('time_of_day = ?'); values.push(data.timeOfDay); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.cameraAngle !== undefined) { fields.push('camera_angle = ?'); values.push(data.cameraAngle); }
    if (data.cameraMove !== undefined) { fields.push('camera_move = ?'); values.push(data.cameraMove); }
    if (data.lighting !== undefined) { fields.push('lighting = ?'); values.push(data.lighting); }
    if (data.durationSec !== undefined) { fields.push('duration_sec = ?'); values.push(data.durationSec); }
    if (data.audioNote !== undefined) { fields.push('audio_note = ?'); values.push(data.audioNote); }
    if (data.dialogue !== undefined) { fields.push('dialogue = ?'); values.push(data.dialogue); }
    if (data.action !== undefined) { fields.push('action = ?'); values.push(data.action); }
    if ((data as any).imageUrl !== undefined) { fields.push('image_url = ?'); values.push((data as any).imageUrl); }
    if ((data as any).imagePrompt !== undefined) { fields.push('image_prompt = ?'); values.push((data as any).imagePrompt); }
    if ((data as any).imageGeneratedAt !== undefined) { fields.push('image_generated_at = ?'); values.push((data as any).imageGeneratedAt); }
    if (fields.length === 0) return;
    values.push(id);
    await execute(`UPDATE shots SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async bulkCreate(shots: Shot[]): Promise<void> {
    for (const shot of shots) {
      await this.create(shot);
    }
  }

  private mapRowToShot(row: any): Shot {
    return {
      id: row.id,
      episodeId: row.episode_id,
      shotNumber: row.shot_number,
      sceneType: row.scene_type,
      location: row.location,
      timeOfDay: row.time_of_day,
      description: row.description,
      cameraAngle: row.camera_angle,
      cameraMove: row.camera_move,
      lighting: row.lighting,
      durationSec: row.duration_sec,
      audioNote: row.audio_note,
      dialogue: row.dialogue,
      action: row.action,
      status: row.status,
      // v2.0.0
      imageUrl: row.image_url || '',
      characterIds: typeof row.character_ids === 'string' ? JSON.parse(row.character_ids || '[]') : (row.character_ids || []),
      styleId: row.style_id || null,
      imagePrompt: row.image_prompt || '',
      imageGeneratedAt: row.image_generated_at || null,
    } as any;
  }
}

export const shotModel = new ShotModel();
