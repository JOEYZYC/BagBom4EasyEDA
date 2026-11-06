# Scanner capture and performance limits

These notes describe bounded software behavior and summarize prior synthetic evidence. They do not establish real-label recognition rates, hardware A/B improvements or final validation of the 0.2.0 development target. See [verification](verification.md) for release evidence and [diagnostics](scan-diagnostics.md) for pending behavior.

## Capture and scheduling

The capture path in `src/camera.ts`:

- Requests **ideal** 1920×1080 at 30 fps; these are not mandatory device constraints. Actual hardware/browser settings may be lower.
- Samples the full frame, capped at a 1920-pixel long edge and **2,073,600 pixels**. It does not use a center crop or a QR-only shortcut to conceal other codes.
- Reuses the canvas when dimensions are unchanged.
- Allows **one Worker job in flight** and at least **100 ms between decode starts**. Slow decoding does not incur an additional fixed idle delay after completion.
- Checks fresh frames with `requestVideoFrameCallback` and uses frame/time fallbacks where unavailable. Reprocessing one frozen frame must not count as independent confirmation; fallback timing alone is not proof of a new physical exposure.
- Invalidates stale session results and releases resources on stop/lifecycle failure. Stopping, not folding the panel, is the user's explicit release action.

## Decoder boundary

Pinned **ZXing-WASM 3.1.6** runs locally in an inline Blob Worker with embedded WASM. QRCode, DataMatrix, Code128, Code39 and PDF417 remain enabled. Robust decoding options are preserved; invalid/segmented results are not promoted to valid identity matches. No OCR, cloud service or image upload is used.

Two independent valid frames are required to confirm an identity. Decoding success, identity matching and original-viewer selection are different stages. Conflicting, unmatched and error results must not be treated as no-code frames for repeat rearming.

## Prior synthetic comparison

**VERIFIED — recorded prior synthetic benchmark evidence, not a current release result:** full-detail robust decoding returned complete expected results for **40/40** measured synthetic cases. Higher-detail frames cost more per decode; the improvement is not that every individual frame decodes faster. Retaining detail and removing fixed idle waiting trade extra single-frame cost against capture fidelity and confirmation scheduling.

Reducing robust options lost relevant codes in synthetic cases, so that candidate was not adopted. Tests of generated symbols and synthetic video do not establish an improvement for wrinkled bags, reflections, small printed labels or a particular physical camera. They do not establish final 0.2.0 release readiness.

## Reproduction prerequisites

Use Node 24, pnpm 11.18.0 and the pinned dependency/reference setup in the [README](../README.md). Relevant commands include:

```sh
pnpm typecheck
pnpm test
pnpm exec node tests/scanner-media-check.mjs
```

These are instructions, not a new execution record. Automated media checks use synthetic media in isolated browser automation with real camera access blocked. Full integration additionally needs separately prepared untracked compatible exports/fixture configuration and installed Chrome/Edge.

**UNVERIFIED by synthetic results:** physical camera permissions, real capture settings, autofocus, lighting, glare, motion blur, low-power/thermal behavior, other browsers and physical recognition rates. A higher-resolution request may be slower on weaker devices. Keeping an entire barcode visible and reducing reflection can help presentation, but the software does not repair physical occlusion.
