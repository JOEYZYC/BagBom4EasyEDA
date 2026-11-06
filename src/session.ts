// Both decoding and native deferred selection share this latest-input generation.
export class LatestInput {
  generation = 0;
  private controller = new AbortController();
  next(): {generation: number; signal: AbortSignal} {
    this.controller.abort(); this.controller = new AbortController();
    return {generation: ++this.generation, signal: this.controller.signal};
  }
  current(generation: number): boolean { return generation === this.generation && !this.controller.signal.aborted; }
}
export type ScanDecision = {kind: 'confirming' | 'suppressed' | 'busy' | 'cooldown'} | {kind: 'select'; attempt: number};
export class ScanLatch {
  private confirmed?: string;
  private candidate = '';
  private count = 0;
  private pending?: {key: string; attempt: number};
  private attempt = 0;
  private retryAfter = 0;
  private emptySince?: number;
  private emptyFrames = 0;
  private absenceQualified = false;
  observe(key: string, now: number): ScanDecision {
    this.clearAbsence();
    if (this.pending) return {kind: 'busy'};
    if (this.confirmed === key) { this.resetStability(); return {kind: 'suppressed'}; }
    if (this.candidate === key) this.count++; else { this.candidate = key; this.count = 1; }
    this.count = Math.min(2, this.count);
    if (now < this.retryAfter) return {kind: 'cooldown'};
    if (this.count < 2) return {kind: 'confirming'};
    this.pending = {key, attempt: ++this.attempt};
    return {kind: 'select', attempt: this.attempt};
  }
  finish(attempt: number, confirmed: boolean, now: number): boolean {
    if (this.pending?.attempt !== attempt) return false;
    if (confirmed) { this.confirmed = this.absenceQualified ? undefined : this.pending.key; this.retryAfter = 0; }
    else { this.confirmed = undefined; this.retryAfter = now + 1000; }
    this.pending = undefined; this.resetStability();
    return true;
  }
  empty(now: number): void {
    // A qualified two-frame request survives a brief empty/glare frame.
    this.resetStability();
    this.emptySince ??= now;
    this.emptyFrames = Math.min(2, this.emptyFrames + 1);
    // Only a fresh empty-frame callback can rearm; elapsed time alone cannot do so.
    if (this.emptyFrames >= 2 && now - this.emptySince >= 1000) { this.confirmed = undefined; this.absenceQualified = true; }
  }
  interrupt(now: number): void {
    if (this.pending) this.finish(this.pending.attempt, false, now);
    this.resetStability(); this.clearAbsence();
  }
  restart(): void {
    this.pending = undefined; this.confirmed = undefined; this.retryAfter = 0;
    this.resetStability(); this.clearAbsence();
  }
  resetStability(): void { this.candidate = ''; this.count = 0; }
  private clearAbsence(): void { this.emptySince = undefined; this.emptyFrames = 0; this.absenceQualified = false; }
}
