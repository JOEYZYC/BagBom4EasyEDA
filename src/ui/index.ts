import type {
  EnhancerActions,
  EnhancerViewModel,
  ScannerActions,
  ScannerViewModel,
  ScanTextOutput,
  ViewHandle,
} from '../contracts.ts';

// Everything below is presentation only. In particular, this module never reads
// source files, opens media, controls the native viewer, or owns video tracks.
const baseStyles = `
  :host {
    --ink: #262626; --muted: #595959; --line: #cecece;
    --paper: #f1f1f1; --surface: #fff; --soft: #f5f5f5;
    --accent: #176ac6; --accent-hover: #10549f; --on-accent: #fff;
    --warning: #704000; --warning-bg: #fff8e6;
    --error: #a12622; --error-bg: #fff2f0;
    font-family: Roboto, "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 13px; line-height: 1.5; color: var(--ink);
    text-align: left; color-scheme: light;
  }
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  h1, h2, h3, p { margin: 0; }
  button, input, select { font: inherit; color: inherit; }
  button, select { touch-action: manipulation; }
  button {
    min-height: 32px; border: 1px solid var(--line); border-radius: 2px;
    padding: 5px 12px; background: var(--surface); font-weight: 400;
    cursor: pointer; transition: background-color 120ms, border-color 120ms;
  }
  button:hover:not(:disabled) { color: var(--accent); background: #f0f7ff; border-color: var(--accent); }
  button.primary { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  button.primary:hover:not(:disabled) { color: var(--on-accent); background: var(--accent-hover); border-color: var(--accent-hover); }
  button:disabled { cursor: not-allowed; background: #f1f1f1; color: #666; border-color: #cecece; }
  :is(button, input, select, summary):focus-visible { outline: 2px solid #176ac6; outline-offset: 2px; }
  input, select {
    width: 100%; min-width: 0; min-height: 34px; padding: 6px 8px;
    border: 1px solid #808080; border-radius: 2px; background: var(--surface);
  }
  input::placeholder { color: #6b6b6b; opacity: 1; }
  label { display: block; font-weight: 400; margin-bottom: 5px; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; line-height: 1.6; }
  .mono { font-family: "Cascadia Mono", "Consolas", monospace; }
  .break { overflow-wrap: anywhere; }
  .row { display: flex; align-items: center; gap: 8px; }
  .grow { flex: 1; min-width: 0; }
  .notice { padding: 7px 9px; border: 1px solid #d8b771; border-radius: 2px; color: var(--warning); background: var(--warning-bg); }
  .status { border: 1px solid var(--line); border-left: 3px solid var(--accent); background: var(--soft); border-radius: 0; padding: 9px 10px; }
  .status[data-error="true"] { border-color: #e3aaa3; border-left-color: var(--error); background: var(--error-bg); color: var(--error); }
  .status-title { font-weight: 700; }
  summary { cursor: pointer; color: var(--muted); padding: 10px 2px; min-height: 38px; }
  summary:hover { color: var(--accent); }
  details[open] > summary { color: var(--ink); }
  svg { flex: none; display: block; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
`;

function surface(root: HTMLElement, kind: string, css: string) {
  const doc = root.ownerDocument;
  const host = doc.createElement('div');
  host.dataset.testid = `${kind}-host`;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = baseStyles + css;
  shadow.append(style);
  root.append(host);
  const removers: (() => void)[] = [];
  let destroyed = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }

  function on(target: EventTarget, event: string, handler: (event: Event) => void) {
    const guarded = (e: Event) => { if (!destroyed) handler(e); };
    target.addEventListener(event, guarded);
    removers.push(() => target.removeEventListener(event, guarded));
  }

  function button(text: string, testid: string, primary = false) {
    const node = el('button', text, primary ? 'primary' : undefined);
    node.type = 'button';
    node.dataset.testid = testid;
    return node;
  }

  function mark() {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '26');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h3v3H8zm6 0h2v3h-2zm-6 6h3v2H8zm6 0h2v2h-2z');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  return {
    el, button, mark, on, shadow, host,
    get destroyed() { return destroyed; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removers.splice(0)) remove();
      host.remove();
    },
  };
}

