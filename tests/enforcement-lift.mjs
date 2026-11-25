import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const frontend=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const view=frontend.slice(frontend.indexOf('async function enforcementPage(){'),frontend.indexOf('async function xSaliyah(){'));
assert.match(view,/liftEnforcementForm/);
assert.match(view,/app\.onsubmit=async e=>/);
assert.match(view,/await post\('\/enforcement\/lift'/);
assert.doesNotMatch(view,/\bprompt\(/);
assert.doesNotMatch(view,/\balert\(/);
assert.match(view,/\/enforcement\/reconcile/);
const migration=readFileSync(new URL('../migrations/0072_debt_paid_suspension_release.sql',import.meta.url),'utf8');
assert.match(migration,/AFTER UPDATE OF status,remaining_amount ON debt_claims/);
assert.match(migration,/e\.action='both'/);
assert.match(migration,/d\.status='paid' AND d\.remaining_amount=0/);
function mock(role='king'){
 const entries=[{id:'hold-paid-0001',status:'active',case_action:'both',debt_status:'paid',debt_remaining:0},{id:'hold-independent-0002',status:'active',case_action:'service_suspension',debt_status:null,debt_remaining:null}];
 const events=[];
 const db={entries,events,prepare(sql){let vals=[];return {bind(...args){vals=args;return this},async first(){if(sql.includes('FROM sessions s JOIN users'))return {id:'king-1',username:'king',role};return null},async all(){if(sql.includes('FROM enforcement_cases_v2 e JOIN users'))return {results:[]};if(sql.includes('FROM service_suspensions_v2 s JOIN users'))return {results:entries};if(sql.includes('SELECT ministry_id FROM ministry_accounts'))return {results:[]};return {results:[]}},async run(){if(sql.includes('INSERT INTO audit_log')){events.push({sql,vals});return {meta:{changes:1}}}if(sql.startsWith('UPDATE service_suspensions_v2 SET')){if(sql.includes('WHERE id=?')){const found=entries.find(x=>x.id===vals[1]&&x.status==='active');if(found){found.status='lifted';return {meta:{changes:1}}}return {meta:{changes:0}}}let changes=0;for(const e of entries){if(e.status==='active'&&e.case_action==='both'&&e.debt_status==='paid'&&e.debt_remaining===0){e.status='lifted';changes++}}return {meta:{changes}}}return {meta:{changes:0}}}}},async batch(statements){const res=[];for(const stmt of statements)res.push(await stmt.run());return res}};return db;
}
const cookie='saliyah_session=12345678-1234-1234-1234-123456789abc';
async function call(db,method,path,body){const res=await worker.fetch(new Request('https://portal.example'+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),{DB:db,ASSETS:{fetch:async()=>new Response('ok')}});return {status:res.status,data:await res.json()}}
const db=mock();let r=await call(db,'POST','/api/enforcement/reconcile',{});assert.equal(r.status,200);assert.equal(r.data.lifted,1);assert.equal(db.entries[0].status,'lifted');assert.equal(db.entries[1].status,'active');r=await call(db,'POST','/api/enforcement/reconcile',{});assert.equal(r.data.lifted,0);
r=await call(db,'POST','/api/enforcement/lift',{id:'hold-independent-0002',reason:'رفع بقرار ملكي'});assert.equal(r.status,200);assert.equal(db.entries[1].status,'lifted');r=await call(db,'POST','/api/enforcement/lift',{id:'hold-independent-0002',reason:'رفع بقرار ملكي'});assert.equal(r.status,409);
r=await call(mock('citizen'),'POST','/api/enforcement/lift',{id:'hold-paid-0001',reason:'قرار غير مخول'});assert.equal(r.status,403);
r=await call(mock('citizen'),'POST','/api/enforcement/reconcile',{});assert.equal(r.status,403);
console.log('PASS enforcement: paid linked suspension released once, independent hold preserved, manual release, permissions, inline UI');
