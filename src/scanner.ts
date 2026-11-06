import {mountScanner} from './ui/index.ts';
import {DOMSelectionAdapter, ownedEvents} from './selection.ts';
import {manualMatch, type BoardSnapshot} from './native.ts';
import {matchFrame, type BarcodeAPI} from './identity.ts';
import {LatestInput, ScanLatch} from './session.ts';
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
  let lastTarget: ExactTarget | undefined;
  const root = document.createElement('div'); root.id = 'bagbom-scanner'; document.body.append(root);
  const preview = document.createElement('video');
  let model: ScannerViewModel = {phase: 'idle', message: '先手动输入完整 C 编号验证定位；摄像头仅在点击开启后申请', designators: [], previousHighlightMayRemain: false, cameraActive: false};
  const update = (patch: Partial<ScannerViewModel>) => { model = {...model, ...patch}; view.render(model); };
  const camera = new LocalCamera(preview, navigator.mediaDevices, createDecoderWorker, {
    generation: () => latest.generation,
    invalidate: () => { latest.next(); latch.resetStability(); },
    state: (phase, message, cameraActive) => update({phase, message, cameraActive, designators: lastTarget?.designators || [], cCode: lastTarget?.cCode, previousHighlightMayRemain: true, canReselect: !!lastTarget}),
    devices: (cameraDevices, selectedCameraId) => update({cameraDevices, selectedCameraId}),
    frame: (payloads, generation) => {
      if (!validArtifact()) { camera.stop('原生数据已改变，扫码已停止，请重新打开文件'); adapter.dispose(); return; }
      if (!latest.current(generation)) return;
      if (!payloads.length) { latch.resetStability(); return; }
      const result = matchFrame(payloads, snapshot, window.BagBomBarcodes);
      if (result.kind === 'rejected') {
        latch.resetStability(); latest.next(); lastTarget = undefined;
        update({phase: 'rejected', message: result.message, designators: [], cCode: undefined, previousHighlightMayRemain: true, canReselect: false});
      } else if (latch.observe(result.target.cCode)) void apply(result);
    },
  });
  async function apply(result: MatchResult) {
    const request = latest.next();
    update({phase: 'matching', message: '正在核对完整位号集合与原生行…', cCode: undefined, designators: [], previousHighlightMayRemain: true, canReselect: false});
    if (result.kind === 'rejected') {
      lastTarget = undefined;
      update({phase: 'rejected', message: result.message, canReselect: false}); return;
    }
    lastTarget = result.target;
    try {
      const receipt = await adapter.select(result.target, token, request.signal);
      if (!latest.current(request.generation)) return;
      const confirmed = receipt.status === 'confirmed';
      update({phase: confirmed ? 'selected' : 'rejected', message: confirmed ? '已确认原生 BOM 行选中；保留原单击居中/翻面行为，不更改焊接勾选' : receipt.message || '未确认原生选择',
        cCode: result.target.cCode, designators: result.target.designators, previousHighlightMayRemain: !confirmed, canReselect: true});
    } catch (error) {
      if (latest.current(request.generation)) update({phase: 'error', message: error instanceof Error ? error.message : String(error), canReselect: true});
    }
  }
  const view = mountScanner(root, {
    submitManualCCode: value => {camera.stop('手动输入优先，扫码已暂停'); void apply(manualMatch(value, snapshot));},
    startCamera: deviceId => {if (!validArtifact()) { update({phase: 'error', message: '原生数据已改变，请重新打开增强文件'}); return; } void camera.start(deviceId);},
    stopCamera: () => camera.stop(),
    reselect: () => {if (lastTarget) {camera.stop('显式再次选择，扫码已暂停'); void apply({kind: 'exact', target: lastTarget});}},
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
