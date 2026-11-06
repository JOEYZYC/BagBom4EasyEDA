# Scan diagnostics and same-code rearming

**Status: 0.2.0 development target, pending final release validation.** The verified 0.1.0 baseline does not establish completion of these features. This page specifies intended behavior; see [verification.md](verification.md) for actual evidence.

## Plaintext observations

The target exposes bounded, in-memory plaintext status, raw decoded payloads and frame counts. Copy should offer a manual text-selection/copy fallback when the browser clipboard operation is unavailable. Render decoded content as text, not HTML. Do not save frames, upload logs or persist diagnostic history.

Raw payloads may contain private supplier/order data. Review and redact before sharing; local-only handling does not make the content suitable for a public issue.

| Stage | Interpretation |
| --- | --- |
| No code | A fresh frame has no decoded result; this is different from a decoded off-BOM identity. |
| Confirmation | A valid identity is waiting for a second independent valid frame. |
| Identity rejection | A payload was decoded but is unsupported, unmatched, incomplete or conflicting. |
| Repeat suppression | A confirmed visible identity is intentionally not selected repeatedly. |
| Native outcome | Original-row selection was confirmed, rejected, cancelled or not confirmed; decoding alone is not selection success. |

The existing generic non-BOM warning is unchanged. Displaying raw decoded text from an off-BOM label does not mean decoding failed or that selection is safe. Rejection may leave a previous board highlight visible.

## Repeat state requirements

1. Require **two independent valid frames** to confirm an exact identity.
2. Suppress repeated automatic selection while the confirmed code remains continuously visible.
3. Rearm only after **at least one second AND at least two fresh empty frames**, or explicit camera Start/device restart.
4. Conflicting codes, unmatched identities and errors are **not absence** and must not satisfy the empty-frame gate.
5. Failed, cancelled or unconfirmed native selection must not become permanently seen. Retries must be bounded rather than continuously firing.
6. Manual native interaction pauses the camera and invalidates stale work. Stop releases the camera; folding does not.

## Practical troubleshooting

- First verify a complete supplier C-code manually in aggregated mode with filters cleared.
- If nothing decodes, keep the complete symbol visible and check focus, lighting and reflections. Wrinkles or occlusion may defeat decoding; diagnostics do not fix physical damage.
- If text decodes but matching rejects it, inspect exact BOM identity rather than changing camera settings or guessing from package/value.
- If a visible code is suppressed, remove it fully until the rearm conditions are met, or explicitly restart the camera. Do not infer that the decoder has stopped working solely from a lack of repeated selections.
- For a new build, close old tabs and open the new generated file. Regenerate other boards from untouched originals using the new enhancer.

No claim is made here that physical camera permissions, real-label performance or final 0.2.0 integration have been validated. See [usage](usage.md) and [performance limits](scanner-performance.md).
