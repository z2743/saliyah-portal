import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFileSync(join(root,p),'utf8');
const failures=[];let passed=0;
function check(label,ok,detail=''){if(ok){passed++;console.log('PASS',label)}else{failures.push(label);console.error('FAIL',label,detail)}}
const cfg=read('wrangler.toml'),pkg=JSON.parse(read('package.json'));
check('Cloudflare Worker entry exists',/main\s*=\s*"src\/worker\.js"/.test(cfg)&&existsSync(join(root,'src/worker.js')));
check('Static assets configured',/directory\s*=\s*"\.\/public"/.test(cfg)&&existsSync(join(root,'public/index.html')));
check('D1 binding configured',/binding\s*=\s*"DB"/.test(cfg)&&/migrations_dir\s*=\s*"migrations"/.test(cfg));
check('D1 court files migration exists',existsSync(join(root,'migrations/0042_court_files_d1.sql')));
check('Database ID replaced',/database_id\s*=\s*"(?!REPLACE_WITH_YOUR_D1_DATABASE_ID)[0-9a-f-]{36}"/.test(cfg),'Set your actual D1 database_id in wrangler.toml');
check('No setup secret committed to config',!/SETUP_SECRET\s*=/.test(cfg),'Use wrangler secret put SETUP_SECRET');
const migrations=readdirSync(join(root,'migrations')).filter(x=>x.endsWith('.sql')).sort();
check('Migrations present',migrations.length>=34);
// D1 identifies migrations by full filename, not their numeric prefix.
check('Migration filenames are unique',new Set(migrations).size===migrations.length);
check('Migration filenames use numeric prefixes',migrations.every(x=>/^\\d{4}_[a-z0-9_]+\\.sql$/.test(x)));
check('Release test command configured',typeof pkg.scripts?.test==='string'&&pkg.scripts.test.includes('integration.py'));
check('Site assets exist',['index.html','app.js','style.css'].every(x=>existsSync(join(root,'public',x))));
check('Health and readiness endpoints exist',read('src/worker.js').includes('/api/admin/readiness')&&read('src/worker.js').includes('/api/health/'));
console.log(`\nPreflight: ${passed} passed, ${failures.length} failed`);
if(failures.length){console.error('Deployment is blocked until failures are fixed.');process.exitCode=1}else console.log('Static checks passed. Live Cloudflare verification is still required.');
