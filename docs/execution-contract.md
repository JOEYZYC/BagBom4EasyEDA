# Execution Contract — Reference Download and Port Planning

Date: 2026-11-06
Workspace: `G:/_MyProject/BagBom`

## Recorded user authorization

The user explicitly requested downloading `https://github.com/egethropic/bag-bom` into the current workspace as reference material, preparing a detailed plan with clear boundaries, and investigating whether the built-in LCEDA soldering-assistance tool can be extended.

Subsequent clarification: keep the existing soldering-assistance visualization and BOM-to-PCB interaction; replace the manual BOM-row click with camera QR recognition. A separate PCB-editor highlighter or rebuilt viewer is not an equivalent deliverable and is not included in the current implementation scope. The installed native window is the initial investigation target; whether augmenting its original exported HTML is acceptable remains a user decision, not an already approved alternative.

## Follow-up authorization — L2 static inspection

On 2026-11-06, the user selected `只读检查导出HTML (Recommended)` in response to the explicit question about evaluating scanner enhancement of the original native HTML export while reusing its BOM, board visualization and selection logic.

Authorized next step: static, read-only inspection of a real native export supplied by the user. Record its path, size and SHA-256, inspect its text/data/call relationships and applicable notices, and report feasibility and remaining risks. Do not copy/move/modify/unpack to disk, execute the HTML or embedded code, install dependencies, control EDA, launch a service, access a camera, upload the file, or implement the enhancement. This is consent to evaluation, not consent to implementation or a claim that L2 is feasible.

At the initial L2 consent, required inputs were still missing: export file's absolute path and target client's complete version/build; export time if available. The file was subsequently supplied as recorded below; static inspection was completed in `native-export-inspection.md` before implementation authorization.

### User-supplied artifact and narrowed inspection scope

The user then supplied `G:/Downloads/InteractiveBOM_PCB_Back_2026-11-6.html` as the offline HTML to inspect and `E:/EasyEDA` as an application-location reference. The latter is not a version/build identifier and is not authorized for inspection or modification by this step. A complete client version remains unknown; it does not block static inspection of the supplied HTML.

Artifact independently located on 2026-11-06: 9,189,105 bytes; SHA-256 `8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B`. Filesystem LastWriteTime is `2026-11-06T03:54:46.7487217+08:00`, not a separately verified export timestamp.

Inspection ownership: explorer reads this exact HTML and planning context; no writes, copying, app access, HTML/script execution, network upload or camera use. In-memory text/JSON analysis or decoding embedded data is allowed only as static data processing, never evaluation of embedded JavaScript. Orchestrator owns metadata verification and persistence of resulting research documents under `docs/`.

## Implementation authorization — standalone enhanced HTML

The user selected the HTML-enhanced-copy approach, asked for the detailed explanation, and then approved it: `可以，扫码识别的代码参考bag-bom实现即可。` This supersedes the earlier static-only gate for the implementation scope below; it does not authorize touching the installed EDA application or starting a physical camera on the user's behalf.

Goal: reusable local HTML enhancer plus a generated enhanced copy of the supplied native export, preserving the vendor viewer and manual workflow, with manual exact-identity selection and a user-started local scanner based on the fixed bag-bom reference.

Allowed project writes: new implementation source, project-local package manifest/lock and dependencies, focused tests, build scripts, licenses/notices, generated artifacts under this workspace's independent output directory, and updates to project documentation. Generated HTML must derive from the exact user-supplied source without overwriting it. No moves, deletions, bulk cleanup or unrelated copies are approved. No writer may change `references/bag-bom`, `G:/Downloads/InteractiveBOM_PCB_Back_2026-11-6.html`, `E:/EasyEDA`, parent workspace policies or workstation configuration.

Allowed verification: software unit/contract checks, local build, and software-only browser tests of the generated enhanced copy using an isolated automation profile, with no real camera access. Block network requests from the tested viewer and use synthetic/mocked media for lifecycle tests. Do not execute the original file directly, modify PCB data, automatically change welded marks, upload the board/images, or launch a persistent service. A user may later explicitly click Start Scanner in the delivered page and grant media access; that is not permission for the agent to energize the physical camera now.

