import type { EnhanceResult } from './contracts.ts';
import { extractFiles, MARKER, readSnapshot, sha256, strictUTF8 } from './native.ts';

// Add before all vendor scripts; the native export otherwise attempts online API/font calls.
export const NETWORK_POLICY = `<!-- bagbom-network-policy:v1 --><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src blob: data:; worker-src blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">`;

export function scriptJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
export async function enhance(bytes: ArrayBuffer, filename: string, runtime: string, notices: string): Promise<EnhanceResult> {
  const html = strictUTF8(bytes);
  const snapshot = readSnapshot(extractFiles(html), await sha256(bytes));
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!head) throw new Error('未找到 HTML head，无法在原生脚本前建立本地网络边界');
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0 || !html.toLowerCase().includes('</html>')) throw new Error('HTML 结束边界不完整');
  const extension = `\n${MARKER}\n<script id="bagbom-data" type="application/json">${scriptJSON(snapshot)}</script>\n` +
    `<script id="bagbom-notices" type="application/json">${scriptJSON(notices)}</script>\n` +
    `<script>${runtime.replace(/<\/script/gi, '<\\/script')}</script>\n`;
  const withExtension = html.slice(0, end) + extension + html.slice(end);
  const headEnd = head.index + head[0].length;
  return {html: withExtension.slice(0, headEnd) + NETWORK_POLICY + withExtension.slice(headEnd),
    suggestedFilename: filename.replace(/\.html?$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') + '_扫码版.html',
    warnings: snapshot.diagnostics};
}
