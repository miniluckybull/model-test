# Model Tester

本地开发模型资源检测工具：管理多套 LLM API 配置、测试连通性与延迟/Token，并可一键把配置应用到 Claude Code。全中文界面。

![version](https://img.shields.io/badge/version-0.2.0-blue) ![license](https://img.shields.io/badge/license-MIT-green) ![platform](https://img.shields.io/badge/platform-macOS-lightgrey)

## 功能特性

- **多 API 配置管理**：添加 / 编辑 / 删除 / 复制多个配置，支持标签
- **连通性测试**：测试 OpenAI / Anthropic 兼容接口，显示延迟与 Token 用量；"全部测试"批量跑
- **应用到 Claude Code**：把当前配置写入 `~/.claude/settings.json`（可选目标路径，支持新建文件）；三方代理自动处理 auth_token 冲突
- **高级参数**：thinking_mode / thinking_effort / max_tokens（横向滑块）
- **项目级导出**：导出到项目的 `.claude/settings.json`
- **导入 / 导出**：JSON 配置导入导出（Header 入口）
- **配置模板**：Claude / OpenAI 官方与通用代理预设
- **统计面板**：总数 / 可用 / 失败 / 成功率 / 平均延迟 / 按 Provider 分布
- **本地持久化**：配置存本地文件；暗色主题

## 安装

### 方式 A：直接安装（无需源码/构建环境）
从 [GitHub Releases](../../releases) 下载 `Model Tester_<版本>_aarch64.dmg`（Apple Silicon），或让维护者发你 dmg。终端执行：

```bash
hdiutil attach "Model Tester_0.2.0_aarch64.dmg"
cp -R "/Volumes/Model Tester/Model Tester.app" /Applications/
hdiutil detach "/Volumes/Model Tester"
xattr -dr com.apple.quarantine "/Applications/Model Tester.app"   # 未公证，必须去隔离
open "/Applications/Model Tester.app"
```

> 未做 Apple 公证，务必执行 `xattr` 一步，或首次右键→打开。当前包为 aarch64（M 系列芯片）。

### 方式 B：从源码构建
前置：Node.js 18.18+、Rust 1.77+。

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && source "$HOME/.cargo/env"
git clone <本仓库地址> && cd model-test
npm install
npm run tauri:build     # 产物在 src-tauri/target/release/bundle/
```

开发模式：`npm run tauri:dev`（桌面）或 `npm run dev`（浏览器）。

## 使用

1. **添加配置**：点"+ 添加新配置"卡片，填名称 / 提供商 / 端点 / 模型 / API Key。
2. **测试**：卡片"测试"按钮测单个；右上"全部测试"测所有。
3. **应用到 Claude Code**：卡片"应用至 Claude Code"→ 选目标路径（检测列表单选，或"自定义路径"保存对话框可新建）→ 调整滑块参数 → 应用。
4. **导入/导出、模板**：Header 的"导入/导出""模板"入口。
5. **统计**：右上"显示统计"。

## 支持的 API 格式

- **OpenAI 兼容**：`Authorization: Bearer <KEY>`，`/v1/chat/completions`
- **Anthropic**：`x-api-key: <KEY>` + `anthropic-version: 2023-06-01`，`/v1/messages`
- **自定义**：选 Custom，默认 OpenAI 兼容格式

## 配置存储位置

- macOS: `~/Library/Application Support/com.local.model-test/configs.json`
- Linux: `~/.config/com.local.model-test/configs.json`

## 发布

更新 `package.json` 与 `src-tauri/tauri.conf.json` 版本号 → `npm run tauri:build` → 把 `bundle/dmg/*.dmg` 上传到 GitHub Releases 并打 tag。

## 许可证

MIT
