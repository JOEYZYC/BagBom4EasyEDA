export interface CameraCallbacks {
  state(phase: 'starting' | 'scanning' | 'stopped' | 'error', message: string, active: boolean): void;
  devices(devices: {deviceId: string; label: string}[], selected?: string): void;
  frame(payloads: string[], inputGeneration: number): void;
  generation(): number;
  invalidate(): void;
}
export interface WorkerResource { worker: Worker; release(): void }
export const CAPTURE_MAX_EDGE = 1920;
export const CAPTURE_MAX_PIXELS = 1920 * 1080;
export const MIN_CAPTURE_INTERVAL_MS = 100;
export class LocalCamera {
  private epoch = 0;
  private stream?: MediaStream;
  private resource?: WorkerResource;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: {id: number; generation: number};
  private frameId = 0;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private decodeTimer?: ReturnType<typeof setTimeout>;
  private frameWaitTimer?: ReturnType<typeof setTimeout>;
  private videoFrameCallback?: number;
  private removeEnded: (() => void)[] = [];
  constructor(private video: HTMLVideoElement, private media: MediaDevices | undefined,
    private createWorker: () => WorkerResource, private callbacks: CameraCallbacks) {}
  stop(message = '摄像头已停止；之前的高亮可能仍保留'): void {
    this.epoch++; this.callbacks.invalidate();
    clearTimeout(this.timer); clearTimeout(this.startupTimer); clearTimeout(this.decodeTimer); clearTimeout(this.frameWaitTimer);
    if (this.videoFrameCallback !== undefined) this.video.cancelVideoFrameCallback?.(this.videoFrameCallback);
    this.videoFrameCallback = undefined;
    this.pending = undefined;
    this.removeEnded.forEach(remove => remove()); this.removeEnded = [];
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.video.pause(); this.video.srcObject = null;
    this.resource?.worker.terminate(); this.resource?.release(); this.resource = undefined;
    this.callbacks.state('stopped', message, false);
  }
  async start(deviceId?: string): Promise<void> {
    this.stop();
    const epoch = this.epoch;
    this.callbacks.state('starting', '仅在本地处理。请允许浏览器使用摄像头', false);
    try {
      if (!this.media?.getUserMedia) throw new Error('此上下文不支持摄像头；请使用现代浏览器，或使用原生 BOM 搜索与手动选择');
      const stream = await this.media.getUserMedia({audio: false, video: {
        width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 30},
        ...(deviceId ? {deviceId: {exact: deviceId}} : {facingMode: {ideal: 'environment'}}),
      }});
      if (epoch !== this.epoch) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      if (!stream.getVideoTracks().length) throw new Error('未获得视频轨道');
      this.callbacks.state('starting', '已取得摄像头，正在准备本地解码器', true);
      for (const track of stream.getVideoTracks()) {
        const ended = () => this.fail('摄像头已断开或授权已撤销', epoch);
        track.addEventListener('ended', ended);
        this.removeEnded.push(() => track.removeEventListener('ended', ended));
      }
      this.video.muted = true; this.video.playsInline = true; this.video.srcObject = stream;
      await this.video.play();
      if (epoch !== this.epoch) return;
      const resource = this.createWorker(); this.resource = resource;
      resource.worker.onerror = () => this.fail('本地解码 Worker 运行失败', epoch);
      let ready = false;
      const canvas = this.video.ownerDocument.createElement('canvas');
      const context = canvas.getContext('2d', {willReadFrequently: true});
      if (!context) throw new Error('浏览器无法读取本地视频帧');
      const clock = this.video.ownerDocument.defaultView?.performance;
      const now = () => clock ? clock.now() : Date.now();
      let lastCapture = -Infinity;
      let lastFrameKey: string | undefined;
      const current = () => epoch === this.epoch && !this.pending;
      const capture = (frameKey: string | undefined): boolean => {
        if (!current()) return false;
        try {
          const width = this.video.videoWidth, height = this.video.videoHeight;
          if (this.video.readyState < 2 || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 ||
              frameKey === undefined || frameKey === lastFrameKey) return false;
          clearTimeout(this.frameWaitTimer);
          const ratio = Math.min(1, CAPTURE_MAX_EDGE / Math.max(width, height), Math.sqrt(CAPTURE_MAX_PIXELS / (width * height)));
          const targetWidth = Math.max(1, Math.floor(width * ratio)), targetHeight = Math.max(1, Math.floor(height * ratio));
          if (canvas.width !== targetWidth) canvas.width = targetWidth;
          if (canvas.height !== targetHeight) canvas.height = targetHeight;
          lastFrameKey = frameKey; lastCapture = now();
          // Always inspect the whole frame; extra detail must not hide a smaller contradictory label.
          context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const id = ++this.frameId;
          this.pending = {id, generation: this.callbacks.generation()};
          resource.worker.postMessage({id, pixels: pixels.buffer, width: canvas.width, height: canvas.height}, [pixels.buffer]);
          this.decodeTimer = setTimeout(() => this.fail('本地条码解码超时', epoch), 15_000);
          return true;
        } catch (error) { this.fail(message(error), epoch); return false; }
      };
      const videoCallbackSupported = typeof this.video.requestVideoFrameCallback === 'function' && typeof this.video.cancelVideoFrameCallback === 'function';
      const requestFreshFrame = () => {
        if (!current()) return;
        try {
          if (videoCallbackSupported) {
            this.videoFrameCallback = this.video.requestVideoFrameCallback((_now, metadata) => {
              if (epoch !== this.epoch) return;
              this.videoFrameCallback = undefined;
              if (!current()) return;
              const key = Number.isFinite(metadata.mediaTime) ? `time:${metadata.mediaTime}`
                : Number.isFinite(metadata.presentedFrames) ? `frame:${metadata.presentedFrames}` : undefined;
              if (!capture(key)) requestFreshFrame();
            });
          } else {
            const quality = this.video.getVideoPlaybackQuality?.();
            const presented = quality ? quality.totalVideoFrames - quality.droppedVideoFrames : NaN;
            const key = Number.isFinite(presented) ? `frame:${presented}`
              : Number.isFinite(this.video.currentTime) ? `time:${this.video.currentTime}` : undefined;
            if (!capture(key) && current()) this.timer = setTimeout(requestFreshFrame, 20);
          }
        } catch (error) { this.fail(message(error), epoch); }
      };
      const nextFrame = () => {
        if (!current()) return;
        const wait = () => {
          if (!current()) return;
          this.frameWaitTimer = setTimeout(() => this.fail('未取得可用视频帧', epoch), 10_000);
          requestFreshFrame();
        };
        // Bound work to ten starts/second, without adding a fixed sleep after every decode.
        const delay = Math.max(0, MIN_CAPTURE_INTERVAL_MS - (now() - lastCapture));
        if (delay) this.timer = setTimeout(wait, delay); else wait();
      };
      resource.worker.onmessage = ({data}) => {
        if (epoch !== this.epoch) return;
        if (!ready && data.error) { this.fail(`本地解码失败：${data.error}`, epoch); return; }
        if (data.ready && !ready) {
          ready = true; clearTimeout(this.startupTimer);
          this.callbacks.state('scanning', '摄像头正在使用；一次只展示一个料袋。连续两帧一致后选择', true);
          nextFrame(); return;
        }
        if (!this.pending || data.id !== this.pending.id) return;
        if (data.error) { this.fail(`本地解码失败：${data.error}`, epoch); return; }
        clearTimeout(this.decodeTimer);
        const generation = this.pending.generation; this.pending = undefined;
        if (generation === this.callbacks.generation() && Array.isArray(data.results)) {
          const values = data.results.map((r: {text?: unknown}) => r.text);
          if (values.every((v: unknown) => typeof v === 'string')) this.callbacks.frame(values, generation);
        }
        if (epoch === this.epoch) nextFrame();
      };
      this.startupTimer = setTimeout(() => this.fail('本地 WASM 初始化超时', epoch), 15_000);
      resource.worker.postMessage({init: true});
      // Enumeration is only attempted after explicit permission, never at page load.
      void this.media.enumerateDevices().then(devices => {
        if (epoch === this.epoch) this.callbacks.devices(devices.filter(d => d.kind === 'videoinput').map(d => ({deviceId: d.deviceId, label: d.label})),
          stream.getVideoTracks()[0]?.getSettings().deviceId);
      }).catch(() => { /* Optional selector; the granted stream can still be used. */ });
    } catch (error) { this.fail(message(error), epoch); }
  }
  private fail(text: string, epoch: number): void {
    if (epoch !== this.epoch) return;
    this.stop(); this.callbacks.state('error', `${text}。相机已释放，可使用原生 BOM 搜索与手动选择`, false);
  }
}
function message(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') return '相机权限被拒绝';
  return error instanceof Error ? error.message : String(error);
}
