# 原生离线 HTML：静态检查记录

状态：已完成关键源码复核；尚未运行原文件或访问摄像头。此记录只支持实现路线判断，不代表功能已验证。

## Question

能否在原生导出 HTML 上追加扫码输入，复用现有 BOM 行选择及 PCB 查看器，而不是重做查看器？

## Sources

| source_id | type | source_path | locator | version_or_date / retrieved_at |
| --- | --- | --- | --- | --- |
| H1 | user artifact | `G:/Downloads/InteractiveBOM_PCB_Back_2026-11-6.html` | 全文；4287 行；9189105 字节 | 读取于 2026-11-06；完整客户端版本未知 |
| H2 | local plan | `implementation-plan.md` | 路线 L2、P1–P5、V1–V7 | 2026-11-06 |
| H3 | fixed source | `../references/bag-bom/bag_bom/web/barcodes.js` | `parse`、`match` | 上游提交 `1fc1e0b2abd8b023ba01e6000c4110d72d94860c` |
| H4 | fixed source | `../references/bag-bom/bag_bom/web/barcode-worker.js` | L3–16 | 同一提交 |

H1 SHA-256：`8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B`。文件修改时间 `2026-11-06T03:54:46.7487217+08:00` 不是单独验证的导出时间。严格 UTF-8 解码成功，往返编码字节相同，未包含 Unicode replacement character。下述列号为 .NET 字符索引加一，不是字节偏移。

## Findings

### F1：原始数据足以开展精确身份适配

- classification: VERIFIED（静态数据检查）
- source_ids: H1
- evidence: L32 `window.files =` 后是 JSON 对象；随后以 `; window.__ENGING_OBJ_PRELOAD__ =` 分隔模型数据赋值，不能把整段 JavaScript 当 JSON，也不能 eval。`window.files` 键为 `bom_merge`、`dfm`、`web`、`language`，本样本 `dfm` 为 null。
- `bom_merge` 是 JSON 字符串，解析后有 `sum`、`data`，其 `data` 再解析为 `file_info`、`check_info`、`comp_info`、`designator_info`。
- `comp_info` 有 16 个条目，其中 12 个条目的 `Supplier Part` 满足完整 `^C[0-9]+$`，其余 4 个不满足；不能概括为全部器件都有可扫码料号。另有 `Manufacturer Part` 等字段。
- `designator_info` 是阵列，本样本有 1 个板块；板块包含 `top`/底层数据、`set` 等信息，器件记录含 `des`、`deviceUuid`、`lc_code`、`is_mount`、坐标及模型信息。`lc_code` 是复合字段，例如 `C2935915,`，必须按已验证结构与 `comp_info` 键关联，不得将任意料号后缀截断。
- `check_info` 报告 50 个顶层装配器件、0 个底层装配器件；这不是手动焊接进度的存储证据。本样本不能单独建立底层行为的运行时结论。
- `web` 为 6083 行 JSON-lines 格式的预览数据，开头为 `["DOCTYPE","PREVIEW","1.0"]`，并非可直接整体 JSON.parse 的单一 JSON 值。
- applicability: 可以安全解析数据建立索引；MPN 只取明确的制造商料号字段，不从参数、封装、复合字段的未知片段推断。

### F2：原有单击入口可见，但须动态验证事件适配

- classification: VERIFIED（原处理器源码）；INFERRED（程序事件可复用）
- source_ids: H1
- evidence: L4188 col146 聚合行 `onClick` 延迟 300ms 调用 `q(X,U.dataT[0],U.dataB[0])`；L4189 col258 附近非聚合行 `onClick` 延迟调用 `E(B,M.Designator,L)`。双击由另一处理器取消同一计时器后处理。
- 聚合组件在 L4187 的 `Pte` 中将 `_8(...).clickCurrentTr` 绑定到 `q`；非聚合组件在 L4188 将 `P8(...).clickDesignator` 绑定到 `E`。这些变量是模块内部绑定，不能假设是稳定公共 API。
- applicability: 优先测试对经精确校验的原 BOM 行发送一次冒泡 click，复用原处理器；不能仅凭整行文字模糊检索、点击复选框或无条件点击混合身份分组。普通程序化 click 并不会自动合成 dblclick；仍须防重复触发和真实双击竞争。

### F3：原单击不等于“绝不移动视图”

