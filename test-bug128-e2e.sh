#!/bin/bash
# 1. login admin → JWT
echo "=== 1. login admin ==="
LOGIN=$(curl -sm 5 -X POST http://127.0.0.1:6000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN" | head -c 500
echo ""
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "TOKEN: ${TOKEN:0:50}..."

# 2. create video conversation
echo ""
echo "=== 2. create video conversation ==="
CREATE=$(curl -sm 5 -X POST http://127.0.0.1:6000/api/video-agent/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$CREATE" | head -c 500
echo ""
CONV_ID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['conversationId'])")
echo "CONV_ID: $CONV_ID"

# 3. 准备 user message (1 张参考图 + 中文指令)
# 模拟 shipin-APP 自己的 upload: 先用 admin 上传一张占位 PNG
echo ""
echo "=== 3. upload 1 ref image ==="
# 生成 1x1 PNG (8 byte 最小)
python3 -c "
import base64
png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
with open('/tmp/ref.png', 'wb') as f:
    f.write(base64.b64decode(png_b64))
print('png size:', len(base64.b64decode(png_b64)))
"
UPLOAD=$(curl -sm 5 -X POST http://127.0.0.1:6000/api/agent/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/ref.png;type=image/png")
echo "$UPLOAD" | head -c 500
echo ""
REF_URL=$(echo "$UPLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['url'])")
echo "REF_URL: $REF_URL"

# 4. 发 chat message (1 张 ref + 中文指令, aspectRatio 1152x768)
echo ""
echo "=== 4. chat (1 ref image + 中文指令, aspectRatio=1152x768) ==="
USER_TEXT="参考图里的是人物的三视图,从左到右依次是女主的正面特写,中间的是女主的侧面特写,最右边是女主的全身照,仔细分析女主的形象,根据女主的形象生成一段跳舞的视频,风格要超写实3D CG动画。人物细腻符合参考图女主形象,动作流畅自然。不要把参考图放进视频里,参考图只是用来参考的,不是直接用来参考图生成视频。"

CHAT=$(curl -sm 90 -X POST http://127.0.0.1:6000/api/video-agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSONEOF
{
  "conversationId": "$CONV_ID",
  "parts": [
    {"type":"image","url":"$REF_URL","role":"reference"},
    {"type":"text","text":"$USER_TEXT"}
  ],
  "aspectRatio": "1152x768"
}
JSONEOF
)")
echo "$CHAT" | python3 -m json.tool 2>/dev/null | head -80

echo ""
echo "=== 5. plan.prompt ==="
echo "$CHAT" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
ai_msg = d.get('aiMessage', {})
parts = ai_msg.get('parts', [])
for p in parts:
    if p.get('type') == 'plan':
        plan = p.get('data', {})
        print('--- prompt ---')
        print(plan.get('prompt', '<no prompt>'))
        print('')
        print('--- negativePrompt ---')
        print(plan.get('negativePrompt', '<no negativePrompt>'))
        print('')
        print('--- refImageCount ---')
        print(plan.get('refImageCount', '<no refImageCount>'))
        print('')
        print('--- aspectRatio ---')
        print(plan.get('aspectRatio', '<no aspectRatio>'))
        print('')
        print('--- status ---')
        print(d.get('status', '<no status>'))
        break
else:
    print('NO plan found, raw parts:')
    for p in parts:
        print(p)
"
