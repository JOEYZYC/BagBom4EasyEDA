# Third-party notices

Original BagBom4EasyEDA code and documentation on current `main` are licensed under [Apache-2.0](LICENSE); see the project [NOTICE](NOTICE). This does not relicense upstream-derived code, third-party dependencies, native viewer assets or user board data. In particular, the adapted decoder worker retains its Apache-2.0 attribution and modification notice.

Generated HTML must embed the full root Apache-2.0 LICENSE and project NOTICE alongside the complete applicable upstream license/NOTICE text. Build evidence is recorded separately in [docs/verification.md](docs/verification.md).

The enhanced viewer retains the entire original LCEDA viewer, data and its existing notices. Its vendor redistribution rights have **not** been established. Generated viewer files are for the user's local use only, not public distribution.

Reused without modification: `matcher.js` and `barcodes.js` from egethropic/bag-bom, commit `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`, Copyright 2026 egethropic, Apache-2.0. Only `Barcodes.match` is called; the fuzzy matcher is not used. `src/decoder-worker.js` adapts that commit's worker to inline WASM and an initialization handshake. No Tesseract/OCR assets are included.

Both HTML artifacts must include full applicable license/NOTICE text through a visible disclosure:

- BagBom4EasyEDA: root Apache-2.0 LICENSE and project NOTICE, in addition to the upstream notices below.
- bag-bom: Apache-2.0 LICENSE and original NOTICE.
- zxing-wasm 3.1.6: MIT, Copyright (c) 2023 Ze-Zheng Wu; reader JS/WASM from the pinned npm package.
- ZXing-C++: Apache-2.0; license supplied by the fixed bag-bom reference (reference records commit `2c3dcfeffa7878950a58c1703c86774a428b0c91`).
- stb image decoder: MIT/public domain; reference license.
- Emscripten runtime: MIT / University of Illinois/NCSA; reference license.

Barcode writing is used only to generate synthetic test fixtures; it is not shipped in either product HTML. esbuild, TypeScript and playwright-core are development tools, not runtime dependencies. Their package license files remain in the project-local dependency installation.

None of these open-source licenses grants rights in the user's board, models, or the vendor's viewer. This is an independent local enhancement, not an official LCEDA feature.
