import {mountScanner} from './ui/index.ts';
import {DOMSelectionAdapter, ownedEvents} from './selection.ts';
import type {BoardSnapshot} from './native.ts';
import {matchFrame, type BarcodeAPI} from './identity.ts';
import {LatestInput, ScanLatch} from './session.ts';
import {ScanTextLog} from './scan-text.ts';
import {LocalCamera, type WorkerResource} from './camera.ts';
import type {ExactTarget, MatchResult, ScannerViewModel} from './contracts.ts';

declare const __WORKER_SOURCE__: string;
declare global { interface Window { BagBomBarcodes: BarcodeAPI; files: {bom_merge: unknown} } }
export function createDecoderWorker(): WorkerResource {
  const url = URL.createObjectURL(new Blob([__WORKER_SOURCE__], {type: 'text/javascript'}));
  try { return {worker: new Worker(url), release: () => URL.revokeObjectURL(url)}; }
  catch (error) { URL.revokeObjectURL(url); throw error; }
}
async function main() {
  const data = document.getElementById('bagbom-data');
  if (!data?.textContent) return;
  const snapshot: BoardSnapshot = JSON.parse(data.textContent);
  const sourceFiles = window.files;
  const sourceBom = sourceFiles?.bom_merge;
  const validArtifact = () => window.files === sourceFiles && window.files?.bom_merge === sourceBom && data.isConnected;
  const adapter = new DOMSelectionAdapter(document, window, validArtifact);
  const token = await adapter.bind(snapshot);
  const latest = new LatestInput(), latch = new ScanLatch();
  const scanText = new ScanTextLog();
  const now = () => performance.now();
  const matchingMessage = '正在核对完整位号集合与原生行…';
  let pending: {generation: number; target: ExactTarget; scanAttempt?: number; textRevision: number} | undefined;
  const cancelPending = () => {
    const old = pending; pending = undefined;
    if (old?.scanAttempt !== undefined) latch.finish(old.scanAttempt, false, now());
    return latest.next();
  };
  let lastTarget: ExactTarget | undefined;
  const root = document.createElement('div'); root.id = 'bagbom-scanner'; document.body.append(root);
  const preview = document.createElement('video');
  let model: ScannerViewModel = {phase: 'idle', message: '点击开启摄像头扫码；也可使用原生 BOM 搜索与手动选择', designators: [], previousHighlightMayRemain: false, cameraActive: false, scanText: scanText.snapshot()};
  const update = (patch: Partial<ScannerViewModel>) => { model = {...model, ...patch, scanText: scanText.snapshot()}; view.render(model); };
  const camera = new LocalCamera(preview, navigator.mediaDevices, createDecoderWorker, {
    generation: () => latest.generation,
    invalidate: () => { cancelPending(); latch.interrupt(now()); },
    state: (phase, message, cameraActive) => {
      scanText.event(phase === 'error' ? 'error' : phase === 'stopped' ? 'stopped' : 'waiting', message);
      update({phase, message, cameraActive, designators: lastTarget?.designators || [], cCode: lastTarget?.cCode, previousHighlightMayRemain: true, canReselect: !!lastTarget});
    },
    devices: (cameraDevices, selectedCameraId) => update({cameraDevices, selectedCameraId}),
    frame: (payloads, generation) => {
      if (!validArtifact()) { camera.stop('原生数据已改变，扫码已停止，请重新打开文件'); adapter.dispose(); return; }
      if (!latest.current(generation)) return;
      if (!payloads.length) {
        latch.empty(now());
        const message = '本帧未解出条码，摄像头仍在尝试';
        scanText.frame(payloads, 'no-code', message);
        update({phase: 'scanning', message, designators: [], cCode: undefined, previousHighlightMayRemain: true, canReselect: !!lastTarget});
        return;
      }
      // Display is bounded separately; never truncate or normalize payloads passed to matching.
      const result = matchFrame(payloads, snapshot, window.BagBomBarcodes);
      if (result.kind === 'rejected') {
        if (pending) cancelPending();
        latch.interrupt(now()); lastTarget = undefined;
        scanText.frame(payloads, 'rejected', result.message);
        update({phase: 'rejected', message: result.message, designators: [], cCode: undefined, previousHighlightMayRemain: true, canReselect: false});
        return;
      }
      if (pending && pending.target.cCode !== result.target.cCode) cancelPending();
      const decision = latch.observe(result.target.cCode, now());
      if (decision.kind === 'select') {
        const revision = scanText.frame(payloads, 'matching', matchingMessage);
        void apply(result, revision, decision.attempt);
      } else if (decision.kind === 'busy' && pending) {
        pending.textRevision = scanText.frame(payloads, 'matching', matchingMessage);
        update({phase: 'matching', message: matchingMessage});
      } else if (decision.kind === 'suppressed') {
        lastTarget = result.target;
        const message = '同一码仍在画面中，已抑制重复定位；移开至少1秒并取得两个无代码新帧，或先停止再开启摄像头重新识别';
        scanText.frame(payloads, 'suppressed', message);
        update({phase: 'selected', message, cCode: result.target.cCode, designators: result.target.designators, previousHighlightMayRemain: false, canReselect: true});
      } else {
        const cooling = decision.kind === 'cooldown' || decision.kind === 'busy';
        const message = cooling ? '上次定位未完成，短暂冷却后继续确认' : '已解出条码，等待第二个独立新帧确认';
        scanText.frame(payloads, cooling ? 'suppressed' : 'confirming', message);
        update({phase: 'scanning', message, cCode: result.target.cCode, designators: result.target.designators, previousHighlightMayRemain: true, canReselect: lastTarget?.cCode === result.target.cCode});
      }
    },
  });
  async function apply(result: MatchResult, textRevision: number, scanAttempt?: number) {
    const request = cancelPending();
    update({phase: 'matching', message: matchingMessage, cCode: undefined, designators: [], previousHighlightMayRemain: true, canReselect: false});
    if (result.kind === 'rejected') {
      lastTarget = undefined;
      scanText.outcome(textRevision, 'rejected', result.message);
      update({phase: 'rejected', message: result.message, canReselect: false}); return;
    }
    lastTarget = result.target;
    const operation = {generation: request.generation, target: result.target, scanAttempt, textRevision};
    pending = operation;
    try {
      const receipt = await adapter.select(result.target, token, request.signal);
      if (pending !== operation || !latest.current(request.generation)) return;
      pending = undefined;
      const confirmed = receipt.status === 'confirmed';
      if (scanAttempt !== undefined) latch.finish(scanAttempt, confirmed, now());
      const message = confirmed ? '已确认原生 BOM 行选中；保留原单击居中/翻面行为，不更改焊接勾选' : receipt.message || '未确认原生选择';
      scanText.outcome(operation.textRevision, confirmed ? 'selected' : 'rejected', message, result.target.cCode);
      update({phase: confirmed ? 'selected' : 'rejected', message,
        cCode: result.target.cCode, designators: result.target.designators, previousHighlightMayRemain: !confirmed, canReselect: true});
    } catch (error) {
      if (pending !== operation || !latest.current(request.generation)) return;
      pending = undefined;
      if (scanAttempt !== undefined) latch.finish(scanAttempt, false, now());
      const message = error instanceof Error ? error.message : String(error);
      scanText.outcome(operation.textRevision, 'error', message, result.target.cCode);
      update({phase: 'error', message, canReselect: true});
    }
  }
  const view = mountScanner(root, {
    startCamera: deviceId => {
      if (!validArtifact()) {
        camera.stop(); const message = '原生数据已改变，请重新打开增强文件';
        scanText.event('error', message); update({phase: 'error', message}); return;
      }
      latch.restart(); void camera.start(deviceId);
    },
    stopCamera: () => camera.stop(),
    reselect: () => {if (lastTarget && model.canReselect) {camera.stop('显式再次选择，扫码已暂停'); void apply({kind: 'exact', target: lastTarget}, scanText.event('matching', '显式重新定位请求'));}},
  }, preview);
  view.render(model);
  const nativeInteraction = (event: Event) => {
    if (ownedEvents.has(event) || event.composedPath().includes(root)) return;
    const target = event.target;
    if (target instanceof Node && document.getElementById('smt-ui-container')?.contains(target)) {
      camera.stop('原生手动操作优先；扫码已暂停，之前的高亮可能仍保留');
    }
  };
  for (const type of ['pointerdown', 'click', 'keydown', 'input']) document.addEventListener(type, nativeInteraction, true);
  const notices = document.createElement('details');
  notices.style.cssText = 'position:fixed;bottom:0;left:0;z-index:10000;max-width:40vw;max-height:35vh;overflow:auto;background:white;color:#222;font:12px sans-serif';
  const summary = document.createElement('summary'); summary.textContent = '扫码增强 / 第三方许可（仅供本机使用）';
  const text = document.createElement('pre'); text.style.whiteSpace = 'pre-wrap';
  text.textContent = JSON.parse(document.getElementById('bagbom-notices')?.textContent || '""'); notices.append(summary, text); document.body.append(notices);
  let observer: MutationObserver | undefined;
  let closed = false;
  const visibility = () => {if (document.hidden) camera.stop('页面已隐藏，扫码已停止');};
  const close = () => {
    if (closed) return;
    closed = true; observer?.disconnect(); document.removeEventListener('visibilitychange', visibility);
    camera.stop(); adapter.dispose(); view.destroy();
    for (const type of ['pointerdown', 'click', 'keydown', 'input']) document.removeEventListener(type, nativeInteraction, true);
  };
  window.addEventListener('pagehide', close, {once: true});
  document.addEventListener('visibilitychange', visibility);
  // An enhanced file is bound to exactly one embedded artifact, never a hot-swapped board.
  observer = new MutationObserver(() => {if (!root.isConnected || !validArtifact()) close();});
  observer.observe(document.body, {childList: true, subtree: true});
}
void main().catch(error => { console.error('BagBom enhancement failed', error); });
