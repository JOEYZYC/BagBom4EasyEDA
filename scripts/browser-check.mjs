import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm/writer';
import {extractFiles,readSnapshot,MARKER} from '../src/native.ts';
import {NETWORK_POLICY} from '../src/enhance.ts';

const root=process.cwd();
const url=path=>pathToFileURL(resolve(root,path)).href;
const hash=data=>createHash('sha256').update(data).digest('hex');
const source='input/InteractiveBOM_PCB_Back_2026-11-6.html';
const before=hash(await readFile(source));
const enhanced='output/InteractiveBOM_PCB_Back_2026-11-6_扫码版.html';
const refinement=process.argv.includes('--refinement');
const reselectRegression=process.argv.includes('--reselect-regression');
const report={checks:[],network:[],errors:[],native:[]};
await mkdir('tests/.generated',{recursive:true});
await prepareZXingModule({overrides:{wasmBinary:await readFile('node_modules/zxing-wasm/dist/writer/zxing_writer.wasm')},fireImmediately:true});
const qr=await writeBarcode('C25900',{format:'QRCode',scale:8});assert.ok(qr.image);
const png=Buffer.from(await qr.image.arrayBuffer()).toString('base64');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const contexts=[];
async function pageFor(path,syntheticPNG,twoFramesOnly=false,pauseOnPayload) {
  const context=await browser.newContext({viewport:{width:1500,height:1000},offline:true,acceptDownloads:true});contexts.push(context);
  await context.route(/^https?:/,route=>{report.network.push(route.request().url());return route.abort();});
  await context.addInitScript(({syntheticPNG,twoFramesOnly,pauseOnPayload})=>{
    window.__cameraRequests=0;
    if(pauseOnPayload){
      // Test-only pause after one actual decoded B frame, before any second B frame.
      const request=HTMLVideoElement.prototype.requestVideoFrameCallback;
      HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){
        return request.call(this,(...args)=>{if(!window.__pauseVideoFrames)callback(...args);});
      };
    }
    if(twoFramesOnly||pauseOnPayload){
      window.__limitedDecoderResults=[];
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker{
        constructor(...args){
          super(...args);this.__pixelRequests=0;
          this.addEventListener('message',({data})=>{
            if(this.__pixelRequests&&typeof data.id==='number'&&Array.isArray(data.results)){
              window.__limitedDecoderResults.push({at:performance.now(),texts:data.results.map(result=>result.text)});
              if(pauseOnPayload&&data.results.some(result=>result.text===pauseOnPayload))window.__pauseVideoFrames=true;
            }
          });
        }
        postMessage(data,...args){
          const pixels=data&&typeof data.id==='number'&&data.pixels instanceof ArrayBuffer&&data.width&&data.height;
          if(pixels)this.__pixelRequests++;
          const result=super.postMessage(data,...args);
           if(pixels&&twoFramesOnly&&this.__pixelRequests===2&&window.__syntheticCanvas){
            // Pixel buffer #2 is already captured/transferred. Subsequent real frames are blank.
            const canvas=window.__syntheticCanvas,context=canvas.getContext('2d');
            context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
          }
          return result;
        }
      };
    }
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia=async()=>{
      window.__cameraRequests++;
      if (!syntheticPNG) throw new DOMException('Test forbids real camera','NotAllowedError');
      const image=new Image();image.src='data:image/png;base64,'+syntheticPNG;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
      const stream=canvas.captureStream(30);
      let pulse=0;
      const repaint=setInterval(()=>{
        if(stream.getTracks().every(track=>track.readyState==='ended')){clearInterval(repaint);return;}
        // Change one quiet-zone corner pixel, preserving later test updates to the QR image.
        const context=canvas.getContext('2d');context.fillStyle=++pulse%2?'white':'black';context.fillRect(0,0,1,1);
      },33);
      window.addEventListener('pagehide',()=>clearInterval(repaint),{once:true});
      window.__syntheticCanvas=canvas;window.__syntheticStream=stream;return stream;
    };
    if (syntheticPNG && navigator.mediaDevices) navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'synthetic',label:'Synthetic QR fixture, not a physical camera'}];
  },{syntheticPNG,twoFramesOnly,pauseOnPayload});
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(url(path));return page;
}
async function ready(page) {
  await page.locator('#founded > tbody > tr').first().waitFor();
  await page.getByTestId('manual-code').waitFor();await page.waitForTimeout(1500);
}
async function waitNativeSelected(page) {
  await page.waitForFunction(()=>{
    const output=document.querySelector('[data-testid="scanner-host"]')?.shadowRoot?.querySelector('[data-testid="scan-output"]');
    const message=output?.querySelector('[data-testid="scan-output-message"]')?.textContent||'';
    return output?.dataset.status==='selected'||output?.dataset.status==='suppressed'&&message.startsWith('同一码仍在画面中');
  });
}
async function scanOutput(page) {
  return page.evaluate(()=>{
    const shadow=document.querySelector('[data-testid="scanner-host"]').shadowRoot;
    const meta=shadow.querySelector('[data-testid="scan-frame-info"]').textContent;
    return {status:shadow.querySelector('[data-testid="scan-output"]').dataset.status,
      message:shadow.querySelector('[data-testid="scan-output-message"]').textContent,
      text:shadow.querySelector('[data-testid="scan-text"]').value,meta,frames:Number(meta.match(/已处理 (\d+) 帧/)[1])};
  });
}
async function waitScanStatus(page,status) {
  await page.waitForFunction(status=>document.querySelector('[data-testid="scanner-host"]')?.shadowRoot?.querySelector('[data-testid="scan-output"]')?.dataset.status===status,status);
}
async function setSyntheticCodes(page,pngs) {
  await page.evaluate(async pngs=>{
    const canvas=window.__syntheticCanvas;
    const images=await Promise.all(pngs.map(async png=>{const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();return image;}));
    if(images.length){canvas.width=images.reduce((width,image)=>width+image.width,0);canvas.height=Math.max(...images.map(image=>image.height));}
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
    let x=0;for(const image of images){context.drawImage(image,x,0);x+=image.width;}
  },pngs);
}
async function trace(page) {
  await page.evaluate(()=>{
    window.__trace=[];
    const bus=window._MSG_BUS_,original=bus.rpcCall;
    bus.rpcCall=function(...args){window.__trace.push(JSON.parse(JSON.stringify(args)));return original.apply(this,args);};
  });
}
async function selectionState(page) {
  return page.evaluate(()=>({
    rows:[...document.querySelectorAll('#founded > tbody > tr')].filter(r=>r.style.backgroundColor==='rgb(230, 247, 255)').map(r=>r.cells[1].firstElementChild?.textContent),
    checkboxes:[...document.querySelectorAll('#smt-ui-container input[type="checkbox"]')].map(i=>i.checked),
    trace:window.__trace.filter(args=>args[0]==='/engine/model/setModelChecked'||args[0]==='/engine/camera/setTarget'),
    cameraRequests:window.__cameraRequests,
  }));
}
async function boardImage(page,path) {
  // Hide only the enhancement presentation, not the original viewer or its engine.
  await page.locator('#bagbom-scanner').evaluate(el=>{el.style.visibility='hidden';});
  const canvases=await page.locator('canvas').all();
  let chosen,area=0;
  for(const canvas of canvases){const box=await canvas.boundingBox();if(box&&box.width*box.height>area){chosen=canvas;area=box.width*box.height;}}
  assert.ok(chosen&&area>100000,'actual engine canvas must be visible');
  const image=await chosen.screenshot({path});
  await page.locator('#bagbom-scanner').evaluate(el=>{el.style.visibility='';});
  return hash(image);
}
async function verifyDispatchCancellation(page) {
  const previous=(await selectionState(page)).rows;
  await page.evaluate(()=>{
    window.__trace=[];window.__dispatchProof={clicks:0,dblclicks:0,at:0,modifiers:[]};
    const observe=event=>{
      if(event.isTrusted||!(event.target instanceof HTMLTableRowElement)||!event.target.closest('#smt-ui-container'))return;
      if(event.type==='click'){window.__dispatchProof.clicks++;window.__dispatchProof.at=performance.now();
        window.__dispatchProof.modifiers.push([event.ctrlKey,event.shiftKey,event.altKey,event.metaKey]);}
      else window.__dispatchProof.dblclicks++;
    };
    document.addEventListener('click',observe,true);document.addEventListener('dblclick',observe,true);
  });
  await page.getByTestId('manual-code').fill('C2935915');await page.getByTestId('manual-submit').click();
  await page.waitForFunction(()=>window.__dispatchProof.clicks===1);
  assert.match(await page.getByTestId('scanner-status').innerText(),/正在核对/);
  const elapsed=await page.evaluate(()=>performance.now()-window.__dispatchProof.at);
  assert.ok(elapsed<280,'test must invalidate after dispatch but before the known 300ms callback');
  await page.locator('#founded > tbody > tr').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  const after=await selectionState(page),proof=await page.evaluate(()=>window.__dispatchProof);
  assert.equal(after.trace.length,0,'observed dispatch must not produce a late native engine selection');
  assert.equal((await scanOutput(page)).status,'stopped','cancelled receipt must not overwrite newer stopped diagnostics');
  assert.deepEqual(after.rows,previous);assert.equal(proof.clicks,1);assert.equal(proof.dblclicks,0);
  assert.deepEqual(proof.modifiers,[[false,false,false,false]]);
  report.native.push({postDispatchCancellation:{...proof,elapsedBeforeInvalidation:elapsed,selectionCalls:0,previousRowsPreserved:true}});
  report.checks.push('observed exactly one unmodified click, then invalidated before 300ms: pending native callback canceled, no dblclick or late engine selection');
}
async function verifyTwoFrameQualification(page) {
  const before=(await selectionState(page)).checkboxes;
  await page.evaluate(()=>{
    const bus=window._MSG_BUS_,original=bus.rpcCall;window.__qualifiedNativeAt=undefined;
    bus.rpcCall=function(...args){if(args[0]==='/engine/camera/setTarget')window.__qualifiedNativeAt=performance.now();return original.apply(this,args);};
  });
  await page.getByTestId('start-camera').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="scan-text"]').value.includes('selected: 此前两帧目标 C25900'));
  const evidence=await page.evaluate(()=>({results:window.__limitedDecoderResults,nativeAt:window.__qualifiedNativeAt}));
  const decoded=evidence.results.filter(result=>result.texts.length),empty=evidence.results.find(result=>!result.texts.length);
  assert.equal(decoded.length,2,'exactly two decoded nonempty frames must be enough');
  assert.ok(decoded.every(result=>JSON.stringify(result.texts)==='["C25900"]'));
  assert.ok(empty&&empty.at<evidence.nativeAt,'a real empty decoded frame arrived before the delayed native callback');
  const output=await scanOutput(page);assert.equal(output.status,'no-code','native receipt cannot replace the latest truthful empty-frame diagnostic');
  assert.ok(output.text.includes('此前两帧目标 C25900'));
  const after=await selectionState(page);assert.deepEqual(after.rows,['R1、R2、R4']);assert.deepEqual(after.checkboxes,before);
  await page.getByTestId('stop-camera').click();assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');
  report.native.push({twoFramesThenBlank:{decodedFrames:decoded.length,firstEmptyAt:empty.at,nativeAt:evidence.nativeAt,latestStatus:output.status,rows:after.rows}});
  report.checks.push('exactly two real decoded frames then blank before native delay still select the qualified target; latest no-code text stays truthful and receipt is target-correlated');
}
async function verifyReselectTarget(page) {
  await page.getByTestId('start-camera').click();await waitNativeSelected(page);await waitScanStatus(page,'suppressed');
  const before=await selectionState(page);
  const other=await writeBarcode('C2935915',{format:'QRCode',scale:8});
  await setSyntheticCodes(page,[Buffer.from(await other.image.arrayBuffer()).toString('base64')]);
  await page.waitForFunction(()=>window.__pauseVideoFrames===true&&document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="scan-output"]').dataset.status==='confirming');
  assert.equal(await page.getByTestId('selected-code').innerText(),'C2935915');
  assert.equal(await page.getByTestId('designators').innerText(),'H2');
  assert.equal(await page.getByTestId('reselect').isEnabled(),false,'displayed B must not enable a reselect action bound to old A');
  await page.getByTestId('reselect').dispatchEvent('click');await page.waitForTimeout(400);
  const after=await selectionState(page);assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.trace,before.trace);assert.deepEqual(after.checkboxes,before.checkboxes);
  assert.equal(await page.evaluate(()=>window.__limitedDecoderResults.filter(result=>result.texts.includes('C2935915')).length),1);
  assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'live');
  await page.getByTestId('stop-camera').click();
  report.checks.push('confirmed A then one actual decoded B frame: displayed B cannot reselect old A, and no native selection or media stop is triggered');
}
async function verifyDiagnosticsAndRearm(page) {
  await page.evaluate(()=>{window.__scanClicks=0;document.addEventListener('click',event=>{
    if(!event.isTrusted&&event.target instanceof HTMLTableRowElement&&event.target.closest('#smt-ui-container'))window.__scanClicks++;
  },true);});
  const clicks=()=>page.evaluate(()=>window.__scanClicks);
  await page.getByTestId('start-camera').click();await waitNativeSelected(page);await waitScanStatus(page,'suppressed');
  assert.deepEqual((await selectionState(page)).rows,['R1、R2、R4']);
  const first=await scanOutput(page),firstClicks=await clicks();assert.equal(firstClicks,1);
  assert.ok(first.text.includes('C25900')&&first.text.includes('confirming:')&&first.text.includes('selected:'));
  await page.waitForFunction(frames=>{
    const shadow=document.querySelector('[data-testid="scanner-host"]').shadowRoot;
    return Number(shadow.querySelector('[data-testid="scan-frame-info"]').textContent.match(/已处理 (\d+) 帧/)[1])>=frames+2;
  },first.frames);
  const repeated=await scanOutput(page);assert.equal(repeated.status,'suppressed');assert.equal(repeated.text,first.text,'identical suppressed outputs are coalesced');
  assert.notEqual(repeated.meta,first.meta);assert.equal(await clicks(),firstClicks,'continuous code must not repeatedly select');

  const hostile='<img src=x onerror="window.__scanTextExecuted=1">';
  const hostileCode=await writeBarcode(hostile,{format:'QRCode',scale:8});
  await setSyntheticCodes(page,[Buffer.from(await hostileCode.image.arrayBuffer()).toString('base64')]);await waitScanStatus(page,'rejected');
  assert.ok((await scanOutput(page)).text.includes(hostile));assert.equal(await page.getByTestId('scan-output').locator('img').count(),0);
  assert.equal(await page.evaluate(()=>window.__scanTextExecuted),undefined);

  const unknown=await writeBarcode('C999999',{format:'QRCode',scale:8});
  await setSyntheticCodes(page,[Buffer.from(await unknown.image.arrayBuffer()).toString('base64')]);
  await page.waitForFunction(()=>document.querySelector('[data-testid="scanner-host"]').shadowRoot.querySelector('[data-testid="scan-text"]').value.includes('C999999'));
  await waitScanStatus(page,'rejected');
  assert.equal((await scanOutput(page)).message,'同帧包含未解析/未匹配身份，请一次只展示一个料袋','existing non-BOM wording unchanged');
  await page.waitForTimeout(1200);await setSyntheticCodes(page,[png]);await waitScanStatus(page,'suppressed');assert.equal(await clicks(),firstClicks,'unmatched text is not absence');

  const other=await writeBarcode('C2935915',{format:'QRCode',scale:8});
  await setSyntheticCodes(page,[png,Buffer.from(await other.image.arrayBuffer()).toString('base64')]);await waitScanStatus(page,'rejected');
  const conflicting=await scanOutput(page);assert.ok(conflicting.text.includes('C25900')&&conflicting.text.includes('C2935915'));
  await page.waitForTimeout(1200);await setSyntheticCodes(page,[png]);await waitScanStatus(page,'suppressed');assert.equal(await clicks(),firstClicks,'conflicting symbols are not absence');
  report.checks.push('scanText raw/confirmation/suppression/rejection, advancing frame counters, coalescing and literal hostile text; unmatched/conflicting payloads never rearm');

  await setSyntheticCodes(page,[]);await waitScanStatus(page,'no-code');const empty=await scanOutput(page);
  await page.waitForTimeout(1200);
  await page.waitForFunction(frames=>{
    const shadow=document.querySelector('[data-testid="scanner-host"]').shadowRoot;
    return shadow.querySelector('[data-testid="scan-output"]').dataset.status==='no-code'&&Number(shadow.querySelector('[data-testid="scan-frame-info"]').textContent.match(/已处理 (\d+) 帧/)[1])>=frames+2;
  },empty.frames);
  assert.equal(await clicks(),firstClicks);assert.ok((await scanOutput(page)).text.includes('本帧没有解码文本'));
  await setSyntheticCodes(page,[png]);await waitNativeSelected(page);assert.equal(await clicks(),firstClicks+1,'same code reselects after >=1s and fresh empty frames');
  await page.getByTestId('stop-camera').click();assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');
  await page.getByTestId('start-camera').click();await waitNativeSelected(page);assert.equal(await clicks(),firstClicks+2,'explicit Start rearms the same code');
  report.checks.push('empty-frame absence >=1s and explicit Stop/Start both rearm the same code, with normal two-frame confirmation');

  await page.locator('#founded > tbody > tr').first().click({position:{x:110,y:14}});await page.waitForTimeout(550);
  assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');assert.deepEqual((await selectionState(page)).rows,['H2']);
  const paused=await scanOutput(page);await page.waitForTimeout(350);assert.equal((await scanOutput(page)).frames,paused.frames);assert.equal((await scanOutput(page)).status,'stopped');
  assert.equal(await clicks(),firstClicks+2,'native manual action must not implicitly resume camera');
  await page.getByTestId('start-camera').click();await waitNativeSelected(page);assert.equal(await clicks(),firstClicks+3);assert.deepEqual((await selectionState(page)).rows,['R1、R2、R4']);
  await page.getByTestId('reselect').click();await waitNativeSelected(page);assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');
  await page.getByTestId('start-camera').click();await page.waitForTimeout(300);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');
  report.checks.push('native manual pause remains authoritative; only explicit Start resumes/rearms; manual reselect and pagehide still release media');
}
try {
  if(reselectRegression){
    const page=await pageFor(enhanced,png,false,'C2935915');await ready(page);await trace(page);await verifyReselectTarget(page);
  }else if(refinement){
    const page=await pageFor(enhanced);await ready(page);await trace(page);
    await page.getByTestId('manual-code').fill('C25900');await page.getByTestId('manual-submit').click();
    await waitNativeSelected(page);
    await verifyDispatchCancellation(page);
    const synthetic=await pageFor(enhanced,png);await ready(synthetic);
    await synthetic.getByTestId('start-camera').click();
    await waitNativeSelected(synthetic);
    assert.equal(await synthetic.getByTestId('camera-state').getAttribute('data-active'),'true');
    assert.equal(await synthetic.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'live');
    const unknown=await writeBarcode('C999999',{format:'QRCode',scale:8});
    const unknownPNG=Buffer.from(await unknown.image.arrayBuffer()).toString('base64');
    await synthetic.evaluate(async png=>{const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
      const canvas=window.__syntheticCanvas;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);},unknownPNG);
    await synthetic.waitForFunction(()=>document.querySelector('[data-testid="scanner-host"]')?.shadowRoot?.querySelector('[data-testid="scanner-status"]')?.textContent?.includes('同帧包含未解析/未匹配身份'));
    assert.equal(await synthetic.getByTestId('camera-state').getAttribute('data-active'),'true');
    assert.equal(await synthetic.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'live');
    await synthetic.getByTestId('stop-camera').click();
    assert.equal(await synthetic.getByTestId('camera-state').getAttribute('data-active'),'false');
    assert.equal(await synthetic.evaluate(()=>window.__syntheticStream.getTracks()[0].readyState),'ended');
    report.checks.push('cameraActive true in selected and rejected phases with a live synthetic stream; false after Stop');
  }else{
  const baseline=await pageFor(enhanced);await ready(baseline);await trace(baseline);
  const checkboxesBefore=(await selectionState(baseline)).checkboxes;
  const imageBefore=await boardImage(baseline,'tests/.generated/before.png');
  // Native user single-click baseline, including the original engine centering behavior.
  const row=baseline.locator('#founded > tbody > tr').filter({has:baseline.locator('td:nth-child(7) p',{hasText:/^C25900$/})});
  assert.equal(await row.count(),1);await row.scrollIntoViewIfNeeded();
  await row.click({position:{x:110,y:14}});
  // Remove pointer hover observations before the vendor's delayed single-click callback.
  await baseline.evaluate(()=>{window.__trace=[];});await baseline.waitForTimeout(750);
  const manual=await selectionState(baseline);assert.deepEqual(manual.checkboxes,checkboxesBefore);
  assert.equal(manual.rows.length,1);assert.ok(manual.rows[0].includes('R1'));assert.ok(manual.trace.some(args=>args[0]==='/engine/camera/setTarget'));
  const manualImage=await boardImage(baseline,'tests/.generated/native-manual.png');
  assert.notEqual(manualImage,imageBefore,'engine image must change after original native selection');

  const adapted=await pageFor(enhanced);await ready(adapted);await trace(adapted);
  await adapted.getByTestId('manual-code').fill('C25900');await adapted.getByTestId('manual-submit').click();
  await waitNativeSelected(adapted);
  const automatic=await selectionState(adapted);assert.deepEqual(automatic.rows,manual.rows);assert.deepEqual(automatic.checkboxes,checkboxesBefore);
  assert.deepEqual(automatic.trace,manual.trace,'same native selection/model-highlight/centering call sequence, no guessed RPC');
  const adaptedImage=await boardImage(adapted,'tests/.generated/native-adapter.png');
  assert.equal(adaptedImage,manualImage,'actual engine canvas is identical to native user single-click baseline');
  assert.equal(automatic.cameraRequests,0);
  report.native.push({code:'C25900',refs:['R1','R2','R4'],manual,adapter:automatic,engineImagesIdentical:true});
  report.checks.push('actual aggregate multi-reference manual->adapter native row, engine trace and pixel-identical engine canvas; welded checks unchanged');

  await verifyDispatchCancellation(adapted);

  await adapted.getByRole('button',{name:'位号不聚合',exact:true}).click();
  await adapted.getByTestId('manual-code').fill('C25900');await adapted.getByTestId('manual-submit').click();
  await adapted.waitForTimeout(200);
  assert.match(await adapted.getByTestId('scanner-status').innerText(),/不聚合多位号不支持/);
  await adapted.getByTestId('manual-code').fill('C2935915');await adapted.getByTestId('manual-submit').click();
  await adapted.waitForTimeout(650);
  assert.match(await adapted.getByTestId('scanner-status').innerText(),/已确认原生 BOM 行选中/);
  report.checks.push('actual nonaggregate single-reference selection; nonaggregate multi-reference rejected (no last-only fake success)');

  await adapted.getByRole('button',{name:'位号聚合',exact:true}).click();
  const search=adapted.locator('#smt-ui-container input[type="text"]').first();await search.fill('NO-SUCH-PART');
  await adapted.getByTestId('manual-code').fill('C25900');await adapted.getByTestId('manual-submit').click();await adapted.waitForTimeout(180);
  assert.match(await adapted.getByTestId('scanner-status').innerText(),/未找到唯一/);
  assert.equal(await adapted.getByTestId('previous-highlight-warning').isVisible(),true);
  report.checks.push('filtered/hidden native target refused with honest previous-highlight warning');

  // End-to-end SOFTWARE media stream: canvas -> video -> actual Worker/WASM -> native viewer.
  // No browser fake-device switch and no physical getUserMedia implementation is ever called.
   const twoFrames=await pageFor(enhanced,png,true);await ready(twoFrames);await trace(twoFrames);await verifyTwoFrameQualification(twoFrames);
   const reselect=await pageFor(enhanced,png,false,'C2935915');await ready(reselect);await trace(reselect);await verifyReselectTarget(reselect);
  const synthetic=await pageFor(enhanced,png);await ready(synthetic);await trace(synthetic);
  await verifyDiagnosticsAndRearm(synthetic);

  const enhancer=await pageFor('output/html-enhancer.html');
  await enhancer.getByTestId('source-file-input').setInputFiles(source);
  await enhancer.waitForFunction(()=>document.querySelector('[data-testid="enhancer-host"]')?.shadowRoot?.querySelector('[data-testid="enhancer-status"]')?.textContent?.includes('已生成独立文件'));
  const downloadPromise=enhancer.waitForEvent('download');await enhancer.getByTestId('download-file').click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'InteractiveBOM_PCB_Back_2026-11-6_扫码版.html');
  await download.saveAs('tests/.generated/browser-download.html');
  const generated=await readFile('tests/.generated/browser-download.html','utf8');assert.ok(generated.includes(MARKER));
  // Strip exactly the added block and confirm byte-identical original text.
  const start=generated.indexOf('\n'+MARKER),end=generated.indexOf('</body>',start);
  assert.equal(hash(Buffer.from((generated.slice(0,start)+generated.slice(end)).replace(NETWORK_POLICY,''))),before);
  const reopened=await pageFor('tests/.generated/browser-download.html');await ready(reopened);
  assert.equal(await reopened.evaluate(()=>window.__cameraRequests),0);
  report.checks.push('browser-local File input/download regeneration, standalone reopened offline, original text preserved');

  // Full reader WASM initialization and real synthetic QR decode; no camera APIs used.
  const harness=await pageFor('tests/.generated/harness.html');
  const decoded=await harness.evaluate(async png=>{
    const resource=window.BagBomTest.createDecoderWorker();
    try {
      return await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error('worker decode timeout')),20000);
        resource.worker.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};
        resource.worker.onmessage=async({data})=>{
          if(data.error){clearTimeout(timeout);reject(Error(data.error));return;}
          if(data.ready){
            const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
            resource.worker.postMessage({id:42,pixels:pixels.buffer,width:canvas.width,height:canvas.height},[pixels.buffer]);
          }else if(data.id===42){clearTimeout(timeout);resolve(data.results);}
        };
        resource.worker.postMessage({init:true});
      });
    }finally{resource.worker.terminate();resource.release();}
  },png);
  assert.deepEqual(decoded,[{text:'C25900',format:'QRCode'}]);
  report.checks.push('inline Blob Worker + bundled WASM initialized and decoded synthetic QRCode offline without webcam');
  }
  assert.deepEqual(report.network,[],'document CSP must block inherited background network before interception');
  report.checks.push('document-level CSP blocks inherited font/favicon/API requests; no runtime external resources');
  assert.equal(hash(await readFile(source)),before);report.checks.push('original SHA256 preserved; no real-camera requests');
  assert.deepEqual(report.errors,[]);
  report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally{
  await writeFile(`tests/.generated/${reselectRegression?'browser-reselect-report':refinement?'browser-refinement-report':'browser-report'}.json`,JSON.stringify(report,null,2));
  await Promise.all(contexts.map(c=>c.close()));await browser.close();console.log(JSON.stringify(report,null,2));
}
