import {mountEnhancer} from './ui/index.ts';
import type {EnhanceResult} from './contracts.ts';
import {enhance} from './enhance.ts';
declare const __SCANNER_RUNTIME__: string;
declare const __NOTICES__: string;
const root = document.getElementById('app')!;
let generation = 0, result: EnhanceResult | undefined, downloadURL: string | undefined;
const release = () => {if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = undefined;};
const view = mountEnhancer(root, {
  chooseFile: file => {
    const current = ++generation; result = undefined; release();
    view.render({phase: 'reading', message: '正在本机读取 UTF-8 文件；不执行选中的文件', sourceFilename: file.name});
    void (async () => {
      try {
        if (file.size > 80_000_000) throw new Error('文件超过 80MB 限制');
        const bytes = await file.arrayBuffer();
        if (current !== generation) return;
        view.render({phase: 'enhancing', message: '校验数据边界并嵌入本地解码资源…', sourceFilename: file.name});
        const output = await enhance(bytes, file.name, __SCANNER_RUNTIME__, __NOTICES__);
        if (current !== generation) return;
        result = output;
        view.render({phase: 'ready', message: `已生成独立文件；原件未改变。${output.warnings.length} 条无身份/歧义诊断。仅增强你信任的原生导出；下载文件仍包含原查看器代码。`,
          sourceFilename: file.name, suggestedFilename: output.suggestedFilename});
      } catch (error) {
        if (current === generation) view.render({phase: 'error', message: error instanceof Error ? error.message : String(error), sourceFilename: file.name});
      }
    })();
  },
  download: () => {
    if (!result) return;
    release(); downloadURL = URL.createObjectURL(new Blob([result.html], {type: 'text/html;charset=utf-8'}));
    const link = document.createElement('a'); link.href = downloadURL; link.download = result.suggestedFilename;
    document.body.append(link); link.click(); link.remove();
  },
});
const notices = document.createElement('details'); const summary = document.createElement('summary');
summary.textContent = '第三方许可 / 本地增强边界'; const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = __NOTICES__;
notices.append(summary, pre); document.body.append(notices);
window.addEventListener('pagehide', () => {generation++; result = undefined; release(); view.destroy();}, {once: true});
