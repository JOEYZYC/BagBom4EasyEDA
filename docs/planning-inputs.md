# Planning Inputs and Scope Boundaries

Date: 2026-11-06
Status: Evidence inputs for a proposed plan; not implementation authorization.

## User intent

- Download `https://github.com/egethropic/bag-bom` into the current workspace as reference material.
- Prepare a detailed porting plan and confirm execution boundaries.
- Target: LCEDA Professional **V4 desktop client**.
- Required functional target: preserve the **existing soldering-assistance tool's BOM-to-PCB workflow and visualization** and replace manual BOM-row clicking with camera QR recognition. User clarification: `原本的工具就像这样。点击BOM中的元件，可以与PCB对应。现在只要将点击这一步骤改为摄像头二维码识别。`
- Do not replace this requested workflow with an ordinary PCB-editor highlighter or a rebuilt standalone viewer. Those are separately scoped alternatives requiring a new user decision, not equivalent deliverables.
- Preferred initial investigation target was the installed client's native window. The user subsequently selected `只读检查导出HTML (Recommended)`: static read-only evaluation of the **original exported offline HTML** is now authorized. Actual modification, execution, camera use and adoption as the final implementation remain unapproved. User supplied `G:/Downloads/InteractiveBOM_PCB_Back_2026-11-6.html`; complete client version is still unknown, but is not needed to start static inspection. `E:/EasyEDA` is only a supplied application-location reference, outside inspection scope.
- The exact V4 patch version has not been supplied. Do not substitute a CLI-specific minimum version for ordinary extension compatibility.

## Screenshot evidence

Source identifier: `USER-IMG-01`.
Source: user-provided attachment `image-1.png`; local filesystem path unavailable.
Evidence type: visual inspection, not runtime verification.

Observed UI:

- Dedicated window with `返回编辑器`, menus `视图 / 工具 / 导出`.
- Left table: `位号聚合 / 位号不聚合`, `搜全部 / 搜位号`, and search placeholder `可搜索位号、参数、型号、封装、编号`.
- Columns: `已焊接`, `顶层位号`, `底层位号`, `参数`, `器件型号`, `器件封装`, `器件编号`, `用量`.
- Display modes: `显示全部元件`, `隐藏已焊接`, `仅显示已焊接`.
- Right-hand board viewer supports `3D / 简图` and `顶层 / 底层` controls.
- Tooltip: `单击选中，双击定位，Shift单击查看数据手册`.
- Some visible rows have a C-number in `器件编号`; other rows, including the selected `C31` row, visibly have an empty number cell. This only describes this screenshot; it is not a universal claim about LCEDA data storage.
- The second user attachment (also named `image-1.png`, identified here as `USER-IMG-02`) shows the same native window after interaction, an enlarged board region and highlighted components. The user explicitly identifies this as existing BOM-to-PCB correspondence. It establishes intended behavior, not the existence of a public programmatic selection API.

Implications (INFERRED):

- Native assistance has its own BOM presentation, selection/positioning and soldered-state workflow. Public PCB-editor selection APIs do not by themselves prove this window is controllable.
- Scanning supplier C-numbers cannot identify rows whose corresponding identifier is unavailable, unless another exact identifier or an explicitly established mapping exists.
- Reuse of native search alone does not prove unique/exact part matching or automatic selection/positioning.

## Previously inspected source evidence

### UPSTREAM-README

- URL: https://github.com/egethropic/bag-bom/blob/main/README.md
- Locators: `Prepare and scan`, `Supported codes and supplier payloads`, `Privacy and session behavior`, `License and credits`.
- VERIFIED as source inspection: original workflow opens an InteractiveHtmlBom HTML export in a browser; it does not highlight the KiCad editor directly. Supports local barcode decoding and explicit OCR fallback. Project license Apache-2.0; preserve LICENSE, NOTICE and applicable third-party notices.
- Physical webcam behavior is explicitly not established by the upstream synthetic/fake-camera tests.

### UPSTREAM-ADAPTER

- URLs: https://github.com/egethropic/bag-bom/blob/main/bag_bom/plugin.py ; https://github.com/egethropic/bag-bom/blob/main/bag_bom/web/scanner.js ; https://github.com/egethropic/bag-bom/blob/main/bag_bom/web/barcodes.js
- Locators: `BagBomPlugin.Run`, `scanner.js:init/select/startCamera/decode`, `barcodes.js:parse/match`.
- VERIFIED as source inspection: thin Python launcher; web UI/data provider and iBOM selection internals require platform adaptation. Supplier parser includes `{pc:C12345,pm:MPN,...}` and JSON equivalents; exact matching and ambiguous/conflicting-identifier checks can be reused.

### LCEDA-GUIDE

- URLs: https://prodocs.lceda.cn/cn/api/guide/how-to-start.html ; https://prodocs.lceda.cn/storage/texts/api/guide/how-to-start-for-ai.md ; https://github.com/easyeda/easyeda-api-sdk
- Locators: development environment, entry code, build/import; SDK `package.json` and `extension.json`.
- VERIFIED as documentation/source evidence: TypeScript SDK, `src/index.ts`, `.eext` output, Node >=20.17.0 in currently inspected SDK. Current template declares `engines.eda: ^3.2.0`.
- API and application version numbers are not identical: https://prodocs.lceda.cn/cn/api/guide/stability.html , `API 版本控制 / 主要版本`. The manifest field wording and the current template are not runtime proof of V4 compatibility. Do not mechanically replace the template range with `^4`.
- Any future skill/plugin installation changes configuration and needs separate consent. This planning task does not authorize it.

### LCEDA-IFRAME

