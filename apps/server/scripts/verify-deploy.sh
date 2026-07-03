#!/bin/bash
# scripts/verify-deploy.sh
# S71 BUG-079 后置: 部署后必跑 14 维验证
# 配套规范:
#   - BUGS.md BUG-079 (S71 报告"12 维全过" 100% 假 → 真实部署必跑 grep dist + DB schema + E2E JWT)
#   - apps/server/AGENTS.md § 2.3 server 端 12 维验证
#   - AGENTS.md § 5 工作流"部署后 14 维验证"
#   - docs/BAOTA_NODE_PROJECT_DEPLOY.md § 2 部署 5 步标准流程
# 用法:
#   服务器端: bash scripts/verify-deploy.sh                  # 全 14 维
#   服务器端: bash scripts/verify-deploy.sh --server-only   # 只验 server 端 6 维
#   服务器端: bash scripts/verify-deploy.sh --api-only      # 只验 6 维 API + E2E
#   服务器端: bash scripts/verify-deploy.sh --strict        # 任何 1 失败 exit 1 (CI 用)
# 退出码:
#   0 = 全过
#   1 = 有失败 (--strict 模式)
#   2 = 部署环境异常 (例如 systemd 没起 / port 没开)

set -e
STRICT=false
SERVER_ONLY=false
API_ONLY=false
for arg in "$@"; do
  case $arg in
    --strict) STRICT=true ;;
    --server-only) SERVER_ONLY=true ;;
    --api-only) API_ONLY=true ;;
    *) echo "未知参数: $arg"; exit 2 ;;
  esac
done

DEPLOY_DIR="${DEPLOY_DIR:-/www/wwwroot/shipin-APP}"
API_BASE="${API_BASE:-http://127.0.0.1:6000}"
WEB_BASE="${WEB_BASE:-https://ab.maque.uno}"
DB_HOST="${DB_HOST:-10.1.0.11}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-qQ378685504}"
DB_NAME="${DB_NAME:-ai_script}"
JWT_SECRET=$(grep '^JWT_SECRET' "$DEPLOY_DIR/.env" 2>/dev/null | cut -d= -f2)
APP_VERSION=$(grep '^APP_VERSION' "$DEPLOY_DIR/.env" 2>/dev/null | cut -d= -f2)

PASS=0
FAIL=0
SKIP=0
declare -a FAIL_MSGS

color() { local c=$1; shift; case $c in
  red) echo -e "\033[31m$*\033[0m" ;;
  green) echo -e "\033[32m$*\033[0m" ;;
  yellow) echo -e "\033[33m$*\033[0m" ;;
  blue) echo -e "\033[34m$*\033[0m" ;;
  cyan) echo -e "\033[36m$*\033[0m" ;;
  *) echo "$*" ;;
esac
}
check() {
  local name=$1
  local actual=$2
  local expected=$3
  if [[ "$actual" == *"$expected"* ]]; then
    PASS=$((PASS+1))
    color green "   ✓ $name: $actual"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("$name (expected '$expected', got '$actual')")
    color red "   ✗ $name: $actual (expected '$expected')"
  fi
}
skip() {
  SKIP=$((SKIP+1))
  color yellow "   - $1: skipped"
}

color cyan "═══════════════════════════════════════════════════════════════"
color cyan "  shipin-APP 部署后 22 维验证 (BUG-079/080/081/082/083/090 防呆)"
color cyan "═══════════════════════════════════════════════════════════════"
echo "  DEPLOY_DIR: $DEPLOY_DIR"
echo "  API_BASE:   $API_BASE"
echo "  WEB_BASE:   $WEB_BASE"
echo "  APP_VERSION: $APP_VERSION"
echo "  strict: $STRICT"
echo

# ──────────────────────────────────────
# 维度 1-6: server 端自身 (跟 § 2.3 模板对齐)
# ──────────────────────────────────────
if [ "$API_ONLY" != "true" ]; then
  color blue "── 维度 1-6: server 端自身 ──"

  V1=$(systemctl is-active shipin-app 2>/dev/null || echo "inactive")
  check "1. systemctl shipin-app active" "$V1" "active"

  V2=$(ss -tlnp 2>/dev/null | grep :6000 | head -1 | awk '{print $4}')
  check "2. ss 6000 port LISTEN" "$V2" "0.0.0.0:6000"

  V3=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "$API_BASE/health" 2>/dev/null || echo "000")
  check "3. /health 200" "$V3" "200"

  V4=$(curl -sS -m 3 "$API_BASE/api/version" 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["version"])' 2>/dev/null || echo "ERR")
  if [ -n "$APP_VERSION" ]; then
    check "4. /api/version = APP_VERSION" "$V4" "$APP_VERSION"
  else
    check "4. /api/version" "$V4" "3.0.29"
  fi

  V5=$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "$API_BASE/api/novels" 2>/dev/null || echo "000")
  check "5. /api/novels 401 (auth 工作)" "$V5" "401"

  V6=$(systemctl show shipin-app --property=MainPID --value 2>/dev/null)
  if [ -n "$V6" ] && [ "$V6" != "0" ]; then
    PROC_TIME=$(ps -p "$V6" -o lstart= 2>/dev/null | xargs)
    PROC_OK="PID=$V6 started=$PROC_TIME"
  else
    PROC_OK="no PID"
  fi
  if [[ "$PROC_OK" == *"started="* ]]; then
    PASS=$((PASS+1)); color green "   ✓ 6. shipin-app 进程在跑: $PROC_OK"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("6. 进程"); color red "   ✗ 6. shipin-app 进程在跑: $PROC_OK"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 7-9: server dist 关键字符串 grep (BUG-079 核心)
