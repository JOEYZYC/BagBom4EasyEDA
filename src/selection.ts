import type { ExactTarget, NativeSelectionAdapter, NativeSnapshot, SelectionReceipt, TargetToken } from './contracts.ts';
import { manualMatch, type BoardSnapshot } from './native.ts';

export interface RowSchema {
  mode: 'aggregate' | 'single';
  top: string[];
  bottom: string[];
  cCode: string;
}
const refs = (value: string) => value === '' ? [] : value.split('、').map(s => s.trim());
export function verifyRow(schema: RowSchema, target: ExactTarget, snapshot: BoardSnapshot): boolean {
  const rowRefs = [...schema.top, ...schema.bottom];
  if (!rowRefs.length || new Set(rowRefs).size !== rowRefs.length || schema.cCode !== target.cCode ||
      schema.mode === 'single' && rowRefs.length !== 1) return false;
  if (rowRefs.length !== target.designators.length || rowRefs.some(r => !target.designators.includes(r))) return false;
  return (['top', 'bottom'] as const).every(side => schema[side].every(des => {
    const part = snapshot.parts.find(p => p.des === des);
    return part?.side === side && part.cCode === target.cCode && target.nativeIds.includes(part.id);
  }));
}
export function rowSchema(row: HTMLTableRowElement): RowSchema | null {
  const cells = [...row.cells];
  if (cells[0]?.querySelectorAll('input[type="checkbox"]').length !== 1) return null;
  const table = row.closest('table');
  if (cells.length === 8 && table?.id === 'founded' && table.className === 'bom-table_Z6Wd0') {
    const read = (cell: HTMLTableCellElement) => {
      const first = cell.firstElementChild;
      if (first?.tagName === 'P') return refs(first.textContent?.trim() ?? '');
      if (first?.tagName === 'SPAN' && first.className === 'len_nKuFJ' && !first.textContent) return [];
      return null;
    };
    const top = read(cells[1]), bottom = read(cells[2]);
    const cCode = cells[6].querySelector('p')?.textContent?.trim() ?? '';
    return top && bottom ? {mode: 'aggregate', top, bottom, cCode} : null;
  }
  if (cells.length === 7 && !table?.id && !table?.className && ['T', 'B'].includes(cells[2].textContent?.trim() ?? '') &&
      !cells.slice(1).some(c => c.children.length)) {
    const des = cells[1].textContent?.trim() ?? '';
    return {mode: 'single', top: cells[2].textContent === 'T' ? [des] : [],
      bottom: cells[2].textContent === 'B' ? [des] : [], cCode: cells[6].textContent?.trim() ?? ''};
  }
  return null;
}
export const ownedEvents = new WeakSet<Event>();

// Capture only timers synchronously created by our one vendor click. This lets Stop/new
// input cancel the vendor's deferred 300ms handler without rewriting its minified core.
export function dispatchOwnedClick(row: HTMLTableRowElement, win: Window & typeof globalThis): {cancel(): void; count: number} {
  const handles: number[] = [];
  const timers: Window = win;
  const original = timers.setTimeout;
  timers.setTimeout = (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const id = original.call(timers, handler, delay, ...args);
    if (delay === 300) handles.push(id);
    return id;
  };
  try {
    const event = new win.MouseEvent('click', {bubbles: true, cancelable: true});
    ownedEvents.add(event);
    row.dispatchEvent(event);
  } finally { timers.setTimeout = original; }
  return {count: handles.length, cancel: () => handles.forEach(id => win.clearTimeout(id))};
}
export class DOMSelectionAdapter implements NativeSelectionAdapter {
  private snapshot?: BoardSnapshot;
  private generation = 0;
  private selectionGeneration = 0;
  private pendingCancel?: () => void;
  constructor(private doc: Document, private win: Window & typeof globalThis, private validArtifact: () => boolean) {}
  async bind(snapshot: NativeSnapshot): Promise<TargetToken> {
    this.dispose();
    this.snapshot = snapshot as BoardSnapshot;
    return {artifactId: snapshot.artifactId, generation: this.generation};
  }
  async select(target: ExactTarget, token: TargetToken, signal: AbortSignal): Promise<SelectionReceipt> {
    // Supersede synchronously, even when the newest request is rejected before DOM lookup.
    const selectionGeneration = ++this.selectionGeneration;
    this.pendingCancel?.();
    const snapshot = this.snapshot;
    const alive = () => selectionGeneration === this.selectionGeneration && !signal.aborted && token.generation === this.generation &&
      token.artifactId === snapshot?.artifactId && this.validArtifact();
    const receipt = (status: SelectionReceipt['status'], message?: string): SelectionReceipt => ({status, designators: target.designators, message});
    if (!snapshot || !alive()) return receipt('stale', '目标或输入已失效');
    const authoritative = manualMatch(target.cCode, snapshot);
    if (authoritative.kind !== 'exact' || JSON.stringify([...authoritative.target.designators].sort()) !== JSON.stringify([...target.designators].sort()) ||
        JSON.stringify([...authoritative.target.nativeIds].sort()) !== JSON.stringify([...target.nativeIds].sort())) return receipt('unsupported', '目标集合校验失败');
    const candidates = [...this.doc.querySelectorAll<HTMLTableRowElement>('#smt-ui-container table > tbody > tr')]
      .filter(row => row.getClientRects().length > 0 && this.win.getComputedStyle(row).visibility !== 'hidden')
      .filter(row => { const schema = rowSchema(row); return schema && verifyRow(schema, target, snapshot); });
    if (candidates.length !== 1) return receipt('unsupported', '未找到唯一且包含完整目标的原生行；请清除过滤或切换位号聚合。不聚合多位号不支持');
    if (!alive()) return receipt('stale', '目标或输入已失效，未发送点击');
    const row = candidates[0];
    return new Promise(resolve => {
      let done = false;
      let owned: ReturnType<typeof dispatchOwnedClick> | undefined;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (value: SelectionReceipt) => {
        if (done) return;
        done = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
        owned?.cancel(); this.pendingCancel = undefined; resolve(value);
      };
      const abort = () => finish(receipt('stale', owned
        ? '输入已变更；仅取消尚未执行的原生延迟处理，不撤销已有高亮'
        : '输入已变更，未发送过期点击'));
      this.pendingCancel = abort;
      signal.addEventListener('abort', abort, {once: true});
      timer = setTimeout(() => {
        if (!alive() || !row.isConnected) { abort(); return; }
        const schema = rowSchema(row);
        if (!schema || !verifyRow(schema, target, snapshot)) { finish(receipt('unsupported', '原生行已变更')); return; }
        if (!alive()) { abort(); return; }
        owned = dispatchOwnedClick(row, this.win);
        if (owned.count !== 1) { finish(receipt('unconfirmed', '原生延迟处理器结构不符，已取消')); return; }
        timer = setTimeout(() => {
          if (!alive()) { abort(); return; }
          const after = rowSchema(row);
          if (row.isConnected && after && verifyRow(after, target, snapshot) && row.style.backgroundColor === 'rgb(230, 247, 255)') {
            finish(receipt('confirmed'));
          } else finish(receipt('unconfirmed', '未确认原生选中状态；之前的高亮可能仍保留'));
        }, 420);
      }, 100);
    });
  }
  dispose(): void { this.generation++; this.pendingCancel?.(); this.pendingCancel = undefined; this.snapshot = undefined; }
}
