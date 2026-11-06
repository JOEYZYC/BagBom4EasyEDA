# BagBom4EasyEDA

[English](README.md) | **简体中文**

为原生**立创 EDA / EasyEDA 专业版焊接辅助 BOM HTML 导出**增加本地扫码。保留原 BOM、3D/简图和手工焊接流程，将精确识别的料号转换为原 BOM 行的单击操作。

这是独立浏览器增强工具，**不是客户端扩展、官方 API 集成或重建的 iBOM**。仓库：<https://github.com/JOEYZYC/BagBom4EasyEDA>。

## 状态

**0.2.0 已通过本地软件验证**，包括有界纯文本扫码诊断、复制及手动复制降级、同码重新识别。实体标签识别与相机权限仍须在你的实际环境中验证。参见[扫码诊断](docs/scan-diagnostics.md)与[验证记录](docs/verification.md)。

## 使用本机构建文件

Git 仓库及源码检出**不包含生成的 HTML 或原厂查看器**。请另行准备兼容的原生导出，按下文在本机构建，或使用自己已经构建的文件。

1. 在立创 PCB 中选择 **工具 → 焊接辅助工具 → 导出 → 离线Html**。
2. 用桌面 Chrome 或 Edge 打开本机构建的 `output/html-enhancer.html`。
3. 选择**可信、未经改动的原生 HTML 导出**，例如 `input/board.html`；不要选择 CSV、XLSX 或已增强文件。
4. 下载新的 `*_扫码版.html` 并打开，不要覆盖原件。
5. 使用“位号聚合”，清除搜索及显示过滤，先用自己 BOM 中的完整供应商 C 编号手动验证定位。
6. 点击“开启摄像头扫码”并授权，核对完整目标位号集合与原查看器响应。

使用成品**不需要 Node.js、服务器或 CDN**。本地文件的摄像头支持取决于浏览器运行环境与权限，不要绕过浏览器安全限制。**停止**会释放相机，收起面板不会。原生手动操作会暂停扫码。换用新构建时，关闭旧标签页并重新打开新文件；其他板子须用新版增强器从未改动的原件重新生成。

更多：[使用说明](docs/usage.md) · [文档索引](docs/README.md)。

## 精确匹配与安全边界

- 完整供应商 C 编号或已验证的完整 MPN，必须对应完整原生行/位号集合。不做模糊匹配、参数/封装猜测、OCR、云查询或自动“已焊接”勾选。
- 混合、冲突、不完整或缺失身份、隐藏目标、不支持的多行选择均拒绝，不只选一部分。拒绝后旧高亮可能仍保留，不能当作本次成功。
- 保留原单击本来具有的居中或翻面行为。不承诺客户端集成、进度同步或新增进度持久化。
- 增强器只读取数据，不执行输入文件；**生成文件仍包含可执行的原厂查看器，因此只使用可信导出**。兼容范围限于已提供的导出家族，不保证所有 V4 导出。
- 扫码和解码在本地进行。诊断只在内存中保留有界纯文本，不保存图像、上传日志或持久化扫码历史。褶皱、反光及遮挡仍可能导致无法解码。

## 开发

包名：`bagbom4easyeda`。使用 **Node 24**、**pnpm 11.18.0**。

源码构建需要位于 `references/bag-bom` 的只读参考检出，固定至公开上游提交 `1fc1e0b2abd8b023ba01e6000c4110d72d94860c`。若尚未准备，可自行选择执行以下命令：

```sh
git clone https://github.com/egethropic/bag-bom.git references/bag-bom
git -C references/bag-bom checkout --detach 1fc1e0b2abd8b023ba01e6000c4110d72d94860c
```

保持参考检出不变。另行在 `input/board.html` 准备兼容导出后：

```sh
pnpm install --frozen-lockfile
pnpm exec node scripts/build.mjs input/board.html
```

相关检查命令（夹具前提见下文；列出命令不代表检查通过）：

```sh
pnpm typecheck
pnpm test
pnpm test:ui
pnpm test:browser
pnpm exec node tests/scanner-media-check.mjs
pnpm exec node scripts/browser-check.mjs --refinement
```

完整集成测试需要另行准备未入库的兼容原生导出/夹具配置、已安装的 Chrome/Edge 和隔离自动化环境。部分脚本仍有本地夹具默认值，仅克隆仓库不能获得可直接运行的完整集成夹具。自动化媒体检查仅使用合成媒体，并阻止真实摄像头访问。

`input/`、`output/`、`references/`、`node_modules/`、`tests/.generated/` 和 `.env` 被忽略，不入 Git。构建在写入前对全部四个输出目标检查源路径、真实路径及文件身份别名，并核对源文件保全哈希；外部并发改变路径不在该保证范围内。参见[输入要求](docs/input-samples.md)与[参考及依赖说明](docs/reference-status.md)。

## 许可与致谢

当前 `main` 上的本项目原创代码及文档采用 **Apache-2.0 许可**，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。该许可不会重新授权第三方或原厂材料。

项目参考 [egethropic/bag-bom](https://github.com/egethropic/bag-bom)（Apache-2.0），保留所适用的版权声明及改编解码 Worker 的修改通知。解码依赖包括 zxing-wasm（MIT）、ZXing-C++（Apache-2.0）、stb（MIT/公有领域）和 Emscripten（MIT/NCSA）。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本项目的 Apache-2.0 许可**不授予**原厂查看器、板图数据或模型的权利。尚未建立原厂查看器的公开再分发授权，请勿公开发布生成的查看器 HTML。

历史 `v0.2.0` 标签保留其原始 **MIT** 许可快照，不改写现有标签或历史。本次许可变更以当前 `main` 为准。Apache-2.0 构建及内嵌通知已另行验证，参见[验证记录](docs/verification.md)。此处不宣布新版本、标签或 GitHub Release。
