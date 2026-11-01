#!/usr/bin/env bash
# devflow-scan.sh — 扫描改动文件里的假完成信号。git 仓库扫 diff 涉及的文件；非 git 扫当前目录最近 2 天改动的源码。
set -u
PAT='TODO|FIXME|XXX|test\.skip|it\.skip|describe\.skip|\.only\(|NotImplemented|not implemented|throw new Error\("TODO|pass  # TODO|unimplemented!'
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES=$( { git diff --name-only; git diff --name-only --cached; git ls-files --others --exclude-standard; } | sort -u | grep -E '\.(ts|tsx|js|jsx|mjs|py|go|rs|sh|html|css|md|toml|json|sql)$' || true)
  SRC="git 改动文件"
else
  FILES=$(find . -type f -mtime -2 \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.py' -o -name '*.html' -o -name '*.sh' \) -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null)
  SRC="非 git，最近 2 天改动"
fi
if [ -z "$FILES" ]; then echo "devflow-scan: 无待扫文件（${SRC}）"; exit 0; fi
echo "devflow-scan: 扫描 $(echo "$FILES" | wc -l | tr -d ' ') 个文件（${SRC}）"
HITS=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  if grep -nE "$PAT" "$f" >/dev/null 2>&1; then
    grep -nE "$PAT" "$f" | sed "s|^|$f:|" | head -20
    HITS=$((HITS+1))
  fi
done <<< "$FILES"
if [ "$HITS" -eq 0 ]; then echo "devflow-scan: 未发现 TODO / test.skip / .only / 未实现桩"; else echo "devflow-scan: $HITS 个文件含假完成信号，交付前处理"; fi
exit 0
