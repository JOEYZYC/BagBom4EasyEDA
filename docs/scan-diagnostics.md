# Scan diagnostics and same-code rearming

**Status: 0.2.0 passed local software verification.** This page describes the tested behavior; physical-camera recognition remains unverified. See [verification.md](verification.md) for evidence and limits.

## Plaintext observations

The panel exposes bounded, in-memory plaintext status, raw decoded payloads and frame counts. Copy offers a manual text-selection/copy fallback when clipboard access is unavailable or denied. Decoded content is rendered as text, not HTML. No frames are saved, logs uploaded or diagnostic history persisted. History is limited to 20 events and 16 KiB UTF-8; display truncation is explicit and never changes matching input.

Raw payloads may contain private supplier/order data. Review and redact before sharing; local-only handling does not make the content suitable for a public issue.

| Stage | Interpretation |
| --- | --- |
| No code | A fresh frame has no decoded result; this is different from a decoded off-BOM identity. |
| Confirmation | A valid identity is waiting for a second independent valid frame. |
| Identity rejection | A payload was decoded but is unsupported, unmatched, incomplete or conflicting. |
| Repeat suppression | A confirmed visible identity is intentionally not selected repeatedly. |
| Native outcome | Original-row selection was confirmed, rejected, cancelled or not confirmed; decoding alone is not selection success. |

The existing generic non-BOM warning is unchanged. Displaying raw decoded text from an off-BOM label does not mean decoding failed or that selection is safe. Rejection may leave a previous board highlight visible.

Counts/time advance for accepted completed new-frame decoding results, not physical camera exposure FPS. Identical text is coalesced without freezing the counter. A qualified target may complete native selection after a later empty frame: its receipt is labeled with that earlier target, while the latest no-code diagnostic remains truthful.

## Repeat state requirements

1. Require **two independent valid frames** to confirm an exact identity.
2. Suppress repeated automatic selection while the confirmed code remains continuously visible.
3. Rearm only after **at least one second AND at least two fresh empty frames**, or explicit camera Start/device restart.
4. Conflicting codes, unmatched identities and errors are **not absence** and must not satisfy the empty-frame gate.
5. Failed, cancelled or unconfirmed native selection must not become permanently seen. Retries must be bounded rather than continuously firing.
6. Manual native interaction pauses the camera and invalidates stale work. Stop releases the camera; folding does not.
7. While a different identity is waiting for its second frame, reselect is disabled rather than selecting the previous target. A qualified two-frame request is not cancelled merely by a brief empty/glare frame.

## Practical troubleshooting

- First verify a complete supplier C-code manually in aggregated mode with filters cleared.
- If nothing decodes, keep the complete symbol visible and check focus, lighting and reflections. Wrinkles or occlusion may defeat decoding; diagnostics do not fix physical damage.
- If text decodes but matching rejects it, inspect exact BOM identity rather than changing camera settings or guessing from package/value.
- If a visible code is suppressed, remove it fully until the rearm conditions are met, or explicitly restart the camera. Do not infer that the decoder has stopped working solely from a lack of repeated selections.
- For a new build, close old tabs and open the new generated file. Regenerate other boards from untouched originals using the new enhancer.

Physical camera permissions and real-label performance have not been validated by these software checks. See [usage](usage.md) and [performance limits](scanner-performance.md).
