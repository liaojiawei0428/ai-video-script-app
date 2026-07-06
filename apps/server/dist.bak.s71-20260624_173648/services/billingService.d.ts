import { BillingLog } from '../shared/types';
/** 定价标准 */
declare const PRICING: {
    standard: {
        analyze: number;
        shot: number;
        comic: number;
    };
    vip: {
        analyze: number;
        shot: number;
        comic: number;
    };
    minCharge: number;
};
export declare const VIDEO_CHARGING_MATRIX: {
    readonly standard: {
        readonly 5: 0;
        readonly 10: 0.1;
        readonly 15: 0.1;
    };
    readonly vip: {
        readonly 5: 0;
        readonly 10: 0;
        readonly 15: 0.1;
    };
};
export declare const IMAGE_DAILY_QUOTA_STANDARD = 30;
export declare const IMAGE_DAILY_QUOTA_VIP: number;
export declare const CHARACTER_VARIANT_PRICE = 0.1;
/**
 * v3.0.0.31 (S51): 视频计费查表
 * @param isVip true=VIP 5s+10s 免费, 15s 仍 0.1; false=普通 5s 免费, 10s+15s 各 0.1
 * @param durationSec 视频时长秒 (5/10/15, 兜底 15)
 */
export declare function chargingForVideo(isVip: boolean, durationSec: number): number;
/**
 * v3.0.0.31 (S51): VIP 状态检查 (export, 让 image/video agent 调)
 */
export declare function isVipActive(user: any): boolean;
export declare class BillingService {
    /** 获取用户定价档位 */
    getUserPricing(userId: string): Promise<{
        isVip: boolean;
        unitPrice: number;
        shotPrice: number;
        comicPrice: number;
    }>;
    getPricing(): typeof PRICING & {
        slogan: string;
        breakup: any;
    };
    /** 预估费用 */
    estimate(novelId: string, totalChars: number, totalEpisodes: number): Promise<{
        analyzeFee: number;
        shotFee: number;
        total: number;
        balance: number;
        isVip: boolean;
    }>;
    /** 余额守门——调用 API 前检查余额，不足则强制停止并通知客户端 */
    guardBalance(novelId: string, taskId: string, stage: 'analyze' | 'episode' | 'shot' | 'comic', wordCount?: number, pageCount?: number): Promise<void>;
    /** 实际扣费（余额守门通过后调用） */
    chargeStep(novelId: string, stage: 'analyze' | 'episode' | 'shot' | 'comic', wordCount?: number, pageCount?: number): Promise<boolean>;
    topUp(userId: string, amount: number, description: string): Promise<{
        balanceAfter: number;
        logId: string;
    }>;
    /**
     * v3.0.32 BUG-078 S71: 统一记录消费/免费日志 (web 账单明细核心)
     * 所有生成服务 (novel analyze / episode / shot / comic / character variant / image / video / prompt optimize) 都走这个入口
     * - amount=0 时: 免费额度内 / VIP免费 / 活动赠送, is_free=1
     * - amount>0 时: 实际扣费, is_free=0
     * @returns { balanceAfter, logId, isFree } 或 null (余额不足)
     */
    recordConsumption(userId: string, opts: {
        refType: 'novel_analyze' | 'episode' | 'shot' | 'comic' | 'character_variant' | 'image' | 'video' | 'prompt_optimize' | 'recharge' | 'refund' | string;
        refId: string;
        refLabel: string;
        amount: number;
        isFree?: boolean;
        description?: string;
        wordCount?: number;
        pageCount?: number;
        novelId?: string;
    }): Promise<{
        balanceAfter: number;
        logId: string;
        isFree: boolean;
    } | null>;
    /**
     * v3.0.32 BUG-078 S71: web 端账单明细 API (含充值 + 消费 + 免费)
     * @param userId 用户 ID
     * @param opts { limit, offset, type?, refType? } 筛选
     */
    getTransactions(userId: string, opts?: {
        limit?: number;
        offset?: number;
        type?: string;
        refType?: string;
    }): Promise<{
        items: BillingLog[];
        total: number;
    }>;
    /**
     * v3.0.31 (S69 BUG-072 B): 用户今日已成功生图数 (UNION 3 表)
     * 1. image_generations JOIN image_conversations (S51 原有, t2i/i2i/multiRef 生图)
     * 2. characters JOIN novels (角色三视图, characterService.generateImageVariants, characters 表没 user_id, JOIN novels)
     * 3. shots JOIN episodes JOIN novels (镜头图, characterService.generateImageForShot)
     * created_at >= 今天 0 点
     */
    imageDailyCount(userId: string): Promise<number>;
    /**
     * v3.0.31 (S69 BUG-072 B): 检查用户生图配额 (供 characterService 调, 普通用户超 30 抛错)
     * VIP 无限 (Infinity)
     */
    checkImageQuota(userId: string): Promise<{
        allowed: boolean;
        used: number;
        quota: number | 'unlimited';
    }>;
    /**
     * v3.0.0.31 (S51): 用户今日已成功生成视频数
     * 查 video_generations JOIN video_conversations (拿 user_id), status='completed' 才算成功
     */
    videoDailyCount(userId: string): Promise<number>;
    /**
     * v3.0.0.31 (S51): 生图扣费 (现在免费 amount=0, 仍写 audit log)
     * @returns balanceAfter
     */
    chargeImage(userId: string, amount: number, description: string, conversationId?: string, refType?: string, refLabel?: string): Promise<{
        balanceAfter: number;
        logId: string;
    } | null>;
    /**
     * v3.0.0.31 (S51): 视频扣费 (按 chargingForVideo 矩阵)
     * v3.0.32 BUG-078 S71: 走统一 recordConsumption 入口
     * @returns balanceAfter 或 null (余额不足)
     */
    chargeVideo(userId: string, durationSec: number, isVip: boolean, conversationId?: string): Promise<{
        balanceAfter: number;
        chargedAmount: number;
        logId: string;
    } | null>;
}
export declare const billingService: BillingService;
export {};
