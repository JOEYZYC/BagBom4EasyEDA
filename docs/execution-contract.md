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

The enhancer does not execute selected input during extraction, but generated HTML retains the executable vendor viewer. Only trusted exports are suitable. Project Apache-2.0 licensing does not grant viewer, board or model rights; public vendor-viewer redistribution has not been established. Do not publish generated viewer HTML.

## 0.2.0 diagnostics and repeat-state authorization

Implement bounded in-memory plaintext diagnostics with raw decoded payloads, frame counts and distinct no-code, confirmation, rejection, repeat-suppression and native-outcome states. Use safe text rendering and user-triggered copying with a manual fallback; do not save images, upload logs or persist history.

Replace session-lifetime repeat prohibition with presence-based rearming: suppress a continuously visible confirmed code; rearm after at least **one second and two fresh empty frames**, or explicit camera Start/device restart. Conflicting, unmatched and error results are not absence. Failed/cancelled/unconfirmed native selection must not become permanently seen; retries must be bounded.

Core/UI integration, rebuilding and affected software checks have now been reconciled for 0.2.0; their actual results and physical-use limits are recorded in [verification](verification.md). That local evidence does not establish remote publication. Preserve these validation gates for later changes. See [diagnostics](scan-diagnostics.md).

## Native-aligned UI redesign

The user requests a UI and interaction redesign that is at least consistent with
the original viewer's style. This authorizes local presentation changes to the
scanner panel and standalone generator, with focused tests and regenerated local
outputs. Publication was initially outside that UI-only scope; subsequent user
authorization is recorded below.

Use the trusted generated viewer as the visual reference in isolated software-only
checks; keep original exports and reference sources unchanged. Preserve Shadow DOM
isolation and access to the native toolbar, BOM and viewer. Retain explicit camera
Start, visible active-camera state and Stop when folded, manual priority, accurate
native-selection outcomes, safe raw-text/copy fallback, and the unchanged generic
non-BOM warning. No scanner algorithm, identity rule, media ownership, progress
persistence or soldered-state behavior changes are part of this redesign.

The subsequent user refinement consolidates Start and Stop into one stateful
camera control, removes the enhancement's duplicate C-code form, and places the
active preview first in the expanded sidebar content. Manual search/selection
continues through the original viewer. Removing the obsolete form action and
updating affected guidance and regression-test entry points is in scope; adding
production test hooks or weakening selection/cancellation checks is not. Camera
restart is explicit Stop followed by Start, not an additional simultaneous action.

Verification ownership: the UI implementation lane checks presentation callbacks,
disclosures, keyboard/focus behavior, contrast and narrow/short viewport bounds.
After reconciling the UI changes, integration verification checks the rebuilt
generator and enhanced viewer, original-source preservation and the existing
generated-viewer regressions. Screenshots and private runtime evidence remain
local and untracked. These planned checks are not completed verification evidence.

## Publication and repository authorization

The user requested **Apache-2.0 licensing for original project code/docs**, superseding the earlier project-license choice, while retaining professional de-identified documentation and **bilingual README files with English as the default**, linked reciprocally. Retain upstream attribution, copyright, license and modification notices. Generated assets must embed the full root Apache-2.0 LICENSE and project NOTICE alongside complete applicable upstream notices, without relicensing third-party/vendor material. The license-change rebuild and notice verification are separate from the recorded 0.2.0 software results.

Remove absolute machine/install/user paths, personal information, private board/sample filenames, specimen fingerprints, board-content identifiers and internal operational transcripts from public Markdown. Use generic repository-relative examples such as `input/board.html`. Documentation redaction does not erase older Git history; history rewriting requires separate explicit authorization.

The user now authorizes **pushing the current UI changes and publishing a GitHub
Release** at <https://github.com/JOEYZYC/BagBom4EasyEDA>. Use a new `v0.3.0` tag and
matching package metadata for the native-aligned UI and interaction update.
Preserve `v0.2.1`, the historical MIT `v0.2.0` tag and all existing history.
Authorized operations include the reviewed source/version commit, non-forced
main/tag push, draft creation, attachment verification and publication. This
release does not change capture resolution, frame scheduling or decoder settings.

The exact attachment allowlist is `html-enhancer.html`, `LICENSE`, `NOTICE` and `THIRD_PARTY_NOTICES.txt`. The tool must contain no vendor viewer, private export or board data; never attach a generated board/viewer HTML, input, screenshot or runtime payload. Verify uploaded asset identity and publication status. Check ambiguous mutation outcomes before retrying; do not overwrite remote history or change credentials/global configuration.

Keep `input/`, `output/`, `references/`, `node_modules/`, `tests/.generated/` and `.env` untracked. Exclusion from Git does not authorize deletion. Do not publish raw/derived viewer HTML, board/model data, images or runtime diagnostic payloads. See [repository hygiene](version-control.md), [Apache-2.0 license](../LICENSE), [project NOTICE](../NOTICE) and [third-party notices](../THIRD_PARTY_NOTICES.md).
