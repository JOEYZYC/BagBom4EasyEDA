import * as fs from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';

export function buildOutputPaths(root, filename) {
  return {
    tool: resolve(root, 'output/html-enhancer.html'),
    enhanced: resolve(root, 'output', filename),
    notices: resolve(root, 'output/THIRD_PARTY_NOTICES.txt'),
    harness: resolve(root, 'tests/.generated/harness.html'),
  };
}

const folded = path => path.toLowerCase();
function fileIdentity(info, path) {
  if (!info.isFile() || typeof info.dev !== 'bigint' || typeof info.ino !== 'bigint' || info.dev < 0n || info.ino <= 0n) {
    throw new Error(`Cannot establish regular-file identity; refusing writes: ${path}`);
  }
  return `${info.dev}:${info.ino}`;
}
async function inspectPath(path, io) {
  let cursor = resolve(path);
  const missing = [];
  while (true) {
    let canonical;
    try { canonical = await io.realpath(cursor); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot resolve path; refusing writes: ${cursor}`, {cause: error});
      // ENOENT may mean a dangling link, not an absent destination. Never write through it.
      let exists = false;
      try { await io.lstat(cursor, {bigint: true}); exists = true; }
      catch (failure) { if (failure.code !== 'ENOENT') throw new Error(`Uncertain path identity: ${cursor}`, {cause: failure}); }
      if (exists) throw new Error(`Unresolvable existing path/alias; refusing writes: ${cursor}`);
      const parent = dirname(cursor);
      if (parent === cursor) throw new Error(`No resolvable parent; refusing writes: ${path}`);
      missing.unshift(basename(cursor)); cursor = parent; continue;
    }
    if (typeof canonical !== 'string' || !canonical) throw new Error(`Uncertain canonical path: ${cursor}`);
    const info = await io.stat(cursor, {bigint: true});
    if (missing.length) {
      if (!info.isDirectory()) throw new Error(`Destination parent is not a directory: ${cursor}`);
      return {canonical: resolve(canonical, ...missing), identity: undefined, exists: false};
    }
    return {canonical, identity: fileIdentity(info, cursor), exists: true};
  }
}

export async function preflightSourcePaths(source, destinations, io = fs) {
  const original = await inspectPath(source, io);
  if (!original.exists) throw new Error(`Source must exist; refusing writes: ${source}`);
  const inspected = [];
  for (const path of destinations) {
    const target = await inspectPath(path, io);
    if (folded(resolve(source)) === folded(resolve(path)) || folded(original.canonical) === folded(target.canonical) ||
        target.identity !== undefined && original.identity === target.identity) {
      throw new Error(`Refusing to overwrite source through output path/alias: ${path}`);
    }
    if (inspected.some(previous => folded(previous.canonical) === folded(target.canonical) ||
        target.identity !== undefined && target.identity === previous.identity)) {
      throw new Error(`Output destinations alias each other; refusing writes: ${path}`);
    }
    inspected.push(target);
  }
}

// All build mutations go through this complete plan; no mkdir/write precedes preflight.
// A concurrently changed filesystem is outside this preflight's guarantee; do not race builds/links.
export async function writeBuildOutputs(source, outputs, io = fs) {
  await preflightSourcePaths(source, outputs.map(output => output.path), io);
  for (const directory of new Set(outputs.map(output => dirname(resolve(output.path))))) await io.mkdir(directory, {recursive: true});
  for (const output of outputs) await io.writeFile(output.path, output.contents, 'utf8');
}
