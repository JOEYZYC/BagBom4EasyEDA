// Internal adapter/UI contracts. These are not LCEDA vendor APIs.
export interface TargetToken {
  artifactId: string;
  generation: number;
}

export interface ExactTarget {
  cCode: string;
  designators: readonly string[];
  nativeIds: readonly string[];
}

export type MatchResult =
  | { kind: 'exact'; target: ExactTarget }
  | { kind: 'rejected'; reason: 'invalid' | 'unsupported' | 'not-found' | 'conflict' | 'mixed-identity'; message: string };

export interface NativeSnapshot {
  artifactId: string;
  groups: readonly unknown[];
  diagnostics: readonly string[];
}

export interface EnhanceResult {
  html: string;
  suggestedFilename: string;
  warnings: readonly string[];
}

export interface SelectionReceipt {
  status: 'confirmed' | 'unconfirmed' | 'unsupported' | 'stale';
  designators: readonly string[];
  message?: string;
}

export interface NativeSelectionAdapter {
  bind(snapshot: NativeSnapshot): Promise<TargetToken>;
  select(target: ExactTarget, token: TargetToken, signal: AbortSignal): Promise<SelectionReceipt>;
  dispose(): void;
}

// Bounded in-memory plain text only; never camera frames or automatic uploads.
export interface ScanTextOutput {
  frameCount: number;
  lastFrameAt?: string;
  status: 'waiting' | 'no-code' | 'confirming' | 'suppressed' | 'rejected' | 'matching' | 'selected' | 'error' | 'stopped';
  message: string;
  text: string;
}

export interface ScannerViewModel {
  phase: 'idle' | 'starting' | 'scanning' | 'matching' | 'selected' | 'rejected' | 'error' | 'stopped';
  message: string;
  cCode?: string;
  designators: readonly string[];
  previousHighlightMayRemain: boolean;
  // Actual owned media state; matching/selection phases do not imply camera shutdown.
  cameraActive?: boolean;
  cameraDevices?: readonly { deviceId: string; label: string }[];
  selectedCameraId?: string;
  canReselect?: boolean;
  scanText?: ScanTextOutput;
}

export interface ScannerActions {
  startCamera(deviceId?: string): void;
  stopCamera(): void;
  reselect(): void;
}

export interface EnhancerViewModel {
  phase: 'idle' | 'reading' | 'enhancing' | 'ready' | 'error';
  message: string;
  sourceFilename?: string;
  suggestedFilename?: string;
}

export interface EnhancerActions {
  chooseFile(file: File): void;
  download(): void;
}

export interface ViewHandle<T> {
  render(model: T): void;
  destroy(): void;
}
