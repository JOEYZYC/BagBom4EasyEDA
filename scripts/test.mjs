import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/core.test.ts','tests/camera.test.ts'],bundle:true,platform:'node',format:'cjs',outdir:'tests/.generated/unit',outExtension:{'.js':'.cjs'}});
const result=spawnSync(process.execPath,['--test','tests/.generated/unit/core.test.cjs','tests/.generated/unit/camera.test.cjs','tests/build-paths.test.mjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
