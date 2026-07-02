# CLAUDE.md — Claude Code CLI 用户入口 (S72 新建, 跨端统一)

> **本文件**: Anthropic Claude Code CLI 工具的配置入口, 跟 [`AGENTS.md`](./AGENTS.md) 内容 1:1 同步.
> **使用方式**: 用 `claude` CLI 启动时, `--project-instructions` 参数指向本文件 (或项目根目录自动识别)
> **跨工具**: AGENTS.md 是跨工具通用规范 (Cursor / Codex / Aider / Devin 等都认), 本文件是 Claude Code 专用, 内容跟 AGENTS.md 同步避免重复维护

> **完整内容见 [`AGENTS.md`](./AGENTS.md)** — 包含跨端 6 铁律 + 工作流 + 18 项必读表 + 子项目入口

## 速读指引 (Claude Code 启动后必读 3 份)

1. [`AGENTS.md`](./AGENTS.md) — AI Agent 必读入口 (本入口镜像)
2. [`HANDOVER.md`](./HANDOVER.md) — 跨 AI 会话交接 (S64-S72 session 速览)
3. [`DEV_PROGRESS.md`](./DEV_PROGRESS.md) — 项目 GAP 清单 (S18 之前的已知 GAP)

## 项目速览 (1 行版)

shipin-APP (AI 短剧剧本生成) — Node + Express + MySQL + systemd unit + RN + React,
部署服务器 `119.91.155.46:6000`, 公网域名 `https://ab.maque.uno`。
**走 systemd unit 部署** (S70 起, 不再 PM2, BUG-077 修法)。

## 改代码前 3 步 / 改完代码后 5 步

详见 [`AGENTS.md`](./AGENTS.md) § 4 跨端 6 铁律。
