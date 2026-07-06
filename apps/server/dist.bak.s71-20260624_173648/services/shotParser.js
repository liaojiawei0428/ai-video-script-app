"use strict";
/**
 * 分镜文本解析器
 * 将 AI 生成的自然语言分镜文本解析为结构化字段
 * 格式示例:
 *   【镜头1 | 5秒】
 *   景别: 中景 | 构图: 三分法
 *   运镜: 固定
 *   画面: ...
 *   对白: 【秋霞】"主子..."
 *   灯光: 侧光+暖色轮廓光
 *   色彩: 暖调+低饱和
 *   音效: 远处蝉鸣
 *   转场: 硬切
 *   [image_prompt] 完整英文 prompt
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseShotSegment = parseShotSegment;
exports.isMetaParagraph = isMetaParagraph;
exports.parseShotList = parseShotList;
exports.groupShotsByScene = groupShotsByScene;
const SHOT_TYPE_PATTERN = /大远景|远景|全景|中景|近景|特写|大特写|过肩镜头|航拍|远景镜头|中近景|中全景/;
const COMPOSITION_PATTERN = /中心构图|三分法|对称构图|引导线|框架构图|黄金螺旋|对角线构图|留白构图|纵深构图/;
const CAMERA_MOVE_PATTERN = /推[^,|]*|拉[^,|]*|摇[^,|]*|移[^,|]*|跟[^,|]*|升[^,|]*|降[^,|]*|环绕[^,|]*|固定|手持[^,|]*|航拍[^,|]*|斯坦尼康[^,|]*/;
const DIALOGUE_PATTERN = /【([^】]+)】\s*[（(]?([^)）】]*?)[)）]?\s*[""“「]([^"”」「]+)["”」]/g;
const TRANSITION_PATTERN = /硬切|溶解|淡入淡出|匹配剪辑|跳切|划接|叠化|定格|擦除/;
const LIGHTING_PATTERN = /(?:灯光|光线|光)[::]\s*([^\n]+)|^[::]\s*([^\n]+)/m;
const COLOR_PATTERN = /(?:色彩|色调)[::]\s*([^\n]+)/;
const AUDIO_PATTERN = /(?:音效|声音|音乐)[::]\s*([^\n]+)/;
const IMAGE_PROMPT_PATTERN = /\[image_prompt\]\s*([^\n]+(?:\n(?!---|景别|运镜|画面|对白|灯光|色彩|音效|转场)[^\n]*)*)/i;
/**
 * 解析单个镜头段落
 */
function parseShotSegment(seg, index) {
    const normalized = seg.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const trimmed = normalized.trim();
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l);
    // 镜头编号 + 时长
    const headerMatch = trimmed.match(/【?镜头(\d+)\s*[|｜]\s*(\d+(?:\.\d+)?)\s*秒】?/);
    const shotNumber = headerMatch ? parseInt(headerMatch[1]) : (index + 1);
    const durationSec = headerMatch ? parseFloat(headerMatch[2]) : 5;
    // 提取景别与构图 (可能在同一行: "景别: 中景 | 构图: 三分法")
    const framingLine = lines.find(l => l.match(/^景别[:：]/)) || '';
    const sceneTypeMatch = framingLine.match(SHOT_TYPE_PATTERN);
    const compositionMatch = framingLine.match(COMPOSITION_PATTERN);
    // 提取运镜
    const cameraLine = lines.find(l => l.match(/^运镜[:：]/)) || '';
    const cameraMove = cameraLine.replace(/^运镜[:：]\s*/, '').trim();
    // 提取画面
    const visualLine = lines.find(l => l.match(/^画面[:：]/)) || '';
    const visual = visualLine.replace(/^画面[:：]\s*/, '').trim();
    // 提取对白 (可能是多行, 从"对白:"/"对:"开始直到下一个字段标签)
    // 也支持直接匹配 【角色】"对白" 行
    const dialogueLines = [];
    let inDialogue = false;
    const allDialogueText = [];
    // 字段标签白名单 (含 AI 常见简写 + 空标签 ": xxxx" 是 AI 偶发的"灯光"省略)
    // 排除: 以 【 开头的对话行, 以 [ 开头的 image_prompt
    const isFieldLine = (line) => {
        if (line.startsWith('【') || line.startsWith('['))
            return false;
        return /[:：]/.test(line);
    };
    for (const line of lines) {
        if (isFieldLine(line)) {
            const isDialogueLabel = /^对白?[:：]/.test(line);
            if (isDialogueLabel) {
                inDialogue = true;
                const after = line.replace(/^对白?[:：]\s*/, '').trim();
                if (after)
                    allDialogueText.push(after);
            }
            else {
                inDialogue = false;
            }
            continue;
        }
        if (line.match(/^---/)) {
            inDialogue = false;
            continue;
        }
        if (line.match(/^\[image_prompt\]/i)) {
            inDialogue = false;
            continue;
        }
        if (inDialogue) {
            if (line.trim())
                allDialogueText.push(line.trim());
        }
    }
    // 兜底: 如果 FIELD_LABEL 没匹配到, 直接收集所有含 【角色】 的行
    if (allDialogueText.length === 0) {
        for (const line of lines) {
            if (line.match(/^【[^】]+】/)) {
                allDialogueText.push(line.trim());
            }
        }
    }
    // 解析结构化对白: 【角色】(情绪)"对白"
    const dialogueBlock = allDialogueText.join('\n');
    let m;
    const dialogueRegex = new RegExp(DIALOGUE_PATTERN.source, 'g');
    while ((m = dialogueRegex.exec(dialogueBlock)) !== null) {
        dialogueLines.push({
            character: m[1].trim(),
            line: m[3].trim(),
            emotion: m[2]?.trim() || undefined,
        });
    }
    const dialogue = dialogueLines.length > 0
        ? dialogueLines.map(d => `【${d.character}】${d.emotion ? `(${d.emotion})` : ''}"${d.line}"`).join('\n')
        : '';
    // 提取动作 (从画面中提取 [0-N秒] 标记)
    const actionSegments = [];
    const actionRegex = /[（(]([\d.]+)-([\d.]+)秒[)）]\s*[,，]?\s*([^()（）\n]+)/g;
    let am;
    while ((am = actionRegex.exec(visual)) !== null) {
        actionSegments.push(`(${am[1]}-${am[2]}秒) ${am[3].trim()}`);
    }
    const action = actionSegments.join(' / ');
    // 灯光
    const lightingMatch = trimmed.match(LIGHTING_PATTERN);
    const lighting = lightingMatch ? (lightingMatch[1] || lightingMatch[2] || '').trim() : '';
    // 色彩
    const colorMatch = trimmed.match(COLOR_PATTERN);
    const colorTone = colorMatch ? colorMatch[1].trim() : '';
    // 音效
    const audioMatch = trimmed.match(AUDIO_PATTERN);
    const audioNote = audioMatch ? audioMatch[1].trim() : '';
    // 转场
    const transitionMatch = trimmed.match(TRANSITION_PATTERN);
    const transition = transitionMatch ? transitionMatch[0] : '';
    // image_prompt (可能跨行)
    const imagePromptMatch = trimmed.match(IMAGE_PROMPT_PATTERN);
    const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim().replace(/\n+/g, ' ') : '';
    return {
        shotNumber,
        durationSec,
        sceneType: sceneTypeMatch ? sceneTypeMatch[0] : '',
        composition: compositionMatch ? compositionMatch[0] : '',
        cameraMove,
        visual,
        dialogue,
        dialogueLines,
        action: action || visual, // 没有明确时间分段就用整个画面作为动作
        lighting,
        colorTone,
        audioNote,
        transition,
        imagePrompt,
        rawText: trimmed,
        isHeader: false,
    };
}
/**
 * 判断段落是否是开场白/元数据
 */
