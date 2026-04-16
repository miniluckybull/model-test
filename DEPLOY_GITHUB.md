# 🚀 部署到 GitHub 指南

## 步骤 1：创建 GitHub 仓库

1. 在 GitHub 创建新仓库 `model-test`
2. 初始化仓库并推送代码：

```bash
cd /Users/wxw/model-test
git init
git add .
git commit -m "Initial commit: Model Tester app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/model-test.git
git push -u origin main
```

## 步骤 2：创建发布标签

每次发布新版本时：

```bash
# 更新版本号（在 package.json 和 src-tauri/tauri.conf.json 中）
git tag v0.1.0
git push origin v0.1.0
```

推送标签后，GitHub Actions 会自动构建并发布安装包。

## 步骤 3：自动构建流程

GitHub Actions 配置已创建，会自动执行以下操作：

- **macOS Apple Silicon** - 构建 `.dmg`
- **macOS Intel** - 构建 `.dmg`
- **Windows** - 构建 `.exe` / `.msi`

构建完成后，安装包会自动上传到 GitHub Releases。

## 步骤 4：获取安装链接

同事访问以下链接下载安装：
```
https://github.com/YOUR_USERNAME/model-test/releases
```

## 🔑 注意事项

- 构建是自动触发的，无需手动操作
- 每次推送 `v*` 标签会创建新版本
- 构建状态可在 Actions 标签页查看
- 确保仓库设置为 Public（免费用户）或 Private（组织/付费用户）
