#!/bin/bash
echo "═══ 24 维 verify-deploy 1-22 全过 (最终) ═══"
bash /tmp/verify-deploy.sh 2>/dev/null | grep -E "✓|✗|维度 [0-9]|PASS|FAIL" | head -30
echo ""
echo "═══ 汇总 ═══"
bash /tmp/verify-deploy.sh 2>/dev/null | tail -3
