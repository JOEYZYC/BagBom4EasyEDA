# Local usage

[English overview](../README.md) · [中文概览](../README.zh-CN.md) · [Documentation index](README.md)

## 1. Prepare the native export and enhancer

In LCEDA PCB, choose **Tools → Soldering Assistance → Export → Offline HTML** (`工具 → 焊接辅助工具 → 导出 → 离线Html`). Keep the trusted original untouched; `input/board.html` is a generic example filename, not a supplied board.

Download [html-enhancer.html from v0.2.1](https://github.com/JOEYZYC/BagBom4EasyEDA/releases/download/v0.2.1/html-enhancer.html), or use a locally built `output/html-enhancer.html`. The tool contains no vendor viewer or board data. Generated HTML is not included in a source checkout. Developers can follow the [build instructions](../README.md#development); end users need no Node.js, server or CDN.

## 2. Generate a new enhanced file

1. Open `output/html-enhancer.html` in desktop Chrome or Edge.
2. Select the trusted, untouched native HTML—not CSV, XLSX or an already enhanced file.
3. Download the new `*_扫码版.html`, for example `output/<board>_扫码版.html`.
4. Open that new file. Keep the original separately and do not choose its name in the browser's save dialog.

The enhancer reads UTF-8/JSON data without evaluating the input scripts. **The generated file retains the executable vendor viewer**, so this is not a way to sanitize an untrusted HTML file. All enhancement and decoding are local.

When using a new build, close old tabs and reopen the new file. Previously generated board files do not update themselves; regenerate each from its untouched original using the new enhancer.

## 3. Verify manual selection first

1. Choose **aggregated references** (`位号聚合`) and clear search/visibility filters.
2. Enter a complete supplier C-code from your own BOM and invoke manual location.
3. Check the selected original BOM row, **all target references** and the board response. Scanning must never auto-check “soldered” (`已焊接`).

The enhancer reuses the original single-click. That click may already center or flip the view; no extra double-click is needed. Non-aggregated or multi-row targets that cannot express the complete target set are rejected rather than partially selected. Do not work around that safety check by interpreting the last of several single-clicks as a complete selection.

## 4. Start and stop scanning

1. Click **Start camera** (`开启摄像头扫码`) and grant browser permission. Camera access is not requested automatically.
2. Select a device if needed and explicitly start/restart it.
3. Present one complete label at a time. Confirmation requires two independent valid frames with a consistent exact identity.
4. Check the full identity, reference set and native viewer outcome before proceeding.
5. Use **Stop camera** to release it. Folding the panel only reduces its size; it does not stop capture. Native manual interaction pauses scanning.

QRCode, DataMatrix, Code128, Code39 and PDF417 are decoded locally. There is no OCR, cloud lookup or value/package guessing. Camera use from local files depends on browser/runtime policy and permission. If access is unavailable, use manual selection and normal browser permission controls; do not disable browser security.

## 5. Interpret a rejection correctly

| Observation | Meaning / action |
| --- | --- |
| No usable code | Decoding has not produced a usable result; improve framing, focus and light. This is not a BOM mismatch. |
| Raw text decoded, but not in BOM | Decoding succeeded; identity matching did not. The existing generic non-BOM warning remains applicable. |
| Mixed, conflicting, incomplete or missing identity | No automatic choice. Inspect the label and original BOM manually. |
| Hidden row or unsupported multi-row/full-set selection | Clear filters/use aggregation and verify the exact set; do not accept a subset. |
| Selection unconfirmed or rejected | The previous highlight may remain. Do not treat it as the current result. |
| Native manual action | Camera scanning pauses so manual work takes priority. |

Only complete supplier C-codes or verified complete MPNs can produce automatic selection. Missing identity is not repaired by matching resistance, package or quantity. The source export family is the compatibility boundary; there is no blanket V4 guarantee.

## 6. Diagnostics and repeat behavior

The 0.2.0 files supply bounded in-memory plaintext status, raw decoded payloads and frame counts, with explicit Copy/manual fallback. Waiting, an actually empty decoded frame, first-frame confirmation, rejection, repeat/cooldown suppression and native selection outcomes are distinct. The counter/time continue updating when identical text is coalesced. They count accepted, completed new-frame decoding results—not camera exposure FPS. Images and logs are not automatically uploaded, saved or copied.

A continuously visible, natively confirmed code suppresses repeated selection. To scan it again automatically, remove it until **at least two fresh empty decoded frames span at least one second**, then return it for normal two-frame confirmation; explicit camera Start/device restart also resets eligibility. A single glare/empty frame, no new frames, conflicts, unmatched results and errors do not prove absence. A→B→A is allowed after normal confirmation. Failed/cancelled/unconfirmed selection is not permanently marked seen; automatic retries have a one-second cooldown.

Stop/native manual interaction does not resume the camera by itself: explicitly Start it again. Manual location and explicit reselect remain available; reselect is disabled while a different code is awaiting confirmation, so it cannot select the previous target instead. A qualified two-frame request survives brief empty frames; any later receipt identifies that earlier target without pretending the latest empty frame decoded it.

Text history is limited to 20 events and 16 KiB UTF-8; huge/excess payloads have visible truncation markers, while **matching still receives every original, untruncated payload**. Control/bidi characters and backslashes are visibly escaped. Close/reload discards this memory-only history. These behaviors passed local software integration checks; old HTML must be regenerated. Physical-label performance remains unverified. See [scan diagnostics](scan-diagnostics.md).

## Privacy, performance and progress

Capture requests ideal 1920×1080/30 fps but hardware can downgrade. Full-frame processing preserves competing codes; high-detail frames can be slower. Wrinkles, reflections, focus and physical occlusion still limit decoding. See [performance limits](scanner-performance.md); synthetic results are not physical recognition rates.

This is not a client extension and does not synchronize progress with LCEDA. No new progress persistence is promised. Original viewer/board/model rights are not granted by the project's Apache-2.0 license; public vendor-viewer redistribution is not established. **Do not publish generated viewer HTML.** See [third-party notices](../THIRD_PARTY_NOTICES.md) and [verification](verification.md).
