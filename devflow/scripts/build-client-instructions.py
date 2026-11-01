#!/usr/bin/env python3
"""从 skills/devflow/SKILL.md 的 CLIENT 段生成 client-instructions/*.md（单一真源，生成物禁止手改）。"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKILL = ROOT / "skills" / "devflow" / "SKILL.md"
OUT = ROOT / "client-instructions"

text = SKILL.read_text(encoding="utf-8")
m = re.search(r"<!-- CLIENT-START -->\n(.*?)\n<!-- CLIENT-END -->", text, re.S)
v = re.search(r"规则版本 `([^`]+)`", text)
if not m or not v:
    print("CLIENT 段或版本号缺失", file=sys.stderr)
    sys.exit(1)
body = m.group(1).strip()
ver = v.group(1)
if len(body) > 1500:
    print(f"CLIENT 段 {len(body)} 字，超过 1500 字上限", file=sys.stderr)
    sys.exit(1)
OUT.mkdir(exist_ok=True)
header = f"<!-- 由 scripts/build-client-instructions.py 从 SKILL.md 生成，版本 {ver}，请勿手改 -->\n"
(OUT / "chatgpt-project.md").write_text(
    header + "# 粘贴到 ChatGPT「Project → Instructions」或自定义 GPT 指令\n\n" + body + "\n", encoding="utf-8")
(OUT / "claude-project.md").write_text(
    header + "# 粘贴到 Claude.ai / Claude 桌面 App「Project → Instructions」\n\n" + body +
    "\n\n补充一条：在 Claude 客户端里如果我上传了仓库文件或截图，你可以基于它们做只读审查，但结论要标「未在真实环境验证」。\n",
    encoding="utf-8")
# 网页端 skill 包：claude.ai（Customize → Skills → 上传 zip）与 ChatGPT（Skills → Create → Upload）
import shutil, zipfile
web = OUT / "devflow-web"
if web.exists():
    shutil.rmtree(web)
web.mkdir()
front = ("---\n"
         "name: devflow\n"
         "description: Tony 的产品开发流程守门员（网页版）。用户表达开发意图时使用：开发、编程、写代码、做个产品/工具/网站/插件/App、MVP、实现功能、修 bug、接支付/登录/数据库、部署、上线。在网页端只做讨论、只读审核、计划，执行提醒回终端。解释概念、闲聊不触发。\n"
         "---\n\n")
(web / "SKILL.md").write_text(front + f"<!-- 生成物，版本 {ver}，真源为插件 skills/devflow/SKILL.md 的 CLIENT 段 -->\n\n" + body + "\n", encoding="utf-8")
zpath = OUT / "devflow-web-skill.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(web / "SKILL.md", "devflow/SKILL.md")
print(f"生成 2 个客户端指令文件 + 网页 skill 包 {zpath.name}，版本 {ver}，正文 {len(body)} 字")
