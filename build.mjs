import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(root, process.env.SITE_OUTPUT || 'dist');
if (out === root || out.startsWith(path.join(root, 'content') + path.sep)) {
  throw new Error('Build output must be a separate directory.');
}
const site = JSON.parse(await readFile(path.join(root, 'site.json'), 'utf8'));
const stylesheetVersion = createHash('sha256').update(await readFile(path.join(root, 'assets', 'site.css'))).digest('hex').slice(0, 12);
const analytics = site.analytics || { enabled: false, site: '', productionHost: `${site.username}.github.io` };
if (analytics.site && !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com$/.test(analytics.site)) {
  throw new Error('Analytics site must be an HTTPS GoatCounter account URL without a path.');
}
if (analytics.enabled && !analytics.site) throw new Error('An enabled analytics site needs its account URL.');
if (!/^[a-z0-9.-]+$/.test(analytics.productionHost)) throw new Error('Invalid analytics production host.');
const counterPaths = ['/', '/projects.html', '/articles.html', '/about.html', ...site.posts.map(p => `/articles/${p.slug}.html`)];
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arrow = (external = false) => `<svg class="arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${external ? '<path d="M6 18 18 6M6 6h12v12"/>' : '<path d="M4 12h15m-6-6 6 6-6 6"/>'}</svg>`;
const github = `https://github.com/${site.username}`;
const external = (url, label, cls = '') => `<a class="${cls}" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}${arrow(true)}<span class="sr-only">（在新标签页打开）</span></a>`;
const fileNames = new Set(await readdir(path.join(root, 'content')));
const slugs = new Set();
for (const post of site.posts) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || slugs.has(post.slug) || !fileNames.has(`${post.slug}.md`)) {
    throw new Error(`Invalid, duplicate, or missing post: ${post.slug}`);
  }
  slugs.add(post.slug);
}

