# Repository and release hygiene

Repository: <https://github.com/JOEYZYC/BagBom4EasyEDA>.

## Release boundary

The **0.1.0 baseline** was verified and pushed without force. **0.2.0 has passed local software verification**, including plaintext diagnostics, same-code rearming and rebuilt HTML. Local verification, commits and tags do not establish remote publication; confirm that separately. See [verification](verification.md) and [design requirements](implementation-plan.md).

## Tracked and local-only material

Track original project source, tests, build scripts, dependency locks, documentation and applicable license/notices. Keep these local and untracked:

- `input/`: trusted native board exports.
- `output/`: generated enhancer/viewer HTML and other build output.
- `references/`: separately prepared pinned upstream checkout.
- `node_modules/`, `tests/.generated/` and `.env`.

A source checkout does not restore private exports, integration fixtures or generated HTML. Full integration testing needs separate compatible exports/fixture configuration. Vendor viewer/board/model rights are not granted by MIT; generated viewer HTML must not be published.

## Review before committing or publishing

1. Review actual changes and the staged filenames; exclude private HTML, screenshots, raw diagnostics and local configuration.
2. Check affected software separately from prose. Record actual evidence and remaining limits before assigning a release tag.
3. Preserve upstream copyright, license and modification notices. Project MIT licensing does not relicense third-party material.
4. Publish only reviewed source/docs and authorized release metadata, using non-forced operations. Do not overwrite unrelated remote work or invent earlier history.

Useful read-only review commands:

```sh
git status --short
git diff
git diff --cached --stat
git diff --cached --name-only
git log --oneline --decorate
git tag --list
```

Rewriting current documentation **does not remove data from older Git history**; any historical cleanup requires a separate, explicitly authorized decision.
