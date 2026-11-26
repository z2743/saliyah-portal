// End-to-end Worker routing with mocked D1: deletion never grants cross-owner access.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../src/worker.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const productId='408fcb26-2203-4875-8d71-01fa31406fbe';
const envFor=(account)=>{
 const record={deleted:false,audits:[]};
 const DB={prepare(sql){
  let args=[];
  return {
   bind(...a){args=a;return this},
   async first(){
    if(sql.includes('FROM sessions s JOIN users'))return {id:account.id,username:account.id,role:account.role};
    if(sql.includes('FROM company_catalog p JOIN commerce_companies c')&&sql.includes('p.deleted_at IS NULL')){
     if(record.deleted||args[0]!==productId||account.id!=='owner'&&account.role!=='king')return null;
     return {id:productId,company_id:'company1',title:'Demo product',owner_id:'owner'};
    }
    return null;
   },
   async run(){
    if(sql.includes('UPDATE company_catalog SET active=0,deleted_at=')){
     if(record.deleted)return {meta:{changes:0}};
     record.deleted=true;return {meta:{changes:1}};
    }
    if(sql.includes('INSERT INTO audit'))record.audits.push(args);
    return {meta:{changes:1}};
   },
   async all(){return {results:[]}},
  }
 }};
 return {env:{DB,ASSETS:{fetch:async()=>new Response('asset')}},record};
};
async function hit(env,body){
 const resp=await worker.fetch(new Request('https://portal.example/api/company/operations/item/delete',{
  method:'POST',
  headers:{cookie:'saliyah_session=12345678-1234-1234-1234-123456789abc','content-type':'application/json'},
  body:JSON.stringify(body)
 }),env);
 return {status:resp.status,json:await resp.json()};
}
{
 const {env,record}=envFor({id:'owner',role:'citizen'});
 const success=await hit(env,{id:productId});assert.equal(success.status,200);assert.equal(success.json.deleted,true);
 assert.equal(record.deleted,true);
 const duplicate=await hit(env,{id:productId});assert.equal(duplicate.status,404);
}
{
 const {env,record}=envFor({id:'outsider',role:'citizen'});
 const blocked=await hit(env,{id:productId});assert.equal(blocked.status,404);assert.equal(record.deleted,false);
}
{
 const {env,record}=envFor({id:'king',role:'king'});
 const noReason=await hit(env,{id:productId});assert.equal(noReason.status,400);assert.equal(record.deleted,false);
 const royal=await hit(env,{id:productId,reason:'مخالفة شروط السوق'});assert.equal(royal.status,200);assert.equal(record.deleted,true);
}
console.log('PASS catalog owner deletion, cross-owner denial, royal reason and repeat protection (mock D1)');
