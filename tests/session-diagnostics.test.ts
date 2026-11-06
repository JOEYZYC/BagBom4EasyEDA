import test from 'node:test';
import assert from 'node:assert/strict';
import {LatestInput,ScanLatch} from '../src/session.ts';
import {ScanTextLog,SCAN_TEXT_MAX_BYTES,SCAN_TEXT_MAX_EVENTS} from '../src/scan-text.ts';
import {matchFrame,type BarcodeAPI} from '../src/identity.ts';
import type {BoardSnapshot} from '../src/native.ts';
import Barcodes from '../references/bag-bom/bag_bom/web/barcodes.js';

function begin(latch:ScanLatch,key='C25900',at=0){
  assert.equal(latch.observe(key,at).kind,'confirming');
  const decision=latch.observe(key,at+100);assert.equal(decision.kind,'select');
  if(decision.kind!=='select')throw Error('expected selection lease');return decision.attempt;
}
function confirmed(){const latch=new ScanLatch();latch.finish(begin(latch),true,100);return latch;}
test('continuous confirmed code is suppressed while raw text, count and frame time keep updating',()=>{
  let now=0;const log=new ScanTextLog(()=>now),latch=new ScanLatch();
  log.frame(['C25900'],'confirming','confirm');latch.observe('C25900',now);
  now=100;const decision=latch.observe('C25900',now);assert.equal(decision.kind,'select');
  const revision=log.frame(['C25900'],'matching','matching');
  if(decision.kind==='select')latch.finish(decision.attempt,true,now);
  assert.equal(log.outcome(revision,'selected','native confirmed'),true);
  for(let i=0;i<100;i++){now+=100;assert.equal(latch.observe('C25900',now).kind,'suppressed');log.frame(['C25900'],'suppressed','same visible code');}
  const output=log.snapshot();assert.equal(output.frameCount,102);assert.equal(output.lastFrameAt,new Date(now).toISOString());
  assert.equal(output.status,'suppressed');assert.ok(output.text.includes('C25900'));assert.equal((output.text.match(/suppressed:/g)||[]).length,1);
});
test('same code rearms only on two fresh empty frames spanning at least one second',()=>{
  const latch=confirmed();latch.empty(200);latch.empty(800);
  assert.equal(latch.observe('C25900',900).kind,'suppressed','short glare is not absence');
  latch.empty(1000);latch.empty(2000);assert.equal(latch.observe('C25900',2001).kind,'confirming');
  assert.equal(latch.observe('C25900',2101).kind,'select');
});
test('one empty frame or no callbacks does not rearm, even after a long wall-clock gap',()=>{
  const latch=confirmed();latch.empty(200);assert.equal(latch.observe('C25900',20_000).kind,'suppressed');
  assert.equal(latch.observe('C25900',40_000).kind,'suppressed');
});
test('errors, conflicts and unmatched text interrupt rather than count toward absence',()=>{
  for(const reason of ['decode error','contradictory symbols','unmatched payload']){
    const latch=confirmed();latch.empty(200);latch.interrupt(500);latch.empty(1800);
    assert.equal(latch.observe('C25900',1900).kind,'suppressed',reason);
    latch.interrupt(2000);assert.equal(latch.observe('C25900',9000).kind,'suppressed',reason);
  }
});
test('A to B to A requires ordinary two-frame confirmation, not a lifetime seen-set',()=>{
  const latch=confirmed();latch.finish(begin(latch,'C11111',200),true,400);
  const again=begin(latch,'C25900',500);assert.equal(latch.finish(again,true,700),true);
  assert.equal(latch.observe('C25900',800).kind,'suppressed');
});
test('stop does not implicitly rearm/resume; explicit camera/device restart resets eligibility and old leases',()=>{
  const latch=confirmed();latch.interrupt(200);assert.equal(latch.observe('C25900',300).kind,'suppressed');
  latch.restart();const first=begin(latch,'C25900',400);latch.restart();const second=begin(latch,'C25900',600);
  assert.equal(latch.finish(first,true,800),false);assert.equal(latch.finish(second,true,800),true);
});
test('rejected, cancelled, unconfirmed and errored attempts retry after bounded cooldown, without poisoning',()=>{
  for(const outcome of ['rejected','cancelled','unconfirmed','error']){
    const latch=new ScanLatch(),attempt=begin(latch);assert.equal(latch.finish(attempt,false,200),true);
    for(const at of [300,400,800,1199])assert.equal(latch.observe('C25900',at).kind,'cooldown',outcome);
    const retry=latch.observe('C25900',1200);assert.equal(retry.kind,'select',outcome);
    if(retry.kind==='select')assert.notEqual(retry.attempt,attempt);
  }
});
test('in-flight requests survive empty frames; explicit interruption makes late success stale',()=>{
  const latch=new ScanLatch(),attempt=begin(latch);
  for(let at=200;at<1000;at+=100)assert.equal(latch.observe('C25900',at).kind,'busy');
  latch.empty(1100);assert.equal(latch.observe('C25900',1150).kind,'busy');
  latch.interrupt(1200);assert.equal(latch.finish(attempt,true,1300),false);
  assert.equal(latch.observe('C25900',1400).kind,'cooldown');
});
test('exactly two valid frames followed by empty before the native 300ms callback remain sufficient',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const latch=new ScanLatch(),latest=new LatestInput(),log=new ScanTextLog(()=>Date.now());
  assert.equal(latch.observe('C25900',0).kind,'confirming');log.frame(['C25900'],'confirming','first valid frame');
  t.mock.timers.tick(100);const decision=latch.observe('C25900',100);assert.equal(decision.kind,'select');
  if(decision.kind!=='select')throw Error('two frames must qualify');
  const request=latest.next(),revision=log.frame(['C25900'],'matching','qualified target');let nativeSelections=0;
  const receipt=new Promise<void>(resolve=>setTimeout(()=>{
    if(latest.current(request.generation)&&latch.finish(decision.attempt,true,Date.now())){
      nativeSelections++;assert.equal(log.outcome(revision,'selected','native confirmed','C25900'),true);
    }
    resolve();
  },300));
  t.mock.timers.tick(50);latch.empty(150);log.frame([],'no-code','latest frame is empty');
  assert.equal(request.signal.aborted,false);assert.equal(nativeSelections,0);assert.equal(log.snapshot().status,'no-code');
  t.mock.timers.tick(250);await receipt;assert.equal(nativeSelections,1);assert.equal(log.snapshot().frameCount,3);
  assert.equal(log.snapshot().status,'no-code');assert.equal(log.snapshot().message,'latest frame is empty');
  assert.ok(log.snapshot().text.includes('此前两帧目标 C25900'));assert.ok(log.snapshot().text.includes('native confirmed'));
  assert.equal(latch.observe('C25900',401).kind,'suppressed');
  assert.equal(log.outcome(revision,'selected','duplicate native receipt','C25900'),false);
});
test('absence qualified during a slow pending request is not lost when its receipt finally arrives',()=>{
  const latch=new ScanLatch(),attempt=begin(latch);latch.empty(200);latch.empty(1200);
  assert.equal(latch.finish(attempt,true,1300),true);
  assert.equal(latch.observe('C25900',1400).kind,'confirming');assert.equal(latch.observe('C25900',1500).kind,'select');
});
test('an unconfirmed later native attempt invalidates the old success proof instead of faking its highlight',()=>{
  const latch=confirmed(),other=begin(latch,'C11111',200);latch.finish(other,false,400);
  assert.equal(latch.observe('C25900',500).kind,'cooldown');assert.equal(latch.observe('C25900',600).kind,'cooldown');
  assert.equal(latch.observe('C25900',1400).kind,'select','old highlight cannot be assumed after an unconfirmed action');
});
test('diagnostics distinguish waiting/no-code/error/stopped without inventing frames',()=>{
  let now=0;const log=new ScanTextLog(()=>now);assert.equal(log.snapshot().status,'waiting');assert.equal(log.snapshot().frameCount,0);
  log.event('waiting','permission requested');assert.equal(log.snapshot().lastFrameAt,undefined);
  now=100;log.frame([],'no-code','still trying');now=200;log.frame([],'no-code','still trying');
  assert.equal(log.snapshot().frameCount,2);assert.equal(log.snapshot().status,'no-code');assert.equal((log.snapshot().text.match(/no-code:/g)||[]).length,1);
  log.event('error','decoder failed');log.event('stopped','camera released');
  assert.equal(log.snapshot().frameCount,2);assert.equal(log.snapshot().lastFrameAt,new Date(200).toISOString());assert.equal(log.snapshot().status,'stopped');
});
test('stale and duplicate receipts cannot overwrite newer raw text, status or outcome',()=>{
  const log=new ScanTextLog(()=>0),latest=new LatestInput();const first=latest.next();
  const old=log.frame(['C25900'],'matching','old target');latest.next();
  const current=log.frame(['C11111'],'confirming','new target');
  assert.equal(latest.current(first.generation),false);assert.equal(log.outcome(old,'selected','WRONG OLD SUCCESS'),false);
  assert.equal(log.snapshot().status,'confirming');assert.equal(log.snapshot().message,'new target');assert.ok(!log.snapshot().text.includes('WRONG OLD SUCCESS'));
  assert.equal(log.outcome(current,'selected','current native confirmed'),true);
  assert.equal(log.outcome(current,'error','duplicate old receipt'),false);
  log.event('stopped','manual native operation');assert.equal(log.outcome(current,'selected','late selection'),false);assert.equal(log.snapshot().status,'stopped');
});
test('a contradictory or stopped event breaks receipt correlation even if later frames are empty',()=>{
  for(const status of ['rejected','stopped','error'] as const){
    const latch=new ScanLatch(),attempt=begin(latch),log=new ScanTextLog(()=>0);
    const revision=log.frame(['C25900'],'matching','old qualified target');log.frame([],'no-code','brief glare');
    latch.interrupt(200);log.event(status,'newer cancellation or conflicting input');log.frame([],'no-code','new empty frame');
    assert.equal(latch.finish(attempt,true,300),false);assert.equal(log.outcome(revision,'selected','WRONG LATE TARGET','C25900'),false);
    assert.ok(!log.snapshot().text.includes('WRONG LATE TARGET'));assert.equal(log.snapshot().status,'no-code');
    latch.restart();const next=begin(latch,'C11111',400);assert.equal(latch.finish(attempt,true,600),false);assert.equal(latch.finish(next,true,600),true);
  }
});
test('diagnostic history is bounded and hostile control text is visible, literal and explicitly truncated',()=>{
  let now=0;const log=new ScanTextLog(()=>now),hostile='<img src=x onerror=alert(1)>\x1d\n\u202e'+'中😀'.repeat(100_000);
  const original=Object.freeze([hostile]);log.frame(original,'rejected','diagnostic only');
  let output=log.snapshot();assert.ok(output.text.includes('<img src=x'));assert.ok(output.text.includes('\\u001d'));assert.ok(output.text.includes('\\u000a'));assert.ok(output.text.includes('\\u202e'));assert.ok(output.text.includes('截断'));
  assert.equal(original[0],hostile);
  const escaped=new ScanTextLog(()=>0);escaped.frame(['\\u001d'],'rejected','literal backslash');assert.ok(escaped.snapshot().text.includes('\\\\u001d'));
  for(let i=0;i<100;i++){now++;log.frame(Array.from({length:32},()=>hostile),'rejected',`${i}:`+'错'.repeat(2000));}
  output=log.snapshot();assert.ok(new TextEncoder().encode(output.text).byteLength<=SCAN_TEXT_MAX_BYTES);
  assert.ok(output.text.split('\n\n').length<=SCAN_TEXT_MAX_EVENTS);assert.ok(output.text.includes('截断'));assert.equal(output.frameCount,101);
});
test('diagnostic truncation never changes the original payload supplied to exact matching',()=>{
  const snapshot:BoardSnapshot={artifactId:'test',diagnostics:[],blockedCodes:[],parts:[{des:'R1',id:'record',side:'top',key:'part',cCode:'C25900',mpn:'0402WGF4701TCE'}],
    groups:[{key:'part',ids:[{field:'LCSC',value:'C25900'},{field:'Manufacturer Part',value:'0402WGF4701TCE'}],refs:[['R1','record']]}]};
  const payload=JSON.stringify({pc:'C25900',pm:'0402WGF4701TCE',lot:'X'.repeat(3000)}),payloads=[payload];Object.freeze(payloads);
  const log=new ScanTextLog(()=>0);log.frame(payloads,'confirming','raw text');assert.ok(log.snapshot().text.includes('截断'));
  let parsed='';const api:BarcodeAPI={parse:value=>{parsed=value;return Barcodes.parse(value);},match:(values,index)=>{assert.equal(values,payloads);return Barcodes.match(values,index);}};
  assert.equal(matchFrame(payloads,snapshot,api).kind,'exact');assert.equal(parsed,payload);assert.equal(payloads[0],payload);
  const oversized=['C25900'+' '.repeat(20_000)];log.frame(oversized,'rejected','oversized');assert.equal(matchFrame(oversized,snapshot,api).kind,'rejected');assert.equal(oversized[0].length,20_006);
});
