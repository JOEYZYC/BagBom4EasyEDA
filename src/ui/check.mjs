// Focused UI-only checks. Does not load source/vendor HTML or open a camera.
// Run with the project's Node profile: node src/ui/check.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('./index.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'BagBomUI',
  target: 'es2022',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.abort());

async function setup(kind) {
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="native"><input type="checkbox" checked><span>native sentinel</span></div><div id="root"></div></body></html>');
  await page.addScriptTag({ content: outputFiles[0].text });
  await page.evaluate(kind => {
    window.calls = [];
    const root = document.querySelector('#root');
    const record = (action, value) => window.calls.push({ action, value });
    if (kind === 'scanner') {
      window.preview = document.createElement('video');
      window.preview.setAttribute('data-original', 'preserved');
      window.preview.pause = () => { throw new Error('UI must not pause media'); };
      window.preview.play = () => { throw new Error('UI must not start media'); };
      window.view = window.BagBomUI.mountScanner(root, {
        startCamera: value => record('start', value),
        stopCamera: () => record('stop'),
        submitManualCCode: value => record('manual', value),
        reselect: () => record('reselect'),
      }, window.preview);
    } else {
      window.view = window.BagBomUI.mountEnhancer(root, {
        chooseFile: file => record('choose', { name: file.name, size: file.size }),
        download: () => record('download'),
      });
    }
  }, kind);
  assert.deepEqual(await page.evaluate(() => window.calls), [], 'mount has no action side effects');
}

