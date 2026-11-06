import test from 'node:test';
import './session-diagnostics.test.ts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractFiles,readSnapshot,manualMatch,strictUTF8,MARKER, type BoardSnapshot} from '../src/native.ts';
import {matchFrame,structuredBoundary, type BarcodeAPI} from '../src/identity.ts';
import {verifyRow,dispatchOwnedClick,DOMSelectionAdapter} from '../src/selection.ts';
import {LatestInput,ScanLatch} from '../src/session.ts';
import {enhance,scriptJSON,NETWORK_POLICY} from '../src/enhance.ts';
// esbuild bundles the unmodified reference UMDs, including matcher.js for normalize only.
import Barcodes from '../references/bag-bom/bag_bom/web/barcodes.js';
const api=Barcodes as BarcodeAPI;
const part=(des:string,key:string,index:number)=>({des,lc_code:key,pick_index:index,deviceUuid:'shared-device',is_mount:true});
function fixture(comp:Record<string,unknown>={'C25900,4.7kΩ':{'Supplier Part':'C25900','Manufacturer Part':'0402WGF4701TCE'}},top=[part('R1','C25900,4.7kΩ',1)],bottom:unknown[]=[]): Record<string,unknown> {
  return {bom_merge:JSON.stringify({sum:'x',data:JSON.stringify({comp_info:comp,designator_info:[{name:'board',top,bottom}]})})};
}
const snapshot=()=>readSnapshot(fixture(),'test-artifact');
const exact=(s:BoardSnapshot=snapshot())=>{const result=manualMatch('C25900',s);assert.equal(result.kind,'exact');if(result.kind!=='exact')throw Error();return result.target;};
test('safe JSON boundary, no executable parsing, strict UTF8 and script escaping',()=>{
  const files=fixture();
  const text=`<html><body>\n<script type="text/javascript">window.files = ${JSON.stringify(files)}; window.__ENGING_OBJ_PRELOAD__ = {};</script></body></html>`;
  assert.deepEqual(extractFiles(text),files);
  assert.throws(()=>extractFiles(text.replace(JSON.stringify(files),'(()=>{throw Error("executed")})()')));
  assert.throws(()=>extractFiles(text.replace('; window.__ENGING_OBJ_PRELOAD__ = ','; unknown = ')));
  assert.throws(()=>extractFiles(text+'\n<script type="text/javascript">window.files = {}; window.__ENGING_OBJ_PRELOAD__ = {};'));
  assert.throws(()=>strictUTF8(Uint8Array.from([0xc0,0xaf]).buffer));
  assert.equal(strictUTF8(new TextEncoder().encode('\ufeff中文').buffer),'\ufeff中文');
  assert.ok(!scriptJSON('</script><img src=x>').includes('<'));
});
test('opaque lc_code joins only comp_info, no value/unknown suffix guessing, exact C-code',()=>{
  const s=readSnapshot(fixture({'C25900,4.7kΩ':{'Supplier Part':'C25900','Manufacturer Part':'ABC-123-X'},',10K':{Value:'C25900'}},
    [part('R1','C25900,4.7kΩ',1),part('R2',',10K',2),part('R3','C25900,unknown',3)]),'a');
  assert.deepEqual(exact(s).designators,['R1']); assert.equal(s.diagnostics.length,2);
  for(const value of ['C2590','C259000','25900'])assert.notEqual(manualMatch(value,s).kind,'exact');
  for(const value of ['C25 900','C25900 suffix','C25900,','4.7kΩ'])assert.notEqual(manualMatch(value,s).kind,'exact');
  assert.equal(manualMatch(' c25900 ',s).kind,'exact');
});
test('duplicate designators fail, shared library deviceUuid is valid; mixed manufacturer identities blocked',()=>{
  assert.throws(()=>readSnapshot(fixture(undefined,[part('R1','C25900,4.7kΩ',1),part('R1','C25900,4.7kΩ',2)]),'a'));
  const s=readSnapshot(fixture(undefined,[part('R1','C25900,4.7kΩ',1),part('R2','C25900,4.7kΩ',2)]),'a');
  assert.equal(exact(s).nativeIds.length,2);
  const mixed=readSnapshot(fixture({one:{'Supplier Part':'C25900','Manufacturer Part':'ABC-123-A'},two:{'Supplier Part':'C25900','Manufacturer Part':'ABC-123-B'}},[part('R1','one',1),part('R2','two',2)]),'a');
  assert.equal(manualMatch('C25900',mixed).kind,'rejected');
});
test('bag-bom exact Barcodes.match: raw/JSON/JLC/URL, preserved MPN suffix; same-frame failures closed',()=>{
  const s=snapshot();
  for(const labels of [['C25900'],['{"pc":"C25900","pm":"0402WGF4701TCE"}'],['{pc:C25900,pm:0402WGF4701TCE,qty:100}'],['https://www.lcsc.com/product-detail/C25900.html'],['0402WGF4701TCE'],['C25900','C25900']]) {
    assert.equal(matchFrame(labels,s,api).kind,'exact',JSON.stringify(labels));
  }
  for(const labels of [['C2590'],['C25 900'],['C25900 suffix'],['C25900','order 123'],['C25900','C999999'],['{"pc":"C25900","pm":"0402WGF4701TCE-X"}'],['{"pc":"C25900","pm":12345}'],['{"pc":"C999999","pc":"C25900"}'],['{pc:C25900,pm:ABC-123-X}'],['{"pc":"C25900","pm":{"x":"ABC123"}}'],['https://evil.example/C25900.html'],['{pc:C25900,garbage}']]) {
    assert.notEqual(matchFrame(labels,s,api).kind,'exact',JSON.stringify(labels));
  }
  assert.equal(structuredBoundary('{pc:C25900,pc:C25900}'),false);
});
test('structured identity P1 regressions: conflicting explicit MPNs never disappear',()=>{
  const s=snapshot();
  for (const payload of ['{pc:C25900,"pm":"WRONG123"}', '{"pc":"C25900","pm":"WRONG"}']) {
    assert.equal(structuredBoundary(payload),false,payload);
    assert.notEqual(matchFrame([payload],s,api).kind,'exact',payload);
  }
  const droppingParser:BarcodeAPI={...api,parse:payload=>api.parse(payload).filter(id=>id.type!=='mpn')};
  const result=matchFrame(['{"pc":"C25900","pm":"0402WGF4701TCE"}'],s,droppingParser);
  assert.equal(result.kind,'rejected','every explicit identity must survive upstream parsing');
});
test('structured identity grammar is coherent, complete and case/alias-aware',()=>{
  const s=snapshot();
  for (const payload of [
    '{"pc":"C25900","pm":"0402WGF4701TCE","qty":100,"extra":null}',
    '{pc:C25900,pm:0402WGF4701TCE,qty:100}',
    '{"PC":"c25900","P_M":"0402wgf4701tce"}',
    '{P_C:c25900,PM:0402wgf4701tce}',
  ]) assert.equal(matchFrame([payload],s,api).kind,'exact',payload);
  for (const payload of [
    '{pc:C25900,"pm":"0402WGF4701TCE"}', '{"pc":"C25900",pm:0402WGF4701TCE}',
    '{pc:"C25900",pm:0402WGF4701TCE}', '{pc:C25900,pm:"0402WGF4701TCE"}',
    '{"pc":"C25900","pm":12345}', '{"pc":"C25900","pm":null}', '{pc:C25900,pm:}',
    '{pc:C25900,pm:WRONG}', '{"pc":"C25900","pm":"ABC"}',
    '{"pc":"C25900","pm":"0402 WGF4701TCE"}', '{pc:C25900,pm:0402WGF4701TCE-X}',
    '{"pc":"C25900","PC":"C25900"}', '{pc:C25900,P_C:C999999}',
    '{"pc":"C25900","pm":"0402WGF4701TCE","P_M":"WRONG123"}',
    '{"pc":"C25900","p\\u006d":"WRONG123"}', '{"pc":"C25900","pm":"WRONG\\u0031"}',
    '{"pc":"C25900","pm":{"id":"WRONG123"}}', '{"pc":"C25900","pm":["WRONG123"]}',
    '{pc:C25900,mpn:WRONG123}', '{"pc":"C25900","Manufacturer_Part":"WRONG123"}',
    '{pc:C25900,sku:WRONG123}', '{pc:C25900,Mfg_Part:WRONG123}', '{pc:C25900,MouserPart:WRONG123}',
    '[)>\x1e06\x1d1P0402WGF4701TCE\x1d1PWRONG\x1e\x04',
  ]) assert.notEqual(matchFrame([payload],s,api).kind,'exact',payload);
});
test('GS1 ECIA explicit 1P/30P identities cannot silently disappear beside a recognized MPN',()=>{
  const s=snapshot();
  const label=(...fields:string[])=>'[)>\x1e06\x1d'+fields.join('\x1d')+'\x1e\x04';
  const known='1P0402WGF4701TCE';
  assert.equal(matchFrame([label(known)],s,api).kind,'exact','valid accepted-format control');
  for(const companion of ['1PWRONG','30PWRONG','PWRONG-ND']){
    const payload=label(known,companion);
    assert.deepEqual(api.parse(payload),[{type:'mpn',value:'0402WGF4701TCE'}],'upstream really drops the alphabetic-only companion');
    assert.equal(structuredBoundary(payload),false,companion);
    assert.equal(matchFrame([payload],s,api).kind,'rejected',companion);
  }
  for(const companion of ['1P','30P','1PABC','30PABC','1pWRONG123','30pWRONG123','1PWR ONG123']){
    assert.equal(structuredBoundary(label(known,companion)),false,companion);
    assert.equal(matchFrame([label(known,companion)],s,api).kind,'rejected',companion);
  }
  const validFields=label(known,'30PABC123-ND');
  assert.equal(structuredBoundary(validFields),true,'coherent valid explicit fields remain syntactically accepted');
  const droppingParser:BarcodeAPI={...api,parse:payload=>api.parse(payload).filter(id=>id.type!=='digikey')};
  const rejected=matchFrame([validFields],s,droppingParser);
  assert.equal(rejected.kind,'rejected');
  if(rejected.kind==='rejected')assert.equal(rejected.reason,'invalid','partial parsing fails before matching');
});
test('DOM contract rejects unknown/mixed/subset/wrong-side rows; supports synthetic bottom',()=>{
  const s=readSnapshot(fixture(undefined,[part('R1','C25900,4.7kΩ',1),part('R2','C25900,4.7kΩ',2)],[part('R3','C25900,4.7kΩ',3)]),'a');
  const target=exact(s),row={mode:'aggregate' as const,top:['R1','R2'],bottom:['R3'],cCode:'C25900'};
  assert.equal(verifyRow(row,target,s),true);
  assert.equal(verifyRow({...row,top:['R1','UNKNOWN']},target,s),false);
  assert.equal(verifyRow({...row,top:['R1']},target,s),false);
  assert.equal(verifyRow({...row,top:['R1','R3'],bottom:['R2']},target,s),false);
  assert.equal(verifyRow({...row,mode:'single'},target,s),false);
  assert.equal(verifyRow({...row,cCode:'C259000'},target,s),false);
});
test('generation aborts old work; presence latch suppresses continuous code but explicit restart rearms',()=>{
  const latest=new LatestInput(),a=latest.next(),b=latest.next();
  assert.equal(a.signal.aborted,true);assert.equal(latest.current(a.generation),false);assert.equal(latest.current(b.generation),true);
  const latch=new ScanLatch();assert.equal(latch.observe('C25900',0).kind,'confirming');const attempt=latch.observe('C25900',100);
  assert.equal(attempt.kind,'select');if(attempt.kind==='select')latch.finish(attempt.attempt,true,200);
  latest.next();latch.resetStability();assert.equal(latch.observe('C25900',300).kind,'suppressed');
  latch.restart();assert.equal(latch.observe('C25900',400).kind,'confirming');assert.equal(latch.observe('C25900',500).kind,'select');
});
test('adapter target/artifact tokens, abort and full-set guards fail before any DOM access',async()=>{
  let valid=true;
  const adapter=new DOMSelectionAdapter({} as Document,{} as Window & typeof globalThis,()=>valid);
  const s=snapshot(),token=await adapter.bind(s),target=exact(s);
  assert.equal((await adapter.select(target,token,AbortSignal.abort())).status,'stale');
  valid=false;assert.equal((await adapter.select(target,token,new AbortController().signal)).status,'stale');valid=true;
  assert.equal((await adapter.select({...target,designators:['R100']},token,new AbortController().signal)).status,'unsupported');
  await adapter.bind({...s,artifactId:'different-artifact'});
  assert.equal((await adapter.select(target,token,new AbortController().signal)).status,'stale');
  adapter.dispose();assert.equal((await adapter.select(target,token,new AbortController().signal)).status,'stale');
});
test('owned vendor deferred click is cancelable without modifiers or extra clicks',()=>{
  const callbacks=new Map<number,unknown>();let count=0,event:MouseEvent|undefined;
  const win={MouseEvent:class {type:string;bubbles:boolean;ctrlKey=false;shiftKey=false;constructor(type:string,opts:{bubbles:boolean}){this.type=type;this.bubbles=opts.bubbles;}},
    setTimeout:(fn:unknown)=>{callbacks.set(++count,fn);return count;},clearTimeout:(id:number)=>callbacks.delete(id)};
  const original=win.setTimeout;
  const row={dispatchEvent:(ev:MouseEvent)=>{event=ev;win.setTimeout(()=>{});}};
  // Emulate the vendor's exact 300ms timer, not a generic callback heuristic.
  row.dispatchEvent=(ev:MouseEvent)=>{event=ev;(win.setTimeout as any)(()=>{},300);return true;};
  const owned=dispatchOwnedClick(row as unknown as HTMLTableRowElement,win as unknown as Window & typeof globalThis);
  assert.equal(owned.count,1);assert.equal(win.setTimeout,original);assert.equal(event?.type,'click');assert.equal(event?.ctrlKey,false);assert.equal(event?.shiftKey,false);
  owned.cancel();assert.equal(callbacks.size,0);
});
test('new adapter request supersedes pending work synchronously, including a rejected request',async()=>{
  let dispatches=0;
  const cells=[{querySelectorAll:()=>[{}]},
    {firstElementChild:{tagName:'P',textContent:'R1'}},
    {firstElementChild:{tagName:'SPAN',className:'len_nKuFJ',textContent:''}}, {}, {}, {},
    {querySelector:()=>({textContent:'C25900'})}, {}];
  const row={cells,closest:()=>({id:'founded',className:'bom-table_Z6Wd0'}),getClientRects:()=>[{}],isConnected:true,dispatchEvent:()=>{dispatches++;}};
  const doc={querySelectorAll:()=>[row]};
  const adapter=new DOMSelectionAdapter(doc as unknown as Document,{getComputedStyle:()=>({visibility:'visible'})} as unknown as Window & typeof globalThis,()=>true);
  const s=snapshot(),token=await adapter.bind(s),target=exact(s);
  const pending=adapter.select(target,token,new AbortController().signal);
  const newest=adapter.select({...target,designators:['R999']},token,new AbortController().signal);
  assert.equal((await newest).status,'unsupported');assert.equal((await pending).status,'stale');
  const controller=new AbortController();
  doc.querySelectorAll=()=>{controller.abort();return [row];};
  assert.equal((await adapter.select(target,token,controller.signal)).status,'stale');
  await new Promise(resolve=>setTimeout(resolve,130));assert.equal(dispatches,0);
  adapter.dispose();
});
test('actual specimen indexing/enhancement preserves every original character and source hash; repeat rejected',async()=>{
  const source='input/InteractiveBOM_PCB_Back_2026-11-6.html';const bytes=await readFile(source);
  const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex').toUpperCase();
  assert.equal(hash(bytes),'8B9DED6F7439429FE24E44838FB1A76409FB578A9F7C71E2F045A903A864A94B');
  const text=strictUTF8(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const s=readSnapshot(extractFiles(text),'a');assert.equal(s.parts.length,50);assert.equal(s.parts.filter(p=>p.side==='bottom').length,0);assert.equal(s.groups.length,12);
  assert.deepEqual(exact(s).designators,['R1','R2','R4']);
  const result=await enhance(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'native.html','console.log("test");','Apache-2.0');
  const a=result.html.indexOf('\n'+MARKER),b=result.html.indexOf('</body>',a);assert.equal((result.html.slice(0,a)+result.html.slice(b)).replace(NETWORK_POLICY,''),text);
  await assert.rejects(()=>enhance(new TextEncoder().encode(result.html).buffer,'enhanced.html','',''));
  assert.equal(hash(await readFile(source)),hash(bytes));
});
