const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function loadTS(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  return mod.exports;
}
(async () => {
  const c = loadTS('lib/catalog.ts');
  assert.equal(c.teams.length, 12);
  assert.equal(new Set(c.teams.map(t => t.id)).size, 12);
  assert(c.configSchema.safeParse(c.defaultConfig).success);
  for (const invalid of [{frontScale: 2}, {primary:'red'}, {shopDomain:'https://example.com'}, {includeQR:'true'}]) {
    assert.equal(c.configSchema.safeParse({...c.defaultConfig,...invalid}).success, false);
  }
  assert.throws(() => c.draftKey('../invalid'));
  for (const teamIds of [[], ['../invalid'], ['dayton-eagles','dayton-eagles']]) {
    assert.equal(c.generateSchema.safeParse({designs:teamIds.map(teamId=>({teamId,config:c.defaultConfig}))}).success, false);
  }
  assert(c.generateSchema.safeParse({designs:c.teams.map(t=>({teamId:t.id,config:c.teamDefaultConfig(t.id)}))}).success);
  for (const team of c.teams) {
    for (const asset of [team.logo, team.back]) assert(fs.existsSync(path.resolve(__dirname,'../public'+asset)), asset);
  }
  const z = loadTS('lib/zip.ts');
  const fixture = z.zipFiles([{name:'front.png',bytes:new Uint8Array([0,1,2,255])},{name:'notes/équipe.txt',bytes:new TextEncoder().encode('Dayton Eagles')}]);
  fs.writeFileSync('/tmp/lincforge-zip-test.zip', Buffer.from(await fixture.arrayBuffer()));
  console.log('Team whitelist, configuration boundaries, asset coverage, draft identity, and ZIP fixture passed.');
})().catch(e=>{console.error(e);process.exit(1)});