function contrast(a, b) {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      const s = value / 255;
      return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

async function checkContrast(locator, minimum, property = 'color') {
  const colors = await locator.evaluate((node, property) => {
    const style = getComputedStyle(node);
    return [style[property], style.backgroundColor];
  }, property);
  assert.ok(contrast(...colors) >= minimum, `contrast ${colors.join(' / ')} must meet ${minimum}:1`);
}

try {
  await setup('scanner');
  assert.equal(await page.getByRole('button', { name: '停止摄像头', exact: true }).count(), 1);
  assert.equal(await page.getByLabel('或输入完整 C 编号').count(), 1);
  assert.equal(await page.getByLabel('摄像头', { exact: true }).count(), 1);
  await checkContrast(page.getByTestId('start-camera'), 4.5);
  await checkContrast(page.getByTestId('manual-code'), 3, 'borderTopColor');
  await page.getByTestId('manual-code').fill('C123456');
  await page.getByTestId('manual-code').press('Enter');
  assert.deepEqual(await page.evaluate(() => window.calls), [{ action: 'manual', value: 'C123456' }]);
  await page.getByTestId('manual-code').fill('   ');
  await page.getByTestId('manual-code').press('Enter');
  assert.equal(await page.evaluate(() => window.calls.length), 1, 'empty code ignored');

  await page.evaluate(() => window.view.render({
    phase: 'idle', message: '选择摄像头', designators: [], previousHighlightMayRemain: false,
    cameraDevices: [{ deviceId: 'rear', label: '' }, { deviceId: 'front', label: '前置摄像头' }],
    selectedCameraId: 'rear',
  }));
  await page.getByTestId('camera-device').selectOption('front');
  assert.equal(await page.evaluate(() => window.calls.length), 1, 'device changes never start media');
  await page.evaluate(() => window.view.render({
    phase: 'idle', message: '常规状态更新', designators: [], previousHighlightMayRemain: false,
    cameraDevices: [{ deviceId: 'rear', label: '后置摄像头' }, { deviceId: 'front', label: '前置摄像头' }], selectedCameraId: 'rear',
  }));
  assert.equal(await page.getByTestId('camera-device').inputValue(), 'front', 'user choice survives a render');
  await page.getByTestId('start-camera').click();
  assert.deepEqual((await page.evaluate(() => window.calls)).at(-1), { action: 'start', value: 'front' });
  await page.evaluate(() => window.view.render({ phase: 'scanning', message: '正在扫码', designators: [], previousHighlightMayRemain: false }));
  await page.getByTestId('scanner-toggle').click();
  assert.equal(await page.getByTestId('scanner-toggle').getAttribute('aria-expanded'), 'false');
  await page.getByTestId('stop-camera').click();
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'true', 'stop callback is not a confirmed stop');
  assert.equal(await page.getByTestId('stop-camera').isVisible(), true);
  await page.evaluate(() => window.view.render({
    phase: 'selected', message: '<img src=x onerror="throw 1">', cCode: '<script>bad</script>',
    designators: ['R1', '<b>R2</b>'], previousHighlightMayRemain: true, canReselect: true,
  }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'true', 'selection does not hide possible active camera');
  assert.equal(await page.getByTestId('previous-highlight-warning').isVisible(), true, 'stale highlight warning survives collapse');
  assert.equal(await page.getByTestId('scanner-summary').textContent(), '定位结果');
  await page.getByTestId('scanner-toggle').click();
  assert.equal(await page.getByTestId('selected-code').textContent(), '<script>bad</script>');
  assert.equal(await page.getByTestId('designators').locator('b').count(), 0);
  assert.equal(await page.getByTestId('scanner-status').locator('img').count(), 0);
  assert.equal(await page.getByTestId('previous-highlight-warning').isVisible(), true);
  await checkContrast(page.getByTestId('previous-highlight-warning'), 4.5);
  await page.getByTestId('reselect').click();
  assert.equal((await page.evaluate(() => window.calls)).at(-1).action, 'reselect');
  for (const phase of ['selected', 'rejected']) {
    await page.evaluate(phase => window.view.render({ phase, cameraActive: true, message: '结果不改变摄像头生命周期', cCode: 'C123', designators: ['R1'], previousHighlightMayRemain: false }), phase);
    assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'true');
    assert.equal(await page.getByTestId('camera-state').textContent(), '摄像头正在使用');
    assert.equal(await page.getByTestId('stop-camera').isEnabled(), true);
  }
  await page.evaluate(() => window.view.render({ phase: 'error', cameraActive: false, message: '摄像头已释放', designators: [], previousHighlightMayRemain: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false', 'explicit inactive state overrides remembered scanning');
  assert.equal(await page.getByTestId('camera-state').textContent(), '摄像头未开启');
  await page.evaluate(() => window.view.render({ phase: 'starting', cameraActive: false, message: '等待权限', designators: [], previousHighlightMayRemain: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false', 'permission request is not an active camera');
  assert.equal(await page.getByTestId('camera-state').textContent(), '正在请求摄像头');
  await page.evaluate(() => window.view.render({ phase: 'stopped', message: '已停止', designators: [], previousHighlightMayRemain: false, canReselect: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false');
  assert.equal(await page.getByTestId('reselect').isEnabled(), false);

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 700 }, { width: 375, height: 667 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.getByTestId('scanner-host').evaluate(host => {
      const panel = host.shadowRoot.querySelector('.panel');
      const content = host.shadowRoot.querySelector('.content');
      const box = panel.getBoundingClientRect();
      return { x: box.x, right: box.right, bottom: box.bottom, width: box.width, client: content.clientWidth, scroll: content.scrollWidth, stopHeight: host.shadowRoot.querySelector('[data-testid="stop-camera"]').getBoundingClientRect().height };
    });
    assert.ok(geometry.x >= 0 && geometry.right <= viewport.width + 1 && geometry.bottom <= viewport.height + 1, `scanner within ${viewport.width}×${viewport.height}`);
    assert.ok(geometry.scroll <= geometry.client + 1, 'scanner has no horizontal overflow');
    assert.ok(geometry.stopHeight >= 44, 'always-visible stop has touch-sized target');
  }
  if (process.argv.includes('--screenshots')) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: fileURLToPath(new URL('./.check-scanner.png', import.meta.url)) });
  }
  await page.evaluate(() => {
    window.retainedButton = document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="stop-camera"]');
    window.beforeDestroyCalls = window.calls.length;
    window.view.destroy();
    window.view.destroy();
    window.retainedButton.click();
    window.view.render({ phase: 'idle', message: 'late render', designators: [], previousHighlightMayRemain: false });
  });
  assert.equal(await page.getByTestId('scanner-host').count(), 0);
  assert.equal(await page.evaluate(() => window.calls.length === window.beforeDestroyCalls), true, 'destroy removes action listeners');
  assert.equal(await page.evaluate(() => window.preview.parentNode), null, 'supplied preview detached');
  assert.equal(await page.evaluate(() => window.preview.getAttribute('data-original')), 'preserved');
  assert.equal(await page.locator('#native input').isChecked(), true, 'native checkbox remains untouched');
  console.log('PASS scanner: explicit actions, device persistence, literal text, result warning, camera/fold/stop, labels, responsive bounds, lifecycle');

  await setup('enhancer');
  assert.equal(await page.getByRole('heading', { name: '原生BOM扫码增强' }).count(), 1);
  assert.equal(await page.getByTestId('download-area').isVisible(), false);
  await checkContrast(page.getByTestId('choose-file'), 4.5);
  await checkContrast(page.getByTestId('enhancer-status'), 4.5);
  assert.equal(await page.getByTestId('source-file-input').getAttribute('accept'), '.html,.htm,text/html');
  await page.getByTestId('source-file-input').setInputFiles({ name: '原生<test>.html', mimeType: 'text/html', buffer: Buffer.from('<html>inert fixture only</html>') });
  assert.deepEqual(await page.evaluate(() => window.calls), [{ action: 'choose', value: { name: '原生<test>.html', size: 31 } }]);
  await page.evaluate(() => window.view.render({ phase: 'reading', message: '正在读取', sourceFilename: '<img src=x>.html' }));
  assert.equal(await page.getByTestId('choose-file').isEnabled(), false);
  assert.equal(await page.getByTestId('source-filename').textContent(), '<img src=x>.html');
  assert.equal(await page.getByTestId('source-filename').locator('img').count(), 0);
  await page.evaluate(() => window.view.render({ phase: 'enhancing', message: '正在生成', sourceFilename: '原生.html' }));
  assert.equal(await page.getByTestId('download-area').isVisible(), false);
  await page.evaluate(() => window.view.render({ phase: 'ready', message: '已生成', sourceFilename: '原生.html', suggestedFilename: '<b>原生_扫码版</b>.html' }));
  assert.equal(await page.evaluate(() => window.calls.length), 1, 'ready never automatically downloads');
  assert.equal(await page.getByTestId('download-filename').locator('b').count(), 0);
  await page.getByTestId('download-file').click();
  assert.equal((await page.evaluate(() => window.calls)).at(-1).action, 'download');

  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(fits, true, `enhancer no horizontal overflow at ${width}px`);
    assert.equal(await page.getByTestId('choose-file').isVisible(), true);
    assert.equal(await page.getByTestId('download-file').isVisible(), true);
  }
  if (process.argv.includes('--screenshots')) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: fileURLToPath(new URL('./.check-enhancer.png', import.meta.url)) });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: fileURLToPath(new URL('./.check-mobile.png', import.meta.url)), fullPage: true });
  }
  await page.getByTestId('choose-file').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByTestId('choose-file').evaluate(button => button.matches(':focus-visible')), true, 'keyboard focus remains visible');
  await page.evaluate(() => window.view.render({ phase: 'error', message: '<img src=x>未完成', sourceFilename: '原生.html' }));
  assert.equal(await page.getByTestId('download-area').isVisible(), false, 'error removes stale download');
  assert.equal(await page.getByTestId('enhancer-status').getAttribute('data-error'), 'true');
  await checkContrast(page.getByTestId('enhancer-status'), 4.5);
  await page.evaluate(() => {
    window.retainedButton = document.querySelector('[data-testid="enhancer-host"]').shadowRoot.querySelector('[data-testid="download-file"]');
    window.beforeDestroyCalls = window.calls.length;
    window.view.destroy();
    window.view.destroy();
    window.retainedButton.click();
    window.view.render({ phase: 'ready', message: 'late render' });
  });
  assert.equal(await page.getByTestId('enhancer-host').count(), 0);
  assert.equal(await page.evaluate(() => window.calls.length === window.beforeDestroyCalls), true);
  assert.equal(await page.locator('#native input').isChecked(), true);
  assert.deepEqual(errors, [], 'no browser script errors');
  console.log('PASS enhancer: file callback, accepted types, phase gating, literal filenames, explicit download, labels/focus, responsive widths, lifecycle');
  console.log('UNVERIFIED: actual camera permissions/media, vendor HTML/native selection, final generated artifact integration (owned by core/parent).');
} finally {
  await browser.close();
}