function isMetaParagraph(seg) {
    const t = seg.trim();
    if (!t)
        return true;
    // 短段落 (无镜头标识)
    if (!t.match(/【?镜头\d+/))
        return true;
    // 包含"好的"、"以下是"等开场白特征
    if (t.match(/^好的[，,。\s]/) || t.includes('以下是') || t.includes('开始生成'))
        return true;
    // 长度太短
    if (t.length < 50)
        return true;
    return false;
}
/**
 * 解析整段 AI 输出
 * 返回结构化分镜列表 (自动过滤开场白)
 */
function parseShotList(rawText) {
    const trimmed = rawText.trim();
    // 按 --- 分割
    const segments = trimmed.split(/---+/).filter(s => s.trim().length > 0);
    if (segments.length === 0)
        return [];
    const parsed = [];
    let realIndex = 0;
    for (const seg of segments) {
        if (isMetaParagraph(seg))
            continue;
        realIndex++;
        parsed.push(parseShotSegment(seg, realIndex - 1));
    }
    // 重写 shotNumber 从 1 开始连续
    parsed.forEach((p, i) => { p.shotNumber = i + 1; });
    return parsed;
}
/**
 * 按场景分组 (基于 location 字段, 或者从 description 中提取)
 */
function groupShotsByScene(shots) {
    const groups = new Map();
    for (const shot of shots) {
        // 从 visual 提取第一个场景提及, 或者用 sceneType
        let loc = '';
        // 简单提取: visual 第一句前 12 字符 (作为场景标识)
        const firstSentence = shot.visual.split(/[，。]/)[0] || '';
        loc = firstSentence.length > 12 ? firstSentence.slice(0, 12) : firstSentence;
        if (!loc)
            loc = '通用场景';
        if (!groups.has(loc))
            groups.set(loc, []);
        groups.get(loc).push(shot);
    }
    return Array.from(groups.entries()).map(([location, shots]) => ({
        location,
        shots,
        totalDuration: shots.reduce((sum, s) => sum + s.durationSec, 0),
    }));
}
