# 实现验证记录

日期：2026-11-06。所有浏览器运行对象均为本项目生成的派生 HTML；未直接执行原件，未访问真实相机、安装的 EDA 或 `E:/EasyEDA`。

## 固定输入

- 当前只读原件：`input/InteractiveBOM_PCB_Back_2026-11-6.html`，9,189,105 字节。初期 Downloads 路径已不可用；当前样本与此前原件哈希相同，构建和测试均统一使用项目内输入，不搬动或改写原件。
- SHA-256：`8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B`。构建前后及浏览器下载检查均复核，不写回原件。
- bag-bom：`1fc1e0b2abd8b023ba01e6000c4110d72d94860c`；只读复用 `barcodes.js` / `matcher.js`，调用 `Barcodes.match`，不用 fuzzy matcher。
- ZXing-WASM：固定 npm 3.1.6，reader JS/WASM 完全内嵌；识别参数和有效/非分段过滤保留参考 Worker 的逻辑。

## VERIFIED — 父会话最终合并验收

命令均在项目根目录、同进程先执行 `. D:/Dev/Station/Profiles/node-24.ps1`。Node v24.22.2 / pnpm 11.18.0。没有 `.devtools.json`；父目录旧 `devrun.exe` 不可用，未尝试改装全局工具。

| 命令/检查 | 结果与证据 |
| --- | --- |
| `pnpm install` | 最终退出 0；依赖及完整性固定在 `pnpm-lock.yaml`。初次被 pnpm 的 esbuild 构建许可策略拒绝；项目 `pnpm-workspace.yaml` 显式允许后成功，不修改全局设置。 |
| `pnpm typecheck` | 父会话执行，退出 0。包含已合并的 `cameraActive` 合同与 UI。 |
| `pnpm test` | 父会话对当前源码执行，**32/32 通过，退出 0**。包含 14 项采集生命周期/调度测试，以及身份冲突、代次/锁存、精确行适配、原件保留和全部四个构建目标的覆盖/别名拒绝。首次复测仅因旧 Downloads 路径失效中断；统一改用同哈希 input 样本后重新完整通过。 |
| `pnpm test:ui` | 复用首版父会话已通过的 scanner/enhancer UI 检查；本轮未改 UI 或合同，不重复无关专项。当前实际派生查看器及 cameraActive 生命周期仍重新运行验证。 |
| `pnpm build` | 父会话在修正后执行，退出 0；生成增强器、样本扫码版及许可文本。最终哈希见下方，原件保持不变。 |
| `pnpm test:browser` | 父会话对最终成品执行，退出 0，**9 个检查通过**。安装版 Chrome + 隔离配置，网络禁用，媒体仅由 canvas 合成。`tests/.generated/browser-report.json` 为当前成品证据，`result=PASS`、`network=[]`、`errors=[]`。 |
| `node scripts/browser-check.mjs --refinement` | 父会话执行，退出 0，**4 个专项检查通过**；确认 selected/rejected 时合成轨道仍 live 且 `cameraActive=true`，Stop 后轨道 ended/状态 false，并核验待执行原生回调取消。当前记录 `tests/.generated/browser-refinement-report.json` 为 PASS，网络/错误数组均为空。 |
| `node tests/scanner-media-check.mjs` | 父会话执行，退出 0；实际 video → Worker/WASM 解出两个不同新帧的 C25900，单一在途任务，pagehide 释放完整，无真实相机请求、网络或页面错误。 |

### 实际原查看器选择门（不是 mock）

在生成的真实派生查看器中，原生用户单击与增强面板手动 `C25900` 对照：

- 完整目标 `R1、R2、R4`，同一个原 BOM 聚合行高亮。
- 仅在测试中旁观原总线 `rpcCall`，不猜协议也不直接调用 RPC；两次实际产生的 `/engine/model/setModelChecked` 序列完全相同，IDs 为 `top-default-33/35/36`，`/engine/camera/setTarget` 参数相同。
- 同视口原引擎 canvas 截图字节完全相同；与选择前截图不同。证据：`tests/.generated/before.png`、`native-manual.png`、`native-adapter.png`。
- 原 31 个复选框（包含表头）均保持原本未勾选状态。新增代码未发送复选框/双击/修饰键事件。
- 在适配器已发送单击、原厂 300ms 回调尚未执行时发出原生手动操作：旧回调被取消，没有迟到的引擎选择调用。
- 当前最终检查捕获到恰好一次无修饰键的原生行 click，主检查约 11.6ms、专项约 11.1ms 后作废，等待超过 300ms 后引擎选择调用仍为 0、上次行状态不变、dblclick 为 0。这只是本次取消场景的观测时间，不是性能保证；只证明本样本**待执行回调**可取消，不声称能撤销已经执行的原生选择，也不是仅 abort Promise 就能取消厂商计时器。
- 实际“不聚合”：单个位号 `C2935915 → H2` 成功；多位号 `C25900` 明确拒绝；搜索隐藏目标拒绝并提示旧高亮可能仍在。

### 单文件与真实解码器（无相机）

