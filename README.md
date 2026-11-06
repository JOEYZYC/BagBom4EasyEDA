# BagBom4EasyEDA

**English** | [简体中文](README.zh-CN.md)

Local barcode scanning for the original **LCEDA / EasyEDA Pro soldering-assistance BOM HTML export**. Keep the original BOM, 3D/2D viewer and manual soldering workflow; use an exact decoded part identity to trigger the original BOM-row single-click.

This is an independent browser enhancement—not a client extension, official API integration or rebuilt iBOM. Repository: <https://github.com/JOEYZYC/BagBom4EasyEDA>.

## Status

**0.2.0 has passed local software verification**, including bounded plaintext scan diagnostics, copying with a manual fallback, and same-code rearming. Physical-label recognition and camera permissions still require testing on your own setup. See [diagnostics](docs/scan-diagnostics.md) and the [verification record](docs/verification.md).

## Use locally built files

Generated HTML and the original vendor viewer are **not included in the Git repository or a source checkout**. Prepare a compatible native export and build locally as described below, or use files you have already built locally.

1. In LCEDA PCB, choose **Tools → Soldering Assistance → Export → Offline HTML** (`工具 → 焊接辅助工具 → 导出 → 离线Html`).
2. Open the locally built `output/html-enhancer.html` in desktop Chrome or Edge.
3. Choose a **trusted, untouched native HTML export**, such as `input/board.html`—not CSV, XLSX or an already enhanced file.
4. Download a new `*_扫码版.html` and open it. Do not overwrite the original.
5. Use aggregated BOM mode (`位号聚合`), clear search/visibility filters, and manually verify a complete supplier C-code from your own BOM before scanning.
6. Click **Start camera** and grant permission. Check the full matched reference set and the original viewer response.

Using built files needs **no Node.js, server or CDN**. Camera access from a local file depends on the browser runtime and permission; do not bypass browser security. **Stop** releases the camera; folding the panel does not stop it. Native manual interaction pauses scanning. For a new build, close old tabs and reopen the new file; regenerate other boards from their untouched originals with the new enhancer.

More: [usage](docs/usage.md) · [documentation index](docs/README.md).

## Exact matching and safety

- Match a complete supplier C-code or verified complete MPN to the complete original row/reference set. No fuzzy matching, value/package guesses, OCR, cloud lookup or automatic soldered-state marking.
- Reject mixed, conflicting, incomplete or missing identities, hidden targets and unsupported multi-row selections rather than select a subset. A previous highlight may remain after rejection; it is not a new success.
- Preserve the original single-click behavior, including any original centering or side flip. Do not promise client integration, progress synchronization or new progress persistence.
- The enhancer reads input as data without executing it. **The generated file still contains the executable vendor viewer: use only trusted exports.** Compatibility is limited to the supplied export family, not all V4 exports.
- Scanning and decoding are local. Diagnostics keep bounded plaintext in memory, not images, uploaded logs or persistent scan history. Wrinkles, reflections and occlusion can still prevent decoding.

## Development

Package: `bagbom4easyeda`. Use **Node 24** and **pnpm 11.18.0**.

The source build requires a read-only reference checkout at `references/bag-bom`, pinned to public upstream commit `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`. Optional setup commands, if that checkout is not already present:

```sh
git clone https://github.com/egethropic/bag-bom.git references/bag-bom
git -C references/bag-bom checkout --detach 1fc1e0b2abd8b023ba01e6000c4110d72d94860c
```

Keep the reference checkout unchanged. After separately preparing a compatible export at `input/board.html`:

```sh
pnpm install --frozen-lockfile
pnpm exec node scripts/build.mjs input/board.html
```

Relevant checks (fixture prerequisites below; commands are not pass claims):

```sh
pnpm typecheck
pnpm test
pnpm test:ui
pnpm test:browser
pnpm exec node tests/scanner-media-check.mjs
pnpm exec node scripts/browser-check.mjs --refinement
```

Full integration tests require separately prepared, untracked compatible native exports/fixture configuration, installed Chrome/Edge and isolated automation. Some scripts retain local fixture defaults; a fresh checkout is not a ready-to-run integration fixture set. Automated media checks use synthetic media, with real camera access blocked.

`input/`, `output/`, `references/`, `node_modules/`, `tests/.generated/` and `.env` are ignored and not included in Git. Build preflight checks all four output targets for source-path, realpath and file-identity aliasing before writes, with a source-preservation hash check. Concurrent external path changes are outside that guarantee. See [input requirements](docs/input-samples.md) and [reference/dependency notes](docs/reference-status.md).

## License and attribution

Original project code and documentation are **MIT licensed**; see [LICENSE](LICENSE). This does not relicense third-party or vendor material.

The project draws on [egethropic/bag-bom](https://github.com/egethropic/bag-bom) (Apache-2.0); applicable copyright and modification notices for the adapted decoder worker are retained. Decoder dependencies include zxing-wasm (MIT), ZXing-C++ (Apache-2.0), stb (MIT/public domain) and Emscripten (MIT/NCSA). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

MIT does **not** grant rights to the vendor viewer, board data or models. Public redistribution of the vendor viewer has not been established; do not publish generated viewer HTML.
