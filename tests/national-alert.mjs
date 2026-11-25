import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fresh=()=>[
 {id:'alert-active',title:'تنبيه نشط',body:'نص',severity:'warning',target:'all',expires_at:Date.now()+3600000,updated_at:Date.now()-60000,cancelled:0},
 {id:'alert-expired',title:'تنبيه منتهي',body:'نص',severity:'info',target:'all',expires_at:Date.now()-3600000,updated_at:Date.now()-7200000,cancelled:0}
];
function mockDb(initial=[],role='king'){
 const records=initial.map(x=>({...x})),events=[];
 const db={records,events,role,
  prepare(sql){
   let args=[];
   return {bind(...v){args=v;return this},
    async first(){
     if(sql.includes('FROM sessions s JOIN users'))return {id:'king123',username:'king',role:db.role};
     return null;
    },
    async all(){
     if(sql.includes('FROM national_alert_history')){
      const history=!sql.includes('cancelled=0');
      return {results:records.filter(x=>history||(!x.cancelled&&x.expires_at>args[0])).sort((a,b)=>b.updated_at-a.updated_at).map(x=>({...x}))};
     }
     return {results:[]};
    },
    async run(){
     let changes=0;
     if(sql.startsWith('DELETE FROM national_alert_history')){
      const i=records.findIndex(x=>x.id===args[0]);if(i>=0){records.splice(i,1);changes=1}
     }else if(sql.startsWith('UPDATE national_alert_history SET cancelled=1')){
      const x=records.find(x=>x.id===args[1]&&!x.cancelled);if(x){x.cancelled=1;x.updated_at=args[0];changes=1}
     }else if(sql.startsWith('UPDATE national_alert_history SET title=')){
      const x=records.find(x=>x.id===args[6]&&!x.cancelled);
      if(x){Object.assign(x,{title:args[0],body:args[1],severity:args[2],target:args[3],expires_at:args[4],updated_at:args[5]});changes=1}
     }else if(sql.startsWith('INSERT INTO national_alert_history(')){
      records.push({id:args[0],title:args[1],body:args[2],severity:args[3],target:args[4],expires_at:args[5],updated_at:args[6],cancelled:0});changes=1;
     }else if(sql.startsWith('INSERT INTO audit_log')){
      events.push({action:args[2],id:args[4]});changes=1;
     }
     return {meta:{changes}};
    }
   };
  }
 };
 return db;
}
const cookie='saliyah_session=12345678-1234-1234-1234-123456789abc';
async function request(env,method='GET',path='/api/national-alert',body=null,options={}){
 const headers={cookie,...options.headers};
 if(body!==null)headers['content-type']='application/json';
 const response=await worker.fetch(new Request('https://portal.example'+path,{method,headers,body:body===null?undefined:JSON.stringify(body)}),env);
 return {status:response.status,data:await response.json()};
}
const primary=mockDb(fresh()),archive=mockDb(fresh());
const env={DB:primary,ARCHIVE_DB:archive,ASSETS:{fetch:async()=>new Response('ok')}};
let r=await request(env);assert.equal(r.status,200);assert.deepEqual(r.data.alerts.map(a=>a.id),['alert-active']);
r=await request(env,'GET','/api/national-alert?history=1');assert.equal(r.status,200);assert.equal(r.data.alerts.length,2);
r=await request(env,'POST','/api/national-alert',{action:'cancel',id:'alert-expired'});assert.equal(r.status,200);assert.equal(archive.records.find(x=>x.id==='alert-expired').cancelled,1);assert.equal(primary.records.find(x=>x.id==='alert-expired').cancelled,1);
r=await request(env,'POST','/api/national-alert',{action:'delete',id:'alert-active'});assert.equal(r.status,200);assert.equal(archive.records.some(x=>x.id==='alert-active'),false);assert.equal(primary.records.some(x=>x.id==='alert-active'),false);assert.ok(primary.events.some(x=>x.action==='national_alert_delete'));
r=await request(env,'GET','/api/national-alert');assert.equal(r.status,200);assert.equal(r.data.alerts.length,0);
r=await request(env,'POST','/api/national-alert',{action:'delete',id:'alert-expired'});assert.equal(r.status,200);assert.equal(archive.records.length,0);
r=await request(env,'POST','/api/national-alert',{action:'delete',id:'alert-expired'});assert.equal(r.status,404);
r=await request(env,'POST','/api/national-alert',{action:'delete'});assert.equal(r.status,400);
r=await request(env,'POST','/api/national-alert',{action:'delete',id:'alert-expired'},{headers:{origin:'https://attacker.example'}});assert.equal(r.status,403);
primary.role='citizen';
r=await request(env,'POST','/api/national-alert',{action:'delete',id:'alert-expired'});assert.equal(r.status,403);
r=await request(env,'GET','/api/national-alert?history=1');assert.equal(r.status,403);
console.log('PASS 11 national alert API tests: active/history, cancel expired, hard delete, mirror sync, audit, permissions, validation and CSRF.');
