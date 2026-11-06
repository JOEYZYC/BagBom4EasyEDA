# Authorized development and safety scope

## Product scope

Develop an independent, local browser enhancement for the original LCEDA / EasyEDA Pro soldering-assistance offline HTML export. Preserve the original BOM, 3D/2D viewer and manual soldering workflow. Generate a reusable local enhancer and new enhanced copies without overwriting original exports.

This is not a client extension, official API integration, PCB-editor highlighter or rebuilt iBOM. Compatibility is limited to the supplied export family; no blanket V4 guarantee is authorized. See [requirements](planning-inputs.md) and [design](implementation-plan.md).

## Permitted development and verification

- Maintain project source, dependency locks, focused tests, build scripts, documentation and applicable license/notices.
- Read trusted native exports as data without evaluating their scripts during extraction. Keep originals unchanged; generated files belong in separate local output paths.
- Use the read-only `references/bag-bom` checkout from <https://github.com/egethropic/bag-bom>, pinned to `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`. Preserve upstream files and notices.
- Run project-local builds, unit/contract/UI checks and isolated software-only browser checks on generated copies. Block tested-viewer network access and use synthetic media, not a physical camera.
- Optimize bounded capture/scheduling without weakening exact identity checks, supported formats, two-independent-frame confirmation, stale-result guards or manual priority. Preserve the existing generic non-BOM warning.

Build preflight must check all four output targets for source-path, realpath and file-identity aliases before writes, with a source-preservation hash check. External concurrent changes to paths or links are outside this guarantee.

## Selection, privacy and hardware boundaries

- Match complete supplier C-codes or verified complete MPNs to the exact full original row/reference set. Reject mixed, conflicting, missing or incomplete identities, hidden targets and unsupported multi-row selection.
- Dispatch the original single-click, preserving any existing centering/side flip. Do not guess private RPCs, rebuild the viewer, modify design data or automatically mark soldered/placed state.
- Native manual interaction takes priority and pauses the camera. Stop releases it; folding does not.
- Physical camera access remains user-controlled through an explicit Start action and browser permission. Software verification does not authorize physical-camera or EDA-client operation.
- No OCR, cloud lookup, frame upload, persistent diagnostic history, new progress persistence or client-progress synchronization.
- Do not modify installed applications, global workstation/credential settings, protected originals or the reference checkout. Do not move/delete private files or perform unrelated cleanup.

The enhancer does not execute selected input during extraction, but generated HTML retains the executable vendor viewer. Only trusted exports are suitable. Project MIT licensing does not grant viewer, board or model rights; public vendor-viewer redistribution has not been established. Do not publish generated viewer HTML.

## 0.2.0 diagnostics and repeat-state authorization

Implement bounded in-memory plaintext diagnostics with raw decoded payloads, frame counts and distinct no-code, confirmation, rejection, repeat-suppression and native-outcome states. Use safe text rendering and user-triggered copying with a manual fallback; do not save images, upload logs or persist history.

Replace session-lifetime repeat prohibition with presence-based rearming: suppress a continuously visible confirmed code; rearm after at least **one second and two fresh empty frames**, or explicit camera Start/device restart. Conflicting, unmatched and error results are not absence. Failed/cancelled/unconfirmed native selection must not become permanently seen; retries must be bounded.

Core/UI integration, rebuilding and affected software checks have now been reconciled for 0.2.0; their actual results and physical-use limits are recorded in [verification](verification.md). That local evidence does not establish remote publication. Preserve these validation gates for later changes. See [diagnostics](scan-diagnostics.md).

## Publication and repository authorization

The user requested **MIT licensing for original project code/docs**, a professional de-identified documentation set and **bilingual README files with English as the default**, linked reciprocally. Retain upstream attribution, copyright, license and modification notices; include the project's MIT notice in generated notices without relicensing third-party/vendor material.

Remove absolute machine/install/user paths, personal information, private board/sample filenames, specimen fingerprints, board-content identifiers and internal operational transcripts from public Markdown. Use generic repository-relative examples such as `input/board.html`. Documentation redaction does not erase older Git history; history rewriting requires separate explicit authorization.

Authorized publication is a **non-forced push of validated source commits and milestone tags** to <https://github.com/JOEYZYC/BagBom4EasyEDA>. Review staged scope and applicable evidence first; verify ambiguous remote outcomes before retrying. Do not overwrite remote history or change credentials/global configuration.

Keep `input/`, `output/`, `references/`, `node_modules/`, `tests/.generated/` and `.env` untracked. Exclusion from Git does not authorize deletion. Do not publish raw/derived viewer HTML, board/model data, images or runtime diagnostic payloads. See [repository hygiene](version-control.md), [LICENSE](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.md).
