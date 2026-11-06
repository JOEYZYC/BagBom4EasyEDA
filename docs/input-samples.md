# 原生 HTML 输入样本

用户在工作区新增 `input/`，说明其中为立创直接导出的 HTML。该目录内文件按原件只读处理，不移动、改写或覆盖；生成成品仍放 `output/`。

## 2026-11-06 静态检查

父会话使用现有 `src/native.ts` 的严格 UTF-8、JSON 边界及索引读取函数处理文本；没有运行原 HTML 或其嵌入脚本，没有打开相机或访问网络。

| 文件 | 字节数 | 索引装配器件 | 有效 C 编号器件 | 跳过身份缺失 | 静态解析 |
| --- | ---: | ---: | ---: | ---: | --- |
| `input/InteractiveBOM_PCB_Back_2026-11-6.html` | 9,189,105 | 50 | 18 | 32 | 通过 |
| `input/InteractiveBOM_CM4_ascii_2026-11-6.html` | 8,044,670 | 7 | 2 | 5 | 通过 |

两份索引均仅含顶层装配记录；以上数量是当前安全解析器形成的索引统计，不代表整个 PCB 预览的所有图形或未装配器件。

SHA-256：

- Back：`8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B`。与此前 `G:/Downloads/InteractiveBOM_PCB_Back_2026-11-6.html` 完全相同。
- CM4：`D1D3B244EC1F34DB6C6EC3F65A7F5B37D92EDE9BC41C411B6A1EB74C8BD569D8`。

## 证据边界

- VERIFIED（静态数据解析）：两份原始文件可被现有解析/索引入口接受。
- 未据此验证 CM4 的实际浏览器行选中、高亮或摄像头识别；Back 的先前派生查看器运行证据见 [verification.md](verification.md)。
- 身份缺失与解码性能是两个问题：二维码被成功解出，也不意味着缺有效编号的 BOM 器件能被精确匹配。不得用阻值、封装或模糊搜索补猜。
- 性能改进之后已对 Back 完成派生成品验收，见 [verification.md](verification.md)。原 Downloads 路径已不可用，当前构建与测试使用 input 中同哈希原件；未执行移动、复制或改写。CM4 的静态可读性仍不等于实际行选择验收。
