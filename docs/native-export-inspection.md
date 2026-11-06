# Native export data and selection adapter

These notes summarize prior **static source inspection** of the supplied export family. Reading code as data is not proof of runtime selection, camera operation or compatibility with other export versions. Runtime evidence is maintained separately in [verification.md](verification.md).

**Question:** Which data structures and original selection semantics can be reused without rebuilding the viewer or assuming unverified runtime behavior?

## Sources

| ID | Source | Stable locator |
| --- | --- | --- |
| H1 | Private native export; generic example `input/board.html`, not distributed | `window.files`, `window.__ENGING_OBJ_PRELOAD__`, BOM row handlers |
| H2 | [Design requirements](implementation-plan.md) | Selection contract |
| H3 | [Pinned bag-bom source](https://github.com/egethropic/bag-bom/tree/1fc1e0b2abd8b023ba01e6000c4110d72d94860c) | `bag_bom/web/barcodes.js`: `parse` / `match` |
| H4 | Same pinned source | `bag_bom/web/barcode-worker.js` |

Private filenames, specimen hashes, record counts and geometry are intentionally excluded from this public summary.

Research snapshot / `retrieved_at`: **2026-11-06**. Source types: H1 is a private local artifact with its exact path/fingerprint intentionally redacted; H2 is a project design document; H3/H4 are repository source at the public commit linked above. `version_or_date`: the H1 client build is unknown; H2 is a living design note, not a vendor specification; H3/H4 use the pinned commit. No new artifact execution is implied.

## Findings

### Data extraction

**VERIFIED — prior static data inspection (H1):** decode input as strict UTF-8 and extract the first JSON value assigned to `window.files`, before `window.__ENGING_OBJ_PRELOAD__`. Do not evaluate the HTML/JavaScript or parse the remaining script as JSON.

The format contains nested JSON in `bom_merge`, including `check_info`, `comp_info` and `designator_info`. The `web` preview payload is **JSON-lines**, not a single whole-document JSON value. Read supplier and manufacturer identities only from explicit verified fields; do not infer MPNs from value/package text or truncate unknown composite keys.

`deviceUuid` is a **shared library identifier**, not a unique placement identifier. Placement indexing uses board/side/`pick_index` together with the designator; repeated use of a library component must not collapse distinct placements.

### Original selection semantics

**VERIFIED — prior handler source inspection (H1):** original BOM row single-click handlers are distinct from double-click handling. Original single-click can already center or flip the view. Preserve this baseline rather than assuming that a single-click never moves the view.

The adapter matches the exact complete original row/reference set and dispatches the original row click. Internal/minified handlers are version-fragile, not a public client-selection API. Do not guess private messages, select by fuzzy row text, click soldered checkboxes or simulate a series of clicks as if they accumulated a full selection.

Reject mixed/conflicting/missing identities, hidden or incomplete targets and unsupported multi-row selections. If a new selection fails, the original highlight may remain; report that explicitly.

### Runtime, progress and rights

- **UNVERIFIED outside separately recorded runtime evidence:** execution of the full original-viewer selection path, different export versions and physical-camera behavior. Static source intent is not a runtime pass.
- **UNVERIFIED:** client progress synchronization and cross-session soldering-progress behavior. No new persistence guarantee is introduced.
- **VERIFIED — source packaging inspection (H1, H4):** native exports contain executable viewer/model material; the decoder reference uses Worker/WASM. Packaging alone does not prove offline execution or camera permission.
- **UNVERIFIED:** public redistribution rights for the vendor viewer. Original project MIT licensing and upstream notices do not grant those rights.

Only enhance trusted exports. Data-only extraction does not make the resulting executable viewer safe to open if its source is untrusted. See [usage](usage.md), [reference terms](reference-status.md) and [research boundaries](native-tool-research.md).

## Constraints, recommendation and confidence

Private source redaction limits independent reproduction of the original inspection; property/handler locators identify the inspected structure without publishing board content. The internal handler layout is version-fragile, and camera/progress/rights questions require separate evidence. Reuse only the exact validated original row interaction, then verify the derived viewer against a manual-click baseline before accepting an export family.

**Confidence:** high for the stated structures in the inspected artifact; no extrapolation to unseen exports, physical cameras or unestablished distribution rights.
