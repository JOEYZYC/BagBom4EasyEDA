# 原生焊接辅助工具：二次开发证据与边界

日期：2026-11-06。本文是研究记录，不是实现授权。研究由 res-web 完成，Orchestrator 核对关键官方页面并保存、校正研究包。没有运行 EDA、生成或执行导出文件、访问摄像头、安装插件或修改应用。

## Question

保留用户截图中的原有 BOM、3D/简图、选中及已焊接工作流，只用摄像头二维码识别替代点击 BOM：能否驱动客户端原窗口？如没有受支持入口，是否可以增强原工具导出的 HTML，而不重建查看器？

## Sources

所有网络来源 retrieved_at：2026-11-06。网页 last-modified 是页面传输元数据，不是客户端兼容性承诺。

| source_id | type | url / source_path | locator | version_or_date |
| --- | --- | --- | --- | --- |
| S1 | web | https://prodocs.lceda.cn/cn/pcb/tools-soldering-assistance-tool/ | 操作入口、列表勾选/聚合/悬停高亮正文 | last-modified 2026-11-05 |
| S2 | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_window.openui.html | 签名、备注、示例 | last-modified 2026-11-05 |
| S3 | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_window.html | 类备注、方法表 | last-modified 2026-11-05 |
| S4 | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.html | 类索引 | 检索于 2026-11-06 |
| S4a | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.dmt_pcb.html | 方法表 | 检索于 2026-11-06 |
| S4b | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.sys_tool.html | 方法表 | 检索于 2026-11-06 |
| S4c | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_document.html | 方法表 | 检索于 2026-11-06 |
| S4d | web | https://prodocs.lceda.cn/cn/api/reference/pro-api.pcb_selectcontrol.html | doCrossProbeSelect 等方法 | 检索于 2026-11-06 |
| S5 | web | https://prodocs.lceda.cn/cn/faq/update-record/ | v1.4.10 引入工具；v1.8.40 导出修复；V3.2.209 离线 HTML 模型修复 | 条目分别为 2021-11-24、2022-10-24、2026-10-22 |
| S6 | web | https://prodocs.lceda.cn/cn/pcb/export-interactive-bom/ | 全文，两种导出入口 | last-modified 2026-11-05 |
| S7 | repo | https://github.com/easyeda/easyeda-client-cli | README、easyeda-cli.md 命令与会话说明 | 研究时公开版本；未固定提交 |
| S8 | repo | https://github.com/easyeda/eext-interactive-html-bom | docs/architecture.md、extension.json | 研究时公开版本；未固定提交 |
| S9 | observation | 用户两次提供的 image-1.png；本地路径不可用 | 第一幅：BOM 列/按钮/提示；第二幅：选中与放大的板图 | 2026-11-06；视觉观察 |
| S10 | repo | https://github.com/easyeda/eext-interactive-bom | README 功能列表 | 研究时公开版本；未固定提交 |
| S11 | repo | https://github.com/easyeda/eext-external-tool-integration-demo | README 场景与架构 | 研究时公开版本；未固定提交 |
| S12 | repo | https://github.com/easyeda/easyeda-viewer | README 能力边界 | 研究时公开版本；未固定提交 |

Orchestrator 独立读取并核对了 S1、S2、S6。其余为研究人员的来源检索结果；没有据此作运行时成功声明。

## Findings

### F1：原工具与 UI 行为

- claim：官方名称为“焊接辅助工具”，入口为“工具 - 焊接辅助工具”。文档描述已焊接勾选、位号聚合/不聚合及鼠标经过列表时 3D 模型高亮。截图提示“单击选中，双击定位，Shift 单击查看数据手册”。
- classification：VERIFIED，限文档与视觉观察；实际客户端运行行为未验证。
- source_ids：[S1, S5, S9]
- evidence：上述页面原文和用户截图。
- evidence_type：source inspection / screenshot observation。
- applicability：说明用户要保留的现有工作流；不能证明存在可编程入口。选中与定位应分别验收，不能混称一个动作。

### F2：支持导出原生 HTML

