import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync('public/airport.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'airport needs an inline script');
new Script(match[1],{filename:'public/airport.html:inline'});
for(const route of ['/api/aviation/readiness','/api/aviation/flights']){
 assert.ok(html.includes(route),'airport page missing '+route);
}
for(const action of ['aviationPost(\'booking\'','aviationPost(\'check-in\'','aviationPost(\'admin/flight\'']){
 assert.ok(html.includes(action),'airport page missing '+action);
}
const worker=readFileSync('src/worker.js','utf8');
assert.ok(worker.includes('LIVE_AIRPORT_HTML_SOURCE'),'deployed script must expose current airport UI');
assert.ok(worker.includes('LIVE_PORTAL_APP_SOURCE'),'deployed script must expose current HR UI');
assert.ok(worker.includes('ensureAviationRollingSchedule'),'rolling schedules must persist');
assert.ok(worker.includes("booking_operations_ready:bookingOperationsReady"),'booking gates must be enabled by explicit validation');
console.log('Aviation HTML and deployment UI smoke checks passed');