const scannerStyles = `
  :host { position: fixed; bottom: max(28px, env(safe-area-inset-bottom)); right: max(32px, env(safe-area-inset-right)); width: min(316px, calc(100vw - 24px)); z-index: 2147483000; }
  .panel { background: var(--surface); border: 1px solid #b8b8b8; border-radius: 2px; box-shadow: 0 3px 14px #00000024; max-height: min(740px, calc(100dvh - 104px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); display: flex; flex-direction: column; overflow: hidden; }
  .panel-header { padding: 0 10px 8px; flex: none; border-bottom: 1px solid var(--line); background: #f1f1f1; }
  .heading { gap: 7px; min-height: 39px; border-bottom: 1px solid #ddd; }
  .heading svg { width: 18px; height: 18px; color: var(--accent); }
  .heading-text { display: flex; gap: 8px; align-items: baseline; }
  h2 { font-size: 13px; font-weight: 600; line-height: 1.4; }
  .fold { padding: 4px 8px; min-width: 44px; min-height: 32px; font-size: 12px; border-color: transparent; background: transparent; }
  .camera-bar { margin-top: 6px; justify-content: space-between; gap: 6px; }
  .camera-state { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .dot { width: 6px; height: 6px; background: #777; border-radius: 50%; flex: none; }
  .camera-state[data-active="true"] { color: #704000; font-weight: 600; }
  .camera-state[data-active="true"] .dot { background: #9a5900; }
  .panel-header .notice { margin-top: 8px; }
  .fold-summary { margin-top: 5px; }
  .fold-live { color: var(--warning); margin-top: 3px; }
  .camera-toggle { min-height: 44px; padding: 5px 8px; font-size: 12px; transition: none; flex: none; }
  .camera-toggle[data-active="true"] { color: #fff; background: #a12622; border-color: #a12622; }
  .camera-toggle[data-active="true"]:hover { color: #fff; background: #81211e; border-color: #81211e; }
  .content { overflow-y: auto; overscroll-behavior: contain; padding: 12px; min-height: 0; scrollbar-width: thin; scroll-padding-block: 8px; }
  .content > * + * { margin-top: 12px; }
  .preview { aspect-ratio: 2.3; overflow: hidden; position: relative; background: #252525; border-radius: 0; border: 1px solid #555; }
  .preview video { display: block; width: 100%; height: 100%; object-fit: contain; }
  .preview-label { position: absolute; left: 6px; bottom: 5px; font-size: 12px; color: #fff; background: #252525e6; padding: 1px 5px; pointer-events: none; }
  .scan-output { border-top: 1px solid var(--line); }
  .scan-output h3 { font-size: 12px; font-weight: 600; }
  .scan-output .row { align-items: center; }
  .scan-output button { min-width: 44px; padding: 5px 8px; font-size: 12px; }
  .scan-output-status { margin-top: 6px; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
  .scan-output[data-status="rejected"] .scan-output-status, .scan-output[data-status="error"] .scan-output-status { color: var(--error); }
  .scan-meta { margin-top: 3px; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
  .scan-message { margin-top: 4px; max-height: 64px; overflow-y: auto; white-space: pre-wrap; }
  .scan-text { display: block; width: 100%; min-width: 0; height: 78px; margin-top: 8px; padding: 8px; border: 1px solid #808080; border-radius: 2px; background: var(--surface); color: var(--ink); font: 12px/1.6 "Cascadia Mono", "Consolas", "Microsoft YaHei", monospace; resize: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .scan-text[data-expanded="true"] { height: 180px; }
  .scan-text:focus-visible { outline: 2px solid #176ac6; outline-offset: 2px; }
  .copy-feedback { margin-top: 5px; }
  .device-row { display: flex; align-items: center; gap: 8px; }
  .camera-fields label { font-size: 12px; margin: 0; flex: none; }
  .camera-fields select { flex: 1; min-height: 30px; padding-block: 3px; font-size: 12px; }
  .camera-hint { margin-top: 5px; }
  .preview[hidden] + .camera-fields { margin-top: 0; }
  .result { padding: 9px 10px; border: 1px solid var(--line); border-top: 0; margin-top: 0; }
  .code { font-size: 19px; font-weight: 600; margin: 2px 0 4px; }
  .designators { display: flex; flex-wrap: wrap; gap: 4px; list-style: none; padding: 0; margin: 6px 0 9px; max-height: 100px; overflow-y: auto; }
  .designators li { padding: 2px 6px; border: 1px solid var(--line); background: var(--soft); border-radius: 0; overflow-wrap: anywhere; max-width: 100%; font-size: 12px; }
  .reselect { width: 100%; }
  .help { border-top: 1px solid var(--line); margin-top: 0; }
  .help p + p { margin-top: 6px; }
  @media (max-height: 540px) { .preview { aspect-ratio: 3; } }
  @media (max-width: 800px) { :host { right: max(12px, env(safe-area-inset-right)); } }
  @media (pointer: coarse), (max-width: 480px) { button, input, select, .camera-fields select, .fold, summary { min-height: 44px; } }
`;

