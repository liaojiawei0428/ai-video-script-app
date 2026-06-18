/**
 * 角色类型自动检测器
 *
 * 根据描述丰度、名字出现频率、性格特征等信号自动判断主角/配角/路人
 * 用于在 prompt-builder 中动态调节字段详细度
 */

export type RoleType = 'protagonist' | 'supporting' | 'background';

export interface RoleSignals {
  /** 描述字符数 */
  descriptionLength: number;
  /** 在小说/剧本中出现的次数 */
  mentionCount: number;
  /** 是否有独立人称代词专属指代 */
  hasUniquePronoun: boolean;
  /** 是否有核心戏剧冲突 (复仇/爱/恨/责任) */
  hasCoreConflict: boolean;
  /** 描述中是否包含 "主角/主人公/center/hero" 等标记 */
  hasExplicitProtagonistTag: boolean;
  /** 是否被其他角色描述中反复提及 */
  referencedByOthers: number;
}

export interface RoleDetectionResult {
  role: RoleType;
  confidence: number; // 0-1
  signals: RoleSignals;
  boostFactor: number; // 用于 prompt 详细度加权
}

/**
 * 主角判定阈值
 */
const PROTAGONIST_THRESHOLDS = {
  descriptionLength: 500,    // >= 500 字符
  mentionCount: 15,          // >= 15 次
  hasCoreConflictWeight: 0.3,
  hasExplicitTagWeight: 0.5,
};

const SUPPORTING_THRESHOLDS = {
  descriptionLength: 200,    // >= 200 字符
  mentionCount: 3,           // >= 3 次
};

export function detectRole(signals: RoleSignals): RoleDetectionResult {
  let protagonistScore = 0;
  let supportingScore = 0;

  // 信号1: 描述长度
  if (signals.descriptionLength >= PROTAGONIST_THRESHOLDS.descriptionLength) {
    protagonistScore += 0.4;
  } else if (signals.descriptionLength >= SUPPORTING_THRESHOLDS.descriptionLength) {
    supportingScore += 0.3;
  }

  // 信号2: 出现频率
  if (signals.mentionCount >= PROTAGONIST_THRESHOLDS.mentionCount) {
    protagonistScore += 0.3;
  } else if (signals.mentionCount >= SUPPORTING_THRESHOLDS.mentionCount) {
    supportingScore += 0.2;
  }

  // 信号3: 核心冲突
  if (signals.hasCoreConflict) {
    protagonistScore += PROTAGONIST_THRESHOLDS.hasCoreConflictWeight;
  }

  // 信号4: 显式标签
  if (signals.hasExplicitProtagonistTag) {
    protagonistScore += PROTAGONIST_THRESHOLDS.hasExplicitTagWeight;
  }

  // 信号5: 独立代词
  if (signals.hasUniquePronoun) {
    protagonistScore += 0.15;
  }

  // 信号6: 被其他角色引用
  if (signals.referencedByOthers >= 5) {
    protagonistScore += 0.2;
  } else if (signals.referencedByOthers >= 2) {
    supportingScore += 0.15;
  }

  // 判定
  if (protagonistScore >= 0.5) {
    return {
      role: 'protagonist',
      confidence: Math.min(protagonistScore, 1),
      signals,
      boostFactor: 1.5,
    };
  }

  if (protagonistScore + supportingScore >= 0.4) {
    return {
      role: 'supporting',
      confidence: Math.min(supportingScore, 1),
      signals,
      boostFactor: 1.2,
    };
  }

  return {
    role: 'background',
    confidence: 1 - (protagonistScore + supportingScore),
    signals,
    boostFactor: 0.8,
  };
}

/**
 * 从角色描述文本中粗略提取信号
 * 启发式: 不调用 LLM，纯字符串分析
 */
export function extractSignalsFromDescription(
  description: string,
  options: Partial<RoleSignals> = {}
): RoleSignals {
  const text = description || '';
  const length = text.length;

  // 核心冲突关键词 (中英双语, 覆盖常见套路)
  const conflictKeywords = [
    '复仇', 'rengeance', 'revenge', '报仇',
    '爱情', 'love', 'romance', '挚爱',
    '仇恨', 'hatred', 'hate', '恨',
    '责任', 'duty', 'responsibility', '担当',
    '救赎', 'redemption', '赎罪',
    '成长', 'growth', 'coming-of-age',
    '使命', 'mission', '天命',
    '命运', 'destiny', 'fate',
    '暴君', 'tyrant', '暴虐', '阴鸷',
    '背叛', 'betrayal', '反目',
    '牺牲', 'sacrifice', '献身',
    '守护', 'protect', '护卫',
    '灭门', '灭族', '灭国',
    '篡位', '夺权', 'coup',
    '逃离', 'escape', 'flee',
  ];
  const hasCoreConflict = conflictKeywords.some(k =>
    text.toLowerCase().includes(k.toLowerCase())
  );

  // 显式主角标签
  const protagonistTags = ['主角', '主人公', 'protagonist', 'hero', 'main character', 'mc'];
  const hasExplicitProtagonistTag = protagonistTags.some(t =>
    text.toLowerCase().includes(t.toLowerCase())
  );

  // 启发式 mentionCount 估算: 描述越长, 出场越多 (但有上限)
  // 主角 description 通常 1000+ 字符 → mentionCount 50+
  // 配角 description 500-800 字符 → mentionCount 10-20
  // 路人 description < 300 字符 → mentionCount 1-5
  let estimatedMentions: number;
  if (length >= 1000) {
    estimatedMentions = 50;
  } else if (length >= 500) {
    estimatedMentions = Math.max(15, Math.floor(length / 30));
  } else if (length >= 200) {
    estimatedMentions = Math.max(5, Math.floor(length / 40));
  } else {
    estimatedMentions = 1;
  }

  return {
    descriptionLength: length,
    mentionCount: options.mentionCount ?? estimatedMentions,
    hasUniquePronoun: options.hasUniquePronoun ?? false,
    hasCoreConflict,
    hasExplicitProtagonistTag,
    referencedByOthers: options.referencedByOthers ?? 0,
  };
}
