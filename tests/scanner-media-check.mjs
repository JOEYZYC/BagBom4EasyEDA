// Actual LocalCamera/video/inline Worker/WASM, driven only by a repainted synthetic canvas.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm/writer';
await prepareZXingModule({overrides:{wasmBinary:await readFile('node_modules/zxing-wasm/dist/writer/zxing_writer.wasm')},fireImmediately:true});
const qr=await writeBarcode('C25900',{format:'QRCode',scale:5});
const png=Buffer.from(await qr.image.arrayBuffer()).toString('base64');
const wasm=await readFile('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
const workerCode=`const WASM_BASE64=${JSON.stringify(wasm.toString('base64'))};\n`+
  await readFile('node_modules/zxing-wasm/dist/iife/reader/index.js','utf8')+'\n'+await readFile('src/decoder-worker.js','utf8');
const harness=await build({entryPoints:['tests/performance-harness.ts'],bundle:true,write:false,format:'iife',target:'es2022'});
const scriptJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
await mkdir('tests/.generated',{recursive:true});const path=resolve('tests/.generated/scanner-media.html');
await writeFile(path,'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:; img-src data: blob:; media-src blob:; connect-src \'none\'"><body><script>'+harness.outputFiles[0].text+
  ';window.mediaInputs='+scriptJSON({workerCode,png})+';</script>');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={network:[],pageErrors:[]};
try{
  const context=await browser.newContext({offline:true,viewport:{width:1000,height:800}});
  await context.route(/^https?:/,route=>{report.network.push(route.request().url());return route.abort();});
  await context.addInitScript(()=>{window.realCameraCalls=0;if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.realCameraCalls++;throw Error('Physical camera forbidden');};});
  const page=await context.newPage();page.on('pageerror',error=>report.pageErrors.push(error.message));await page.goto(pathToFileURL(path).href);
  Object.assign(report,await page.evaluate(async()=>{
    const {png,workerCode}=window.mediaInputs;
    const source=document.createElement('canvas');source.width=1920;source.height=1080;const context=source.getContext('2d');
    const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();let drawn=0;
    const draw=()=>{context.fillStyle='white';context.fillRect(0,0,source.width,source.height);context.drawImage(image,850,430);
      context.fillStyle='black';context.fillRect(++drawn%100,0,1,1);};draw();
    const repaint=setInterval(draw,33),stream=source.captureStream(30),video=document.createElement('video');video.width=640;video.height=360;document.body.append(video);
    const frames=[],captureStarts=[],presented=[],states=[];let generation=0,liveJobs=0,maxJobs=0,terminated=0,released=0;
    const request=video.requestVideoFrameCallback.bind(video);
    video.requestVideoFrameCallback=callback=>request((now,metadata)=>{presented.push(metadata.mediaTime);callback(now,metadata);});
    let camera;let timeout;
    try{
      await new Promise(async(resolve,reject)=>{
        timeout=setTimeout(()=>reject(Error('two fresh synthetic frames were not decoded')),20000);
        camera=new window.ScannerPerformance.LocalCamera(video,{getUserMedia:async()=>stream,enumerateDevices:async()=>[]},()=>{
          const url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'})),worker=new Worker(url);
          const post=worker.postMessage.bind(worker),terminate=worker.terminate.bind(worker);
          worker.postMessage=(data,...args)=>{if(data.id){liveJobs++;maxJobs=Math.max(maxJobs,liveJobs);captureStarts.push({id:data.id,time:performance.now(),mediaTime:presented.at(-1),width:data.width,height:data.height});}return post(data,...args);};
          worker.addEventListener('message',({data})=>{if(data.id)liveJobs--;});
          worker.terminate=()=>{terminated++;terminate();};return {worker,release:()=>{released++;URL.revokeObjectURL(url);}};
        },{generation:()=>generation,invalidate:()=>generation++,devices:()=>{},state:(phase,message,active)=>{states.push({phase,active});if(phase==='error')reject(Error(message));},
          frame:(payloads,inputGeneration)=>{frames.push({payloads,inputGeneration,time:performance.now()});if(frames.length===2)resolve();}});
        await camera.start();
      });
      clearTimeout(timeout);window.addEventListener('pagehide',()=>camera.stop(),{once:true});window.dispatchEvent(new Event('pagehide'));clearInterval(repaint);
      const frameCount=frames.length;await new Promise(resolve=>setTimeout(resolve,250));
      return {frames,captureStarts,presented,states,maxJobs,terminated,released,lateFrames:frames.length-frameCount,
        trackState:stream.getTracks()[0].readyState,videoCleared:video.srcObject===null,realCameraCalls:window.realCameraCalls,
        firstTwoEligibleMs:frames[1].time-captureStarts[0].time};
    }finally{clearTimeout(timeout);clearInterval(repaint);camera?.stop();stream.getTracks().forEach(track=>track.stop());}
  }));
  assert.equal(report.frames.length,2);assert.ok(report.frames.every(frame=>JSON.stringify(frame.payloads)==='["C25900"]'));
  assert.notEqual(report.captureStarts[0].mediaTime,report.captureStarts[1].mediaTime);
  assert.ok(report.captureStarts.every(frame=>frame.width===1920&&frame.height===1080));
  assert.equal(report.maxJobs,1);assert.equal(report.realCameraCalls,0);assert.equal(report.lateFrames,0);
  assert.equal(report.trackState,'ended');assert.equal(report.videoCleared,true);assert.equal(report.terminated,1);assert.equal(report.released,1);
  assert.deepEqual(report.network,[]);assert.deepEqual(report.pageErrors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally{await writeFile('tests/.generated/scanner-media-report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
