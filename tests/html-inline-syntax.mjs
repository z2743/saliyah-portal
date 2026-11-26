// Parse every browser inline script; Node --check alone skips JavaScript inside HTML.
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const names=['public/index.html','public/airport.html','public/simulation.html'];
let verified=0;
for(const name of names){
 const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
 const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
 for(const match of html.matchAll(re)){
  if(/\bsrc\s*=/.test(match[1])||!match[2].trim())continue;
  new Script(match[2],{filename:name});verified++;
 }
}
if(verified<2)throw Error('Expected to check airport and simulation JavaScript');
console.log(`PASS syntax of ${verified} HTML inline scripts across ${names.length} pages`);
