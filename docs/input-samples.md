# Native HTML input requirements

Prepare a trusted, untouched **LCEDA / EasyEDA Pro soldering-assistance offline HTML export**, for example `input/board.html`. CSV, XLSX and already enhanced HTML are not substitutes. Export through `工具 → 焊接辅助工具 → 导出 → 离线Html`; see [usage](usage.md).

## Private inputs and generated files

- Keep native exports read-only. Do not rename, move or overwrite originals as part of enhancement.
- Keep inputs in untracked `input/` and generated files in untracked `output/`; a generic derived filename is `output/<board>_扫码版.html`.
- Source checkout does not include board exports, the original vendor viewer, generated HTML or a ready-to-run private integration fixture set.
- Full integration tests need separately prepared compatible native exports and fixture configuration. Some scripts retain local fixture defaults; use an explicit input for builds:

```sh
pnpm exec node scripts/build.mjs input/board.html
```

Build preflight checks all four output targets for source-path, realpath and file-identity aliasing before writes, and checks source preservation by hash. Do not change source/output paths or links concurrently; external concurrent path changes are outside the guarantee.

## Evidence limits

**VERIFIED — prior static parsing evidence, summarized without specimen details:** supplied exports in the supported family were readable through the strict data-extraction/indexing path. This does not establish every export version's browser behavior.

Data readability, exact identity availability, original-row selection and camera decoding are separate checks. A decoded label cannot identify a BOM record with no verified matching identity; do not guess from value or package. Static parsing is not runtime proof, and synthetic media is not a physical-camera test. See [data format notes](native-export-inspection.md) and [verification](verification.md).

Do not publish private filenames, specimen hashes, board geometry, component lists, screenshots or raw diagnostic payloads. Repository-relative examples here are placeholders, not bundled fixtures.
