# Design and release requirements

This document describes the current export-enhancement design, not a client-extension plan. See [requirements](planning-inputs.md), [usage](usage.md) and [verification](verification.md).

## Release status

- **0.1.0:** verified baseline, pushed without force.
- **0.2.0:** local software verification completed for plaintext diagnostics, same-code rearming and rebuilt HTML. This is not a physical-camera or remote-publication claim; see the current verification record.
- **0.2.1:** Apache-2.0 packaging/version-metadata patch using the verified runtime; distribute only the standalone enhancer and license/notice files, not vendor-viewer or board exports.
- **0.3.0:** native-aligned UI, one stateful camera control, preview-first layout and removal of the duplicate manual C-code form. Exact matching, original manual priority and capture/decoder settings are retained. Software verification is recorded separately from remote publication.

## Architecture

```text
Trusted native HTML → data-only extraction → exact BOM identity index
Camera → local Worker/WASM decoding → identity and independent-frame checks
Exact complete target set → original BOM-row single-click → original viewer
```

The enhancer generates a new file; it does not overwrite the original or rebuild the vendor BOM/3D/2D viewer. The generated file retains executable vendor code. Compatibility is limited to the supplied export family and depends on version-fragile row/handler structure, not a stable public client API.

## Selection contract

1. Accept only complete supplier C-codes or verified complete MPN identities. Preserve meaningful MPN suffixes. Do not infer identity from value, package or quantity.
2. Require the full original row to express exactly the full target reference set. Aggregated mode is recommended; reject mixed identities, conflicts, missing identities, incomplete sets, hidden rows and unsupported multi-row selection.
3. Dispatch the original single-click—not a guessed private RPC, checkbox click or synthesized double-click. Preserve any centering or side flip already performed by that single-click.
4. Report the native selection outcome separately from decoding and identity matching. A previous highlight may remain after failure; never present it as a fresh success.
5. Native manual interaction takes priority and pauses the camera. Invalidate stale asynchronous work after stop, restart or manual interaction.
6. Do not auto-mark soldered/placed state, change design data, add progress persistence or promise synchronization with the client.

## Camera and decoder boundary

Camera access starts only after explicit user action and browser permission. Stop releases the camera; folding only changes panel visibility. Decoding stays local, using inline Blob Worker/WASM and pinned ZXing-WASM 3.1.6. Supported formats are QRCode, DataMatrix, Code128, Code39 and PDF417; no OCR or cloud fallback.

Capture requests ideal 1920×1080 at 30 fps, with full-frame sampling capped at a 1920-pixel long edge and 2,073,600 pixels. Only one decode job is in flight, with at least 100 ms between starts and fresh-frame checks. Hardware may provide lower settings. See [performance notes](scanner-performance.md).

## 0.2.0 acceptance requirements — verified in the tested software

- Bounded in-memory plaintext status, raw decoded payloads and frame counts; safe text rendering and copying with manual fallback. No images, uploads or persistence.
- Distinguish no code, confirmation, identity rejection, repeat suppression and native selection outcome; preserve the existing generic non-BOM warning.
- Confirm identity using two independent valid frames. Conflicting, unmatched and error results are not evidence of absence.
- A qualified request survives a later brief empty frame. Log its target-correlated native receipt without replacing the latest no-code diagnostic.
- While a different code waits for confirmation, reselect must not act on the previous code instead of the displayed target.
- Suppress repeated selection while a confirmed code remains visible. Rearm after at least one second **and** two fresh empty frames, or explicit camera Start/device restart.
- Do not permanently mark failed/unconfirmed selection as seen; allow bounded retries without a tight retry loop.
- Check state transitions, copy fallback, manual priority, stale results, full-set selection and resource release before declaring the release validated. See [diagnostics specification](scan-diagnostics.md).

## Build and evidence boundaries

Build preflight checks all four output targets against source-path, realpath and file-identity aliases before writes; source preservation is checked by hash. External concurrent changes to paths or links are excluded from that guarantee.

Keep source reading, deterministic tests, generated-viewer integration, synthetic-media checks and physical-camera evidence distinct. Integration requires separately prepared untracked compatible exports/fixture configuration and isolated Chrome/Edge automation. Synthetic results do not establish physical label recognition or blanket browser/V4 compatibility. Current evidence belongs in [verification.md](verification.md), not in release requirements.
