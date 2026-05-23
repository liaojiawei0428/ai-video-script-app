import { queryAll, execute } from './db';
import { Shot } from '../shared/types';

export class ShotModel {
  async create(shot: Shot): Promise<void> {
    await execute(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location || '',
       shot.timeOfDay, shot.description || '', shot.cameraAngle, shot.cameraMove, shot.lighting || '',
       shot.durationSec, shot.audioNote || '', shot.dialogue || '', shot.action || '', shot.status]
    );
  }

  async findByEpisodeId(episodeId: string): Promise<Shot[]> {
    const rows = await queryAll<any>(
      'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number',
      [episodeId]
    );
    return rows.map(row => this.mapRowToShot(row));
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
    };
  }
}

export const shotModel = new ShotModel();