- classification: VERIFIED（源码意图，非运行结果）
- source_ids: H1
- evidence: L4187 col36479 `_8=` 的 `clickCurrentTr` 设置选中 ID、调用 `oo`/`Hi`，普通非 Ctrl 分支通过 `mm` 指向组中心，必要时 `Xl` 翻面；doubleClick 分支使用 `xs`。L4188 col17261 `P8=` 的 `clickDesignator` 同样通过 `mm` 指向器件坐标。
- applicability: 验收应与原生单击基线比较，保留其既有居中/翻面行为；不额外引入双击适配/缩放，而不是要求原本存在的行为消失。最终引擎效果仍须实际查看器验证。

### F4：不能由有限搜索证明不存在其他接口或持久化

- classification: VERIFIED（存在的符号）；UNVERIFIED（可用于适配/保存的完整契约）
- source_ids: H1
- evidence: L3832 col4330 和 L4072 col9743 可见 `window._MSG_BUS_`；L4072 也有 `window._MSG_BUS_WIN_`。未确认可稳定触发整套 BOM 选中行为的公共接口，不应将此表述为“完全没有暴露接口”。
- L4073、L4116 可见 `shortcutKeyTable`、`ShowElement` 本地存储读取；L4079 可见 `RotationAngle`、`moveDist`。没有建立手动已焊接状态跨会话保存/恢复的证据，不能凭未找到字段断言一定仅会话有效。`check_info`、`is_base` 或 `/api/merge/upload` 名称均不足以证明焊接进度保存。
- applicability: 不改写持久化，不承诺同步回客户端；动态测试需分别记录当前会话不变及重新打开的基线能力。

### F5：离线资源与相机必须分别验证

- classification: VERIFIED（静态形态）；UNVERIFIED（运行能力）
- source_ids: H1,H4
- evidence: 页面内嵌原查看器及模型数据，头部有离线模式标记，未见头部 CSP meta；导出生成函数 L4187 含版本路径 `smt-ui/1.0.353.4cd90317`，不能据此反推客户端完整版本。原引擎含 Worker 代码，但不代表新增 ZXing Worker/WASM 已可运行。
- L3797 col10412 附近有通用旧式 `getUserMedia` 包装代码；不是现代相机扫码链路或授权成功证据，不能说整份文件完全没有 getUserMedia。
- H4 使用 ZXing-WASM 3.1.6、Worker、QRCode/DataMatrix/Code128/Code39/PDF417，过滤无效结果与分段符号。新增单文件版本应保留其识别及冲突判断思路，并重新实现本地 Worker/WASM 资源打包。
- applicability: 源码内嵌不等于没有运行时网络请求；需阻断网络执行派生副本，验证查看器及新增解码资源。物理摄像头未授权给 Agent 操作，交由用户主动启动并实测。

### F6：许可证边界

- classification: VERIFIED（局部第三方 notice）；UNVERIFIED（原厂查看器修改/分发授权范围）
- source_ids: H1,H3,H4
- evidence: 原包可见 Three.js、pako 等第三方 notice；bag-bom 参考代码为 Apache-2.0，复用时必须保留适用 LICENSE/NOTICE。没有建立原厂查看器公开再分发许可。
- applicability: 当前只面向用户本机、由其原生导出物生成派生文件；不得默认允许公开发布含原厂查看器的增强 HTML。

## Constraints And Risks

结构/列/分组模式变化；混合身份组；缺少料号；筛选隐藏目标；重复设计位号；多选被普通点击清空；300ms 异步处理与用户手动操作竞争；页面关闭/停止后迟到的解码或权限结果；相机释放；新资源离线加载；原厂许可未知。

## Conflicts Or Unknowns

未确认程序事件实际触发及整套引擎结果；未确认原离线查看器全部浏览器行为；本样本无底层装配器件；完整客户端版本未知；真实料袋/反光/相机权限未测试；焊接进度跨会话保存能力未知。

## Recommendation To Plan

先在派生副本中用手动准确料号证明原行选中，后接独立本地扫码面板。数据解析不得 eval；索引与 DOM 行映射均精确校验并失败关闭；保持原单击基线，禁止自动焊接标记。生成过程不覆盖原文件，优先追加模块而非改写原厂压缩核心。用户已经选择 HTML 增强副本并同意实现，后续实施授权以执行合同的最新小节为准。

## Confidence

数据和处理器边界：高（静态）。对完整查看器程序事件适配：待运行验证。离线 ZXing 打包：待构建与测试。物理相机、底层真实样本、跨会话进度与公开分发授权：未建立。
