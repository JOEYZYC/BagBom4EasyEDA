# 扫码采集性能：有界软件优化记录

日期：2026-11-06。范围仅为相机采集/调度及相关测试，不改身份规则、非 BOM 通用拒绝文案、原生选择适配器、UI 或工作站。**下文保留专项实现阶段的测量；随后父会话已重建成品并完成最终集成验收，见 [verification.md](verification.md)。** 本记录不替代最终验收。

## 实现与安全边界

`src/camera.ts`：

- 请求 width=1920、height=1080、frameRate=30 的 **ideal**，不指定分辨率 min/exact。用户显式选择的 deviceId 仍按原合同 exact，默认仍优先后置相机。浏览器/硬件可降级。
- 全帧采样上限从长边 1280 改为长边 1920，并额外限制像素总数 ≤2,073,600。不放大小输入、不裁切、不做 QR-only 快速通道。画布宽高只有实际改变时才赋值，避免每帧清空/重新分配。
- 使用 `requestVideoFrameCallback` 的 mediaTime（缺失时用 presentedFrames）判断不同新帧。没有该 API 时，优先用 totalVideoFrames−droppedVideoFrames；再降级到 currentTime。相同帧标记不重复解码/确认。最后一级时间回退不等于实测证明新的物理曝光，旧浏览器能力仍有限。
- 一次只有一个 Worker 请求，无排队帧；解码完成后尽早请求新帧。用单调时钟维持最小 100ms **开始到开始**间隔（最多 10 次开始/秒），而不是每次解码后额外闲等 220ms。解码本身若超过 100ms，就不再追加这段闲等。
- 10s 无新可用帧、15s 解码超时、停止/隐藏/离页/断开仍释放资源。停止会取消视频帧回调及等待定时器；旧会话的迟到回调不能清掉新会话的回调所有权。错误/重复/过期 Worker ID 不消费当前待处理帧。
- 仅向已有 scanner 回调提供新帧结果；原来的“两帧一致”、选中码锁存及冲突拒绝逻辑未改。原生 click 的约 300ms 延迟、适配器等待/确认未改，也不计入下面采集模型的加速数字。

`src/decoder-worker.js` **没有修改**。仍为 pinned ZXing-WASM 3.1.6，QRCode / DataMatrix / Code128 / Code39 / PDF417，tryHarder/Rotate/Invert/Denoise 全开、Plain、max32、有效且非分段过滤。候选关闭 Harder/Denoise 虽快，但出现漏码，未采用。

## 测试方法

仅使用已有 Node Profile、esbuild、TypeScript、playwright-core、已安装 Chrome、pinned ZXing reader/writer。未安装依赖，未访问物理相机/EDA，未读取或执行原件，未访问 `E:/EasyEDA`，未上传图像。浏览器为隔离配置，网络阻断，真实 getUserMedia 被禁止；Worker/WASM 完全内嵌。writer 只用于测试夹具，不进入产品。

### 确定性生命周期/调度测试：14/14 通过

`tests/camera.test.ts` 使用 mock Date/timers、可控的视频帧回调、质量计数及 Worker ID，不依赖机器快慢断言。覆盖：授权迟到/拒绝/切换、断开/Worker 失败、代次、理想约束、不同帧才确认、同帧不计数、单一在途请求、错误及迟到 ID、慢解码不额外睡眠、10次/秒上限、画布复用/尺寸变更/全帧像素预算、时间/显示帧计数回退、冻结帧 watchdog、stop/pagehide、旧回调晚于重新启动。

一个明示的模型用旧单帧 25ms、新高细节单帧 50ms：旧两帧结果可用为 `25+220+25=270ms`；新两帧为 `max(100,50)+50=150ms`。这是可重放的调度模型，不是声称所有实际相机快 120ms。

### 实际 video → Worker/WASM 软件烟测：通过

`tests/scanner-media-check.mjs` 使用每 33ms **重新绘制**的 1920×1080 合成 canvas 流，而非真实摄像头。实际 LocalCamera、video、Blob Worker 和 reader WASM 解出两次 `C25900`：

- 两个采样 mediaTime：0.096965s / 0.233797s，确为不同帧。
- 最大在途任务 1；两次均为完整 1920×1080 帧。
- 从第一次 Worker post 到第二次结果约 **164.5ms**（包括首次解码预热，不含权限/模块初始化，也不含第一次读回像素之前的时间）。仅为本机一次观测，不是旧/新物理相机 A/B。
- pagehide 后轨道 ended、video.srcObject=null、Worker terminate/URL revoke 各 1 次、无迟到结果；真实相机调用 0，网络与页面错误均为 0。

记录：`tests/.generated/scanner-media-report.json`。

## 同夹具旧/新比较与 decoder 候选评估

`tests/scanner-performance.mjs` 在 Chrome **156.0.8078.80**、ZXing-WASM **3.1.6** 下，对相同 1920×1080 合成原图测试：

1. 旧：全帧缩至长边 1280、每帧重设画布、原 robust worker。
2. 新：全帧保留长边 1920、画布复用、**相同 robust worker**。
3. 测试候选（不交付）：1920、仅将 tryHarder/tryDenoise 设 false，其余码制/max32/过滤不变。

