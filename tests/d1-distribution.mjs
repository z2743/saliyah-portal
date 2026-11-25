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
assert.match(worker,/console\.log\('simulation_paused_by_royal_order'\)/);
console.log('D1 distribution regression checks passed');
