// Static guard against silent buttons and stale embedded Worker UI.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/airport.html',import.meta.url),'utf8');
const embeddedApp=worker.match(/^const LIVE_PORTAL_APP_SOURCE=(.+);$/m);
const embeddedAirport=worker.match(/^const LIVE_AIRPORT_HTML_SOURCE=(.+);$/m);
assert.ok(embeddedApp,'Worker must embed live portal app');
assert.ok(embeddedAirport,'Worker must embed live airport page');
assert.equal(JSON.parse(embeddedApp[1]),app,'Embedded portal must match public/app.js exactly');
assert.equal(JSON.parse(embeddedAirport[1]),html,'Embedded airport must match public/airport.html exactly');
const pages=[...new Set([...app.matchAll(/href="#\/([a-z][a-z0-9-]*)/g)].map(m=>m[1]))];
for(const name of pages)assert.ok(app.includes(`part==='${name}'`),`Broken navigation destination #/${name}`);
const calls=[...new Set([...app.matchAll(/(?:post|send|api)\('([/][^'\?]+)'/g)].map(m=>m[1]))];
for(const call of calls){
 const path='/api'+call;
 const declared=worker.includes(`path==='${path}'`)||
  worker.includes(`path==="${path}"`)||
  worker.includes(`path.startsWith('${path}`)||
  (path.startsWith('/api/company/operations/')&&worker.includes(`suffix==='${path.slice('/api/company/operations/'.length)}'`))||
  path==='/api/company/staff/'&&worker.includes("path.startsWith('/api/company/staff')");
 assert.ok(declared,`UI calls API with no apparent route: ${path}`);
}
for(const id of [...new Set([...app.matchAll(/document\.querySelector\('#([A-Za-z0-9_-]+)'\)\.onsubmit/g)].map(m=>m[1]))])
 assert.ok(app.includes(`id="${id}"`),`Submit handler references missing form: ${id}`);
assert.ok(app.includes('companyDeleteItem')&&app.includes('companyItemEdit'),'Company catalog must offer delete and edit controls');
assert.ok(worker.includes("suffix==='item/delete'")&&worker.includes('deleted_at IS NULL'),'Catalog deletion API must exist and filter deleted rows');
console.log(`PASS live embeds match public assets; ${pages.length} navigation links, ${calls.length} API routes and catalog actions checked`);