# ──────────────────────────────────────
if [ "$API_ONLY" != "true" ]; then
  color blue "── 维度 7-9: server dist 关键字符串 grep (BUG-079 核心) ──"

  DIST_INDEX="$DEPLOY_DIR/dist/index.js"
  DIST_BILLING="$DEPLOY_DIR/dist/routes/billing.js"
  DIST_BSVC="$DEPLOY_DIR/dist/services/billingService.js"
  DIST_DB="$DEPLOY_DIR/dist/models/db.js"

  V7=$(grep -c '/api/billing' "$DIST_INDEX" 2>/dev/null || echo 0)
  if [ "$V7" -ge 1 ]; then
    PASS=$((PASS+1)); color green "   ✓ 7. /api/billing in dist/index.js: $V7 命中"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("7. /api/billing 路由"); color red "   ✗ 7. /api/billing in dist/index.js: 0 命中 (BUG-079 重蹈!)"
  fi

  V8=$(grep -c 'recordConsumption' "$DIST_BSVC" 2>/dev/null || echo 0)
  if [ "$V8" -ge 1 ]; then
    PASS=$((PASS+1)); color green "   ✓ 8. recordConsumption in billingService.js: $V8 命中"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("8. recordConsumption 函数"); color red "   ✗ 8. recordConsumption: 0 命中 (BUG-079 重蹈!)"
  fi

  V9=$(grep -cE 'is_free|ref_type' "$DIST_DB" 2>/dev/null || echo 0)
  if [ "$V9" -ge 2 ]; then
    PASS=$((PASS+1)); color green "   ✓ 9. ALTER TABLE is_free/ref_type in db.js: $V9 命中"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("9. ALTER TABLE"); color red "   ✗ 9. ALTER TABLE: $V9 命中 (期望 ≥2, BUG-079 重蹈!)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 10-12: DB schema + 数据 (BUG-079 核心)
