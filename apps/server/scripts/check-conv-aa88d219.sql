SELECT id, JSON_EXTRACT(messages, '$[0].message') as m0, JSON_LENGTH(messages) as mlen FROM video_conversations WHERE id='aa88d219-686d-4459-b01b-09e31a7b4159' LIMIT 1\G
