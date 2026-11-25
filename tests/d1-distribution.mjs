import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const worker=read('src/worker.js');
const config=read('wrangler.toml');

for(const binding of ['DB','FINANCE_DB','SIMULATION_DB','AVIATION_DB','ARCHIVE_DB']){
 assert.match(config,new RegExp('binding\\s*=\\s*"'+binding+'"'));
 assert.match(worker,new RegExp("\\['"+binding+"'"));
}
assert.match(worker,/path==='\/api\/admin\/d1-distribution'/);
assert.match(worker,/user\?\.role!=='king'/);
assert.match(worker,/primary_write_binding:'DB'/);
assert.match(worker,/matching_record_counts:ledgerMatches/);
assert.match(worker,/const alertDb=env\.ARCHIVE_DB\|\|db/);
assert.match(worker,/await \(env\.SIMULATION_DB\|\|db\)\.prepare\("INSERT INTO saliyah_sim_settings\(key,value\) VALUES\('last_manual_run',\?\)/);
assert.match(worker,/\(\)=>runSaliyahGovernment\(env\.DB,env\.AVIATION_DB\)/);
assert.match(worker,/\(\)=>runSimContactReplies\(env\.DB,env\.AVIATION_DB\)/);
assert.doesNotMatch(worker,/simulation_paused_by_royal_order/);
assert.match(worker,/const botRequests=await sharedRows\(db/);
assert.match(worker,/institutionNames=new Map\(\)/);
assert.doesNotMatch(worker,/shared_service_applications a JOIN saliyah_sim_institutions i ON i.id=a.target_id/);
assert.match(worker,/const totals=await db\.prepare\("SELECT owner_type,COUNT\(\*\) accounts,SUM\(balance\)/);
for(const key of ['telecom','pos','absher','health','municipality','installments'])assert.match(worker,new RegExp('"'+key+'":\\[\\['));
assert.match(worker,/matching_total_balances:ledgerBalancesMatch/);
assert.match(worker,/const botRequests=await sharedRows\(db/);
assert.match(worker,/const recordDb=\['saliyah_sim_institutions','saliyah_sim_education_details'\]/);
assert.match(worker,/saliyah_sim_bank_transactions'\?'SELECT \* FROM saliyah_sim_bank_transactions/);
const royalPage=read('public/simulation.html');
assert.match(royalPage,/load\('d1'\)/);
assert.match(royalPage,/load\('records'\)/);
assert.match(royalPage,/api\('\/admin\/service-bots\?/);
assert.match(worker,/path==='\/api\/admin\/royal-audit'/);
assert.match(worker,/path==='\/api\/admin\/d1-inventory'/);
assert.match(worker,/const royalActualServiceRecords=/);
assert.match(worker,/safeRows=data\.results\.map/);
assert.match(worker,/matching_total_balances:ledgerBalancesMatch/);
const observatory=read('public/simulation.html');
assert.match(observatory,/load\('audit'\)/);
assert.match(observatory,/load\('d1'\)/);
assert.match(observatory,/load\('records'\)/);
console.log('D1 distribution regression checks passed');