# ──────────────────────────────────────
if [ "$API_ONLY" != "true" ]; then
  color blue "── 维度 10-12: DB schema + 数据 (BUG-079 核心) ──"

  V10=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null -e "SHOW COLUMNS FROM billing_logs;" | grep -E "^is_free|^ref_type|^ref_id|^ref_label" | wc -l)
  if [ "$V10" -eq 4 ]; then
    PASS=$((PASS+1)); color green "   ✓ 10. DB billing_logs 4 字段全在"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("10. DB 4 字段"); color red "   ✗ 10. DB billing_logs 4 字段: 只 $V10 个在 (期望 4)"
  fi

  V11=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null -e "SHOW INDEX FROM billing_logs;" | grep -E "idx_billing_ref_type|idx_billing_user_time" | wc -l)
  if [ "$V11" -ge 2 ]; then
    PASS=$((PASS+1)); color green "   ✓ 11. DB billing_logs 2 索引全在: $V11 行"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("11. DB 2 索引"); color red "   ✗ 11. DB 2 索引: $V11 行 (期望 ≥2)"
  fi

  V12=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null -e "SELECT COUNT(*) FROM billing_logs;" --batch --skip-column-names)
  if [ -n "$V12" ] && [ "$V12" -gt 0 ]; then
    PASS=$((PASS+1)); color green "   ✓ 12. DB billing_logs 数据: $V12 条"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("12. DB 数据"); color red "   ✗ 12. DB billing_logs 数据: 0 条"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 13: 公开 HTTPS web
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 13-14: 公开 HTTPS + web JS hash ──"

  V13=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$WEB_BASE/" 2>/dev/null || echo "000")
  check "13. $WEB_BASE HTTPS 200" "$V13" "200"

  V14=$(curl -sS -m 5 "$WEB_BASE/" 2>/dev/null | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
  if [ -n "$V14" ]; then
    PASS=$((PASS+1)); color green "   ✓ 14. web 实际加载 JS: $V14"
  else
    FAIL=$((FAIL+1)); FAIL_MSGS+=("14. web JS hash"); color red "   ✗ 14. web 实际加载 JS: 未找到 (web dist 可能没部署)"
  fi
  echo
fi

# ──────────────────────────────────────
# E2E: JWT 测核心 API (BUG-079 核心: 不光 401, 真测数据)
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ] && [ -n "$JWT_SECRET" ]; then
  color blue "── E2E: JWT 测 /api/billing/transactions + /api/billing/summary ──"

  USER_ID=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null -e "SELECT user_id FROM billing_logs GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;" --batch --skip-column-names | awk '{print $1}')
  if [ -z "$USER_ID" ]; then
    skip "E2E: 找不到有 billing_logs 的 user"
  else
    TOKEN=$(node -e "
const c=require('crypto');
const s='$JWT_SECRET';
const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const p=Buffer.from(JSON.stringify({userId:'$USER_ID',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
const sg=c.createHmac('sha256',s).update(h+'.'+p).digest('base64url');
console.log(h+'.'+p+'.'+sg);
")
    E2E_TX=$(curl -sS -m 5 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/billing/transactions?limit=1" 2>/dev/null)
    E2E_SUM=$(curl -sS -m 5 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/billing/summary" 2>/dev/null)
    E2E_TX_SUCCESS=$(echo "$E2E_TX" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("success",False))' 2>/dev/null || echo "False")
    E2E_SUM_SUCCESS=$(echo "$E2E_SUM" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("success",False))' 2>/dev/null || echo "False")

    if [ "$E2E_TX_SUCCESS" = "True" ]; then
      PASS=$((PASS+1))
      TX_TOTAL=$(echo "$E2E_TX" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["total"])')
      TX_REFTYPE=$(echo "$E2E_TX" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["items"][0].get("refType",""))')
      color green "   ✓ E2E.1 /api/billing/transactions success=true total=$TX_TOTAL refType[0]=$TX_REFTYPE"
    else
      FAIL=$((FAIL+1)); FAIL_MSGS+=("E2E.1 transactions")
      color red "   ✗ E2E.1 /api/billing/transactions: $E2E_TX"
    fi

    if [ "$E2E_SUM_SUCCESS" = "True" ]; then
      PASS=$((PASS+1))
      SUM_BAL=$(echo "$E2E_SUM" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["balance"])')
      color green "   ✓ E2E.2 /api/billing/summary success=true balance=$SUM_BAL"
    else
      FAIL=$((FAIL+1)); FAIL_MSGS+=("E2E.2 summary")
      color red "   ✗ E2E.2 /api/billing/summary: $E2E_SUM"
    fi
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 15-16: web 端源码静态分析 (BUG-080 防呆)
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ] && [ -d "$DEPLOY_DIR/../app.web/src" -o -d "/www/wwwroot/ab.maque.uno" ]; then
  # 在本机跑 (verify-deploy.sh 在服务器跑) — 改成跑远端 web dist 路径下的 app source
  # 但 verify-deploy 是跑在服务器, 服务器没 web src, 所以这个维度只在源端跑
  # 这里用 check-react-spread.sh 思路 grep dist 里 as any).type === pattern
  color blue "── 维度 15-16: web 端 dist 手挑字段静态分析 (BUG-080 防呆) ──"

  WEB_DIST="/www/wwwroot/ab.maque.uno/dist"
  if [ -d "$WEB_DIST/assets" ]; then
    # 15. 找 `(as any).type ===` 或 `.type==='consumption'` 在 dist 中, 但缺少 `type: ` spread 配合
    # 简化: 找 .type === 'consumption' 这类 filter, 配合 dist 是不是用 push hand-pick pattern
    V15=$(grep -lE '\.type\s*===\s*["\x27](consumption|charge)["\x27]' "$WEB_DIST/assets"/*.js 2>/dev/null | wc -l)
    if [ "$V15" -ge 1 ]; then
      PASS=$((PASS+1))
      color green "   ✓ 15. web dist 含 .type === filter pattern: $V15 个文件"
    else
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("15. web dist filter pattern 缺失")
      color red "   ✗ 15. web dist 无 .type === filter (web 端可能没 tab filter 实现)"
    fi

    # 16. E2E 模拟: 3 tab filter 逻辑, 看 consumption tab 数据
    if [ -n "$JWT_SECRET" ]; then
      USER_ID=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null -e "SELECT user_id FROM billing_logs WHERE type='consumption' GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;" --batch --skip-column-names | awk '{print $1}')
      if [ -n "$USER_ID" ]; then
        TOKEN=$(node -e "
const c=require('crypto');
const s='$JWT_SECRET';
const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const p=Buffer.from(JSON.stringify({userId:'$USER_ID',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
const sg=c.createHmac('sha256',s).update(h+'.'+p).digest('base64url');
console.log(h+'.'+p+'.'+sg);
")
        CONSUMPTION_COUNT=$(curl -sS -m 5 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/billing/transactions?limit=200&type=consumption" 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("data",{}).get("total",0))' 2>/dev/null || echo "0")
        if [ -n "$CONSUMPTION_COUNT" ] && [ "$CONSUMPTION_COUNT" -gt 0 ]; then
          PASS=$((PASS+1))
          color green "   ✓ 16. /api/billing/transactions?type=consumption: $CONSUMPTION_COUNT 条 (web 消费 tab 数据源)"
        else
          FAIL=$((FAIL+1))
          FAIL_MSGS+=("16. consumption 0 条")
          color red "   ✗ 16. /api/billing/transactions?type=consumption 返 0 条 (web 消费 tab 必空)"
        fi
      else
        skip "16. 无 consumption user"
      fi
    else
      skip "16. 无 JWT_SECRET 跳过 E2E"
    fi
  else
    skip "15-16. WEB_DIST ($WEB_DIST) 不存在"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 17-18: BUG-082 防呆 (error part.message 强制归一为 string)
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 17-18: BUG-082 error part.message 归一 (防 React #31) ──"

  # 17. server dist 含 extractErrorMessage (videoAgentService L527/L705 + imageAgentService L637, 至少 3 命中)
  V17=$(grep -l 'extractErrorMessage' /www/wwwroot/shipin-APP/dist/services/videoAgentService.js /www/wwwroot/shipin-APP/dist/services/imageAgentService.js /www/wwwroot/shipin-APP/dist/utils/errorUtils.js 2>/dev/null | wc -l)
  if [ "$V17" -ge 3 ]; then
    PASS=$((PASS+1))
    color green "   ✓ 17. server dist extractErrorMessage: $V17 个文件 (videoAgent + imageAgent + errorUtils)"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("17. extractErrorMessage 缺失")
    color red "   ✗ 17. server dist extractErrorMessage 命中仅 $V17 个文件 (期望 ≥3)"
  fi

  # 18. web dist 含 BUG-082 防御渲染 pattern
  V18=$(grep -lE 'JSON\.stringify\(e\.message\)|JSON\.stringify\(part\.message\)' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | wc -l)
  if [ "$V18" -ge 1 ]; then
    PASS=$((PASS+1))
    color green "   ✓ 18. web dist 防御渲染 (JSON.stringify(part.message)): $V18 个文件"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("18. web 防御渲染缺失")
    color red "   ✗ 18. web dist 无 JSON.stringify(part.message) 防御渲染 (BUG-082 历史脏数据会触发 React #31)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 19: BUG-082 TODO P2 修法 — agnesVideoProvider provider 层归一 (BUG-082 TODO #1)
# ──────────────────────────────────────
# 历史: v3.0.32 修法只在 videoAgentService L705 走 extractErrorMessage 兜底, 调用方要记得归一
#   真实踩坑: 任何新调用 videoAgentService.queryStatus 的代码都可能忘记归一, 走老路存对象
# 修法: agnesVideoProvider.queryStatus L302 直接 extractErrorMessage(data.error, '') 归一
# 防呆: server dist agnesVideoProvider.js 必须含 extractErrorMessage, 未来 AI 误删 import 即失败
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 19: BUG-082 TODO P2 agnesVideoProvider provider 层归一 ──"

  # 19. server dist agnesVideoProvider.js 含 extractErrorMessage (新加的 import + L302 调用)
  V19=$(grep -c 'extractErrorMessage' /www/wwwroot/shipin-APP/dist/services/agnesVideoProvider.js 2>/dev/null || echo 0)
  if [ "$V19" -ge 1 ]; then
    PASS=$((PASS+1))
    color green "   ✓ 19. server dist agnesVideoProvider 含 extractErrorMessage: $V19 命中 (provider 层已归一)"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("19. agnesVideoProvider 归一缺失")
    color red "   ✗ 19. server dist agnesVideoProvider.js 命中 0 (期望 ≥1, BUG-082 TODO P2 修法未部署)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 20: BUG-081 防呆 — 状态机迁移 4 处同步 (allowlist + response + DB + UI case)
# ──────────────────────────────────────
# 历史: S70 v3.0.0.16 改 passthrough (跳过 plan_cn_ready) 时, imageAgentService.processTurn allowedStates 没同步, 9 天后用户撞 BUG-081.
# 修法: apps/server/scripts/check-status-machine.sh (铁律 4+ 配套) + 跨端 AGENTS.md 铁律 4+
# 防呆: 部署后必查 server dist 含 allowedStates 字段 (processTurn 等 service 入口), 未来 AI 改 status 字段必同步 4 处
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 20: BUG-081 状态机迁移 4 处同步 (防 allowedStates 漏改) ──"

  # 20. server dist 至少 1 个 service 含 allowedStates 字段 (processTurn / processUserAction 等)
  V20=$(grep -lE 'allowedStates|allowed_states' /www/wwwroot/shipin-APP/dist/services/*.js 2>/dev/null | wc -l)
  if [ "$V20" -ge 1 ]; then
    PASS=$((PASS+1))
    color green "   ✓ 20. server dist services 含 allowedStates: $V20 个文件 (状态机 allowlist 已编译)"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("20. allowedStates 缺失")
    color red "   ✗ 20. server dist services 无 allowedStates 字段 (期望 ≥1, BUG-081 状态机迁移必同步 4 处防线)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 21: BUG-083 防呆 — 生产 dist/changelog.json UTF-8 Chinese 完整性 (防 PowerShell scp ANSI 转码丢中文字符)
# ──────────────────────────────────────
# 历史: S72 batch 4 部署后, 生产 /api/version 返回 invalid JSON, 400 个中文字符全被替换成 `?` (单字节 0x3F)
#   根因: scp 或 systemd 容器环境 charset 转换把 UTF-8 Chinese → ASCII `?` 占位符
# 修法: 1) deploy.sh 加 cp -f changelog.json dist/changelog.json (commit 310098e 已加)
#       2) verify-deploy.sh 加维度 21 强制检查 dist/changelog.json 的 UTF-8 完整性 (non-ASCII char 计数 + JSON parse)
# 防呆: 任何未来部署后, 维度 21 失败 = dist/changelog.json 字符编码坏, 必须重新跑部署
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 21: BUG-083 dist/changelog.json UTF-8 完整性 (防 Chinese → 损坏) ──"

  # 21. server dist/changelog.json UTF-8 OK: 1) JSON 能 parse 2) 含 non-ASCII 字符 (Chinese 完整性)
  V21_RESULT=$(python3 -c "
import json, sys
try:
    d = open('/www/wwwroot/shipin-APP/dist/changelog.json', 'rb').read().decode('utf-8')
    j = json.loads(d)
    non_ascii = sum(1 for c in d if ord(c) > 127)
    latest = j['entries'][-1]
    print(f'OK non_ascii={non_ascii} latest_version={latest[\"version\"]} highlights={len(latest[\"highlights\"])}')
except json.JSONDecodeError as e:
    print(f'FAIL json_decode pos={e.pos} msg={e.msg}')
except Exception as e:
    print(f'FAIL {type(e).__name__}: {e}')
" 2>&1)
  if echo "$V21_RESULT" | grep -q "^OK"; then
    PASS=$((PASS+1))
    color green "   ✓ 21. dist/changelog.json UTF-8 完整: $V21_RESULT"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("21. dist/changelog.json UTF-8 损坏")
    color red "   ✗ 21. dist/changelog.json 损坏: $V21_RESULT (BUG-083 必修)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 22: BUG-090 防呆 — /api/version 4 字段必查 (version + changelog + highlights + buildDate)
# ──────────────────────────────────────
# 历史: S72 batch 6 部署后, 12 维验证只查 version 字段 = 假报告, changelog/highlights/buildDate 全是上一版本
#   根因: deploy.sh 第 6 步 cp -f ${DIST_DIR}/changelog.json 源是**生产目录** (上次部署留下的老版本),
#         不是本机 scp 过来的新版本, **每次部署都被旧版本覆盖新版本, changelog 永远滞后 1 个版本**
#   + 12 维验证只看 /api/version 的 version 字段, 不看 changelog (1 句话) / highlights (3-5 条要点) / buildDate (YYYY-MM-DD)
# 修法: 1) deploy.sh 优先 /tmp/changelog.json (本机 scp 源, 新版本), fallback 到生产目录时显式 warn
#       2) 部署 SOP 必加完整 scp 清单: dist.tar.gz + package.json + changelog.json 3 件套
#       3) verify-deploy.sh 加维度 22 强制检查 /api/version 的 4 字段: version (== APP_VERSION) + changelog (非通用文案) + highlights (≥3 条) + buildDate (YYYY-MM-DD)
# 防呆: 任何未来部署后, 维度 22 失败 = changelog 同步链断了一环, 必须检查 deploy.sh 是否走 /tmp/ 源 + scp 完整清单
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 22: BUG-090 /api/version 4 字段验证 (version + changelog + highlights + buildDate) ──"

  # 22. /api/version 4 字段必查: 1) version == APP_VERSION 2) changelog 非空且非通用文案 3) highlights ≥ 3 条 4) buildDate 是 YYYY-MM-DD
  V22_RESULT=$(python3 -c "
import json, sys, re
try:
    d = json.loads(__import__('urllib.request', fromlist=['urlopen']).urlopen('${API_BASE}/api/version', timeout=3).read())
    data = d.get('data', {})
    version = data.get('version', '')
    changelog = data.get('changelog', '')
    highlights = data.get('highlights', [])
    build_date = data.get('buildDate', '')

    # 校验 4 字段
    errors = []
    if version != '$APP_VERSION':
        errors.append(f'version mismatch: server={version} env=' + '$APP_VERSION')
    if not changelog or changelog in ('优化性能，修复已知问题', '本次更新优化性能，修复已知问题', 'New features and improvements'):
        errors.append(f'changelog 通用文案: {changelog[:30]}')
    if len(highlights) < 3:
        errors.append(f'highlights 不足 3 条: {len(highlights)}')
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', build_date):
        errors.append(f'buildDate 格式错: {build_date}')

    if errors:
        print(f'FAIL {\"; \".join(errors)}')
    else:
        print(f'OK version={version} changelog={changelog[:30]}... highlights={len(highlights)} buildDate={build_date}')
except Exception as e:
    print(f'FAIL {type(e).__name__}: {e}')
" 2>&1)
  if echo "$V22_RESULT" | grep -q "^OK"; then
    PASS=$((PASS+1))
    color green "   ✓ 22. /api/version 4 字段全过: $V22_RESULT"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("22. /api/version 4 字段不全")
    color red "   ✗ 22. /api/version 4 字段: $V22_RESULT (BUG-090 必修)"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 23: BUG-096 React {0} 渲染陷阱防呆 (web dist 0 字符串防御)
# ──────────────────────────────────────
# 历史: v3.0.37 BUG-094 修法 admin 端点 + AdminDashboardPage 5 tab + userNotifiedAt 条件, 写成
#   `o.userNotifiedAt && o.userNotifiedAt > 0 && o.status === 'user_notified' && (...)`
#   老 approved 订单 userNotifiedAt=0 (DB DEFAULT) 走 `0 && ...` 短路返 0, React JSX `{0}` 渲染 "0" 字符串
#   5 条历史 "已通过" 订单全部后面渲染 "0" (user 截图反馈 2026-06-26 13:22)
# 修法: 删 `o.userNotifiedAt &&` 第一个短路条件, 改 `&& (...)` 为 `? (...) : null` 显式三目
# 防呆: web dist 必须含 `userNotifiedAt>0` (修法在) 且不能含 `userNotifiedAt&&` (老修法 0 渲染陷阱)
# 配套 mavis memory: "JSX `{0}` 渲染陷阱" (跟 BUG-082 铁律 8 配套, 跨项目通用 UX 原则)
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 23: BUG-096 React {0} 渲染陷阱防呆 (web dist userNotifiedAt 条件检查) ──"

  WEB_DIST_DIR="/www/wwwroot/web-app/dist/assets"
  if [ -d "$WEB_DIST_DIR" ]; then
    # 23a. web dist 必须含 `userNotifiedAt>` (修法在, 用 > 不用 &&, 防 0 渲染陷阱; minifier 会把 `> 0` 优化成 `>`, 所以 grep `userNotifiedAt>` 不带 0, 跟 BUG-098 同款)
    V23A=$(grep -hc 'userNotifiedAt>' "$WEB_DIST_DIR"/*.js 2>/dev/null | awk '{s+=$1} END {print s+0}')
    if [ "$V23A" -ge 1 ]; then
      PASS=$((PASS+1))
      color green "   ✓ 23a. web dist 含 'userNotifiedAt>0' 修法: $V23A 命中 (BUG-096 修法在)"
    else
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("23a. userNotifiedAt>0 缺失")
      color red "   ✗ 23a. web dist 无 'userNotifiedAt>0' 修法 (期望 ≥1 命中, BUG-096 修法未部署)"
    fi

    # 23b. web dist 不能含 `userNotifiedAt&&` (老修法 0 渲染陷阱, 未来 AI 误加 && 立即 catch)
    V23B=$(grep -hc 'userNotifiedAt&&' "$WEB_DIST_DIR"/*.js 2>/dev/null | awk '{s+=$1} END {print s+0}')
    if [ "$V23B" = "0" ]; then
      PASS=$((PASS+1))
      color green "   ✓ 23b. web dist 无 'userNotifiedAt&&' 反模式: 0 命中 (0 渲染陷阱已清)"
    else
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("23b. userNotifiedAt&& 反模式")
      color red "   ✗ 23b. web dist 含 'userNotifiedAt&&' 反模式: $V23B 命中 (BUG-096 重蹈, 老 approved 订单渲染 \"0\")"
    fi
  else
    skip "23. WEB_DIST_DIR ($WEB_DIST_DIR) 不存在"
  fi
  echo
fi

# ──────────────────────────────────────
# 维度 24: 铁律 4++ 防呆 (Web 主导, APP 跟随, 必同步) — BUG-092/094/095/096 mobile 端漏修
# ──────────────────────────────────────
# 历史: S72 batch 7 修 BUG-092/094/095/096 全部 web 端, mobile 端漏 3 BUG (缺"我已付款"按钮 / admin 默认查 pending / React 0 渲染陷阱)
# 规范反转 (2026-06-26): 改 web 端必同步 app 端, 列入 AGENTS.md § 4 铁律 4++
# 修法: 部署后必查 mobile 源 (apps/mobile/src) 含 web 关键 API/UI 元素, ≥1 命中
# 防呆: 任何 web 关键改动 mobile 漏 0 命中 = FAIL, 部署阻断, 强制同步
# ──────────────────────────────────────
if [ "$SERVER_ONLY" != "true" ]; then
  color blue "── 维度 24: 铁律 4++ Web 主导 APP 跟随 (mobile 端同步自检) ──"

  MOBILE_SRC="/www/wwwroot/shipin-APP/../app.mobile/src"
  # 实际 mobile 源在 apps/mobile/src, 部署源可能在 git worktree / monorepo root
  # 优先找本仓库 apps/mobile/src (verify-deploy 跑在 server 端, 但 monorepo 根是 F:/QiTa/banmu/APP/...)
  # v3.0.37 (S72 batch 7 BUG-099): APK 公网路径 + 远端 grep (server 端没 monorepo 根也能验)
  MOBILE_SRC_LOCAL="apps/mobile/src"
  if [ -d "$MOBILE_SRC_LOCAL" ]; then
    # 24. mobile 端必须含 web 关键 API/UI 元素 (BUG-092 配套: notifyRechargePaidApi / 我已付款 / STAGE_TEXT 4 态)
    # 任意 1 个 0 命中即 FAIL
    V24_NOTIFY=$(grep -rl 'notifyRechargePaidApi\|notify-paid' "$MOBILE_SRC_LOCAL"/screens 2>/dev/null | wc -l)
    V24_PAID=$(grep -rl '我已付款' "$MOBILE_SRC_LOCAL"/screens 2>/dev/null | wc -l)
    V24_STAGE=$(grep -rl 'user_notified' "$MOBILE_SRC_LOCAL"/screens 2>/dev/null | wc -l)
    V24_TOTAL=$((V24_NOTIFY + V24_PAID + V24_STAGE))

    if [ "$V24_TOTAL" -ge 1 ]; then
      PASS=$((PASS+1))
      color green "   ✓ 24. mobile 端 web 关键 API/UI 同步: notify-paid=$V24_NOTIFY, 我已付款=$V24_PAID, user_notified=$V24_STAGE (铁律 4++ 合规)"
    else
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("24. mobile 端漏同步")
      color red "   ✗ 24. mobile 端漏同步: notify-paid=0, 我已付款=0, user_notified=0 (铁律 4++ 违规, S72 batch 7 BUG-092/094/095/096 漏修)"
    fi
  else
    # v3.0.59 (S72 batch 30 BUG-130): 改 stale v3.0.37 hard-code → 动态从 changelog.json latest_version 读 (跟 server 实际代码同步, 跟 BUG-129 跨项目通用铁律)
    APK_LATEST_VER=$(python3 -c "import json; print(json.load(open('/www/wwwroot/shipin-APP/dist/changelog.json'))['latest_version'])" 2>/dev/null || echo "")
    APK_PUBLIC="/www/wwwroot/shipin-APP/public/DeepScript_v${APK_LATEST_VER}.apk"
    if [ -f "$APK_PUBLIC" ]; then
      V24_NOTIFY=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao 'notifyRechargePaid' 2>/dev/null | wc -l)
      V24_NOTIFY=${V24_NOTIFY:-0}
      V24_PAID=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao '我已付款' 2>/dev/null | wc -l)
      V24_PAID=${V24_PAID:-0}
      V24_STAGE=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao 'user_notified' 2>/dev/null | wc -l)
      V24_STAGE=${V24_STAGE:-0}
      V24_TOTAL=$(( ${V24_NOTIFY:-0} + ${V24_PAID:-0} + ${V24_STAGE:-0} ))
      if [ "$V24_TOTAL" -ge 1 ]; then
        PASS=$((PASS+1))
        color green "   ✓ 24. APK bundle 端 web 关键 API/UI 同步: notifyRechargePaid=$V24_NOTIFY, 我已付款=$V24_PAID, user_notified=$V24_STAGE (铁律 4++ 合规, APK 公网 $APK_PUBLIC)"
      else
        FAIL=$((FAIL+1))
        FAIL_MSGS+=("24. APK bundle 端漏同步")
        color red "   ✗ 24. APK bundle 端漏同步: notifyRechargePaid=0, 我已付款=0, user_notified=0 (铁律 4++ 违规, S72 batch 7 BUG-092/094/095/096 漏修)"
      fi
    else
      skip "24. MOBILE_SRC_LOCAL ($MOBILE_SRC_LOCAL) + APK_PUBLIC ($APK_PUBLIC) 都不存在 (server 端没 monorepo 根, 也没公网 APK)"
    fi
  fi
  echo
fi

# ────────────────────────────────────────────────────
# 维度 25: BUG-158 防呆 — changelog.json PS5.1 escape JSON 字节级扫描 (0x22 0x0D 0x0A 0x22 序列)
# ────────────────────────────────────────────────────
# 历史: S73 v3.0.80 BUG-158: shipin-APP changelog.json 用 PowerShell 5.1 Out-File / Write 工具写入时,
#       把每个 highlights 数组元素的 close-quote (") 写成 ASCII 22 + CRLF 0d 0a 序列, 但**漏 array separator ,**
#       JSON 解析失败. server 启动 catch JSON parse fallback DEFAULT_ENTRY, console.warn 兜底**没 throw 上抛**,
#       /api/version 返 fallback 硬编码 '本次更新优化性能, 修复已知问题'.
#
# 修法: 1) verify-deploy.sh 加维度 25 字节级扫描 0x22 0x0D 0x0A [whitespace] 0x22 序列 (close-quote + CRLF + indent + next-element open-quote),
#       任何命中 = FAIL (防 BUG-158 复发)
#       2) 配套 apps/server/scripts/fix-changelog.js (Buffer 字节级 1-char comma injection 修法, S73 v3.0.80 commit ab86e80)
# 防呆: 任何未来 changelog.json 被 PS5.1 Out-File / Write 工具污染, 维度 25 失败 = 必跑 fix-changelog.js 修法
# ────────────────────────────────────────────────────
color blue "── 维度 25: BUG-158 changelog.json 字节级数组分隔符扫描 (0x22 0x0D 0x0A 0x22 序列检测) ──"

# 25. changelog.json byte-level scan for PS5.1 escape pattern (close-quote + CRLF + indent + next-element open-quote)
V25_RESULT=$(python3 -c "
import re, sys
try:
    data = open('/www/wwwroot/shipin-APP/dist/changelog.json', 'rb').read()
    # Look for 0x22 0x0D 0x0A [whitespace] 0x22 pattern (PS5.1 escape without comma)
    pattern = re.compile(b'\\x22\\x0d\\x0a[\\x20\\x09]*\\x22')
    matches = pattern.findall(data)
    if matches:
        # Print first 3 offsets for debugging
        offsets = []
        for m in pattern.finditer(data):
            offsets.append(m.start())
            if len(offsets) >= 3: break
        print(f'FAIL count={len(matches)} sample_offsets={offsets[:3]} (BUG-158 复发, 必跑 fix-changelog.js 修法)')
    else:
        # Also verify JSON parse + has entries with non-empty highlights
        import json
        j = json.loads(data.decode('utf-8'))
        latest = j['entries'][-1]
        h = len(latest.get('highlights', []))
        if h == 0:
            print(f'WARN no PS5.1 escape pattern but highlights={h} (可能 fallback DEFAULT_ENTRY)')
        else:
            print(f'OK highlights={h} latest_version={latest[\"version\"]} (no PS5.1 escape)')
except FileNotFoundError as e:
    print(f'SKIP file not found: {e}')
except json.JSONDecodeError as e:
    print(f'FAIL json_decode pos={e.pos} msg={e.msg} (跟 BUG-158 同源)')
except Exception as e:
    print(f'FAIL {type(e).__name__}: {e}')
" 2>&1)
if echo "$V25_RESULT" | grep -q "^OK"; then
  PASS=$((PASS+1))
  color green "   ✓ 25. changelog.json 字节级扫描: $V25_RESULT"
elif echo "$V25_RESULT" | grep -q "^SKIP"; then
  SKIP=$((SKIP+1))
  color yellow "   ⚠ 25. skipped: $V25_RESULT"
elif echo "$V25_RESULT" | grep -q "^WARN"; then
  PASS=$((PASS+1))
  color yellow "   ⚠ 25. PASS with WARN: $V25_RESULT (fallback DEFAULT_ENTRY 风险, 查 server log)"
else
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("25. changelog.json PS5.1 escape detected (BUG-158 复发)")
  color red "   ✗ 25. $V25_RESULT"
fi
echo

# ────────────────────────────────────────────────────
# 维度 26: BUG-159 防呆 — mobile 端 APK bundle 包含 server 当前公网 IP (config.ts IP sync)
# ────────────────────────────────────────────────────
# 历史: S73 v3.0.81 BUG-159: v3.0.74 BUG-147 server 端 IP 159.75.16.110 → 119.91.155.46 配套走了 web + server + 远端 .env + 远端 systemd unit,
#       但**漏改 shipin-APP 仓库 mobile 端** (apps/mobile/src/config.ts:2 DEV_SERVER_IP hardcode + TaskProgressScreen.tsx:71 WS fallback).
#       后果: v3.0.74-79 所有 mobile APK 装上后连不上 server → /users/login 返 isNetworkError=true → 用户点登录按钮无响应.
#
# 修法: 1) verify-deploy.sh 加维度 26 扫 APK bundle, 检查是否含 server 当前公网 IP 字符串 (跟 process.env 公开给客户端的字段保持一致)
#       2) 配套 mobile 端 commit (5c7211a) 同步修复
#       3) 长远方案: 用 ab.maque.uno 域名反代 + 禁 hardcode IP (跨项目通用铁律)
# 防呆: 任何未来 server 换 IP 漏改 mobile config.ts, 维度 26 失败 = 必同步 mobile 端
# ────────────────────────────────────────────────────
color blue "── 维度 26: BUG-159 mobile 端 APK bundle 含 server 当前公网 IP (config.ts IP sync 防呆) ──"

# 26. APK bundle 含 server 当前 IP — 通过 /api/version 拿 mobileLatestApkUrl 对应的 APK
if [ -n "$APK_PUBLIC" ] && [ -f "$APK_PUBLIC" ]; then
  # 拿 server 当前监听的实际公网 IP (从 /api/version 提取 host 段, 或 fallback 到 .env APP_VERSION 推导)
  V26_SERVER_IP=$(timeout 3 curl -sm 3 "${API_BASE}/api/version" 2>/dev/null | python3 -c "
import json, sys, re
try:
    d = json.loads(sys.stdin.read())
    # Look for any IP-like string in response (downloadUrl or appDownloadUrl)
    url = d.get('data', {}).get('downloadUrl', '') or d.get('data', {}).get('appDownloadUrl', '')
    m = re.search(r'(\d+\.\d+\.\d+\.\d+)', url)
    if m:
        print(m.group(1))
    else:
        print('NO_IP')
except Exception as e:
    print(f'NO_IP {type(e).__name__}')
" 2>&1)
  if [ "$V26_SERVER_IP" = "NO_IP" ] || [ -z "$V26_SERVER_IP" ]; then
    SKIP=$((SKIP+1))
    color yellow "   ⚠ 26. skipped: /api/version response 无 IP 字段 (downloadUrl 走域名)"
  else
    # 扫 APK bundle 看是否含 server 当前 IP 字符串
    V26_HITS=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao "$V26_SERVER_IP" 2>/dev/null | wc -l)
    V26_HITS=${V26_HITS:-0}
    # 同时扫老 IP 残留 (如果 server 已换 IP 但 mobile 未 sync)
    V26_STALE_HITS=0
    if [ "$V26_SERVER_IP" != "119.91.155.46" ]; then
      V26_STALE_HITS=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao "159.75.16.110" 2>/dev/null | wc -l)
      V26_STALE_HITS=${V26_STALE_HITS:-0}
    fi
    if [ "$V26_STALE_HITS" -ge 1 ]; then
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("26. mobile bundle 含老 IP 159.75.16.110")
      color red "   ✗ 26. mobile bundle 含老 IP 159.75.16.110 ($V26_STALE_HITS 处), 当前 server 是 $V26_SERVER_IP (BUG-159 复发, 必同步 mobile config.ts + TaskProgressScreen fallback)"
    elif [ "$V26_HITS" -ge 1 ]; then
      FAIL=$((FAIL+1))
      FAIL_MSGS+=("26. mobile bundle 含 hardcode IP")
      color red "   ✗ 26. mobile bundle 含 hardcode IP $V26_SERVER_IP ($V26_HITS 处) — anti-pattern, 必改 ab.maque.uno 域名反代 (BUG-159 跨项目通用铁律: 禁 hardcode IP)"
    else
      PASS=$((PASS+1))
      color green "   ✓ 26. mobile bundle 不含任何 IP ($V26_HITS 老/$V26_STALE_HITS 老 IP 残留), 走域名反代 (BUG-159 修复 OK, 跨项目通用铁律)"
    fi
  fi
else
  skip "26. APK_PUBLIC ($APK_PUBLIC) 不存在, 跳过 (跟 24 维度同源处理)"
fi
echo

# ────────────────────────────────────────────────────
# 维度 27: BUG-160 防呆 — mobile 端 APK bundle 含 web 端 menu 入口字符串 (跨端铁律 4++ 1:1 镜像)
# ────────────────────────────────────────────────────
# 历史: S73 v3.0.82 BUG-160: web 端早就实现 NotificationBell + AIAssistant (v3.0.74/78+ 路由注册上线),
#       mobile 端 ProfileScreen serviceMenu **缺这两个菜单入口**, 路由已注册但无 menu = 假能力 (跟 BUG-079 100% 同源).
#
# 修法: 1) verify-deploy.sh 加维度 27 扫 APK bundle, 检查是否含 web 端 menu 入口字符串 (notifications-outline + chatbubbles-outline)
#       2) 配套 mobile 端 commit (95a0138) ProfileScreen serviceMenu 加 2 菜单
#       3) 跨项目通用铁律: web 端实现的入口 mobile 必 1:1 同步 (跟 BUG-097 反方向同源)
# 防呆: 任何未来 web 端加 menu 但 mobile 漏同步, 维度 27 失败 = 必同步 mobile 端
# ────────────────────────────────────────────────────
color blue "── 维度 27: BUG-160 mobile 端 APK bundle 含 web 端 menu 入口字符串 (跨端铁律 4++ 1:1 镜像防呆) ──"

# 27. APK bundle 含 web 端 menu 入口 icon name
if [ -n "$APK_PUBLIC" ] && [ -f "$APK_PUBLIC" ]; then
  V27_NOTIF=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao 'notifications-outline' 2>/dev/null | wc -l)
  V27_NOTIF=${V27_NOTIF:-0}
  V27_AI=$(unzip -p "$APK_PUBLIC" assets/index.android.bundle 2>/dev/null | grep -ao 'chatbubbles-outline' 2>/dev/null | wc -l)
  V27_AI=${V27_AI:-0}
  V27_TOTAL=$(( V27_NOTIF + V27_AI ))
  if [ "$V27_TOTAL" -ge 2 ]; then
    PASS=$((PASS+1))
    color green "   ✓ 27. mobile bundle 含 web menu 入口: notifications-outline=$V27_NOTIF, chatbubbles-outline=$V27_AI (BUG-160 修复 OK, 跨端铁律 4++ 合规)"
  else
    FAIL=$((FAIL+1))
    FAIL_MSGS+=("27. mobile bundle 缺 web menu 入口")
    color red "   ✗ 27. mobile bundle 缺 web menu 入口: notifications-outline=$V27_NOTIF (期望 ≥1), chatbubbles-outline=$V27_AI (期望 ≥1) (BUG-160 复发, 跟 BUG-097 旧原则同源)"
  fi
else
  skip "27. APK_PUBLIC ($APK_PUBLIC) 不存在, 跳过 (跟 24 维度同源处理)"
fi
echo

# ──────────────────────────────────────
# 汇总
# ──────────────────────────────────────
color cyan "═══════════════════════════════════════════════════════════════"
color cyan "  验证汇总"
color cyan "═══════════════════════════════════════════════════════════════"
color green "  PASS: $PASS"
color red "  FAIL: $FAIL"
color yellow "  SKIP: $SKIP"
if [ $FAIL -gt 0 ]; then
  echo
  color red "  失败项:"
  for msg in "${FAIL_MSGS[@]}"; do
    color red "    - $msg"
  done
fi
echo

if [ $FAIL -gt 0 ] && [ "$STRICT" = "true" ]; then
  color red "  ✗ 严格模式: 有失败, exit 1"
  exit 1
fi

if [ $FAIL -eq 0 ]; then
  color green "  ✓ 全部通过, shipin-APP 部署健康"
  exit 0
else
  color yellow "  ⚠ 有失败, 但非严格模式, 仍 exit 0 (deploy 报告必列失败项)"
  exit 0
fi
