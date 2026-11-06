# Verification record

## Release boundary

**v0.1.0 is the verified baseline**, subsequently pushed with its source/tag without force. The results below belong to that baseline, not to the current **0.2.0 development target**.

**0.2.0 core and UI integration remain pending.** No final pass, newly verified generated output or release readiness is established here for plaintext diagnostics or revised same-code rearming. Update this record only after actual affected checks, integration and rebuilding. See [development requirements](implementation-plan.md) and [scan diagnostics](scan-diagnostics.md).

## Baseline configuration and evidence types

- Recorded runtime: **Node 24.22.2**, **pnpm 11.18.0**; dependencies fixed by the project lockfile.
- Read-only bag-bom reference: <https://github.com/egethropic/bag-bom>, public commit `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`.
- Decoder: **ZXing-WASM 3.1.6**, with inline reader JS/WASM and Blob Worker; robust options and valid/non-segmented filtering retained.
- Browser verification used generated derived HTML in isolated automation with network blocking and synthetic media. The original export was not executed directly, and no physical camera or EDA-client operation was performed.

Source inspection, deterministic tests, generated-viewer execution and synthetic-media execution are distinct evidence types. None alone establishes physical-label recognition. Private specimen identities, filenames, fingerprints, reference mappings and image artifacts are not reproduced in this public record.

## VERIFIED — recorded v0.1.0 software results

| Check | Recorded result and scope |
| --- | --- |
| Type checking | `pnpm typecheck` completed successfully. |
| Unit/contract tests | **32/32 passed**, including **14 camera lifecycle/scheduling tests**. Coverage included exact identity/conflict handling, stale sessions, row adaptation, source preservation and all four output-target alias checks. |
| Focused UI checks | Previously passing scanner/enhancer UI evidence was reused where UI/contracts were unchanged. This is not evidence for the new 0.2.0 UI. |
| Local build | Completed successfully for the baseline; original input preservation was checked. This does not establish any new 0.2.0 output. |
| Derived-viewer browser checks | **9 checks passed** on the generated viewer in isolated browser automation with network blocking. |
| Lifecycle refinements | **4 checks passed**, covering active-media state, Stop cleanup and cancellation of a pending original selection callback. |
| Synthetic-media integration | Synthetic video frames passed through the **actual inline Worker/WASM decoder to the original viewer**. This was not merely an injected decoder result. |

### Original viewer and safety invariants

**VERIFIED — baseline generated-viewer runtime checks:** exact-identity selection was compared with original manual row single-click behavior. The complete aggregated target set and original viewer response agreed; unsupported multi-reference selection in non-aggregated mode and hidden targets were rejected rather than partially selected.

Original manual interaction took priority and cancelled a pending automatic selection callback. This establishes cancellation in the tested pending-callback case, not reversal of an already executed native selection. Soldered checkbox state remained unchanged; the enhancement did not substitute checkbox, double-click or modifier-key actions for the original single-click.

**VERIFIED — baseline build/download and isolated-browser checks:** original source preservation, local enhancement/download/reopening, embedded Worker/WASM operation, offline execution and blocking of tested background network requests were checked. These are observed results for the tested export family, not a universal security or compatibility guarantee.

**VERIFIED — synthetic lifecycle checks:** independent frames were used for confirmation; only one decoding task was in flight, and stop/page lifecycle cleanup released synthetic media resources. Permission/UI and physical device behavior were not thereby tested.

## Performance evidence boundary

Prior synthetic benchmarking retained complete expected results for **40/40** measured cases with the full-detail robust decoder. Higher-detail frames increased single-frame work; retained detail and removal of fixed idle waiting are not proof that every frame is faster. No physical-camera A/B or real-label recognition-rate claim follows. See [performance notes](scanner-performance.md).

## UNVERIFIED — physical use and broader compatibility

- Actual physical cameras and labels, browser permission UI, autofocus, reflections, wrinkles, physical disconnection and real-world timing/recognition rates.
- Actual bottom-side viewer behavior; synthetic contracts do not establish real bottom-side operation.
- New export versions, blanket V4 compatibility, other browser/layout families and all real-world label/format combinations.
- Soldering-progress save/reopen behavior and client synchronization. No new persistence is promised.
- Public redistribution permission for vendor viewer code, board data and models. The project's MIT license does not grant these rights.
- Final 0.2.0 core/UI integration, diagnostics/copy fallback, repeat rearming, rebuilt outputs and affected regression results.

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
