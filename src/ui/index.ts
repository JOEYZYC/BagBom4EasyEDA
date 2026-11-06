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
    --ink: #192f35; --muted: #52666a; --line: #d4dfdc;
    --paper: #f5f6f1; --surface: #fff; --soft: #edf3f0;
    --accent: #146557; --accent-hover: #0b4e43; --on-accent: #fff;
    --warning: #734310; --warning-bg: #fff3dc;
    --error: #a12424; --error-bg: #fff0ee;
    font-family: "Bahnschrift", "Aptos", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 14px; line-height: 1.6; color: var(--ink);
    text-align: left; color-scheme: light;
  }
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  h1, h2, h3, p { margin: 0; }
  button, input, select { font: inherit; color: inherit; }
  button, select { touch-action: manipulation; }
  button {
    min-height: 44px; border: 1px solid var(--line); border-radius: 9px;
    padding: 9px 14px; background: var(--surface); font-weight: 600;
    cursor: pointer; transition: background-color 160ms, border-color 160ms;
  }
  button:hover:not(:disabled) { background: var(--soft); border-color: #8da8a0; }
  button.primary { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  button.primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
  button:disabled { cursor: not-allowed; background: #e9edeb; color: #66716e; border-color: #d6ddda; }
  :is(button, input, select):focus-visible { outline: 3px solid #b15a17; outline-offset: 3px; }
  input, select {
    width: 100%; min-width: 0; min-height: 44px; padding: 9px 11px;
    border: 1px solid #7b8e85; border-radius: 8px; background: var(--surface);
  }
  input::placeholder { color: #6a7876; opacity: 1; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; line-height: 1.65; }
  .mono { font-family: "Cascadia Mono", "Consolas", monospace; }
  .break { overflow-wrap: anywhere; }
  .row { display: flex; align-items: center; gap: 8px; }
  .grow { flex: 1; min-width: 0; }
  .notice { padding: 10px 12px; border: 1px solid #dfb978; border-radius: 8px; color: var(--warning); background: var(--warning-bg); }
  .status { border: 1px solid var(--line); border-left: 3px solid var(--accent); background: var(--soft); border-radius: 8px; padding: 12px; }
  .status[data-error="true"] { border-color: #e3aaa3; border-left-color: var(--error); background: var(--error-bg); color: var(--error); }
  .status-title { font-weight: 700; }
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
  :host { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: min(340px, calc(100vw - 24px)); z-index: 2147483000; }
  .panel { background: var(--surface); border: 1px solid #a5bcb2; border-radius: 14px; box-shadow: 0 12px 40px #18372c26, 0 2px 8px #18372c14; max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); max-height: min(820px, calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); display: flex; flex-direction: column; overflow: hidden; }
  .panel-header { padding: 11px 12px 8px; flex: none; border-bottom: 1px solid var(--line); background: #f3f7f4; }
  .heading { gap: 10px; }
  h2 { font-size: 16px; letter-spacing: .02em; line-height: 1.4; }
  .fold { padding: 8px 10px; min-width: 54px; font-size: 12px; }
  .camera-bar { margin-top: 8px; justify-content: space-between; gap: 8px; }
  .camera-state { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .dot { width: 7px; height: 7px; background: #75847e; border-radius: 50%; flex: none; }
  .camera-state[data-active="true"] { color: #155345; font-weight: 600; }
  .camera-state[data-active="true"] .dot { background: #0d7956; box-shadow: 0 0 0 3px #dceee4; }
  .panel-header .notice { margin-top: 8px; }
  .fold-summary { margin-top: 5px; }
  .stop { min-height: 44px; padding: 6px 10px; color: #8e2525; border-color: #d8b6b0; font-size: 12px; }
  .content { overflow-y: auto; overscroll-behavior: contain; padding: 14px; min-height: 0; }
  .content > * + * { margin-top: 14px; }
  .preview { aspect-ratio: 16 / 9; overflow: hidden; position: relative; background: #182b2e; border-radius: 9px; border: 1px solid #294348; }
  .preview video { display: block; width: 100%; height: 100%; object-fit: cover; }
  .preview-label { position: absolute; left: 9px; bottom: 7px; font-size: 12px; color: #fff; background: #172d30eb; padding: 2px 7px; border-radius: 4px; pointer-events: none; }
  .scan-output { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #f7faf7; }
  .scan-output h3 { font-size: 13px; font-weight: 650; }
  .scan-output .row { align-items: center; }
  .scan-output button { min-width: 44px; padding: 7px 9px; font-size: 12px; }
  .scan-output-status { margin-top: 4px; font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
  .scan-output[data-status="rejected"] .scan-output-status, .scan-output[data-status="error"] .scan-output-status { color: var(--error); }
  .scan-meta { margin-top: 3px; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
  .scan-message { margin-top: 4px; max-height: 64px; overflow-y: auto; white-space: pre-wrap; }
  .scan-text { display: block; width: 100%; min-width: 0; height: 78px; margin-top: 8px; padding: 8px; border: 1px solid #7b8e85; border-radius: 6px; background: var(--surface); color: var(--ink); font: 12px/1.6 "Cascadia Mono", "Consolas", "Microsoft YaHei", monospace; resize: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .scan-text[data-expanded="true"] { height: 180px; }
  .scan-text:focus-visible { outline: 3px solid #b15a17; outline-offset: 3px; }
  .copy-feedback { margin-top: 5px; }
  .camera-fields { margin-top: 10px; }
  .camera-fields label { font-size: 12px; }
  .start { width: 100%; margin-top: 8px; }
  .manual { border-top: 1px solid var(--line); padding-top: 14px; }
  .manual label { font-size: 13px; }
  .manual .row { margin-top: 7px; align-items: stretch; }
  .manual input { width: 0; flex: 1; }
  .manual button { padding-inline: 12px; flex: none; }
  .result { padding-top: 12px; border-top: 1px solid var(--line); }
  .code { font-size: 20px; font-weight: 650; margin: 2px 0 8px; }
  .designators { display: flex; flex-wrap: wrap; gap: 5px; list-style: none; padding: 0; margin: 7px 0 10px; max-height: 110px; overflow-y: auto; }
  .designators li { padding: 3px 7px; border: 1px solid var(--line); background: var(--soft); border-radius: 5px; overflow-wrap: anywhere; max-width: 100%; font-size: 12px; }
  .reselect { width: 100%; }
  .footnote { padding-top: 12px; border-top: 1px solid var(--line); }
  @media (max-height: 540px) { .preview { aspect-ratio: 2.5; } }
  @media (max-width: 380px) { :host { top: 8px; right: 8px; width: calc(100vw - 16px); } .content { padding: 12px; } }
`;

const scannerPhase: Record<ScannerViewModel['phase'], string> = {
  idle: '等待扫码', starting: '正在开启摄像头', scanning: '正在扫码',
  matching: '正在匹配', selected: '定位结果', rejected: '未能匹配', error: '操作未完成', stopped: '已停止扫码',
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
  const headingText = el('div', undefined, 'grow');
  headingText.append(el('h2', '扫码定位'), el('p', '原生 BOM · 本地辅助', 'small muted'));
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
  const stop = button('停止摄像头', 'stop-camera');
  stop.className = 'stop';
  cameraBar.append(cameraState, stop);
  header.append(heading, cameraBar);

  const content = el('div', undefined, 'content');
  content.id = 'scanner-content';
  const cameraSection = el('div');
  const previewSlot = el('div', undefined, 'preview');
  previewSlot.setAttribute('aria-label', '摄像头预览');
  previewSlot.append(preview, el('span', '摄像头预览', 'preview-label'));
  const scanOutput = el('section', undefined, 'scan-output');
  scanOutput.dataset.testid = 'scan-output';
  scanOutput.setAttribute('aria-labelledby', 'scanner-scan-title');
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
  scanOutput.append(scanHeading, scanState, scanMeta, scanText, scanHint, copyFeedback);
  const cameraFields = el('div', undefined, 'camera-fields');
  const deviceLabel = el('label', '摄像头');
  deviceLabel.htmlFor = 'scanner-device';
  const device = el('select');
  device.id = 'scanner-device';
  device.dataset.testid = 'camera-device';
  const start = button('开启摄像头扫码', 'start-camera', true);
  start.classList.add('start');
  const cameraHint = el('p', '仅点击后申请权限；切换设备后需再次点击开启。', 'small muted');
  cameraFields.append(deviceLabel, device, start, cameraHint);
  cameraSection.append(previewSlot, scanOutput, cameraFields);

  const form = el('form', undefined, 'manual');
  form.dataset.testid = 'manual-form';
  const codeLabel = el('label', '或输入完整 C 编号');
  codeLabel.htmlFor = 'scanner-code';
  const inputRow = el('div', undefined, 'row');
  const input = el('input', undefined, 'mono');
  input.id = 'scanner-code';
  input.name = 'cCode';
  input.type = 'text';
  input.placeholder = '例如 C123456';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('aria-describedby', 'scanner-code-hint');
  input.dataset.testid = 'manual-code';
  const submit = button('定位', 'manual-submit', true);
  submit.type = 'submit';
  const codeHint = el('p', '支持扫码枪输入；不会自动勾选已焊接。', 'small muted');
  codeHint.id = 'scanner-code-hint';
  inputRow.append(input, submit);
  form.append(codeLabel, inputRow, codeHint);

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
  header.append(foldSummary, warning);
  const result = el('div', undefined, 'result');
  result.dataset.testid = 'scanner-result';
  const resultLabel = el('p', '本次编号', 'small muted');
  const code = el('p', undefined, 'code mono break');
  code.dataset.testid = 'selected-code';
  const count = el('p', undefined, 'small muted');
  const designators = el('ul', undefined, 'designators mono');
  designators.setAttribute('aria-label', '匹配位号');
  designators.dataset.testid = 'designators';
  const reselect = button('重新定位本次结果', 'reselect');
  reselect.className = 'reselect';
  result.append(resultLabel, code, count, designators, reselect);
  const footnote = el('p', '仅在本地处理扫码内容。不自动标记焊接，原有勾选仍由你手动管理。收起面板不会停止摄像头。', 'small muted footnote');
  content.append(cameraSection, form, status, result, footnote);
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
  on(fold, 'click', () => {
    collapsed = !collapsed;
    content.hidden = collapsed;
    foldSummary.hidden = !collapsed;
    fold.textContent = collapsed ? '展开' : '收起';
    fold.setAttribute('aria-expanded', String(!collapsed));
  });
  on(device, 'change', () => {
    localDeviceId = device.value;
    userChangedDevice = true;
  });
  on(start, 'click', () => actions.startCamera(device.value || undefined));
  on(stop, 'click', () => actions.stopCamera());
  on(form, 'submit', (event) => {
    event.preventDefault();
    if (input.value.trim() && !submit.disabled) actions.submitManualCCode(input.value);
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
      if (next.phase === 'starting' || next.phase === 'scanning') cameraMayBeActive = true;
      if (next.phase === 'stopped' || next.phase === 'idle') cameraMayBeActive = false;
    }
    cameraState.dataset.active = String(cameraMayBeActive);
    let cameraLabel = active === true ? '摄像头正在使用'
      : next.phase === 'starting' ? '正在请求摄像头'
      : active === false ? (next.phase === 'stopped' ? '摄像头已停止' : '摄像头未开启')
      : cameraMayBeActive ? '摄像头可能仍开启'
      : next.phase === 'idle' ? '摄像头尚未请求'
      : next.phase === 'stopped' ? '摄像头已停止'
      : '摄像头状态请查看浏览器';
    if (active === undefined && next.phase === 'scanning') cameraLabel = '摄像头正在使用';
    if (cameraText.textContent !== cameraLabel) cameraText.textContent = cameraLabel;
    start.disabled = next.phase === 'starting';
    start.textContent = next.phase === 'starting' ? '正在开启…' : '开启摄像头扫码';
    device.disabled = next.phase === 'starting';
    submit.disabled = next.phase === 'matching';
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

  render({ phase: 'idle', message: '开启扫码，或手动输入 C 编号进行定位。', designators: [], previousHighlightMayRemain: false });
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
  .page { min-height: 100dvh; padding: 30px 28px 24px; background-image: radial-gradient(#a9bcb33b .7px, transparent .7px); background-size: 20px 20px; }
  .shell { max-width: 1000px; margin: 0 auto; }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 23px; border-bottom: 1px solid #cbd7d0; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; letter-spacing: .02em; }
  .brand-mark { background: var(--accent); color: #fff; padding: 9px; border-radius: 10px; }
  .local { padding: 5px 10px; border: 1px solid #bfd1c5; background: #ecf3ec; border-radius: 6px; color: #31584b; font-size: 12px; white-space: nowrap; }
  .intro { margin: 48px 0 26px; max-width: 660px; }
  .eyebrow { color: #7d562b; font-size: 12px; font-weight: 650; letter-spacing: .12em; margin-bottom: 10px; }
  h1 { font-size: clamp(25px, 4vw, 36px); font-weight: 650; line-height: 1.35; letter-spacing: -.025em; text-wrap: balance; }
  .intro > p:last-child { margin-top: 14px; max-width: 580px; font-size: 15px; line-height: 1.9; color: var(--muted); }
  .workspace { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(240px, 1fr); border: 1px solid #bccfc4; border-radius: 16px; background: var(--surface); overflow: hidden; box-shadow: 0 10px 32px #19392e08; }
  .main { padding: 30px; min-width: 0; }
  .section-title { font-size: 17px; line-height: 1.5; font-weight: 650; }
  .step-index { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid #c0d4c7; border-radius: 7px; background: #edf4ee; font-size: 13px; margin-right: 9px; color: var(--accent); vertical-align: 1px; }
  .file-area { border: 1px dashed #9cb7a9; border-radius: 11px; background: #f7faf7; padding: 30px 20px 22px; margin-top: 20px; text-align: center; }
  .file-symbol { display: inline-flex; justify-content: center; align-items: center; width: 52px; height: 58px; border: 1px solid #bfcec5; border-radius: 7px 14px 7px 7px; background: #fff; margin-bottom: 16px; color: #356254; font-size: 12px; font-weight: 650; letter-spacing: .06em; box-shadow: 3px 3px 0 #e4ebe5; }
  .file-area button { display: block; margin: 0 auto; min-width: 185px; }
  .file-area .hint { margin-top: 10px; }
  .source-file { font-size: 13px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
  .processing { margin-top: 20px; }
  .progress { list-style: none; padding: 0; margin: 0 0 15px; display: flex; gap: 8px; }
  .progress li { flex: 1; min-width: 0; border-top: 3px solid #dbe4de; padding-top: 7px; color: #61736b; font-size: 12px; }
  .progress li[data-current="true"] { color: var(--accent); border-color: var(--accent); font-weight: 650; }
  .progress li[data-done="true"] { border-color: #8db6a1; }
  .download { margin-top: 16px; padding: 16px; border: 1px solid #a5c9b5; border-radius: 9px; background: #f2f8f1; }
  .download button { width: 100%; margin-bottom: 8px; }
  .aside { background: #f0f4ef; padding: 30px 24px; border-left: 1px solid #d5dfd6; min-width: 0; }
  .aside h2 { font-size: 15px; font-weight: 650; }
  .steps { list-style: none; padding: 0; margin: 22px 0 0; }
  .steps li { position: relative; padding: 0 0 25px 28px; }
  .steps li::before { content: ''; position: absolute; top: 7px; left: 0; width: 9px; height: 9px; border: 2px solid #608a76; border-radius: 50%; background: #f0f4ef; z-index: 1; }
  .steps li:not(:last-child)::after { content: ''; position: absolute; top: 16px; bottom: 0; left: 4px; border-left: 1px solid #b4c8b9; }
  .steps strong { font-size: 14px; font-weight: 650; }
  .steps p { font-size: 12px; margin-top: 5px; color: var(--muted); line-height: 1.8; }
  .aside-note { padding-top: 17px; border-top: 1px solid #cbd9cd; font-size: 12px; color: #496153; }
  .footer { margin-top: 22px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 20px; font-size: 12px; color: #52645a; }
  @media (max-width: 720px) { .page { padding: 20px 16px; } .intro { margin-top: 34px; } .workspace { grid-template-columns: 1fr; } .aside { border-left: 0; border-top: 1px solid #d5dfd6; padding: 24px; } .main { padding: 24px; } .steps { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .steps li { padding-bottom: 0; } .steps li::after { display: none; } }
  @media (max-width: 420px) { .brand { font-size: 13px; gap: 7px; } .brand-mark { padding: 6px; } .local { font-size: 11px; padding-inline: 7px; } .main, .aside { padding: 20px; } .steps { grid-template-columns: 1fr; } .file-area { padding-inline: 12px; } }
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
  const hint = el('p', '选择 LCEDA 导出的 .html 或 .htm 文件', 'hint small muted');
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
    ['手动开启扫码', '在右侧面板点击开启摄像头，或直接输入完整 C 编号。'],
    ['核对位号后焊接', '按定位结果核对器件；焊接状态仍由你手动勾选。'],
  ];
  for (const [title, detail] of instructions) {
    const step = el('li');
    step.append(el('strong', title), el('p', detail));
    steps.append(step);
  }
  aside.append(steps, el('p', '摄像头不会自动开启。若浏览器限制本地文件的摄像头权限，可使用手动输入定位。', 'aside-note'));
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