function shell({ title, active, body, pagePath, prefix = './', description = site.description }) {
  const nav = [['首页', 'index.html', 'home'], ['项目', 'projects.html', 'projects'], ['文章', 'articles.html', 'articles'], ['关于', 'about.html', 'about']];
  const counter = `<span class="site-count" title="各页面访问次数之和，按统计服务的会话规则去重；不含阅读时长事件。">累计访问 <span data-site-count>${analytics.enabled ? '加载中' : '暂未启用'}</span></span>`;
  const analyticsScript = `<script type="module" src="${prefix}assets/analytics.js" data-analytics-site="${analytics.enabled ? escape(analytics.site) : ''}" data-production-host="${escape(analytics.productionHost)}" data-page-path="${escape(pagePath)}" data-counter-paths="${escape(JSON.stringify(counterPaths))}"></script>`;
  const canonical = `https://${site.username}.github.io${pagePath}`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(title)} · ${escape(site.name)}</title><meta name="description" content="${escape(description)}"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${pagePath.startsWith('/articles/') ? 'article' : 'website'}"><meta property="og:title" content="${escape(title)} · ${escape(site.name)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:locale" content="zh_CN"><link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${prefix}assets/site.css?v=${stylesheetVersion}"><script src="${prefix}assets/site.js" defer></script>${analyticsScript}</head>
<body><a class="skip-link" href="#main">跳到正文</a><div class="site-wrap"><header class="site-header"><a class="brand" href="${prefix}index.html" aria-label="${escape(site.name)} 首页"><span>${escape(site.username)}</span><span class="handle">${escape(site.name)}</span></a><nav class="nav" aria-label="主导航">${nav.map(([label, url, key]) => `<a href="${prefix}${url}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}${external(github, 'GitHub', 'nav-github')}</nav></header>
<main id="main">${body}</main><footer class="site-footer"><div class="footer-main"><div><p class="footer-name">${escape(site.name)} / ${escape(site.username)}</p><p>研究问题、使用反馈与改进建议，欢迎在项目 Issues 交流。</p></div><nav aria-label="页脚导航">${external(github, 'GitHub')}<a href="${prefix}about.html">关于</a></nav></div><div class="footer-meta"><span>© ${site.year} ${escape(site.name)}</span>${counter}</div></footer></div></body></html>`;
}

function projectRows(projects) {
  return `<div class="project-list">${projects.map((p, i) => `<a class="project-row" href="${github}/${escape(p.repo)}" target="_blank" rel="noopener noreferrer"><span class="row-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div class="project-copy"><h3>${escape(p.name)}</h3><p>${escape(p.description)}</p></div><span class="project-kind">${escape(p.kind || '公开项目')}</span>${arrow(true)}<span class="sr-only">（在新标签页打开）</span></a>`).join('')}</div>`;
}

function postRows(posts, archive = false) {
  return `<div class="post-list${archive ? ' archive-list' : ''}">${posts.map(p => `<a class="post-row" href="./articles/${p.slug}.html" data-category="${escape(p.category)}"><span class="category">${escape(p.category)}</span><div><h3>${escape(p.title)}</h3>${archive ? `<p>${escape(p.description)}</p>` : ''}</div>${arrow(true)}</a>`).join('')}</div>`;
}

function featuredProject() {
  const url = `${github}/MemoryAI-Forensics-Showcase`;
  return `<article class="featured-project"><div class="featured-copy"><p class="project-label">公开展示 / 数字取证</p><h3>MemoryAI Forensics</h3><p class="featured-summary">从内存镜像到证据报告。</p><p>整合 AI 工作流、Volatility 与 YARA，展示取证分析与案件管理的完整流程。</p><div class="featured-actions">${external(url, '查看项目', 'text-link')}${external(`${url}/blob/main/Technical_Design.md`, '技术设计', 'text-link')}</div><p class="featured-note">公开展示仓库，完整实现位于私有仓库。</p></div><a class="featured-media" href="${url}#product-preview" target="_blank" rel="noopener noreferrer" aria-label="查看 MemoryAI 完整界面展示（在新标签页打开）"><img src="./assets/memoryai-analysis.png" width="1600" height="1000" alt="MemoryAI Forensics 分析界面，包含阶段进度、实时日志与案件工作台" decoding="async"></a></article>`;
}

const home = `<section class="hero" aria-labelledby="hero-title"><div class="hero-intro"><h1 id="hero-title">研究 AI 安全，<br><span>构建取证工具。</span></h1><p>聚焦提示注入、Agent 信任边界与数字取证。<br>从研究记录到工具实现，让结论有迹可循。</p><div class="hero-actions"><a class="button" href="#selected-work">查看代表项目</a><a class="text-link" href="./articles.html">阅读研究笔记${arrow(true)}</a></div></div><aside class="focus" aria-label="关注方向"><h2>关注方向</h2><dl><div><dt>AI 安全</dt><dd>Prompt Injection · Agent 信任边界</dd></div><div><dt>数字取证</dt><dd>内存分析 · 证据链</dd></div><div><dt>工具开发</dt><dd>取证自动化 · 安全工具</dd></div></dl></aside></section>
<section class="home-feature" id="selected-work" aria-labelledby="projects-title"><div class="section-heading"><h2 id="projects-title">代表作品</h2><a class="text-link" href="./projects.html">全部项目${arrow(true)}</a></div>${featuredProject()}</section>
<section class="home-projects" aria-labelledby="tools-title"><div class="section-heading"><h2 id="tools-title">研究与工具</h2><a class="text-link" href="./projects.html">查看全部项目${arrow(true)}</a></div>${projectRows(site.projects.filter(p => p.repo !== 'MemoryAI-Forensics-Showcase' && p.repo !== 'ShiftPaw'))}</section>
<section class="home-posts" aria-labelledby="posts-title"><div class="section-heading"><h2 id="posts-title">研究笔记</h2><a class="text-link" href="./articles.html">所有文章${arrow(true)}</a></div>${postRows(site.posts)}</section>`;

const projectGroups = [['research', 'AI 安全与数字取证'], ['tools', '安全工具与实训'], ['other', '其他工程项目']];
const projects = `<section class="page-intro"><h1>项目</h1><p>从研究问题出发，把思考落到工具与实践中。</p></section><section aria-label="MemoryAI 代表作品">${featuredProject()}</section>${projectGroups.map(([key, label]) => `<section class="project-group" aria-labelledby="group-${key}"><div class="section-heading"><h2 id="group-${key}">${label}</h2></div>${projectRows(site.projects.filter(p => p.group === key && p.repo !== 'MemoryAI-Forensics-Showcase'))}</section>`).join('')}<p class="project-note">MemoryAI Forensics 为公开展示仓库；CPR Excel Companion 为实验性项目。适用范围、安装方式与兼容版本以各仓库说明为准。Xiaomi Photo Recovery 提取仍可访问的缓存媒体，不能恢复已覆盖的数据。</p>`;
const categories = [...new Set(site.posts.map(p => p.category))];
const articles = `<section class="page-intro"><h1>研究笔记</h1><p>记录研究、实验与证据，也记录尚待解答的问题。</p></section><div class="filters" role="group" aria-label="按文章方向筛选"><button type="button" data-filter="all" aria-pressed="true">全部</button>${categories.map(c => `<button type="button" data-filter="${escape(c)}" aria-pressed="false">${escape(c)}</button>`).join('')}</div><p class="sr-only" id="filter-status" aria-live="polite">显示 ${site.posts.length} 篇文章</p>${postRows(site.posts, true)}`;
const about = `<section class="page-intro"><h1>关于</h1><p>${escape(site.name)} / ${escape(site.username)}</p></section><div class="about-content"><p class="about-lead">AI 安全研究、取证自动化与安全工具开发。关注系统的信任边界，也关注结论背后的证据。</p><section><h2>正在研究的问题</h2><dl class="about-directions"><div><dt>AI 安全</dt><dd>外部文档、工具与 Skill 如何影响 Agent 的决策？哪些输出能被实际执行结果验证？</dd></div><div><dt>数字取证</dt><dd>如何把内存分析、证据交叉验证与报告组织串成可复盘的调查流程？</dd></div><div><dt>工具开发</dt><dd>如何把研究中的重复步骤做成可使用、可检查、边界清楚的工具？</dd></div></dl></section><section><h2>公开作品</h2><p>MemoryAI 展示内存取证平台的界面与技术设计；LLM Security Research 整理研究案例；ShadowProbe、媒体缓存提取工具与 AWD 工具包把具体问题落实为工具。</p><a class="text-link" href="./projects.html">查看全部项目${arrow()}</a></section><section><h2>研究记录的方法</h2><p>区分观察、推断与尚未验证的结论。记录适用版本、复现条件与证据来源；模型生成的日志或回答，需要与真实工具执行结果分开判断。</p><p>网站保留历史研究文章及其原文、修订记录。文章的测试时间与适用范围以正文和来源说明为准，网站更新不代表技术结论已重新验证。</p></section><section><h2>交流</h2><p>欢迎通过相关项目的 GitHub Issues 交流使用反馈、研究问题与改进建议。</p>${external(github, '访问 GitHub 主页', 'text-link')}</section></div>`;

await mkdir(path.join(out, 'articles'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
for (const [file, title, active, body] of [['index.html', '首页', 'home', home], ['projects.html', '项目', 'projects', projects], ['articles.html', '研究笔记', 'articles', articles], ['about.html', '关于', 'about', about]]) {
  await writeFile(path.join(out, file), shell({ title, active, body, pagePath: file === 'index.html' ? '/' : `/${file}` }));
}

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
// Source Markdown is displayed as text, never executed or treated as configuration.
md.renderer.rules.table_open = () => '<div class="table-scroll" tabindex="0" role="region" aria-label="文章表格"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';
const renderLink = md.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  if (/^https?:\/\//.test(token.attrGet('href') || '')) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return renderLink(tokens, index, options, env, renderer);
};
const renderHeading = md.renderer.rules.heading_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
md.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
  if (tokens[index].tag === 'h2') {
    const id = `section-${env.toc.length + 1}`;
    const label = tokens[index + 1].content.replace(/[*`]/g, '');
    tokens[index].attrSet('id', id);
    env.toc.push({ id, label });
  }
  return renderHeading(tokens, index, options, env, renderer);
};

for (const post of site.posts) {
  const source = await readFile(path.join(root, 'content', `${post.slug}.md`), 'utf8');
  const firstHeading = source.match(/^# (.+)\r?\n/);
  const env = { toc: [] };
  const prose = md.render(source.replace(/^# .+\r?\n/, ''), env);
  const sourceUrl = post.sourceFile ? `https://github.com/${site.source.repository}/blob/${site.source.commit}/${encodeURIComponent(post.sourceFile)}` : null;
  const historyUrl = post.sourceFile ? `https://github.com/${site.source.repository}/commits/main/${encodeURIComponent(post.sourceFile)}` : null;
  const toc = `<details class="article-toc"><summary>文章目录</summary><nav aria-label="文章目录"><ol>${env.toc.map(t => `<li><a href="#${t.id}">${escape(t.label)}</a></li>`).join('')}</ol></nav></details>`;
  const readingCount = `<span class="reading-count" title="文章访问次数，重复访问按统计服务的会话规则去重；不代表读完。">阅读 <span data-article-count>${analytics.enabled ? '加载中' : '暂未启用'}</span></span>`;
  const sourceNote = sourceUrl ? `<aside class="source-note" aria-label="研究记录来源说明"><p>历史研究记录 · 收录于 <time datetime="${escape(site.source.retrieved)}">${escape(site.source.retrieved)}</time> · 来源版本 <code>${escape(site.source.commit.slice(0, 7))}</code></p><p>${escape(post.editorNote || '适用环境与测试条件以原文为准；网站排版更新不代表技术结论已重新验证。')}</p></aside>` : '';
  const body = `<div class="article-page"><a class="back-link" href="../articles.html">${arrow()}所有文章</a><header class="article-header"><p class="category">${escape(post.category)}</p><h1>${escape(post.title)}</h1><p class="article-deck">${escape(post.description)}</p><div class="article-provenance"><span>${escape(site.name)} · 研究笔记</span>${readingCount}${sourceUrl ? external(sourceUrl, 'GitHub 原文') : ''}</div></header>${sourceNote}${toc}<article class="prose" aria-label="文章正文">${sourceUrl ? `<p class="original-title">原文标题：${escape(firstHeading?.[1] || post.title)}</p>` : ''}${prose}</article><div class="article-end"><a class="text-link" href="../articles.html">${arrow()}返回文章列表</a>${historyUrl ? external(historyUrl, '查看修订记录', 'text-link') : ''}</div></div>`;
  await writeFile(path.join(out, 'articles', `${post.slug}.html`), shell({ title: post.title, description: post.description, active: 'articles', prefix: '../', body, pagePath: `/articles/${post.slug}.html` }));
}
await writeFile(path.join(out, '404.html'), shell({ title: '页面未找到', active: '', prefix: '/', pagePath: '/404.html', body: '<section class="page-intro"><h1>这一页还没有写下。</h1><p>链接可能已更新，你可以从首页或文章列表继续阅读。</p><a class="button" href="/">回到首页</a></section>' }));
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built ${site.posts.length + 5} static pages in ${out}`);
