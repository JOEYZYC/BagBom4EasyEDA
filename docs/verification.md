# Verification record

## Release boundary

**0.2.0 passed local software verification on 2026-11-06**, including plaintext diagnostics, same-code rearming and rebuilt HTML. This is not a claim of physical-camera performance or successful remote publication.

The earlier v0.1.0 baseline had 32 unit/contract tests, 9 generated-viewer checks and 4 lifecycle refinements, and its source/tag was pushed without force. The current results below were established for 0.2.0 rather than inferred from that baseline. See [development requirements](implementation-plan.md) and [scan diagnostics](scan-diagnostics.md).

The historical `v0.2.0` tag retains its MIT license snapshot. The `v0.2.1` patch packages the verified runtime under Apache-2.0 without rewriting that tag or history. The original software results below predate license-change validation; separate Apache-2.0 packaging evidence is recorded below. Release publication must be verified on GitHub rather than inferred from local checks.

## Configuration and evidence types

- Recorded runtime: **Node 24.22.2**, **pnpm 11.18.0**; dependencies fixed by the project lockfile.
- Read-only bag-bom reference: <https://github.com/egethropic/bag-bom>, public commit `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`.
- Decoder: **ZXing-WASM 3.1.6**, with inline reader JS/WASM and Blob Worker; robust options and valid/non-segmented filtering retained.
- Browser verification used generated derived HTML in isolated automation with network blocking and synthetic media. The original export was not executed directly, and no physical camera or EDA-client operation was performed.

Source inspection, deterministic tests, generated-viewer execution and synthetic-media execution are distinct evidence types. None alone establishes physical-label recognition. Private specimen identities, filenames, fingerprints, reference mappings and image artifacts are not reproduced in this public record.

## VERIFIED — 0.2.0 software results

| Check | Recorded result and scope |
| --- | --- |
| Type checking | `pnpm typecheck` completed successfully. |
| Unit/contract tests | **48/48 passed**, including **14 camera lifecycle/scheduling tests** and **16 repeat-state/text tests**. Exact identity/conflict handling, stale sessions, row adaptation, source preservation and all four output-target alias checks remain covered. |
| Focused UI checks | `pnpm test:ui` passed for scanner/enhancer actions, nine diagnostic states, literal hostile text, selection/scroll stability, copy success and unavailable/denied fallback, responsive bounds and cleanup. This evidence remains valid through the final controller-only fix because UI/contracts did not change. |
| Local build | The recorded 0.2.0 enhancer and enhanced viewer were rebuilt; original input preservation was checked. That historical build embedded the then-current project MIT license and applicable upstream license/NOTICE text. This does not verify an Apache-2.0 license-change build. |
| Derived-viewer browser checks | **13 checks passed** on the generated viewer in isolated browser automation with network blocking and no page errors. |
| Lifecycle refinements | **4 checks passed**, covering active-media state, Stop cleanup and cancellation of a pending original selection callback. |
| Synthetic-media integration | Synthetic video frames passed through the **actual inline Worker/WASM decoder to the original viewer**. A separate media check confirmed distinct frames, one job in flight and cleanup, with zero physical-camera calls. No successful decode or native receipt was fabricated. |
| Independent source review | Diagnostic/state changes were reviewed. A reselect/display-target mismatch was reproduced on the old build, corrected and covered by the final browser checks; the focused source recheck found it resolved. Source review is not runtime evidence. |

### Original viewer and safety invariants

**VERIFIED — generated-viewer runtime checks:** exact-identity selection was compared with original manual row single-click behavior. The complete aggregated target set, observed native selection/centering calls and engine-canvas image agreed; unsupported multi-reference selection in non-aggregated mode and hidden targets were rejected rather than partially selected.

Original manual interaction took priority and cancelled a pending automatic selection callback. This establishes cancellation in the tested pending-callback case, not reversal of an already executed native selection. Soldered checkbox state remained unchanged; the enhancement did not substitute checkbox, double-click or modifier-key actions for the original single-click.

**VERIFIED — build/download and isolated-browser checks:** original source preservation, local enhancement/download/reopening, embedded Worker/WASM operation, offline execution and blocking of tested background network requests were checked. Protected inputs and the pinned reference remained unchanged. These are observed results for the tested export family, not a universal security or compatibility guarantee.

**VERIFIED — synthetic lifecycle checks:** independent frames were used for confirmation; only one decoding task was in flight, and stop/page lifecycle cleanup released synthetic media resources. Permission/UI and physical device behavior were not thereby tested.

