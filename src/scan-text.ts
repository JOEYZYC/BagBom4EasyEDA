import type {ScanTextOutput} from './contracts.ts';

export const SCAN_TEXT_MAX_EVENTS = 20;
export const SCAN_TEXT_MAX_BYTES = 16 * 1024;
const encoder = new TextEncoder();

// Escape control/bidi characters for inspection, but leave HTML as literal plain text.
// Only a bounded prefix is inspected; matching always receives the untouched payload.
function display(value: string, limit: number): string {
  let text = '', bytes = 0, consumed = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    const token = character === '\\' ? '\\\\' : /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/.test(character)
      ? `\\u${point.toString(16).padStart(4, '0')}` : character;
    const size = token !== character ? token.length : point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + size > limit - 64) break;
    text += token; bytes += size; consumed += character.length;
  }
  return consumed < value.length ? `${text}…[截断，原文 ${value.length} 字符]` : text;
}
function rawText(payloads: readonly string[]): string {
  if (!payloads.length) return '本帧没有解码文本';
  const count = Math.min(8, payloads.length), limit = Math.floor(1024 / count);
  const lines = payloads.slice(0, count).map((payload, i) => `#${i + 1} ${display(payload, limit)}`);
  if (payloads.length > count) lines.push(`[截断，另有 ${payloads.length - count} 条文本未展示]`);
  return lines.join('\n');
}
export class ScanTextLog {
  private revision = 0;
  private frameCount = 0;
  private lastFrameAt?: string;
  private status: ScanTextOutput['status'] = 'waiting';
  private message = '等待启动摄像头或新的解码帧';
  private raw = '';
  private entries: string[] = [];
  private bytes = 0;
  private signature = '';
  private qualifiedThroughEmpty?: number;
  constructor(private clock: () => number = Date.now) {}
  frame(payloads: readonly string[], status: ScanTextOutput['status'], message: string): number {
    this.frameCount = Math.min(Number.MAX_SAFE_INTEGER, this.frameCount + 1);
    this.lastFrameAt = new Date(this.clock()).toISOString();
    return this.event(status, message, payloads);
  }
  event(status: ScanTextOutput['status'], message: string, payloads?: readonly string[]): number {
    if (status === 'no-code' && payloads?.length === 0) {
      if (this.status === 'matching') this.qualifiedThroughEmpty = this.revision;
      else if (this.status !== 'no-code') this.qualifiedThroughEmpty = undefined;
    } else this.qualifiedThroughEmpty = undefined;
    this.raw = payloads ? rawText(payloads) : '';
    this.write(status, message);
    return ++this.revision;
  }
  outcome(revision: number, status: ScanTextOutput['status'], message: string, qualifiedTarget?: string): boolean {
    if (revision !== this.revision) {
      if (!qualifiedTarget || this.status !== 'no-code' || this.qualifiedThroughEmpty !== revision) return false;
      this.qualifiedThroughEmpty = undefined;
      // Record the qualified target's receipt without pretending the latest empty frame decoded it.
      this.append(status, display(`此前两帧目标 ${qualifiedTarget}：${message}`, 512), '');
      return true;
    }
    this.qualifiedThroughEmpty = undefined;
    ++this.revision; this.write(status, message); return true;
  }
  snapshot(): ScanTextOutput {
    return {frameCount: this.frameCount, lastFrameAt: this.lastFrameAt, status: this.status, message: this.message, text: this.entries.join('\n\n')};
  }
  private write(status: ScanTextOutput['status'], message: string): void {
    this.status = status; this.message = display(message, 512);
    const signature = `${status}\n${this.message}\n${this.raw}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.append(status, this.message, this.raw);
  }
  private append(status: ScanTextOutput['status'], message: string, raw: string): void {
    const entry = `[${new Date(this.clock()).toISOString()}] ${status}: ${message}${raw ? '\n原始解码文本：\n' + raw : ''}`;
    this.entries.push(entry); this.bytes += encoder.encode(entry).byteLength;
    while (this.entries.length > SCAN_TEXT_MAX_EVENTS || this.bytes + Math.max(0, this.entries.length - 1) * 2 > SCAN_TEXT_MAX_BYTES) {
      this.bytes -= encoder.encode(this.entries.shift()!).byteLength;
    }
  }
}
