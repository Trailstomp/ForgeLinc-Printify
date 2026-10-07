const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = {exports: {}};
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/jersey-sizes-client.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(mod, mod.exports);
const {loadJerseySizes, JerseySizeError} = mod.exports;
const realFetch = global.fetch;
const list = () => Response.json({variants: [{size: 'XL'}, {size: '2XL'}, {size: 'XL'}]});
let calls, queue;
function responses(...items) {
  calls = [];
  queue = items;
  global.fetch = async (url, init) => {
    calls.push({url, init});
    init.signal.throwIfAborted();
    assert(queue.length, 'No unbounded retries');
    return queue.shift();
  };
}
const load = (admin = false, signal = new AbortController().signal) => loadJerseySizes(admin, signal);
(async () => {
  try {
    responses(list());
    assert.deepEqual(await load(), ['XL', '2XL']);
    assert.match(calls[0].url, /^\/api\/shop\/sizes\?refresh=/);
    assert.equal(calls[0].init.headers.Accept, 'application/json');
    assert.equal(calls[0].init.credentials, 'same-origin');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.equal(calls[0].init.redirect, 'manual');

    responses(new Response('<!DOCTYPE html><html>Old page</html>', {headers: {'Content-Type': 'text/html'}}), list());
    assert.deepEqual(await load(true), ['XL', '2XL']);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /^\/api\/printify\/catalog\?refresh=/);
    assert.notEqual(calls[0].url, calls[1].url);

    for (const response of [
      Response.json({error: 'Please sign in'}, {status: 401}),
      new Response('', {status: 302}),
      {status: 0, type: 'opaqueredirect'},
      new Response('<!DOCTYPE html><a href="/signin-with-chatgpt">Continue with ChatGPT</a>'),
    ]) {
      responses(response);
      await assert.rejects(load(), error => error instanceof JerseySizeError && error.signInRequired);
      assert.equal(calls.length, 1, 'Do not retry authentication failures');
    }

    responses(new Response('<!DOCTYPE html>Unavailable'), new Response('<!DOCTYPE html>Unavailable'));
    await assert.rejects(load(), error => error instanceof JerseySizeError && /Reload ForgeLinc/.test(error.message));
    assert.equal(calls.length, 2);

    responses(Response.json({error: 'Reconnect Printify.'}, {status: 403}));
    await assert.rejects(load(), /Reconnect Printify/);
    assert.equal(calls.length, 1);
    responses(new Response('incomplete'));
    await assert.rejects(load(), error => error instanceof JerseySizeError && !/Unexpected token/.test(error.message));
    for (const variants of [null, [{size: 2}], [null], []]) {
      responses(Response.json({variants}));
      await assert.rejects(load(), JerseySizeError);
    }
    const controller = new AbortController();
    controller.abort();
    responses(list());
    await assert.rejects(load(false, controller.signal), error => error.name === 'AbortError');
    assert.equal(calls.length, 1);
    console.log('Passed: XL/2XL provider sizes, both catalog routes, fresh GETs, bounded HTML recovery, sign-in redirects, provider errors, invalid lists, and cancellation.');
  } finally { global.fetch = realFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
