import type { MatchResult } from './contracts.ts';
import { manualMatch, reject, type BoardSnapshot } from './native.ts';

export interface BarcodeAPI {
  parse(payload: string): {type: string; value: string}[];
  match(payloads: string[], index: BoardSnapshot['groups']): {
    status: string; exact: {group: {refs: [string, string][]}}[];
  };
}
type BarcodeIdentity = {type: string; value: string};
const fieldKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function identity(type: string, raw: string): BarcodeIdentity | null {
  const value = raw.trim().toUpperCase();
  // Match the upstream validator, including its required digit; never drop an explicit MPN.
  return value.length >= 4 && value.length <= 100 && /\d/.test(value) && /^[A-Z0-9][A-Z0-9._/+()#-]*$/.test(value)
    ? {type, value} : null;
}
// null rejects the grammar; undefined means a raw identifier/URL with no explicit fields.
function explicitIdentities(payload: string): BarcodeIdentity[] | null | undefined {
  const text = payload.trim().replace(/^\][A-Za-z][0-9]/, '');
  if (!text.startsWith('{')) {
    if (/^https?:\/\//i.test(text)) return /\s/.test(text) ? null : undefined;
    if (text.startsWith('[)>') || /[\x1d\x1e]|<GS>|<RS>|\{GS\}|\{RS\}|␝|␞/i.test(text)) {
      const records = text.replace(/␝|<GS>|\{GS\}/gi, '\x1d').replace(/␞|<RS>|\{RS\}/gi, '\x1e')
        .replace(/␄|<EOT>|\{EOT\}/gi, '\x04').split(/[\x1d\x1e\x04\r\n]/).map(s => s.trim());
      const expected: BarcodeIdentity[] = [];
      const hasSupplier = records.some(record => record.startsWith('30P'));
      for (const record of records) {
        let parsed: BarcodeIdentity | null | undefined;
        if (/^(1P|30P)/i.test(record)) {
          if (!/^(1P|30P)/.test(record)) return null;
          const supplier = record.startsWith('30P');
          parsed = identity(supplier ? 'digikey' : 'mpn', record.slice(supplier ? 3 : 2));
        } else if (!hasSupplier && /^P[A-Z0-9][A-Z0-9.+/_-]*-ND$/i.test(record)) parsed = identity('digikey', record.slice(1));
        if (parsed === null) return null;
        if (parsed) expected.push(parsed);
      }
      return expected;
    }
    return /^[A-Za-z0-9][A-Za-z0-9._/+()#-]*$/.test(text) ? undefined : null;
  }
  // Either a flat JSON object or a fully unquoted record, never a mixture. Unsupported
  // escaping/nesting is rejected rather than delegated to the permissive upstream fallback.
  const body = text.slice(1, -1);
  if (!text.endsWith('}') || /[\\\[\]{}]/.test(body)) return null;
  const quoted = /^\s*"/.test(body);
  if (quoted) { try { JSON.parse(text); } catch { return null; } }
  const fields = body.split(',');
  const seen = new Set<string>();
  const expected: BarcodeIdentity[] = [];
  for (const field of fields) {
    const parsed = quoted
      ? field.match(/^\s*"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*(?:"([^"\r\n]*)"|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null))\s*$/)
      : field.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*([^"'\r\n]*?)\s*$/);
    if (!parsed) return null;
    const name = fieldKey(parsed[1]);
    if (seen.has(name)) return null;
    seen.add(name);
    if (name === 'pc' || name === 'pm') {
      if (parsed[2] === undefined) return null;
      const value = parsed[2].trim();
      if (name === 'pc' && !/^C[0-9]+$/i.test(value)) return null;
      const id = identity(name === 'pc' ? 'lcsc' : 'mpn', value);
      if (!id) return null;
      expected.push(id);
    } else if (/^(?:mpn|(?:manufacturer|mfr|manf|mfg)part(?:number)?|manfnum|partnumber|supplierpart(?:number)?|lcsc.*|digikey.*|mouser.*|sku)$/.test(name)) {
      return null; // Explicit but unsupported identity aliases cannot be treated as metadata.
    }
  }
  return expected;
}
export function structuredBoundary(payload: string): boolean {
  return explicitIdentities(payload) !== null;
}
export function matchFrame(payloads: string[], snapshot: BoardSnapshot, barcodes: BarcodeAPI): MatchResult {
  if (!payloads.length || payloads.length > 32) return reject('invalid', '没有有效的完整条码');
  for (const payload of payloads) {
    if (typeof payload !== 'string' || payload.length > 10_000) return reject('invalid', '条码结构不支持或重复/无效身份字段');
    const expected = explicitIdentities(payload);
    if (expected === null) return reject('invalid', '条码结构不支持或重复/无效身份字段');
    const ids = barcodes.parse(payload);
    if (expected && (expected.length !== ids.length || expected.some(id => !ids.some(parsed => parsed.type === id.type && parsed.value === id.value)))) {
      return reject('invalid', '条码显式身份未被完整解析，已拒绝');
    }
    // A second unresolved label may be another product: never discard it to win a match.
    if (!ids.length || ids.some(id => !snapshot.groups.some(g => g.ids.some(i => i.value === id.value &&
        (id.type === 'any' || id.type === 'lcsc' && i.field === 'LCSC' || id.type === 'mpn' && i.field === 'Manufacturer Part'))))) {
      return reject('conflict', '同帧包含未解析/未匹配身份，请一次只展示一个料袋');
    }
  }
  const result = barcodes.match(payloads, snapshot.groups);
  if (result.status !== 'unique') return reject('conflict', '条码身份冲突或存在多个料号');
  const refs = new Set(result.exact[0].group.refs.map(r => r[0]));
  const codes = [...new Set(snapshot.parts.filter(p => refs.has(p.des)).map(p => p.cCode))];
  if (codes.length !== 1 || !codes[0]) return reject('mixed-identity', '无法确定唯一 C 编号');
  return manualMatch(codes[0], snapshot);
}
