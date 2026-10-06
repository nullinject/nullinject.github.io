import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(root, process.env.SITE_OUTPUT || 'dist');
if (out === root || out.startsWith(path.join(root, 'content') + path.sep)) {
  throw new Error('Build output must be a separate directory.');
}
const site = JSON.parse(await readFile(path.join(root, 'site.json'), 'utf8'));
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

function shell({ title, active, body, prefix = './', description = site.description }) {
  const nav = [['首页', 'index.html', 'home'], ['项目', 'projects.html', 'projects'], ['文章', 'articles.html', 'articles'], ['关于', 'about.html', 'about']];
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(title)} · ${escape(site.name)}</title><meta name="description" content="${escape(description)}"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${prefix}assets/site.css"><script src="${prefix}assets/site.js" defer></script></head>
<body><a class="skip-link" href="#main">跳到正文</a><div class="site-wrap"><header class="site-header"><a class="brand" href="${prefix}index.html" aria-label="${escape(site.name)} 首页"><span>${escape(site.name)}</span><span class="handle">${escape(site.username)}</span></a><nav class="nav" aria-label="主导航">${nav.map(([label, url, key]) => `<a href="${prefix}${url}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}${external(github, 'GitHub', 'nav-github')}</nav></header>
<main id="main">${body}</main><footer class="site-footer"><span>© ${site.year} ${escape(site.name)}</span><div>${external(github, 'GitHub')}<a href="${prefix}about.html">关于</a></div></footer></div></body></html>`;
}

function projectRows(projects) {
  return `<div class="project-list">${projects.map((p, i) => `<a class="project-row" href="${github}/${escape(p.repo)}" target="_blank" rel="noopener noreferrer"><span class="row-number">${String(i + 1).padStart(2, '0')}</span><h3>${escape(p.name)}</h3><p>${escape(p.description)}</p>${arrow(true)}<span class="sr-only">（在新标签页打开）</span></a>`).join('')}</div>`;
}

function postRows(posts, archive = false) {
  return `<div class="post-list${archive ? ' archive-list' : ''}">${posts.map(p => `<a class="post-row" href="./articles/${p.slug}.html" data-category="${escape(p.category)}"><span class="category">${escape(p.category)}</span><div><h3>${escape(p.title)}</h3>${archive ? `<p>${escape(p.description)}</p>` : ''}</div>${arrow(true)}</a>`).join('')}</div>`;
}

const home = `<section class="hero" aria-labelledby="hero-title"><div class="hero-intro"><h1 id="hero-title">探索 AI 安全，<br>追踪数字证据。</h1><p>我是 ${escape(site.name)}，关注 Prompt Injection、Agent 信任边界与取证自动化。<br class="desktop-break">这里记录研究、实验，以及工具开发。</p><div class="hero-actions"><a class="button" href="./articles.html">阅读研究笔记</a><a class="text-link" href="./projects.html">浏览项目${arrow(true)}</a></div></div><aside class="focus" aria-label="关注方向"><h2>关注方向</h2><dl><div><dt>AI 安全</dt><dd>Prompt Injection · Agent 信任边界</dd></div><div><dt>数字取证</dt><dd>内存分析 · 证据链</dd></div><div><dt>工具开发</dt><dd>取证自动化 · 安全工具</dd></div></dl></aside></section>
<section class="home-projects" aria-labelledby="projects-title"><div class="section-heading"><h2 id="projects-title">精选项目</h2><a class="text-link" href="./projects.html">全部项目${arrow(true)}</a></div>${projectRows(site.projects.slice(0, 3))}</section>
<section class="home-posts" aria-labelledby="posts-title"><div class="section-heading"><h2 id="posts-title">研究笔记</h2><a class="text-link" href="./articles.html">所有文章${arrow(true)}</a></div>${postRows(site.posts)}</section>`;

const projects = `<section class="page-intro"><h1>项目</h1><p>从研究问题出发，把思考落到工具与实践中。</p></section><section aria-label="公开项目">${projectRows(site.projects)}</section><p class="project-note">MemoryAI Forensics 为公开展示仓库；CPR Excel Companion 为实验性项目。使用前请阅读对应仓库的适用范围与版本说明。</p>`;
const categories = [...new Set(site.posts.map(p => p.category))];
const articles = `<section class="page-intro"><h1>研究笔记</h1><p>记录研究、实验与证据，也记录尚待解答的问题。</p></section><div class="filters" role="group" aria-label="按文章方向筛选"><button type="button" data-filter="all" aria-pressed="true">全部</button>${categories.map(c => `<button type="button" data-filter="${escape(c)}" aria-pressed="false">${escape(c)}</button>`).join('')}</div><p class="sr-only" id="filter-status" aria-live="polite">显示 ${site.posts.length} 篇文章</p>${postRows(site.posts, true)}`;
const about = `<section class="page-intro"><h1>关于我</h1><p>${escape(site.name)} / ${escape(site.username)}</p></section><div class="about-content"><p class="about-lead">关注 AI 安全与数字取证，研究 Prompt Injection、Agent 信任边界与取证自动化，记录实验、证据与工具开发。</p><section><h2>关注方向</h2><dl class="about-directions"><div><dt>AI 安全</dt><dd>提示注入、RAG 与 Agent 的信任边界，以及模型输出的来源和可信度。</dd></div><div><dt>数字取证</dt><dd>内存分析、证据链，以及从调查流程到证据报告的自动化。</dd></div><div><dt>工具开发</dt><dd>围绕研究与实际问题，构建安全工具和工作流。</dd></div></dl></section><section><h2>交流</h2><p>欢迎通过相关项目的 GitHub Issues 交流使用反馈、研究问题与改进建议。</p>${external(github, '访问 GitHub 主页', 'text-link')}</section></div>`;

await mkdir(path.join(out, 'articles'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
for (const [file, title, active, body] of [['index.html', '首页', 'home', home], ['projects.html', '项目', 'projects', projects], ['articles.html', '研究笔记', 'articles', articles], ['about.html', '关于', 'about', about]]) {
  await writeFile(path.join(out, file), shell({ title, active, body }));
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
  const body = `<div class="article-page"><a class="back-link" href="../articles.html">${arrow()}所有文章</a><header class="article-header"><p class="category">${escape(post.category)}</p><h1>${escape(post.title)}</h1><p class="article-deck">${escape(post.description)}</p><div class="article-provenance"><span>${escape(site.name)} · 研究笔记</span>${sourceUrl ? external(sourceUrl, 'GitHub 原文') : ''}</div></header>${toc}<article class="prose" aria-label="文章正文">${sourceUrl ? `<p class="original-title">原文标题：${escape(firstHeading?.[1] || post.title)}</p>` : ''}${prose}</article><div class="article-end"><a class="text-link" href="../articles.html">${arrow()}返回文章列表</a>${historyUrl ? external(historyUrl, '查看修订记录', 'text-link') : ''}</div></div>`;
  await writeFile(path.join(out, 'articles', `${post.slug}.html`), shell({ title: post.title, description: post.description, active: 'articles', prefix: '../', body }));
}
await writeFile(path.join(out, '404.html'), shell({ title: '页面未找到', active: '', prefix: '/', body: '<section class="page-intro"><h1>这一页还没有写下。</h1><p>链接可能已更新，你可以从首页或文章列表继续阅读。</p><a class="button" href="/">回到首页</a></section>' }));
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built ${site.posts.length + 5} static pages in ${out}`);
