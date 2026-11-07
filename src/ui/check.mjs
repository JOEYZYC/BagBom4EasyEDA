// Focused UI-only checks. Does not load source/vendor HTML or open a camera.
// Run with the project's Node profile: node src/ui/check.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const screenshots = process.argv.includes('--screenshots');
const artifactDir = fileURLToPath(new URL('../../tests/.generated/ui-redesign/', import.meta.url));
if (screenshots) await mkdir(artifactDir, { recursive: true });
const geometryEvidence = [];
async function capture(name, fullPage = false) {
  if (screenshots) await page.screenshot({ path: `${artifactDir}/${name}.png`, fullPage });
}

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('./index.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'BagBomUI',
  target: 'es2022',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--deny-permission-prompts'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: [] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.abort());

async function setup(kind) {
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="native"><input type="checkbox" checked><span>native sentinel</span></div><div id="root"></div></body></html>');
  await page.addScriptTag({ content: outputFiles[0].text });
  await page.evaluate(kind => {
    window.calls = [];
    window.hardwareCalls = [];
    window.clipboardWrites = [];
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia() { window.hardwareCalls.push('getUserMedia'); throw new Error('Hardware blocked in UI-only checks'); },
      enumerateDevices() { window.hardwareCalls.push('enumerateDevices'); throw new Error('Device enumeration blocked in UI-only checks'); },
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
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

async function renderScan(scanText, extra = {}) {
  await page.evaluate(({ scanText, extra }) => window.view.render({
    phase: 'scanning', cameraActive: true, message: '普通二维码不属于 BOM，原有提示保持不变。',
    designators: [], previousHighlightMayRemain: false, ...extra, scanText,
  }), { scanText, extra });
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

async function expectCamera(label) {
  const toggle = page.getByTestId('camera-toggle');
  assert.equal(await toggle.count(), 1, 'exactly one camera action exists');
  assert.equal(await page.getByTestId('scanner-host').getByRole('button', { name: /^(开启摄像头(?:扫码)?|停止摄像头|取消开启|重新开始扫码)$/, includeHidden: true }).count(), 1, 'no duplicate camera action is hidden in the content');
  assert.equal(await toggle.textContent(), label);
  assert.equal(await toggle.isVisible(), true, 'single camera action remains visible');
  assert.equal(await toggle.isEnabled(), true, 'starting can be explicitly cancelled');
  assert.equal(await toggle.evaluate(node => node.closest('.panel-header') !== null), true, 'camera action stays outside scrolling content');
  assert.ok((await toggle.boundingBox()).height >= 44, 'fixed camera action has a 44px target');
  assert.equal(await page.getByTestId('start-camera').count() + await page.getByTestId('stop-camera').count(), 0, 'no separate start/stop/restart controls remain');
}

async function expectPreviewFirst() {
  const order = await page.getByTestId('scanner-host').evaluate(host => {
    const content = host.shadowRoot.querySelector('.content');
    content.scrollTop = 0;
    const preview = content.querySelector('[data-testid="camera-preview"]');
    const box = preview.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const header = host.shadowRoot.querySelector('.panel-header').getBoundingClientRect();
    return { first: content.firstElementChild === preview, top: box.top, contentTop: contentBox.top, headerBottom: header.bottom };
  });
  assert.equal(order.first, true, 'active preview is the first content child');
  assert.ok(order.top >= order.headerBottom && order.top <= order.contentTop + 13, 'preview is immediately below fixed camera controls with no settings/status/prose above it');
  assert.equal(await page.getByTestId('camera-preview').isVisible(), true);
  assert.equal(await page.getByTestId('previous-highlight-warning').evaluate(node => node.parentElement.classList.contains('content')), true, 'expanded warning follows preview rather than adding prose to the fixed header');
}

try {
  await setup('scanner');
  await expectCamera('开启摄像头');
  assert.equal(await page.getByTestId('scanner-host').locator('form, input').count(), 0, 'native search owns manual entry; scanner has no custom form or input');
  assert.equal(await page.getByTestId('manual-code').count() + await page.getByTestId('manual-submit').count() + await page.getByTestId('manual-form').count(), 0, 'obsolete manual controls are removed, not hidden');
  assert.equal(await page.getByLabel('摄像头', { exact: true }).count(), 1);
  assert.equal(await page.getByTestId('scan-output').isVisible(), false, 'models without optional scanText retain the existing flow');
  assert.equal(await page.getByTestId('scanner-help').getAttribute('open'), null, 'secondary help is initially disclosed on demand');
  assert.equal(await page.getByTestId('scanner-host').locator('.preview').isVisible(), false, 'idle does not waste space on an empty video');
  assert.equal(await page.getByTestId('scanner-host').locator('video').evaluate(node => getComputedStyle(node).objectFit), 'contain', 'compact preview does not crop the decoded camera field of view');
  const nativeBefore = await page.locator('#native').boundingBox();
  await capture('scanner-idle-desktop');
  await checkContrast(page.getByTestId('camera-toggle'), 4.5);
  await checkContrast(page.getByTestId('camera-device'), 3, 'borderTopColor');

  await page.evaluate(() => window.view.render({
    phase: 'idle', message: '选择摄像头', designators: [], previousHighlightMayRemain: false,
    cameraDevices: [{ deviceId: 'rear', label: '' }, { deviceId: 'front', label: '前置摄像头' }],
    selectedCameraId: 'rear',
  }));
  await page.getByTestId('camera-device').selectOption('front');
  assert.equal(await page.evaluate(() => window.calls.length), 0, 'device changes never start media');
  await page.evaluate(() => window.view.render({
    phase: 'idle', message: '常规状态更新', designators: [], previousHighlightMayRemain: false,
    cameraDevices: [{ deviceId: 'rear', label: '后置摄像头' }, { deviceId: 'front', label: '前置摄像头' }], selectedCameraId: 'rear',
  }));
  assert.equal(await page.getByTestId('camera-device').inputValue(), 'front', 'user choice survives a render');
  await page.getByTestId('camera-toggle').click();
  assert.deepEqual((await page.evaluate(() => window.calls)).at(-1), { action: 'start', value: 'front' });
  await expectCamera('开启摄像头');
  await page.evaluate(() => window.view.render({ phase: 'starting', cameraActive: false, message: '等待权限', designators: [], previousHighlightMayRemain: false }));
  await expectCamera('取消开启');
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false', 'permission request is not active media');
  assert.equal(await page.getByTestId('camera-state').textContent(), '正在请求摄像头');
  assert.equal(await page.getByTestId('camera-device').isDisabled(), true);
  assert.equal(await page.getByTestId('camera-preview').isVisible(), false, 'pending permission does not show a live preview');
  await capture('scanner-starting-desktop');
  await page.getByTestId('scanner-toggle').click();
  await expectCamera('取消开启');
  await page.getByTestId('camera-toggle').click();
  assert.equal((await page.evaluate(() => window.calls)).at(-1).action, 'stop', 'cancel pending start routes the existing stop callback');
  await expectCamera('取消开启');
  await page.getByTestId('scanner-toggle').click();
  for (const { phase, active } of [
    { phase: 'idle', active: false }, { phase: 'scanning', active: true },
    { phase: 'selected', active: true }, { phase: 'rejected', active: true },
    { phase: 'selected', active: false }, { phase: 'rejected', active: false },
    { phase: 'stopped', active: false },
  ]) {
    const beforeRender = await page.evaluate(() => window.calls.length);
    await page.evaluate(({ phase, active }) => window.view.render({ phase, cameraActive: active, message: '状态更新不自动开停', designators: [], previousHighlightMayRemain: false }), { phase, active });
    assert.equal(await page.evaluate(() => window.calls.length), beforeRender, 'render never requests or resumes media');
    const label = active ? '停止摄像头' : '开启摄像头';
    await expectCamera(label);
    if (active) await expectPreviewFirst();
    assert.equal(await page.getByTestId('camera-device').isDisabled(), active, 'device changes require confirmed stop');
    const beforeFold = await page.evaluate(() => window.calls.length);
    await page.getByTestId('scanner-toggle').click();
    await expectCamera(label);
    await page.getByTestId('camera-toggle').click();
    assert.equal((await page.evaluate(() => window.calls)).at(-1).action, active ? 'stop' : 'start', `${phase} dispatches the action from actual media state`);
    assert.equal(await page.evaluate(() => window.calls.length), beforeFold + 1, 'folding itself has no media side effects');
    await expectCamera(label);
    await page.getByTestId('scanner-toggle').click();
    assert.equal(await page.evaluate(() => window.calls.length), beforeFold + 1, 'unfold does not restart media');
  }
  await page.evaluate(() => window.view.render({ phase: 'stopped', cameraActive: false, message: '已停止，可切换设备', designators: [], previousHighlightMayRemain: false, cameraDevices: [{ deviceId: 'rear', label: '后置摄像头' }, { deviceId: 'front', label: '前置摄像头' }] }));
  const beforeStoppedDeviceChange = await page.evaluate(() => window.calls.length);
  await page.getByTestId('camera-device').selectOption('rear');
  assert.equal(await page.evaluate(() => window.calls.length), beforeStoppedDeviceChange, 'choosing a device after Stop still never resumes camera');
  await page.getByTestId('camera-toggle').click();
  assert.deepEqual((await page.evaluate(() => window.calls)).at(-1), { action: 'start', value: 'rear' }, 'only explicit Start uses the newly chosen device');
  await page.evaluate(() => window.view.render({ phase: 'scanning', message: '正在扫码', designators: [], previousHighlightMayRemain: false }));
  await expectPreviewFirst();
  await page.getByTestId('scanner-toggle').click();
  assert.equal(await page.getByTestId('scanner-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByTestId('folded-camera-warning').isVisible(), true, 'folded active-camera warning is explicit');
  await capture('scanner-folded-desktop');
  await page.getByTestId('camera-toggle').click();
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'true', 'stop callback is not a confirmed stop');
  await expectCamera('停止摄像头');
  await page.evaluate(() => window.view.render({
    phase: 'selected', message: '<img src=x onerror="throw 1">', cCode: '<script>bad</script>',
    designators: ['R1', '<b>R2</b>'], previousHighlightMayRemain: true, canReselect: true,
  }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'true', 'selection does not hide possible active camera');
  assert.equal(await page.getByTestId('previous-highlight-warning').isVisible(), true, 'stale highlight warning survives collapse');
  assert.equal(await page.getByTestId('scanner-summary').textContent(), '定位结果');
  await page.getByTestId('scanner-toggle').click();
  await expectPreviewFirst();
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
    await expectCamera('停止摄像头');
    await checkContrast(page.getByTestId('camera-toggle'), 4.5);
    if (phase === 'rejected') assert.match(await page.getByTestId('scanner-status').textContent(), /^未完成定位/, 'matched references with a rejected native receipt are not presented as successful positioning');
  }
  await page.evaluate(() => window.view.render({ phase: 'error', cameraActive: false, message: '摄像头已释放', designators: [], previousHighlightMayRemain: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false', 'explicit inactive state overrides remembered scanning');
  assert.equal(await page.getByTestId('camera-state').textContent(), '摄像头未开启');
  await expectCamera('开启摄像头');
  assert.equal(await page.getByTestId('folded-camera-warning').isVisible(), false, 'inactive media does not retain a live-camera warning');
  await page.evaluate(() => window.view.render({ phase: 'starting', cameraActive: false, message: '等待权限', designators: [], previousHighlightMayRemain: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false', 'permission request is not an active camera');
  assert.equal(await page.getByTestId('camera-state').textContent(), '正在请求摄像头');
  await expectCamera('取消开启');
  await page.evaluate(() => window.view.render({ phase: 'stopped', message: '已停止', designators: [], previousHighlightMayRemain: false, canReselect: false }));
  assert.equal(await page.getByTestId('camera-state').getAttribute('data-active'), 'false');
  await expectCamera('开启摄像头');
  assert.equal(await page.getByTestId('reselect').isEnabled(), false);

  const outputStatuses = {
    waiting: '等待扫码输出', 'no-code': '未解码到二维码', confirming: '已解码，等待确认',
    suppressed: '重复内容已抑制', rejected: '已解码，内容未通过校验', matching: '已解码，正在匹配',
    selected: '原生定位结果', error: '扫码输出异常', stopped: '扫码处理已停止',
  };
  await renderScan({ status: 'waiting', frameCount: 0, message: '等待解码', text: '' });
  assert.equal(await page.getByTestId('scan-details').getAttribute('open'), null, 'raw diagnostics are secondary, not the primary result');
  assert.equal(await page.getByTestId('scan-output-status').isVisible(), false);
  const hierarchy = await page.getByTestId('scanner-host').evaluate(host => {
    const content = host.shadowRoot.querySelector('.content');
    return [...content.children].filter(n => n.dataset.testid).map(n => n.dataset.testid);
  });
  assert.deepEqual(hierarchy, ['camera-preview', 'camera-settings', 'previous-highlight-warning', 'scanner-status', 'scanner-result', 'scan-output', 'scanner-help'], 'preview is first; device/result follow; diagnostics/help are last, with no manual form');
  await expectPreviewFirst();
  const callsBeforeDisclosure = await page.evaluate(() => window.calls.length);
  await page.getByTestId('scan-details-toggle').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByTestId('scan-details').getAttribute('open'), '', 'native disclosure opens by keyboard');
  assert.equal(await page.evaluate(() => window.calls.length), callsBeforeDisclosure, 'disclosure never requests media or native selection');
  for (const [status, label] of Object.entries(outputStatuses)) {
    await renderScan({ status, frameCount: 12, lastFrameAt: '12:34:56', message: `核心状态：${status}`, text: '' });
    assert.equal(await page.getByTestId('scan-output-status').textContent(), label);
    assert.equal(await page.getByTestId('scan-output-message').textContent(), `核心状态：${status}`);
    assert.equal(await page.getByTestId('scan-output').getAttribute('data-status'), status);
    assert.equal(await page.getByTestId('scanner-status').locator('p').last().textContent(), '普通二维码不属于 BOM，原有提示保持不变。');
    assert.equal(await page.getByTestId('camera-state').textContent(), '摄像头正在使用', 'scan-output status does not imply the media stopped');
    assert.equal(await page.getByTestId('copy-scan-text').isEnabled(), false, 'empty output cannot be copied');
  }
  const rawText = '<script>window.__rawExecuted=true</script>\r\n</textarea><img src=x onerror="throw 1">\r\n' + Array.from({ length: 80 }, (_, i) => JSON.stringify({ line: i, payload: 'long untrusted JSON '.repeat(12) })).join('\r\n');
  const normalizedText = rawText.replace(/\r\n/g, '\n');
  const outputMessage = '已解码，但身份未通过。\n<script>仅作为文字显示</script>';
  await renderScan({ status: 'rejected', frameCount: 99, lastFrameAt: '<img src=x>', message: outputMessage, text: rawText }, { phase: 'rejected', previousHighlightMayRemain: true });
  assert.equal(await page.getByRole('textbox', { name: '扫码文本（只读）' }).count(), 1);
  assert.equal(await page.getByTestId('scan-text').getAttribute('readonly'), '');
  assert.equal(await page.getByTestId('scan-text').inputValue(), normalizedText, 'hostile text and long JSON remain complete plaintext');
  assert.equal(await page.getByTestId('scan-output-message').textContent(), outputMessage);
  assert.equal(await page.getByTestId('scan-output').locator('script, img').count(), 0);
  assert.equal(await page.evaluate(() => window.__rawExecuted), undefined);
  await checkContrast(page.getByTestId('scan-text'), 4.5);
  await checkContrast(page.getByTestId('scan-text'), 3, 'borderTopColor');
  assert.deepEqual(await page.evaluate(() => window.clipboardWrites), [], 'rendering never copies automatically');
  await page.getByTestId('scan-text').evaluate(node => {
    node.focus();
    node.setSelectionRange(13, 55, 'backward');
    node.scrollTop = 130;
    window.inspectScrollTop = node.scrollTop;
    window.textValueWrites = 0;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(node, 'value', {
      get() { return descriptor.get.call(this); },
      set(value) { window.textValueWrites++; descriptor.set.call(this, value); },
    });
  });
  for (const frameCount of [100, 101, 102]) {
    await renderScan({ status: 'rejected', frameCount, lastFrameAt: '12:35:00', message: outputMessage, text: rawText }, { phase: 'rejected', previousHighlightMayRemain: true });
  }
  assert.equal(await page.getByTestId('scan-frame-info').textContent(), '已处理 102 帧 · 最近帧：12:35:00');
  assert.deepEqual(await page.getByTestId('scan-text').evaluate(node => ({
    start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection,
    scrollStable: node.scrollTop === window.inspectScrollTop, writes: window.textValueWrites,
    focused: node.getRootNode().activeElement === node,
  })), { start: 13, end: 55, direction: 'backward', scrollStable: true, writes: 0, focused: true }, 'identical CRLF text preserves selection, caret, scroll and focus during live frame updates');
  await page.getByTestId('scan-text').press('x');
  assert.equal(await page.getByTestId('scan-text').inputValue(), normalizedText, 'read-only output cannot be edited');
  await page.getByTestId('scan-text-toggle').click();
  assert.equal(await page.getByTestId('scan-text-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByTestId('scan-text').evaluate(node => node.getBoundingClientRect().height), 180);
  await page.getByTestId('scan-text-toggle').click();
  assert.equal(await page.getByTestId('scan-text').evaluate(node => node.getBoundingClientRect().height), 78);

  await page.getByTestId('copy-scan-text').click();
  assert.equal(await page.getByTestId('scan-text').evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length), true, 'missing file-compatible clipboard selects text for manual copy');
  assert.match(await page.getByTestId('scan-copy-feedback').textContent(), /Ctrl\+C/);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText(text) { window.clipboardWrites.push(text); return Promise.reject(new Error('Permission denied')); },
  } }));
  await page.getByTestId('copy-scan-text').click();
  await page.getByTestId('scan-copy-feedback').filter({ hasText: 'Ctrl+C' }).waitFor();
  assert.equal(await page.evaluate(() => window.clipboardWrites.length), 1, 'clipboard attempted only after explicit copy');
  assert.equal(await page.getByTestId('scan-text').evaluate(node => node.selectionEnd === node.value.length), true, 'denied clipboard also falls back to selection');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText(text) { window.clipboardWrites.push(text); return Promise.resolve(); },
  } }));
  await page.getByTestId('copy-scan-text').click();
  await page.getByTestId('scan-copy-feedback').filter({ hasText: '已复制点击时的文本。' }).waitFor();
  assert.equal(await page.evaluate(() => window.clipboardWrites.at(-1)), normalizedText);
  await page.getByTestId('scanner-toggle').click();
  assert.equal(await page.getByTestId('scan-output').isVisible(), false);
  await expectCamera('停止摄像头');
  assert.equal(await page.getByTestId('previous-highlight-warning').isVisible(), true);
  await renderScan({ status: 'suppressed', frameCount: 103, message: '重复解码，不重复定位。', text: rawText }, { phase: 'rejected', previousHighlightMayRemain: true });
  assert.equal(await page.getByTestId('scanner-toggle').getAttribute('aria-expanded'), 'false', 'frame updates do not reopen the folded panel');
  assert.equal(await page.evaluate(() => window.clipboardWrites.length), 2, 'counter and folded updates never copy');
  await page.getByTestId('scanner-toggle').click();
  assert.equal(await page.getByTestId('scan-frame-info').textContent(), '已处理 103 帧');
  assert.equal(await page.getByTestId('scan-details').getAttribute('open'), '', 'user disclosure choice survives fold and render');
  assert.deepEqual(await page.locator('#native').boundingBox(), nativeBefore, 'scanner presentation does not reflow native content');
  await page.getByTestId('scan-details-toggle').click();
  await capture('scanner-rejected-desktop');
  await page.getByTestId('scan-details-toggle').click();

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 700 }, { width: 720, height: 500 }, { width: 375, height: 667 }, { width: 320, height: 480 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.getByTestId('scanner-host').evaluate(host => {
      const panel = host.shadowRoot.querySelector('.panel');
      const content = host.shadowRoot.querySelector('.content');
      const box = panel.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, contentTop: contentBox.top, contentBottom: contentBox.bottom, client: content.clientWidth, scroll: content.scrollWidth, cameraToggleHeight: host.shadowRoot.querySelector('[data-testid="camera-toggle"]').getBoundingClientRect().height };
    });
    assert.ok(geometry.x >= 0 && geometry.right <= viewport.width + 1 && geometry.bottom <= viewport.height + 1, `scanner within ${viewport.width}×${viewport.height}`);
    assert.ok(geometry.y >= 72, 'scanner leaves native top menus and viewer toolbar accessible');
    assert.ok(geometry.scroll <= geometry.client + 1, 'scanner has no horizontal overflow');
    assert.ok(geometry.cameraToggleHeight >= 44, 'always-visible camera action has touch-sized target');
    assert.equal(await page.getByTestId('scan-text').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'long JSON wraps without horizontal overflow in plaintext output');
    await page.getByTestId('scan-details-toggle').evaluate(node => node.blur());
    await page.getByTestId('scan-details-toggle').focus();
    const disclosureBounds = await page.getByTestId('scan-details-toggle').boundingBox();
    assert.ok(disclosureBounds.y >= geometry.contentTop && disclosureBounds.y + disclosureBounds.height <= geometry.contentBottom, `keyboard focus reveals remaining controls below the fixed header at ${viewport.width}×${viewport.height}: ${JSON.stringify(disclosureBounds)}`);
    geometryEvidence.push({ viewport, ...geometry });
  }
  await page.setViewportSize({ width: 320, height: 480 });
  await page.getByTestId('scanner-host').locator('.content').evaluate(node => { node.scrollTop = 0; });
  await capture('scanner-rejected-short');
  await page.getByTestId('copy-scan-text').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByTestId('scan-text').evaluate(node => node.getRootNode().activeElement === node), true, 'raw text is reachable by keyboard from Copy');
  const rawBounds = await page.getByTestId('scan-text').boundingBox();
  const shortContent = await page.getByTestId('scanner-host').locator('.content').boundingBox();
  assert.ok(rawBounds.y >= shortContent.y && rawBounds.y + rawBounds.height <= shortContent.y + shortContent.height, `keyboard access scrolls raw text below the fixed safety header: ${JSON.stringify({ rawBounds, shortContent })}`);
  await capture('scanner-diagnostics-short');
  await page.getByTestId('scan-details-toggle').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await renderScan({ status: 'selected', frameCount: 105, message: '原生选中已确认', text: 'C123456' }, { phase: 'selected', message: '原生选中已确认，请核对位号。', cCode: 'C123456', designators: ['R1', 'R2', 'R4'], canReselect: true });
  await expectPreviewFirst();
  await capture('scanner-selected-desktop');
  assert.equal(await page.getByTestId('scan-details').getAttribute('open'), null, 'new results never force diagnostics open');
  await renderScan({ status: 'no-code', frameCount: 106, message: '未解码到二维码', text: 'C123456' }, { message: '请将二维码放入摄像头画面。' });
  await expectPreviewFirst();
  await capture('scanner-scanning-desktop');
  await page.setViewportSize({ width: 375, height: 667 });
  await capture('scanner-scanning-narrow');
  await page.getByTestId('scanner-toggle').click();
  await capture('scanner-folded-narrow');
  await page.getByTestId('scanner-toggle').click();
  await page.getByTestId('scan-details-toggle').click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText(text) { window.clipboardWrites.push(text); return new Promise(resolve => { window.resolveCopy = resolve; }); },
  } }));
  await page.getByTestId('copy-scan-text').click();
  assert.equal(await page.getByTestId('copy-scan-text').isEnabled(), false);
  await page.getByTestId('scanner-toggle').click();
  await page.evaluate(async () => {
    window.retainedButton = document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="camera-toggle"]');
    window.retainedCopyButton = document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="copy-scan-text"]');
    window.retainedCopyFeedback = document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="scan-copy-feedback"]');
    window.beforeDestroyFeedback = window.retainedCopyFeedback.textContent;
    window.beforeDestroyCalls = window.calls.length;
    window.beforeDestroyCopies = window.clipboardWrites.length;
    window.view.destroy();
    window.view.destroy();
    window.retainedButton.click();
    window.retainedCopyButton.click();
    window.resolveCopy();
    await Promise.resolve();
    await Promise.resolve();
    window.view.render({ phase: 'idle', message: 'late render', designators: [], previousHighlightMayRemain: false });
  });
  assert.equal(await page.getByTestId('scanner-host').count(), 0);
  assert.equal(await page.evaluate(() => window.calls.length === window.beforeDestroyCalls), true, 'destroy removes action listeners');
  assert.equal(await page.evaluate(() => window.preview.parentNode), null, 'supplied preview detached');
  assert.equal(await page.evaluate(() => window.preview.getAttribute('data-original')), 'preserved');
  assert.equal(await page.locator('#native input').isChecked(), true, 'native checkbox remains untouched');
  assert.equal(await page.evaluate(() => window.beforeDestroyCopies === window.clipboardWrites.length), true, 'destroy removes copy listeners');
  assert.equal(await page.evaluate(() => window.retainedCopyFeedback.textContent === window.beforeDestroyFeedback), true, 'pending clipboard work does not update destroyed DOM');
  assert.deepEqual(await page.evaluate(() => window.hardwareCalls), [], 'UI never invokes blocked media APIs');
  console.log('PASS scanner: one persistent camera action, start/cancel/stop callbacks by rendered media state, no auto resume, disabled active device changes, no custom manual form, preview first, result warning, labels, responsive bounds, lifecycle');
  console.log('PASS scan text: optional compatibility, all 9 statuses, live counter, literal hostile payload/JSON, read-only selection/CRLF/scroll persistence, explicit copy with unavailable/denied fallback, folded and pending-copy cleanup');

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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture('enhancer-ready-desktop');
  await page.setViewportSize({ width: 375, height: 667 });
  await capture('enhancer-ready-narrow', true);
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
  console.log('PASS redesign: preview-first reading/visual order, keyboard diagnostic disclosure, retained disclosure state, explicit folded-live warning, idle preview, unchanged native geometry, toolbar clearance and remaining-control/raw-text focus reachability');
  if (screenshots) await writeFile(`${artifactDir}/ui-geometry.json`, JSON.stringify(geometryEvidence, null, 2));
  console.log('UNVERIFIED: actual camera permissions/media, vendor HTML/native selection, final generated artifact integration (owned by core/parent).');
} finally {
  await browser.close();
}