- claim：官方原文：“会把整个PCB 3D预览打包在一个html中，浏览器打开即可预览”。入口为“PCB - 顶部菜单 - 导出 - 交互式BOM”，或者“工具 - 焊接辅助工具，导出 - 离线Html”。
- classification：VERIFIED，限导出功能的文档证据。
- source_ids：[S6, S5]
- evidence：S6 全文及更新记录的导出修复条目。
- evidence_type：source inspection。
- applicability：提供了检查真实原生产物的路径。不证明 HTML 内部结构、UI 完全一致、选择回调可用、摄像头可用、状态可迁移或有修改/分发许可。

### F3：未找到原窗口的受支持行选择入口

- claim：公开资料检索未发现指定原生查看器 BOM 行/位号并选中的接口，也未找到该窗口的公开输入协议、深链或焊接状态接口。
- classification：NOT_FOUND，限已检索范围，不是“不存在任何通道”的证明。
- source_ids：[S1, S4, S4a, S4b, S4c, S4d, S5, S7]
- evidence：研究人员检查 prodocs 指南、API 类/方法表、更新记录、CLI 文档及 easyeda 组织公开仓库相关检索，未返回原窗口选择触发器。未固定仓库提交，后续 API 更新可能改变结论。
- evidence_type：source inspection / bounded search。
- applicability：目前不能承诺在客户端原窗口内闭环“扫码→选中”。取得有文档或官方确认的接口后，仍需另行授权的运行时验证。

### F4：openUI 不足以作为方案基础

- claim：签名为 `openUI(uiName: string, args?: Record<string, any>): Promise<void>`；备注明确为“非公开接口”，不提供参数额外文档，可能不经通知发生破坏性更改。示例使用占位名称；未知名称静默无效。
- classification：VERIFIED，限签名和警告；原工具的 uiName/args 为 NOT_FOUND。
- source_ids：[S2, S3]
- evidence：S2 签名、备注、示例；S3 窗口跳转的有限性说明。
- evidence_type：source inspection。
- applicability：不能猜名称试调用、把“成功返回”当作窗口已打开或已选中。默认不依赖非公开接口；若以后考虑，须重新确认边界、版本风险和用户接受程度。

### F5：编辑器 API 不等于查看器 API

- claim：`pcb_SelectControl.doCrossProbeSelect` 及 `pcb_Document.navigateToRegion/navigateToCoordinates` 位于 PCB 编辑器 API；没有来源证明它们可驱动截图中的焊接辅助窗口。
- classification：VERIFIED（接口归属）；UNVERIFIED（对原窗口生效）。
- source_ids：[S4c, S4d]
- evidence：对应 API 类与方法说明。
- evidence_type：source inspection。
- applicability：另做编辑器高亮不能算完成当前需求，亦不能通过它宣称原窗口联动成功。

### F6：相机、CLI 与 iframe 的证据限度

- claim：当前官方检索未找到针对目标上下文的摄像头权限说明。CLI 命令表未列出查看器命令，但不能证明以后通过 invoke 调用新发现的接口不可行。扩展 iframe 的 URL 查询限制不能外推为原窗口没有深链。
- classification：NOT_FOUND（目标摄像头/查看器输入文档）；UNVERIFIED（实际媒体与注入行为）。
- source_ids：[S1, S4, S7, S8]
- evidence：对应指南/命令表的检索结果及 iframe 架构的适用范围。
- evidence_type：source inspection / bounded search。
- applicability：必须分别测试媒体采集、解码资源、身份匹配和原窗口适配。前置属性存在不等于真实相机成功。

### F7：其他官方扩展不是原生工具

- claim：官方交互式 HTML BOM 扩展以自己的 iframe/数据采集/查看器实现交互；官方独立 viewer 的 README 不覆盖 BOM/3D；外部工具集成示例只提供侧车模式参考。
- classification：VERIFIED，限研究人员的仓库来源检查。
- source_ids：[S8, S10, S11, S12]
- evidence：各仓库架构或 README 能力说明。
- evidence_type：source inspection。
- applicability：不能据这些扩展推导原生工具有同样的钩子；不纳入本轮实现。若未来采用，许可须单独核对，不能照搬 bag-bom 的 Apache-2.0 结论。

## Constraints And Risks

