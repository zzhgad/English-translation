# Lingua Lens

一个纯前端英文阅读学习工具：上传英文图片并进行 OCR，点击单词查看释义，维护错题组，导入/导出 TXT 词书。

## GitHub Pages 部署

### 方式一：GitHub Actions 自动部署（推荐）

1. 在 GitHub 新建仓库，并将本目录中的文件推送到 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 之后每次推送到 `main`，都会自动发布到 GitHub Pages。

工作流文件位于 `.github/workflows/deploy-pages.yml`。

### 方式二：手动部署

将 Pages 来源设置为 `main` 分支的根目录即可。本项目不需要 `npm install` 或构建命令。

## DeepSeek API

GitHub Pages 没有后端，无法安全保存 API Key。纯 GitHub Pages 版本仍可使用 OCR、在线词典和错题本；DeepSeek 需要部署下面的后端代理。

## 启用受保护的 DeepSeek 后端

本项目提供 Vercel Serverless Function：`api/define.js`。在 Vercel 导入仓库后，进入 **Project Settings → Environment Variables**，添加 `DEEPSEEK_API_KEY`，然后重新部署。前端调用 `/api/define`，不会接触真实 Key。需要 DeepSeek 时，请使用 Vercel 部署后的网址访问应用。

OCR 使用浏览器端 Tesseract.js；在线词义查询使用 Free Dictionary API。首次打开页面需要联网加载 CDN 资源。