Working delivery: one standalone browser-local enhancer page, a generated enhanced version of this specimen, and concise local usage/limitations documentation. Browser extensions, EDA-client integration, OCR, cloud lookup, welded-progress persistence redesign and public distribution of the vendor viewer are excluded. Single-file/offline/selection behavior is an implementation target, not a runtime claim until verified.

Verification ownership: core implementer owns parser/index/identity/conflict/selection/lifecycle checks and package/build correctness; designer owns the scanner/enhancer UI and its focused checks; independent reviewer owns correctness/security review; orchestrator reconciles files and evidence, verifies source hash preservation and final actual-viewer/offline integration where tooling permits. One writer per assigned scope.

## Initial planning-phase authorization (historical)

1. Inspect workspace instructions and the destination without changing existing user files.
2. Download the public upstream repository into `references/bag-bom` by a normal HTTPS Git clone. Preserve the upstream directory structure and license/notice files. Do not overwrite an existing destination. Do not initialize submodules, install dependencies, execute repository code, invoke Git hooks, or modify the reference checkout after download. If the target exists or a download times out, inspect the actual state before any retry; do not delete or replace it automatically.
3. Research official LCEDA Professional V4 documentation and publicly available source concerning extension development and the native soldering-assistance workflow.
4. Create planning/research documents under `docs/`. Record source locators, unresolved questions, acceptance criteria, and separate future execution gates.

## Ownership

- Reference download: Intern, exclusively within `references/bag-bom` plus creation of its parent directory.
- Research: read-only specialist; no local project or application mutations.
- Planning: planner, within newly assigned planning documents only.
- Coordination and final verification: Orchestrator.

## Exclusions of the initial planning request

- Implementing or packaging the LCEDA extension; running source-repository build scripts or dependency installers.
- Installing/updating skills, plugins, SDKs, client software, or persistent workstation configuration.
- Launching an EDA bridge, controlling the client, opening/saving/changing PCB or schematic documents, modifying native application files, or reverse engineering private internals.
- Accessing cameras, flashing/energizing hardware, printing, or sending board/camera data to any external service.
- Moving, deleting, replacing, or bulk-modifying existing user material.

## Focused verification

- Download owner: verify clone exit status, expected repository identity and files, resolved upstream HEAD, clean checkout, and preserved license/notice files; report absolute destination and commit.
- Research owner: distinguish documented APIs from assumptions and untested runtime behavior; identify the actual native tool before claiming an integration route.
- Planner: base the proposal on reconciled evidence, explicitly mark conditional branches and decisions requiring user confirmation.
- Orchestrator: inspect reference artifacts and planning documents before final reporting. No build or runtime success claims are permitted during this planning-only turn.

## Implementation completion record

On 2026-11-06, after writer reconciliation, the orchestrator ran the final typecheck, 23 unit/contract tests, UI checks, build, generated-viewer browser checks and focused media-state checks successfully. The independent source re-review closed both earlier P1 defects; actual runtime evidence remains separate and is recorded in `verification.md`.

The original file's fixed SHA-256 and reference checkout's fixed commit/clean status were independently rechecked. Generated outputs remain project-local. No physical camera, EDA process, installed app directory, original HTML execution, uploads or public vendor redistribution were used. Real-camera/physical-label acceptance and future-version compatibility remain unverified, not implicitly authorized or claimed by software test success.

## Follow-up — scanner performance optimization

The user subsequently reported that scanning can automatically locate components but is slow and often fails to recognize labels. This is user-reported field behavior, not an independently measured latency or recognition rate. The user separately asked to leave the generic non-BOM warning unchanged; that request remains in force.

Proceed with ordinary reversible software optimization within the approved standalone-enhancer scope: camera capture detail, bounded/fresh-frame scheduling, allocation reuse and evidence-backed decoder tuning only. Preserve complete identity/conflict checks, all supported formats, two-frame confirmation, stale-result/latch handling, original click semantics and hardware/privacy boundaries. Do not add a QR-only/center-crop shortcut that silently ignores other visible identities. No new dependencies, persistent diagnostics, physical-camera access, workstation changes or uploads are authorized.

