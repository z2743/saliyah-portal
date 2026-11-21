import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const users=new Map(), throttles=new Map(), sessions=new Map(), audit=[];
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){
 if(sql.includes('FROM sessions s JOIN users')){const s=sessions.get(args[0]);return s?[...users.values()].find(u=>u.id===s)||null:null}
 if(sql.includes('FROM users WHERE username='))return users.get(args[0])||null;
 if(sql.includes('FROM login_throttles'))return throttles.get(args[0])||null;
 if(sql.includes('COUNT(*) n FROM users'))return {n:users.size};
 if(sql.includes('FROM staff_permissions'))return null;
 return null;
},async all(){return {results:[]}},async run(){
 if(sql.startsWith('INSERT INTO users')){users.set(args[1],{id:args[0],username:args[1],password_hash:args[2],salt:args[3],role:'king'});return {meta:{changes:1}}}
 if(sql.startsWith('INSERT INTO sessions')){sessions.set(args[0],args[1]);return {meta:{changes:1}}}
 if(sql.startsWith('DELETE FROM sessions WHERE token_hash=')){const ok=sessions.delete(args[0]);return {meta:{changes:Number(ok)}}}
 if(sql.startsWith('INSERT INTO login_throttles')){throttles.set(args[0],{failures:args[1],window_start:args[2],locked_until:args[3]});return {meta:{changes:1}}}
 if(sql.startsWith('DELETE FROM login_throttles')){throttles.delete(args[0]);return {meta:{changes:1}}}
 if(sql.startsWith('INSERT INTO audit_log')){audit.push(args);return {meta:{changes:1}}}
 return {meta:{changes:0}};
}}}};
const env={DB:db,SETUP_SECRET:'testing-only-setup-secret',ASSETS:{fetch:async()=>new Response('ok')}};
async function call(path,body,session){const h={};if(body!==undefined)h['content-type']='application/json';if(session)h.cookie=session;const r=await worker.fetch(new Request('https://example.test'+path,{method:body===undefined?'GET':'POST',headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}};
const pass='a-strong-password-123';
let r=await call('/api/setup/king',{setup_secret:'wrong',username:'king',password:pass});assert.equal(r.status,403);
r=await call('/api/setup/king',{setup_secret:env.SETUP_SECRET,username:'king',password:pass});assert.equal(r.status,200);assert.equal(users.size,1);
r=await call('/api/setup/king',{setup_secret:env.SETUP_SECRET,username:'other',password:pass});assert.equal(r.status,403);
r=await call('/api/auth/login',{username:'king',password:'incorrect'});assert.equal(r.status,401);
r=await call('/api/auth/login',{username:'king',password:pass});assert.equal(r.status,200);assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Strict/);assert.match(r.cookie,/Secure/);
const cookie=r.cookie.split(';')[0];r=await call('/api/me',undefined,cookie);assert.equal(r.data.user.username,'king');
r=await call('/api/auth/logout',{},cookie);assert.equal(r.status,200);
r=await call('/api/me',undefined,cookie);assert.equal(r.data.user,null);
for(let i=0;i<5;i++){r=await call('/api/auth/login',{username:'king',password:'bad'});assert.equal(r.status,401)}
r=await call('/api/auth/login',{username:'king',password:pass});assert.equal(r.status,429);
console.log('PASS 9 auth-flow checks (in-memory mocked D1; not live Cloudflare)');