### Diagnostics and repeat-state regressions

**VERIFIED — deterministic tests and generated-viewer synthetic-media checks:**

- Raw text, confirmation, rejection and repeat suppression remain distinct; counters advance even when identical text is coalesced. Hostile payloads remain literal, and display truncation never changes matching input. The existing generic non-BOM main warning is unchanged.
- Continuous confirmed codes do not repeatedly select. At least two fresh empty decoded frames spanning one second rearm the same code; explicit Start also rearms it. Conflicting/unmatched payloads do not count as absence. Failed attempts do not permanently poison eligibility.
- Exactly two actual decoded valid frames followed by an empty decoded frame before the native callback still select the qualified target. Its receipt is target-correlated while the latest no-code diagnostic remains unchanged.
- Confirmed target A followed by one actual decoded frame of B displays B but disables reselect. A forced UI click leaves native selection, soldered checks and the live synthetic stream unchanged; a second B confirmation cannot mask this test boundary.
- Native manual action still stops scanning, and no implicit resumption occurs. Stop/page lifecycle cleanup and stale-receipt guards remain effective.

The final controller fix justified repeating type/unit/build/generated-viewer/refinement checks. Unchanged UI and separate camera-media evidence was reused rather than rerun without a cause. Private runtime reports stay in ignored local test artifacts, not public documentation.

## Performance evidence boundary

Prior synthetic benchmarking retained complete expected results for **40/40** measured cases with the full-detail robust decoder. Higher-detail frames increased single-frame work; retained detail and removal of fixed idle waiting are not proof that every frame is faster. No physical-camera A/B or real-label recognition-rate claim follows. See [performance notes](scanner-performance.md).

## UNVERIFIED — physical use and broader compatibility

- Actual physical cameras and labels, browser permission UI, autofocus, reflections, wrinkles, physical disconnection and real-world timing/recognition rates.
- Actual bottom-side viewer behavior; synthetic contracts do not establish real bottom-side operation.
- New export versions, blanket V4 compatibility, other browser/layout families and all real-world label/format combinations.
- Soldering-progress save/reopen behavior and client synchronization. No new persistence is promised.
- Public redistribution permission for vendor viewer code, board data and models. The project's Apache-2.0 license does not grant these rights.

## VERIFIED — Apache-2.0 packaging

The root [Apache-2.0 LICENSE](../LICENSE) was checked against the standard text, and a project [NOTICE](../NOTICE) was added. Package metadata and the build's project-license heading now use Apache-2.0. Third-party MIT/NCSA/public-domain terms remain unchanged.

**VERIFIED — fresh build/runtime checks after the license change:** build-script syntax, `pnpm build` and all **13 generated-viewer browser checks** passed. A focused isolated-browser check inspected both rebuilt files' actual notice disclosures and found all **eight complete project/upstream license or NOTICE texts** in each, with no old project-MIT heading, page errors, external requests or physical-camera calls. Source preservation remained intact.

Only license metadata, notice packaging and documentation changed; unchanged type/unit/UI/camera/refinement evidence above was reused. This packaging verification is separate from the historical MIT-tag build and does not establish new physical-camera performance.

For `v0.2.1`, release preparation changes package version and public documentation, not scanner algorithms or notice inputs. A fresh build reproduced the exact validated Apache-2.0 tool and notices hashes, so the unchanged runtime evidence was reused. Verify the remote tag, attachment allowlist, uploaded sizes/digests and final publication state separately. Never attach these assets to the historical MIT `v0.2.0` tag.

## Reproducing checks

Prepare the [pinned reference/dependencies](reference-status.md) and a trusted compatible native export separately. Generic build example:

```sh
pnpm install --frozen-lockfile
pnpm exec node scripts/build.mjs input/board.html
```

Relevant check commands:

```sh
pnpm typecheck
pnpm test
pnpm test:ui
pnpm test:browser
pnpm exec node tests/scanner-media-check.mjs
pnpm exec node scripts/browser-check.mjs --refinement
```

These instructions are not fresh execution evidence. Some scripts retain local fixture defaults: full integration requires separately prepared untracked compatible exports/fixture configuration, installed Chrome/Edge and isolated automation with real camera access blocked. Git does not include those private inputs or generated HTML. Source-path/realpath/file-identity preflight and preservation checks do not protect against external concurrent path changes.
