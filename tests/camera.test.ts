import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalCamera,CAPTURE_MAX_EDGE,CAPTURE_MAX_PIXELS,MIN_CAPTURE_INTERVAL_MS,type CameraCallbacks} from '../src/camera.ts';
function fixture(getUserMedia:()=>Promise<any>,options:{callbacks?:boolean;quality?:boolean;width?:number;height?:number}={}) {
  const states:string[]=[],mediaStates:{phase:string;active:boolean}[]=[],frames:unknown[]=[],posts:unknown[]=[];let releases=0,stops=0,workers=0;let generation=0;
  const resize={width:0,height:0},draws:unknown[][]=[],requests:MediaStreamConstraints[]=[],postedAt:number[]=[];
  let width=0,height=0,callbackId=0,presentedFrames=0;
  const videoCallbacks=new Map<number,VideoFrameRequestCallback>();
  const quality={totalVideoFrames:1,droppedVideoFrames:0};
  const canvas={get width(){return width;},set width(value:number){width=value;resize.width++;},
    get height(){return height;},set height(value:number){height=value;resize.height++;},
    getContext:()=>({drawImage:(...args:unknown[])=>{draws.push(args);},getImageData:()=>({data:new Uint8ClampedArray(400)})})};
  const video={pause:()=>{},play:async()=>{},srcObject:null,currentTime:0,videoWidth:options.width??10,videoHeight:options.height??10,readyState:2,
    ownerDocument:{createElement:()=>canvas},
    ...(options.callbacks?{requestVideoFrameCallback:(callback:VideoFrameRequestCallback)=>{videoCallbacks.set(++callbackId,callback);return callbackId;},
      cancelVideoFrameCallback:(id:number)=>{videoCallbacks.delete(id);}}:{}),
    ...(options.quality?{getVideoPlaybackQuality:()=>quality}:{})};
  const callbacks:CameraCallbacks={state:(phase,_message,active)=>{states.push(phase);mediaStates.push({phase,active});},devices:()=>{},frame:(...args)=>{frames.push(args);},generation:()=>generation,invalidate:()=>{generation++;}};
  const fakeWorker={terminate:()=>{stops++;},postMessage:(data:unknown)=>{posts.push(data);postedAt.push(Date.now());},onerror:null as any,onmessage:null as any};
  const media={getUserMedia:(constraints:MediaStreamConstraints)=>{requests.push(constraints);return getUserMedia();},enumerateDevices:async()=>[]};
  const camera=new LocalCamera(video as unknown as HTMLVideoElement,media as unknown as MediaDevices,()=>{workers++;return {worker:fakeWorker as unknown as Worker,release:()=>{releases++;}};},callbacks);
  const present=(time:number)=>{video.currentTime=time;const entry=videoCallbacks.entries().next().value;
    if(!entry)return false;const [id,callback]=entry;videoCallbacks.delete(id);
    callback(Date.now(),{mediaTime:time,presentedFrames:++presentedFrames} as VideoFrameCallbackMetadata);return true;};
  return {camera,states,mediaStates,video,fakeWorker,frames,posts,postedAt,requests,resize,draws,quality,videoCallbacks,present,
    invalidate:()=>{generation++;},counts:()=>({workers,releases,stops,generation})};
}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('camera never requests before Start; late permission result stops tracks after Stop',async()=>{
  let requests=0,resolve!: (s:unknown)=>void,trackStops=0;
  const f=fixture(()=>{requests++;return new Promise(r=>{resolve=r;});});
  assert.equal(requests,0);const pending=f.camera.start();assert.equal(requests,1);
  assert.equal(f.mediaStates.at(-1)?.active,false);
  f.camera.stop();resolve({getTracks:()=>[{stop:()=>{trackStops++;}}]});await pending;
  assert.equal(trackStops,1);assert.equal(f.counts().workers,0);assert.equal(f.video.srcObject,null);assert.equal(f.states.at(-1),'stopped');
});
test('denial reports error after cleanup without starting Worker',async()=>{
  const f=fixture(async()=>{throw new DOMException('denied','NotAllowedError');});await f.camera.start();
  assert.equal(f.states.at(-1),'error');assert.equal(f.counts().workers,0);assert.equal(f.video.srcObject,null);
  assert.ok(f.mediaStates.every(state=>!state.active));
});
test('worker failure/disconnect terminates worker, releases URL and tracks; late messages ignored',async()=>{
  let trackStops=0;const track=new EventTarget() as EventTarget & {stop():void;getSettings():object};track.stop=()=>{trackStops++;};track.getSettings=()=>({});
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  const f=fixture(async()=>stream);await f.camera.start();assert.equal(f.counts().workers,1);
  assert.equal(f.mediaStates.at(-1)?.active,true);
  f.fakeWorker.onerror();assert.equal(f.states.at(-1),'error');assert.equal(trackStops,1);assert.equal(f.counts().releases,1);assert.equal(f.counts().stops,1);
  assert.equal(f.mediaStates.at(-1)?.active,false);
  const before=f.states.length;f.fakeWorker.onmessage({data:{ready:true}});assert.equal(f.states.length,before);
  const g=fixture(async()=>stream);await g.camera.start();track.dispatchEvent(new Event('ended'));assert.equal(g.states.at(-1),'error');assert.equal(g.video.srcObject,null);
  await tick();
});
test('switching camera invalidates late first stream without touching current stream',async()=>{
  let resolve!:(s:any)=>void,first=0,second=0,n=0;
  const track={addEventListener:()=>{},removeEventListener:()=>{},stop:()=>{second++;},getSettings:()=>({})};
  const f=fixture(()=>++n===1?new Promise(r=>{resolve=r;}):Promise.resolve({getTracks:()=>[track],getVideoTracks:()=>[track]}));
  const a=f.camera.start('one');await f.camera.start('two');resolve({getTracks:()=>[{stop:()=>{first++;}}]});await a;
  assert.equal(first,1);assert.equal(second,0);f.camera.stop();assert.equal(second,1);
});
test('stale decoded frames/input generations and wrong worker request IDs never emit identities',async()=>{
  const track={addEventListener:()=>{},removeEventListener:()=>{},stop:()=>{},getSettings:()=>({})};
  const f=fixture(async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]}));await f.camera.start();
  f.fakeWorker.onmessage({data:{ready:true}});
  const request=f.posts.at(-1) as {id:number};assert.ok(request.id);
  f.fakeWorker.onmessage({data:{id:request.id+100,results:[{text:'C25900'}]}});assert.equal(f.frames.length,0);
  f.invalidate();f.fakeWorker.onmessage({data:{id:request.id,results:[{text:'C25900'}]}});assert.equal(f.frames.length,0);
  assert.equal(f.mediaStates.at(-1)?.active,true,'input-generation changes do not imply camera shutdown');
  f.camera.stop();f.fakeWorker.onmessage({data:{id:request.id,results:[{text:'C25900'}]}});assert.equal(f.frames.length,0);
  assert.equal(f.mediaStates.at(-1)?.active,false);
});
function stream(){const track=new EventTarget() as EventTarget & {stop():void;getSettings():object};track.stop=()=>{};track.getSettings=()=>({});
  return {getTracks:()=>[track],getVideoTracks:()=>[track]};}
