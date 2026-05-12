import { getDb } from './db';
import { Shot } from '@ai-script/shared-types';

export class ShotModel {
  async create(shot: Shot): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location,
       shot.timeOfDay, shot.description, shot.cameraAngle, shot.cameraMove, shot.lighting,
       shot.durationSec, shot.audioNote, shot.dialogue, shot.action, shot.status]
    );
  }

  async findByEpisodeId(episodeId: string): Promise<Shot[]> {
    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number',
      episodeId
    );
    return rows.map(row => this.mapRowToShot(row));
  }

  async bulkCreate(shots: Shot[]): Promise<void> {
    const db = await getDb();
    const stmt = await db.prepare(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const shot of shots) {
      await stmt.run(
        shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location,
        shot.timeOfDay, shot.description, shot.cameraAngle, shot.cameraMove, shot.lighting,
        shot.durationSec, shot.audioNote, shot.dialogue, shot.action, shot.status
      );
    }

    await stmt.finalize();
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
