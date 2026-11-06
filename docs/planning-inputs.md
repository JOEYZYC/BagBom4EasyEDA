# Product requirements and scope

## Purpose

Add local barcode input to the original LCEDA / EasyEDA Pro soldering-assistance **exported HTML**, preserving its BOM-to-board interaction, 3D/2D views and manual soldering workflow. This is an independent browser enhancement, not a client extension, official API integration, ordinary PCB-editor highlighter or rebuilt iBOM.

## Required inputs

- A trusted, untouched compatible native offline HTML export, such as `input/board.html`.
- Complete supplier C-codes or verified complete MPNs in the original BOM; missing identity requires manual selection.
- Desktop Chrome/Edge with browser-controlled camera permission for physical use. Local-file camera support depends on runtime policy; no security bypass is prescribed.
- For source builds, Node 24, pnpm 11.18.0 and the [pinned read-only reference checkout](reference-status.md).

## Non-negotiable behavior

- Match exact complete identity and the complete original row/reference set. Reject ambiguity, conflict, incomplete or mixed sets, hidden rows and unsupported multi-row selection.
- Reuse the original single-click, including any existing centering/side flip; do not guess private RPCs or replace the viewer.
- Keep original files and design data unchanged. Do not auto-mark soldered state, add progress persistence or promise client synchronization.
- Camera starts only on explicit user action; manual native interaction pauses it. Stop releases it; folding does not.
- Decode locally without OCR, cloud lookup, frame uploads or fuzzy value/package matching.
- Treat a failed new selection separately from old highlighting, which may remain visible.
- Read source HTML as data without execution during enhancement; require trust because generated HTML retains the executable vendor viewer.

## Current software version

**0.2.0 passed local software verification** for bounded in-memory plaintext diagnostics and repeat rearming without changing identity or original-selection safety rules. Physical recognition and remote publication are separate claims. See [design requirements](implementation-plan.md), [scan diagnostics](scan-diagnostics.md) and the [verification record](verification.md).

## Compatibility and rights

Support is limited to the supplied export family, not a blanket claim for V4 or every EasyEDA version. Prior bounded public-document research found no supported native-client viewer row-selection API; that is not proof no such API exists. See [research notes](native-tool-research.md).

Original project code/docs on current `main` are Apache-2.0 licensed. Upstream and vendor terms remain separate; the project license does not grant board/model/viewer rights or establish public redistribution permission. Do not publish generated viewer files. See [LICENSE](../LICENSE), [NOTICE](../NOTICE) and [third-party notices](../THIRD_PARTY_NOTICES.md).
