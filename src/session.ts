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
export class ScanLatch {
  private seen = new Set<string>();
  private candidate = '';
  private count = 0;
  observe(key: string): boolean {
    if (this.seen.has(key)) return false;
    if (this.candidate === key) this.count++; else { this.candidate = key; this.count = 1; }
    if (this.count < 2) return false;
    this.seen.add(key); return true;
  }
  resetStability(): void { this.candidate = ''; this.count = 0; }
}
