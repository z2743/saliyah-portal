import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker from '../src/worker.js';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
const seen=[];
const db={prepare(sql){return {bind(...args){seen.push({sql,args});return this},async first(){if(sql.includes('FROM sessions s JOIN users'))return {id:'citizen1',username:'tester',role:'citizen'};return null},async all(){return {results:[]}},async run(){return {meta:{changes:0}}}}}};
const env={DB:db,ASSETS:{fetch:async()=>new Response('asset')}};
async function request(path,{method='GET',cookie=false,headers={},body}={}){
 const h={...headers};if(cookie)h.cookie='saliyah_session=12345678-1234-1234-1234-123456789abc';if(body!==undefined)h['content-type']='application/json';
 return worker.fetch(new Request('https://portal.example'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);
}
const checks=[];
async function test(label,fn){await fn();checks.push(label);console.log('PASS',label)}
await test('Public assets served without database queries',async()=>{const r=await request('/');assert.equal(r.status,200);assert.equal(await r.text(),'asset')});
await test('Unauthenticated private API is rejected',async()=>{const r=await request('/api/admin/readiness');assert.equal(r.status,401)});
await test('Citizen cannot view royal readiness',async()=>{const r=await request('/api/admin/readiness',{cookie:true});assert.equal(r.status,403)});
await test('Citizen cannot list other users sessions',async()=>{const r=await request('/api/security/sessions',{cookie:true});assert.equal(r.status,200);const j=await r.json();assert.deepEqual(j.sessions,[])});
await test('Cross-origin POST rejected',async()=>{const r=await request('/api/security/revoke-others',{method:'POST',cookie:true,headers:{origin:'https://evil.example'}});assert.equal(r.status,403)});
await test('Cross-site POST rejected',async()=>{const r=await request('/api/security/revoke-others',{method:'POST',cookie:true,headers:{'sec-fetch-site':'cross-site'}});assert.equal(r.status,403)});
await test('Invalid session revoke rejected',async()=>{const r=await request('/api/security/revoke',{method:'POST',cookie:true,body:{id:'not-a-hash'}});assert.equal(r.status,400)});
await test('No DB binding returns 503',async()=>{const r=await worker.fetch(new Request('https://portal.example/api/me'),{ASSETS:env.ASSETS});assert.equal(r.status,503)});
console.log(`${checks.length} HTTP contract tests passed (mock D1; not live Cloudflare)`);
