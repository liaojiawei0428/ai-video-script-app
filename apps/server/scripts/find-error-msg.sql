SELECT
  id,
  JSON_LENGTH(messages) as mlen,
  JSON_SEARCH(messages, 'one', 'error', NULL, '$[*].type') as error_idx,
  JSON_EXTRACT(messages, CONCAT('$[', JSON_SEARCH(messages, 'one', 'error', NULL, '$[*].type'), '].message')) as error_msg
FROM video_conversations
WHERE id='aa88d219-686d-4459-b01b-09e31a7b4159' LIMIT 1\G
