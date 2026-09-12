# 更新日志

## 0.2.0
- 多 API 配置管理：增删改、复制、标签分组
- 实时连通性测试 + 延迟 / Token 统计；"全部测试"一键批量
- 应用配置到 Claude Code（写入 `~/.claude/settings.json`），三方代理自动避免 `ANTHROPIC_AUTH_TOKEN` 冲突
- 高级参数：thinking_mode / thinking_effort / max_tokens
- 项目级导出（生成项目 `.claude/settings.json`）
- 配置导入 / 导出（JSON）、配置模板（Claude / OpenAI 官方与通用代理）
- 统计面板、暗色主题、本地持久化

## 0.2.0 之后（体验迭代）
- UI 统一到紧凑按钮体系；修复 `.stat-value` 样式冲突
- Claude 配置弹窗：路径改为单选列表 + 保存对话框（可新建文件）；参数改为横向滑块（填充轨道 + 档位标签）
- 全产品中文化（前端界面 + Rust 后端错误信息）
- 移除多选/批量、顶部重复工具条、搜索筛选条；恢复 logo 呼吸动画
- 仓库瘦身：移除误提交的发布 dmg 与图标中间产物

## 0.1.0
- 初版：API 配置管理 + 连通性测试
