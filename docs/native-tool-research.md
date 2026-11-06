# Native tool: public evidence and integration boundaries

This is a concise summary of prior public-document/source research, not a new web search or runtime certification. The current product enhances an original exported HTML in a local browser; it does not control the installed LCEDA client.

**Question:** What public evidence supports reusing the original soldering workflow, and does it establish a supported native-client BOM selection interface?

## Sources

Existing source IDs are retained for provenance. Locators identify the relevant page sections or repository files; public repositories below were not all pinned in the original research.

Research snapshot / `retrieved_at`: **2026-11-06**. Source types: S1–S6 and S4a–S4d are official web documentation; S7–S8 and S10–S12 are public repositories. `version_or_date`: documentation pages were unversioned and those repository revisions were not recorded; current content is not reverified by this summary.

| ID | Public source | Locator |
| --- | --- | --- |
| S1 | <https://prodocs.lceda.cn/cn/pcb/tools-soldering-assistance-tool/> | Tool entry, aggregation, soldered checkboxes, list/board interaction |
| S2 | <https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_window.openui.html> | Signature, remarks, example |
| S3 | <https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_window.html> | Class remarks and methods |
| S4 | <https://prodocs.lceda.cn/cn/api/reference/pro-api.html> | API class index |
| S4a | <https://prodocs.lceda.cn/cn/api/reference/pro-api.dmt_pcb.html> | Methods |
| S4b | <https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_tool.html> | Methods |
| S4c | <https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_document.html> | Editor navigation methods |
| S4d | <https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_selectcontrol.html> | Editor selection methods |
| S5 | <https://prodocs.lceda.cn/cn/faq/update-record/> | Tool introduction and HTML export/model fixes |
| S6 | <https://prodocs.lceda.cn/cn/pcb/export-interactive-bom/> | Native export entry points |
| S7 | <https://github.com/easyeda/easyeda-client-cli> | README and command/session documentation |
| S8 | <https://github.com/easyeda/eext-interactive-html-bom> | `docs/architecture.md`, `extension.json` |
| S10 | <https://github.com/easyeda/eext-interactive-bom> | README features |
| S11 | <https://github.com/easyeda/eext-external-tool-integration-demo> | README architecture |
| S12 | <https://github.com/easyeda/easyeda-viewer> | README capabilities |

S9 was private visual context and is not reproduced as public technical evidence.

## Findings

### Original tool and export

**VERIFIED — prior official-document inspection (S1, S6):** the native soldering-assistance workflow includes BOM aggregation, soldered-state controls and board visualization. It can export offline HTML through `工具 → 焊接辅助工具 → 导出 → 离线Html`; the PCB export menu also documents interactive BOM export. Export capability alone does not establish a programmable row-selection interface, camera availability, identical client/export state or redistribution rights.

### Client selection API search

**NOT_FOUND — bounded prior public-document search (S1, S4, S4a–S4d, S5, S7):** no supported API for selecting a specific BOM row in the native client soldering viewer was found in the examined guides, API catalogs, update notes and CLI/public repository documentation. This is **not proof of nonexistence**, and later documentation may change the result.

**VERIFIED — prior API-document inspection (S2, S3):** `sys_Window.openUI` is described as non-public and subject to breaking changes. It is not a proven native viewer row-selection contract. A returned promise or absence of an exception does not establish that a target was opened or selected.

**VERIFIED — prior API-document inspection (S4c, S4d):** PCB-editor navigation and selection methods belong to the editor API. **UNVERIFIED:** their ability to control the native soldering viewer. Editor highlighting is not an equivalent implementation of this project's original-viewer workflow.

### Alternatives and runtime limits

**VERIFIED — prior repository inspection (S8, S10–S12):** separately implemented interactive BOM/viewer or external-tool examples are distinct integration approaches, not evidence of a supported hook in the original soldering viewer.

**UNVERIFIED by this research:** camera permissions, usable frames, Blob Worker/WASM operation, cross-session welding progress and client synchronization in a particular runtime. API presence, source packaging and secure-context checks are not substitutes for runtime tests. HTML-export behavior must not be generalized to every client version or V4 export.

## Constraints and unknowns

Unversioned documentation and unpinned examples can change. No supported client selection interface was found within the stated search scope; undocumented/internal behavior remains unknown. Vendor redistribution permission, physical camera behavior and cross-version compatibility are not established by these sources.

## Recommendation

Enhance trusted native exports without executing them during extraction; generate a new file retaining the vendor viewer and reuse its original single-click only after exact complete-row matching. Do not guess private RPCs or rebuild the renderer. See [design](implementation-plan.md), [static export notes](native-export-inspection.md) and [usage](usage.md).

The original viewer, board and model rights remain separate from the project's MIT license. Public vendor-viewer redistribution permission has not been established; do not publish generated HTML. Runtime and release evidence belongs in [verification.md](verification.md).

**Confidence:** high for the documented export capability and the distinction between editor APIs and the original viewer; limited to the searched sources for the negative API finding. Runtime and rights conclusions remain unverified unless separately evidenced.
