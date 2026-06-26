-- BUG-103 (S72 batch 8 后置 3, 2026-06-26): 撤销 h773052122 错误退款 34.93 元
-- 背景: novel "没钱修什么仙" analyze 失败触发 refundStep 自动退 34.93 元, 实际 user 没付款不该退
-- 修法:
--   1. 保留 billing_logs 记录 + 加 ref_label audit trail ("已撤销: BUG-103 admin manual 撤销 2026-06-26")
--   2. user.balance 减 34.93
--   3. 配套 (后续 commit): 删 refundStep 退款功能, 改人工 (跟 BUG-072 D 长期方案一致)

-- 1. audit trail: 加 ref_label 标记保留记录
UPDATE billing_logs
SET ref_label = CONCAT('[已撤销 BUG-103 admin manual 2026-06-26] ', ref_label)
WHERE id = '1c1aacef-a4e7-472d-9842-dacd303f4965';

-- 2. user.balance 减 34.93 (从 35.07 → 0.14)
UPDATE users
SET balance = ROUND(balance - 34.93, 2), updated_at = UNIX_TIMESTAMP() * 1000
WHERE id = '3b3aa45d-54d0-449a-bc99-7a804ab9d62e';

-- 3. 验证
SELECT 'user_after_revert' AS label;
SELECT id, username, balance, FROM_UNIXTIME(updated_at/1000) AS updated FROM users WHERE id = '3b3aa45d-54d0-449a-bc99-7a804ab9d62e';
SELECT 'revert_billing_log' AS label;
SELECT id, type, amount, balance_after, LEFT(ref_label, 80) AS label FROM billing_logs WHERE id = '1c1aacef-a4e7-472d-9842-dacd303f4965';
SELECT 'full_billing_after_revert' AS label;
SELECT id, type, amount, balance_after, LEFT(ref_label, 50) AS label, FROM_UNIXTIME(created_at/1000) AS ts FROM billing_logs WHERE user_id = '3b3aa45d-54d0-449a-bc99-7a804ab9d62e' ORDER BY created_at;
