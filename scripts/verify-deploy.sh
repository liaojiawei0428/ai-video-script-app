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
color cyan "  shipin-APP 部署后 14 维验证 (BUG-079 P0 TODO 配套)"
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