Writer: existing core specialist owns camera/decoder changes, directly related helper/tests, synthetic browser-fixture adjustments when needed, usage documentation and a new performance evidence note. Orchestrator owns contract/current-status updates, final artifact generation and relevant integration verification. Existing UI, identity matching, native selection, build-path safety, original file and reference checkout remain outside this change's writer scope. The earlier final-output evidence describes the first release only until optimized source is rebuilt and verified; no physical speed guarantee is inferred from synthetic tests.

### Additional user-supplied inputs

The user reported adding `input/` with directly exported native HTML. Orchestrator located two files and performed read-only hashes plus safe static parsing; metadata and evidence boundaries are in `input-samples.md`. Both are protected original inputs. Back is byte-identical to the earlier Downloads original; CM4 is a new distinct sample. This permits using the supplied originals as read-only local test/enhancer inputs within the existing generated-output/software-testing scope, not executing originals directly, changing their data, moving/copying them or expanding hardware permissions. No default-build-path change is implied merely by adding the directory.

## Follow-up — Git management and project name

The user explicitly requested Git management of the current workspace, specified `https://github.com/JOEYZYC/BagBom4EasyEDA` as the cloud repository and requested that project name. Orchestrator verified the current root is not already in a Git worktree.

Authorized ordinary project administration: initialize a new local Git repository here on `main`, configure project-local `origin` to the supplied HTTPS URL, perform read-only remote discovery, and set the displayed project name to `BagBom4EasyEDA` with the npm-safe package name `bagbom4easyeda`. Do not rename/move the workspace, change global Git/credentials, fetch/merge/reset existing remote history, force anything or upload/push in this step. An initial source commit can be prepared only after the running performance writer is reconciled; do not capture a half-written implementation.

Exclude `input/`, `output/`, `references/` (its own Git checkout), `node_modules/`, generated tests/media and local environment/credential files from main-repository tracking. Preserve every excluded file on disk; ignoring does not authorize deletion. Board HTML and unconfirmed vendor redistribution remain out of source-control publication scope. Orchestrator owns `.git/`, `.gitignore`, package/README metadata and this record; the active camera specialist retains only its already assigned implementation files.

Execution evidence: local initialization succeeded on `main`; `origin` fetch/push URL is the exact user-supplied HTTPS URL with `.git`. `git check-ignore -v` confirmed both input HTMLs, generated enhancer, dependencies, nested reference repository and generated browser report are excluded. `git add --dry-run --all` listed source/tests/text documents only; nothing has been staged, committed or pushed. Read-only `ls-remote` timed out with low network throughput (exit 128), so cloud reachability/history is UNVERIFIED, not assumed empty or missing. Do not retry with force or upload anything to work around the timeout.

The user then explicitly directed: `继续完成，云端先不管。先在本地做好版本管理。` Continue local work only; make no further remote requests. Existing Git author identity is configured and the index is empty. After the active performance writer finishes and applicable verification passes, prepare the first genuine source snapshot on `main` and a local `v0.1.0` software milestone tag, using the existing author identity. Audit staged paths before committing; excluded raw inputs, generated outputs, nested references, dependencies and media must remain untracked. Do not fabricate an earlier snapshot, overwrite history, change global settings or push. A tag indicates the documented software checks, not independently proven physical-camera performance.

### Performance integration completion

The optimized capture source and focused evidence were independently inspected; the implementation session was narrowed to read-only closeout after an unconfirmed task error. The same independent reviewer found no actionable new source defect. Orchestrator adapted only the synthetic browser fixture to produce distinct frames, preserving QR changes and cleanup. Final testing discovered that the old Downloads source path no longer existed; without moving/copying anything, build/core-test/browser-test constants were changed to the byte-identical user-supplied input/Back original. No input contents or build-alias safety policy changed.

Final parent evidence: optimized typecheck passed; after the input-path fix, 32/32 tests, build, 9 derived-viewer checks, actual synthetic video/Worker/WASM and 4 lifecycle refinement checks all passed, ending `OPTIMIZED_FINAL_CHECKS_PASS`. Unchanged UI-only evidence was reused. Both input hashes and clean fixed reference checkout were independently verified, and current output hashes were recorded in verification.md. No real camera, EDA, installed app access, original execution, global configuration changes or further cloud requests occurred. Source is ready for the authorized local initial commit/tag; generated HTML remains ignored.