| 路径 | 与用户目标的关系 | 当前证据状态 | 下一道门槛 |
| --- | --- | --- | --- |
| L1：客户端原窗口适配 | 首选形态，保留当前客户端工作流 | 受支持选择接口 NOT_FOUND | 有文档或官方确认的接口；随后另行授权并测试已知条目选择 |
| L2：增强原工具导出的 HTML | 不重建查看器，但改变运行上下文，不能默认用户接受 | 只确认可导出；可增强性 UNVERIFIED | 用户决定是否接受；提供非敏感真实导出文件，只读检查结构与条款 |
| L3：独立 iBOM/编辑器高亮 | 替代实现，不是同一工具 | 不作为当前目标的交付物 | 必须另行改范围；不得静默降级 |

- 原文件、客户端程序、工程与已焊接状态均不可在当前任务中修改。
- 原工具产物即使能导出，也不自动授予再分发其代码/模型的权利。个人本地验证和公开分发分开决定。
- 不给单个扫码结果自动打“已焊接”勾选；没有精确身份或存在冲突时不猜测。
- 截图里部分器件编号为空，只是这份工程的观察；不能用参数/封装相同作为自动匹配替代。
- 导出 HTML 可含可执行脚本与板图数据。初步检查只读文本，不在浏览器执行、不上传全文或原始帧。

## Conflicts Or Unknowns

1. 原窗口和导出 HTML 的 UI/分组/事件/状态是否完全相同，未知；不能依据导出能力假定等价。
2. 导出是否保留编号、MPN、稳定器件标识、顶底层、分组及已焊接数据，未知。
3. 导出页面是否与客户端共享或携带焊接进度，未知；不可声称双向同步。
4. 是否存在可复用的公开选择回调、事件，还是必须依赖脆弱的内部 DOM/压缩代码，未知。
5. camera、Worker、WASM 在客户端 iframe、file URL 或本地服务上下文的行为应分开验证。
6. 新目标文件、端口/本地服务、依赖安装、客户端操作与摄像头测试均未获实现授权。

## Recommendation To Plan

先证明“给一个已知的精确身份，能够触发原工具的对应选择”，再投入摄像头。身份解析可参考 bag-bom；原工具适配和数据映射必须独立证明。

### L1 证据门

寻找有文档或官方确认的原窗口选择接口、文档/窗口身份和选择语义。官方工单是证据形态之一，不是唯一形式。非公开 `openUI` 仍须单独接受风险，不能因其出现在文档中就视为稳定接口。之后用授权测试验证选中、可选定位、两面分组及不改焊接进度。

### L2 只读产物检查门

前提：用户同意评估原生导出 HTML，并自行提供一份非敏感文件及客户端完整版本。直接只读检查提供的文件，不自动复制、修改、执行或反向控制 EDA。

静态检查并记录：

1. 路径、大小、SHA-256、客户端版本与用户提供的导出时间。
2. 内嵌数据、器件编号/MPN/稳定位号、分组/层面、缺失标识与原始状态字段。
3. 既有 BOM 行选择/高亮/定位的调用关系、是否有可复用入口，以及原始视图是否能保持。
4. 外链、资源、CSP/加载方式、存储键和状态序列化代码。静态代码仅表明实现意图，不证明运行时有效。
5. 原生代码、第三方库、模型的可修改/分发条款；不能查明的条款明确记为未知。

后续另行授权的动态门：实际界面等价性、断网运行、选择/定位、摄像头权限与帧、Worker/WASM、进度持久化与性能。不得把这些动态检查混入“只读产物检查”而提前执行。

若必须重写 BOM/3D/选中核心，L2 不符合“只替换输入”的范围，应停止并由用户决定。未通过任何路径，不等于用户已接受人工点击或独立查看器的降级。

## Confidence

- 原工具名称和导出能力：高，官方原文。
- 受支持选择接口未发现：中高，仅限所述检索范围。
- L2 可增强性及状态兼容性：未知，缺少实际产物。
- 摄像头到原窗口的闭环：低，尚无目标运行时证据。

更正已纳入：不再把“未找到输入接口”写成不存在通道；不外推 iframe 查询限制；不把 CLI 目录缺项当作不能调用；不把 UI 截图当成程序化接口证明。
