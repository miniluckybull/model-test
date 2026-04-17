# Model Tester

本地开发模型资源检测工具，支持多 API 配置管理和实时连通性测试。

![Model Tester](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)

## 功能特性

- **多 API 配置管理** - 添加、编辑、删除多个 API 配置
- **实时连通性测试** - 测试 OpenAI / Anthropic 兼容接口的连通性
- **延迟与 Token 统计** - 显示响应时间和 token 使用量
- **批量测试** - 一键测试所有配置的 API
- **配置复制** - 快速复制配置并修改，方便多模型对比
- **暗色主题 UI** - 专业级深色设计，支持响应式布局
- **本地持久化** - 配置自动保存到本地文件系统

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| 后端 | Tauri 2 + Rust |
| 状态管理 | Zustand |
| 样式 | CSS Custom Properties (暗色主题) |

## 快速开始

### 环境要求

- Node.js 18.18+
- Rust 1.77+ (用于 Tauri 桌面应用)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动 Tauri 桌面应用 (推荐)
npm run tauri:dev

# 仅启动前端 (浏览器模式)
npm run dev
```

### 构建

```bash
# 构建前端
npm run build

# 构建桌面应用
npm run tauri:build
```

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录下。

## 使用指南

### 添加 API 配置

1. 点击 **"+ Add New Profile"** 卡片
2. 填写配置：
   - **Name** - 配置名称 (如 "My Claude Model")
   - **Provider** - 提供商 (OpenAI / Anthropic / Custom)
   - **Endpoint** - API 地址 (如 `https://api.openai.com`)
   - **Model** - 模型名称 (如 `gpt-4o-mini`)
   - **API Key** - 您的 API 密钥
3. 点击 **"Add Profile"** 保存

### 测试连通性

- 点击单个卡片的 **"Test"** 按钮测试该配置
- 点击上方的 **"Test All (N)"** 按钮批量测试所有配置

### 复制配置

点击卡片上的 **"Duplicate"** 按钮快速复制配置，方便创建相似配置后修改。

### 编辑与删除

- **"Edit"** - 编辑配置详情
- **"🗑️"** - 删除配置 (需确认)

## 支持的 API 格式

### OpenAI 兼容接口

```
Endpoint: https://api.openai.com
Auth: Authorization: Bearer <API_KEY>
Path: /v1/chat/completions
```

### Anthropic 接口

```
Endpoint: https://api.anthropic.com
Auth: x-api-key: <API_KEY>
Header: anthropic-version: 2023-06-01
Path: /v1/messages
```

### 自定义接口

选择 "Custom" 提供商，默认使用 OpenAI 兼容格式。

## 项目结构

```
model-test/
├── src/                    # React 前端源码
│   ├── components/         # UI 组件
│   ├── store/              # Zustand 状态管理
│   ├── services/           # Tauri IPC 调用
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数和常量
│
├── src-tauri/              # Tauri 后端
│   ├── src/                # Rust 源码
│   │   ├── commands/       # Tauri 命令 (API CRUD + 测试)
│   │   ├── models/         # 数据模型
│   │   ├── services/       # HTTP 客户端
│   │   └── storage/        # 本地持久化
│   ├── capabilities/       # Tauri 权限配置
│   └── tauri.conf.json     # Tauri 应用配置
│
├── package.json            # npm 配置
├── vite.config.ts          # Vite 构建配置
└── tsconfig.json           # TypeScript 配置
```

## 配置文件存储位置

- macOS: `~/Library/Application Support/com.local.model-test/configs.json`
- Windows: `%APPDATA%/com.local.model-test/configs.json`
- Linux: `~/.config/com.local.model-test/configs.json`

## 许可证

MIT