- 浏览器 File input 读取原件，只在增强页处理；下载扫码版并离线重新打开成功。
- 去掉新增网络策略/增强块后，下载内容恢复原件的精确字节与 SHA-256。
- Blob Worker 加载内嵌 reader WASM 成功；用开发期 writer 生成的合成 QRCode **实际解出 C25900**。不是伪造 decoder 返回值；writer 不进入成品。
- 原生选择门通过后，另用 **合成 canvas MediaStream → 实际 video → 本地 Worker/WASM → 原生行/引擎** 完成软件全链路。手动操作会停止合成轨道；重新开启后同一码不抢回 H2 手动选择，明确“重新定位”才回到 R1/R2/R4；pagehide 释放合成轨道。这不等于实物相机验证。
- 首轮测试发现原厂包会尝试远程字体、favicon、料号/器件 API（均被测试网络阻断），因此随后增加前置 CSP：`connect-src 'none'` 等阻断后台网络，不改写原厂核心。最终网络策略回归结果见下方。

### 重要实现细节

`deviceUuid` 在真实样本中是共享器件库 UUID，不是唯一放置 ID；不能据此误拒同型号的多个器件。索引使用 `[板名, 面, pick_index]` 作为产物内记录 ID，位号保持唯一；它不冒充厂商 engine UniqueID。

适配器仅在发送自己唯一的一次原生 click 的同步调用期间捕获厂商恰好 300ms 的定时器句柄，立即恢复原 `setTimeout`；新输入/停止/手动操作可取消其尚未执行的回调。处理器数量不符则取消并报告未确认。没有压缩核心替换或私有消息写入。

每次 select 在任何异步等待前同步替代前一个请求，即使新请求随后被拒绝；发事件前再次核对请求代次、产物 token、AbortSignal 和完整行身份。真实媒体状态由授权流取得/停止/错误更新，matching/selected/rejected 只改匹配结果，不把仍 live 的相机误报为停止。

## 最终检查状态

2026-11-06，性能源码写入结束并完成独立只读复审后，父会话验证类型检查，并在统一样本路径后运行完整 32 项测试 → build → 实际派生查看器 9 项检查 → 实际合成 video/Worker/WASM → 4 项生命周期专项。最终命令退出 0，输出 `OPTIMIZED_FINAL_CHECKS_PASS`；两份浏览器报告和媒体报告均已刷新。未修改的 UI 独立检查复用首版有效证据，不重复运行。

独立只读复审确认两项 P1（矛盾身份静默丢失、构建输出覆盖输入）均已修正，未建立新的可行动缺陷；这是源码审查证据，不替代上述运行结果。父会话另行复核了原件/三份输出的大小与 SHA-256，并确认 `references/bag-bom` 仍是固定提交、Git 工作区干净。

当前构建输出：真实扫码版 10,577,950 字节；增强器 1,434,745 字节；内嵌 reader WASM 946,860 字节。32 条无身份诊断是预期的跳过，不是声称所有器件可扫码。

最终构建后父会话独立计算的成品 SHA-256（原件哈希也已复核不变）：

- `output/html-enhancer.html`: `DDB19F583DACC73421537868995A0AF907F9A3D1E06CDD6A7E969AAFAE446F2A`
- `output/InteractiveBOM_PCB_Back_2026-11-6_扫码版.html`: `1C5D768630F4526CC6C7F8E738B07F576B7A1351267118740E998059A3B5F11E`
- `output/THIRD_PARTY_NOTICES.txt`（33,951 字节）: `0BCF3A06C3BFADB8C9E2BC816E88DB2910CC9EEF99BED89B2D4BE281C9A2DBCA`

父会话已完成最终合并验收；之后若修改源码或产物，应重新构建并按受影响范围检查，不把本记录外推到未检查的新版本。以下保留实现阶段的有界复核历史，不能覆盖本节的最终结果。

## 性能改进证据与边界

- 请求 ideal 1920×1080/30fps，实际采样仍是全帧，限制长边 1920、总像素 2,073,600；硬件可以降级。不裁切、不过滤掉原支持码制。
- 解码后不再固定闲等 220ms；开始间隔至少 100ms，只保留一个在途任务，仅不同新帧进入确认，尺寸不变时复用画布。身份、两帧一致、冲突拒绝与非 BOM 提示未改。
- 父会话实际媒体烟测：两个采样 mediaTime 为 0.099498 / 0.241892 秒，从首次 Worker post 到第二次结果约 173.4ms；不含权限、初始化、首次像素读回之前时间或原生选择延迟，不是物理相机旧/新 A/B。
- 已读取并核对专项原始基准报告：8 类合成夹具×5 次，新 robust 全部完整返回，包含多码/矛盾码和五种码制；未交付会漏掉小码的弱化 decoder 候选。高细节的单帧解码反而更慢，收益来自减少空等与保留细节；不能外推实物识别率。细节见 [scanner-performance.md](scanner-performance.md)。
- Back/CM4 两份 input 哈希均复核未变；CM4 只完成静态索引检查，未宣称实际浏览器选择验证。参考 checkout 仍为固定提交且干净。

