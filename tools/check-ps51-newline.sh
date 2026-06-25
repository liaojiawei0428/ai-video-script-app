#!/bin/bash
# tools/check-ps51-newline.sh
# S71 BUG-079 后置 (跨项目通用): PowerShell 5.1 写 .ts/.js/.md/.sql 文件会丢 newline
# 修法: 写文件后必跑本脚本验证, 任何 .ts 文件 newline 数 < 文件有效行数 / 3 = damaged
#
# 用法:
#   bash tools/check-ps51-newline.sh <file1> [file2] ...   # 检查指定文件
#   bash tools/check-ps51-newline.sh --staged              # 检查 git staged 改动的文件
#   bash tools/check-ps51-newline.sh --all                 # 检查整个 apps/ 下的 .ts/.js/.md/.sql
#
# 退出码:
#   0 = 全过
#   1 = 有文件损坏

DAMAGED=0
declare -a DAMAGED_FILES

check_file() {
  local f=$1
  if [ ! -f "$f" ]; then
    return 0
  fi
  local size=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f" 2>/dev/null)
  if [ -z "$size" ] || [ "$size" -lt 200 ]; then
    return 0
  fi
  # PS 5.1 写入损坏特征: 大文件 newline 比例 < 5%
  local nl=$(tr -cd '\n' < "$f" | wc -c)
  local ratio=$((nl * 100 / size))
  if [ "$nl" -lt 3 ] && [ "$size" -gt 500 ]; then
    DAMAGED=$((DAMAGED+1))
    DAMAGED_FILES+=("$f (size=$size, newlines=$nl, ratio=${ratio}%)")
    echo -e "\033[31m   ✗ $f: 大小 $size 字节但只有 $nl 个 newline (${ratio}%) — PS 5.1 写入损坏!\033[0m"
    return 1
  fi
  return 0
}

case "${1:-}" in
  --staged)
    echo "--- 检查 git staged 改动的 .ts/.js/.md/.sql 文件 ---"
    # 跨平台: 优先 git diff --name-only --cached
    files=$(git diff --name-only --cached 2>/dev/null | grep -E '\.(ts|js|md|sql|json)$' || true)
    if [ -z "$files" ]; then
      echo "  无 staged 文件"
      exit 0
    fi
    ;;
  --all)
    echo "--- 检查整个 apps/ 下的 .ts/.js/.md/.sql ---"
    files=$(find apps -type f \( -name '*.ts' -o -name '*.js' -o -name '*.md' -o -name '*.sql' -o -name '*.json' \) 2>/dev/null | grep -v node_modules | grep -v dist || true)
    ;;
  "")
    echo "用法: $0 <file1> [file2] ... | --staged | --all"
    echo "  检查文件 newline 比例, 防止 PS 5.1 写入损坏 (BUG-079 教训)"
    exit 2
    ;;
  *)
    files="$@"
    ;;
esac

if [ -n "$files" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    check_file "$f" || true
  done <<< "$files"
fi

echo
if [ $DAMAGED -gt 0 ]; then
  echo -e "\033[31m✗ $DAMAGED 个文件 PS 5.1 写入损坏 (newline < 3)\033[0m"
  echo -e "\033[33m修法: 用 Write/Edit 工具 (UTF-8 自动 newline) 重写, 不用 PS 5.1 + Out-File\033[0m"
  exit 1
else
  echo -e "\033[32m✓ 所有文件 newline 健康\033[0m"
  exit 0
fi
