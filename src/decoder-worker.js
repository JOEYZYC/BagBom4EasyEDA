/* Adapted from bag-bom barcode-worker.js; Apache-2.0, Copyright 2026 egethropic.
 * Added inline WASM initialization and explicit initialization handshake. */
let initialized;
self.onmessage = async ({data}) => {
  try {
    if (data.init) {
      initialized ??= ZXingWASM.prepareZXingModule({overrides: {
        wasmBinary: Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0)),
        locateFile: () => 'zxing_reader.wasm',
      }, fireImmediately: true});
      await initialized;
      self.postMessage({ready: true});
      return;
    }
    if (!initialized) throw new Error('Decoder not initialized');
    await initialized;
    const {id, pixels, width, height} = data;
    const results = await ZXingWASM.readBarcodes(new ImageData(new Uint8ClampedArray(pixels), width, height), {
      formats: ['QRCode', 'DataMatrix', 'Code128', 'Code39', 'PDF417'],
      tryHarder: true, tryRotate: true, tryInvert: true, tryDenoise: true, textMode: 'Plain', maxNumberOfSymbols: 32,
    });
    self.postMessage({id, results: results.filter(r => r.isValid && r.sequenceSize <= 1).map(r => ({text: r.text, format: r.format}))});
  } catch (error) { self.postMessage({id: data.id, error: error.message || String(error)}); }
};
