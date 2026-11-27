// The kit's OWN constants, read out of the kit's bundle.
//
// The kit is one bundled module; each module declares its constants in a `var ...;` list and
// assigns them inside an __esm init function. The view module's init body is lifted and RUN
// here, so the boxes, the gap, the pricing model and the byte-per-token figure are the kit's
// own values -- not values copied out of the kit and left to rot.
//
// WHY THIS IS NOT A CONSTANT: on 2026-11-27 the kit was refreshed and its cover box
// changed from 1024x640 to 1440x1440. That made the composed cover 1440x900, which costs
// 1,716 tokens instead of 1,120, so the images cost 2,836 tokens instead of 2,240 -- and
// the judge's TEXT budget fell from 30,144 bytes to 28,356. A hard-coded budget would
// have kept measuring a view the judge does not receive.
//
// TWO constants live outside the view module -- the image pricing multipliers and the
// bytes per token -- and their modules call into zod, which is not in the bundle. So those
// two are lifted as their own assignment rather than by running a module init.
//
// The lift FAILS LOUDLY if the kit changes shape: a missing module, a missing constant or
// an assignment that does not parse all throw. A measurement that silently falls back to
// an old number is worse than no measurement.
import fs from 'node:fs';
import nodeCrypto from 'node:crypto';

const KIT = '/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';

// The kit's module blocks, by their own "// path" comments.
function blockAt(src, modulePath) {
  const marker = '\n// ' + modulePath + '\n';
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('the kit has no module ' + modulePath);
  const j = src.indexOf('\n// ', i + marker.length);
  return src.slice(i + 1, j > 0 ? j : src.length);
}

// The init function of a module block: its `var` list and its body.
function liftInit(src, initName, modulePath) {
  const block = blockAt(src, modulePath);
  const decl = new RegExp('var ([A-Za-z_$][\\w$]*(?:, [A-Za-z_$][\\w$]*)*);\\nvar ' + initName + ' = __esm\\(\\{')
    .exec(block);
  if (!decl) throw new Error('the kit has no ' + initName + ' in ' + modulePath);
  const names = decl[1].split(', ').map((s) => s.trim());

  const i = block.indexOf('var ' + initName + ' = __esm({');
  const j = block.indexOf('\n});', i);
  if (j < 0) throw new Error('the kit\'s ' + initName + ' block is not terminated');
  const initBlock = block.slice(i, j + 4);

  // the init function's body: from just after its opening brace to its matching close
  const bodyStart = initBlock.indexOf('() {') + 4;
  let depth = 1;
  let k = bodyStart;
  for (; k < initBlock.length && depth > 0; k++) {
    if (initBlock[k] === '{') depth++;
    else if (initBlock[k] === '}') depth--;
  }
  const body = initBlock.slice(bodyStart, k - 1)
    // the lifted body assigns the declared vars, so the directive is not needed
    .replace(/"use strict";/, '')
    // the other kit modules are NOT lifted, so their init calls would throw
    .replace(/^(\s*)init_[A-Za-z0-9_]+\(\);$/gm, '$1/* init */;');

  return { names, body };
}

// The value of `name = <expr>;` in a block, as SOURCE TEXT. Only used for the two
// constants whose modules cannot be run, and only for values that are arrays or numbers
// -- so the scan counts brackets and tracks strings, and a regex literal is not a case it
// has to survive.
function assignment(block, name) {
  const at = block.search(new RegExp('(^|[\\s;{])' + name + '\\s*='));
  if (at < 0) throw new Error('the kit does not assign ' + name);
  const start = block.indexOf('=', at) + 1;
  let depth = 0;
  let inStr = null;
  for (let i = start; i < block.length; i++) {
    const c = block[i];
    const prev = block[i - 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '{' || c === '[') { depth++; continue; }
    if (c === ')' || c === '}' || c === ']') { depth--; continue; }
    if (c === ';' && depth === 0) return block.slice(start, i);
  }
  throw new Error('the kit\'s assignment of ' + name + ' does not end');
}

export function kitConstants(src) {
  const out = {};

  // The view module's own init, run as it is.
  const view = liftInit(src, 'init_dossier_view', 'server/judging/dossier-view.ts');
  const V = new Function('createHash151', 'var ' + view.names.join(', ') + ';\n' + view.body
    + '\nreturn { ' + view.names.map((n) => n + ':' + n).join(', ') + ' };')
    ((alg) => nodeCrypto.createHash(alg));
  for (const n of view.names) {
    if (V[n] === undefined) throw new Error('the kit\'s ' + n + ' is undefined');
    out[n] = V[n];
  }

  // The two that live elsewhere.
  const call = blockAt(src, 'grader/judge-call.ts');
  out.OPENAI_PATCH_MULTIPLIERS = new Function('return (' + assignment(call, 'OPENAI_PATCH_MULTIPLIERS') + ');')();
  const policy = blockAt(src, 'grader/gateway/policy.ts');
  out.BYTES_PER_INPUT_TOKEN = new Function('return (' + assignment(policy, 'BYTES_PER_INPUT_TOKEN') + ');')();

  if (out.BYTES_PER_INPUT_TOKEN === undefined) throw new Error('the kit has no BYTES_PER_INPUT_TOKEN');
  return out;
}

export function liftKitConstants(kitPath = KIT) {
  return kitConstants(fs.readFileSync(kitPath, 'utf8'));
}