每个夹具/配置先预热一次，再交错运行 5 次；不含 WASM 初始化。每种配置 8×5=40 个测量样本。二维码均由 pinned writer 生成；标准码 scale6、小码 scale2；高密度 QR 为 pc/pm JSON 加 360 字符 lot，scale2；另有 35° 旋转、大/小双码、C 编号与矛盾 MPN JSON 双码、同帧五种码制及空白。完整定义/位置在脚本中，没有裁切。

下面为 Worker roundtrip（含实际解码及 IPC，不含画布准备和旧 220ms 闲等）的 **median / p95，毫秒**。n=5 的 p95 就是该组最大值，不能代表总体统计置信区间。

| 夹具 | 旧1280 robust | 新1920 robust | 新的完整结果 |
| --- | ---: | ---: | --- |
| 标准 QR | 21.8 / 23.6 | 45.8 / 49.5 | 5/5 |
| 小 QR | 20.9 / 21.9 | 43.8 / 46.0 | 5/5 |
| 高密度 QR | 23.6 / 24.7 | 46.7 / 51.8 | 5/5 |
| 旋转 QR | 21.3 / 49.7 | 45.6 / 114.7 | 5/5 |
| 大/小双码 | 46.7 / 61.3 | 93.0 / 104.8 | 5/5，两个码均保留 |
| 矛盾 JSON 双码 | 41.9 / 45.2 | 91.4 / 101.5 | 5/5，矛盾证据均保留 |
| 五种码制同帧 | 49.6 / 62.1 | 104.2 / 114.6 | 5/5，全部五个码 |
| 空白 | 42.0 / 46.9 | 98.2 / 100.0 | 5/5，均为空 |

结论不是“单帧解码变快”：高细节帧的处理量更大，**单帧更慢**。旧/新画布准备 median 在这些组分别约 3.5–6.1ms / 6.7–10.7ms；基准中的画布尺寸赋值次数为 96 / 2。相机尺寸稳定时没有无条件重分配，但大图读回仍有成本。观察到调度噪声/长尾，未设置毫秒性能断言。

收益来自去掉固定闲等及保留更多细节：旧 1280 在五种码制同帧夹具中每次漏掉 Code128 和 Code39；新 1920 全部恢复。其余声明夹具新 robust 也保持完整结果（40/40）。这些 QR 夹具在旧/新 robust 下都能解出，不能把它们写成已经证明真实料袋识别率提高。

测试候选更快，但小 QR、高密度 QR、大/小双码、五码夹具均 0/5 完整；大/小双码只留下大码，漏掉 `C999999`，可能造成危险的假唯一。因此不关闭任何 robust 选项，也没有 QR-only 或中心裁切的部分成功路径。

### 区分固定等待与两帧可用时间

报告还用相邻实测的“画布准备+Worker roundtrip”成本建立模型：

- 旧：`cost1 + 220 + cost2`。
- 新：`max(100, cost1) + cost2 + [0, 一个30fps帧周期]`；假设下一个独立帧在 0–33.3ms 内到达，硬件帧率不同时此假设不成立。
- 标准 QR 的 median 模型：旧 **271.7ms**；新下界 **153.1ms**、上界 **186.4ms**；对应 p95 为 274.2 / 158.5–191.8ms。
- 矛盾/多身份/空白即使两帧完成也不是可选择目标；该数学模型不绕过身份/稳定性门。

原始各次样本、min/median/p95/max、初始化耗时、完整返回集合及模型分布：`tests/.generated/scanner-performance.json`。

## 实际执行命令

每组均在项目根目录、同进程先激活 `. D:/Dev/Station/Profiles/node-24.ps1`（Node 24.22.2 / pnpm 11.18.0）。全部退出 0：

```powershell
pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --types node src/camera.ts tests/camera.test.ts tests/performance-harness.ts
pnpm exec esbuild tests/camera.test.ts --bundle --platform=node --format=cjs --outfile=tests/.generated/performance-camera.test.cjs
node --test tests/.generated/performance-camera.test.cjs
node tests/scanner-media-check.mjs
node tests/scanner-performance.mjs
```

只运行相关检查，未安装依赖、未运行全套项目/UI/原查看器检查、未构建/覆盖最终 HTML。性能基准的输入采样/Worker 选项在最后一个仅修正旧回调所有权的 guard 前后没有变化；最终生命周期和实际 media 烟测已重新运行。

## 父会话交接及未验证项

- **必须重新构建最终 HTML**；当前 output 文件没有自动获得源码优化。父会话负责一次最终集成构建/相关 suite，之后再更新 `verification.md`。
- 合成媒体必须产生不同新帧：持续 repaint canvas（或主动 requestFrame），不要用一张冻结图片被反复计为两次确认。已有 browser-check 若依赖冻结 canvas，请父会话在其测试所有权范围适配；本轮没有修改它。
- 未实测物理摄像头、权限 UI、实际采集分辨率/帧率、自动对焦、反光/失焦/运动模糊、低端 CPU/热降频/功耗、其他浏览器。高分辨率单帧成本可能使弱设备更慢；ideal 请求与软件收益不是硬件承诺。
- 全帧并不保证识别所有现实条码；模块数、对比度、分辨率、反光等仍有限制。max32 和有效/非分段过滤保持原有边界。
- 本轮实际 video/RVFC 与真实 WASM 已测；旧浏览器回退仅有确定性 mocks，未作真实浏览器兼容认证。原生板图选择、约300ms延迟、锁存与身份规则未改，但其最终派生产物集成由父会话验证。
