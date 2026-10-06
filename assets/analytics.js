import { createReadingMeter } from './reading-meter.js';

function parseCount(value) {
  if (typeof value !== 'string' || !/^\d[\d,.'\s]*$/.test(value)) throw new Error('Invalid counter response.');
  const count = Number(value.replace(/\D/g, ''));
  if (!Number.isSafeInteger(count)) throw new Error('Counter is outside the supported range.');
  return count;
}

export async function initAnalytics({ doc = document, win = window, request = fetch, clock = performance } = {}) {
  const config = doc.querySelector('script[data-analytics-site]');
  const totalLabel = doc.querySelector('[data-site-count]');
  const articleLabel = doc.querySelector('[data-article-count]');
  const labels = [totalLabel, articleLabel].filter(Boolean);
  const showUnavailable = () => labels.forEach(label => { label.textContent = '暂不可用'; });
  if (!config?.dataset.analyticsSite) return;

  const site = config.dataset.analyticsSite;
  const pagePath = config.dataset.pagePath;
  let paths;
  try {
    paths = JSON.parse(config.dataset.counterPaths);
    if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com$/.test(site) ||
        !pagePath?.startsWith('/') || !Array.isArray(paths) ||
        !paths.length || paths.some(path => typeof path !== 'string' || !path.startsWith('/'))) {
      throw new Error('Invalid analytics configuration.');
    }
  } catch {
    showUnavailable();
    return;
  }

  // Local previews can read public counters, but never send visits or reading events.
  if (win.location.hostname === config.dataset.productionHost) {
    const tracker = doc.createElement('script');
    tracker.src = 'https://gc.zgo.at/count.js';
    tracker.async = true;
    tracker.dataset.goatcounter = `${site}/count`;
    tracker.dataset.goatcounterSettings = JSON.stringify({ path: pagePath, no_events: true });
    const pending = [];
    let ready = false;
    let stopped = false;
    let interval;
    const meter = createReadingMeter();
    const article = doc.querySelector('article.prose');
    const send = (event) => {
      if (ready) win.goatcounter.count(event);
      else pending.push(event);
    };
    const sample = (activeOverride) => {
      if (stopped) return;
      const active = activeOverride ?? (doc.visibilityState === 'visible' && doc.hasFocus());
      const rect = article?.getBoundingClientRect();
      const progress = rect && rect.height > 0 ? (win.innerHeight - rect.top) / rect.height : 0;
      const result = meter.sample(clock.now(), { active, progress });
      const kind = article ? 'read' : 'stay';
      for (const seconds of result.milestones) {
        send({ event: true, path: `${kind}-${seconds}s:${pagePath}`, title: `${doc.title} · 前台${article ? '阅读' : '停留'} ≥ ${seconds} 秒` });
      }
      if (article && result.reachedEnd) {
        send({ event: true, path: `read-end:${pagePath}`, title: `${doc.title} · 前台阅读 ≥ 30 秒且达到正文 90%` });
      }
    };
    tracker.addEventListener('load', () => {
      if (typeof win.goatcounter?.count !== 'function') return;
      ready = true;
      for (const event of pending.splice(0)) win.goatcounter.count(event);
    });
    tracker.addEventListener('error', () => {
      stopped = true;
      pending.length = 0;
      win.clearInterval(interval);
    });
    doc.head.appendChild(tracker);
    sample();
    interval = win.setInterval(() => sample(), 1000);
    doc.addEventListener('visibilitychange', () => sample());
    win.addEventListener('blur', () => sample(false));
    win.addEventListener('focus', () => sample());
    win.addEventListener('pagehide', () => sample(false));
    win.addEventListener('pageshow', () => sample());
    win.addEventListener('scroll', () => sample(), { passive: true });
  }

  const getCount = async (path) => {
    const controller = new AbortController();
    const timeout = win.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await request(`${site}/counter/${encodeURIComponent(path)}.json`, {
        credentials: 'omit', signal: controller.signal
      });
      if (!response.ok && response.status !== 404) throw new Error('Counter request failed.');
      const data = await response.json();
      const count = parseCount(data.count);
      // GoatCounter returns a JSON zero with 404 only for a path without recorded visits.
      if (!response.ok && count !== 0) throw new Error('Counter path was not found.');
      return count;
    } finally {
      win.clearTimeout(timeout);
    }
  };
  const counts = new Map([...new Set(paths)].map(path => [path, getCount(path)]));
  const format = count => new Intl.NumberFormat('zh-CN').format(count);
  const tasks = [];
  if (articleLabel) {
    const articleCount = counts.get(pagePath) || getCount(pagePath);
    tasks.push(articleCount.then(count => { articleLabel.textContent = `${format(count)} 次`; }, () => { articleLabel.textContent = '暂不可用'; }));
  }
  // TOTAL includes custom events in GoatCounter. Sum actual page paths instead,
  // so reading milestones do not inflate the public site counter.
  tasks.push(Promise.all([...counts.values()]).then(values => {
    if (totalLabel) totalLabel.textContent = `${format(values.reduce((sum, count) => sum + count, 0))} 次`;
  }, () => { if (totalLabel) totalLabel.textContent = '暂不可用'; }));
  await Promise.all(tasks);
}

if (typeof document !== 'undefined') initAnalytics();
