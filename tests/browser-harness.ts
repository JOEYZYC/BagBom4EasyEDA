import {createDecoderWorker} from '../src/scanner.ts';
import {rowSchema, verifyRow, DOMSelectionAdapter} from '../src/selection.ts';
import {readSnapshot, manualMatch} from '../src/native.ts';
import {LocalCamera} from '../src/camera.ts';
(globalThis as any).BagBomTest = {createDecoderWorker, rowSchema, verifyRow, DOMSelectionAdapter, readSnapshot, manualMatch, LocalCamera};
