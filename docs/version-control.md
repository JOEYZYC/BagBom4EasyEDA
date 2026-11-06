# 本地版本管理

项目：**BagBom4EasyEDA**。本地分支：`main`。已配置 `origin` 为用户提供的 GitHub 仓库，但当前只做本地版本管理，不访问或推送云端。

## 入库范围

- 管理源码、测试、构建脚本、依赖锁、说明与验证记录。
- 不管理 `input/` 原始板图、`output/` 增强成品、`references/` 独立参考检出、`node_modules/`、`tests/.generated/` 及本地环境文件；这些文件仍保留在本机。
- 新机器需自行准备原生导出和固定参考源码，不能仅凭主仓库恢复用户板图。

## 提交约定

1. 功能修改完成后，先运行受影响的检查；生成成品另行验证。
2. 用 `git status --short`、`git diff` 检查实际改动，再暂存需要的源码。
3. 提交前用 `git diff --cached --stat`、`git diff --cached --name-only` 核对范围，确认没有原始 HTML、板图、截图或依赖目录。
4. 使用说明明确的提交信息。软件验收里程碑使用本地 `vX.Y.Z` 标记，不重写已有历史。

首个已验收软件快照使用 `v0.1.0`：32 项测试、类型检查、派生查看器集成与实际合成媒体均通过，未改 UI 的专项复用有效旧证据。不补造之前未提交的历史，具体提交以本地 `git log --oneline --decorate` 为准。真实相机/光照表现与软件测试分开记录，成品不入库但其 SHA-256 已记录在 [verification.md](verification.md)。

## 常用只读命令

```powershell
git status --short
git log --oneline --decorate
git show --stat HEAD
git tag --list
```

这些命令不会回滚或删除工作文件。暂不执行 `push`、远端同步、强制覆盖或清理命令。