const scannerPhase: Record<ScannerViewModel['phase'], string> = {
  idle: '等待扫码', starting: '正在开启摄像头', scanning: '正在扫码',
  matching: '正在匹配', selected: '定位结果', rejected: '未完成定位', error: '操作未完成', stopped: '已停止扫码',
};

const scanTextStatus: Record<ScanTextOutput['status'], string> = {
  waiting: '等待扫码输出', 'no-code': '未解码到二维码', confirming: '已解码，等待确认',
  suppressed: '重复内容已抑制', rejected: '已解码，内容未通过校验', matching: '已解码，正在匹配',
  selected: '原生定位结果', error: '扫码输出异常', stopped: '扫码处理已停止',
};

export function mountScanner(
  root: HTMLElement,
  actions: ScannerActions,
  preview: HTMLVideoElement,
): ViewHandle<ScannerViewModel> {
  const ui = surface(root, 'scanner', scannerStyles);
  const { el, button, on } = ui;
  const panel = el('section', undefined, 'panel');
  panel.setAttribute('aria-label', 'BOM 扫码定位');
  const header = el('header', undefined, 'panel-header');
  const heading = el('div', undefined, 'row heading');
  const headingText = el('div', undefined, 'grow heading-text');
  headingText.append(el('h2', '扫码定位'), el('span', '本地辅助', 'small muted'));
  const fold = button('收起', 'scanner-toggle');
  fold.className = 'fold';
  fold.setAttribute('aria-expanded', 'true');
  fold.setAttribute('aria-controls', 'scanner-content');
  heading.append(ui.mark(), headingText, fold);
  const cameraBar = el('div', undefined, 'row camera-bar');
  const cameraState = el('div', undefined, 'camera-state');
  cameraState.dataset.testid = 'camera-state';
  cameraState.setAttribute('role', 'status');
  const dot = el('span', undefined, 'dot');
  dot.setAttribute('aria-hidden', 'true');
  const cameraText = el('span', '摄像头尚未请求');
  cameraState.append(dot, cameraText);
  const cameraToggle = button('开启摄像头', 'camera-toggle', true);
  cameraToggle.classList.add('camera-toggle');
  cameraBar.append(cameraState, cameraToggle);
  header.append(heading, cameraBar);

  const content = el('div', undefined, 'content');
  content.id = 'scanner-content';
  const previewSlot = el('div', undefined, 'preview');
  previewSlot.dataset.testid = 'camera-preview';
  previewSlot.setAttribute('aria-label', '摄像头预览');
  previewSlot.append(preview, el('span', '摄像头预览', 'preview-label'));
  const scanOutput = el('section', undefined, 'scan-output');
  scanOutput.dataset.testid = 'scan-output';
  scanOutput.setAttribute('aria-labelledby', 'scanner-scan-title');
  const scanDetails = el('details');
  scanDetails.dataset.testid = 'scan-details';
  const scanSummary = el('summary', '扫码原文与诊断');
  scanSummary.dataset.testid = 'scan-details-toggle';
  scanDetails.append(scanSummary);
  const scanHeading = el('div', undefined, 'row');
  const scanTitle = el('h3', '扫码文本', 'grow');
  scanTitle.id = 'scanner-scan-title';
  const expandText = button('展开', 'scan-text-toggle');
  expandText.setAttribute('aria-label', '展开扫码文本区域');
  expandText.setAttribute('aria-controls', 'scanner-scan-text');
  expandText.setAttribute('aria-expanded', 'false');
  const copyText = button('复制', 'copy-scan-text');
  copyText.setAttribute('aria-label', '复制扫码文本');
  scanHeading.append(scanTitle, expandText, copyText);
  const scanState = el('div');
  scanState.setAttribute('role', 'status');
  scanState.setAttribute('aria-live', 'polite');
  scanState.setAttribute('aria-atomic', 'true');
  const scanStateTitle = el('p', undefined, 'scan-output-status');
  scanStateTitle.dataset.testid = 'scan-output-status';
  const scanMessage = el('p', undefined, 'small break scan-message');
  scanMessage.id = 'scanner-scan-message';
  scanMessage.dataset.testid = 'scan-output-message';
  scanState.append(scanStateTitle, scanMessage);
  // Frame counts are deliberately outside the live region to avoid an
  // announcement on every processed frame while a user inspects the text.
  const scanMeta = el('p', undefined, 'scan-meta');
  scanMeta.dataset.testid = 'scan-frame-info';
  const scanText = el('textarea', undefined, 'scan-text');
  scanText.id = 'scanner-scan-text';
  scanText.dataset.testid = 'scan-text';
  scanText.readOnly = true;
  scanText.rows = 3;
  scanText.spellcheck = false;
  scanText.setAttribute('aria-label', '扫码文本（只读）');
  scanText.setAttribute('aria-describedby', 'scanner-scan-message scanner-scan-hint');
  scanText.placeholder = '尚无解码文本';
  const scanHint = el('p', '可选择文字复制；仅保留本次会话的文本。', 'small muted');
  scanHint.id = 'scanner-scan-hint';
  const copyFeedback = el('p', undefined, 'small muted break copy-feedback');
  copyFeedback.dataset.testid = 'scan-copy-feedback';
  copyFeedback.setAttribute('role', 'status');
  scanDetails.append(scanHeading, scanState, scanMeta, scanText, scanHint, copyFeedback);
  scanOutput.append(scanDetails);
  const cameraFields = el('div', undefined, 'camera-fields');
  cameraFields.dataset.testid = 'camera-settings';
  const deviceLabel = el('label', '摄像头');
  deviceLabel.htmlFor = 'scanner-device';
  const device = el('select');
  device.id = 'scanner-device';
  device.dataset.testid = 'camera-device';
  const deviceRow = el('div', undefined, 'device-row');
  deviceRow.append(deviceLabel, device);
  const cameraHint = el('p', undefined, 'small muted camera-hint');
  cameraFields.append(deviceRow, cameraHint);

  const status = el('div', undefined, 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.dataset.testid = 'scanner-status';
  const statusTitle = el('p', undefined, 'status-title');
  const message = el('p', undefined, 'small break');
  status.append(statusTitle, message);
  const warning = el('p', '上一次的高亮可能仍保留，请勿将它当作本次定位结果。', 'notice small');
  warning.dataset.testid = 'previous-highlight-warning';
  warning.setAttribute('role', 'note');
  const foldSummary = el('p', undefined, 'small muted fold-summary');
  foldSummary.hidden = true;
  foldSummary.dataset.testid = 'scanner-summary';
  const foldLive = el('p', '收起不会停止摄像头；请点击“停止摄像头”结束。', 'small fold-live');
  foldLive.dataset.testid = 'folded-camera-warning';
  foldLive.hidden = true;
  header.append(foldSummary, foldLive);
  const result = el('div', undefined, 'result');
  result.dataset.testid = 'scanner-result';
  const resultLabel = el('p', '本次匹配编号', 'small muted');
  const code = el('p', undefined, 'code mono break');
  code.dataset.testid = 'selected-code';
  const count = el('p', undefined, 'small muted');
  const designators = el('ul', undefined, 'designators mono');
  designators.setAttribute('aria-label', '匹配位号');
  designators.dataset.testid = 'designators';
  const reselect = button('重新定位本次结果', 'reselect');
  reselect.className = 'reselect';
  result.append(resultLabel, code, count, designators, reselect);
  const help = el('details', undefined, 'help');
  help.dataset.testid = 'scanner-help';
  help.append(
    el('summary', '使用说明与隐私'),
    el('p', '仅点击开启后申请摄像头权限。收起面板不会停止摄像头；操作原生 BOM 或视图会暂停扫码，需点击开启才会恢复。', 'small muted'),
    el('p', '无需扫码时，可直接使用原生搜索和 BOM 表格手动选择。', 'small muted'),
    el('p', '仅在本地处理扫码内容，不保存图像。不自动标记焊接，原有勾选仍由你手动管理。请核对位号后焊接。', 'small muted'),
  );
  content.append(previewSlot, cameraFields, warning, status, result, scanOutput, help);
  panel.append(header, content);
  ui.shadow.append(panel);

  let model: ScannerViewModel;
  let collapsed = false;
  let cameraMayBeActive = false;
  let localDeviceId = '';
  let deviceSignature = '';
  let userChangedDevice = false;
  let displayedScanText: string | undefined;
  let copyPending = false;
  let textExpanded = false;
  // Chromium does not consistently reveal a previously selected, read-only
  // textarea on keyboard focus inside a short shadow panel. Scroll only our
  // content region, never the original viewer or the payload's own scroll.
  on(content, 'focusin', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const box = target.getBoundingClientRect();
    const viewport = content.getBoundingClientRect();
    if (box.top < viewport.top + 6) content.scrollTop -= viewport.top + 6 - box.top;
    else if (box.bottom > viewport.bottom - 6) content.scrollTop += box.bottom - viewport.bottom + 6;
  });
  on(fold, 'click', () => {
    collapsed = !collapsed;
    content.hidden = collapsed;
    foldSummary.hidden = !collapsed;
    fold.textContent = collapsed ? '展开' : '收起';
    fold.setAttribute('aria-expanded', String(!collapsed));
    foldLive.hidden = !collapsed || !cameraMayBeActive;
    // Only folded safety information belongs above the preview. Keep the
    // existing warning visible in either layout without duplicating it.
    if (collapsed) header.append(warning);
    else content.insertBefore(warning, status);
  });
  on(device, 'change', () => {
    localDeviceId = device.value;
    userChangedDevice = true;
  });
  on(cameraToggle, 'click', () => {
    if (model.phase === 'starting' || cameraMayBeActive) actions.stopCamera();
    else actions.startCamera(device.value || undefined);
  });
  on(reselect, 'click', () => { if (model.canReselect) actions.reselect(); });
  on(expandText, 'click', () => {
    textExpanded = !textExpanded;
    scanText.dataset.expanded = String(textExpanded);
    expandText.textContent = textExpanded ? '缩小' : '展开';
    expandText.setAttribute('aria-label', textExpanded ? '缩小扫码文本区域' : '展开扫码文本区域');
    expandText.setAttribute('aria-expanded', String(textExpanded));
  });
  on(copyText, 'click', async () => {
    if (!model.scanText || !scanText.value || copyPending) return;
    const text = scanText.value;
    copyPending = true;
    copyText.disabled = true;
    try {
      const clipboard = root.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      if (!ui.destroyed) copyFeedback.textContent = '已复制点击时的文本。';
    } catch {
      if (!ui.destroyed) {
        scanText.focus();
        scanText.select();
        copyFeedback.textContent = '已选中文本，请按 Ctrl+C / ⌘C，或长按复制。';
      }
    } finally {
      copyPending = false;
      if (!ui.destroyed) copyText.disabled = !model.scanText?.text;
    }
  });

  function render(next: ScannerViewModel) {
    if (ui.destroyed) return;
    model = next;
    // The media lifecycle is independent from matching/selection. Trust core's
    // actual state; retain a conservative fallback for older optional models.
    const active = 'cameraActive' in next && typeof next.cameraActive === 'boolean'
      ? next.cameraActive : undefined;
    if (typeof active === 'boolean') cameraMayBeActive = active;
    else {
      if (next.phase === 'scanning') cameraMayBeActive = true;
      if (next.phase === 'starting' || next.phase === 'stopped' || next.phase === 'idle') cameraMayBeActive = false;
    }
    cameraState.dataset.active = String(cameraMayBeActive);
    cameraToggle.dataset.active = String(cameraMayBeActive);
    cameraToggle.classList.toggle('primary', !cameraMayBeActive && next.phase !== 'starting');
    foldLive.hidden = !collapsed || !cameraMayBeActive;
    previewSlot.hidden = !cameraMayBeActive;
    let cameraLabel = active === true ? '摄像头正在使用'
      : next.phase === 'starting' ? '正在请求摄像头'
      : active === false ? (next.phase === 'stopped' ? '摄像头已停止' : '摄像头未开启')
      : cameraMayBeActive ? '摄像头可能仍开启'
      : next.phase === 'idle' ? '摄像头尚未请求'
      : next.phase === 'stopped' ? '摄像头已停止'
      : '摄像头状态请查看浏览器';
    if (active === undefined && next.phase === 'scanning') cameraLabel = '摄像头正在使用';
    if (cameraText.textContent !== cameraLabel) cameraText.textContent = cameraLabel;
    cameraToggle.textContent = next.phase === 'starting' ? '取消开启' : cameraMayBeActive ? '停止摄像头' : '开启摄像头';
    device.disabled = cameraMayBeActive || next.phase === 'starting';
    cameraHint.textContent = next.phase === 'starting' ? '取消开启后可重新选择设备。'
      : cameraMayBeActive ? '停止后可选择设备，再点击开启。' : '选择设备后，点击开启摄像头。';
    if (statusTitle.textContent !== scannerPhase[next.phase]) statusTitle.textContent = scannerPhase[next.phase];
    foldSummary.textContent = scannerPhase[next.phase];
    if (message.textContent !== next.message) message.textContent = next.message;
    status.dataset.error = String(next.phase === 'error' || next.phase === 'rejected');
    warning.hidden = !next.previousHighlightMayRemain;
    result.hidden = !next.cCode && !next.designators.length;
    code.textContent = next.cCode || '—';
    count.textContent = next.designators.length ? `匹配位号 · ${next.designators.length} 个` : '暂无匹配位号';
    designators.replaceChildren(...next.designators.map(value => el('li', value)));
    reselect.disabled = !next.canReselect;

    const output = next.scanText;
    scanOutput.hidden = !output;
    if (output) {
      scanOutput.dataset.status = output.status;
      const title = scanTextStatus[output.status];
      if (scanStateTitle.textContent !== title) scanStateTitle.textContent = title;
      if (scanMessage.textContent !== output.message) scanMessage.textContent = output.message;
      scanMeta.textContent = `已处理 ${output.frameCount} 帧${output.lastFrameAt ? ` · 最近帧：${output.lastFrameAt}` : ''}`;
    }
    const text = output?.text;
    // Compare the source string, not textarea.value (which normalizes CRLF).
    // Never replace identical text: live counters must not reset selection,
    // caret, scroll, or keyboard focus while the user is inspecting a payload.
    if (text !== displayedScanText) {
      scanText.value = text || '';
      displayedScanText = text;
      copyFeedback.textContent = '';
    }
    copyText.disabled = copyPending || !text;

    const devices = next.cameraDevices || [];
    const signature = JSON.stringify(devices);
    const focusedSelection = userChangedDevice ? localDeviceId : (next.selectedCameraId || localDeviceId);
    if (signature !== deviceSignature || (next.selectedCameraId && !userChangedDevice && device.value !== next.selectedCameraId)) {
      const fallback = el('option', '默认摄像头');
      fallback.value = '';
      const options = devices.map((item, index) => {
        const option = el('option', item.label || `摄像头 ${index + 1}（未授权名称）`);
        option.value = item.deviceId;
        return option;
      });
      if (focusedSelection && !devices.some(item => item.deviceId === focusedSelection)) {
        const selectedUnknown = el('option', '已选择的摄像头');
        selectedUnknown.value = focusedSelection;
        options.push(selectedUnknown);
      }
      device.replaceChildren(fallback, ...options);
      deviceSignature = signature;
    }
    device.value = focusedSelection;
    localDeviceId = device.value;
  }

  render({ phase: 'idle', message: '点击开启摄像头扫码；也可使用原生搜索和 BOM 表格手动选择。', designators: [], previousHighlightMayRemain: false });
  return {
    render,
    destroy() {
      if (ui.destroyed) return;
      // Do not pause, clear srcObject, or stop tracks: core owns media cleanup.
      if (preview.parentNode === previewSlot) preview.remove();
      ui.destroy();
    },
  };
}

