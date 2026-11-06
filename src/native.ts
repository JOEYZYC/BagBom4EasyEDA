import type { ExactTarget, MatchResult, NativeSnapshot } from './contracts.ts';

export interface NativePart {
  des: string;
  id: string;
  side: 'top' | 'bottom';
  key: string;
  cCode: string | null;
  mpn: string;
}
export interface NativeGroup {
  key: string;
  ids: {field: string; value: string}[];
  refs: [string, string][];
}
export interface BoardSnapshot extends NativeSnapshot {
  parts: NativePart[];
  groups: NativeGroup[];
  blockedCodes: string[];
}
export const MARKER = '<!-- bagbom-enhanced:v1 -->';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function json(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'string') throw new Error(`${name} 不是 JSON 字符串`);
  const parsed: unknown = JSON.parse(value);
  if (!object(parsed)) throw new Error(`${name} 结构不支持`);
  return parsed;
}
export function extractFiles(html: string): Record<string, unknown> {
  if (html.length > 80_000_000) throw new Error('文件超过 80MB 限制');
  if (html.includes(MARKER)) throw new Error('此文件已增强；请选择原生导出文件');
  const marker = 'window.files = ';
  const assignments = [...html.matchAll(/^\s*<script type="text\/javascript">window\.files = /gm)];
  const a = assignments.length === 1 ? assignments[0].index! + assignments[0][0].indexOf(marker) : -1;
  const b = html.indexOf('; window.__ENGING_OBJ_PRELOAD__ = ', a + marker.length);
  if (a < 0 || b < 0) throw new Error('不支持的原生 HTML 数据边界');
  return json(html.slice(a + marker.length, b), 'window.files');
}
export function readSnapshot(files: Record<string, unknown>, artifactId: string): BoardSnapshot {
  const bom = json(json(files.bom_merge, 'bom_merge').data, 'bom_merge.data');
  if (!object(bom.comp_info) || !Array.isArray(bom.designator_info) || bom.designator_info.length !== 1) {
    throw new Error('仅支持一个板块且具有 comp_info/designator_info 的导出');
  }
  const board: unknown = bom.designator_info[0];
  if (!object(board) || !Array.isArray(board.top) || !Array.isArray(board.bottom)) throw new Error('未知顶底层结构');
  const diagnostics: string[] = [];
  const parts: NativePart[] = [];
  const groups = new Map<string, NativeGroup>();
  for (const side of ['top', 'bottom'] as const) {
    for (const value of board[side] as unknown[]) {
      if (!object(value) || typeof value.des !== 'string' || !/^[A-Za-z][A-Za-z0-9_.+-]*$/.test(value.des) ||
          typeof value.deviceUuid !== 'string' || !value.deviceUuid || typeof value.lc_code !== 'string' ||
          !Number.isSafeInteger(value.pick_index) || Number(value.pick_index) < 1) {
        throw new Error('器件身份/位号结构不支持');
      }
      const comp = Object.hasOwn(bom.comp_info, value.lc_code) ? bom.comp_info[value.lc_code] : null;
      const supplier = object(comp) ? comp['Supplier Part'] : null;
      const cCode = typeof supplier === 'string' && /^C[0-9]+$/.test(supplier) ? supplier : null;
      // lc_code is an opaque exact foreign key, not a supplier/MPN split operation.
      const mpn = object(comp) && typeof comp['Manufacturer Part'] === 'string' ? comp['Manufacturer Part'] : '';
      // deviceUuid identifies the library device and is shared by multiple placements.
      // This is an artifact-local native record identity, not a guessed engine UniqueID.
      const part: NativePart = {des: value.des, id: JSON.stringify([board.name, side, value.pick_index]), side, key: value.lc_code, cCode, mpn};
      parts.push(part);
      if (!cCode) { diagnostics.push(`${part.des}: 缺少有效 Supplier Part，跳过自动匹配`); continue; }
      if (!groups.has(part.key)) groups.set(part.key, {
        key: part.key, ids: [{field: 'LCSC', value: cCode},
          ...(/^[A-Za-z0-9][A-Za-z0-9._/+()#-]*$/.test(mpn) && mpn.length >= 4 ? [{field: 'Manufacturer Part', value: mpn.toUpperCase()}] : [])], refs: [],
      });
      groups.get(part.key)!.refs.push([part.des, part.id]);
    }
  }
  const duplicateRefs = parts.filter((p, i) => parts.findIndex(q => q.des === p.des || q.id === p.id) !== i);
  if (duplicateRefs.length) throw new Error(`重复位号/ID: ${duplicateRefs.map(p => p.des).join(', ')}`);
  const blockedCodes = [...new Set(parts.flatMap(p => p.cCode ? [p.cCode] : []))].filter(c => {
    const identities = new Set(parts.filter(p => p.cCode === c).map(p => p.mpn));
    return identities.size > 1;
  });
  diagnostics.push(...blockedCodes.map(c => `${c}: 多个制造商身份，自动匹配已禁用`));
  return {artifactId, parts, groups: [...groups.values()], blockedCodes, diagnostics};
}
export function manualMatch(value: string, snapshot: BoardSnapshot): MatchResult {
  const cCode = value.trim().toUpperCase();
  if (!/^C[0-9]+$/.test(cCode)) return reject('invalid', '请输入完整 C 编号（例如 C25900），不接受子串/参数');
  if (snapshot.blockedCodes.includes(cCode)) return reject('mixed-identity', '此 C 编号具有不同制造商身份，请手动核对');
  const parts = snapshot.parts.filter(p => p.cCode === cCode);
  if (!parts.length) return reject('not-found', '当前 BOM 无此完整 C 编号');
  const target: ExactTarget = {cCode, designators: parts.map(p => p.des).sort(), nativeIds: parts.map(p => p.id).sort()};
  return {kind: 'exact', target};
}
export function reject(reason: Extract<MatchResult, {kind: 'rejected'}>['reason'], message: string): MatchResult {
  return {kind: 'rejected', reason, message};
}
export function strictUTF8(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
}
export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