const decodeRequests=(f:ReturnType<typeof fixture>)=>f.posts.filter((post:any)=>post.id) as {id:number;width:number;height:number}[];
const reply=(f:ReturnType<typeof fixture>,id=decodeRequests(f).at(-1)!.id)=>f.fakeWorker.onmessage({data:{id,results:[{text:'C25900'}]}});
test('capture resolution/frame rate are ideals, while explicit device choice remains exact',async()=>{
  const f=fixture(async()=>stream());await f.camera.start();
  const constraints=f.requests[0].video as MediaTrackConstraints;
  assert.deepEqual(constraints.width,{ideal:1920});assert.deepEqual(constraints.height,{ideal:1080});assert.deepEqual(constraints.frameRate,{ideal:30});
  assert.deepEqual(constraints.facingMode,{ideal:'environment'});f.camera.stop();
  await f.camera.start('chosen');assert.deepEqual((f.requests[1].video as MediaTrackConstraints).deviceId,{exact:'chosen'});f.camera.stop();
});
test('presented-frame callbacks require distinct timestamps, reuse canvas and keep one pending decode',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{callbacks:true,width:1920,height:1080});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});
  assert.equal(decodeRequests(f).length,0);assert.equal(f.videoCallbacks.size,1);
  f.present(0);const first=decodeRequests(f)[0];assert.ok(first);assert.equal(f.videoCallbacks.size,0);
  assert.equal(f.present(.033),false);assert.equal(decodeRequests(f).length,1,'no second job while worker is busy');
  f.fakeWorker.onmessage({data:{id:first.id+99,error:'wrong ID'}});assert.notEqual(f.states.at(-1),'error');
  reply(f,first.id);assert.equal(f.frames.length,1);t.mock.timers.tick(99);assert.equal(f.videoCallbacks.size,0);
  t.mock.timers.tick(1);assert.equal(f.videoCallbacks.size,1);
  f.present(0);assert.equal(decodeRequests(f).length,1,'same timestamp cannot count as independent confirmation');assert.equal(f.videoCallbacks.size,1);
  f.present(.1);assert.equal(decodeRequests(f).length,2);assert.deepEqual(f.resize,{width:1,height:1});
  reply(f,first.id);assert.equal(f.frames.length,1,'late response cannot consume the second pending job');
  reply(f);assert.equal(f.frames.length,2);f.camera.stop();t.mock.timers.tick(20_000);assert.equal(f.frames.length,2);
});
test('slow decoding starts fresh work immediately on completion, not another 220ms later',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{callbacks:true});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});f.present(0);
  t.mock.timers.tick(250);assert.equal(decodeRequests(f).length,1);reply(f);assert.equal(f.videoCallbacks.size,1);
  f.present(.266);assert.equal(decodeRequests(f).length,2);assert.deepEqual(f.postedAt.slice(1),[0,250]);f.camera.stop();
});
test('deterministic first-two-frame eligibility separates decode cost from the former 220ms idle',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  // Identical-frame benchmark medians are roughly 25ms old / 50ms higher-detail new.
  // This is a declared pacing model, not a timing threshold or a physical speed claim.
  const f=fixture(async()=>stream());await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});
  t.mock.timers.tick(50);reply(f);assert.equal(f.frames.length,1);
  f.video.currentTime=.1;t.mock.timers.tick(50);assert.equal(decodeRequests(f).length,2);
  t.mock.timers.tick(50);reply(f);assert.equal(f.frames.length,2);assert.equal(Date.now(),150);
  const oldEligibility=25+220+25;assert.equal(oldEligibility,270);f.camera.stop();
});
test('fallback waits for presented frame count, excluding dropped frames; time-only fallback rejects repeated time',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{quality:true});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});reply(f);
  f.video.currentTime=.1;t.mock.timers.tick(120);assert.equal(decodeRequests(f).length,1);
  f.quality.totalVideoFrames++;f.quality.droppedVideoFrames++;t.mock.timers.tick(20);assert.equal(decodeRequests(f).length,1);
  f.quality.totalVideoFrames++;t.mock.timers.tick(20);assert.equal(decodeRequests(f).length,2);f.camera.stop();
  const g=fixture(async()=>stream());await g.camera.start();g.fakeWorker.onmessage({data:{ready:true}});reply(g);
  t.mock.timers.tick(120);assert.equal(decodeRequests(g).length,1);g.video.currentTime=.2;t.mock.timers.tick(20);assert.equal(decodeRequests(g).length,2);g.camera.stop();
});
test('fast decoding is capped at ten starts per second without repeated allocation',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream());await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});reply(f);
  for(let i=1;i<10;i++){f.video.currentTime=i/30;t.mock.timers.tick(MIN_CAPTURE_INTERVAL_MS);assert.equal(decodeRequests(f).length,i+1);reply(f);}
  t.mock.timers.tick(99);assert.equal(decodeRequests(f).length,10);assert.deepEqual(f.resize,{width:1,height:1});f.camera.stop();
});
test('whole-frame higher detail remains pixel/edge bounded and only resizes on size changes',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{width:3840,height:2160});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});
  assert.deepEqual([decodeRequests(f)[0].width,decodeRequests(f)[0].height],[1920,1080]);reply(f);
  f.video.videoWidth=f.video.videoHeight=4000;f.video.currentTime=.1;t.mock.timers.tick(100);
  const square=decodeRequests(f)[1];assert.ok(square.width<=CAPTURE_MAX_EDGE&&square.height<=CAPTURE_MAX_EDGE&&square.width*square.height<=CAPTURE_MAX_PIXELS);
  assert.ok(square.width>1280,'retain more whole-frame detail than previous ceiling');reply(f);
  f.video.videoWidth=640;f.video.videoHeight=480;f.video.currentTime=.2;t.mock.timers.tick(100);
  assert.deepEqual([decodeRequests(f)[2].width,decodeRequests(f)[2].height],[640,480]);
  assert.ok(f.draws.every(draw=>draw.length===5&&draw[0]===f.video&&draw[1]===0&&draw[2]===0),'never crop to a partial label');f.camera.stop();
});
test('stop/pagehide host cleanup cancels pending video callbacks and ignores late callbacks',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{callbacks:true});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});
  const late=f.videoCallbacks.values().next().value!;const page=new EventTarget();page.addEventListener('pagehide',()=>f.camera.stop());
  page.dispatchEvent(new Event('pagehide'));assert.equal(f.videoCallbacks.size,0);assert.equal(f.counts().releases,1);assert.equal(f.counts().stops,1);
  await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});assert.equal(f.videoCallbacks.size,1);
  late(1,{mediaTime:.1,presentedFrames:1} as VideoFrameCallbackMetadata);
  f.camera.stop();assert.equal(f.videoCallbacks.size,0,'late old callback cannot clear ownership of the new callback');t.mock.timers.tick(20_000);
  assert.equal(decodeRequests(f).length,0);assert.equal(f.states.at(-1),'stopped');assert.equal(f.counts().releases,2);
});
test('repeated/frozen frame callbacks do not extend the fresh-frame watchdog',async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
  const f=fixture(async()=>stream(),{callbacks:true});await f.camera.start();f.fakeWorker.onmessage({data:{ready:true}});f.present(0);reply(f);
  t.mock.timers.tick(100);f.present(0);t.mock.timers.tick(9000);f.present(0);assert.equal(decodeRequests(f).length,1);
  t.mock.timers.tick(1000);assert.equal(f.states.at(-1),'error');assert.equal(f.videoCallbacks.size,0);assert.equal(f.counts().releases,1);
});