- URLs: https://prodocs.lceda.cn/cn/api/guide/inline-frame.html ; https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_iframe.openiframe.html ; https://github.com/easyeda/easyeda-api-skill/blob/main/SKILL.md
- Locators: inline resource-loading rules; `openIFrame` remarks; official skill `Extension Runtime Constraints`, `Extension ↔ IFrame Data Passing`, `IFrame Context — Always Use eda Directly`.
- VERIFIED as documentation/source evidence: packaged HTML windows; no `SYS_IFrame` support from independent scripts; iframe context can use injected `eda` directly. Do not use `window.parent.eda` or manipulate host DOM.
- Main extension browser API restrictions do not prove iframe camera access is blocked. Generic iframe browser hardware capability is documented in the official skill, but camera permission, usable frames, Worker and WASM loading remain UNVERIFIED in the target client.
- Existence of `getUserMedia` and a secure-context flag are preflight only. An actual camera test must include user gesture, permission grant, usable frames, denial/disconnection, and release on stop/window close.
- IndexedDB storage of extension HTML does not determine its runtime origin.

### LCEDA-PCB-EDITOR

- URLs: https://prodocs.lceda.cn/cn/api/reference/pro-api.ipcb_primitivecomponent.html ; https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_selectcontrol.html ; https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_document.html
- Locators: component `getState_*`; `doCrossProbeSelect`, `doSelectPrimitives`; `navigateToCoordinates`, `navigateToRegion`.
- VERIFIED as API-document evidence: reading component identifiers/coordinates/layer and PCB-editor selection/location have public interfaces. Many relevant interfaces carry BETA warnings.
- INFERRED only: `SupplierId` may carry the relevant C-number; verify on actual system-library, custom-library and imported components.
- UNVERIFIED: control of the screenshot's native soldering viewer, its soldered-state storage or selection synchronization. Do not silently treat a separate PCB-editor solution as native-viewer integration.

## Proposed non-negotiable safety boundaries for the plan

- Preserve reference source and upstream notices; do not edit the reference checkout or build/install it during planning.
- Use documented extension interfaces or explicitly documented export formats. No installed-application-file patches, host DOM injection, opaque internal state writes or binary reverse engineering in the proposed initial scope. Read-only inspection of a user-supplied original native HTML export is a distinct possible next step; modifying an export, depending on its internal DOM/callbacks, or distributing derived assets needs its own scope decision, source/license checks and risk assessment.
- Keep design documents, schematic/PCB geometry, component identifiers and native soldered-state data unchanged in the first prototype. Selection/navigation are UI operations, not placement-state writes.
- Never auto-mark soldered/placed merely because a label was scanned.
- Automatic selection requires exact supported product identity with no unresolved contradiction; value/package/quantity or substring matches are insufficient. Ambiguous or missing identifiers need explicit user feedback, not a guessed selection.
- Keep frames and barcode decoding local; no cloud OCR, silent network lookup or telemetry.
- Preserve the existing viewer rather than rebuilding it. The installed native window's public integration surface is not established. If no public native-window adapter exists, stop at a user decision gate. Do not implement an independent PCB-editor highlighter, a replacement viewer, or an augmented native export as a silent fallback.
- New project implementation, runtime client access, camera access and persistent configuration changes are future execution gates, not authorized by this planning-only turn.

## Pending inputs

- Reference download completed at `G:/_MyProject/BagBom/references/bag-bom`, upstream branch `main`, commit `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`. Parent independently verified HEAD, origin, clean checkout and key-file presence, and inspected README.md, plugin.py, NOTICE and package.json directly. See `reference-status.md`.
- Target-specific official evidence is now recorded in `native-tool-research.md`, including the original native HTML export path and corrected limits of negative API-search evidence.
- Detailed phases, acceptance criteria, alternatives, decision gates and risk register are recorded in `implementation-plan.md`.

## Native-tool discovery reconciled by parent

Sources independently fetched on 2026-11-06 (documentation evidence):

- https://prodocs.lceda.cn/cn/pcb/tools-soldering-assistance-tool/ — `操作入口` and behavior: native `工具 - 焊接辅助工具`, grouped/ungrouped component list, welded checkboxes, hover-to-highlight in 3D. VERIFIED as documentation, not current-client runtime proof.
- https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_window.openui.html — `签名 / 备注 / 示例`: `openUI(uiName: string, args?: Record<string, any>): Promise<void>`. Explicitly **non-public**, no parameter docs, may break without notice, example uses placeholder UI name; unknown names silently do nothing. This is NOT a proven selection hook and is outside the default supported-interface boundary.
- https://prodocs.lceda.cn/cn/pcb/export-interactive-bom/ — native `导出 - 交互式BOM` or solder-assistance `导出 - 离线Html`; says the entire PCB 3D preview is packaged in a single HTML that a browser can open. VERIFIED export capability only. Does NOT establish that a given export exposes component identities/selection callbacks, has identical UI, allows camera/worker use, transfers welded state, or grants redistribution rights.
- Research owner searched official API/catalog/release notes and public easyeda organization sources and did not find a supported native-viewer row-selection API. Classification **NOT_FOUND within stated search scope**, not proof that no internal/undocumented mechanism exists. Full packet: `native-tool-research.md`.

Planning consequence: isolate the native adapter as the first feasibility gate; do not spend implementation effort on camera decoding before proving how a known exact identity can trigger the original viewer's selection. The user has now approved static read-only L2 inspection and supplied the exact HTML path above. This does not authorize client export operations, script execution, modifying the artifact or camera access. Metadata and scope are recorded in `execution-contract.md`; content findings are pending.
