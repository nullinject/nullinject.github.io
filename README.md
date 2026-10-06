# Void Prompt · Personal Homepage & Blog

[Visit the website](https://nullinject.github.io/)

AI 安全、数字取证、Prompt Injection、Agent 信任边界与取证自动化的个人主页及研究笔记。

## 内容与发布

- `site.json`：个人资料、项目列表、文章元数据。
- `content/`：Markdown 文章正文。
- `assets/`：网页样式、分类筛选与图标。
- `build.mjs`：静态网站生成器。
- `docs/`：GitHub Pages 实际发布文件。

网站从 `main` 分支的 `/docs` 目录发布。源码和网站文件共同保存在这个仓库中。

## 本地预览

需要 Node.js 20 或更新版本。

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

打开 http://127.0.0.1:4173/。修改后重新构建并刷新。

## 更新文章与网站

在 `content/` 添加 Markdown 文件，并在 `site.json` 的 `posts` 数组添加对应的 `slug`、`title`、`category` 和 `description`。`slug` 必须与 Markdown 文件名一致，使用小写字母、数字和连字符。新写的独立文章可以省略 `sourceFile`。

发布前生成网站文件：

```sh
SITE_OUTPUT=docs npm run build
```

检查效果，再把源码与 `docs/` 的变更一同提交到 `main`。GitHub Pages 随后发布更新。单独修改 Markdown 不会重新生成 `docs/`。

## 来源与边界

最初三篇文章来自自己的公开仓库 `nullinject/llm-security-research`，固定版本为 `d0b74f27fe4bff19cda9ca0b99da64d2b3e4529f`，获取日期 2026-10-07。保留原文标题及正文，列表使用简短标题；网页提供原文和修订记录链接。本次网站制作没有独立复测正文中的技术结论或厂商状态。

Markdown 中的 HTML 作为文本显示，不执行脚本。网站运行时无需后端，不加载外部字体或第三方脚本。

## 检查

`npm run build`、`node --check build.mjs`、`node --check preview.mjs`、`node --check assets/site.js`、`npm audit --audit-level=moderate`。

初版通过本地内置浏览器的导航、筛选、目录跳转与桌面/手机布局检查，8 个页面及 132 处本地链接、资源和锚点检查通过。没有实际设备或全浏览器兼容性测试。
