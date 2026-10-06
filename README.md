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

Markdown 中的 HTML 作为文本显示，不执行脚本。网站本身由 GitHub Pages 托管，不加载外部字体。启用统计后会加载 GoatCounter 脚本，并向指定统计账号发送匿名访问与阅读事件。

## 检查

`npm run build`、`node --check build.mjs`、`node --check preview.mjs`、`node --check assets/site.js`、`npm audit --audit-level=moderate`。

初版通过本地内置浏览器的导航、筛选、目录跳转与桌面/手机布局检查，8 个页面及 132 处本地链接、资源和锚点检查通过。没有实际设备或全浏览器兼容性测试。

## 访问、文章阅读与时长统计

当前配置的统计账号为 [nullinject.goatcounter.com](https://nullinject.goatcounter.com/)。网站使用这个账号提供公开计数和匿名访问统计。详细统计后台仅登录可见；网站公开展示全站与文章访问计数。

首次接入时，先在 [GoatCounter](https://www.goatcounter.com/signup) 注册并验证邮箱。站点设置打开 **Allow adding visitor counts on your website**，保持统计后台为私有。无需在网站中配置密码或 API 密钥。

在 `site.json` 设置：

```json
"analytics": {
  "enabled": true,
  "site": "https://你的账号名.goatcounter.com",
  "productionHost": "nullinject.github.io"
}
```

`site` 必须使用实际账号的 HTTPS 地址，不带尾斜杠或路径。不要在完成账号准备前启用。`enabled: false` 时页面显示“暂未启用”，不加载外部统计脚本，也不请求公开计数。

页面页脚显示累计访问，各文章显示阅读次数。默认口径遵循 GoatCounter 的会话去重规则，重复刷新不一定增加次数；它不是精准的人数或每次加载都计数的 PV。全站公开数字是当前首页、项目、文章列表、关于页和所有文章访问次数之和，不包含 404 或阅读时长事件。GoatCounter 的 `TOTAL` 接口包含事件，因此本实现有意不用它。各页面公开接口可能缓存约 4 小时，合计数也可能与后台最新数据暂时不同。删除页面后，它不再参与合计。

后台可按页面查看以下**累计达到阈值的访问数**，不是互斥区间，不能直接相加：

- `read-30s:/articles/文章名.html`：前台阅读达到 30 秒。
- `read-60s:…`、`read-180s:…`、`read-300s:…`：达到 1、3、5 分钟。
- `read-end:…`：前台阅读至少 30 秒，且正文曾滚动到 90%。这是到达文末的估算，不代表读完。
- 非文章页面记录对应的 `stay-30s:…` 等停留事件。

只累计页面可见且窗口获得焦点的时间；隐藏、失去焦点、离开和浏览器休眠暂停计时。超过 5 秒的计时回调间隔被视为可能的系统挂起，不计入。每个阈值在一次页面加载中最多发送一次，同时仍受 GoatCounter 会话去重影响。浏览器无法确认访客正在阅读；前台无人操作仍可能累计，因此不能把这些数据当成真正的人类阅读时间。

该方案**不提供原生平均阅读时长或精确的逐人阅读时长**。如需“平均 2 分 18 秒”等数值，需要另做时长收集和汇总。

本地 `127.0.0.1` 预览不发送访问或时长事件；启用后本地仅可读取公开计数。广告拦截、断网或服务错误可能导致缺失，计数请求失败时显示“暂不可用”，不会当成 0。有效的无访问记录响应才显示 0。

修改后执行 `npm test` 和 `npm run build`，本地确认；获得发布确认后使用 `SITE_OUTPUT=docs npm run build`，提交源码与发布目录。网站不会自动注册统计账号；修改源码后需生成并发布 `docs/` 才会更新线上页面。

参考：[公开计数](https://www.goatcounter.com/help/visitor-counter)、[自定义事件](https://www.goatcounter.com/help/events)、[会话去重](https://www.goatcounter.com/help/sessions)。