## P1 前有界收尾复核（历史）

- 已确认 `src/contracts.ts:48` 实际包含 `cameraActive?: boolean`，不是只靠 UI 结构兼容。`src/scanner.ts:29–34` 初始化并接收真实媒体状态；所有结果更新通过合并 model 保留此字段，因此 selected/rejected 不会隐式变成 false。`src/camera.ts:29/34/41/81/104` 分别覆盖停止、请求中、取得流、扫描中及失败释放。
- 本次仅复跑 `pnpm typecheck`（退出 0），并用 `pnpm exec esbuild tests/camera.test.ts --bundle --platform=node --format=cjs --outfile=tests/.generated/closeout-camera.test.cjs` 后运行 `node --test tests/.generated/closeout-camera.test.cjs`（5/5 通过，退出 0）。每次使用同进程指定 Node Profile。
- 当时未修改运行时代码、合同或 UI，未重建，也未重复整套浏览器检查。随后发生下面的 P1 修正并重建；这次旧收尾的报告不适用于新产物。

## 两项独立审查 P1 修正（实现阶段记录）

- `src/identity.ts`：要求完整且一致的平面 JSON 或完全无引号语法；混合语法失败关闭。每个 `pc`/`pm`（含大小写/下划线等价键）必须通过与上游一致的身份验证（包括必需数字），并逐一与 `Barcodes.parse` 返回结果核对数量、类型及完整值。显式不支持的身份别名拒绝，而非当作可忽略 metadata。结构化供应商字段也不会静默丢掉无法验证的显式 MPN。
- 精确回归 `{pc:C25900,"pm":"WRONG123"}` 与 `{"pc":"C25900","pm":"WRONG"}` 都被拒绝；同时覆盖合法完整 quoted/unquoted 记录、混合语法、数值/null/空/纯字母值、重复/大小写等价键、转义、嵌套、后缀冲突及模拟上游丢字段。
- `scripts/output-paths.mjs` + `scripts/build.mjs`：将 tool、扫码版、notices、harness 四个输出作为完整写入计划；在任何 mkdir/write 前预检源与**所有**输出的规范路径（保守忽略大小写）、realpath 与 dev/ino 文件身份。硬链接/符号链接别名、零 inode/身份不明、悬空链接、权限/解析错误、输出相互别名均拒绝整个计划。最终源哈希检查移到全部输出写完之后。
- `tests/build-paths.test.mjs`：用自己创建的 sentinel 文件核对全部四个目标冲突时源字节不变、mkdir/write 调用均为 0；大小写、符号链接、硬链接和错误情况用注入 IO，不创建任何实际别名或触碰原件。预检不是针对外部并发替换路径的原子锁；构建期间不得并发改变源、输出或链接。
- 执行（同进程指定 Node Profile）：`pnpm typecheck`；`pnpm exec esbuild tests/core.test.ts --bundle --platform=node --format=cjs --outfile=tests/.generated/p1-core.test.cjs`；`node --test --test-name-pattern='structured identity|bag-bom exact' tests/.generated/p1-core.test.cjs`（3/3）；`node --test tests/build-paths.test.mjs`（5/5）；最后 `pnpm build` **一次**。全部退出 0，原件仍为固定 SHA-256。
- `scripts/test.mjs` 已纳入路径回归，供父会话最终完整测试使用；`package.json` 仍有 `test:ui = node src/ui/check.mjs`，无需再修改。
- GS1/ECIA 后续复核：当前 `src/identity.ts:12–16/26–38/79–83` 已对显式 `1P`、`30P`（及既有 `P…-ND`）应用包括数字要求的同一身份验证，并核对所有解析结果。新增专门测试用真实上游 parser 证明：已识别 `1P0402WGF4701TCE` 旁的 `1PWRONG`、`30PWRONG`、`PWRONG-ND` 确实会被上游静默丢掉，但本实现全部拒绝；同时覆盖空/过短/大小写/内部空格、合法单 MPN 控制和模拟丢失合法显式字段。`pnpm typecheck` 与 `node --test --test-name-pattern='GS1 ECIA explicit' tests/.generated/p1-core.test.cjs` 均退出 0（1/1）。该次仅改测试/文档，未改运行时代码。其后父会话已执行前文记录的最终构建和完整检查。

## UNVERIFIED / 限制

- 未代用户开启真实摄像头、扫真实料袋，未测权限 UI、反光、焦距、实际硬件拔出及实际耗时。相机到选择的现场闭环仍需用户按使用说明完成。
- 本次实际板只有顶层 50 个器件、底层 0；底层仅有合成合同测试，没有实际底层查看器验证。
- 3D 聚合完整集合与不聚合单器件已验证；没有把其他版本 DOM、移动布局、所有浏览器、所有码制/真实标签或原生保存重开能力列为通过。
- 不新建焊接进度持久化，不声称与客户端同步；跨会话进度未验证。
- 原厂查看器公开再分发许可未确认；只交付用户本机派生成品。
