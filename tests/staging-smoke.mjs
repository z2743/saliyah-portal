// Read-only smoke test for a user-supplied staging URL. Never sends credentials.
import assert from 'node:assert/strict';
const raw=process.env.STAGING_URL||process.argv[2];
if(!raw){console.error('Usage: npm run smoke -- https://your-staging-domain.example');process.exit(2)}
let base;
try{base=new URL(raw);assert.equal(base.protocol,'https:');assert.equal(base.username,'');assert.equal(base.password,'');assert.equal(base.search,'');assert.equal(base.hash,'');assert.equal(base.pathname,'/');}catch{console.error('Provide an HTTPS origin with no credentials, path or query.');process.exit(2)}
const checks=[];
async function check(name,path,verify){
 try{const response=await fetch(new URL(path,base),{method:'GET',redirect:'manual',headers:{'accept':'application/json'},signal:AbortSignal.timeout(12000)});const ct=response.headers.get('content-type')||'';const data=ct.includes('application/json')?await response.json():await response.text();verify(response,data);checks.push([name,true]);}
 catch(e){checks.push([name,false,String(e.message||e).slice(0,180)]);}
}
await check('Public homepage','/',(r,body)=>{assert.equal(r.status,200);assert.equal(typeof body,'string');assert.match(body,/html/i)});
await check('Public data','/api/public',(r,body)=>{assert.equal(r.status,200);assert.ok(Array.isArray(body.ministries));assert.ok(Array.isArray(body.governorates))});
await check('Setup status','/api/setup/status',(r,body)=>{assert.equal(r.status,200);assert.equal(typeof body.needsSetup,'boolean');if(body.needsSetup)console.warn('WARNING: King setup is still open. Do not publish this instance.')});
await check('Anonymous identity','/api/me',(r,body)=>{assert.equal(r.status,200);assert.equal(body.user,null)});
await check('Protected bank data','/api/bank/accounts',(r,body)=>{assert.equal(r.status,401);assert.equal(typeof body.error,'string')});
await check('Protected readiness','/api/admin/readiness',(r,body)=>{assert.equal(r.status,401);assert.equal(typeof body.error,'string')});
await check('Cross-origin POST blocked','/api/auth/logout',(r,body)=>{assert.equal(r.status,401)}); // GET without a session must be rejected
for(const [name,ok,detail] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' — '+detail:''}`);
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} checks passed`);
if(checks.some(x=>!x[1]))process.exitCode=1;
