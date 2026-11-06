# BagBom4EasyEDA

立创原生 BOM HTML 扫码增强。项目仓库：<https://github.com/JOEYZYC/BagBom4EasyEDA>。

保留原生焊接辅助查看器，只把完整料号输入转换为原来的 BOM 单击选择。**使用成品不需要安装 Node.js、启动服务或联网。**

## 直接使用

- 已为本次原件生成：[`output/InteractiveBOM_PCB_Back_2026-11-6_扫码版.html`](output/InteractiveBOM_PCB_Back_2026-11-6_扫码版.html)。用现代 Chrome/Edge 打开，先输入 **C25900**，应定位 **R1、R2、R4**。
- 处理下一份兼容的原生导出：打开 [`output/html-enhancer.html`](output/html-enhancer.html)，选择原生 HTML，下载新的“_扫码版.html”，再打开下载文件。文件读取、增强和下载都在浏览器本地进行；原件不会被程序覆写。
- 扫码必须由你点击“开启摄像头扫码”并授权。真实相机/真实料袋尚未代你测试。

完整操作与失败处理见 [使用说明](docs/usage.md)，证据与未验证项见 [验证记录](docs/verification.md)。

## 安全边界

不做 OCR、云查询、参数/封装猜测、模糊匹配或自动焊接勾选。混合/缺失身份、多码冲突、隐藏目标、无法完整表达的多位号选择均拒绝。原生手动操作优先，会暂停扫码。停止/失败不假装清除旧板图高亮。

查看器附加网络 CSP，阻断原包的后台在线字体/API/资源请求；原厂核心不改写。仅处理你信任的原生导出：增强器不执行输入文件，但下载文件仍含输入原有的可执行查看器。

原厂查看器公开再分发许可未确认。含 PCB/模型的扫码版只供用户本机使用，不要公开上传。[第三方通知](THIRD_PARTY_NOTICES.md)及完整许可已内嵌到成品中。

## 开发者复现（普通用户不需要）

Git 仅管理本项目源码、测试、依赖锁和文档。`input/` 原始板图、`output/` 生成文件、`node_modules/`、`tests/.generated/` 及 `references/` 独立参考检出均不入库，不公开上传原厂查看器或 PCB 数据。新机器需另行准备可信原生导出及 [固定版本参考源码](docs/reference-status.md)，仅克隆主仓库不包含这些本地材料。

依赖固定于 `package.json` / `pnpm-lock.yaml`；Node 24、pnpm 11.18.0。此工作站每次在同一个非交互进程激活指定 Profile：

```powershell
. D:/Dev/Station/Profiles/node-24.ps1; pnpm install --frozen-lockfile
. D:/Dev/Station/Profiles/node-24.ps1; pnpm typecheck
. D:/Dev/Station/Profiles/node-24.ps1; pnpm test
. D:/Dev/Station/Profiles/node-24.ps1; pnpm test:ui
. D:/Dev/Station/Profiles/node-24.ps1; pnpm build
. D:/Dev/Station/Profiles/node-24.ps1; pnpm test:browser
```

默认构建只读 `input/InteractiveBOM_PCB_Back_2026-11-6.html`，先检查已记录的大小/哈希，再写入项目的 `output/`。所有工具、扫码版、通知和测试 harness 输出在任何 mkdir/write 前统一核对源路径、真实路径及文件身份；源文件别名冲突或身份不确定时拒绝整个写入计划。不要并发改变源文件/输出路径或符号链接。`pnpm build <另一个原生HTML路径>` 可为另一份兼容导出构建；默认的浏览器验证则明确针对本次样本。浏览器测试使用 `playwright-core` 和已安装 Chrome，不下载浏览器、不使用用户配置、不允许真实摄像头。

没有新增 `.devtools.json`。父目录指示的旧 `devrun.exe` 不存在；遵循当前工作站规则，使用上述 Node Profile，不修改工作站/PATH。
