# Model Test Tool 配置改进

## 已实现的改进

### 1. 智能处理 authtoken 冲突

**问题：** 使用三方代理时，同时写入 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_AUTH_TOKEN` 导致冲突，需要手动删除。

**解决方案：**
- 后端自动检测是否使用三方代理（检查 `base_url` 是否非官方地址）
- 如果使用代理，只写入 `ANTHROPIC_API_KEY`，不写入 `ANTHROPIC_AUTH_TOKEN`
- 切换到代理模式时自动清除 `ANTHROPIC_AUTH_TOKEN`

**代码位置：**
- `src-tauri/src/commands/claude.rs:197-211` (preview 逻辑)
- `src-tauri/src/commands/claude.rs:242-255` (apply 逻辑)

**判断逻辑：**
```rust
let is_using_proxy = request.base_url.as_ref().map_or(false, |url| {
    !url.is_empty() && !url.contains("api.anthropic.com")
});
```

### 2. 新增高级配置选项

**新增字段：**
- `thinking_mode`: 思考模式（auto/enabled/disabled）
- `thinking_effort`: 思考深度（low/medium/high/xhigh/max）
- `max_tokens`: 最大响应长度（1024-200000）

**环境变量映射：**
- `ANTHROPIC_THINKING_MODE`
- `ANTHROPIC_THINKING_EFFORT`
- `ANTHROPIC_MAX_TOKENS`

**UI 变化：**
- 在配置对话框中新增"Advanced Settings"可折叠区域
- 提供下拉选择和数值输入控件
- 每个字段都有说明提示

### 3. 配置字段优化

**优化点：**
1. 所有高级字段都支持清空（传空值时从配置中移除）
2. 思考模式默认值：auto（推荐）
3. 思考深度默认值：high（平衡性能与质量）
4. Max tokens 默认值：8192（适合大多数场景）

## 类型定义更新

### TypeScript (src/types/index.ts)
```typescript
export interface ClaudeConfigRequest {
  api_key: string;
  auth_token: string;
  base_url?: string;
  model?: string;
  custom_config_path?: string;
  thinking_mode?: 'auto' | 'enabled' | 'disabled';
  thinking_effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  max_tokens?: number;
}
```

### Rust (src-tauri/src/commands/claude.rs)
```rust
pub struct ClaudeConfigRequest {
    pub api_key: String,
    pub auth_token: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub custom_config_path: Option<String>,
    pub thinking_mode: Option<String>,
    pub thinking_effort: Option<String>,
    pub max_tokens: Option<u32>,
}
```

## 使用示例

### 配置三方代理（自动避免 authtoken 冲突）
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-xxx",
    "ANTHROPIC_BASE_URL": "https://api.smai.ai",
    "ANTHROPIC_MODEL": "claude-fable-5"
  },
  "model": "claude-fable-5"
}
```
注意：使用代理时不会写入 `ANTHROPIC_AUTH_TOKEN`

### 配置官方 API（包含 authtoken）
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-xxx",
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-xxx",
    "ANTHROPIC_MODEL": "claude-fable-5"
  },
  "model": "claude-fable-5"
}
```

### 配置高级选项（发挥模型全部能力）
```json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-xxx",
    "ANTHROPIC_BASE_URL": "https://api.smai.ai",
    "ANTHROPIC_MODEL": "claude-fable-5",
    "ANTHROPIC_THINKING_MODE": "auto",
    "ANTHROPIC_THINKING_EFFORT": "high",
    "ANTHROPIC_MAX_TOKENS": "8192"
  },
  "model": "claude-fable-5"
}
```

## 测试清单

- [ ] 使用三方代理配置，验证不会生成 `ANTHROPIC_AUTH_TOKEN`
- [ ] 使用官方 API 配置，验证会生成 `ANTHROPIC_AUTH_TOKEN`
- [ ] 从官方 API 切换到代理，验证会自动移除 `ANTHROPIC_AUTH_TOKEN`
- [ ] 配置 thinking_mode，验证生成正确的环境变量
- [ ] 配置 thinking_effort，验证生成正确的环境变量
- [ ] 配置 max_tokens，验证生成正确的环境变量
- [ ] 清空高级字段，验证会从配置中移除对应环境变量
- [ ] UI 测试：展开/折叠高级设置区域
- [ ] UI 测试：各个下拉框和输入框的交互

## 向后兼容性

所有改进都是向后兼容的：
- 旧配置文件不受影响
- 新字段都是可选的
- 不使用高级选项时行为与之前完全一致

## 技术细节

### 代理检测逻辑
使用 `base_url` 是否包含 "api.anthropic.com" 来判断是否为官方 API：
- 官方 API：`https://api.anthropic.com`
- 三方代理：其他任何地址（如 `https://api.smai.ai`）

### 配置清理
当字段值为空时，会主动从配置中移除该字段：
```rust
if !thinking_mode.is_empty() {
    config.env.insert("ANTHROPIC_THINKING_MODE".to_string(), thinking_mode);
} else {
    config.env.remove("ANTHROPIC_THINKING_MODE");
}
```

## 后续优化建议

1. 添加配置预设（快速配置常用组合）
2. 提供配置导入/导出功能
3. 支持批量配置多个模型
4. 添加配置验证和错误提示
5. 支持更多 Claude Code 环境变量（如 context window、temperature 等）
