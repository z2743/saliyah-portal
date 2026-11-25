import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const sim=readFileSync(new URL('../public/simulation.html',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const script=sim.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'observatory inline script exists');
new vm.Script(script,{filename:'simulation.html'});
for(const [name,source] of [['app',app],['simulation',sim]]){
 assert.doesNotMatch(source,/\bconfirm\(/,name+' must use supported inline confirmation dialog');
 assert.doesNotMatch(source,/\bprompt\(/,name+' must not use native prompt dialogs');
 assert.doesNotMatch(source,/\balert\(/,name+' must not use blocking alert dialogs');
 assert.match(source,/uiConfirm/);
 assert.match(source,/uiPrompt/);
 assert.match(source,/uiNotice/);
}
assert.match(app,/app\.onclick=null;app\.onsubmit=null;app\.innerHTML/,'Clear stale delegated action handlers on navigation');
assert.match(app,/else if\(part==='my-properties'\)await myPropertiesPage\(\)/);
assert.match(app,/api\('\/sim-market\/my-properties'\)/);
assert.match(app,/Promise\.allSettled\(\[api\('\/sim-market'/,'Show property UI independently of stock-service availability');
assert.match(app,/location\.hash='#\/my-properties'/,'successful purchase opens title certificate');
assert.match(worker,/if\(method==='GET'&&path==='\/api\/sim-market\/my-properties'\)/);
assert.match(worker,/p\.owner_id=\?/,'My property certificate must filter by authenticated owner');
assert.match(worker,/saliyah_sim_bot_property_purchases/);
assert.doesNotMatch(worker,/UPDATE saliyah_sim_properties SET owner_id=\?,status='owned',sold_at=CURRENT_TIMESTAMP WHERE id=\? AND status='listed'/,'No unfunded legacy bot transfer');
console.log('PASS inline portal and observatory controls, owned property certificate, independent housing market and funded bot purchases');
