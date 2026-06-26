SELECT id, conversation_id, FROM_UNIXTIME(created_at/1000) AS ts, LEFT(prompt, 30) AS prompt FROM video_generations WHERE status='queued' ORDER BY created_at ASC LIMIT 11;
SELECT 'state_after_clear' AS label;
UPDATE video_generations SET status='failed', error_msg='Pre BUG-100: ffmpeg 6.1.1 image2 muxer + agens upstream 累积 (2026-06-09 to 2026-06-26)' WHERE status='queued';
SELECT status, COUNT(*) AS cnt FROM video_generations GROUP BY status;
