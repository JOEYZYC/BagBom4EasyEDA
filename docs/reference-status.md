# Reference source and dependency attribution

## Pinned reference

- Upstream: <https://github.com/egethropic/bag-bom>
- Read-only location: `references/bag-bom`
- Pinned public commit: `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`
- License: **Apache-2.0**. Upstream copyright, attribution and modification notices remain separate even though current BagBom4EasyEDA code/docs also use Apache-2.0.

**VERIFIED — recorded source/provenance inspection:** the reference was checked against this public origin and commit. This record is not a live checkout audit or an upstream runtime result.

The source build requires this reference checkout; the main repository does not include it. If absent, developers may prepare it with:

```sh
git clone https://github.com/egethropic/bag-bom.git references/bag-bom
git -C references/bag-bom checkout --detach 1fc1e0b2abd8b023ba01e6000c4110d72d94860c
```

Keep it unchanged. Reference source is not an installed runtime or a ready-made LCEDA viewer; its iBOM selection adapter cannot simply substitute for the original exported viewer's row-click adapter.

Useful pinned-source locators:

- `references/bag-bom/bag_bom/web/barcodes.js`: `parse` / `match`, supplier payload and exact-identity handling.
- `references/bag-bom/bag_bom/web/matcher.js`: `buildIndex` / `match`, identity indexing.
- `references/bag-bom/bag_bom/web/scanner.js`: selection/lifecycle reference, requiring platform-specific adaptation.
- `references/bag-bom/bag_bom/web/barcode-worker.js`: decoder-worker reference.

## Notices and licensing boundary

Retain applicable bag-bom Apache copyright, license and adapted-worker modification notices. The pinned decoder is **ZXing-WASM 3.1.6**; relevant dependency terms include zxing-wasm (MIT), ZXing-C++ (Apache-2.0), stb (MIT/public domain) and Emscripten (MIT/NCSA).

See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for the authoritative notice inventory and the root [Apache-2.0 LICENSE](../LICENSE) and [project NOTICE](../NOTICE) for original BagBom4EasyEDA material. These do not change upstream licenses or grant rights to vendor viewer code, board data or models. Public redistribution of generated viewer HTML has not been established; keep it local rather than publishing it.
