import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const accounts={king:{id:'king-id',username:'king',role:'king'},employee:{id:'employee-id',username:'employee',role:'employee'},citizen:{id:'citizen-id',username:'citizen',role:'citizen'}};
const granted=new Set();const staff=[];let checks=0;
const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){if(sql.includes('FROM sessions s JOIN users'))return accounts[args[0]]||null;if(sql.includes('FROM staff_permissions WHERE'))return granted.has(args[0]+':'+args[1])?{ok:1}:null;if(sql.includes("FROM users WHERE id=? AND role='employee'"))return args[0]===accounts.employee.id?{id:args[0]}:null;return null},async all(){if(sql.includes('FROM users u LEFT JOIN staff_permissions'))return {results:staff};return {results:[]}},async run(){if(sql.startsWith('DELETE FROM staff_permissions')){for(const k of [...granted])if(k.startsWith(args[0]+':'))granted.delete(k)}if(sql.startsWith('INSERT INTO staff_permissions'))granted.add(args[0]+':'+args[1]);return {meta:{changes:1}}}}}};
const env={DB:db,ASSETS:{fetch:async()=>new Response('asset')}};
async function call(path,role,{method='GET',body}={}){const h={};if(role)h.cookie='saliyah_session='+role;if(body){h['content-type']='application/json'}return worker.fetch(new Request('https://portal.example'+path,{method,headers:h,body:body?JSON.stringify(body):undefined}),env)}
// Use deterministic token hashes as the mock's session identifiers.
const tokens={};const tokenFor={king:'a'.repeat(36),employee:'b'.repeat(36),citizen:'c'.repeat(36)};for(const role of Object.keys(accounts)){const token=tokenFor[role];const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));tokens[Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')]=accounts[role];}
// Override the session lookup for this suite, preserving real cookie->SHA256 behavior.
const original=db.prepare;db.prepare=function(sql){const q=original.call(this,sql);if(sql.includes('FROM sessions s JOIN users')){let args=[];return {bind(...a){args=a;return this},async first(){return tokens[args[0]]||null}}}return q};
async function req(path,role,options={}){const h={};if(role)h.cookie='saliyah_session='+tokenFor[role];if(options.body)h['content-type']='application/json';return worker.fetch(new Request('https://portal.example'+path,{method:options.method||'GET',headers:h,body:options.body?JSON.stringify(options.body):undefined}),env)}
async function test(name,fn){await fn();checks++;console.log('PASS',name)}
await test('Citizen cannot grant staff permissions',async()=>{const r=await req('/api/admin/staff/permissions','citizen',{method:'POST',body:{id:accounts.employee.id,permissions:['health']}});assert.equal(r.status,403)});
await test('Employee cannot grant own permissions',async()=>{const r=await req('/api/admin/staff/permissions','employee',{method:'POST',body:{id:accounts.employee.id,permissions:['health']}});assert.equal(r.status,403)});
await test('King can grant newer ministry permissions',async()=>{const r=await req('/api/admin/staff/permissions','king',{method:'POST',body:{id:accounts.employee.id,permissions:['health','commerce','land','police','appeals','finance','budget_propose']}});assert.equal(r.status,200);assert.equal(granted.size,7)});
await test('Unknown permission rejected',async()=>{const r=await req('/api/admin/staff/permissions','king',{method:'POST',body:{id:accounts.employee.id,permissions:['superadmin']}});assert.equal(r.status,400)});
await test('Employee cannot access royal readiness even with ministry permissions',async()=>{const r=await req('/api/admin/readiness','employee');assert.equal(r.status,403)});
await test('Citizen cannot access bank administration',async()=>{const r=await req('/api/bank-admin/accounts','citizen');assert.equal(r.status,403)});
await test('Unassigned employee cannot access bank administration',async()=>{const r=await req('/api/bank-admin/accounts','employee');assert.equal(r.status,403)});
await test('Cross-origin permission update rejected',async()=>{const r=await worker.fetch(new Request('https://portal.example/api/admin/staff/permissions',{method:'POST',headers:{cookie:'saliyah_session='+tokenFor.king,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({id:accounts.employee.id,permissions:['banking']})}),env);assert.equal(r.status,403)});
console.log(`${checks} role and permission tests passed (mock D1)`);
