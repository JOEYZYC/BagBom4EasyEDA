import {build} from 'esbuild';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {enhance,NETWORK_POLICY} from '../src/enhance.ts';
import {buildOutputPaths,writeBuildOutputs} from './output-paths.mjs';

const source = resolve(process.argv[2] || 'input/InteractiveBOM_PCB_Back_2026-11-6.html');
const knownHash = '8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B';
const hash = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const bytes = await readFile(source);
if (!process.argv[2] && (hash(bytes) !== knownHash || bytes.length !== 9189105)) throw new Error('Specimen identity changed; refusing build');
const reference = 'references/bag-bom/';
const licensePaths = ['LICENSE','NOTICE','third_party/ZXING-CPP-LICENSE.txt','third_party/STB-LICENSE.txt','third_party/EMSCRIPTEN-LICENSE.txt'];
const notices = ['===== BagBom4EasyEDA Apache-2.0 =====\n'+await readFile('LICENSE','utf8'),
  '===== BagBom4EasyEDA NOTICE =====\n'+await readFile('NOTICE','utf8'),
  await readFile('THIRD_PARTY_NOTICES.md','utf8'),
  ...(await Promise.all(licensePaths.map(async path => `\n===== ${path} =====\n${await readFile(reference+path,'utf8')}`))),
  '\n===== zxing-wasm 3.1.6 MIT =====\n'+await readFile('node_modules/zxing-wasm/LICENSE','utf8')].join('\n');
const wasm = await readFile('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
const worker = `const WASM_BASE64=${JSON.stringify(wasm.toString('base64'))};\n`+
  await readFile('node_modules/zxing-wasm/dist/iife/reader/index.js','utf8')+'\n'+await readFile('src/decoder-worker.js','utf8');
const umd = await readFile(reference+'bag_bom/web/matcher.js','utf8')+'\n'+await readFile(reference+'bag_bom/web/barcodes.js','utf8');
async function bundle(entry, define = {}) {
  const result = await build({entryPoints:[entry],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define});
  return result.outputFiles[0].text;
}
const scanner = umd+'\n'+await bundle('src/scanner.ts', {__WORKER_SOURCE__:JSON.stringify(worker)});
const enhancer = await bundle('src/enhancer.ts', {__SCANNER_RUNTIME__:JSON.stringify(scanner),__NOTICES__:JSON.stringify(notices)});
const enhanced = await enhance(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), source.split(/[\\/]/).at(-1), scanner, notices);
const paths = buildOutputPaths(process.cwd(), enhanced.suggestedFilename);
const tool = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+NETWORK_POLICY+'<meta name="viewport" content="width=device-width,initial-scale=1"><title>原生 BOM HTML 本地增强</title></head><body><main id="app"></main><script>'+enhancer.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
const harness = umd+'\n'+await bundle('tests/browser-harness.ts',{__WORKER_SOURCE__:JSON.stringify(worker)});
await writeBuildOutputs(source, [
  {path: paths.tool, contents: tool},
  {path: paths.enhanced, contents: enhanced.html},
  {path: paths.notices, contents: notices},
  {path: paths.harness, contents: '<!doctype html><head><meta charset="utf-8">'+NETWORK_POLICY+'</head><body><script>'+harness.replace(/<\/script/gi,'<\\/script')+'</script>'},
]);
if (hash(await readFile(source)) !== hash(bytes)) throw new Error('Source hash changed during build');
console.log(JSON.stringify({source,sourceSHA256:hash(bytes),sourceBytes:bytes.length,output:paths.enhanced,outputBytes:(await stat(paths.enhanced)).size,
  enhancerBytes:Buffer.byteLength(tool),wasmBytes:wasm.length,diagnostics:enhanced.warnings.length},null,2));
