import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingMeter } from '../assets/reading-meter.js';
import { initAnalytics } from '../assets/analytics.js';

test('reading pauses when hidden or unfocused and reports each threshold once', () => {
  const meter = createReadingMeter();
  const sample = (time, active = true) => meter.sample(time, { active });
  sample(0);
  for (let time = 1000; time <= 15000; time += 1000) sample(time);
  sample(16000, false);
  sample(100000, false);
  assert.equal(sample(101000).seconds, 16);
  for (let time = 102000; time < 115000; time += 1000) sample(time);
  assert.deepEqual(sample(115000).milestones, [30]);
  assert.deepEqual(sample(116000).milestones, []);
  for (let time = 117000; time < 145000; time += 1000) sample(time);
  assert.deepEqual(sample(145000).milestones, [60]);
});

test('suspension gaps are excluded and end-of-article requires time plus progress', () => {
  const meter = createReadingMeter();
  meter.sample(0, { active: true });
  assert.equal(meter.sample(120000, { active: true }).seconds, 0);
  for (let time = 121000; time <= 149000; time += 1000) {
    assert.equal(meter.sample(time, { active: true, progress: 0.95 }).reachedEnd, false);
  }
  assert.equal(meter.sample(150000, { active: true, progress: 0.95 }).reachedEnd, true);
  assert.equal(meter.sample(151000, { active: true, progress: 1 }).reachedEnd, false);
});

test('hidden scroll does not qualify as reaching the article end', () => {
  const meter = createReadingMeter();
  meter.sample(0, { active: true, progress: 0.2 });
  for (let time = 1000; time <= 30000; time += 1000) meter.sample(time, { active: true, progress: 0.2 });
  assert.equal(meter.sample(31000, { active: false, progress: 1 }).reachedEnd, false);
  assert.equal(meter.sample(32000, { active: true, progress: 0.2 }).reachedEnd, false);
});

function fixture({ enabled = true, host = 'localhost', article = true, failPath, missingPath } = {}) {
  let now = 0;
  const events = [], requests = [], scripts = [], listeners = new Map();
  const labels = { total: { textContent: '加载中' }, article: { textContent: '加载中' } };
  const config = { dataset: {
    analyticsSite: enabled ? 'https://test-account.goatcounter.com' : '',
    productionHost: 'nullinject.github.io', pagePath: '/articles/note.html',
    counterPaths: JSON.stringify(['/', '/articles/note.html'])
  } };
  const bind = (name, fn) => listeners.set(name, fn);
  const doc = {
    title: '测试文章 · Void Prompt', visibilityState: 'visible', focused: true,
    hasFocus() { return this.focused; }, addEventListener: bind,
    head: { appendChild: script => scripts.push(script) },
    createElement: () => ({ dataset: {}, addEventListener: bind }),
    querySelector: selector => ({
      'script[data-analytics-site]': config, '[data-site-count]': labels.total,
      '[data-article-count]': article ? labels.article : null,
      'article.prose': article ? { getBoundingClientRect: () => ({ top: 0, height: 1000 }) } : null
    })[selector]
  };
  const win = {
    location: { hostname: host }, innerHeight: 950,
    addEventListener: bind, setInterval: fn => { listeners.set('tick', fn); return 1; },
    clearInterval: () => listeners.delete('tick'), setTimeout, clearTimeout,
    goatcounter: { count: event => events.push(event) }
  };
  const request = async (url, options) => {
    requests.push({ url, options });
    const path = decodeURIComponent(url.match(/counter\/(.*)\.json$/)[1]);
    if (path === failPath) return { ok: false, status: 403 };
    if (path === missingPath) return { ok: false, status: 404, json: async () => ({ count: '0' }) };
    return { ok: true, status: 200, json: async () => ({ count: path === '/' ? '1,234' : '10' }) };
  };
  return { doc, win, request, clock: { now: () => now }, labels, config, events, requests, scripts, listeners,
    advance(time) { now = time; listeners.get('tick')?.(); }
  };
}

test('disabled integration performs no requests and loads no external script', async () => {
  const f = fixture({ enabled: false });
  await initAnalytics(f);
  assert.equal(f.requests.length, 0);
  assert.equal(f.scripts.length, 0);
});

