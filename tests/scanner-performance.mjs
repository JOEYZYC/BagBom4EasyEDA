// Software-only full-frame decoder benchmark. Does not read/execute a board or use a camera.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm/writer';

const repeats=5;
await prepareZXingModule({overrides:{wasmBinary:await readFile('node_modules/zxing-wasm/dist/writer/zxing_writer.wasm')},fireImmediately:true});
async function barcode(text,format='QRCode',scale=2){
  const result=await writeBarcode(text,{format,scale});assert.ok(result.image);
  return {text,format,png:Buffer.from(await result.image.arrayBuffer()).toString('base64')};
}
const denseText=JSON.stringify({pc:'C25900',pm:'0402WGF4701TCE',lot:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(10)});
const standard=await barcode('C25900','QRCode',6),small=await barcode('C999999','QRCode',2),dense=await barcode(denseText);
const conflict=await barcode('{"pc":"C25900","pm":"WRONG123"}','QRCode',3);
const formatCodes=await Promise.all([
  barcode('C25900','QRCode',5),barcode('DM123456','DataMatrix',5),barcode('CODE128-12345','Code128',2),
  barcode('ABC1234','Code39',2),barcode('PDF417-123456789','PDF417',3),
]);
const fixtures=[
  {name:'standard-qr',symbols:[{...standard,x:850,y:440}]},
  {name:'small-qr',symbols:[{...small,x:920,y:500}]},
  {name:'high-density-qr',symbols:[{...dense,x:850,y:420}]},
  {name:'rotated-qr-35deg',symbols:[{...standard,x:850,y:400,angle:35}]},
  {name:'multiple-large-and-small',symbols:[{...standard,x:180,y:180},{...small,x:1650,y:820}]},
  {name:'contradictory-json-and-code',symbols:[{...standard,x:200,y:200},{...conflict,x:1480,y:750}]},
  {name:'all-five-formats',symbols:formatCodes.map((code,i)=>({...code,x:100+(i%3)*570,y:140+Math.floor(i/3)*500}))},
  {name:'blank',symbols:[]},
];
const wasm=await readFile('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
const workerCode=`const WASM_BASE64=${JSON.stringify(wasm.toString('base64'))};\n`+
  await readFile('node_modules/zxing-wasm/dist/iife/reader/index.js','utf8')+'\n'+await readFile('src/decoder-worker.js','utf8');
const candidate=workerCode.replace('tryHarder: true','tryHarder: false').replace('tryDenoise: true','tryDenoise: false');
assert.notEqual(candidate,workerCode);
const harness=await build({entryPoints:['tests/performance-harness.ts'],bundle:true,write:false,format:'iife',target:'es2022'});
const scriptJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
await mkdir('tests/.generated',{recursive:true});
const path=resolve('tests/.generated/scanner-performance.html');
await writeFile(path,'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:; img-src data: blob:; connect-src \'none\'"><body><script>'+harness.outputFiles[0].text+
  ';window.perfInputs='+scriptJSON({workerCode,candidate,fixtures,repeats})+';</script>');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={repeats,frame:{width:1920,height:1080},network:[],pageErrors:[]};
try{
  const context=await browser.newContext({offline:true,viewport:{width:1000,height:800}});
  await context.route(/^https?:/,route=>{report.network.push(route.request().url());return route.abort();});
  await context.addInitScript(()=>{if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{throw Error('Real camera forbidden by software benchmark');};});
  const page=await context.newPage();page.on('pageerror',error=>report.pageErrors.push(error.message));
  await page.goto(pathToFileURL(path).href);
  report.browser=await browser.version();
  Object.assign(report,await page.evaluate(async()=>{
    const {workerCode,candidate,fixtures,repeats}=window.perfInputs;
    const configurations=[
      {name:'old-1280-robust-reset',cap:1280,reset:true,code:workerCode},
      {name:'new-1920-robust-reuse',cap:window.ScannerPerformance.CAPTURE_MAX_EDGE,reset:false,code:workerCode},
      {name:'candidate-1920-noHarder-noDenoise-NOT-shipped',cap:1920,reset:false,code:candidate},
    ];
    const readers=[];
    const summaries=[];
    try{
      for(const config of configurations){
        const url=URL.createObjectURL(new Blob([config.code],{type:'text/javascript'})),worker=new Worker(url);
        const start=performance.now();
        await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('decoder init timeout')),20000);
          worker.onerror=event=>{clearTimeout(timeout);reject(Error(event.message));};
          worker.onmessage=({data})=>{clearTimeout(timeout);data.error?reject(Error(data.error)):resolve(data);};worker.postMessage({init:true});});
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
        readers.push({...config,url,worker,canvas,context,initializationMs:performance.now()-start,id:0,resizeWrites:0});
      }
      for(const fixture of fixtures){
        const native=document.createElement('canvas');native.width=1920;native.height=1080;const nativeContext=native.getContext('2d');
        nativeContext.fillStyle='white';nativeContext.fillRect(0,0,native.width,native.height);
        for(const symbol of fixture.symbols){const image=new Image();image.src='data:image/png;base64,'+symbol.png;await image.decode();
          nativeContext.save();nativeContext.translate(symbol.x+image.width/2,symbol.y+image.height/2);nativeContext.rotate((symbol.angle||0)*Math.PI/180);
          nativeContext.drawImage(image,-image.width/2,-image.height/2);nativeContext.restore();}
        const expected=fixture.symbols.map(s=>`${s.format}:${s.text}`).sort();
        const samples=readers.map(reader=>({configuration:reader.name,preparationMs:[],decoderRoundtripMs:[],results:[],complete:[]}));
        // One warm-up per identical fixture/configuration, excluded from distributions.
        for(let repeat=-1;repeat<repeats;repeat++)for(let order=0;order<readers.length;order++){
          const i=(order+Math.max(0,repeat))%readers.length,reader=readers[i],sample=samples[i];
          const start=performance.now(),ratio=Math.min(1,reader.cap/1920),width=Math.round(1920*ratio),height=Math.round(1080*ratio);
          if(reader.reset||reader.canvas.width!==width){reader.canvas.width=width;reader.resizeWrites++;}
          if(reader.reset||reader.canvas.height!==height){reader.canvas.height=height;reader.resizeWrites++;}
          reader.context.drawImage(native,0,0,width,height);const pixels=reader.context.getImageData(0,0,width,height).data;
          const prepared=performance.now(),id=++reader.id;
          const results=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('decoder timeout')),20000);
            reader.worker.onmessage=({data})=>{if(data.id!==id)return;clearTimeout(timeout);data.error?reject(Error(data.error)):resolve(data.results);};
            reader.worker.postMessage({id,pixels:pixels.buffer,width,height},[pixels.buffer]);});
          if(repeat>=0){const values=results.map(r=>`${r.format}:${r.text}`).sort();sample.preparationMs.push(prepared-start);sample.decoderRoundtripMs.push(performance.now()-prepared);
            sample.results.push(values);sample.complete.push(JSON.stringify(values)===JSON.stringify(expected));}
        }
        summaries.push({fixture:fixture.name,expected,samples});
      }
      return {initialization:readers.map(r=>({configuration:r.name,ms:r.initializationMs,resizeWrites:r.resizeWrites})),
        captureLimits:{maxEdge:window.ScannerPerformance.CAPTURE_MAX_EDGE,maxPixels:window.ScannerPerformance.CAPTURE_MAX_PIXELS},
        pacing:{newMinimumStartIntervalMs:window.ScannerPerformance.MIN_CAPTURE_INTERVAL_MS,oldPostDecodeWaitMs:220,assumedFreshFramePeriodMs:1000/30},fixtures:summaries};
    }finally{readers.forEach(reader=>{reader.worker.terminate();URL.revokeObjectURL(reader.url);});}
  }));
  const distribution=values=>{const sorted=[...values].sort((a,b)=>a-b);return {min:sorted[0],median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
  for(const fixture of report.fixtures)for(const sample of fixture.samples){sample.preparation=distribution(sample.preparationMs);sample.decoderRoundtrip=distribution(sample.decoderRoundtripMs);}
  for(const fixture of report.fixtures){
    const old=fixture.samples[0],next=fixture.samples[1],period=report.pacing.assumedFreshFramePeriodMs;
    const totals=sample=>sample.preparationMs.map((prep,i)=>prep+sample.decoderRoundtripMs[i]);
    const oldCosts=totals(old),newCosts=totals(next);
    fixture.firstTwoEligibleModel={oldMs:distribution(oldCosts.map((cost,i)=>cost+220+oldCosts[(i+1)%repeats])),
      newLowerMs:distribution(newCosts.map((cost,i)=>Math.max(report.pacing.newMinimumStartIntervalMs,cost)+newCosts[(i+1)%repeats])),
      newUpperMs:distribution(newCosts.map((cost,i)=>Math.max(report.pacing.newMinimumStartIntervalMs,cost)+period+newCosts[(i+1)%repeats]))};
  }
  report.newRobustComplete=report.fixtures.every(fixture=>fixture.samples[1].complete.every(Boolean));
  report.decoderVersion=JSON.parse(await readFile('node_modules/zxing-wasm/package.json','utf8')).version;
  report.notes=['WASM initialization/warm-up excluded from per-frame samples. Each configuration scans the same whole frame; five formats and max32 unchanged.',
    'Decoder roundtrip includes Worker IPC and actual WASM work, not the old artificial 220ms wait. Candidate settings are test-only and not shipped.',
    'First-two eligibility is a model from the first sampled frame, using adjacent measured frame costs. New bounds allow 0..one 30fps frame period for a fresh frame. Permission/init/native ~300ms selection are excluded; unknown/conflicting/blank frames are never eligible matches.',
    'Synthetic sharp fixtures are not physical camera/reflective-label evidence; no timing thresholds are asserted.'];
  assert.deepEqual(report.network,[]);assert.deepEqual(report.pageErrors,[]);
  assert.equal(report.newRobustComplete,true,'1920 robust pipeline must recover every declared full-frame fixture');
  report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally{await writeFile('tests/.generated/scanner-performance.json',JSON.stringify(report,null,2));await browser.close();
  console.log(JSON.stringify({result:report.result,browser:report.browser,newRobustComplete:report.newRobustComplete,
    fixtures:report.fixtures?.map(f=>({name:f.fixture,samples:f.samples.map(s=>({configuration:s.configuration,complete:s.complete,preparation:s.preparation,decoderRoundtrip:s.decoderRoundtrip}))})),network:report.network,failure:report.failure},null,2));}