const enhancerStyles = `
  :host { display: block; min-height: 100dvh; background: var(--paper); }
  .page { min-height: 100dvh; padding: 0 24px 24px; }
  .shell { margin: 0 auto; }
  .topbar { display: flex; justify-content: space-between; align-items: center; min-height: 36px; margin-inline: -24px; padding: 6px 18px; background: var(--accent); color: #fff; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .brand-mark svg { width: 20px; height: 20px; }
  .local { font-size: 12px; white-space: nowrap; }
  .intro { margin: 30px auto 20px; max-width: 880px; }
  .eyebrow { color: var(--muted); font-size: 12px; margin-bottom: 5px; }
  h1 { font-size: 23px; font-weight: 500; line-height: 1.4; text-wrap: balance; }
  .intro > p:last-child { margin-top: 8px; color: var(--muted); }
  .workspace { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(240px, 1fr); max-width: 880px; margin: 0 auto; border: 1px solid var(--line); background: var(--surface); }
  .main { padding: 22px; min-width: 0; }
  .section-title { font-size: 14px; line-height: 1.5; font-weight: 600; }
  .step-index { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--line); background: var(--soft); font-size: 12px; margin-right: 8px; color: var(--muted); }
  .file-area { border: 1px solid var(--line); background: #fafafa; padding: 18px; margin-top: 16px; }
  .file-symbol { display: none; }
  .file-area button { min-height: 40px; }
  .file-area .hint { margin-top: 8px; }
  .source-file { font-size: 12px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
  .processing { margin-top: 18px; }
  .progress { list-style: none; padding: 0; margin: 0 0 12px; display: flex; gap: 0; }
  .progress li { flex: 1; min-width: 0; border-bottom: 2px solid #ddd; padding: 0 4px 7px; color: var(--muted); font-size: 12px; }
  .progress li[data-current="true"] { color: var(--accent); border-color: var(--accent); font-weight: 600; }
  .progress li[data-done="true"] { border-color: #7ca8dc; }
  .download { margin-top: 12px; padding: 12px; border: 1px solid #9bbce1; background: #f3f8ff; }
  .download button { width: 100%; min-height: 40px; margin-bottom: 6px; }
  .aside { background: #fafafa; padding: 22px; border-left: 1px solid var(--line); min-width: 0; }
  .aside h2 { font-size: 13px; font-weight: 600; }
  .steps { padding-left: 19px; margin: 16px 0; }
  .steps li { padding-left: 3px; margin-bottom: 16px; }
  .steps li::marker { color: var(--muted); font-size: 12px; }
  .steps strong { font-size: 13px; font-weight: 500; }
  .steps p { font-size: 12px; margin-top: 4px; color: var(--muted); line-height: 1.65; }
  .aside-note { padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
  .footer { max-width: 880px; margin: 14px auto 0; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-size: 12px; color: var(--muted); }
  @media (max-width: 720px) { .workspace { grid-template-columns: 1fr; } .aside { border-left: 0; border-top: 1px solid var(--line); } .intro { margin-top: 22px; } }
  @media (max-width: 420px) { .page { padding: 0 12px 18px; } .topbar { margin-inline: -12px; padding-inline: 12px; } .brand { gap: 6px; } .main, .aside { padding: 16px; } .file-area { padding: 14px; } h1 { font-size: 21px; } }
  @media (pointer: coarse), (max-width: 480px) { button, .file-area button, .download button { min-height: 44px; } }
`;

