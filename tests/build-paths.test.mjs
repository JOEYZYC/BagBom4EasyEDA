import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {buildOutputPaths,preflightSourcePaths,writeBuildOutputs} from '../scripts/output-paths.mjs';

const error = code => Object.assign(new Error(code), {code});
const file = ino => ({dev: 1n, ino, isFile:()=>true, isDirectory:()=>false});
const directory = {isFile:()=>false, isDirectory:()=>true};
function fakeIO(source, destinations) {
  const entries = new Map();
  const key = path => resolve(path).toLowerCase();
  function add(path, info, canonical=resolve(path)) {
    entries.set(key(path), {info,canonical});
    let parent=dirname(resolve(path));
    while(!entries.has(key(parent))){entries.set(key(parent),{info:directory,canonical:parent});const next=dirname(parent);if(next===parent)break;parent=next;}
  }
  add(source,file(1n));
  destinations.forEach((path,i)=>add(path,file(BigInt(i+2))));
  const mutations=[];
  const io={
    realpath:async path=>{const entry=entries.get(key(path));if(!entry)throw error('ENOENT');if(entry.failure)throw error(entry.failure);return entry.canonical;},
    stat:async path=>{const entry=entries.get(key(path));if(!entry)throw error('ENOENT');return entry.info;},
    lstat:async path=>{const entry=entries.get(key(path));if(!entry)throw error('ENOENT');return entry.info;},
    mkdir:async(...args)=>{mutations.push(['mkdir',...args]);},
    writeFile:async(...args)=>{mutations.push(['writeFile',...args]);},
  };
  return {io,entries,key,add,mutations};
}
const root=resolve('tests/.generated/injected-paths');
const source=resolve(root,'source.html');
const paths=Object.values(buildOutputPaths(root,'native_扫码版.html'));
const outputs=paths.map(path=>({path,contents:'generated fixture only'}));

test('P1 every planned source collision preserves sentinel bytes and performs zero mkdir/writes',async()=>{
  await fs.mkdir('tests/.generated',{recursive:true});
  const fixture=await fs.mkdtemp(resolve('tests/.generated/preflight-'));
  try {
    const targets=Object.values(buildOutputPaths(fixture,'native_扫码版.html'));
    for (const target of targets) {await fs.mkdir(dirname(target),{recursive:true});await fs.writeFile(target,`SENTINEL ${target}`);}
    for (const input of targets) {
      const before=await fs.readFile(input),mutations=[];
      const io={...fs,mkdir:async(...args)=>{mutations.push(['mkdir',...args]);},writeFile:async(...args)=>{mutations.push(['writeFile',...args]);}};
      await assert.rejects(()=>writeBuildOutputs(input,targets.map(path=>({path,contents:'must never write'})),io),/overwrite source/);
      assert.deepEqual(await fs.readFile(input),before,input);assert.deepEqual(mutations,[],input);
    }
  } finally {await fs.rm(fixture,{recursive:true,force:true});}
});
test('P1 case, canonical/symlink and hardlink aliases are rejected before any mutations',async()=>{
  for (const kind of ['case','canonical','hardlink']) {
    const f=fakeIO(source,paths);
    if(kind==='case')f.add(paths[3],file(99n),source.toUpperCase());
    if(kind==='canonical')f.add(paths[3],file(99n),source);
    if(kind==='hardlink')f.add(paths[3],file(1n));
    await assert.rejects(()=>writeBuildOutputs(source,outputs,f.io),/overwrite source/);
    assert.deepEqual(f.mutations,[],kind);
  }
  const f=fakeIO(source,paths);
  await assert.rejects(()=>writeBuildOutputs(source,[{path:source.toUpperCase(),contents:'no'}],f.io),/overwrite source/);
  assert.deepEqual(f.mutations,[]);
});
test('P1 uncertain file identity, dangling aliases and resolution errors fail closed with zero writes',async()=>{
  for(const kind of ['source-inode','target-inode','dangling','permission','source-missing','parent-not-directory']){
    const f=fakeIO(source,paths);
    if(kind==='source-inode')f.add(source,file(0n));
    if(kind==='target-inode')f.add(paths[3],file(0n));
    if(kind==='dangling'||kind==='permission')f.entries.get(f.key(paths[3])).failure=kind==='dangling'?'ENOENT':'EACCES';
    if(kind==='source-missing')f.entries.delete(f.key(source));
    if(kind==='parent-not-directory'){f.entries.delete(f.key(paths[3]));f.add(dirname(paths[3]),file(77n));}
    await assert.rejects(()=>writeBuildOutputs(source,outputs,f.io));assert.deepEqual(f.mutations,[],kind);
  }
});
test('complete output plans inspect late destinations and reject cross-output aliases',async()=>{
  const f=fakeIO(source,paths);f.add(paths[3],file(2n));
  await assert.rejects(()=>writeBuildOutputs(source,outputs,f.io),/alias each other/);assert.deepEqual(f.mutations,[]);
});
test('distinct missing destinations resolve through existing parents without preflight writes',async()=>{
  const f=fakeIO(source,[]);
  await preflightSourcePaths(source,paths,f.io);assert.deepEqual(f.mutations,[]);
  assert.deepEqual(Object.keys(buildOutputPaths(root,'native_扫码版.html')),['tool','enhanced','notices','harness']);
});
