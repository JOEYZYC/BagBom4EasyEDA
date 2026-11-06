# Documentation

[English README](../README.md) · [中文 README](../README.zh-CN.md)

## Using the tool

- [Local usage](usage.md): native export, local enhancement, manual verification and camera controls.
- [Scan diagnostics](scan-diagnostics.md): tested 0.2.0 plaintext output and same-code rearming.
- [Capture and performance limits](scanner-performance.md): software constraints and synthetic-evidence limits.

## Design and provenance

- [Product requirements](planning-inputs.md)
- [Design and release requirements](implementation-plan.md)
- [Native input requirements](input-samples.md)
- [Native export data and adapter](native-export-inspection.md)
- [Public tool/API research](native-tool-research.md)
- [Pinned reference and dependencies](reference-status.md)
- [Repository and release hygiene](version-control.md)

## Project records and licenses

- [Verification record](verification.md): actual evidence and unresolved limits, separate from requirements.
- [Execution contract](execution-contract.md): project execution scope.
- [Apache-2.0 license](../LICENSE), [project NOTICE](../NOTICE) and [third-party notices](../THIRD_PARTY_NOTICES.md): original project terms do not grant vendor-viewer, board or model rights.

0.2.0 has passed local software verification, not physical-camera validation. Generated HTML and private native exports are not supplied by the source repository.

Current `main` uses Apache-2.0 for original project code/docs; `v0.2.0` remains its historical MIT snapshot. License-change build/notice verification is separate from the recorded software results. GitHub Release publication is paused; no new version/tag is assumed.