const enhancerPhase: Record<EnhancerViewModel['phase'], string> = {
  idle: '等待选择文件', reading: '正在读取文件', enhancing: '正在生成扫码版', ready: '扫码版已生成', error: '未能生成扫码版',
};

export function mountEnhancer(root: HTMLElement, actions: EnhancerActions): ViewHandle<EnhancerViewModel> {
  const ui = surface(root, 'enhancer', enhancerStyles);
  const { el, button, on } = ui;
  const page = el('main', undefined, 'page');
  const shell = el('div', undefined, 'shell');
  const topbar = el('header', undefined, 'topbar');
  const brand = el('div', undefined, 'brand');
  const mark = el('span', undefined, 'brand-mark');
  mark.append(ui.mark());
  brand.append(mark, el('span', 'BOM 本地工具'));
  topbar.append(brand, el('span', '全程本地处理', 'local'));
  const intro = el('div', undefined, 'intro');
  intro.append(
    el('p', 'LCEDA / HTML', 'eyebrow'),
    el('h1', '原生BOM扫码增强'),
    el('p', '添加扫码定位面板，保留原有 BOM、3D / 2D 视图和手动焊接勾选。'),
  );
  const workspace = el('div', undefined, 'workspace');
  const main = el('section', undefined, 'main');
  main.setAttribute('aria-labelledby', 'enhancer-file-heading');
  const sectionTitle = el('h2', undefined, 'section-title');
  sectionTitle.id = 'enhancer-file-heading';
  sectionTitle.append(el('span', '01', 'step-index'), el('span', '选择原生 BOM 文件'));
  const fileArea = el('div', undefined, 'file-area');
  const symbol = el('span', '.HTML', 'file-symbol');
  symbol.setAttribute('aria-hidden', 'true');
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.html,.htm,text/html';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', '选择 LCEDA 导出的 HTML 文件');
  fileInput.dataset.testid = 'source-file-input';
  const choose = button('选择 HTML 文件', 'choose-file', true);
  const hint = el('p', '选择可信的 LCEDA 导出文件（.html / .htm）。生成的文件保留原查看器脚本。', 'hint small muted');
  const source = el('p', '尚未选择文件', 'source-file break');
  source.dataset.testid = 'source-filename';
  fileArea.append(symbol, choose, fileInput, hint, source);

  const processing = el('div', undefined, 'processing');
  const progress = el('ol', undefined, 'progress');
  progress.setAttribute('aria-label', '处理步骤');
  const stages = ['读取文件', '添加扫码面板', '下载文件'].map(text => el('li', text));
  progress.append(...stages);
  const status = el('div', undefined, 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.dataset.testid = 'enhancer-status';
  const statusTitle = el('p', undefined, 'status-title');
  const message = el('p', undefined, 'small break');
  status.append(statusTitle, message);
  processing.append(progress, status);
  const downloadArea = el('div', undefined, 'download');
  downloadArea.dataset.testid = 'download-area';
  const download = button('下载扫码版 HTML', 'download-file', true);
  const destination = el('p', undefined, 'small muted break');
  destination.dataset.testid = 'download-filename';
  downloadArea.append(download, destination);
  main.append(sectionTitle, fileArea, processing, downloadArea);

  const aside = el('aside', undefined, 'aside');
  aside.append(el('h2', '生成后怎么用'));
  const steps = el('ol', undefined, 'steps');
  const instructions = [
    ['打开下载的文件', '用浏览器打开“*_扫码版.html”，原生查看器仍可照常使用。'],
    ['手动开启扫码', '在右下角面板开启摄像头；也可使用原生搜索和 BOM 表格。'],
    ['核对位号后焊接', '按定位结果核对器件；焊接状态仍由你手动勾选。'],
  ];
  for (const [title, detail] of instructions) {
    const step = el('li');
    step.append(el('strong', title), el('p', detail));
    steps.append(step);
  }
  aside.append(steps, el('p', '摄像头不会自动开启。若浏览器限制本地文件的摄像头权限，仍可使用原生搜索和 BOM 表格。', 'aside-note'));
  workspace.append(main, aside);
  const footer = el('footer', undefined, 'footer');
  footer.append(el('p', '原文件不改 · 另存为扫码版 · 无需安装 Node.js'), el('p', '仅供个人本地使用'));
  shell.append(topbar, intro, workspace, footer);
  page.append(shell);
  ui.shadow.append(page);

  let current: EnhancerViewModel;
  on(choose, 'click', () => { if (!choose.disabled) fileInput.click(); });
  on(fileInput, 'change', () => {
    if (choose.disabled) return;
    const file = fileInput.files?.[0];
    // Reset before invoking core so selecting the same file again still works.
    fileInput.value = '';
    if (file) actions.chooseFile(file);
  });
  on(download, 'click', () => { if (current.phase === 'ready') actions.download(); });

  function render(model: EnhancerViewModel) {
    if (ui.destroyed) return;
    current = model;
    const busy = model.phase === 'reading' || model.phase === 'enhancing';
    choose.disabled = busy;
    fileInput.disabled = busy;
    choose.textContent = busy ? '正在处理…' : model.sourceFilename ? '重新选择 HTML 文件' : '选择 HTML 文件';
    source.textContent = model.sourceFilename || '尚未选择文件';
    statusTitle.textContent = enhancerPhase[model.phase];
    message.textContent = model.message;
    status.dataset.error = String(model.phase === 'error');
    processing.setAttribute('aria-busy', String(busy));
    downloadArea.hidden = model.phase !== 'ready';
    download.disabled = model.phase !== 'ready';
    destination.textContent = model.suggestedFilename || '以新文件保存，不覆盖原文件。';
    const stage = model.phase === 'reading' ? 0 : model.phase === 'enhancing' ? 1 : model.phase === 'ready' ? 2 : -1;
    stages.forEach((item, index) => {
      item.dataset.current = String(index === stage);
      item.dataset.done = String(index < stage);
      if (index === stage) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }

  render({ phase: 'idle', message: '文件仅在当前浏览器中处理，不上传至服务器。' });
  return { render, destroy: () => ui.destroy() };
}
