#!/usr/bin/env python3
"""devflow-router.py — UserPromptSubmit：开发意图候选筛选 → 注入「按 devflow 执行」指令。

关键词只做候选筛选，模式（讨论 / 只读审核 / 计划 / 执行 / 发布）由模型结合任务状态判断；
本 hook 未命中时无上下文注入、无模型调用（仍有一次进程启动成本）。
任何异常静默 exit 0，绝不阻塞用户输入。关闭：DEVFLOW_OFF=1 或消息含「不走流程」。
"""
import json
import os
import re
import sys

# 候选正则（astra 复审 B4 草案 + 本机强触发）
CANDIDATE = re.compile(
    r"(?ix)"
    r"(?:^|\n)\s*/devflow(?::[a-z-]+)?(?=\s|$)"
    r"|"
    r"(?:修复|修一下|修掉|修好|修|排查|调试|重构|优化|补齐|补上|增加|添加|加个|加一个|加上|改一下|改成|删掉|换成|接入|实现|开发|搭建|编写|写|做|审一下|审核|review)"
    r".{0,32}"
    r"(?:bug|报错|错误|代码|测试|接口|功能|登录|支付|数据库|页面|网站|应用|脚本|插件|产品|工具|小程序|app|mvp|原型|组件|模块|按钮|选项|字段|样式|部署方案|方案)"
    r"|"
    r"(?:按钮|页面|接口|功能|脚本|插件|服务|部署)[^。！？\n]{0,12}(?:没反应|不工作|报错|挂了|失败|坏了|404|500)"
    r"|"
    r"(?:^|[\n。！？,，])\s*(?:请|帮我|现在|把这个|把它)?\s*"
    r"(?:上线|部署|发布|回滚)(?=\s|$|这个|项目|网站|应用|到|一下)"
    r"|"
    r"(?:网站|产品|应用|插件|小程序|服务|功能|新版本|app)[^。！？\n]{0,10}?(?:正式)?(?:上线|上架|部署|发布|发版)(?=$|[，,。！？\s]|到|至|去|吧|了|一下)"
    r"|"
    r"\b(?:fix|debug|refactor|implement|deploy|rollback|ship)\b"
    r"|"
    r"\b(?:publish|release|launch|go\s+live\s+with)\s+(?:this|the|my|our|it)\b(?:\s+(?:app|site|website|product|plugin|extension|service|api|bot|project|version|release))?"
    r"|"
    r"做个产品|做一个产品|开发一个|开发个|写代码|vibe\s?coding|\bmvp\b"
)
# 排除：概念解释、纯提问、讨论本流程指南本身、引用块
EXCLUDE = re.compile(
    r"^(?:什么是|解释|讲讲|说说|为什么|是什么|怎么理解|区别|学习编程|开发课程)"
    r"|不走流程|跳过\s?devflow|devflow\s?off|流程指南|开发流程指南|只是聊聊|不用动手|已经上线",
    re.I,
)
# 只读 / 讨论线索（命中时注入的是「只读模式」提示，不是执行）
READONLY = re.compile(r"审一下|审核|review|看看有没有问题|只读|先讨论|先聊聊|怎么看|有没有更好的|别实现|不要改", re.I)


def strip_code_blocks(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    return re.sub(r"`[^`\n]*`", " ", text)


def main() -> None:
    if os.environ.get("DEVFLOW_OFF") == "1":
        return
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}
    prompt = (data.get("prompt") or "").strip()
    if len(prompt) < 4 or prompt.startswith("/devflow"):
        return
    body = strip_code_blocks(prompt)
    if re.search(r"不走流程|跳过\s?devflow|devflow\s?off", body, re.I):
        return
    # 排除词按分句生效：「已经上线，现在发布到生产」前半句被排除，后半句仍是发布意图
    clauses = [c for c in re.split(r"[。！？\n；;]|(?<=[^\d])[，,](?=[^\d])", body) if c.strip()]
    kept = [c for c in clauses if not EXCLUDE.search(c)]
    if not kept:
        return
    body = "\n".join(kept)
    if not CANDIDATE.search(body):
        return
    mode_hint = "只读审核 / 讨论" if READONLY.search(body) else "执行 / 计划 / 发布之一"
    ctx = (
        "【devflow 路由】本条消息命中开发意图候选。先 Skill 加载 `devflow`（插件 skill），"
        f"按 DF-00 判定模式（候选提示：{mode_hint}）。执行或发布模式才按 DF-01 输出 5 行开工声明并建 ledger；"
        "讨论与只读审核不建 ledger 不写文件。发布模式在阶段 8 之前必须先调用 `launch-check` skill 跑完上线前检查（有 FAIL 即 NO-GO）。全程按 DF-06 拉回，完成前按 DF-07 自检。"
    )
    print(json.dumps({
        "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
