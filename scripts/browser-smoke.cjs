/** Optional offline browser check; see docs/REPAIR_VALIDATION.md for tool provisioning. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const playwrightPath = process.env.PATH.split(path.delimiter).map(dir => path.resolve(dir, '../playwright'))
  .find(dir => fs.existsSync(path.join(dir, 'package.json')));
if (!playwrightPath) throw new Error('Run: npm exec --yes --package=playwright@1.58.2 -- node scripts/browser-smoke.cjs');
const { chromium } = require(playwrightPath);

function build(destination, live) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', destination], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: live ? 'https://fixture.supabase.co' : '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: live ? 'sb_publishable_fixture' : '',
      NEXT_PUBLIC_VIDEO_ROW_FORMAT: 'legacy', NEXT_PUBLIC_YOUTUBE_CHANNEL_ID: '' },
  });
  if (result.error || result.status !== 0) throw new Error('Browser fixture build failed; run the normal build first');
}

async function serve(directory) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
    const file = path.resolve(directory, name);
    if (!file.startsWith(path.resolve(directory) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end(); return;
    }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'h2h-browser-smoke-'));
  const servers = [];
  let browser;
  const errors = [];
  let mode = 'missing-description';
  const requests = [];
  const rows = [
    { id: 3, title: 'Stage Fancam', url: 'https://youtube.com/watch?v=aaaaaaaaaa3', type: 'stage', published_at: '2026-01-03', members: [] },
    { id: 2, title: 'Jiwoo #shorts', url: 'https://youtube.com/shorts/aaaaaaaaaa2', type: 'shorts', published_at: '2026-01-02', members: ['Carmen', 'Jiwoo'] },
    { id: 1, title: 'Hearts2Hearts Music Video MV', url: 'https://youtube.com/watch?v=aaaaaaaaaa1', type: 'mv', published_at: '2026-01-01', members: ['Carmen'], description: 'needlefixturedescription' },
  ];
  try {
    build(path.join(directory, 'demo'), false);
    build(path.join(directory, 'live'), true);
    const demo = await serve(path.join(directory, 'demo')); servers.push(demo);
    const live = await serve(path.join(directory, 'live')); servers.push(live);
    browser = await chromium.launch(process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE, headless: true }
      : { channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    // After browser-tool provisioning, all provider/image/font traffic is intercepted or blocked.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if ([new URL(demo.url).origin, new URL(live.url).origin].includes(url.origin)) return route.continue();
      if (url.hostname !== 'fixture.supabase.co') return route.abort();
      requests.push({ mode, select: url.searchParams.get('select'), offset: Number(url.searchParams.get('offset') || 0) });
      const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
      if (mode === 'permission') return route.fulfill({ status: 403, headers, body: JSON.stringify({ code: '42501', message: 'fixture policy denial' }) });
      if (mode === 'missing-description' && url.searchParams.get('select').includes('description')) {
        return route.fulfill({ status: 400, headers, body: JSON.stringify({ code: '42703', message: 'column videos.description does not exist' }) });
      }
      const data = mode === 'empty' ? [] : mode === 'invalid' ? [{ ...rows[0], url: 'https://evil.example/watch?v=aaaaaaaaaa3' }] : rows;
      const offset = Number(url.searchParams.get('offset') || 0);
      const selected = data.slice(offset, offset + 2).map(row => {
        if (mode !== 'missing-description') return row;
        const { description, ...rest } = row; return rest;
      });
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': `${offset}-${offset + selected.length - 1}/${data.length}` }, body: JSON.stringify(selected) });
    });
    const cards = () => page.locator('a[href^="https://www.youtube.com/watch?v="]');
    await page.goto(demo.url);
    await page.getByText('目前為示範資料：', { exact: false }).waitFor();
    assert.equal(await page.locator('article').count(), 16);
    assert.equal(await cards().count(), 0);
    await page.getByRole('button', { name: '選取 Carmen', exact: true }).click();
    await page.getByRole('button', { name: '僅限 (Only)', exact: true }).first().click();
    assert.equal(await page.locator('article').count(), 1);
    await page.getByRole('searchbox').fill('nonexistent-fixture');
    await page.getByText('暫時沒有找到符合條件的影片').waitFor();
    assert.equal(await page.locator('article').count(), 0);
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Carmen & Jiwoo', exact: true }).click();
    await page.getByRole('button', { name: '包含 (Including)', exact: true }).first().click();
    assert.equal(await page.locator('article').count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);

    await page.goto(live.url);
    await page.getByText('已載入資料庫可讀取的影片', { exact: false }).waitFor();
    assert.equal(await cards().count(), 3);
    assert.equal(requests.filter(request => request.mode === 'missing-description').length, 3);
    assert.ok(requests.every(request => !request.select.includes('*')));
    assert.equal(await cards().first().getAttribute('href'), 'https://www.youtube.com/watch?v=aaaaaaaaaa3');
    await page.getByRole('button', { name: '最舊', exact: true }).click();
    assert.equal(await cards().first().getAttribute('href'), 'https://www.youtube.com/watch?v=aaaaaaaaaa1');
    assert.equal(await page.getByRole('button', { name: '熱門', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '選取 Carmen', exact: true }).click();
    await page.getByRole('button', { name: '選取 Jiwoo', exact: true }).click();
    assert.equal(await cards().count(), 1);
    assert.equal(await cards().first().getAttribute('href'), 'https://www.youtube.com/watch?v=aaaaaaaaaa2');
    await page.getByRole('button', { name: '僅限 (Only)', exact: true }).first().click();
    assert.equal(await cards().count(), 1);
    await page.getByRole('button', { name: '清除選擇', exact: true }).click();
    await page.getByRole('button', { name: '音樂錄影帶', exact: false }).click();
    assert.equal(await cards().count(), 1);
    await page.getByRole('button', { name: /^全部/ }).click();

    mode = 'permission';
    await page.getByRole('button', { name: '重新讀取資料', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await cards().count(), 0);
    assert.equal(await page.locator('article').count(), 0);
    assert.equal(await page.getByText('暫時沒有找到符合條件的影片').count(), 0);
    await page.getByRole('button', { name: '檢視示範資料', exact: true }).click();
    assert.equal(await page.locator('article').count(), 16);
    assert.equal(await cards().count(), 0);

    mode = 'empty';
    await page.getByRole('button', { name: '重新讀取資料', exact: true }).click();
    await page.getByText('目前沒有可讀取的影片資料', { exact: false }).waitFor();
    assert.equal(await cards().count(), 0);
    assert.equal(await page.locator('article').count(), 0);

    mode = 'invalid';
    await page.getByRole('button', { name: '重新讀取資料', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await cards().count(), 0);

    mode = 'description-present';
    await page.getByRole('button', { name: '重新讀取資料', exact: true }).click();
    await page.getByText('已載入資料庫可讀取的影片', { exact: false }).waitFor();
    await page.getByRole('searchbox').fill('needlefixturedescription');
    assert.equal(await cards().count(), 1);
    await page.getByRole('searchbox').fill('');
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await cards().count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', pageErrors: errors.length, fixtureRequests: requests.length,
      scenarios: ['demo nonplayable', 'member including/only', 'search/preset', 'missing-column compatibility', 'pagination',
        'playback identities', 'oldest sort', 'popularity disabled without counts', 'error without fallback', 'explicit demo',
        'empty archive', 'invalid identity', 'retry recovery', 'description search', 'mobile/desktop overflow'] }));
  } finally {
    if (browser) await browser.close();
    await Promise.all(servers.map(({ server }) => new Promise(resolve => server.close(resolve))));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