test('public site total sums page counts without custom events; local preview sends no visits', async () => {
  const f = fixture();
  await initAnalytics(f);
  assert.equal(f.labels.total.textContent, '1,244 次');
  assert.equal(f.labels.article.textContent, '10 次');
  assert.equal(f.requests.length, 2);
  assert.ok(f.requests.every(r => !r.url.includes('TOTAL') && r.options.credentials === 'omit'));
  assert.equal(f.scripts.length, 0);
  assert.equal(f.events.length, 0);
});

test('403/network errors do not turn into a fabricated zero; valid missing-path zero is accepted', async () => {
  const failed = fixture({ failPath: '/' });
  await initAnalytics(failed);
  assert.equal(failed.labels.total.textContent, '暂不可用');
  assert.equal(failed.labels.article.textContent, '10 次');
  const missing = fixture({ missingPath: '/articles/note.html' });
  await initAnalytics(missing);
  assert.equal(missing.labels.article.textContent, '0 次');
  assert.equal(missing.labels.total.textContent, '1,234 次');
  const network = fixture();
  network.request = async () => { throw new Error('Network unavailable'); };
  await initAnalytics(network);
  assert.equal(network.labels.total.textContent, '暂不可用');
  assert.equal(network.labels.article.textContent, '暂不可用');
});

test('production tracker has one pageview source; milestones survive slow tracker loading', async () => {
  const f = fixture({ host: 'nullinject.github.io' });
  await initAnalytics(f);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].dataset.goatcounter, 'https://test-account.goatcounter.com/count');
  assert.deepEqual(JSON.parse(f.scripts[0].dataset.goatcounterSettings), { path: '/articles/note.html', no_events: true });
  for (let time = 1000; time <= 30000; time += 1000) f.advance(time);
  assert.equal(f.events.length, 0);
  f.listeners.get('load')();
  assert.deepEqual(f.events.map(e => e.path), ['read-30s:/articles/note.html', 'read-end:/articles/note.html']);
  assert.ok(f.events.every(e => e.event === true));
  f.doc.visibilityState = 'hidden';
  f.listeners.get('visibilitychange')();
  f.advance(120000);
  f.doc.visibilityState = 'visible';
  f.listeners.get('visibilitychange')();
  for (let time = 121000; time <= 150000; time += 1000) f.advance(time);
  assert.deepEqual(f.events.map(e => e.path), ['read-30s:/articles/note.html', 'read-end:/articles/note.html', 'read-60s:/articles/note.html']);
});

test('unfocused tabs pause the meter and tracker failure stops counting', async () => {
  const f = fixture({ host: 'nullinject.github.io' });
  await initAnalytics(f);
  f.listeners.get('load')();
  f.doc.focused = false;
  f.listeners.get('blur')();
  for (let time = 1000; time <= 60000; time += 1000) f.advance(time);
  assert.equal(f.events.length, 0);
  f.doc.focused = true;
  f.listeners.get('focus')();
  for (let time = 61000; time <= 90000; time += 1000) f.advance(time);
  assert.equal(f.events.length, 2);
  f.listeners.get('error')();
  assert.equal(f.listeners.has('tick'), false);
  f.advance(300000);
  assert.equal(f.events.length, 2);
});

test('non-article pages record stay milestones without an article-end event', async () => {
  const f = fixture({ host: 'nullinject.github.io', article: false });
  await initAnalytics(f);
  f.listeners.get('load')();
  for (let time = 1000; time <= 30000; time += 1000) f.advance(time);
  assert.deepEqual(f.events.map(e => e.path), ['stay-30s:/articles/note.html']);
});

test('malformed configuration and counter data are rejected without exposing text as HTML', async () => {
  const invalid = fixture();
  invalid.config.dataset.analyticsSite = 'https://untrusted.example';
  await initAnalytics(invalid);
  assert.equal(invalid.requests.length, 0);
  assert.equal(invalid.labels.total.textContent, '暂不可用');
  const malformed = fixture();
  malformed.request = async () => ({ ok: true, json: async () => ({ count: '<script>1</script>' }) });
  await initAnalytics(malformed);
  assert.equal(malformed.labels.total.textContent, '暂不可用');
  assert.equal(malformed.labels.article.textContent, '暂不可用');
});

test('GoatCounter thousands separators are supported without changing the site count', async () => {
  for (const count of ['1\u202f234', '1\u2009234', "1'234", '1.234', '1 234']) {
    const f = fixture();
    f.request = async () => ({ ok: true, json: async () => ({ count }) });
    await initAnalytics(f);
    assert.equal(f.labels.article.textContent, '1,234 次');
    assert.equal(f.labels.total.textContent, '2,468 次');
  }
});
