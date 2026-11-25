import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const citizens=[
 {id:'sim-resident-0763',name:'خالد بن إبراهيم السلمي',occupation:'باحث عن عمل',created_at:'2026-11-25'},
 {id:'sim-employee-0001',name:'عبدالله بن سعد الغامدي',occupation:'موظف',created_at:'2026-11-25'}
];
const companies=[{id:'sim-company-1',name:'شركة تجريبية',founder_id:'sim-resident-0763',status:'approved'}];
const names=new Map([...citizens,...companies,{id:'sim-bank-c-sim-employee-0001',name:citizens[1].name}].map(x=>[x.id,x.name]));
let resolutionQueries=0;
function mockDb(role='king'){
 return {
  role,
  prepare(sql){
   let args=[];
   return {
    bind(...values){args=values;return this},
    async first(){
     if(sql.includes('FROM sessions s JOIN users'))return {id:'king-1',role,username:role==='king'?'king':'user'};
     if(sql.startsWith('SELECT COUNT(*) n FROM saliyah_sim_citizens'))return {n:citizens.length};
     if(sql.startsWith('SELECT COUNT(*) n FROM x_profiles'))return {n:1};
     return {n:0};
    },
    async all(){
     if(sql.startsWith('WITH targets(id)')){resolutionQueries++;return {results:args.map(id=>({id,resolved_name:names.get(id)||null}))}}
     if(sql.startsWith('SELECT * FROM saliyah_sim_companies'))return {results:companies};
     if(sql.startsWith('SELECT * FROM saliyah_sim_job_applications'))return {results:[{id:'application-1',citizen_id:'sim-resident-0763',status:'approved'}]};
     if(sql.startsWith('SELECT c.id,c.name,c.occupation,c.created_at FROM saliyah_sim_citizens'))return {results:citizens};
     if(sql.startsWith('SELECT c.id,c.display_name name,c.handle,c.bio,c.created_at FROM x_profiles'))return {results:[{id:'bot-x-1',name:'سارة الصالية',handle:'sara'}]};
     return {results:[]};
    }
   };
  }
 };
}
const cookie='saliyah_session=12345678-1234-1234-1234-123456789abc';
async function get(db,path){
 const res=await worker.fetch(new Request('https://saliyah.test'+path,{headers:{cookie}}),{DB:db,AVIATION_DB:db,ASSETS:{fetch:async()=>new Response('ok')}});
 return {status:res.status,body:await res.json()};
}
const db=mockDb();
let result=await get(db,'/api/admin/bot-directory?type=citizens');
assert.equal(result.status,200);
assert.equal(result.body.pagination.total,citizens.length);
assert.equal(result.body.rows[0].name,citizens[0].name);
result=await get(db,'/api/admin/bot-directory?type=x');
assert.equal(result.status,200);
assert.equal(result.body.rows[0].name,'سارة الصالية');
result=await get(db,'/api/admin/bot-directory?type=invalid');
assert.equal(result.status,400);
result=await get(db,'/api/admin/service-bots?service=commerce&group=0');
assert.equal(result.status,200);
assert.equal(result.body.rows[0].founder_id_name,citizens[0].name);
assert.ok(resolutionQueries>0);
const before=resolutionQueries;
result=await get(db,'/api/admin/royal-audit');
assert.equal(result.status,200);
assert.equal(result.body.groups.find(x=>x.type==='saliyah_sim_job_applications').rows[0].citizen_id_name,citizens[0].name);
assert.equal(resolutionQueries-before,1,'Royal audit should batch bot name resolution instead of querying separately per group');
result=await get(mockDb('citizen'),'/api/admin/bot-directory');
assert.equal(result.status,403);
console.log('PASS royal bot name directory, staff/merchant report name resolution, audit batching and king-only authorization.');
