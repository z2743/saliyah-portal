async function sharedRows(db,sql,args=[]){try{return (await db.prepare(sql).bind(...args).all()).results}catch(e){if(String(e).includes('no such table'))return [];throw e}}

const educationStages=['primary','middle','secondary','university'];
const educationStageNames={primary:'ابتدائي',middle:'متوسط',secondary:'ثانوي',university:'جامعة'};
const educationTuition={primary:18000,middle:22000,secondary:26000,university:30000};
const educationRating=grade=>grade>=90?'ممتاز':grade>=85?'جيد جداً':grade>=80?'جيد':grade>=70?'مقبول':'لم يجتز';
async function syncEducationCatalog(db,simulationDb){
 const sql="SELECT i.id,i.name,i.kind,COALESCE(d.level,'all') level,COALESCE(d.sector,'public') sector,COALESCE(d.capacity,200) capacity,COALESCE(d.tuition,0) tuition FROM saliyah_sim_institutions i LEFT JOIN saliyah_sim_education_details d ON d.institution_id=i.id WHERE i.status='open' LIMIT 300";
 const own=await sharedRows(db,sql);
 const other=simulationDb&&simulationDb!==db?await sharedRows(simulationDb,sql):[];
 const found=new Map([...other,...own].map(x=>[x.id,x]));
 if(!found.size)return;
 const king=await db.prepare("SELECT id FROM users WHERE role='king' LIMIT 1").first();
 if(!king)return;
 const old=await db.prepare("SELECT id FROM education_institutions WHERE id LIKE 'sim-%'").all();
 const existing=new Set(old.results.map(x=>x.id));
 const inserts=[];
 for(const item of found.values()){
  const levels=item.kind==='university'?['university']:educationStages.slice(0,3).filter(x=>item.level==='all'||x===item.level);
  for(const level of levels){
   const id=item.level==='all'||item.kind==='university'?item.id+'--'+level:item.id;
   if(existing.has(id))continue;
   const privateSchool=item.sector==='private';
   const fee=privateSchool?Math.max(educationTuition[level],Number(item.tuition)||0):0;
   const minGrade=privateSchool?(level==='university'?85:80):70;
   const name=item.name+' — '+educationStageNames[level];
   inserts.push(db.prepare("INSERT OR IGNORE INTO education_institutions(id,name,level,sector,capacity,min_grade,fee,created_by) VALUES(?,?,?,?,?,?,?,?)").bind(id,name,level,privateSchool?'private':'public',Math.max(1,Number(item.capacity)||200),minGrade,fee,king.id));
  }
 }
 for(let i=0;i<inserts.length;i+=30)await db.batch(inserts.slice(i,i+30));
}


// Virtual IBANs are reversible aliases for existing UUID accounts; no database scans or backfill.
function saliyahIban(id){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return id;const part=BigInt('0x'+id.replace(/-/g,'')).toString(36).toUpperCase().padStart(25,'0');const digits=(part+'SL00').replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));return 'SL'+String(98n-BigInt(digits)%97n).padStart(2,'0')+part}
function saliyahAccountId(value){const s=String(value||'').replace(/\s/g,'').toUpperCase();if(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(s))return s.toLowerCase();if(!/^SL[0-9]{2}[0-9A-Z]{25}$/.test(s))return null;let n=0n;for(const c of s.slice(4))n=n*36n+BigInt(parseInt(c,36));const h=n.toString(16).padStart(32,'0');if(h.length!==32)return null;const id=h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);return saliyahIban(id)===s?id:null}
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const enc=new TextEncoder();
const hex=buf=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>crypto.randomUUID();
const hash=async v=>hex(await crypto.subtle.digest('SHA-256',enc.encode(v)));
async function derive(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
async function input(req){try{const body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body))throw 0;return body}catch{return null}}
function validText(v,min,max){return typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max}
async function actor(req,db){const cookie=req.headers.get('cookie')||'';const token=cookie.match(/(?:^|;\s*)saliyah_session=([a-f0-9-]+)/)?.[1];if(!token)return null;const t=await hash(token);return db.prepare("SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')").bind(t).first()}
const secureCookie=(req)=>new URL(req.url).protocol==='https:'?'; Secure':'';
const cookie=(req,t,max)=>`saliyah_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${max}${secureCookie(req)}`;
async function audit(db,who,action,entity,id,details){await db.prepare('INSERT INTO audit_log (id,actor_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?)').bind(random(),who,action,entity,id,JSON.stringify(details||{})).run()}
const ministries=[['الخارجية','كسلان بن زياد بن بندر العمري'],['الداخلية','قندس بن زياد بن بندر العمري'],['الدفاع','جدو بن جدون الجدي البطريقي'],['العدل','جدو بن جدون الجدي البطريقي'],['الطوارئ وإدارة الكوارث','جدو بن جدون الجدي البطريقي'],['الإعلام','جدو بن جدون الجدي البطريقي'],['شؤون المحافظات','جدو بن جدون الجدي البطريقي'],['المالية','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الطاقة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['التجارة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الصناعة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الاستثمار','جدو بن جدون الجدي البطريقي'],['التخطيط والتنمية','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الثروة المعدنية','كوب بن زياد بن بندر العمري'],['الطاقة النووية','خرفون بن خروف الخرفي الخرفاني'],['الصحة','خرفون بن خروف الخرفي الخرفاني'],['التعليم','كوب بن زياد بن بندر العمري'],['الإسكان','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الثقافة','جدو بن جدون الجدي البطريقي'],['السياحة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الرياضة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الموارد البشرية والتنمية الاجتماعية','خرفون بن خروف الخرفي الخرفاني'],['الأوقاف والشؤون الدينية','جدو بن جدون الجدي البطريقي'],['الشباب','خرفون بن خروف الخرفي الخرفاني'],['شؤون المستهلك','كوب بن زياد بن بندر العمري'],['الآثار والتراث','جدو بن جدون الجدي البطريقي'],['النقل والخدمات اللوجستية','خرفون بن خروف الخرفي الخرفاني'],['النقل البحري والموانئ','خرفون بن خروف الخرفي الخرفاني'],['الاتصالات وتقنية المعلومات','خرفون بن خروف الخرفي الخرفاني'],['اتصالات الفضاء','خرفون بن خروف الخرفي الخرفاني'],['البيئة والمياه والزراعة','أبو شخطه بن شخطون الشخطي الشيخطاني'],['الشؤون البلدية والقروية','خرفون بن خروف الخرفي الخرفاني'],['الأمن الغذائي','خرفون بن خروف الخرفي الخرفاني'],['الثروة الحيوانية والسمكية','كوب بن زياد بن بندر العمري'],['الإحصاء والتعداد','خرفون بن خروف الخرفي الخرفاني']].map(([name,minister],id)=>({id,name:'وزارة '+name,minister}));
// AI minister simulation: non-sovereign planning only. Major projects await a human decision.
const fictionalFirstNames=['محمد','عبدالله','خالد','فهد','نواف','راكان','تركي','سلمان','عمر','يوسف','ماجد','بدر','سلطان','فيصل','أحمد','سعود','ناصر','إبراهيم','عبدالعزيز','زياد'];
const fictionalFamilyNames=['العتيبي','القحطاني','الشمري','العنزي','الحربي','الدوسري','المطيري','الغامدي','الزهراني','المالكي','العمري','الشهري','السبيعي','التميمي','الجهني','الرشيدي','السلمي','العجمي','القرني','الهاجري'];
const fictionalBotName=n=>fictionalFirstNames[(n*7+3)%fictionalFirstNames.length]+' '+fictionalFamilyNames[(n*11+5)%fictionalFamilyNames.length];
// Ministers are fictional bot personas with human-style names; the automated flag stays visible.
const botMinisters=ministries.filter(m=>m.id!==0&&m.id!==1).map(m=>({...m,minister:fictionalBotName(m.id)+' بن '+fictionalFirstNames[(m.id*3+1)%fictionalFirstNames.length]+' 🤖',automated:true}));
// Simulated replies are intentionally labeled as automation; they never impersonate real residents.
async function runSimContactReplies(db,aviationDb=null){
 const pending=(await db.prepare("SELECT id,target_type,target_id,message FROM saliyah_sim_public_contacts WHERE status='pending_bot' ORDER BY created_at LIMIT 16").all()).results;
 if(!pending.length)return 0;
 const targetQueries={
  citizens:'SELECT name FROM saliyah_sim_citizens WHERE id=?',
  companies:'SELECT name FROM saliyah_sim_companies WHERE id=?',
  institutions:'SELECT name FROM saliyah_sim_institutions WHERE id=?',
  jobs:'SELECT title name FROM saliyah_sim_jobs WHERE id=?',
  x:"SELECT display_name name FROM x_profiles WHERE id=? AND kind='bot'",
  lawyers:'SELECT name FROM saliyah_sim_legal_bots WHERE id=?',
  properties:"SELECT kind||' في '||location name FROM saliyah_sim_properties WHERE id=?",
  tourists:"SELECT name FROM saliyah_sim_tourists WHERE id=?",
  projects:"SELECT title name FROM saliyah_projects WHERE id=? AND proposed_by='bot'",
  banking:"SELECT account_number name FROM saliyah_sim_bank_accounts WHERE id=?",
  shares:"SELECT c.name FROM saliyah_sim_shares h JOIN saliyah_sim_companies c ON c.id=h.company_id WHERE h.id=?"
 };
 const replies=[];
 for(const message of pending){
  const sql=targetQueries[message.target_type];if(!sql)continue;
  const target=await (message.target_type==='tourists'?(aviationDb||db):db).prepare(sql).bind(message.target_id).first();
  const name=target?.name||'جهة افتراضية';
  const original=String(message.message||'');
  let guidance='اطّلع على ملفي وخدماتي في دليل سكان ومنشآت الصالية.';
  if(/وظيف|توظيف|راتب|عمل/.test(original))guidance='الوظائف والتقديم عليها موجودة في خدمة التوظيف في البوابة.';
  else if(/مدرس|جامع|تعليم|تسجيل|دراس/.test(original))guidance='معلومات المدارس والجامعات والتقديم موجودة في خدمة التعليم.';
  else if(/سهم|أسهم|تداول|استثمار/.test(original))guidance='تستطيع الاطلاع على الأسهم والصفقات من سوق الأسهم الصالي الافتراضي.';
  else if(/عقار|شراء|إيجار|أرض/.test(original))guidance='العقارات المعروضة والتملك موجودان في سوق العقارات الافتراضي.';
  else if(/بنك|تحويل|حساب/.test(original))guidance='أرقام الحسابات الافتراضية الظاهرة في الدليل تقبل التحويلات الداخلية المسموح بها.';
  const reply='🤖 رد آلي من '+name+': وصلت رسالتك في المملكة الصالية. '+guidance;
  replies.push(db.prepare("UPDATE saliyah_sim_public_contacts SET status='replied',bot_reply=?,replied_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_bot'").bind(reply,message.id));
 }
 if(replies.length)await db.batch(replies);
 return replies.length;
}
async function runSaliyahGovernment(db,aviationDb){
 const hour=Math.floor(Date.now()/3600000);
 const roles=['موظف خدمة عملاء','موظف أحوال مدنية','معلم','ممرض','محاسب','موظف اتصالات','موظف بلدية','موظف بريد','فني صيانة','موظف نقل'];
 // One-time bootstrap: avoid scanning and rewriting all 3,000 fictional profiles on every simulation cycle.
 const populationBootstrapped=await db.prepare("SELECT 1 FROM saliyah_sim_settings WHERE key='population_bootstrap_v2'").first();
 if(!populationBootstrapped){
 // Fictional employed citizens are separate from real staff and cannot gain permissions.
 await db.prepare("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000) INSERT OR IGNORE INTO saliyah_sim_citizens(id,name,occupation) SELECT 'sim-employee-'||printf('%04d',n),'موظف صالي افتراضي '||n,CASE n%10 WHEN 0 THEN 'موظف خدمة عملاء' WHEN 1 THEN 'موظف أحوال مدنية' WHEN 2 THEN 'معلم' WHEN 3 THEN 'ممرض' WHEN 4 THEN 'محاسب' WHEN 5 THEN 'موظف اتصالات' WHEN 6 THEN 'موظف بلدية' WHEN 7 THEN 'موظف بريد' WHEN 8 THEN 'فني صيانة' ELSE 'موظف نقل' END FROM seq").run();
 // 2,000 additional fictional residents with independent lives and no access to real user accounts.
 await db.prepare("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000) INSERT OR IGNORE INTO saliyah_sim_citizens(id,name,occupation) SELECT 'sim-resident-'||printf('%04d',n),'مواطن صالي افتراضي '||n,CASE n%6 WHEN 0 THEN 'طالب' WHEN 1 THEN 'باحث عن عمل' WHEN 2 THEN 'تاجر' WHEN 3 THEN 'معلم' WHEN 4 THEN 'موظف' ELSE 'صاحب مشروع' END FROM seq").run();
 // Assign stable, human-style fictional names to all simulated employees and residents.
 await db.prepare("UPDATE saliyah_sim_citizens SET name=(CASE CAST(substr(id,-4) AS INTEGER)%20 WHEN 0 THEN 'محمد' WHEN 1 THEN 'عبدالله' WHEN 2 THEN 'نواف' WHEN 3 THEN 'خالد' WHEN 4 THEN 'فهد' WHEN 5 THEN 'سعود' WHEN 6 THEN 'راشد' WHEN 7 THEN 'تركي' WHEN 8 THEN 'عبدالعزيز' WHEN 9 THEN 'بندر' WHEN 10 THEN 'سلطان' WHEN 11 THEN 'فيصل' WHEN 12 THEN 'ماجد' WHEN 13 THEN 'يوسف' WHEN 14 THEN 'إبراهيم' WHEN 15 THEN 'ناصر' WHEN 16 THEN 'أحمد' WHEN 17 THEN 'حمد' WHEN 18 THEN 'عمر' ELSE 'زياد' END)||' '||(CASE (CAST(substr(id,-4) AS INTEGER)/20 + CASE WHEN id LIKE 'sim-employee-%' THEN 7 ELSE 0 END)%20 WHEN 0 THEN 'العتيبي' WHEN 1 THEN 'القحطاني' WHEN 2 THEN 'الحربي' WHEN 3 THEN 'الدوسري' WHEN 4 THEN 'الشمري' WHEN 5 THEN 'المطيري' WHEN 6 THEN 'العنزي' WHEN 7 THEN 'الغامدي' WHEN 8 THEN 'الزهراني' WHEN 9 THEN 'السبيعي' WHEN 10 THEN 'الرشيدي' WHEN 11 THEN 'المالكي' WHEN 12 THEN 'الشهري' WHEN 13 THEN 'التميمي' WHEN 14 THEN 'العجمي' WHEN 15 THEN 'الجهني' WHEN 16 THEN 'القرني' WHEN 17 THEN 'الهاجري' WHEN 18 THEN 'السلمي' ELSE 'العمري' END) WHERE (id LIKE 'sim-employee-%' OR id LIKE 'sim-resident-%') AND (name LIKE 'موظف صالي افتراضي %' OR name LIKE 'مواطن صالي افتراضي %')").run();
 // Every simulated resident and employee receives a distinct Arabic full name; never expose technical IDs as names.
 await db.prepare("UPDATE saliyah_sim_citizens SET name=substr(name,1,instr(name,' ')-1)||' بن '||(CASE ((CAST(substr(id,-4) AS INTEGER)-1)/400 + CASE WHEN id LIKE 'sim-employee-%' THEN 5 ELSE 0 END) WHEN 0 THEN 'محمد' WHEN 1 THEN 'إبراهيم' WHEN 2 THEN 'صالح' WHEN 3 THEN 'عبدالرحمن' WHEN 4 THEN 'حمد' WHEN 5 THEN 'سعد' WHEN 6 THEN 'ناصر' ELSE 'خالد' END)||' '||substr(name,instr(name,' ')+1) WHERE (id LIKE 'sim-resident-%' OR id LIKE 'sim-employee-%') AND name NOT LIKE '% بن %'").run();
 // Explicit gender for fictional citizens; even-numbered resident IDs represent female citizens.
 try{await db.prepare("ALTER TABLE saliyah_sim_citizens ADD COLUMN gender TEXT").run()}catch(e){if(!String(e).includes('duplicate column name'))throw e}
 await db.prepare("UPDATE saliyah_sim_citizens SET gender=CASE WHEN CAST(substr(id,-4) AS INTEGER)%2=0 THEN 'female' ELSE 'male' END WHERE id LIKE 'sim-resident-%' AND gender IS NULL").run();
 await db.prepare("UPDATE saliyah_sim_citizens SET gender='male' WHERE id LIKE 'sim-employee-%' AND gender IS NULL").run();
 await db.prepare("UPDATE saliyah_sim_citizens SET name=(CASE CAST(substr(id,-4) AS INTEGER)%20 WHEN 0 THEN 'نورة' WHEN 2 THEN 'سارة' WHEN 4 THEN 'ريم' WHEN 6 THEN 'هيا' WHEN 8 THEN 'ليان' WHEN 10 THEN 'جود' WHEN 12 THEN 'لمى' WHEN 14 THEN 'شهد' WHEN 16 THEN 'غلا' ELSE 'دانة' END)||' بنت '||(CASE ((CAST(substr(id,-4) AS INTEGER)-1)/400) WHEN 0 THEN 'إبراهيم' WHEN 1 THEN 'صالح' WHEN 2 THEN 'عبدالرحمن' WHEN 3 THEN 'حمد' ELSE 'سعد' END)||' '||substr(name,instr(name,' ')+1) WHERE id LIKE 'sim-resident-%' AND gender='female' AND name NOT LIKE '% بنت %'").run();
 // Skip the broad legacy-name cleanup scan after one-time migration; only legacy rows can match.
 await db.prepare("UPDATE saliyah_sim_citizens SET name=replace(name,' بن محمد ',' ') WHERE gender='female' AND name LIKE '% بنت % بن محمد %'").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_settings(key,value) VALUES('population_bootstrap_v2','complete')").run();
 }
 // Separate virtual banking ledger: never connect simulated balances to real bank_accounts.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_bank_accounts(id TEXT PRIMARY KEY,owner_type TEXT NOT NULL CHECK(owner_type IN ('citizen','company')),owner_id TEXT NOT NULL,account_number TEXT NOT NULL UNIQUE,bank_name TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(owner_type,owner_id))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_bank_transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,description TEXT NOT NULL,related_account_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(account_id) REFERENCES saliyah_sim_bank_accounts(id))").run();
 if(!await db.prepare("SELECT 1 FROM saliyah_sim_bank_accounts WHERE id='sim-bank-c-sim-resident-2000'").first()){
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,bank_name,balance) SELECT 'sim-bank-c-'||id,'citizen',id,'SC'||printf('%012d',CAST(substr(id,-4) AS INTEGER)+CASE WHEN id LIKE 'sim-employee-%' THEN 300000 ELSE 100000 END),'البنك الصالي',CASE WHEN CAST(substr(id,-4) AS INTEGER)%11=0 THEN 0 ELSE 800+CAST(substr(id,-4) AS INTEGER)%12000 END FROM saliyah_sim_citizens WHERE id LIKE 'sim-resident-%' OR id LIKE 'sim-employee-%'").run();
 }
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,bank_name,balance) SELECT 'sim-bank-b-'||id,'company',id,'SB-'||id,'البنك الصالي للأعمال',MAX(0,capital) FROM saliyah_sim_companies WHERE status='approved'").run();
 // Each simulated company chooses weekly (1) or fortnightly (2) payroll.
 try{await db.prepare("ALTER TABLE saliyah_sim_companies ADD COLUMN payroll_weeks INTEGER NOT NULL DEFAULT 1").run()}catch(e){if(!String(e).includes('duplicate column name'))throw e}
 // The fictional founder acts as the company's automated director and selects its pay cycle.
 // A choice is reconsidered once every four weeks, not every scheduled run.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_company_payroll_decisions(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,founder_id TEXT NOT NULL,previous_weeks INTEGER NOT NULL,new_weeks INTEGER NOT NULL,reason TEXT NOT NULL,decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 const managementPeriod=Math.floor(Date.now()/2419200000);
 const companiesToManage=(await db.prepare("SELECT c.id,c.founder_id,c.payroll_weeks,c.capital,COUNT(j.id) staff_jobs FROM saliyah_sim_companies c LEFT JOIN saliyah_sim_jobs j ON j.company_id=c.id WHERE c.status='approved' AND c.founder_id IN (SELECT id FROM saliyah_sim_citizens) GROUP BY c.id ORDER BY c.id LIMIT 100 OFFSET ?").bind((hour%Math.max(1,Math.ceil(Number((await db.prepare("SELECT COUNT(*) n FROM saliyah_sim_companies WHERE status='approved' AND founder_id IN (SELECT id FROM saliyah_sim_citizens)").first()).n)/100)))*100).all()).results;
 for(const company of companiesToManage){
  const decisionId='sim-payroll-choice-'+managementPeriod+'-'+company.id;
  if(await db.prepare("SELECT 1 FROM saliyah_sim_company_payroll_decisions WHERE id=?").bind(decisionId).first())continue;
  const nextWeeks=(Number(company.capital)<10000||Number(company.staff_jobs)>3)?2:1;
  const previousWeeks=Number(company.payroll_weeks)===2?2:1;
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO saliyah_sim_company_payroll_decisions(id,company_id,founder_id,previous_weeks,new_weeks,reason) VALUES(?,?,?,?,?,?)").bind(decisionId,company.id,company.founder_id,previousWeeks,nextWeeks,nextWeeks===2?'قرار المدير الآلي لتخفيف ضغط السيولة':'قرار المدير الآلي للصرف الأسبوعي'),
   db.prepare("UPDATE saliyah_sim_companies SET payroll_weeks=? WHERE id=?").bind(nextWeeks,company.id)
  ]);
 }
 // Guard against overdrafts at the database layer. A rejected debit aborts
 // the entire D1 batch, so the matching credit cannot be recorded alone.
 await db.prepare("CREATE TRIGGER IF NOT EXISTS saliyah_sim_salary_funds_guard BEFORE INSERT ON saliyah_sim_bank_transactions WHEN NEW.kind='salary_debit' AND (NEW.amount>=0 OR NOT EXISTS(SELECT 1 FROM saliyah_sim_bank_accounts WHERE id=NEW.account_id AND balance>=-NEW.amount)) BEGIN SELECT RAISE(ABORT,'insufficient simulated salary funds'); END").run();
 // Weekly pay cycle starts on Monday, every second Monday for fortnightly companies.
 // D1 batch makes debit, credit and journal writes atomic; IDs prevent duplicates.
 const payrollWeek=(()=>{const d=new Date();const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)})();
 // Backfill up to eight completed weekly periods, including missed payroll runs.
 // Payment IDs remain deterministic per employee and period to avoid double payments.
 const payroll=(await db.prepare("SELECT j.id job_id,j.salary,j.company_id,c.payroll_weeks,a.citizen_id,a.created_at hired_at,co.id payer,ci.id payee FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id JOIN saliyah_sim_job_applications a ON a.job_id=j.id AND a.status='hired' JOIN saliyah_sim_bank_accounts co ON co.owner_type='company' AND co.owner_id=j.company_id JOIN saliyah_sim_bank_accounts ci ON ci.owner_type='citizen' AND ci.owner_id=a.citizen_id WHERE j.salary>0 AND c.status='approved' ORDER BY j.id,a.citizen_id LIMIT 500 OFFSET ?").bind((hour%Math.max(1,Math.ceil(Number((await db.prepare("SELECT COUNT(*) n FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id JOIN saliyah_sim_job_applications a ON a.job_id=j.id AND a.status='hired' JOIN saliyah_sim_bank_accounts co ON co.owner_type='company' AND co.owner_id=j.company_id JOIN saliyah_sim_bank_accounts ci ON ci.owner_type='citizen' AND ci.owner_id=a.citizen_id WHERE j.salary>0 AND c.status='approved'").first()).n)/500)))*500).all()).results;
 for(const job of payroll){
  const weeks=Number(job.payroll_weeks)===2?2:1;
  const amount=Math.floor(Number(job.salary)||0)*weeks;
  if(!Number.isSafeInteger(amount)||amount<=0)continue;
  for(let offset=8;offset>=1;offset--){
   const date=new Date(payrollWeek+'T00:00:00Z');
   date.setUTCDate(date.getUTCDate()-offset*7);
   const period=date.toISOString().slice(0,10);
   const weekIndex=Math.floor(date.getTime()/604800000);
   if(weeks===2&&weekIndex%2!==0)continue;
   const hired=Date.parse(job.hired_at);
   if(Number.isFinite(hired)&&hired>date.getTime())continue;
   const transferId='salary-week-'+period+'-'+job.job_id;
   if(await db.prepare("SELECT 1 FROM saliyah_sim_bank_transactions WHERE id=?").bind(transferId+'-in').first())continue;
   try{
    await db.batch([
     db.prepare("INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id) SELECT ?,?,'salary_debit',?,?,? WHERE EXISTS(SELECT 1 FROM saliyah_sim_bank_accounts WHERE id=? AND balance>=?)").bind(transferId+'-out',job.payer,-amount,'راتب افتراضي '+period,job.payee,job.payer,amount),
     db.prepare("UPDATE saliyah_sim_bank_accounts SET balance=balance-? WHERE id=? AND balance>=?").bind(amount,job.payer,amount),
     db.prepare("UPDATE saliyah_sim_bank_accounts SET balance=balance+? WHERE id=? AND EXISTS(SELECT 1 FROM saliyah_sim_bank_transactions WHERE id=?)").bind(amount,job.payee,transferId+'-out'),
     db.prepare("INSERT INTO saliyah_sim_bank_transactions(id,account_id,kind,amount,description,related_account_id) SELECT ?,?,'salary_credit',?,?,? WHERE EXISTS(SELECT 1 FROM saliyah_sim_bank_transactions WHERE id=?)").bind(transferId+'-in',job.payee,amount,'راتب افتراضي '+period,job.payer,transferId+'-out')
    ]);
   }catch(e){console.error('simulated_payroll_failed',transferId,String(e));break;}
  }
 }
 // Automatic labor claims only for a completed, unpaid period after employment.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_labor_cases(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,company_id TEXT NOT NULL,citizen_id TEXT NOT NULL,period_start TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','under_review','resolved','rejected')),filed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,resolved_at TEXT,UNIQUE(job_id,citizen_id,period_start))").run();
 const dueWeek=(()=>{const d=new Date(payrollWeek+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-7);return d.toISOString().slice(0,10)})();
 const dueIndex=Math.floor(Date.parse(dueWeek+'T00:00:00Z')/604800000);
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_cases(id,job_id,company_id,citizen_id,period_start,amount,reason) SELECT 'labor-'||?||'-'||j.id||'-'||a.citizen_id,j.id,j.company_id,a.citizen_id,?,j.salary*CASE WHEN c.payroll_weeks=2 THEN 2 ELSE 1 END,'عدم استلام الراتب المستحق' FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id JOIN saliyah_sim_job_applications a ON a.job_id=j.id AND a.status='hired' WHERE c.status='approved' AND j.salary>0 AND date(a.created_at)<=date(?) AND (c.payroll_weeks=1 OR ?%2=0) AND NOT EXISTS(SELECT 1 FROM saliyah_sim_bank_transactions t WHERE t.id='salary-week-'||?||'-'||j.id||'-in')").bind(dueWeek,dueWeek,dueWeek,dueIndex,dueWeek).run();
 // Virtual legal profession: counsel for both sides and a separate court clerk.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_legal_bots(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('lawyer','court_clerk')),active INTEGER NOT NULL DEFAULT 1)").run();
 await db.prepare("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<40) INSERT OR IGNORE INTO saliyah_sim_legal_bots(id,name,role) SELECT 'sim-lawyer-'||printf('%03d',n),'المحامي الصالي الآلي '||n,'lawyer' FROM seq").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_legal_bots(id,name,role) VALUES('sim-court-clerk-001','كاتب المحكمة الآلي','court_clerk')").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_labor_representation(case_id TEXT NOT NULL,side TEXT NOT NULL CHECK(side IN ('employee','company')),lawyer_id TEXT NOT NULL,assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(case_id,side),FOREIGN KEY(case_id) REFERENCES saliyah_sim_labor_cases(id),FOREIGN KEY(lawyer_id) REFERENCES saliyah_sim_legal_bots(id))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_labor_filings(id TEXT PRIMARY KEY,case_id TEXT NOT NULL,author_bot_id TEXT NOT NULL,side TEXT NOT NULL CHECK(side IN ('employee','company','court')),filing_type TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(case_id,side,filing_type),FOREIGN KEY(case_id) REFERENCES saliyah_sim_labor_cases(id))").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_representation(case_id,side,lawyer_id) SELECT id,'employee','sim-lawyer-'||printf('%03d',1+(abs(length(id)*17+unicode(substr(id,-1)))%20)) FROM saliyah_sim_labor_cases WHERE status IN ('pending','under_review')").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_representation(case_id,side,lawyer_id) SELECT id,'company','sim-lawyer-'||printf('%03d',21+(abs(length(id)*13+unicode(substr(id,-1)))%20)) FROM saliyah_sim_labor_cases WHERE status IN ('pending','under_review')").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_filings(id,case_id,author_bot_id,side,filing_type,body) SELECT 'labor-claim-'||l.id,l.id,r.lawyer_id,'employee','claim','أطلب مراجعة الراتب المستحق بمبلغ '||l.amount||' ريال صالي والتحقق من سجل الإيداعات.' FROM saliyah_sim_labor_cases l JOIN saliyah_sim_labor_representation r ON r.case_id=l.id AND r.side='employee' WHERE l.status IN ('pending','under_review')").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_filings(id,case_id,author_bot_id,side,filing_type,body) SELECT 'labor-defense-'||l.id,l.id,r.lawyer_id,'company','response','تطلب الشركة فحص كشف الحساب وسجل الصرف قبل إصدار أي قرار.' FROM saliyah_sim_labor_cases l JOIN saliyah_sim_labor_representation r ON r.case_id=l.id AND r.side='company' WHERE l.status IN ('pending','under_review')").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_labor_filings(id,case_id,author_bot_id,side,filing_type,body) SELECT 'labor-docket-'||l.id,l.id,'sim-court-clerk-001','court','docket','تم قيد الدعوى وتسجيل مذكرات الطرفين، والقرار بانتظار المراجعة.' FROM saliyah_sim_labor_cases l WHERE l.status IN ('pending','under_review')").run();
 // Identity requests are recorded first; simulated issuance occurs in a later scheduled cycle.
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_identities(id,citizen_id,status,issued_at,expires_at) SELECT 'sim-id-resident-'||substr(id,-4),id,'requested','', '' FROM saliyah_sim_citizens WHERE id LIKE 'sim-resident-%'").run();
 // Deterministic fictional eligibility: 20% incomplete/rejected, 40% eligible,
 // 40% reserved for royal review. Only pending simulated requests are touched.
 // Limit each cycle to avoid exhausting the review queue in a single run.
 await db.prepare("UPDATE saliyah_sim_identities SET status='rejected' WHERE id IN (SELECT id FROM saliyah_sim_identities WHERE status='requested' AND citizen_id LIKE 'sim-resident-%' AND CAST(substr(citizen_id,-4) AS INTEGER)%10 IN (0,1) ORDER BY id LIMIT 12)").run();
 await db.prepare("UPDATE saliyah_sim_identities SET status='issued',issued_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+14 days') WHERE id IN (SELECT id FROM saliyah_sim_identities WHERE status='requested' AND citizen_id LIKE 'sim-resident-%' AND CAST(substr(citizen_id,-4) AS INTEGER)%10 IN (2,3,4,5) ORDER BY id LIMIT 24)").run();
 await db.prepare("UPDATE saliyah_sim_identities SET status='renewal_requested' WHERE status='issued' AND expires_at<=CURRENT_TIMESTAMP AND citizen_id LIKE 'sim-resident-%'").run();
 await db.prepare("UPDATE saliyah_sim_identities SET status='issued',issued_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+14 days') WHERE status='renewal_requested' AND citizen_id LIKE 'sim-resident-%'").run();
 // A varied fictional population: different careers, family situations and outcomes.
 await db.prepare("UPDATE saliyah_sim_citizens SET occupation=CASE CAST(substr(id,-4) AS INTEGER)%16 WHEN 0 THEN 'طبيب' WHEN 1 THEN 'عسكري' WHEN 2 THEN 'معلم' WHEN 3 THEN 'طالب جامعي' WHEN 4 THEN 'طالب مدرسة' WHEN 5 THEN 'مهندس' WHEN 6 THEN 'ممرض' WHEN 7 THEN 'تاجر' WHEN 8 THEN 'عاطل عن العمل' WHEN 9 THEN 'محاسب' WHEN 10 THEN 'مزارع' WHEN 11 THEN 'رائد أعمال' WHEN 12 THEN 'موظف حكومي' WHEN 13 THEN 'سائق' WHEN 14 THEN 'باحث عن عمل' ELSE 'فني' END WHERE id LIKE 'sim-resident-%' AND occupation IN ('طالب','باحث عن عمل','تاجر','معلم','موظف','صاحب مشروع')").run();
 // Persist real relationships between fictional citizens, rather than isolated marriage labels.
 await db.prepare("WITH RECURSIVE pairs(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM pairs WHERE n<250) INSERT OR IGNORE INTO saliyah_sim_marriages(id,partner_a,partner_b,status) SELECT 'resident-marriage-'||printf('%04d',n),'sim-resident-'||printf('%04d',n*2-1),'sim-resident-'||printf('%04d',n*2),'married' FROM pairs").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_children(id TEXT PRIMARY KEY,marriage_id TEXT NOT NULL,name TEXT NOT NULL,born_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_family_cards(id TEXT PRIMARY KEY,marriage_id TEXT NOT NULL UNIQUE,number TEXT NOT NULL UNIQUE,issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 const familyMonth=Math.floor(Date.now()/2592000000);
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_children(id,marriage_id,name) SELECT 'sim-child-'||?||'-'||substr(m.id,-4),m.id,(CASE (CAST(substr(m.id,-4) AS INTEGER)+?)%8 WHEN 0 THEN 'محمد' WHEN 1 THEN 'عبدالله' WHEN 2 THEN 'سارة' WHEN 3 THEN 'ريم' WHEN 4 THEN 'فهد' WHEN 5 THEN 'نورة' WHEN 6 THEN 'خالد' ELSE 'هيا' END)||' '||substr(a.name,instr(a.name,' ')+1) FROM saliyah_sim_marriages m JOIN saliyah_sim_citizens a ON a.id=m.partner_a WHERE m.status='married' AND (CAST(substr(m.id,-4) AS INTEGER)+?)%5=0").bind(familyMonth,familyMonth,familyMonth).run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_family_cards(id,marriage_id,number) SELECT 'sim-family-'||substr(m.id,-4),m.id,'SFAM-'||substr(m.id,-4) FROM saliyah_sim_marriages m WHERE m.status='married' AND EXISTS(SELECT 1 FROM saliyah_sim_children c WHERE c.marriage_id=m.id)").run();
 // Persistent institutions only open after royal approval of their project.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_institutions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_enrollments(id TEXT PRIMARY KEY,citizen_id TEXT NOT NULL,institution_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'studying',enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(citizen_id,institution_id))").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_institutions(id,project_id,name,kind) SELECT 'sim-institution-'||id,id,title,project_type FROM saliyah_projects WHERE status='approved' AND project_type IN ('school','university')").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_enrollments(id,citizen_id,institution_id) SELECT 'sim-enrollment-'||c.id,c.id,(SELECT i.id FROM saliyah_sim_institutions i WHERE i.kind=CASE WHEN c.occupation='طالب مدرسة' THEN 'school' ELSE 'university' END AND i.status='open' ORDER BY i.id LIMIT 1) FROM saliyah_sim_citizens c WHERE c.id LIKE 'sim-resident-%' AND c.occupation IN ('طالب مدرسة','طالب جامعي') AND EXISTS(SELECT 1 FROM saliyah_sim_institutions i WHERE i.kind=CASE WHEN c.occupation='طالب مدرسة' THEN 'school' ELSE 'university' END AND i.status='open')").run();
 // Royal standing authorization: simulated education providers may open ordinary schools automatically.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_education_details(institution_id TEXT PRIMARY KEY,sector TEXT NOT NULL,level TEXT NOT NULL,tuition INTEGER NOT NULL DEFAULT 0,capacity INTEGER NOT NULL DEFAULT 200,founder_id TEXT)").run();
 const educationDay=Math.floor(Date.now()/86400000);
 const educationNames=['مدرسة الرواد','مدارس الأفق','مدرسة النور','أكاديمية المستقبل','مدرسة الواحة','مدارس الإبداع','مدرسة الأمل','مدارس القمة'];
 const sector=educationDay%3===0?'private':'public',level=educationDay%4===0?'secondary':educationDay%4===1?'primary':educationDay%4===2?'middle':'all';
 const schoolId='sim-school-auto-'+educationDay,schoolName=educationNames[educationDay%educationNames.length]+' '+(sector==='private'?'الأهلية':'الحكومية')+' '+educationDay;
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_institutions(id,project_id,name,kind,status) VALUES(?,?,?,'school','open')").bind(schoolId,schoolId,schoolName).run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_education_details(institution_id,sector,level,tuition,capacity,founder_id) VALUES(?,?,?,?,?,?)").bind(schoolId,sector,level,sector==='private'?({primary:15000,middle:17000,secondary:21000,university:24000}[level]||17000):0,120+(educationDay%5)*80,sector==='private'?'sim-resident-'+String(1+educationDay%2000).padStart(4,'0'):'ministry-education').run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_education_details(institution_id,sector,level,tuition,capacity,founder_id) SELECT id,'public','all',0,500,'ministry-education' FROM saliyah_sim_institutions WHERE project_id IN ('resident-school-01','gov-plan-83118','resident-university-01')").run();
 // Applicants are created only for real, open jobs at royally approved simulated companies.
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_job_applications(id,citizen_id,job_id,status) SELECT 'sim-job-application-'||c.id,c.id,(SELECT j.id FROM saliyah_sim_jobs j JOIN saliyah_sim_companies co ON co.id=j.company_id WHERE co.status='approved' AND j.status='open' ORDER BY j.id LIMIT 1),'applied' FROM saliyah_sim_citizens c WHERE c.id LIKE 'sim-resident-%' AND c.occupation IN ('باحث عن عمل','عاطل عن العمل') AND EXISTS(SELECT 1 FROM saliyah_sim_jobs j JOIN saliyah_sim_companies co ON co.id=j.company_id WHERE co.status='approved' AND j.status='open') AND CAST(substr(c.id,-4) AS INTEGER)%7=0").run();
 // A company can actually fail after operating, rather than logging imaginary failures.
 await db.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_business_outcomes(company_id TEXT PRIMARY KEY,outcome TEXT NOT NULL,decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_business_outcomes(company_id,outcome) SELECT id,CASE WHEN CAST(substr(hex(id),1,2) AS INTEGER)%5=0 THEN 'failed' ELSE 'operating' END FROM saliyah_sim_companies WHERE status='approved' AND created_at<datetime('now','-7 days')").run();
 await db.prepare("UPDATE saliyah_sim_jobs SET status='closed' WHERE company_id IN (SELECT company_id FROM saliyah_sim_business_outcomes WHERE outcome='failed') AND status='open'").run();
 // Education progression is recorded per resident and term; a failed exam may be retried next term.
 const term=Math.floor(Date.now()/ (86400000*7));
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_life_events(id,citizen_id,kind,description) SELECT 'education-term-'||?||'-'||substr(id,-4),id,CASE WHEN (CAST(substr(id,-4) AS INTEGER)+?)%5=0 THEN 'education_failure' ELSE 'education_success' END,CASE WHEN (CAST(substr(id,-4) AS INTEGER)+?)%5=0 THEN 'لم يجتز اختبار هذا الفصل وسيعيد المحاولة' ELSE 'اجتاز اختبار الفصل الدراسي' END FROM saliyah_sim_citizens WHERE id LIKE 'sim-resident-%' AND occupation IN ('طالب جامعي','طالب مدرسة')").bind(term,term,term).run();
 // Daily life events: studying, job hunting, shopping and running businesses.
 const day=Math.floor(Date.now()/86400000);
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_life_events(id,citizen_id,kind,description) SELECT 'sim-life-'||?||'-'||substr(id,-4),id,CASE (CAST(substr(id,-4) AS INTEGER)+?)%4 WHEN 0 THEN 'education' WHEN 1 THEN 'employment' WHEN 2 THEN 'shopping' ELSE 'business' END,CASE (CAST(substr(id,-4) AS INTEGER)+?)%4 WHEN 0 THEN 'حضور الدراسة في المملكة' WHEN 1 THEN 'البحث عن وظيفة أو أداء العمل' WHEN 2 THEN 'التسوق وشراء المستلزمات' ELSE 'متابعة مشروع تجاري افتراضي' END FROM saliyah_sim_citizens WHERE id LIKE 'sim-resident-%' AND CAST(substr(id,-4) AS INTEGER)%10=?").bind(day,day,day,day%10).run();
 // Diverse fictional population: citizens, expatriate residents, travellers and people resting at home.
 // Record a small rotating cohort per day rather than scanning/updating all 3,000 profiles every cycle.
 const lifestyleDay=Math.floor(Date.now()/86400000);
 const lifestyleKinds=['citizen','resident','travel','rest','work','study','shopping','family','job_search','business'];
 const lifestyleDescriptions=['مواطن صالي يعيش في المملكة','مقيم يحمل إقامة صالية سارية ضمن المحاكاة','سافر خارج المملكة في رحلة شخصية','يقضي يوم راحة في المنزل','متجه إلى العمل','يحضر دراسته','خرج للتسوق','يزور أسرته وأقاربه','يبحث عن وظيفة','يدير مشروعه الخاص'];
 const lifestyleWrites=[];
 for(let i=0;i<24;i++){
  const n=(lifestyleDay*24+i)%3000+1;
  const id=(n<=2000?'sim-resident-':'sim-employee-')+String(n<=2000?n:n-2000).padStart(4,'0');
  const kindIndex=(n*7+Math.floor(lifestyleDay/3))%lifestyleKinds.length;
  lifestyleWrites.push(db.prepare('INSERT OR IGNORE INTO saliyah_sim_life_events(id,citizen_id,kind,description) VALUES(?,?,?,?)').bind('lifestyle-'+lifestyleDay+'-'+i,id,lifestyleKinds[kindIndex],lifestyleDescriptions[kindIndex]));
 }
 if(lifestyleWrites.length)await db.batch(lifestyleWrites);
 // Life milestones are deterministic per resident/day and idempotent across retries.
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_life_events(id,citizen_id,kind,description) SELECT 'sim-milestone-'||?||'-'||substr(id,-4),id,CASE (CAST(substr(id,-4) AS INTEGER)+?)%9 WHEN 0 THEN 'social' WHEN 1 THEN 'study_plan' WHEN 2 THEN 'study_challenge' WHEN 3 THEN 'career_plan' WHEN 4 THEN 'job_search' WHEN 5 THEN 'training' WHEN 6 THEN 'business_plan' WHEN 7 THEN 'business_challenge' ELSE 'single_life' END,CASE (CAST(substr(id,-4) AS INTEGER)+?)%9 WHEN 0 THEN 'يتواصل مع معارفه في المملكة' WHEN 1 THEN 'يستعد لاختبار دراسي' WHEN 2 THEN 'يواجه صعوبة في المذاكرة' WHEN 3 THEN 'يخطط للتقدم الوظيفي' WHEN 4 THEN 'يبحث عن فرص عمل مناسبة' WHEN 5 THEN 'يتدرب على مهارات جديدة' WHEN 6 THEN 'يدرس فكرة مشروع تجاري' WHEN 7 THEN 'يبحث تحديات تأسيس مشروع' ELSE 'يعيش أعزب ويواصل حياته' END FROM saliyah_sim_citizens WHERE id LIKE 'sim-resident-%' AND CAST(substr(id,-4) AS INTEGER)%10=?").bind(day,day,day,day%10).run();

 const plans=[
  {ministry:16,type:'university',title:'جامعة الصالية الوطنية',location:'السجادة',description:'جامعة افتراضية للكليات والتخصصات وفرص التوظيف، بانتظار الاعتماد الملكي',budget:2500000},
  {ministry:16,type:'school',title:'مدرسة الأجيال الصالية',location:'المتجار',description:'مدرسة افتراضية جديدة بانتظار الاعتماد الملكي',budget:210000},
  {ministry:16,type:'school',title:'مدرسة المستقبل الصالية',location:'السجادة',description:'مدرسة افتراضية تضم 12 فصلاً مع وظائف للمعلمين والإداريين',budget:180000},
  {ministry:15,type:'clinic',title:'مركز العافية الصحي',location:'المتجار',description:'مركز صحي افتراضي للعيادات الأساسية',budget:240000},
  {ministry:17,type:'housing',title:'حي النخيل السكني',location:'السجادة',description:'مخطط سكني افتراضي يضم 30 وحدة',budget:900000},
  {ministry:26,type:'transport',title:'خط النقل الصالي',location:'المتجار',description:'خدمة نقل افتراضية تربط الأحياء والمرافق',budget:120000},
  {ministry:9,type:'commerce',title:'حاضنة الأعمال الصالية',location:'السجادة',description:'مركز افتراضي لدعم الشركات الناشئة وتوفير وظائف',budget:75000},
  {ministry:28,type:'telecom',title:'مركز الاتصال الرقمي',location:'السجادة',description:'مركز افتراضي لتطوير الاتصالات وخدمات الإنترنت',budget:110000}
 ];
 const plan=plans[Math.floor(hour/6)%plans.length];
 const slot=Math.floor(hour/6);
 const id='gov-plan-'+slot;
 await db.prepare("INSERT OR IGNORE INTO saliyah_projects(id,ministry_id,project_type,title,location,description,budget,status,proposed_by) VALUES(?,?,?,?,?,?,?,'pending_human','bot')").bind(id,plan.ministry,plan.type,plan.title,plan.location,plan.description,plan.budget).run();
 // Fictional founders propose businesses; registration is never approved by bots.
 const ventures=[
  ['مؤسسة النخبة الصالية للتقنية','تقنية المعلومات','السجادة','تطوير مواقع وتطبيقات للمنشآت الافتراضية',45000],
  ['مخابز القمح الصالي','الأغذية والمخابز','المتجار','إنتاج الخبز وتوزيعه داخل المدينة الافتراضية',28000],
  ['النورس الصالي للنقل','النقل والخدمات اللوجستية','السجادة','توصيل الطلبات ونقل البضائع بين المحافظات',62000],
  ['مزارع الواحة الصالية','الزراعة','المتجار','إنتاج الخضروات للمحال والمطاعم الافتراضية',39000],
  ['مدار الصالية للتجارة','التجارة الإلكترونية','السجادة','متجر افتراضي لبيع المستلزمات المنزلية',22000],
  ['أطلس الصالية للصيانة','الصيانة','المتجار','خدمات صيانة المباني والمرافق الافتراضية',34000]
 ];
 const slotCompany=Math.floor(hour/8),venture=ventures[slotCompany%ventures.length],companyId='sim-company-'+slotCompany;
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_companies(id,founder_id,name,activity,location,description,capital,status) VALUES(?,?,?,?,?,?,?,'approved')").bind(companyId,'sim-resident-'+String(1+slotCompany%2000).padStart(4,'0'),...venture).run();
 // Simulated identity issuance and renewal are already handled earlier in this cycle.
 // Royal decisions for real citizens and major government projects remain separate.
 // Standing royal authorization: ordinary fictional businesses may operate automatically.
 await db.prepare("UPDATE saliyah_sim_companies SET status='approved',reviewed_by='royal-standing-authorization',reviewed_at=CURRENT_TIMESTAMP WHERE status='pending_human' AND capital<=100000").run();
 // Employers can automatically process fictional applicants for approved companies only.
 const pendingApplications=(await db.prepare("SELECT a.id,a.citizen_id,a.job_id FROM saliyah_sim_job_applications a JOIN saliyah_sim_jobs j ON j.id=a.job_id JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE a.status='applied' AND c.status='approved' ORDER BY a.created_at LIMIT 15").all()).results;
 for(const a of pendingApplications){
  const occupied=await db.prepare("SELECT 1 FROM saliyah_sim_job_applications WHERE job_id=? AND status='hired' LIMIT 1").bind(a.job_id).first();
  if(occupied)continue;
  const hired=await db.prepare("UPDATE saliyah_sim_job_applications SET status='hired',decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='applied'").bind(a.id).run();
  if(hired.meta.changes)await db.prepare("UPDATE saliyah_sim_citizens SET occupation='موظف' WHERE id=?").bind(a.citizen_id).run();
  await db.prepare("UPDATE saliyah_sim_jobs SET status='filled' WHERE id=? AND status='open'").bind(a.job_id).run();
 }
 // Once a human approves a fictional business, it can hire simulated workers autonomously.
 const approved=(await db.prepare("SELECT id FROM saliyah_sim_companies WHERE status='approved' ORDER BY created_at DESC LIMIT 15").all()).results;
 for(const c of approved){
  const jobId='sim-job-'+c.id+'-'+Math.floor(hour/12);
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_jobs(id,company_id,title,salary,status) VALUES(?,?,?,?,'open')").bind(jobId,c.id,['محاسب','موظف خدمة عملاء','سائق','فني','مسؤول مبيعات'][hour%5],1800+(hour%5)*350).run();
 }
 // Generate separate fictional citizens; never impersonate or alter real user accounts.
 const citizens=['ناصر','ريم','سعود','لولوة','بدر','شهد','ماجد','غلا','تركي','نورة','فهد','سارة'];
 for(let i=0;i<3;i++){
  const seq=hour*3+i, id='citizen-'+seq, name=citizens[seq%citizens.length]+' الصالي';
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_citizens(id,name,occupation,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)").bind(id,name,['باحث عن عمل','طالب','تاجر','موظف'][seq%4]).run();
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_bank_accounts(id,owner_type,owner_id,account_number,bank_name,balance) VALUES(?,'citizen',? ,?,'البنك الصالي',800)").bind('sim-bank-c-'+id,id,'SC-SIM-'+id).run();
  // Automated low-risk fictional identity record; no real citizen document is issued.
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_identities(id,citizen_id,status,issued_at,expires_at) VALUES(?,?,'issued',CURRENT_TIMESTAMP,datetime('now','+14 days'))").bind('sim-id-'+seq,id).run();
  const openJob=await db.prepare("SELECT id FROM saliyah_sim_jobs WHERE status='open' ORDER BY created_at DESC LIMIT 1").first();
  if(openJob){
   const applicationId='sim-application-'+seq;
   await db.prepare("INSERT OR IGNORE INTO saliyah_sim_job_applications(id,citizen_id,job_id,status) VALUES(?,?,?,'applied')").bind(applicationId,id,openJob.id).run();
  }

 }
 // Simulated property market, company shares, marriages and natural life cycles.
 // The citizen occupation is already marked 'متوفى' when a death is simulated.
 // Avoid a correlated NOT EXISTS over thousands of life events for every citizen.
 const adults=(await db.prepare("SELECT c.id FROM saliyah_sim_citizens c WHERE c.occupation<>'متوفى' ORDER BY c.created_at LIMIT 100").all()).results;
 const propertyId='property-'+Math.floor(hour/6),seller=adults[hour%Math.max(1,adults.length)]?.id;
 if(seller){
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_properties(id,owner_id,kind,location,price,status) VALUES(?,?,?,?,?,'listed')").bind(propertyId,seller,['شقة','فيلا','محل تجاري','أرض'][hour%4],['شقة','فيلا','أرض'].includes(['شقة','فيلا','محل تجاري','أرض'][hour%4])?(Math.floor(hour/6)%2===0?'السجادة':'عقار'):'المتجار',55000+(hour%9)*18000).run();
 }
 // Bot purchases use the same financial/ownership guards as human purchases.
 // No unpaid automatic transfers: buyers must own an active, funded simulated account.
 const listed=await db.prepare("SELECT id,owner_id,price FROM saliyah_sim_properties WHERE status='listed' ORDER BY price,id LIMIT 1").first();
 if(listed){
  const buyer=await db.prepare("SELECT a.owner_id,a.id FROM saliyah_sim_bank_accounts a JOIN saliyah_sim_citizens c ON c.id=a.owner_id WHERE a.owner_type='citizen' AND a.status='active' AND a.owner_id<>? AND a.balance>=? ORDER BY a.balance DESC,a.owner_id LIMIT 1").bind(listed.owner_id,listed.price).first();
  if(buyer)try{
   await db.prepare('INSERT OR IGNORE INTO saliyah_sim_bot_property_purchases(id,property_id,buyer_id,buyer_account_id,seller_id,price) VALUES(?,?,?,?,?,?)').bind('bot-property-'+listed.id,listed.id,buyer.owner_id,buyer.id,listed.owner_id,listed.price).run();
  }catch(error){console.error('sim_bot_property_purchase_failed',String(error).slice(0,180))}
 }
 const companies=(await db.prepare("SELECT id,founder_id,capital FROM saliyah_sim_companies WHERE status='approved' ORDER BY created_at LIMIT 20").all()).results;
 for(const c of companies){
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_shares(id,company_id,owner_id,units) VALUES(?,?,?,?)").bind('shares-founder-'+c.id,c.id,c.founder_id,1000).run();
 }
 if(companies.length&&adults.length){
  const company=companies[hour%companies.length],buyer=adults[hour%adults.length];
  const holding=await db.prepare("SELECT id,owner_id,units FROM saliyah_sim_shares WHERE company_id=? AND units>=10 AND owner_id NOT LIKE 'human:%' ORDER BY units DESC LIMIT 1").bind(company.id).first();
  if(holding&&holding.owner_id!==buyer.id){
   const tradeId='share-trade-'+hour;
   const inserted=await db.prepare("INSERT OR IGNORE INTO saliyah_sim_share_trades(id,company_id,seller_id,buyer_id,units,price_per_unit) VALUES(?,?,?,?,10,?)").bind(tradeId,company.id,holding.owner_id,buyer.id,Math.max(1,Math.round(company.capital/1000))).run();
   if(inserted.meta.changes){
    await db.prepare("UPDATE saliyah_sim_shares SET units=units-10 WHERE id=? AND units>=10").bind(holding.id).run();
    await db.prepare("INSERT INTO saliyah_sim_shares(id,company_id,owner_id,units) VALUES(?,?,?,10) ON CONFLICT(id) DO UPDATE SET units=units+10").bind('shares-'+company.id+'-'+buyer.id,company.id,buyer.id).run();
   }
  }
 }
 if(adults.length>=2&&hour%8===0){
  const a=adults[(hour*3)%adults.length],b=adults[(hour*3+1)%adults.length];
  const existing=await db.prepare("SELECT id FROM saliyah_sim_marriages WHERE status='married' AND (partner_a IN (?,?) OR partner_b IN (?,?)) LIMIT 1").bind(a.id,b.id,a.id,b.id).first();
  if(!existing&&a.id!==b.id){const genders=await db.prepare("SELECT id,gender FROM saliyah_sim_citizens WHERE id IN (?,?)").bind(a.id,b.id).all();const g=Object.fromEntries(genders.results.map(x=>[x.id,x.gender]));if(g[a.id]==='male'&&g[b.id]==='female')await db.prepare("INSERT OR IGNORE INTO saliyah_sim_marriages(id,partner_a,partner_b,status) VALUES(?,?,?,'married')").bind('marriage-'+Math.floor(hour/8),a.id,b.id).run();}
 }
 // Simulated deaths never delete accounts, ownership or audit records.
 if(adults.length>20&&hour%24===0){
  const candidate=adults[(hour*7)%adults.length];
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_life_events(id,citizen_id,kind,description) VALUES(?,?,'death','وفاة طبيعية ضمن المحاكاة')").bind('life-death-'+Math.floor(hour/24),candidate.id).run();
  await db.prepare("UPDATE saliyah_sim_citizens SET occupation='متوفى' WHERE id=? AND occupation<>'متوفى'").bind(candidate.id).run();
 }
 // Simulated border arrivals and departures: no real immigration records are touched.
 if(aviationDb){
 // Foreign tourist bots are visitors, never Saliyah citizens or residents.
 // Seed a small group per four-hour simulation cycle to protect D1 quotas.
 await aviationDb.prepare("CREATE TABLE IF NOT EXISTS saliyah_sim_tourists(id TEXT PRIMARY KEY,name TEXT NOT NULL,nationality TEXT NOT NULL,passport_number TEXT NOT NULL UNIQUE,visa_status TEXT NOT NULL,arrival_port TEXT NOT NULL,visit_purpose TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
 const touristFirst=['James','Oliver','William','Emily','Sophia','Charlotte','Noah','Liam','Amelia','Lucas','Emma','Henry','Isabella','Jack','Olivia','Ethan','Mia','Alexander','Grace','Daniel'];
 const touristLast=['Smith','Johnson','Brown','Wilson','Taylor','Anderson','Martin','Miller','Davis','Clark','Thomas','Walker','Harris','Lewis','White','Hall','Young','King','Scott','Baker'];
 const touristCountries=['المملكة المتحدة','الولايات المتحدة','كندا','أستراليا','ألمانيا','فرنسا','إيطاليا','هولندا','إسبانيا','نيوزيلندا'];
 const touristWrites=[];
 for(let i=0;i<12;i++){
  const n=(Math.floor(hour/4)*12+i)%240;
  const name=touristFirst[(n*7+3)%touristFirst.length]+' '+touristLast[(n*11+5)%touristLast.length];
  const nationality=touristCountries[n%touristCountries.length];
  const visa=(n%13===0?'pending':n%17===0?'refused':'approved');
  touristWrites.push(aviationDb.prepare("INSERT OR IGNORE INTO saliyah_sim_tourists(id,name,nationality,passport_number,visa_status,arrival_port,visit_purpose) VALUES(?,?,?,?,?,?,?)").bind('tourist-'+String(n+1).padStart(4,'0'),name,nationality,'VIS-'+String(n+1).padStart(6,'0'),visa,'مطار الملك زياد الدولي',n%4===0?'زيارة عائلية':'سياحة'));
 }
 if(touristWrites.length)await aviationDb.batch(touristWrites);
 }
 const ports=['منفذ السجادة البري','مطار الملك زياد الدولي','ميناء المتجار'];
 const recent=(await db.prepare("SELECT id FROM saliyah_sim_citizens ORDER BY created_at DESC LIMIT 60").all()).results;
 for(let i=0;i<8&&recent.length;i++){
  const seq=hour*8+i,c=recent[(hour+i*11)%recent.length];
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_border_events(id,citizen_id,port,direction,inspection_status) VALUES(?,?,?,?,?)").bind('border-'+seq,c.id,ports[(hour+i)%ports.length],(hour+i)%2?'exit':'entry','cleared_by_bot').run();
 }
 // A fictional police incident is recorded, investigated and tried only within the simulation.
 if(recent.length>=2){
  const incident='incident-'+Math.floor(hour/4),suspect=recent[hour%recent.length],officer=fictionalBotName(hour%80)+' بن '+fictionalFirstNames[hour%fictionalFirstNames.length];
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_incidents(id,suspect_id,officer,allegation,status) VALUES(?,?,?,?,'reported')").bind(incident,suspect.id,officer,['مخالفة مرورية افتراضية','إتلاف ممتلكات افتراضي','مخالفة تجارية افتراضية'][hour%3]).run();
 }
 const reports=(await db.prepare("SELECT id FROM saliyah_sim_incidents WHERE status='reported' ORDER BY created_at LIMIT 5").all()).results;
 for(const report of reports){
  await db.prepare("UPDATE saliyah_sim_incidents SET status='referred_to_court',arrested_at=CURRENT_TIMESTAMP WHERE id=? AND status='reported'").bind(report.id).run();
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_trials(id,incident_id,judge,verdict,status) VALUES(?,?,?,'لا حكم حتى انتهاء المحاكمة','scheduled')").bind('trial-'+report.id,report.id,'القاضي الآلي '+((hour%5)+1)).run();
 }
 const trials=(await db.prepare("SELECT id FROM saliyah_sim_trials WHERE status='scheduled' AND created_at < datetime('now','-1 hour') ORDER BY created_at LIMIT 5").all()).results;
 for(const trial of trials){
  await db.prepare("UPDATE saliyah_sim_trials SET status='completed',verdict='حكم محاكاة: تنبيه وتوعية',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='scheduled'").bind(trial.id).run();
 }
}
// Clearly labelled simulated activity: bot accounts never impersonate ministries or publish real decrees.
 const botReachSQL="SELECT COALESCE(SUM(CAST((max(0,julianday('now')-julianday(created_at))*max(0,julianday('now')-julianday(created_at))*1250)+(bot_likes*min(1,max(0,julianday('now')-julianday(created_at))/3)) AS INTEGER)),0) bot_likes,COALESCE(SUM(CAST((max(0,julianday('now')-julianday(created_at))*max(0,julianday('now')-julianday(created_at))*75)+(bot_reposts*min(1,max(0,julianday('now')-julianday(created_at))/3)) AS INTEGER)),0) bot_reposts FROM x_bot_reach WHERE post_id IN (SELECT id FROM x_posts WHERE profile_id=?)";
 const computeXCreatorStats=async (db,profileId)=>{
  const real=await db.prepare("SELECT (SELECT COUNT(*) FROM x_follows f WHERE f.following_id=?) followers,(SELECT COUNT(*) FROM x_likes l JOIN x_posts p ON p.id=l.post_id WHERE p.profile_id=? AND l.profile_id<>?) likes,(SELECT COUNT(DISTINCT r.profile_id) FROM x_posts r JOIN x_posts p ON p.id=r.repost_of WHERE p.profile_id=? AND r.profile_id<>?) reposts,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM x_follows f JOIN x_profiles actor ON actor.id=f.follower_id WHERE f.following_id=?) followers_twice,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM x_likes l JOIN x_posts p ON p.id=l.post_id JOIN x_profiles actor ON actor.id=l.profile_id WHERE p.profile_id=? AND l.profile_id<>?) likes_twice,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM (SELECT DISTINCT r.profile_id FROM x_posts r JOIN x_posts original ON original.id=r.repost_of WHERE original.profile_id=?) rr JOIN x_profiles actor ON actor.id=rr.profile_id WHERE rr.profile_id<>?) reposts_twice").bind(profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId).first();
  const bots=await db.prepare(botReachSQL).bind(profileId).first();
  const botFollowers=Math.floor(bots.bot_likes/100);
  return {...real,bot_likes:bots.bot_likes,bot_reposts:bots.bot_reposts,bot_followers:botFollowers,followers:real.followers+botFollowers,likes:real.likes+bots.bot_likes,reposts:real.reposts+bots.bot_reposts,followers_twice:real.followers_twice+botFollowers,likes_twice:real.likes_twice+bots.bot_likes,reposts_twice:real.reposts_twice+bots.bot_reposts};
 };


async function runXCreatorAutoPayouts(db){
 const period=Math.floor(Date.now()/259200000).toString();
 // The pending set shrinks after each payout; OFFSET previously skipped eligible creators.
 const prefs=(await db.prepare("SELECT p.profile_id,p.user_id,p.bank_account_id FROM x_creator_payout_preferences p JOIN x_profiles x ON x.id=p.profile_id AND x.user_id=p.user_id AND x.kind='person' JOIN bank_accounts a ON a.id=p.bank_account_id AND a.user_id=p.user_id WHERE p.enabled=1 AND NOT EXISTS(SELECT 1 FROM x_creator_payouts r WHERE r.profile_id=p.profile_id AND r.period=?) ORDER BY p.profile_id LIMIT 50").bind(period).all()).results;
 for(const p of prefs)try{
  // Share the exact calculation with GET earnings and manual claims.
  const stats=await computeXCreatorStats(db,p.profile_id);
  if(stats.followers<10||stats.likes<20||stats.reposts<5)continue;
  const amount=Math.floor((stats.followers_twice+2*stats.likes_twice+3*stats.reposts_twice)/2);
  if(!Number.isSafeInteger(amount)||amount<=0)continue;
  // UNIQUE(profile_id,period) and the payout trigger guarantee one credit per three-day period.
  await db.prepare("INSERT OR IGNORE INTO x_creator_payouts(id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM x_creator_payout_preferences WHERE profile_id=? AND user_id=? AND bank_account_id=? AND enabled=1)").bind(crypto.randomUUID(),p.profile_id,p.user_id,period,stats.followers,stats.likes,stats.reposts,amount,p.bank_account_id,p.profile_id,p.user_id,p.bank_account_id).run();
 }catch(error){console.error('x_auto_payout_failed',p.profile_id,String(error).slice(0,220))}
}
async function generateXBotActivity(db){
 // Index the exact feed predicate and ordering; idempotent across worker restarts.
 await db.prepare('CREATE INDEX IF NOT EXISTS idx_x_root_feed_v2 ON x_posts(created_at DESC) WHERE reply_to IS NULL').run();
 const names=['نواف','سارة','راكان','ليان','فهد','ريم','تركي','جود','ماجد','هيا','بدر','دانة','سلطان','نورة','مشعل','لمى','عبدالله','شهد','فيصل','غلا','خالد','أريج','عمر','رغد','سلمان','مها','يوسف','رنا','طلال','عبير'];
 const topics=[
 'وش رأيكم في تجربة إكس الصالية اليوم؟ 🤖',
 'تذكير من حساب آلي: تابعوا الأخبار الحكومية من الحسابات الرسمية الموثقة فقط.',
 'سؤال للنقاش: وش الخدمة اللي تتمنون إضافتها للبنوك الصالية؟ 🏦',
 'تجربة محاكاة: لو صار عندنا قرار صالي جديد عن الخدمات الإلكترونية، وش أول شيء تتمنونه؟',
 'الريال الصالي هو العملة المستخدمة في الخدمات 💰 وش رأيكم بطريقة الدفع؟',
 'هل تفضلون إنجاز خدمات الأحوال من الجوال أو زيارة الفرع؟ 📱',
 'يا أهل الصالية، وش أكثر ميزة تستخدمونها في الموقع؟',
 'منشور آلي للنقاش: كيف نخلي منصة إكس الصالية أكثر فائدة للجميع؟',
 'سؤال: وش رأيكم بخدمات أبشر الصالية الإلكترونية؟',
 'تخيلوا لو أطلقت وزارة النقل الصالية خدمة جديدة، وش تتمنون تكون؟ 🚗',
 'البنوك الصالية تحتاج أفكاركم: تحويلات أسرع أو كشف حساب أو إشعارات؟',
 'تجربة نقاش افتراضي: هل تؤيدون إعلانات دورية عن تحديثات الموقع؟',
 'مين جرّب يكتب أول تعليق في إكس الصالية؟ 💬',
 'وش أفضل شيء في تصميم البوابة الحكومية الصالية؟',
 'سؤال خفيف: لو فتحت مشروع في الصالية، وش بتسميه؟',
 'الحسابات الرسمية لها توثيق خاص، أما هذا حساب آلي للتفاعل 🤖',
 'نقاش افتراضي: وش الخدمة اللي تحتاج تبسيط أكثر في المملكة الصالية؟',
 'صباح الخير يا أهل الصالية ☀️ شاركونا أفكاركم للمنصة.',
 'مساء الخير 🌙 وش جديدكم في عالم الصالية؟',
 'هل تفضلون منشورات قصيرة أو شروحات طويلة عن خدمات الموقع؟'
 ];
 const firstNames=['أحمد','محمد','عبدالله','خالد','فهد','نواف','راكان','تركي','سلمان','عمر','يوسف','ماجد','بدر','سلطان','فيصل','سارة','نورة','ريم','ليان','هيا','شهد','غلا','دانة','لمى','رغد','مها','جود','أريج','عبير','لولوة'];
 const familyNames=['العتيبي','القحطاني','الشمري','العنزي','الحربي','الدوسري','المطيري','الغامدي','الزهراني','المالكي','السالمي','الراشدي','الصالي','الهاجري','العمري','الشهري'];
 // Human-style fictional names, always clearly identified as bots with 🤖.
 const botIds=Array.from({length:1999},(_,i)=>'x-sim-bot-'+String(i+1).padStart(4,'0'));
 const botSeeded=await db.prepare("SELECT id FROM x_profiles WHERE id='x-sim-bot-1999'").first();
 if(!botSeeded){const seed=await db.prepare("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1999) INSERT OR IGNORE INTO x_profiles(id,user_id,handle,display_name,bio,kind,verified) SELECT 'x-sim-bot-'||printf('%04d',n),NULL,'saliyah_bot_'||printf('%04d',n),'مواطن صالي آلي '||n||' 🤖','حساب محاكاة آلي؛ ليس شخصًا حقيقيًا','bot',0 FROM seq").run();
 }
 // Names are initialized only for new placeholder profiles; do not rewrite 1,999 rows every hour.
 const botNamesReady=await db.prepare("SELECT 1 FROM saliyah_sim_settings WHERE key='x_bot_names_bootstrap_v1'").first();
 if(!botNamesReady){
 const unnamed=(await db.prepare("SELECT id FROM x_profiles WHERE kind='bot' AND display_name LIKE 'مواطن صالي آلي %' LIMIT 100").all()).results;
 if(unnamed.length){const statements=unnamed.map(p=>{const i=Math.max(0,Number(p.id.slice(-4))-1);const name=firstNames[(i*7+Math.floor(i/30))%firstNames.length]+' '+familyNames[(i*11+Math.floor(i/16))%familyNames.length]+' 🤖';return db.prepare("UPDATE x_profiles SET display_name=? WHERE id=? AND kind='bot'").bind(name,p.id)});await db.batch(statements)}
 if(!unnamed.length)await db.prepare("INSERT OR IGNORE INTO saliyah_sim_settings(key,value) VALUES('x_bot_names_bootstrap_v1','complete')").run();
 }
 const now=Math.floor(Date.now()/1800000);
 // Idempotent per half-hour; maintain the same approximate hourly activity volume.
 const newPostStatements=[];
 for(let i=0;i<8;i++){
  const id='sim-'+now+'-'+i;
  const profile=botIds[(now*7+i*11)%botIds.length];
  const body=topics[(now*3+i*7)%topics.length];
  newPostStatements.push(db.prepare('INSERT OR IGNORE INTO x_posts(id,profile_id,body) VALUES(?,?,?)').bind(id,profile,body));
 }
 if(newPostStatements.length)await db.batch(newPostStatements);
 // Uneven discovery: most posts receive little engagement; a few trend temporarily.
 // The distribution rotates over time, so fame is neither universal nor permanent.
 const posts=(await db.prepare("SELECT id,profile_id,body FROM x_posts WHERE reply_to IS NULL ORDER BY created_at DESC LIMIT 90").all()).results;
 const score=(id,salt)=>{let h=2166136261;for(const ch of String(id)+':'+salt){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0};
 const likeWrites=[];
 for(let i=0;i<75&&posts.length;i++){
  const candidate=posts[score(now+':'+i,'pick')%posts.length];
  const wave=score(candidate.id,Math.floor(now/24));
  const tier=wave%100;
  // About 70% of posts remain quiet, 25% get moderate reach, 5% trend.
  const chance=tier<70?4:tier<95?24:85;
  if(score(candidate.id,now+':'+i)%100>=chance)continue;
  const bot=botIds[score(candidate.id,now+':fan:'+i)%botIds.length];
  if(bot===candidate.profile_id)continue;
  likeWrites.push(db.prepare('INSERT OR IGNORE INTO x_likes(profile_id,post_id) VALUES(?,?)').bind(bot,candidate.id));
 }
 if(likeWrites.length)await db.batch(likeWrites);
 // Fictional accounts hold uneven, contextual, multi-turn discussions.
 const replies=[
  ['بالتوفيق في الحساب الجديد، وش نوع المحتوى اللي بتنشرونه؟','حياكم في إكس الصالية، ننتظر أول أخباركم.','بداية موفقة، تابعنا الحساب وننتظر الجديد.'],
  ['أتمنى تكون إجراءات الخدمة واضحة وسريعة.','هل الخدمة متاحة إلكترونيًا أو لازم زيارة الفرع؟','الأهم توضيح المتطلبات والرسوم قبل التقديم.'],
  ['تطوير التعليم مهم، هل فيه تفاصيل عن التسجيل؟','أتمنى توفرون تخصصات وفرص تدريب للطلاب.','متى تبدأ الدراسة وكيف طريقة التقديم؟'],
  ['هل التحويلات البنكية متاحة لجميع الحسابات؟','ياليت توضحون رسوم الخدمة وحدود التحويل.','هل الدفع يتم بالريال الصالي من التطبيق؟'],
  ['وين موقع العقار وكم سعره؟','هل العقار في السجادة أو محافظة عقار؟','هل فيه تفاصيل عن المساحة وطريقة الشراء؟'],
  ['وش شروط التقديم على الوظيفة؟','هل التوظيف مفتوح لجميع المواطنين؟','كم الراتب وكيف أقدم؟'],
  ['مبروك الخبر، متى يبدأ التنفيذ؟','هل فيه تفاصيل أكثر عن القرار؟','ننتظر التحديثات الرسمية عن الموضوع.'],
  ['أتمنى تطبيق يوضح حالة الطرق والزحام.','ياليت توفر الوزارة خدمة متابعة النقل العام ومواعيده.','أقترح خدمة إلكترونية لتجديد تصاريح النقل.']
 ];
 const followups=[
  ['وش المواضيع اللي ناوين تركزون عليها بالحساب؟','بنتابع منشوراتكم الجديدة.','حياكم، ننتظر أول تحديث منكم.'],
  ['هل فيه رابط رسمي لطلب الخدمة؟','كم يستغرق إنجاز المعاملة؟','هل تتوفر الخدمة داخل أبشر الصالية؟'],
  ['هل التسجيل متاح للطلاب حاليًا؟','هل فيه رسوم أو شروط للقبول؟','وين نلقى الجدول الدراسي؟'],
  ['هل يظهر التحويل في كشف الحساب مباشرة؟','هل يمكن اختيار الحساب قبل الدفع؟','هل فيه توضيح للرسوم بالريال الصالي؟'],
  ['هل العقار متاح للشراء الآن؟','هل السعر يشمل جميع الرسوم؟','وين ألقى تفاصيل المساحة؟'],
  ['هل الوظيفة بدوام كامل؟','هل الراتب أسبوعي أو كل أسبوعين؟','وين رابط التقديم؟'],
  ['هل صدر بيان رسمي بالتفاصيل؟','متى يبدأ تنفيذ القرار؟','هل فيه موعد محدد للمشروع؟'],
  ['هل فيه خريطة لمسارات النقل؟','هل الخدمة تشمل المحافظات؟','كيف نعرف مواعيد الرحلات؟']
 ];
 const topicFor=body=>{
  const t=String(body||'');
  if(/فتحنا الحساب|حساب جديد|انضممنا|أول منشور/.test(t)&&!/بنك|تحويل|ريال|عقار|وظيف|تعليم|وزارة النقل|جواز|هوية/.test(t))return 0;
  if(/وزارة النقل|نقل عام|مواصلات|طرق|سيارات|مرور|تاكسي/.test(t))return 7;
  if(/مدرس|جامع|تعليم|طلاب|دراس/.test(t))return 2;
  if(/بنك|تحويل|هلل|ريال|مصرف|دفع/.test(t))return 3;
  if(/عقار|شقة|فيلا|أرض|إيجار/.test(t))return 4;
  if(/وظيف|توظيف|راتب|عمل/.test(t))return 5;
  if(/أبشر|جواز|هوية|خدم|فرع|رخصة/.test(t))return 1;
  if(/إعلان|قرار|افتتاح|خبر|مشروع/.test(t))return 6;
  return -1;
 };
 const discussionPosts=posts.slice(0,80);
 const replyWrites=[];
 for(let i=0;i<65&&discussionPosts.length;i++){
  const p=discussionPosts[score(now+':discussion:'+i,'target')%discussionPosts.length];
  const reach=score(p.id,Math.floor(now/24))%100;
  const chance=reach<70?35:reach<95?75:98;
  if(score(p.id,now+':comment:'+i)%100>=chance)continue;
  const bot=botIds[score(p.id,now+':commenter:'+i)%botIds.length];
  if(bot===p.profile_id)continue;
  const theme=topicFor(p.body);if(theme<0||/إعادة نشر/.test(p.body))continue;
  const body=replies[theme][score(bot,p.id+':reply')%replies[theme].length];
  const replyId='sim-reply-'+now+'-'+i;
  replyWrites.push(db.prepare("INSERT OR IGNORE INTO x_posts(id,profile_id,body,reply_to) VALUES(?,?,?,?)").bind(replyId,bot,body,p.id));
  // Some conversations develop into a second exchange; others stop after one comment.
  if(score(p.id,now+':thread:'+i)%100<55){
   const secondBot=botIds[score(p.id,now+':second:'+i)%botIds.length];
   if(secondBot!==bot){
    const second=followups[theme][score(secondBot,p.id)%followups[theme].length];
    replyWrites.push(db.prepare("INSERT OR IGNORE INTO x_posts(id,profile_id,body,reply_to) VALUES(?,?,?,?)").bind('sim-thread-'+now+'-'+i,secondBot,second,replyId));
   }
  }
 }

 for(let i=0;i<replyWrites.length;i+=50)await db.batch(replyWrites.slice(i,i+50));
 // Keep follower growth and reposts active, but cap database work per run.
 const featured=discussionPosts.filter(p=>p.profile_id&&!p.id.startsWith('sim-'));
 const engagementWrites=[];
 for(let i=0;i<22&&featured.length;i++){
  const p=featured[score(now+':repost:'+i,'post')%featured.length];
  const bot=botIds[score(p.id,now+':reposter:'+i)%botIds.length];
  if(bot===p.profile_id)continue;
  engagementWrites.push(db.prepare('INSERT OR IGNORE INTO x_posts(id,profile_id,body,repost_of) VALUES(?,?,?,?)').bind('sim-repost-'+now+'-'+i,bot,'',p.id));
 }
 const authors=[...new Set(featured.map(p=>p.profile_id))];
 for(let i=0;i<36&&authors.length;i++){
  const author=authors[score(now+':follow:'+i,'author')%authors.length];
  const bot=botIds[score(author,now+':follower:'+i)%botIds.length];
  if(bot===author)continue;
  engagementWrites.push(db.prepare('INSERT OR IGNORE INTO x_follows(follower_id,following_id) VALUES(?,?)').bind(bot,author));
 }
 if(engagementWrites.length)await db.batch(engagementWrites);
}
async function checkSimulationHealth(db){
 const checks=[
  ['orphan_enrollments',"SELECT COUNT(*) n FROM saliyah_sim_enrollments e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id LEFT JOIN saliyah_sim_institutions i ON i.id=e.institution_id WHERE c.id IS NULL OR i.id IS NULL"],
  ['orphan_job_applications',"SELECT COUNT(*) n FROM saliyah_sim_job_applications a LEFT JOIN saliyah_sim_citizens c ON c.id=a.citizen_id LEFT JOIN saliyah_sim_jobs j ON j.id=a.job_id WHERE c.id IS NULL OR j.id IS NULL"],
  ['duplicate_hires',"SELECT COUNT(*) n FROM (SELECT job_id FROM saliyah_sim_job_applications WHERE status='hired' GROUP BY job_id HAVING COUNT(*)>1)"],
  ['orphan_children',"SELECT COUNT(*) n FROM saliyah_sim_children c LEFT JOIN saliyah_sim_marriages m ON m.id=c.marriage_id WHERE m.id IS NULL"],
  ['orphan_posts',"SELECT COUNT(*) n FROM x_posts p LEFT JOIN x_profiles x ON x.id=p.profile_id WHERE x.id IS NULL"],
  ['orphan_sim_bank_accounts',"SELECT COUNT(*) n FROM saliyah_sim_bank_accounts a LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND a.owner_id=c.id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND a.owner_id=b.id WHERE (a.owner_type='citizen' AND c.id IS NULL) OR (a.owner_type='company' AND b.id IS NULL)"],
  ['orphan_sim_bank_transactions',"SELECT COUNT(*) n FROM saliyah_sim_bank_transactions t LEFT JOIN saliyah_sim_bank_accounts a ON a.id=t.account_id WHERE a.id IS NULL"],
  ['unbalanced_sim_payroll',"SELECT COUNT(*) n FROM (SELECT CASE WHEN kind='salary_debit' THEN substr(id,1,length(id)-4) ELSE substr(id,1,length(id)-3) END ref,SUM(amount) amount,COUNT(*) entries FROM saliyah_sim_bank_transactions WHERE kind IN ('salary_debit','salary_credit') GROUP BY CASE WHEN kind='salary_debit' THEN substr(id,1,length(id)-4) ELSE substr(id,1,length(id)-3) END HAVING amount<>0 OR entries<>2)"],
  ['negative_sim_balances',"SELECT COUNT(*) n FROM saliyah_sim_bank_accounts WHERE balance<0"]
 ];
 const problems={};
 for(const [name,sql] of checks){const row=await db.prepare(sql).first();if(Number(row?.n||0)>0)problems[name]=Number(row.n)}
 const status=Object.keys(problems).length?'warning':'ok';
 await db.prepare("INSERT INTO saliyah_sim_settings(key,value) VALUES('simulation_health_status',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({status,checked_at:new Date().toISOString(),problems})).run();
 return {status,problems};
}
// Automated fictional civil servants process REAL citizens' applications without becoming real user accounts.
// Keep the database writes bounded and separately attributed to named bot employees.
// One human applicant gets one contract per approved bot-company vacancy.
async function ensureBotCompanyContract(db,id){
 const a=await db.prepare("SELECT a.id,a.applicant_id,a.target_id,a.status,j.title,j.salary,c.name employer,c.status company_status FROM shared_service_applications a JOIN saliyah_sim_jobs j ON j.id=a.target_id JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE a.id=? AND a.service='jobs'").bind(id).first();
 if(!a||a.status!=='accepted'||a.company_status!=='approved')return {ok:false,error:'طلب غير معتمد'};
 const prior=await db.prepare('SELECT id FROM employment_contracts WHERE application_id=?').bind(id).first();
 if(prior){await db.prepare("UPDATE saliyah_sim_jobs SET status='filled' WHERE id=? AND status='open'").bind(a.target_id).run();return {ok:true,id:prior.id,existing:true};}
 const other=await db.prepare("SELECT 1 FROM employment_contracts ec JOIN shared_service_applications sa ON sa.id=ec.application_id WHERE sa.service='jobs' AND sa.target_id=? AND ec.active=1 LIMIT 1").bind(a.target_id).first();
 const bot=await db.prepare("SELECT 1 FROM saliyah_sim_job_applications WHERE job_id=? AND status='hired' LIMIT 1").bind(a.target_id).first();
 if(other||bot)return {ok:false,error:'الوظيفة محجوزة'};
 const existingHuman=await db.prepare("SELECT 1 FROM shared_service_applications WHERE service='jobs' AND target_id=? AND status='accepted' AND id<>? LIMIT 1").bind(a.target_id,id).first();
 if(existingHuman)return {ok:false,error:'يوجد طلب آخر مقبول لنفس الوظيفة'};
 const contractId=crypto.randomUUID();
 try{
  const results=await db.batch([
   db.prepare("INSERT OR IGNORE INTO employer_budgets(employer,sector) VALUES(?,'private')").bind(a.employer),
   db.prepare("INSERT INTO employment_contracts(id,application_id,employee_id,employer,title,salary) SELECT ?,id,applicant_id,?,?,? FROM shared_service_applications WHERE id=? AND service='jobs' AND status='accepted' AND NOT EXISTS(SELECT 1 FROM employment_contracts WHERE application_id=?) AND NOT EXISTS(SELECT 1 FROM saliyah_sim_job_applications WHERE job_id=? AND status='hired') AND NOT EXISTS(SELECT 1 FROM employment_contracts ec JOIN shared_service_applications sa ON sa.id=ec.application_id WHERE sa.target_id=? AND ec.active=1)").bind(contractId,a.employer,a.title,a.salary,id,id,a.target_id,a.target_id),
   db.prepare("UPDATE saliyah_sim_jobs SET status='filled' WHERE id=? AND status='open'").bind(a.target_id)
  ]);
  if(results[1].meta.changes)return {ok:true,id:contractId};
 }catch(e){console.error('bot_company_contract_failed',String(e).slice(0,200))}
 const existing=await db.prepare('SELECT id FROM employment_contracts WHERE application_id=?').bind(id).first();
 return existing?{ok:true,id:existing.id,existing:true}:{ok:false,error:'تعذر إصدار العقد'};
}
async function backfillBotCompanyContracts(db){
 const pending=(await db.prepare("SELECT a.id FROM shared_service_applications a WHERE a.service='jobs' AND a.status='accepted' AND NOT EXISTS(SELECT 1 FROM employment_contracts c WHERE c.application_id=a.id) ORDER BY a.created_at LIMIT 12").all()).results;
 for(const a of pending)try{await ensureBotCompanyContract(db,a.id)}catch(e){console.error('bot_company_contract_backfill',String(e).slice(0,180))}
}
async function runSimEmployeeServices(db){
 await backfillBotCompanyContracts(db);
 const people=(await db.prepare("SELECT id,name FROM saliyah_sim_citizens WHERE id IN ('sim-employee-0001','sim-employee-0002','sim-employee-0010')").all()).results;
 const staff=Object.fromEntries(people.map(p=>[p.id,p]));
 const civil=staff['sim-employee-0001'], teacher=staff['sim-employee-0002'], service=staff['sim-employee-0010'];
 const today=new Date().toISOString().slice(0,10);
 const record=async (employee,category,rowId,decision,details,recipient,subject,message)=>{
  await db.prepare("INSERT OR IGNORE INTO saliyah_sim_employee_decisions(id,employee_id,service,application_id,decision,details) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),employee.id,category,rowId,decision,details).run();
  if(recipient)await db.prepare("INSERT INTO notifications(id,user_id,subject,body) VALUES(?,?,?,?)").bind(crypto.randomUUID(),recipient,subject,message).run();
 };
 if(civil){
  const rows=(await db.prepare("SELECT id,created_by,full_name,parent_name,birth_date FROM civil_intake WHERE status='recorded' AND length(trim(COALESCE(parent_name,'')))>=2 AND length(COALESCE(birth_date,''))=10 ORDER BY created_at LIMIT 15").all()).results;
  for(const row of rows)try{
   // Incomplete identity submissions stay for human clarification, never blindly approved.
   if(!validText(row.full_name,2,160)||!validText(row.parent_name,2,160)||!/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date||'')||!Number.isFinite(Date.parse(row.birth_date))||row.birth_date>today)continue;
   const note='اعتمده الموظف الآلي '+civil.name+' بعد فحص البيانات المسجلة';
   const done=await db.prepare("UPDATE civil_intake SET status='approved',review_note=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='recorded'").bind(note,row.id).run();
   if(done.meta.changes)await record(civil,'civil',row.id,'approved',note,row.created_by,'اعتماد طلب الأحوال','تم اعتماد طلب الأحوال المدنية بواسطة '+civil.name+' (موظف آلي)');
  }catch(error){console.error('sim_staff_civil_failed',row.id,String(error).slice(0,180))}
 }
 if(service){
  const rows=(await db.prepare("SELECT id,created_by,full_name,type,birth_date,expires_at,civil_intake_id FROM document_applications a WHERE a.status='pending' AND a.birth_date IS NOT NULL AND a.expires_at>=date('now') AND (a.type='residency' OR EXISTS(SELECT 1 FROM civil_intake c WHERE c.created_by=a.created_by AND c.status='approved' AND c.full_name=a.full_name AND (c.birth_date IS NULL OR c.birth_date=a.birth_date) AND (a.civil_intake_id IS NULL OR c.id=a.civil_intake_id))) ORDER BY a.created_at LIMIT 15").all()).results;
  for(const row of rows)try{
   if(!row.birth_date||!Number.isFinite(Date.parse(row.birth_date))||row.birth_date>today||row.expires_at<today)continue;
   if(row.type==='national_id'||row.type==='passport'){
    const civilRow=await db.prepare("SELECT id FROM civil_intake WHERE created_by=? AND full_name=? AND status='approved' AND (birth_date IS NULL OR birth_date=?) AND (? IS NULL OR id=?) LIMIT 1").bind(row.created_by,row.full_name,row.birth_date,row.civil_intake_id,row.civil_intake_id).first();
    if(!civilRow)continue;
   }
   const expiry14=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
   const month=new Date();month.setUTCMonth(month.getUTCMonth()+1);
   if(row.type==='passport'&&![expiry14,month.toISOString().slice(0,10)].includes(row.expires_at))continue;
   const documentId=crypto.randomUUID(), number='SAL-'+(row.type==='national_id'?'1':row.type==='residency'?'2':'P')+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,9).toUpperCase();
   const results=await db.batch([
    db.prepare("INSERT INTO documents(id,type,number,full_name,nationality,birth_date,birth_place,gender,father_name,mother_name,issued_at,expires_at,issuer,created_by,phone) SELECT ?,type,?,full_name,nationality,birth_date,birth_place,gender,father_name,mother_name,date('now'),CASE WHEN type='national_id' THEN date('now','+14 days') ELSE expires_at END,issuer,created_by,phone FROM document_applications WHERE id=? AND status='pending'").bind(documentId,number,row.id),
    db.prepare("UPDATE document_applications SET status='approved',document_id=?,decided_at=CURRENT_TIMESTAMP,expires_at=CASE WHEN type='national_id' THEN date('now','+14 days') ELSE expires_at END WHERE id=? AND status='pending'").bind(documentId,row.id)
   ]);
   if(results[1].meta.changes)await record(service,'document',row.id,'approved','وثيقة '+number,row.created_by,'صدور الوثيقة','أصدر الموظف الآلي '+service.name+' الوثيقة '+number);
  }catch(error){console.error('sim_staff_document_failed',row.id,String(error).slice(0,180))}
 }
 if(teacher){
  const rows=(await db.prepare("SELECT a.id,a.student_id,a.previous_grade,i.id institution_id,i.capacity,i.min_grade,i.level FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.status='submitted' AND i.active=1 ORDER BY a.created_at LIMIT 12").all()).results;
  for(const row of rows)try{
   const qualified=row.level==='primary'||(row.previous_grade!==null&&Number(row.previous_grade)>=Number(row.min_grade));
   let result,decision;
   if(qualified){
    result=await db.prepare("UPDATE education_applications SET status='accepted',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted' AND (SELECT COUNT(*) FROM education_applications WHERE institution_id=? AND status='accepted')<?").bind(row.id,row.institution_id,row.capacity).run();
    decision=result.meta.changes?'accepted':'rejected';
   }else decision='rejected';
   if(decision==='rejected')result=await db.prepare("UPDATE education_applications SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(row.id).run();
   if(result.meta.changes)await record(teacher,'education',row.id,decision,'تقييم الدرجة والسعة',row.student_id,'نتيجة طلب الدراسة',decision==='accepted'?'تم قبول طلب الدراسة بواسطة موظف آلي':'لم تُستوف شروط القبول أو السعة المتاحة');
  }catch(error){console.error('sim_staff_education_failed',row.id,String(error).slice(0,180))}
 }
 if(service){
  const jobs=await sharedRows(db,"SELECT a.id,a.applicant_id,j.id job_id FROM shared_service_applications a JOIN saliyah_sim_jobs j ON j.id=a.target_id JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE a.service='jobs' AND a.status='submitted' AND j.status='open' AND c.status='approved' AND c.founder_id IN (SELECT id FROM saliyah_sim_citizens) ORDER BY a.created_at LIMIT 12");
  for(const job of jobs)try{
   const res=await db.prepare("UPDATE shared_service_applications SET status='accepted' WHERE id=? AND status='submitted' AND NOT EXISTS(SELECT 1 FROM shared_service_applications WHERE service='jobs' AND target_id=? AND status='accepted' AND id<>?) AND NOT EXISTS(SELECT 1 FROM saliyah_sim_job_applications WHERE job_id=? AND status='hired')").bind(job.id,job.job_id,job.id,job.job_id).run();
   if(res.meta.changes){const contract=await ensureBotCompanyContract(db,job.id);await record(service,'jobs',job.id,'accepted',contract.ok?'أصدر عقد العمل':'قبول بانتظار استكمال العقد',job.applicant_id,'نتيجة طلب العمل',contract.ok?'تم قبولك وإصدار عقد العمل لدى الشركة الآلية':'تم قبول طلب التوظيف، وعقد العمل قيد المعالجة')}
   else{const rejected=await db.prepare("UPDATE shared_service_applications SET status='rejected' WHERE id=? AND status='submitted'").bind(job.id).run();if(rejected.meta.changes)await record(service,'jobs',job.id,'rejected','الوظيفة مشغولة',job.applicant_id,'نتيجة طلب العمل','تعذر قبول الطلب لأن الوظيفة مشغولة')}

  }catch(error){console.error('sim_staff_jobs_failed',job.id,String(error).slice(0,180))}
 }
}


const AIRPORT_CONSTRUCTION_END='2026-11-27T11:00:00Z';
const AIRPORT_STAFF_TARGETS=[
 ['atc','المراقبة الجوية',45],
 ['airport_ops','تشغيل المطار والبوابات',180],
 ['ground','الخدمات الأرضية والأمتعة',300],
 ['security','الأمن والسلامة والطوارئ',160],
 ['maintenance','الصيانة والهندسة',230],
 ['pilots','الطيارون',420],
 ['cabin','الضيافة الجوية',950],
 ['planning','العمليات والتخطيط',115],
 ['cargo','الشحن والمناولة',160]
];
const AIRPORT_ROUTE_SEEDS=[
 ['RUH','الرياض'],['JED','جدة'],['DOH','الدوحة'],['DXB','دبي'],['AUH','أبوظبي'],['KWI','الكويت'],['BAH','البحرين'],['MCT','مسقط'],['CAI','القاهرة'],['IST','إسطنبول'],['LHR','لندن هيثرو'],['NRT','طوكيو ناريتا'],['CDG','باريس'],['FRA','فرانكفورت']
];
const AIRPORT_FLEET=[
 ['saliyah-airlines','B777-300',10,'passenger'],['saliyah-airlines','B747-8',5,'passenger'],['saliyah-airlines','A330-300',15,'passenger'],['saliyah-airlines','A320',20,'passenger'],['saliyah-airlines','B777F',5,'cargo'],['saliyah-airlines','B747-8F',10,'cargo'],['flyadeal-saliyah','A320',25,'passenger']
];
async function airportStaffCoverage(db,aviationDb){
 const staff=(await aviationDb.prepare("SELECT category,COUNT(*) n FROM aviation_staff WHERE status='active' AND qualified=1 GROUP BY category").all()).results;
 const counts=new Map(staff.map(x=>[x.category,Number(x.n)||0]));
 return AIRPORT_STAFF_TARGETS.map(([category,label,required])=>({category,label,required,active:counts.get(category)||0,ready:(counts.get(category)||0)>=required}));
}
async function runSharedCompanySalaryPayments(db){
 const rows=(await db.prepare("SELECT c.id contract_id,c.created_at hired_at,c.employee_id,a.target_id job_id,j.salary,j.company_id,co.payroll_weeks,ca.id payer,ea.id payee FROM employment_contracts c JOIN shared_service_applications a ON a.id=c.application_id AND a.service='jobs' AND a.status='accepted' JOIN saliyah_sim_jobs j ON j.id=a.target_id JOIN saliyah_sim_companies co ON co.id=j.company_id AND co.status='approved' JOIN saliyah_sim_bank_accounts ca ON ca.owner_type='company' AND ca.owner_id=j.company_id AND ca.status='active' JOIN bank_accounts ea ON ea.id=(SELECT x.id FROM bank_accounts x WHERE x.user_id=c.employee_id ORDER BY CASE x.bank WHEN 'saliyah' THEN 0 ELSE 1 END LIMIT 1) WHERE c.active=1 AND j.salary>0 ORDER BY c.id LIMIT 25").all()).results;
 const now=new Date(),monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 for(const item of rows){
  const weeks=Number(item.payroll_weeks)===2?2:1;
  const amount=Number(item.salary)*weeks;
  if(!Number.isSafeInteger(amount)||amount<1)continue;
  for(let lag=3;lag>=1;lag--){
   const start=new Date(monday.getTime()-lag*7*86400000),period=start.toISOString().slice(0,10);
   if(Date.parse(String(item.hired_at).replace(' ','T')+'Z')>start.getTime())continue;
   if(weeks===2&&Math.floor(start.getTime()/604800000)%2!==0)continue;
   const leave=await db.prepare("SELECT 1 FROM employment_leave_requests WHERE contract_id=? AND kind='unpaid' AND status='approved' AND start_date<=date(?,'+'||?||' days') AND end_date>=? LIMIT 1").bind(item.contract_id,period,weeks*7-1,period).first();
   if(leave)continue;
   const id='salary-real-'+item.contract_id+'-'+period;
   if(await db.prepare('SELECT 1 FROM shared_company_salary_payments WHERE id=?').bind(id).first())continue;
   try{
    await db.prepare("INSERT OR IGNORE INTO shared_company_salary_payments(id,contract_id,company_id,company_account_id,employee_account_id,period_start,amount) VALUES(?,?,?,?,?,?,?)").bind(id,item.contract_id,item.company_id,item.payer,item.payee,period,amount).run();
   }catch(e){console.error('shared_company_salary_failed',String(e).slice(0,170));break}
  }
 }
}
async function reconcileEmployeeResignations(db){
 const requests=(await db.prepare("SELECT r.id,r.contract_id,r.employee_id,r.status,r.created_at,r.defer_until FROM employment_resignations r JOIN employment_contracts c ON c.id=r.contract_id AND c.employee_id=r.employee_id WHERE r.status IN ('submitted','deferred') AND c.active=1 AND (r.status='submitted' AND r.created_at<=datetime('now','-30 days') OR r.status='deferred' AND r.defer_until<=datetime('now')) LIMIT 30").all()).results;
 for(const r of requests){
  await db.batch([
   db.prepare("UPDATE employment_resignations SET status='accepted',resolved_at=CURRENT_TIMESTAMP,review_note=COALESCE(review_note,'انتهت مدة طلب الاستقالة') WHERE id=? AND status IN ('submitted','deferred')").bind(r.id),
   db.prepare("UPDATE employment_contracts SET active=0 WHERE id=? AND employee_id=? AND active=1").bind(r.contract_id,r.employee_id)
  ]);
 }
 return requests.length;
}
async function validateAviationPassenger(db,userId,travelDate){
 const banned=await db.prepare("SELECT 1 FROM enforcement_cases_v2 WHERE subject_user_id=? AND status='approved' AND action IN ('service_suspension','both') LIMIT 1").bind(userId).first();
 if(banned)return {error:'خدمات المسافر موقوفة، راجع الجهة المختصة قبل الحجز'};
 const passport=await db.prepare("SELECT d.id,d.number,d.full_name,d.expires_at FROM documents d WHERE d.created_by=? AND d.type='passport' AND d.status='valid' AND d.expires_at>=? ORDER BY d.expires_at DESC LIMIT 1").bind(userId,travelDate).first();
 if(!passport)return {error:'يلزم وجود جواز سفر صالح حتى تاريخ الرحلة'};
 const circular=await db.prepare("SELECT 1 FROM circulars WHERE document_id=? AND status='active' AND (expires_at IS NULL OR expires_at>=date('now')) LIMIT 1").bind(passport.id).first();
 if(circular)return {error:'يوجد تعميم نشط على الجواز، لا يمكن إتمام إجراءات السفر'};
 return {passport};
}
async function completeAviationBooking(db,aviationDb,bookingId,userId){
 const row=await aviationDb.prepare("SELECT b.id,b.reference,b.status,b.payment_status,b.price,b.flight_id,b.user_id,b.bank_account_id,f.airline_id,f.status flight_status FROM aviation_bookings b JOIN aviation_flights f ON f.id=b.flight_id WHERE b.id=? AND b.user_id=?").bind(bookingId,userId).first();
 if(!row)return {error:'الحجز غير موجود'};
 if(row.status==='confirmed'&&row.payment_status==='paid')return {ok:true,booking:row};
 if(row.status!=='pending'||!['unpaid','debited'].includes(row.payment_status))return {error:'الحجز غير متاح للإتمام'};
 if(row.flight_status!=='scheduled')return {error:'الرحلة لم تعد مجدولة'};
 const payment=await db.prepare("SELECT booking_id,status FROM aviation_payment_ledger WHERE booking_id=? AND user_id=?").bind(row.id,userId).first();
 if(!payment||payment.status==='refunded')return {error:'لم يتم خصم سعر التذكرة'};
 try{
  const done=await aviationDb.prepare("UPDATE aviation_bookings SET status='confirmed',payment_status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='pending' AND payment_status IN ('unpaid','debited')").bind(row.id,userId).run();
  if(done.meta.changes)await db.prepare("UPDATE aviation_payment_ledger SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status='debited'").bind(row.id).run();
  return {ok:true,booking:{...row,status:'confirmed',payment_status:'paid'}};
 }catch(e){console.error('aviation_booking_completion_failed',String(e).slice(0,180));return {error:'تم حفظ الدفع ولم يؤكد الحجز بعد؛ ستتم إعادة المحاولة تلقائياً'}};
}
const DAILY_AIR_ROUTES=[
 ['RUH',85,450,'saliyah-airlines'],['JED',105,399,'flyadeal-saliyah'],['DOH',80,490,'saliyah-airlines'],['DXB',120,520,'flyadeal-saliyah'],
 ['AUH',115,510,'saliyah-airlines'],['KWI',95,370,'flyadeal-saliyah'],['BAH',75,360,'flyadeal-saliyah'],['MCT',145,430,'saliyah-airlines'],
 ['CAI',180,650,'flyadeal-saliyah'],['IST',270,1100,'saliyah-airlines'],['LHR',415,2550,'saliyah-airlines'],['NRT',600,3550,'saliyah-airlines'],
 ['CDG',395,2400,'saliyah-airlines'],['FRA',375,2300,'saliyah-airlines']
];
async function ensureAviationRollingSchedule(aviationDb){
 if(!aviationDb)return;
 const key='last_daily_schedule_generated',today=new Date().toISOString().slice(0,10);
 const last=await aviationDb.prepare("SELECT value FROM aviation_settings WHERE key=?").bind(key).first();
 if(last?.value===today)return;
 const seed=new Date(Date.now()+86400000),min=new Date('2026-11-28T00:00:00Z');
 const start=new Date(Date.UTC(seed.getUTCFullYear(),seed.getUTCMonth(),seed.getUTCDate()));
 if(start<min)start.setTime(min.getTime());
 for(let day=0;day<7;day++){
  const d=new Date(start.getTime()+day*86400000),date=d.toISOString().slice(0,10),stmts=[];
  for(let i=0;i<DAILY_AIR_ROUTES.length;i++){
   const [destination,minutes,price,airline]=DAILY_AIR_ROUTES[i],prefix=airline==='flyadeal-saliyah'?'FS':'SY';
   const eco=prefix==='FS'?180:destination==='NRT'?310:280,business=prefix==='FS'?0:destination==='NRT'?50:30;
   const outbound=new Date(d.getTime()+ (3*60+i*50)*60000),arrival=new Date(outbound.getTime()+minutes*60000);
   const back=new Date(arrival.getTime()+120*60000),returnArrival=new Date(back.getTime()+minutes*60000);
   const fmt=x=>x.toISOString().replace('T',' ').slice(0,19);
   for(const [leg,origin,finish,depart,land,number] of [
    ['out','SJD',destination,outbound,arrival,prefix+(101+i)],
    ['return',destination,'SJD',back,returnArrival,prefix+(301+i)]
   ]){
    const id='airport-'+date+'-'+destination+'-'+leg;
    stmts.push(aviationDb.prepare("INSERT OR IGNORE INTO aviation_flights(id,airline_id,number,origin_code,destination_code,departure_at,arrival_at,price_economy,seats_economy,seats_business,status) VALUES(?,?,?,?,?,?,?,?,?,?,'scheduled')").bind(id,airline,number,origin,finish,fmt(depart),fmt(land),price,eco,business));
   }
  }
  if(stmts.length)await aviationDb.batch(stmts);
 }
 await aviationDb.prepare("INSERT INTO aviation_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,today).run();
}
async function reconcileAviationCancelledFlights(db,aviationDb){
 if(!aviationDb)return;
 const cancelled=(await aviationDb.prepare("SELECT b.id,b.user_id,b.status,b.payment_status FROM aviation_bookings b JOIN aviation_flights f ON f.id=b.flight_id WHERE f.status='cancelled' AND b.status IN ('pending','confirmed') ORDER BY b.created_at LIMIT 25").all()).results;
 for(const b of cancelled)try{
  const ledger=await db.prepare('SELECT status FROM aviation_payment_ledger WHERE booking_id=? AND user_id=?').bind(b.id,b.user_id).first();
  if(ledger&&ledger.status!=='refunded'){
   await db.prepare("UPDATE aviation_payment_ledger SET status='refunded',refunded_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status IN ('debited','confirmed')").bind(b.id).run();
  }
  await aviationDb.prepare("UPDATE aviation_bookings SET status='cancelled',payment_status=CASE WHEN payment_status IN ('debited','paid') THEN 'refunded' ELSE payment_status END WHERE id=? AND status IN ('pending','confirmed')").bind(b.id).run();
 }catch(e){console.error('aviation_cancelled_refund_failed',String(e).slice(0,180))}
}
async function reconcileAviationPayments(db,aviationDb){
 if(!aviationDb)return;
 const ledgers=(await db.prepare("SELECT booking_id,user_id FROM aviation_payment_ledger WHERE status='debited' ORDER BY created_at LIMIT 15").all()).results;
 for(const ledger of ledgers)try{
  const row=await aviationDb.prepare("SELECT id,status,flight_id FROM aviation_bookings WHERE id=?").bind(ledger.booking_id).first();
  if(row?.status==='confirmed'){await db.prepare("UPDATE aviation_payment_ledger SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status='debited'").bind(ledger.booking_id).run();continue}
  if(row?.status==='pending'){const flight=await aviationDb.prepare('SELECT status FROM aviation_flights WHERE id=?').bind(row.flight_id).first();if(flight?.status==='cancelled'){await aviationDb.prepare("UPDATE aviation_bookings SET status='cancelled' WHERE id=? AND status='pending'").bind(row.id).run()}else{const done=await completeAviationBooking(db,aviationDb,ledger.booking_id,ledger.user_id);if(done.ok)continue}}
  if(!row||row.status==='cancelled'){await db.prepare("UPDATE aviation_payment_ledger SET status='refunded',refunded_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status='debited'").bind(ledger.booking_id).run()}
 }catch(e){console.error('aviation_payment_reconciliation_failed',String(e).slice(0,180))}
 const pending=(await aviationDb.prepare("SELECT id FROM aviation_bookings WHERE status='pending' AND created_at<datetime('now','-20 minutes') ORDER BY created_at LIMIT 30").all()).results;
 for(const b of pending)try{
  const paid=await db.prepare("SELECT status FROM aviation_payment_ledger WHERE booking_id=?").bind(b.id).first();
  if(!paid)await aviationDb.prepare("UPDATE aviation_bookings SET status='cancelled' WHERE id=? AND status='pending'").bind(b.id).run();
 }catch(e){console.error('aviation_pending_release_failed',String(e).slice(0,180))}
}
async function airportReadiness(db,aviationDb){
 if(!aviationDb)return {ready:false,reason:'قاعدة الطيران غير متصلة',checks:[]};
 const [setting,staff,flights,bookings,boarding,completedFlights,activeAirlines]=await Promise.all([
  aviationDb.prepare("SELECT value FROM aviation_settings WHERE key='opening_authorized'").first(),
  aviationDb.prepare("SELECT category,COUNT(*) n FROM aviation_staff WHERE status='active' AND qualified=1 GROUP BY category").all(),
  aviationDb.prepare("SELECT COUNT(*) n FROM aviation_flights WHERE status='scheduled' AND departure_at>datetime('now')").first(),
  aviationDb.prepare("SELECT COUNT(*) n FROM aviation_bookings WHERE status='confirmed'").first(),
  aviationDb.prepare("SELECT COUNT(*) n FROM aviation_boarding_passes").first(),
  aviationDb.prepare("SELECT COUNT(*) n FROM aviation_flights WHERE status='completed'").first(),
  aviationDb.prepare("SELECT COUNT(*) n FROM aviation_airlines WHERE enabled=1").first()
 ]);
 const counts=new Map(staff.results.map(x=>[x.category,Number(x.n)||0]));
 const staffing=AIRPORT_STAFF_TARGETS.map(([category,label,required])=>({category,label,required,active:counts.get(category)||0,ready:(counts.get(category)||0)>=required}));
 const constructionComplete=Date.now()>=Date.parse(AIRPORT_CONSTRUCTION_END);
 const staffComplete=staffing.every(x=>x.ready);
 const kingAuthorized=setting?.value==='1';
 const airlineReady=Number(activeAirlines?.n||0)>=2;
 const flightReady=Number(flights?.n||0)>0;
 const bookingOperationsReady=Number((await aviationDb.prepare("SELECT COUNT(*) n FROM aviation_settings WHERE key='operations_validated' AND value='1'").first())?.n||0)===1;
 return {ready:constructionComplete&&staffComplete&&kingAuthorized&&airlineReady&&flightReady&&bookingOperationsReady,booking_operations_ready:bookingOperationsReady,construction_complete:constructionComplete,construction_end:AIRPORT_CONSTRUCTION_END,staffing,staff_complete:staffComplete,royal_authorization:kingAuthorized,airlines_ready:airlineReady,scheduled_flights:Number(flights?.n||0),confirmed_bookings:Number(bookings?.n||0),boarding_passes:Number(boarding?.n||0),completed_flights:Number(completedFlights?.n||0),reason:constructionComplete?'التشغيل مشروط بالتوظيف والاعتماد والرحلات المجدولة':'البناء لم يكتمل بعد'};
}
async function seedAviationCatalog(db){
 // Only prepare the two fictional carriers; never open the airport or manufacture reservations.
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO aviation_airlines(id,name,code,kind,enabled) VALUES('saliyah-airlines','الخطوط الصالية','SY','full_service',1)"),
  db.prepare("INSERT OR IGNORE INTO aviation_airlines(id,name,code,kind,enabled) VALUES('flyadeal-saliyah','فلاي أديل الصالية','FS','low_cost',1)"),
  db.prepare("INSERT OR IGNORE INTO aviation_settings(key,value) VALUES('opening_authorized','0')")
 ]);
}

// Latest static UI is served by the Worker until the platform static-assets upload pipeline can be refreshed.
// Keep the canonical public/app.js and public/airport.html sources in sync when regenerating these literals.
const LIVE_PORTAL_APP_SOURCE="\nconst royalBotServices=[\"education\",\"banking\",\"bank-admin\",\"civil\",\"registry\",\"family-cards\",\"commerce\",\"company-treasury\",\"company-staff\",\"jobs\",\"jobs-admin\",\"payroll\",\"courts\",\"security\",\"borders\",\"land\",\"state-budgets\",\"telecom\",\"pos\",\"absher\",\"health\",\"municipality\",\"installments\"];\nfunction attachRoyalBotRecords(){\n if(me?.role!=='king')return;\n const service=(location.hash||'').slice(2).split(/[/?]/)[0];\n if(!royalBotServices.includes(service))return;\n const root=document.querySelector('.wrap.page');if(!root||root.querySelector('#royalBotRecords'))return;\n const panel=document.createElement('section');panel.id='royalBotRecords';panel.className='card';panel.innerHTML='<h2>سجلات البوتات في هذه الخدمة 🤖</h2><p>السجلات الفعلية للمحاكاة، دون تشغيل البوتات.</p><button class=\"btn gold\" id=\"loadRoyalBots\">عرض السجلات</button><div id=\"royalBotData\"></div>';root.append(panel);\n let group=0,offset=0;\n async function load(){const box=panel.querySelector('#royalBotData');box.textContent='جارٍ التحميل…';try{const r=await api('/admin/service-bots?service='+encodeURIComponent(service)+'&group='+group+'&offset='+offset);if(!panel.isConnected)return;box.innerHTML='<div class=\"actions\">'+r.groups.map((g,i)=>'<button class=\"btn outline\" data-bot-group=\"'+i+'\">'+safe(g)+'</button>').join('')+'</div>'+ (r.unavailable?'<p>جدول المحاكاة غير مهيأ.</p>':r.rows.length?r.rows.map(x=>'<article class=\"card\">'+Object.entries(x).filter(([k])=>!k.endsWith('_name')||!Object.hasOwn(x,k.slice(0,-5))).map(([k,v])=>'<div><b>'+safe(k)+':</b> '+safe(royalBotValue(x,k))+'</div>').join('')+'</article>').join(''):'<p>لا توجد سجلات محفوظة لهذا القسم.</p>')+'<div class=\"actions\">'+(offset?'<button class=\"btn outline\" id=\"botPrev\">السابق</button>':'')+(r.more?'<button class=\"btn outline\" id=\"botNext\">التالي</button>':'')+'</div>';box.querySelectorAll('[data-bot-group]').forEach(el=>el.onclick=()=>{group=Number(el.dataset.botGroup);offset=0;load()});const prev=box.querySelector('#botPrev'),next=box.querySelector('#botNext');if(prev)prev.onclick=()=>{offset=Math.max(0,offset-25);load()};if(next)next.onclick=()=>{offset+=25;load()}}catch(e){box.textContent=e.message}}\n panel.querySelector('#loadRoyalBots').onclick=load;\n}\nconst app=document.querySelector('#app');let data=null,me=null;\n\n// Non-blocking, accessible confirmation and prompt controls; native JS dialogs can be\n// suppressed in iOS/webview contexts and make otherwise working buttons appear inert.\nfunction uiQuestion(message,{input=false,initial=''}={}){\n return new Promise(resolve=>{\n  const shade=document.createElement('div');\n  shade.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;touch-action:manipulation';\n  const panel=document.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');\n  panel.style.cssText='width:min(460px,100%);box-sizing:border-box;background:#14263f;color:#fff;border:1px solid #c2aa75;border-radius:16px;padding:22px;box-shadow:0 14px 70px #0008;display:grid;gap:14px';\n  const title=document.createElement('strong');title.textContent=input?'إدخال البيانات':'تأكيد الإجراء';panel.append(title);\n  const p=document.createElement('p');p.textContent=String(message||'');p.style.margin='0';panel.append(p);\n  let field=null;\n  if(input){field=document.createElement('textarea');field.className='input';field.rows=3;field.value=String(initial??'');field.setAttribute('aria-label',String(message||'الإجابة'));field.style.cssText='width:100%;box-sizing:border-box;min-height:82px;background:#fff;color:#111;padding:10px;border-radius:8px';panel.append(field)}\n  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap';\n  const ok=document.createElement('button');ok.type='button';ok.className='btn gold';ok.textContent=input?'اعتماد':'تأكيد';\n  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn outline';cancel.textContent='إلغاء';\n  actions.append(ok,cancel);panel.append(actions);shade.append(panel);document.body.append(shade);\n  const previous=document.activeElement;\n  const finish=result=>{document.removeEventListener('keydown',key);shade.remove();if(previous?.isConnected)previous.focus?.();resolve(result)};\n  const key=e=>{if(e.key==='Escape'){e.preventDefault();finish(input?null:false)}else if(e.key==='Enter'&&(!input||e.ctrlKey)){e.preventDefault();finish(input?field.value:true)}};\n  document.addEventListener('keydown',key);\n  ok.addEventListener('click',()=>finish(input?field.value:true));\n  cancel.addEventListener('click',()=>finish(input?null:false));\n  shade.addEventListener('click',e=>{if(e.target===shade)finish(input?null:false)});\n  (field||ok).focus();\n });\n}\nconst uiConfirm=message=>uiQuestion(message);\nconst uiPrompt=(message,initial='')=>uiQuestion(message,{input:true,initial});\nfunction uiNotice(message){\n let host=document.getElementById('portal-notices');\n if(!host){host=document.createElement('div');host.id='portal-notices';host.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;z-index:2147483001;display:grid;gap:8px;pointer-events:none;justify-content:center';document.body.append(host)}\n const item=document.createElement('div');item.setAttribute('role','status');item.style.cssText='pointer-events:auto;color:#fff;background:#20416a;border:1px solid #c2aa75;border-radius:10px;padding:12px 16px;box-shadow:0 6px 24px #0008;max-width:500px';item.textContent=String(message);host.append(item);setTimeout(()=>item.remove(),6500);\n}\n\nfunction royalBotValue(row,key){return row[key+'_name']||row[key]}\nconst safe=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nasync function api(path,opts={}){const res=await fetch('/api'+path,{credentials:'same-origin',headers:{'content-type':'application/json'},...opts});const val=await res.json();if(!res.ok)throw Error((val.error||'تعذر تنفيذ الطلب')+(val.stage?' ('+val.stage+(val.code?' / '+val.code:'')+')':''));return val}\nconst post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});\nconst services=[[\"إكس الصالية\",\"شبكة التواصل الاجتماعي للمملكة\",\"𝕏\",\"x\"],[\"الهوية والإقامة والجوازات\",\"طلبات الإصدار والاعتماد والتحقق والتعاميم\",\"🪪\",\"registry\"],[\"الأحوال المدنية\",\"تسجيل طلبات المواطنين\",\"♧\",\"civil\"],[\"الجوال والاتصالات\",\"خدمات الهاتف والشرائح الرقمية\",\"📱\",\"telecom\"],[\"أبشر الصالية\",\"المركبات والخدمات الوطنية وطلبات التسجيل\",\"🛡️\",\"absher\"],[\"الخدمات البنكية\",\"الحسابات والتحويلات\",\"🏦\",\"banking\"],[\"دليل سكان ومنشآت الصالية\",\"الوصول للمواطنين الآليين وشركاتهم ومدارسهم وممتلكاتهم\",\"🤖\",\"sim-directory\"],[\"السوق المالي والعقاري الصالي\",\"تداول أسهم الشركات الافتراضية وشراء العقارات من البوتات\",\"📈\",\"sim-market\"],[\"البطاقات والصرافات\",\"البطاقات وأجهزة الصرف\",\"💳\",\"cards-atm\"],[\"نقاط البيع\",\"عمليات الدفع لدى المتاجر\",\"▣\",\"pos\"],[\"التقسيط\",\"تابي وتمارا الصالية\",\"◈\",\"installments\"],[\"المنافذ الحدودية\",\"فحص الوثائق وحركة الدخول والخروج\",\"✈️\",\"borders\"],[\"الطلبات الحكومية\",\"تقديم ومتابعة الطلبات\",\"📋\",\"requests\"],[\"الرسائل الحكومية\",\"البريد الداخلي\",\"✉️\",\"messages\"],[\"البلاغات والأمن\",\"الخدمات الأمنية\",\"🛡️\",\"security\"],[\"القضاء والمحاكم\",\"خدمات القضاء\",\"⚖️\",\"courts\"],[\"التعليم\",\"خدمات التعليم\",\"📚\",\"education\"],[\"الصحة\",\"الخدمات الصحية\",\"🏥\",\"health\"],[\"البلديات\",\"الخدمات البلدية\",\"🏙️\",\"municipality\"],[\"عقاراتي وسندات الملكية\",\"العقارات التي اشتريتها وتفاصيل الملكية\",\"🏡\",\"my-properties\"],[\"العقارات والأراضي\",\"خدمات الأراضي\",\"🏠\",\"land\"],[\"التجارة\",\"السجلات والخدمات التجارية\",\"🏬\",\"commerce\"],[\"الفروع التجارية\",\"إدارة الفروع\",\"🏪\",\"commerce-branches\"],[\"التوظيف\",\"الوظائف والتقديم\",\"💼\",\"jobs\"],[\"خدمات الموظفين\",\"الموظفون والصلاحيات\",\"👥\",\"staff\"],[\"رواتب الموظفين\",\"إدارة الرواتب\",\"💰\",\"payroll\"],[\"خزائن الشركات\",\"الحسابات المالية للشركات\",\"▤\",\"company-treasury\"],[\"موظفو الشركات\",\"إدارة موظفي الشركات\",\"♙\",\"company-staff\"],[\"ميزانيات الدولة\",\"إدارة الميزانيات\",\"📊\",\"state-budgets\"],[\"الإعلانات والقرارات\",\"الأخبار والقرارات الرسمية\",\"📰\",\"news\"],[\"مكتب الخدمات\",\"خدمة المراجعين\",\"🎫\",\"service-desk\"]];\nconst govColors=['#0e4d3a','#7a3a1a','#2b5b6b'];\nfunction hero(){return `<section class=\"hero\"><div class=\"wrap heroInner\"><div><div class=\"eyebrow\">بوابة حكومية موحدة · عربية أصيلة</div><h1>مرحبًا بكم في بوابة دولة المملكة العربية الصالية</h1><p>منصة موحدة للخدمات الحكومية والجهات الرسمية والقطاع الخاص والخدمات الرقمية.</p><form id=\"searchForm\" class=\"search\"><input id=\"searchBox\" aria-label=\"البحث\" placeholder=\"ابحث عن خدمة أو وزارة أو محافظة…\" required><button class=\"btn\" type=\"submit\">بحث</button></form><div class=\"actions\"><a class=\"btn gold\" href=\"#/services\">الدخول إلى الخدمات</a><a class=\"btn\" href=\"#/ministries\">استعراض الجهات الحكومية</a>${me?.role==='king'?'<a class=\"btn gold\" href=\"/simulation.html\">👑 مرصد المملكة</a>':''}</div></div><div class=\"ornament\" aria-hidden=\"true\">◇</div></div></section>`}\nfunction govCards(){return `<div class=\"grid\">${data.governorates.map((g,i)=>`<a class=\"card govCard link\" href=\"#/gov/${safe(g.id)}\"><div class=\"govTop k\" style=\"background:${govColors[i]}\">${safe(g.name)}</div><div class=\"body\"><b>${safe(g.description)}</b><div class=\"muted\">المحافظ: ${safe(g.governor)}</div></div></a>`).join('')}</div>`}\nfunction ministryCards(items=data.ministries){return `<div class=\"directory\">${items.map(m=>`<a href=\"#/ministry/${m.id}\"><b>${safe(m.name)}</b><small>${safe(m.minister)}</small></a>`).join('')}</div>`}\nfunction newsCards(){return data.news.length?`<div class=\"grid\">${data.news.map(n=>`<article class=\"card\"><div class=\"tag\">${({news:'خبر',decree:'قرار ملكي',circular:'تعميم'})[n.kind]}</div><h3>${safe(n.title)}</h3><div class=\"muted\">${safe(n.created_at)}</div><p class=\"article\">${safe(n.body)}</p></article>`).join('')}</div>`:'<div class=\"empty\">لا توجد أخبار أو قرارات منشورة حتى الآن.</div>'}\n\n\nconst alertLevels={info:'عادي',warning:'مهم',urgent:'طارئ'};\nconst alertTargets={all:'جميع المحافظات',sajjadah:'السجادة',mutajjar:'المتجار',aqar:'عقار'};\nasync function loadNationalAlert(){const el=document.querySelector('#nationalAlertBanner');if(!el)return;try{const {alerts}=await api('/national-alert');if(!el.isConnected)return;el.innerHTML=alerts.length?alerts.map(x=>'<article style=\"border-inline-start:5px solid '+({info:'#2563eb',warning:'#d97706',urgent:'#dc2626'}[x.severity]||'#2563eb')+';padding:12px\"><b>تنبيه وطني · '+safe(alertLevels[x.severity])+' · '+safe(alertTargets[x.target])+' (محاكاة)</b><h3>'+safe(x.title)+'</h3><p style=\"white-space:pre-wrap\">'+safe(x.body)+'</p></article>').join(''):'<b>تنبيه وطني:</b> لا يوجد تنبيه نشط حاليًا.'}catch(e){el.textContent='تعذر التحقق من التنبيهات الوطنية.'}}\nasync function nationalAlertPage(editId){\n if(me?.role!=='king'){page('غير مخول','هذا القسم مخصص للملك.');return}\n const {alerts}=await api('/national-alert?history=1');\n const active=x=>!x.cancelled&&x.expires_at>Date.now();\n const alert=alerts.find(x=>x.id===editId&&active(x));\n const options=(obj,selected)=>Object.entries(obj).map(([k,v])=>'<option value=\"'+k+'\" '+(selected===k?'selected':'')+'>'+v+'</option>').join('');\n page('إدارة التنبيه الوطني',`<section class=\"card\"><p>تنبيهات المملكة الافتراضية. يمكنك إلغاء التنبيه أو حذفه نهائياً من السجل حتى بعد انتهاء صلاحيته. الحذف النهائي لا يمكن التراجع عنه.</p><form id=\"nationalAlertForm\"><label>العنوان<input name=\"title\" required maxlength=\"160\" value=\"${safe(alert?.title||'')}\"></label><label>نص التنبيه<textarea name=\"body\" required maxlength=\"3000\">${safe(alert?.body||'')}</textarea></label><label>المحافظة<select name=\"target\">${options(alertTargets,alert?.target||'all')}</select></label><label>المستوى<select name=\"severity\">${options(alertLevels,alert?.severity||'info')}</select></label><label>المدة بالساعات (1–168)<input name=\"hours\" type=\"number\" min=\"1\" max=\"168\" required value=\"${alert?Math.max(1,Math.ceil((alert.expires_at-Date.now())/3600000)):24}\"></label><div class=\"actions\"><button class=\"btn gold\" type=\"submit\">${alert?'حفظ التعديل':'نشر التنبيه'}</button><button class=\"btn outline\" type=\"button\" id=\"newNationalAlert\">تنبيه جديد</button></div><p id=\"nationalAlertStatus\" role=\"status\" aria-live=\"polite\"></p></form></section><section class=\"section\" id=\"nationalAlertHistory\"><h2>سجل التنبيهات (آخر 100)</h2><p id=\"nationalAlertActionStatus\" role=\"status\" aria-live=\"assertive\"></p>${alerts.map(x=>'<article class=\"card\"><h3>'+safe(x.title)+'</h3><p>'+safe(x.body)+'</p><p>'+safe(alertTargets[x.target])+' · '+safe(alertLevels[x.severity])+' · '+(x.cancelled?'ملغى':active(x)?'نشط':'منتهي')+'</p><p>ينتهي: '+safe(new Date(x.expires_at).toLocaleString('ar-SA'))+'</p><div class=\"actions\">'+(active(x)?'<button type=\"button\" class=\"btn outline\" data-edit-alert=\"'+safe(x.id)+'\">تعديل</button> ':'')+(!x.cancelled?'<button type=\"button\" class=\"btn outline\" data-cancel-alert=\"'+safe(x.id)+'\">إلغاء</button> ':'')+'<button type=\"button\" class=\"btn outline\" data-delete-alert=\"'+safe(x.id)+'\">حذف نهائي</button></div></article>').join('')||'<p>لا توجد تنبيهات سابقة.</p>'}</section>`);\n const form=document.querySelector('#nationalAlertForm');\n const history=document.querySelector('#nationalAlertHistory');\n let busy=false;\n function message(text){const el=document.querySelector('#nationalAlertActionStatus')||document.querySelector('#nationalAlertStatus');if(el)el.textContent=text}\n async function save(body){\n  if(busy)return;\n  busy=true;\n  const button=[...document.querySelectorAll('[data-delete-alert],[data-cancel-alert]')].find(el=>(el.dataset.deleteAlert||el.dataset.cancelAlert)===body.id);\n  if(button)button.disabled=true;\n  message('جارٍ تنفيذ الطلب…');\n  try{\n   await post('/national-alert',body);\n   await nationalAlertPage();\n   message(body.action==='delete'?'تم حذف التنبيه نهائياً.':body.action==='cancel'?'تم إلغاء التنبيه.':'تم حفظ التنبيه بنجاح.');\n  }catch(error){message('تعذر تنفيذ العملية: '+error.message);if(button)button.disabled=false}\n  finally{busy=false}\n }\n form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);save({action:'publish',id:alert?.id,title:f.get('title'),body:f.get('body'),target:f.get('target'),severity:f.get('severity'),hours:Number(f.get('hours'))})};\n document.querySelector('#newNationalAlert').onclick=()=>nationalAlertPage();\n history.addEventListener('click',async e=>{\n  const target=(e.target instanceof Element?e.target:e.target?.parentElement)?.closest('button[data-edit-alert],button[data-cancel-alert],button[data-delete-alert],button[data-confirm-alert],button[data-dismiss-alert]');\n  if(!target||busy)return;\n  if(target.dataset.editAlert){await nationalAlertPage(target.dataset.editAlert);return}\n  if(target.dataset.dismissAlert!==undefined){const pending=history.querySelector('#nationalAlertPending');if(pending)pending.remove();message('تم التراجع عن العملية.');return}\n  if(target.dataset.confirmAlert!==undefined){\n   const id=target.dataset.confirmAlert,action=target.dataset.action;\n   if(!id||!['delete','cancel'].includes(action))return;\n   const pending=history.querySelector('#nationalAlertPending');\n   if(pending)pending.remove();\n   await save({action,id});\n   return;\n  }\n  const action=target.dataset.deleteAlert!==undefined?'delete':'cancel';\n  const id=action==='delete'?target.dataset.deleteAlert:target.dataset.cancelAlert;\n  const old=history.querySelector('#nationalAlertPending');if(old)old.remove();\n  const panel=document.createElement('div');\n  panel.id='nationalAlertPending';\n  panel.className='card';\n  panel.setAttribute('role','group');\n  panel.innerHTML='<p><strong>'+(action==='delete'?'تأكيد الحذف النهائي':'تأكيد إلغاء التنبيه')+'</strong></p><p>'+(action==='delete'?'سيُحذف التنبيه من السجل نهائياً.':'سيُلغى التنبيه ولن يظهر كتنبيه نشط.')+'</p><div class=\"actions\"><button type=\"button\" class=\"btn gold\" data-confirm-alert=\"'+safe(id)+'\" data-action=\"'+action+'\">تأكيد العملية</button><button type=\"button\" class=\"btn outline\" data-dismiss-alert=\"\">تراجع</button></div>';\n  target.closest('article').insertAdjacentElement('afterend',panel);\n  panel.querySelector('[data-confirm-alert]').focus();\n  message('اختر تأكيد العملية أو تراجع.');\n });\n}\n\nfunction home(){app.innerHTML=hero()+`<div class=\"wrap\"><div class=\"notice\" id=\"nationalAlertBanner\" role=\"status\">جارٍ التحقق من التنبيهات الوطنية…</div>${me?.role==='king'?'<section class=\"section\"><h2>👑 مرصد المملكة العربية الصالية</h2><p class=\"muted\">لوحة الملك الخاصة.</p><a class=\"btn gold\" href=\"/simulation.html\">فتح مرصد المملكة</a> <a class=\"btn gold\" href=\"#/national-alert\">إدارة التنبيه الوطني</a></section>':''}<section class=\"section\" id=\"services\"><h2>خدمات مختارة</h2><div class=\"muted\">الخدمات المرتبطة بالسجل الرسمي للمستخدم</div>${serviceCards(services.slice(0,6))}<p><a class=\"btn outline\" href=\"#/services\">عرض جميع الخدمات</a></p></section><section class=\"section\"><h2>استكشف المحافظات</h2>${govCards()}</section><section class=\"section\"><h2>الوزارات والهيئات</h2><div class=\"muted\">35 وزارة · هيئة الطيران المدني تحت إشراف الملك المباشر</div>${ministryCards(data.ministries.slice(0,9))}<div class=\"actions\"><a class=\"btn outline\" href=\"#/ministries\">عرض دليل الجهات كاملًا</a></div></section><section class=\"section\"><h2>البنوك</h2><p class=\"muted\">حسابات وتحويلات داخلية بالريال الصالي.</p><a class=\"btn outline\" href=\"#/banking\">دخول البنوك</a> <a class=\"btn outline\" href=\"#/cards-atm\">البطاقات والصرافات</a> <a class=\"btn outline\" href=\"#/pos\">نقاط البيع</a> <a class=\"btn outline\" href=\"#/installments\">تابي وتمارا الصالية</a></section><section class=\"section\"><h2>التوظيف</h2><p class=\"muted\">استعرض الوظائف الحكومية والخاصة والعسكرية وتابع طلباتك.</p><a class=\"btn outline\" href=\"#/jobs\">بوابة التوظيف</a></section><section class=\"section\"><h2>الأخبار والقرارات</h2>${newsCards()}</section><section class=\"section\"><h2>مؤشرات الدولة</h2><div class=\"muted\">تظهر البيانات الحقيقية عند اكتمال ربط الأنظمة.</div><div class=\"grid\">${['المواطنون','المقيمون','الطلبات المنجزة'].map(x=>`<div class=\"card\"><div class=\"muted\">${x}</div><h2>—</h2></div>`).join('')}</div></section></div>`;document.querySelector('#searchForm').onsubmit=e=>{e.preventDefault();location.hash='#/ministries?q='+encodeURIComponent(document.querySelector('#searchBox').value)}}\nfunction serviceCards(items=services){return `<div class=\"grid\">${items.map(([n,d,i,route])=>`<a class=\"card link\" href=\"#/${route}\"><div class=\"icon\">${i}</div><h3>${safe(n)}</h3><div class=\"muted\">${safe(d)}</div></a>`).join('')}</div>`}\nfunction page(title,body){app.onclick=null;app.onsubmit=null;app.innerHTML=`<div class=\"wrap page\"><a class=\"muted\" href=\"#/\">الرئيسية</a><h1>${title}</h1>${body}</div>`;attachRoyalBotRecords()}\nfunction showMinistries(query=''){page('دليل الوزارات والهيئات',`<label class=\"field\"><span>بحث عن وزارة أو وزير</span><input class=\"input\" id=\"filter\" value=\"${safe(query)}\" placeholder=\"اكتب اسم الوزارة أو الوزير\"></label><div id=\"results\">${ministryCards(data.ministries.filter(m=>(m.name+m.minister).includes(query)))}</div><p class=\"muted\">هيئة الطيران المدني تحت الإشراف المباشر للملك.</p>`);document.querySelector('#filter').oninput=e=>{const q=e.target.value;document.querySelector('#results').innerHTML=ministryCards(data.ministries.filter(m=>(m.name+m.minister).includes(q)))}}\nasync function citizenProfile(){if(!me){location.hash='#/login';return}const r=await api('/citizen/profile');if(!r.profile){page('ملفي كمواطن','لا يوجد ملف مواطن مرتبط بهذا الحساب');return}page('ملفي كمواطن','<div class=\"card\"><p>الاسم: '+safe(r.profile.full_name)+'</p><p>رقم الهوية: '+safe(r.profile.number)+'</p><form id=\"citizenPhone\" class=\"form\"><label class=\"field\">رقم الجوال (اختياري)<input class=\"input\" name=\"phone\" type=\"tel\" value=\"'+safe(r.profile.phone||'')+'\"></label><button class=\"btn\">حفظ رقم الجوال</button><p role=\"status\"></p></form></div>');document.querySelector('#citizenPhone').onsubmit=async e=>{e.preventDefault();try{await post('/citizen/profile/phone',{phone:new FormData(e.target).get('phone')});e.target.querySelector('[role=status]').textContent='تم حفظ رقم الجوال'}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\nasync function ministryOffice(){\n if(!me){location.hash='#/login';return}\n try{\n  const available=await api('/ministry-office/ministries');\n  const ministries=available.ministries||[];\n  if(!ministries.length){page('مكتب الوزير','لا توجد وزارات مرتبطة بهذا الحساب');return}\n  const records=await Promise.all(ministries.map(m=>api('/ministry-office/actions?ministry_id='+m.id)));\n  const sections=ministries.map((m,i)=>{\n   const actions=records[i].actions||[];\n   return '<section class=\"card\"><h2>'+safe(m.name)+'</h2><p>الوزير: '+safe(m.minister)+'</p><form class=\"form ministry-action-form\" data-ministry-id=\"'+m.id+'\"><label class=\"field\">موضوع المعاملة<input class=\"input\" name=\"subject\" required minlength=\"3\"></label><label class=\"field\">التفاصيل<textarea class=\"input\" name=\"details\" rows=\"4\"></textarea></label><label class=\"field\">الحالة<select class=\"input\" name=\"status\"><option value=\"draft\">مسودة</option><option value=\"submitted\">رفع للمراجعة</option></select></label><button class=\"btn gold\">حفظ معاملة '+safe(m.name)+'</button><p role=\"status\"></p></form><h3>معاملات الوزارة</h3>'+(actions.length?actions.map(x=>'<div class=\"card\"><b>'+safe(x.subject)+'</b><p>'+safe(x.details)+'</p><small>'+safe(x.status)+'</small></div>').join(''):'<p>لا توجد معاملات حتى الآن</p>')+'</section>';\n  }).join('');\n  page('مكتب الوزير','<div class=\"notice\">وزاراتك المسجلة تظهر تلقائيًا عند الدخول، وعددها '+ministries.length+'. كل وزارة مستقلة بمعاملاتها وصلاحياتها.</div>'+sections);\n  document.querySelectorAll('.ministry-action-form').forEach(form=>{form.onsubmit=async e=>{e.preventDefault();try{await post('/ministry-office/actions',{...Object.fromEntries(new FormData(form)),ministry_id:Number(form.dataset.ministryId)});await ministryOffice()}catch(err){form.querySelector('[role=status]').textContent=err.message}}});\n }catch(err){page('مكتب الوزير','<div class=\"notice\">'+safe(err.message)+'</div>')}\n}\nasync function ministryAccounts(){\n if(me?.role!=='king'){page('غير مخول','للملك فقط');return}\n try{\n const [roster,accounts]=await Promise.all([api('/admin/ministries/roster'),api('/ministries/accounts')]);\n page('حسابات الوزارات',`<div class=\"notice\">اختر الوزير، وستظهر وزاراته المسجلة تلقائيًا. ضع كلمة مرور خاصة به ثم أنشئ حسابه.</div><form id=\"ministerCreate\" class=\"card form\"><label class=\"field\">اسم الوزير<select class=\"input\" name=\"minister_id\" id=\"ministerSelect\" required><option value=\"\">اختر الوزير</option>${roster.ministers.map(m=>`<option value=\"${m.id}\" ${m.created?'disabled':''}>${safe(m.name)}${m.created?' (حساب موجود)':''}</option>`).join('')}</select></label><div id=\"ministerOwned\" class=\"notice\">اختر الوزير لعرض وزاراته</div><label class=\"field\">اسم المستخدم<input class=\"input\" id=\"ministerUsername\" readonly></label><label class=\"field\">كلمة المرور للوزير<input class=\"input\" name=\"password\" type=\"password\" minlength=\"12\" maxlength=\"128\" autocomplete=\"new-password\" required></label><button class=\"btn gold\" type=\"submit\">إنشاء حساب الوزير</button><p id=\"ministerCreateResult\" role=\"status\"></p></form><h2>الحسابات المنشأة</h2>${accounts.accounts.map(a=>`<div class=\"card\"><b>${safe(a.minister)}</b><p>${a.ministries.map(safe).join('، ')}</p><p>اسم المستخدم: ${safe(a.username)}</p></div>`).join('')}`);\n const select=document.querySelector('#ministerSelect');\n select.onchange=()=>{const m=roster.ministers.find(x=>x.id===Number(select.value));document.querySelector('#ministerOwned').textContent=m?'الوزارات: '+m.ministries.join('، '):'اختر الوزير لعرض وزاراته';document.querySelector('#ministerUsername').value=m?.username||''};\n document.querySelector('#ministerCreate').onsubmit=async e=>{e.preventDefault();const result=document.querySelector('#ministerCreateResult');const id=Number(select.value);if(!select.value){result.textContent='اختر الوزير أولًا';return}const password=e.target.elements.password.value;try{const r=await post('/admin/ministries/provision',{minister_id:id,password});result.textContent='تم إنشاء حساب '+r.minister+' باسم المستخدم '+r.username+'؛ احتفظ بكلمة المرور التي اخترتها.';e.target.elements.password.value='';select.querySelector('option[value=\"'+id+'\"]').disabled=true}catch(err){result.textContent=err.message}};\n }catch(err){page('حسابات الوزارات','<div class=\"notice\">'+safe(err.message)+'</div>')}\n}\nfunction citizenRegister(){page('إنشاء حساب مواطن','<div class=\"notice\">أصدر الهوية الوطنية أولًا من الأحوال، واطلب رمز تفعيل صالحًا لمدة 14 يومًا.</div><form id=\"citizenRegister\" class=\"card form\"><label class=\"field\">رقم الهوية<input class=\"input\" name=\"document_number\" required></label><label class=\"field\">رمز التفعيل<input class=\"input\" name=\"activation_code\" required></label><label class=\"field\">اسم المستخدم<input class=\"input\" name=\"username\" pattern=\"[A-Za-z0-9_]+\" required></label><label class=\"field\">كلمة المرور<input class=\"input\" type=\"password\" name=\"password\" minlength=\"12\" required></label><label class=\"field\">الجوال (اختياري)<input class=\"input\" name=\"phone\" type=\"tel\"></label><button class=\"btn gold\">إنشاء الحساب</button><p role=\"status\"></p></form>');document.querySelector('#citizenRegister').onsubmit=async e=>{e.preventDefault();try{await post('/auth/citizen/register',Object.fromEntries(new FormData(e.target)));e.target.querySelector('[role=status]').textContent='تم إنشاء الحساب، سجل الدخول الآن'}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\nfunction login(){page('تسجيل الدخول',`<form id=\"loginForm\" class=\"card form\"><label class=\"field\"><span>اسم المستخدم</span><input class=\"input\" name=\"username\" autocomplete=\"username\" required></label><label class=\"field\"><span>كلمة المرور</span><input class=\"input\" name=\"password\" type=\"password\" autocomplete=\"current-password\" required></label><button class=\"btn\" type=\"submit\">دخول</button><p id=\"msg\" role=\"status\"></p></form>`);document.querySelector('#loginForm').insertAdjacentHTML('beforeend','<p><a href=\"#/recover-owner\">استرداد حساب الملك</a> · <a href=\"#/citizen-register\">إنشاء حساب مواطن</a></p>');document.querySelector('#loginForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await post('/auth/login',Object.fromEntries(f));await refreshUser();location.hash='#/dashboard'}catch(err){document.querySelector('#msg').textContent=err.message}}}\nasync function recoverOwner(){page('استرداد حساب الملك',`<div class=\"notice\">استرداد آمن لحساب الملك الحالي مع الحفاظ على بياناته. يتطلب رمز التهيئة الموجود في إعدادات Cloudflare.</div><form id=\"recoverOwnerForm\" class=\"card form\"><label class=\"field\">رمز التهيئة<input class=\"input\" name=\"setup_secret\" type=\"password\" autocomplete=\"off\" required></label><label class=\"field\">كلمة مرور جديدة (12 حرفًا على الأقل)<input class=\"input\" name=\"password\" type=\"password\" minlength=\"12\" maxlength=\"128\" autocomplete=\"new-password\" required></label><button class=\"btn gold\" type=\"submit\">استرداد حساب الملك</button><p id=\"msg\" role=\"status\"></p></form>`);document.querySelector('#recoverOwnerForm').onsubmit=async e=>{e.preventDefault();try{await post('/setup/recover-owner',Object.fromEntries(new FormData(e.target)));document.querySelector('#msg').textContent='تم الاسترداد بنجاح. يمكنك تسجيل الدخول الآن.';e.target.reset()}catch(err){document.querySelector('#msg').textContent=err.message}}}\nasync function setup(){const status=await api('/setup/status');if(!status.needsSetup){page('التهيئة مكتملة','<p>تم إنشاء الحساب الأول مسبقًا. <a href=\"#/login\">تسجيل الدخول</a></p>');return}page('التهيئة الأولى — حساب الملك',`<div class=\"notice\">تُستخدم هذه الصفحة مرة واحدة فقط، قبل إنشاء أي حساب. اختر كلمة مرور قوية ولا تشاركها.</div><form id=\"setupForm\" class=\"card form\"><label class=\"field\"><span>رمز التهيئة السري من إعدادات Cloudflare</span><input class=\"input\" name=\"setup_secret\" type=\"password\" required></label><label class=\"field\"><span>اسم المستخدم الملكي</span><input class=\"input\" name=\"username\" minlength=\"3\" maxlength=\"40\" pattern=\"[A-Za-z0-9_]+\" required></label><label class=\"field\"><span>كلمة المرور (12 حرفًا على الأقل)</span><input class=\"input\" name=\"password\" type=\"password\" minlength=\"12\" autocomplete=\"new-password\" required></label><button class=\"btn gold\">إنشاء حساب الملك</button><p id=\"msg\" role=\"status\"></p></form>`);document.querySelector('#setupForm').onsubmit=async e=>{e.preventDefault();try{await post('/setup/king',Object.fromEntries(new FormData(e.target)));location.hash='#/login'}catch(err){document.querySelector('#msg').textContent=err.message}}}\nasync function dashboard(){if(!me){location.hash='#/login';return}let content=`<p>مرحبًا، ${safe(me.username)} · الصلاحية: ${safe(me.role)}</p><div class=\"actions\"><a class=\"btn\" href=\"#/requests\">الطلبات والمتابعة</a><a class=\"btn outline\" href=\"#/jobs\">الوظائف</a><a class=\"btn outline\" href=\"#/education\">التعليم</a><a class=\"btn outline\" href=\"#/payroll\">رواتبي</a><a class=\"btn outline\" href=\"#/state-budgets\">مقترحات الميزانيات</a><a class=\"btn outline\" href=\"#/courts\">القضاء والمحاماة</a><a class=\"btn outline\" href=\"#/messages\">الرسائل الحكومية</a><a class=\"btn outline\" href=\"#/service-desk\">مركز خدمة المواطنين</a><a class=\"btn outline\" href=\"#/health\">الصحة والمواعيد</a><a class=\"btn outline\" href=\"#/municipality\">البلديات والرخص</a><a class=\"btn outline\" href=\"#/land\">العقارات والملكية</a><a class=\"btn outline\" href=\"#/commerce\">السجل التجاري والشركات</a><a class=\"btn outline\" href=\"#/commerce-branches\">فروع الشركات</a><a class=\"btn outline\" href=\"#/company-treasury\">حسابات الشركات</a><a class=\"btn outline\" href=\"#/company-staff\">موظفو الشركات ورواتبهم</a><a class=\"btn outline\" href=\"#/security\">أمان الحساب والجلسات</a><a class=\"btn outline\" href=\"#/telecom\">الجوال والاتصالات</a><button class=\"btn outline\" id=\"logout\">تسجيل الخروج</button></div>`;if(me.role==='king'){content+=`<section class=\"card\"><h2>القرارات المالية والإدارية</h2><p>إدارة قضايا المديونيات وطلبات إيقاف الخدمات ومتابعة الاعتماد.</p><a class=\"btn gold\" href=\"#/enforcement\">فتح إدارة المديونيات وإيقاف الخدمات</a></section>`;const o=await api('/admin/overview');content+=`<div class=\"actions\"><a class=\"btn\" href=\"#/borders\">المنافذ والجمارك</a><a class=\"btn\" href=\"#/registry\">الوثائق والتعاميم</a><a class=\"btn\" href=\"#/civil\">طلبات الأحوال</a><a class=\"btn\" href=\"#/audit\">سجل التدقيق</a><a class=\"btn\" href=\"#/staff\">إدارة الموظفين</a><a class=\"btn\" href=\"#/jobs-admin\">إدارة التوظيف</a><a class=\"btn\" href=\"#/payroll\">الرواتب والميزانيات</a><a class=\"btn\" href=\"#/state-budgets\">اعتماد ميزانية الدولة</a><a class=\"btn\" href=\"#/bank-admin\">إدارة أرصدة البنوك</a><a class=\"btn gold\" href=\"#/enforcement\">المديونيات وإيقاف الخدمات</a><a class=\"btn\" href=\"#/readiness\">فحص جاهزية الإطلاق</a></div><h2>الملك وإدارة الدولة</h2><div class=\"stats\"><div class=\"stat\">الحسابات<b>${o.users}</b></div><div class=\"stat\">الطلبات<b>${o.requests}</b></div><div class=\"stat\">المنشورات<b>${o.news}</b></div></div><div class=\"actions\"><a class=\"btn gold\" href=\"#/publish\">نشر خبر أو قرار</a> <a class=\"btn gold\" href=\"#/national-alert\">إدارة التنبيه الوطني</a></div>`}else if(me.role==='employee'){content+=`<div class=\"actions\"><a class=\"btn\" href=\"#/borders\">المنافذ والجمارك</a><a class=\"btn\" href=\"#/registry\">الوثائق</a><a class=\"btn\" href=\"#/civil\">الأحوال</a><a class=\"btn\" href=\"#/publish\">النشر</a></div>`}if(me.role==='king')content+='<p><a class=\"btn gold\" href=\"#/ministry-accounts\">إدارة حسابات الوزارات</a></p>';if(me.role==='employee')content+='<p><a class=\"btn gold\" href=\"#/ministry-office\">مكتب الوزارة</a> <a class=\"btn\" href=\"#/enforcement\">المديونيات وإيقاف الخدمات (للداخلية والعدل والمالية)</a></p>';if(me.role==='citizen')content+='<p><a class=\"btn gold\" href=\"#/citizen-profile\">ملفي كمواطن · تعديل رقم الجوال</a></p>';page('لوحة التحكم',content);document.querySelector('#logout').onclick=async()=>{await post('/auth/logout',{});await refreshUser();location.hash='#/'}}\nasync function requests(){if(!me){location.hash='#/login';return}const result=await api('/requests');page('الطلبات والمتابعة',`<form class=\"card form\" id=\"requestForm\"><h3>طلب جديد</h3><label class=\"field\"><span>نوع الطلب</span><select class=\"input\" name=\"kind\"><option value=\"diwan\">الديوان الملكي</option><option value=\"complaint\">شكوى</option><option value=\"suggestion\">مقترح</option></select></label><label class=\"field\"><span>الموضوع</span><input class=\"input\" name=\"subject\" required minlength=\"3\" maxlength=\"150\"></label><label class=\"field\"><span>التفاصيل</span><textarea class=\"input\" name=\"description\" required minlength=\"5\" maxlength=\"3000\" rows=\"4\"></textarea></label><button class=\"btn\">تسجيل الطلب</button><p id=\"msg\" role=\"status\"></p></form><h2>سجل الطلبات</h2>${result.requests.length?result.requests.map(r=>`<div class=\"card\"><b>${safe(r.subject)}</b><div class=\"muted\">رقم الطلب: ${safe(r.id)} · الحالة: ${safe(r.status)} · ${safe(r.created_at)}</div><p>${safe(r.description)}</p></div>`).join(''):'<p class=\"empty\">لا توجد طلبات بعد.</p>'}`);document.querySelector('#requestForm').onsubmit=async e=>{e.preventDefault();try{const r=await post('/requests',Object.fromEntries(new FormData(e.target)));document.querySelector('#msg').textContent='تم تسجيل الطلب: '+r.id;setTimeout(()=>route(),500)}catch(err){document.querySelector('#msg').textContent=err.message}}}\nasync function publish(){if(!me){location.hash='#/login';return}page('نشر خبر أو قرار',`<form class=\"card form\" id=\"publishForm\"><label class=\"field\"><span>نوع المنشور</span><select class=\"input\" name=\"kind\"><option value=\"news\">خبر</option><option value=\"decree\">قرار ملكي</option><option value=\"circular\">تعميم</option></select></label><label class=\"field\"><span>العنوان</span><input class=\"input\" name=\"title\" required maxlength=\"160\"></label><label class=\"field\"><span>النص</span><textarea class=\"input\" name=\"body\" rows=\"6\" required maxlength=\"6000\"></textarea></label><button class=\"btn gold\">نشر</button><p id=\"msg\"></p></form>`);document.querySelector('#publishForm').onsubmit=async e=>{e.preventDefault();try{await post('/admin/news',Object.fromEntries(new FormData(e.target)));await refreshData();location.hash='#/news'}catch(err){document.querySelector('#msg').textContent=err.message}}}\n\nfunction formHandler(id,path,after){document.querySelector('#'+id).onsubmit=async e=>{e.preventDefault();const msg=e.target.querySelector('[role=status]');try{const r=await post(path,Object.fromEntries(new FormData(e.target)));msg.textContent=after?after(r):'تم حفظ العملية بنجاح';msg.className='success';e.target.reset()}catch(err){msg.textContent=err.message;msg.className='error'}}}\nasync function registry(){if(!me){location.hash='#/login';return}const [docs,apps,civil]=await Promise.all([api('/registry/documents'),api('/registry/applications'),api('/registry/approved-civil')]);page('الوثائق والتعاميم',`<div class=\"notice\">وثائق المملكة الصالية افتراضية. رقم الهوية أو الإقامة أو الجواز لا يصدر إلا بعد الموافقة على الطلب.</div><div class=\"grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr))\"><form id=\"checkDoc\" class=\"card\"><h3>فحص وثيقة</h3><label class=\"field\">رقم الوثيقة<input class=\"input\" name=\"number\" required></label><label class=\"field\">سبب الفحص<input class=\"input\" name=\"reason\" value=\"فحص إداري\"></label><button class=\"btn\">فحص</button><p role=\"status\"></p></form><form id=\"newDocApplication\" class=\"card\"><h3>طلب إصدار وثيقة</h3><label class=\"field\">طلب الأحوال المعتمد<select class=\"input\" name=\"civil_intake_id\" id=\"civilSource\"><option value=\"\">إدخال يدوي</option>${civil.applications.map(c=>`<option value=\"${safe(c.id)}\">${safe(c.reference)} — ${safe(c.full_name)}</option>`).join('')}</select></label><label class=\"field\">النوع<select class=\"input\" name=\"type\"><option value=\"national_id\">هوية وطنية</option><option value=\"residency\">إقامة</option><option value=\"passport\">جواز سفر</option></select></label>${[['full_name','الاسم الكامل'],['nationality','الجنسية'],['issuer','جهة الإصدار']].map(([n,t])=>`<label class=\"field\">${t}<input class=\"input\" name=\"${n}\" required></label>`).join('')}<label class=\"field\">تاريخ الميلاد<input class=\"input\" name=\"birth_date\" type=\"date\" required></label><label class=\"field\">مكان الميلاد<input class=\"input\" name=\"birth_place\" maxlength=\"160\" required></label><label class=\"field\">الجنس<select class=\"input\" name=\"gender\" required><option value=\"\">اختر الجنس</option><option value=\"male\">ذكر</option><option value=\"female\">أنثى</option></select></label><label class=\"field\">اسم الأب<input class=\"input\" name=\"father_name\" maxlength=\"160\" required></label><label class=\"field\">اسم الأم<input class=\"input\" name=\"mother_name\" maxlength=\"160\" required></label><label class=\"field\">تاريخ الانتهاء<input class=\"input\" name=\"expires_at\" type=\"date\" required></label><label class=\"field\">الجوال (اختياري)<input class=\"input\" name=\"phone\" type=\"tel\"></label><button class=\"btn\">إرسال الطلب للمراجعة</button><p role=\"status\"></p></form><form id=\"newCircular\" class=\"card\"><h3>تعميم على وثيقة</h3>${[['reference','رقم التعميم'],['document_number','رقم الوثيقة'],['kind','نوع التعميم'],['reason','السبب']].map(([n,t])=>`<label class=\"field\">${t}<input class=\"input\" name=\"${n}\" required></label>`).join('')}<label class=\"field\">السرية<select class=\"input\" name=\"confidentiality\"><option value=\"restricted\">مقيد</option><option value=\"public\">عام</option></select></label><button class=\"btn\">إصدار تعميم</button><p role=\"status\"></p></form></div><h2>تفعيل حساب المواطن</h2><form id=\"activationForm\" class=\"card form\"><label class=\"field\">رقم الهوية أو الإقامة أو الجواز أو معرّف الوثيقة<input class=\"input\" name=\"document_id\" required></label><button class=\"btn\">إصدار رمز التفعيل</button><p role=\"status\"></p></form><h2>طلبات الإصدار</h2><div class=\"directory\">${apps.applications.map(x=>`<div class=\"card\"><b>${safe(x.full_name)}</b><p>${safe(x.reference)} · ${safe(x.type)}</p><p>الحالة: ${safe(x.status)}${x.document_number?' · رقم الوثيقة: '+safe(x.document_number):''}</p>${x.status==='pending'?`<button class=\"btn\" data-docdecision=\"approved\" data-id=\"${safe(x.id)}\">قبول وإصدار الرقم</button> <button class=\"btn\" data-docdecision=\"rejected\" data-id=\"${safe(x.id)}\">رفض</button>`:''}</div>`).join('')||'<p>لا توجد طلبات.</p>'}</div><h2>الوثائق الصادرة</h2><div class=\"directory\">${docs.documents.map(d=>`<div class=\"card\"><b>${safe(d.full_name)}</b><p>${safe(d.type)} · ${safe(d.number)}</p><p class=\"muted\">معرّف الوثيقة: ${safe(d.id)}</p><form class=\"docPhone\" data-id=\"${safe(d.id)}\"><input class=\"input\" name=\"phone\" type=\"tel\" placeholder=\"رقم الجوال (اختياري)\" value=\"${safe(d.phone||'')}\"><button class=\"btn outline\">حفظ الجوال</button><p role=\"status\"></p></form><small>الصلاحية: ${safe(d.expires_at)} · ${safe(d.status)}</small></div>`).join('')||'<p>لا توجد وثائق.</p>'}</div>`);formHandler('checkDoc','/registry/check',r=>'النتيجة: '+({valid:'سارية',unregistered:'غير مسجلة',expired:'منتهية',cancelled:'ملغاة',suspended:'موقوفة',circular:'يوجد تعميم نشط'}[r.result]||r.result));document.querySelector('#activationForm').onsubmit=async e=>{e.preventDefault();try{const r=await post('/registry/citizen-activation',Object.fromEntries(new FormData(e.target)));e.target.querySelector('[role=status]').textContent='رمز التفعيل (انسخه الآن): '+r.activation_code+' — صالح 14 يومًا'}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.docPhone').forEach(form=>form.onsubmit=async e=>{e.preventDefault();try{await post('/registry/documents/phone',{id:form.dataset.id,phone:new FormData(form).get('phone')});form.querySelector('[role=status]').textContent='تم الحفظ'}catch(err){form.querySelector('[role=status]').textContent=err.message}});document.querySelector('#civilSource').onchange=e=>{const c=civil.applications.find(x=>x.id===e.target.value);if(!c)return;const f=document.querySelector('#newDocApplication');for(const [k,v] of Object.entries({full_name:c.full_name,birth_date:c.birth_date,father_name:c.parent_name})){if(v&&f.elements[k])f.elements[k].value=v}};formHandler('newDocApplication','/registry/applications',r=>'تم تقديم الطلب للمراجعة: '+r.reference);formHandler('newCircular','/registry/circulars',r=>'تم إصدار التعميم: '+r.id);document.querySelectorAll('[data-docdecision]').forEach(btn=>btn.addEventListener('click',async()=>{if(!await uiConfirm(btn.dataset.docdecision==='approved'?'تأكيد قبول الطلب وإصدار رقم الوثيقة؟':'تأكيد رفض الطلب؟'))return;btn.disabled=true;try{const r=await api('/registry/applications/decision',{method:'POST',body:JSON.stringify({id:btn.dataset.id,decision:btn.dataset.docdecision})});uiNotice(r.number?'تم الاعتماد وإصدار الرقم: '+r.number:'تم رفض الطلب');await registry()}catch(e){uiNotice(e.message);btn.disabled=false}}))}\nasync function civil(){\n if(!me){location.hash='#/login';return}\n try{\n const r=await api('/civil/intake');\n page('تسجيل ومراجعة طلبات الأحوال المدنية',`<section class=\"card\"><h2>🤖 طلبات هوية المواطنين الافتراضيين</h2><p class=\"muted\">طلبات المحاكاة منفصلة عن الطلبات الحقيقية ولا تُمنح صلاحيات للمواطنين الافتراضيين.</p><div class=\"actions\">${(r.bot_identity_counts||[]).map(x=>`<span class=\"btn outline\">${safe(x.status)}: ${Number(x.n).toLocaleString('ar-SA')}</span>`).join('')}</div><p>أحدث 100 طلب من إجمالي طلبات المحاكاة:</p>${me?.role==='king'?'<button class=\"btn gold\" id=\"kingApproveBatch\">اعتماد 50 طلبًا</button>':''}<div style=\"max-height:380px;overflow:auto\">${(r.bot_identity_applications||[]).map(x=>`<div class=\"card\"><b>${safe(x.name)} 🤖</b><p>${safe(x.id)} · ${safe(x.status)}</p>${x.expires_at?`<small>تنتهي: ${safe(x.expires_at)}</small>`:''}${me?.role==='king'&&x.status==='requested'?`<div class=\"actions\"><button class=\"btn gold bot-id-approve\" data-id=\"${safe(x.id)}\">اعتماد الهوية</button><button class=\"btn bot-id-reject\" data-id=\"${safe(x.id)}\">رفض</button></div>`:''}</div>`).join('')}</div></section><div class=\"actions\"><a class=\"btn gold\" href=\"#/family-cards\">كرت العائلة — إصدار وتجديد</a></div><div class=\"notice\">الطلبات المكتملة يراجعها موظف آلي كل نصف ساعة، ويصدر رقم الهوية من قسم الوثائق بعد التحقق. الطلبات الناقصة تحتاج مراجعة بشرية.</div><form class=\"card form\" id=\"civilForm\"><label class=\"field\">الاسم الكامل<input class=\"input\" name=\"full_name\" required></label><label class=\"field\">اسم ولي الأمر<input class=\"input\" name=\"parent_name\" required minlength=\"2\"></label><label class=\"field\">تاريخ الميلاد<input class=\"input\" name=\"birth_date\" type=\"date\" required></label><label class=\"field\">ملاحظات الطلب<textarea class=\"input\" name=\"details\" rows=\"3\"></textarea></label><button class=\"btn\">تسجيل الطلب</button><p role=\"status\"></p></form><h2>مراجعة واعتماد الطلبات</h2>${r.applications.map(x=>`<div class=\"card\"><b>${safe(x.full_name)}</b><p>${safe(x.reference)} · الحالة: ${safe(x.status)}</p><p>${safe(x.details||'')}</p>${['recorded','reviewing'].includes(x.status)?`<form class=\"civil-review\" data-id=\"${safe(x.id)}\"><label class=\"field\">ملاحظة المراجع / سبب الرفض<textarea class=\"input\" name=\"note\" rows=\"2\"></textarea></label><div class=\"actions\"><button class=\"btn\" name=\"decision\" value=\"reviewing\" type=\"submit\">قيد المراجعة</button><button class=\"btn gold\" name=\"decision\" value=\"approved\" type=\"submit\">اعتماد</button><button class=\"btn\" name=\"decision\" value=\"rejected\" type=\"submit\">رفض</button></div><p role=\"status\"></p></form>`:`<p>قرار نهائي ${safe(x.review_note||'')}</p>`}</div>`).join('')||'<p class=\"empty\">لا توجد طلبات بعد.</p>'}`);\n if(me?.role==='king'){\n  const batch=document.getElementById('kingApproveBatch');\n  if(batch)batch.onclick=async()=>{if(!await uiConfirm('اعتماد 50 طلب هوية افتراضية؟'))return;batch.disabled=true;try{const x=await post('/civil/bot-identities/decision',{bulk:true,limit:50,decision:'approved'});uiNotice('تم اعتماد '+x.changed+' طلب');await civil()}catch(e){uiNotice(e.message);batch.disabled=false}};\n  document.querySelectorAll('.bot-id-approve,.bot-id-reject').forEach(btn=>btn.onclick=async()=>{const rejected=btn.classList.contains('bot-id-reject');const note=rejected?await uiPrompt('اكتب سبب الرفض:'):'';if(rejected&&!note?.trim())return;if(!rejected&&!await uiConfirm('اعتماد هذه الهوية؟'))return;btn.disabled=true;try{await post('/civil/bot-identities/decision',{id:btn.dataset.id,decision:rejected?'rejected':'approved',note});await civil()}catch(e){uiNotice(e.message);btn.disabled=false}});\n }\n formHandler('civilForm','/civil/intake',x=>'تم تسجيل الطلب: '+x.reference);\n document.querySelectorAll('.civil-review').forEach(form=>{form.querySelectorAll('button[name=decision]').forEach(btn=>{btn.onclick=async e=>{e.preventDefault();const note=form.elements.note.value.trim();if(btn.value==='rejected'&&!note){form.querySelector('[role=status]').textContent='سبب الرفض مطلوب';return}btn.disabled=true;try{await post('/civil/intake/decision',{id:form.dataset.id,decision:btn.value,note});await civil()}catch(err){form.querySelector('[role=status]').textContent=err.message;btn.disabled=false}}})});\n }catch(err){page('طلبات الأحوال','<div class=\"notice\">'+safe(err.message)+'</div>')}\n}\nasync function familyCards(){if(!me){location.hash='#/login';return}const r=await api('/civil/family-cards');const childInputs=(names=[])=>Array.from({length:10},(_,i)=>'<label class=\"field\">الابن / الابنة '+(i+1)+' (اختياري)<input class=\"input\" name=\"child\" maxlength=\"160\" value=\"'+safe(names[i]||'')+'\"></label>').join('');page('كرت العائلة — سجل الأسرة','<div class=\"notice\">سجل الأسرة بلا تاريخ انتهاء. التجديد عند تغيير البيانات فقط. رسوم إصدار وتجديد الوثيقة: 0 ريال. أجور التوصيل في أبشر السعودي لبعض الخدمات 39.91 ريال، وليست رسوم تجديد.</div><form class=\"card form\" id=\"familyIssue\"><h3>إصدار كرت عائلة</h3><label class=\"field\">اسم الأب<input class=\"input\" name=\"father_name\" required></label><label class=\"field\">اسم الأم<input class=\"input\" name=\"mother_name\" required></label>'+'<label class=\"field\">الجوال (اختياري)<input class=\"input\" name=\"phone\" type=\"tel\"></label>'+childInputs()+'<button class=\"btn gold\">إصدار كرت العائلة</button><p role=\"status\"></p></form><h2>سجلات الأسرة الافتراضية 🤖</h2>'+(r.simulated_cards||[]).map(x=>'<div class=\"card\"><b>'+safe(x.number)+'</b><p>الأب: '+safe(x.father_name)+' · الأم: '+safe(x.mother_name)+'</p><p>الأبناء: '+safe(x.children.join('، ')||'لا يوجد')+'</p><small>أسرة محاكاة آلية</small></div>').join('')+'<h2>سجلات الأسرة</h2>'+r.cards.map(x=>'<div class=\"card\"><b>'+safe(x.number)+'</b><div class=\"muted\">الأب: '+safe(x.father_name)+' · الأم: '+safe(x.mother_name)+' · النسخة '+safe(x.revision)+'</div><p>الأبناء: '+safe(x.children.join('، ')||'لا يوجد')+'</p><details><summary>تجديد عند تغير بيانات الأسرة</summary><form class=\"form familyRenew\" data-id=\"'+safe(x.id)+'\"><label class=\"field\">اسم الأب<input class=\"input\" name=\"father_name\" value=\"'+safe(x.father_name)+'\" required></label><label class=\"field\">اسم الأم<input class=\"input\" name=\"mother_name\" value=\"'+safe(x.mother_name)+'\" required></label>'+'<label class=\"field\">الجوال (اختياري)<input class=\"input\" name=\"phone\" value=\"'+safe(x.phone||'')+'\"></label>'+childInputs(x.children)+'<label class=\"field\">سبب التغيير<input class=\"input\" name=\"reason\" required minlength=\"3\" maxlength=\"300\" placeholder=\"إضافة مولود أو تعديل بيانات\"></label><button class=\"btn\">تجديد السجل مجانًا</button><p role=\"status\"></p></form></details></div>').join('')+'<p><a href=\"#/civil\" class=\"btn outline\">العودة للأحوال المدنية</a></p>');const getChildren=f=>f.getAll('child').map(x=>String(x).trim()).filter(Boolean);document.querySelector('#familyIssue').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await post('/civil/family-cards',{father_name:f.get('father_name'),mother_name:f.get('mother_name'),children:getChildren(f),phone:f.get('phone')});await familyCards()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.familyRenew').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);try{await post('/civil/family-cards/renew',{id:form.dataset.id,father_name:f.get('father_name'),mother_name:f.get('mother_name'),children:getChildren(f),reason:f.get('reason'),phone:f.get('phone')});await familyCards()}catch(err){form.querySelector('[role=status]').textContent=err.message}})}\nasync function auditPage(){if(!me){location.hash='#/login';return}const r=await api('/admin/audit');page('سجل التدقيق',r.entries.map(x=>`<div class=\"card\"><b>${safe(x.action)}</b><div class=\"muted\">${safe(x.created_at)} · ${safe(x.entity_type)} · ${safe(x.actor_id||'نظام')}</div></div>`).join('')||'<p class=\"empty\">لا توجد عمليات.</p>')}\n\nasync function messages(){if(!me){location.hash='#/login';return}const r=await api('/messages');page('البريد الحكومي الداخلي',`<div class=\"notice\">المراسلات داخل نظام المملكة الصالية فقط، ولا تُرسل كرسائل SMS حقيقية.</div><form class=\"card form\" id=\"messageForm\"><h3>رسالة جديدة</h3><label class=\"field\">اسم مستخدم المستلم<input class=\"input\" name=\"recipient\" required></label><label class=\"field\">الموضوع<input class=\"input\" name=\"subject\" required minlength=\"3\" maxlength=\"150\"></label><label class=\"field\">الرسالة<textarea class=\"input\" name=\"body\" required maxlength=\"3000\" rows=\"4\"></textarea></label><button class=\"btn\">إرسال</button><p role=\"status\"></p></form><h2>الوارد</h2>${r.messages.map(m=>`<article class=\"card\"><b>${safe(m.subject)}</b><div class=\"muted\">من: ${safe(m.sender||'النظام')} · ${safe(m.created_at)} · ${m.read_at?'مقروءة':'جديدة'}</div><p class=\"article\">${safe(m.body)}</p>${m.read_at?'':`<button class=\"btn outline readMessage\" data-id=\"${safe(m.id)}\">تحديد كمقروءة</button>`}</article>`).join('')||'<p class=\"empty\">لا توجد رسائل.</p>'}`);formHandler('messageForm','/messages/send',r=>'تم الإرسال: '+r.id);document.querySelectorAll('.readMessage').forEach(b=>b.onclick=async()=>{await post('/messages/read',{id:b.dataset.id});await messages()})}\nasync function staff(){if(me?.role!=='king'){page('غير مخوّل','<p>إدارة الموظفين للملك فقط.</p>');return}const r=await api('/admin/staff');const choices=[['registry','الوثائق والتعاميم'],['civil','تسجيل الأحوال'],['requests','إدارة الطلبات'],['news','نشر الأخبار'],['borders','المنافذ'],['education','التعليم'],['banking','البنوك'],['justice','القضاء'],['police','الشرطة'],['appeals','الاستئناف والنقض'],['health','الصحة'],['municipality','البلديات'],['land','السجل العقاري'],['commerce','التجارة'],['finance','المالية'],['budget_propose','اقتراح الميزانية']];const checks=arr=>choices.map(([k,v])=>'<label style=\"display:block\"><input type=\"checkbox\" name=\"permission\" value=\"'+k+'\" '+(arr.includes(k)?'checked':'')+'> '+v+'</label>').join('');page('إدارة حسابات الموظفين','<div class=\"notice\">تعديل حسابات الموظفين وصلاحياتهم. تغيير بيانات الدخول ينهي جلسات الموظف.</div><form class=\"card form\" id=\"staffForm\"><h3>إنشاء موظف</h3><label class=\"field\">اسم المستخدم<input class=\"input\" name=\"username\" pattern=\"[A-Za-z0-9_]+\" required minlength=\"3\"></label><label class=\"field\">كلمة المرور<input class=\"input\" type=\"password\" name=\"password\" required minlength=\"12\"></label><h3>الصلاحيات</h3>'+checks([])+'<button class=\"btn gold\">إنشاء موظف</button><p role=\"status\"></p></form><h2>الحسابات المسجلة</h2>'+r.staff.map(x=>'<div class=\"card\"><b>'+safe(x.username)+'</b><div class=\"muted\">'+safe(x.role)+' · '+safe(x.permissions||'بلا صلاحيات إضافية')+'</div>'+(x.role==='employee'?'<details><summary>تعديل الحساب والصلاحيات</summary><form class=\"form staffEdit\" data-id=\"'+safe(x.id)+'\"><label class=\"field\">اسم المستخدم<input class=\"input\" name=\"username\" value=\"'+safe(x.username)+'\" pattern=\"[A-Za-z0-9_]+\" minlength=\"3\" required></label><label class=\"field\">كلمة مرور جديدة (اختياري)<input class=\"input\" type=\"password\" name=\"password\" autocomplete=\"new-password\" minlength=\"12\"></label><button class=\"btn\">حفظ الحساب</button><p role=\"status\"></p></form><form class=\"form staffPermissions\" data-id=\"'+safe(x.id)+'\"><h4>الصلاحيات</h4>'+checks((x.permissions||'').split(','))+'<button class=\"btn gold\">حفظ الصلاحيات</button><p role=\"status\"></p></form></details>':'')+'</div>').join(''));document.querySelector('#staffForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await post('/admin/staff',{username:f.get('username'),password:f.get('password'),permissions:f.getAll('permission')});await staff()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.staffEdit').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),body={id:form.dataset.id,username:f.get('username')};if(f.get('password'))body.password=f.get('password');try{await post('/admin/staff/update',body);form.querySelector('[role=status]').textContent='تم حفظ الحساب'}catch(err){form.querySelector('[role=status]').textContent=err.message}});document.querySelectorAll('.staffPermissions').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);try{await post('/admin/staff/permissions',{id:form.dataset.id,permissions:f.getAll('permission')});form.querySelector('[role=status]').textContent='تم حفظ الصلاحيات'}catch(err){form.querySelector('[role=status]').textContent=err.message}})}\n\nasync function jobs(){const r=await api('/jobs');let mine=[];if(me){mine=(await api('/jobs/mine')).applications}page('التوظيف في المملكة',`<div class=\"notice\">الوظائف الحكومية والخاصة والعسكرية. الرواتب بالريال الصالي داخل المحاكاة.</div><div class=\"actions\">${me?.role==='king'?'<a class=\"btn gold\" href=\"#/jobs-admin\">إدارة الوظائف</a>':''}</div><h2>الوظائف المتاحة</h2>${r.jobs.map(j=>`<article class=\"card\"><div class=\"tag\">${safe(({government:'حكومي',private:'خاص',military:'عسكري'})[j.sector])}</div><h3>${safe(j.title)}</h3><div class=\"muted\">${safe(j.employer)} · الراتب: ${Number(j.salary).toLocaleString('ar-SA')} ريال صالي</div><p>${safe(j.description)}</p>${me?`<form class=\"jobApply form\" data-id=\"${safe(j.id)}\"><label class=\"field\">نبذة عن المؤهلات والخبرة<textarea class=\"input\" name=\"statement\" required minlength=\"10\" maxlength=\"2000\"></textarea></label><button class=\"btn\">تقديم الطلب</button><p role=\"status\"></p></form>`:'<a class=\"btn outline\" href=\"#/login\">سجّل الدخول للتقديم</a>'}</article>`).join('')||'<p class=\"empty\">لا توجد وظائف منشورة حاليًا.</p>'}${me?`<h2>طلباتي</h2>${mine.map(a=>`<div class=\"card\"><b>${safe(a.title)}</b><div class=\"muted\">${safe(a.employer)} · ${safe(({submitted:'مقدم',reviewing:'قيد المراجعة',accepted:'مقبول',rejected:'مرفوض'})[a.status]||a.status)} · ${safe(a.created_at)}${a.contract_id?' · عقد رقم: '+safe(a.contract_id):''}</div></div>`).join('')||'<p class=\"empty\">لم تقدم على وظيفة بعد.</p>'}`:''}`);document.querySelectorAll('.jobApply').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const st=f.querySelector('[role=status]');try{await post('/jobs/apply',{vacancy_id:f.dataset.id,statement:new FormData(f).get('statement')});st.textContent='تم تقديم الطلب بنجاح';f.querySelector('button').disabled=true}catch(err){st.textContent=err.message}})}\nasync function jobsAdmin(){if(me?.role!=='king'){page('غير مخوّل','<p>إدارة الوظائف للملك فقط حاليًا.</p>');return}const r=await api('/admin/jobs/applications');page('إدارة الوظائف والتوظيف',`<form class=\"card form\" id=\"vacancyForm\"><h2>نشر وظيفة</h2><label class=\"field\">المسمى الوظيفي<input class=\"input\" name=\"title\" required minlength=\"3\"></label><label class=\"field\">جهة العمل<input class=\"input\" name=\"employer\" required></label><label class=\"field\">القطاع<select class=\"input\" name=\"sector\"><option value=\"government\">حكومي</option><option value=\"private\">خاص</option><option value=\"military\">عسكري</option></select></label><label class=\"field\">الراتب بالريال الصالي<input class=\"input\" name=\"salary\" type=\"number\" min=\"0\" step=\"1\" required></label><label class=\"field\">الوصف والمتطلبات<textarea class=\"input\" name=\"description\" minlength=\"10\" required></textarea></label><button class=\"btn gold\">نشر الوظيفة</button><p role=\"status\"></p></form><h2>طلبات التوظيف</h2>${r.applications.map(a=>`<div class=\"card\"><h3>${safe(a.title)}</h3><div class=\"muted\">${a.source==='bot_company'?'🤖 شركة آلية · ':''}${safe(a.applicant)} · ${safe(a.employer)} · ${safe(a.created_at)}</div><p>${safe(a.statement)}</p><label class=\"field\">حالة الطلب<select class=\"input jobStatus\" data-id=\"${safe(a.id)}\"><option value=\"submitted\" ${a.status==='submitted'?'selected':''}>مقدم</option><option value=\"reviewing\" ${a.status==='reviewing'?'selected':''}>قيد المراجعة</option><option value=\"accepted\" ${a.status==='accepted'?'selected':''}>مقبول</option><option value=\"rejected\" ${a.status==='rejected'?'selected':''}>مرفوض</option></select></label><p class=\"muted statusMsg\"></p></div>`).join('')||'<p class=\"empty\">لا توجد طلبات بعد.</p>'}`);document.querySelector('#vacancyForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const v=Object.fromEntries(f);v.salary=Number(v.salary);await post('/admin/jobs',v);e.target.querySelector('[role=status]').textContent='نُشرت الوظيفة بنجاح';e.target.reset()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.jobStatus').forEach(el=>el.onchange=async()=>{const msg=el.closest('.card').querySelector('.statusMsg');try{await post('/admin/jobs/application/status',{id:el.dataset.id,status:el.value});msg.textContent='تم تحديث الحالة وإشعار المتقدم';if(el.value==='accepted')await jobsAdmin()}catch(err){msg.textContent=err.message}})}\nasync function banking(){if(!me){location.hash='#/login';return}const [a,t]=await Promise.all([api('/banking/accounts'),api('/banking/transfers')]);const names={saliyah:'بنك الصالية',national:'البنك الوطني الصالي',development:'بنك التنمية الصالي'};page('البنوك والمحافظ المالية',`<div class=\"notice\">جميع الأرصدة والتحويلات بالريال الصالي داخل المحاكاة فقط. لا توجد معاملات مالية حقيقية.</div><h2>حساباتي</h2><div class=\"grid\">${a.accounts.map(x=>`<div class=\"card\"><h3>${names[x.bank]}</h3><b>${Number(x.balance).toLocaleString('ar-SA')} ريال صالي</b><p class=\"muted\">الآيبان الصالي: <b dir=\"ltr\">${safe(x.iban||x.id)}</b><p class=\"muted\">رقم الحساب: ${safe(x.id)}</p></p></div>`).join('')||'<p class=\"empty\">لا توجد حسابات بعد.</p>'}</div><form class=\"card form\" id=\"openBank\"><h3>فتح حساب جديد</h3><label class=\"field\">البنك<select class=\"input\" name=\"bank\">${Object.entries(names).map(([k,v])=>`<option value=\"${k}\">${v}</option>`).join('')}</select></label><button class=\"btn\">فتح الحساب</button><p role=\"status\"></p></form><form class=\"card form\" id=\"sendMoney\"><h3>تحويل داخلي</h3><label class=\"field\">من حساب<select class=\"input\" name=\"from\" required>${a.accounts.map(x=>`<option value=\"${safe(x.id)}\">${names[x.bank]} — ${Number(x.balance).toLocaleString('ar-SA')}</option>`).join('')}</select></label><label class=\"field\">آيبان المستلم الصالي<input class=\"input\" name=\"recipient_iban\" dir=\"ltr\" required minlength=\"29\" maxlength=\"80\"></label><label class=\"field\">المبلغ (ريال صالي)<input class=\"input\" name=\"amount\" type=\"number\" min=\"1\" max=\"100000000\" step=\"1\" required></label><label class=\"field\">البيان<input class=\"input\" name=\"memo\" maxlength=\"200\"></label><button class=\"btn gold\" ${a.accounts.length?'':'disabled'}>تحويل</button><p role=\"status\"></p></form><h2>آخر التحويلات</h2>${t.transfers.map(x=>`<div class=\"card\"><b>${Number(x.amount).toLocaleString('ar-SA')} ريال صالي</b><p class=\"muted\">من ${safe(x.sender)} إلى ${safe(x.recipient)} · ${safe(x.created_at)}</p><p>${safe(x.memo)}</p></div>`).join('')||'<p class=\"empty\">لا توجد تحويلات بعد.</p>'}`);document.querySelector('#openBank').onsubmit=async e=>{e.preventDefault();try{await post('/banking/accounts',Object.fromEntries(new FormData(e.target)));await banking()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelector('#sendMoney').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);try{await post('/banking/transfer',b);await banking()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\nasync function refreshData(){data=await api('/public')}async function refreshUser(){me=(await api('/me')).user;document.querySelector('#royalObservatoryNav').hidden=me?.role!=='king';document.querySelector('#authLink').textContent=me?'لوحة التحكم':'تسجيل الدخول';document.querySelector('#authLink').href=me?'#/dashboard':'#/login'}\nasync function cardsAtm(){if(!me){location.hash='#/login';return}const [a,c,w]=await Promise.all([api('/banking/accounts'),api('/banking/cards'),api('/banking/atm')]);const names={saliyah:'بنك الصالية',national:'البنك الوطني الصالي',development:'بنك التنمية الصالي'};const opts=a.accounts.map(x=>`<option value=\"${safe(x.id)}\">${names[x.bank]}</option>`).join('');page('البطاقات والصرافات',`<div class=\"notice\">بطاقات ونقد داخلي للمحاكاة فقط، لا تعمل في أجهزة الدفع الحقيقية.</div><div class=\"card\"><h3>النقد الذي تملكه</h3><h2>${Number(w.cash).toLocaleString('ar-SA')} ريال صالي</h2></div><h2>بطاقاتي</h2><div class=\"grid\">${c.cards.map(x=>`<div class=\"card\"><h3>${names[x.bank]}</h3><p>•••• ${safe(x.last4)}</p><p class=\"muted\">${x.status==='active'?'نشطة':'مجمدة'}</p><button class=\"btn outline card-toggle\" data-id=\"${safe(x.id)}\" data-status=\"${x.status==='active'?'frozen':'active'}\">${x.status==='active'?'تجميد':'إعادة تفعيل'}</button></div>`).join('')||'<p class=\"empty\">لا توجد بطاقات.</p>'}</div><form class=\"card form\" id=\"issueCard\"><h3>إصدار بطاقة داخلية</h3><label class=\"field\">الحساب<select class=\"input\" name=\"account_id\" required>${opts}</select></label><button class=\"btn\" ${a.accounts.length?'':'disabled'}>إصدار بطاقة</button><p role=\"status\"></p></form><form class=\"card form\" id=\"atmForm\"><h3>الصراف الداخلي</h3><label class=\"field\">الحساب<select class=\"input\" name=\"account_id\" required>${opts}</select></label><label class=\"field\">نوع العملية<select class=\"input\" name=\"kind\"><option value=\"withdraw\">سحب إلى المحفظة النقدية</option><option value=\"deposit\">إيداع من المحفظة النقدية</option></select></label><label class=\"field\">المبلغ<input class=\"input\" name=\"amount\" type=\"number\" min=\"1\" max=\"1000000\" step=\"1\" required></label><button class=\"btn gold\" ${a.accounts.length?'':'disabled'}>تنفيذ العملية</button><p role=\"status\"></p></form><h2>آخر عمليات الصراف</h2>${w.operations.map(x=>`<div class=\"card\"><b>${x.kind==='withdraw'?'سحب':'إيداع'} — ${Number(x.amount).toLocaleString('ar-SA')} ريال صالي</b><p class=\"muted\">${safe(x.created_at)}</p></div>`).join('')||'<p class=\"empty\">لا توجد عمليات.</p>'}`);for(const b of document.querySelectorAll('.card-toggle'))b.onclick=async()=>{try{await post('/banking/cards/status',{id:b.dataset.id,status:b.dataset.status});await cardsAtm()}catch(e){uiNotice(e.message)}};for(const [sel,url] of [['#issueCard','/banking/cards'],['#atmForm','/banking/atm']])document.querySelector(sel).onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(sel==='#atmForm')data.amount=Number(data.amount);try{await post(url,data);await cardsAtm()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\nasync function posPage(){if(!me){location.hash='#/login';return}\n const [accounts,cards,merchants,payments]=await Promise.all([api('/banking/accounts'),api('/banking/cards'),api('/pos/merchants'),api('/pos/payments')]);\n const choices=accounts.accounts.map(a=>`<option value=\"${safe(a.id)}\">${safe(a.bank)} — ${safe(a.iban||a.id)} — ${Number(a.balance).toLocaleString('ar-SA')} ريال</option>`).join('');\n page('نقاط البيع والإيصالات',`<div class=\"notice\">نقاط البيع تعمل داخل محاكاة المملكة الصالية فقط، ولا تقبل بطاقات أو أموالًا حقيقية. رمز الدفع يُرسل إلى البريد الداخلي.</div>\n <div class=\"grid\"><form class=\"card form\" id=\"merchantForm\"><h3>تسجيل متجر</h3><label class=\"field\">اسم المتجر<input class=\"input\" name=\"name\" minlength=\"3\" maxlength=\"100\" required></label><label class=\"field\">حساب استقبال المدفوعات<select class=\"input\" name=\"account_id\">${choices}</select></label><button class=\"btn\" ${accounts.accounts.length?'':'disabled'}>إنشاء متجر</button><p role=\"status\"></p></form>\n <form class=\"card form\" id=\"paymentForm\"><h3>طلب دفع من عميل</h3><label class=\"field\">المتجر<select class=\"input\" name=\"merchant_id\">${merchants.merchants.map(m=>`<option value=\"${safe(m.id)}\">${safe(m.name)}</option>`).join('')}</select></label><label class=\"field\">آيبان حساب العميل الصالي<input class=\"input\" name=\"customer_iban\" dir=\"ltr\" required minlength=\"29\" maxlength=\"80\"></label><label class=\"field\">المبلغ بالريال الصالي<input class=\"input\" name=\"amount\" type=\"number\" min=\"1\" max=\"1000000\" step=\"1\" required></label><label class=\"field\">وصف المشتريات<input class=\"input\" name=\"description\" maxlength=\"200\"></label><button class=\"btn gold\" ${merchants.merchants.length?'':'disabled'}>إرسال طلب الدفع</button><p role=\"status\"></p></form></div>\n <h2>طلبات الدفع والإيصالات</h2>${payments.payments.map(p=>`<div class=\"card\"><b>${safe(p.merchant)} — ${Number(p.amount).toLocaleString('ar-SA')} ريال صالي</b><p>${safe(p.description)}</p><div class=\"muted\">العميل: ${safe(p.customer)} · الحالة: ${p.status==='paid'?'مدفوع':p.status==='cancelled'?'ملغي':'بانتظار الدفع'} · ${safe(p.created_at)}</div><small>رقم الإيصال/الطلب: ${safe(p.id)}</small>${p.paid_at?`<div class=\"muted\">تاريخ الدفع: ${safe(p.paid_at)}</div>`:''}\n ${p.status==='pending'&&p.customer===me.username?`<div class=\"actions\"><input class=\"input\" id=\"account-${safe(p.id)}\" placeholder=\"آيبان حسابك الصالي\" aria-label=\"آيبان الحساب البنكي\" required><button class=\"btn pos-auth\" data-id=\"${safe(p.id)}\" ${accounts.accounts.length?'':'disabled'}>طلب رمز التأكيد</button><form class=\"pos-confirm\" data-id=\"${safe(p.id)}\"><input class=\"input\" name=\"code\" inputmode=\"numeric\" pattern=\"[0-9]{6}\" maxlength=\"6\" placeholder=\"رمز من 6 أرقام\" required><button class=\"btn gold\">تأكيد الدفع</button><span role=\"status\"></span></form></div>`:''}\n ${p.status==='pending'&&p.customer===me.username&&p.amount>=4&&p.amount<=5000?`<form class=\"pos-installment form\" data-id=\"${safe(p.id)}\"><label class=\"field\">الشراء بالتقسيط<select class=\"input\" name=\"provider\"><option value=\"tabby\">تابي الصالية</option><option value=\"tamara\">تمارا الصالية</option></select></label><button class=\"btn gold\">تأكيد الشراء بأربعة أقساط</button><span role=\"status\"></span></form>`:''}\n ${p.status==='pending'?`<button class=\"btn outline pos-cancel\" data-id=\"${safe(p.id)}\">إلغاء الطلب</button>`:''}</div>`).join('')||'<div class=\"empty\">لا توجد طلبات دفع.</div>'}`);\n for(const [id,path] of [['merchantForm','/pos/merchant'],['paymentForm','/pos/request']])document.getElementById(id).onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));if(id==='paymentForm')b.amount=Number(b.amount);try{await post(path,b);await posPage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n for(const b of document.querySelectorAll('.pos-auth'))b.onclick=async()=>{try{await post('/pos/authorize',{payment_id:b.dataset.id,account_id:document.getElementById('account-'+b.dataset.id).value.trim()});b.textContent='أُرسل الرمز إلى الرسائل الداخلية'}catch(err){uiNotice(err.message)}};\n for(const f of document.querySelectorAll('.pos-confirm'))f.onsubmit=async e=>{e.preventDefault();try{await post('/pos/confirm',{payment_id:f.dataset.id,code:new FormData(f).get('code')});await posPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\n for(const f of document.querySelectorAll('.pos-installment'))f.onsubmit=async e=>{e.preventDefault();const provider=new FormData(f).get('provider');if(!await uiConfirm('تأكيد الشراء بالتقسيط؟ سيُودع كامل المبلغ في حساب المتجر وتصبح الأقساط مستحقة عليك.'))return;try{await post('/installments/checkout',{payment_id:f.dataset.id,provider});await posPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\n for(const b of document.querySelectorAll('.pos-cancel'))b.onclick=async()=>{try{await post('/pos/cancel',{payment_id:b.dataset.id});await posPage()}catch(err){uiNotice(err.message)}};\n}\nasync function telecom(){if(!me){location.hash='#/login';return}\n const [lr,ar]=await Promise.all([api('/telecom/lines'),api('/banking/accounts')]);const lines=lr.lines,accounts=ar.accounts;\n const opts=lines.map(l=>`<option value=\"${safe(l.id)}\">${safe(l.number)} — ${safe(l.carrier.toUpperCase())}</option>`).join('');\n const banks={saliyah:'بنك الصالية',national:'البنك الوطني الصالي',development:'بنك التنمية الصالي'};\n const accountOpts=accounts.map(a=>`<option value=\"${safe(a.id)}\">${banks[a.bank]||safe(a.bank)} — ${Number(a.balance).toLocaleString('ar-SA')} ريال صالي</option>`).join('');\n page('الجوال والاتصالات الصالية',`<div class=\"actions\"><a class=\"btn gold\" href=\"#/absher\">فتح أبشر الصالية — الخدمات الوطنية</a><a class=\"btn\" href=\"#/sim-directory\">دليل أرقام شرائح البوتات 🤖</a></div><div class=\"notice\">خدمات رسمية داخل المملكة الصالية الافتراضية. العملة المستخدمة في جميع الخدمات هي الريال الصالي، والأسعار والمبالغ بالريال الصالي، ولا تُجرى مكالمات أو مدفوعات حقيقية.</div>\n <div class=\"grid\"><form class=\"card form\" id=\"newLine\"><h3>إصدار شريحة</h3><label class=\"field\">الشركة<select class=\"input\" name=\"carrier\"><option value=\"stc\">STC الصالية</option><option value=\"zain\">زين الصالية</option></select></label><button class=\"btn\">إصدار رقم</button><p role=\"status\"></p></form>\n <form class=\"card form\" id=\"newPlan\"><h3>شراء باقة وخصم رسومها</h3><label class=\"field\">الشريحة<select class=\"input\" name=\"line_id\">${opts}</select></label><label class=\"field\">الباقة<select class=\"input\" name=\"plan\"><option value=\"stc_basic\">STC سوا بيسك — 34.50 ريال صالي / 1 جيجابايت</option><option value=\"stc_50\">STC سوا 50 — 57.50 ريال صالي / 2 جيجابايت</option><option value=\"stc_120\">STC سوا 120 — 138 ريال صالي / 45 جيجابايت</option><option value=\"zain_flex69\">زين فليكس 69 — 79.35 ريال صالي / 10 جيجابايت</option><option value=\"zain_flex109\">زين فليكس 109 — 125.35 ريال صالي / 35 جيجابايت</option></select></label><label class=\"field\">الحساب الذي تُخصم منه الرسوم<select class=\"input\" name=\"account_id\" required>${accountOpts}</select></label><button class=\"btn gold\" ${lines.length&&accounts.length?'':'disabled'}>شراء وتفعيل</button><p role=\"status\"></p></form></div>\n <h2>شرائحي واستهلاك البيانات</h2><div class=\"grid\">${lines.map(l=>`<div class=\"card\"><h3>${safe(l.number)}</h3><p>${safe(l.carrier.toUpperCase())} · ${safe(l.plan_name||'بدون باقة')}</p><p>المستهلك: ${Math.max(0,Number(l.data_mb)-Number(l.data_remaining_mb))} ميجابايت · المتبقي: ${Number(l.data_remaining_mb)} ميجابايت</p><p class=\"muted\">انتهاء الباقة: ${safe(l.expires_at||'—')}</p><button class=\"btn browse\" data-line=\"${safe(l.id)}\">تصفح صفحة صالية (1 ميجابايت)</button><p class=\"muted\">يُخصم 1 ميجابايت عند فتح الصفحة داخل المحاكاة.</p></div>`).join('')||'<p class=\"empty\">لا توجد شرائح.</p>'}</div>\n <h2>الرسائل الداخلية</h2><form class=\"card form\" id=\"sendSms\"><label class=\"field\">من شريحة<select class=\"input\" name=\"line_id\">${opts}</select></label><label class=\"field\">المستلم<input class=\"input\" name=\"to_number\" pattern=\"(?:05[0-9]{8}|SIM-[0-9]{9})\" placeholder=\"05XXXXXXXX أو SIM-000000001\" required></label><label class=\"field\">الرسالة<textarea class=\"input\" name=\"body\" maxlength=\"500\" required></textarea></label><button class=\"btn\" ${lines.length?'':'disabled'}>إرسال</button><p role=\"status\"></p></form><div class=\"card\"><h3>صندوق الرسائل</h3><select class=\"input\" id=\"smsLine\">${opts}</select><div id=\"smsList\"></div></div>`);\n for(const [id,path] of [['newLine','/telecom/lines'],['newPlan','/telecom/plan'],['sendSms','/telecom/sms']])document.getElementById(id).onsubmit=async e=>{e.preventDefault();try{const r=await post(path,Object.fromEntries(new FormData(e.target)));if(r.receipt_id)uiNotice('تم الخصم والتفعيل. رقم الإيصال: '+r.receipt_id);await telecom()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n for(const b of document.querySelectorAll('.browse'))b.onclick=async()=>{try{const r=await post('/telecom/browse',{line_id:b.dataset.line});uiNotice('استهلكت '+r.used_mb+' ميجابايت. المتبقي '+r.remaining_mb+' ميجابايت.');await telecom()}catch(e){uiNotice(e.message)}};\n const select=document.getElementById('smsLine');const load=async()=>{if(!select.value){document.getElementById('smsList').textContent='أصدر شريحة أولًا';return}try{const r=await api('/telecom/sms?line='+encodeURIComponent(select.value));document.getElementById('smsList').innerHTML=r.messages.map(m=>`<div class=\"card\"><b>${safe(m.from_number)} ← ${safe(m.to_number)}</b><p>${safe(m.body)}</p>${m.bot_reply?`<p class=\"notice\">🤖 ${safe(m.bot_reply)}</p>`:m.status==='pending_bot'?`<p class=\"muted\">الرد الآلي قيد الانتظار</p>`:''}</div>`).join('')||'<p>لا توجد رسائل.</p>'}catch(e){document.getElementById('smsList').textContent=e.message}};select.onchange=load;await load();\n}\nasync function absherPage(skipCharge=false){\n if(!me){location.hash='#/login';return}\n const lines=(await api('/telecom/lines')).lines.filter(l=>l.status==='active'&&l.data_remaining_mb>0&&l.expires_at&&new Date(l.expires_at.replace(' ','T')+'Z')>new Date());\n const selected=sessionStorage.getItem('saliyah_absher_line');\n if(!selected||!lines.some(l=>l.id===selected)){\n page('أبشر الصالية — اتصال الإنترنت',`<div class=\"notice\">الدخول إلى أبشر الصالية يستهلك 1 ميجابايت من باقة الإنترنت الصالية لكل فتح أو عملية. لا تُستهلك بيانات شركة اتصال حقيقية.</div><form class=\"card form\" id=\"absherConnect\"><label class=\"field\">اختر شريحة الإنترنت<select class=\"input\" name=\"line_id\">${lines.map(l=>`<option value=\"${safe(l.id)}\">${safe(l.number)} — المتبقي ${l.data_remaining_mb} ميجابايت</option>`).join('')}</select></label><button class=\"btn gold\" ${lines.length?'':'disabled'}>اتصال بأبشر الصالية</button><p role=\"status\"></p></form><a href=\"#/telecom\">شراء باقة إنترنت</a>`);\n document.getElementById('absherConnect').onsubmit=async e=>{e.preventDefault();try{const line_id=new FormData(e.target).get('line_id');await post('/absher/access',{line_id});sessionStorage.setItem('saliyah_absher_line',line_id);await absherPage(true)}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};return;\n }\n if(!skipCharge){try{await post('/absher/access',{line_id:selected})}catch(e){sessionStorage.removeItem('saliyah_absher_line');uiNotice(e.message);return await absherPage()}}\n const r=await api('/absher/overview');const labels={identity:'الهوية الوطنية',passport:'الجوازات',residency:'الإقامة',vehicle_registration:'تسجيل مركبة',vehicle_transfer:'نقل ملكية مركبة',driving_license:'رخصة القيادة',weapon_registration:'طلب تسجيل سلاح',weapon_renewal:'تجديد تسجيل سلاح',travel_permission:'تصريح سفر',civil_record:'السجل المدني',other:'خدمة وطنية أخرى'};\n let admin=null;if(me.role==='king'||me.role==='employee')try{admin=await api('/absher/admin')}catch{}\n page('أبشر الصالية — الخدمات الوطنية',`<div class=\"notice\">بوابة رسمية داخل عالم المملكة الصالية الافتراضي فقط. تسجيل المركبات والأسلحة هنا لا يمثل تسجيلًا حكوميًا حقيقيًا أو تصريحًا بحمل سلاح. الطلبات تخضع للمراجعة.</div>\n <div class=\"grid\"><form class=\"card form\" id=\"absherAsset\"><h3>تسجيل مركبة أو سلاح للمراجعة</h3><label class=\"field\">النوع<select class=\"input\" name=\"kind\"><option value=\"vehicle\">مركبة</option><option value=\"weapon\">سلاح</option></select></label><label class=\"field\">الاسم أو الوصف<input class=\"input\" name=\"name\" minlength=\"2\" maxlength=\"100\" required></label><label class=\"field\">رقم اللوحة أو الرقم التسلسلي<input class=\"input\" name=\"identifier\" minlength=\"3\" maxlength=\"50\" required></label><label class=\"field\">ملاحظات<textarea class=\"input\" name=\"notes\" maxlength=\"500\"></textarea></label><button class=\"btn gold\">تقديم طلب تسجيل</button><p role=\"status\"></p></form>\n <form class=\"card form\" id=\"absherService\"><h3>طلب خدمة وطنية</h3><label class=\"field\">الخدمة<select class=\"input\" name=\"service\">${Object.entries(labels).map(([k,v])=>`<option value=\"${k}\">${v}</option>`).join('')}</select></label><label class=\"field\">تفاصيل الطلب<textarea class=\"input\" name=\"details\" minlength=\"5\" maxlength=\"1000\" required></textarea></label><button class=\"btn gold\">تقديم الطلب</button><p role=\"status\"></p></form></div>\n <h2>مركباتي وأسلحتي المسجلة في النظام</h2>${r.assets.map(x=>`<div class=\"card\"><b>${x.kind==='vehicle'?'مركبة':'سلاح'} — ${safe(x.name)}</b><p>الرقم: ${safe(x.identifier)} · الحالة: ${safe(x.status)}</p></div>`).join('')||'<p class=\"empty\">لا توجد سجلات.</p>'}\n <h2>طلباتي الوطنية</h2>${r.requests.map(x=>`<div class=\"card\"><b>${safe(labels[x.service]||x.service)}</b><p>${safe(x.details)}</p><p>الحالة: ${safe(x.status)} · ${safe(x.created_at)}</p></div>`).join('')||'<p class=\"empty\">لا توجد طلبات.</p>'}\n ${admin?`<h2>مراجعة الطلبات الوطنية</h2>${[...admin.assets.map(x=>({...x,record_kind:'asset'})),...admin.requests.map(x=>({...x,record_kind:'request'}))].map(x=>`<div class=\"card\"><b>${safe(x.username)} — ${safe(x.name||labels[x.service]||x.service)}</b><p>${safe(x.identifier||x.details||'')}</p><div class=\"actions\"><button class=\"btn absherDecision\" data-id=\"${safe(x.id)}\" data-kind=\"${x.record_kind}\" data-decision=\"approved\">اعتماد</button><button class=\"btn outline absherDecision\" data-id=\"${safe(x.id)}\" data-kind=\"${x.record_kind}\" data-decision=\"rejected\">رفض</button></div></div>`).join('')||'<p class=\"empty\">لا توجد طلبات بانتظار المراجعة.</p>'}`:''}`);\n for(const [id,path] of [['absherAsset','/absher/asset'],['absherService','/absher/request']])document.getElementById(id).onsubmit=async e=>{e.preventDefault();try{await post('/absher/access',{line_id:selected});await post(path,Object.fromEntries(new FormData(e.target)));await absherPage(true)}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n for(const b of document.querySelectorAll('.absherDecision'))b.onclick=async()=>{if(!await uiConfirm('تأكيد القرار؟'))return;try{await post('/absher/access',{line_id:selected});await post('/absher/decision',{id:b.dataset.id,kind:b.dataset.kind,decision:b.dataset.decision});await absherPage(true)}catch(e){uiNotice(e.message)}};\n}\nasync function bordersPage(){if(!me){location.hash='#/login';return}const [posts,moves,customs]=await Promise.all([api('/borders/posts'),api('/borders/movements'),api('/borders/customs')]);const options=posts.posts.map(p=>`<option value=\"${safe(p.id)}\">${safe(p.name)}</option>`).join('');page('المنافذ الحدودية والجمارك',`<div class=\"notice\">هذا نظام حدود وجمارك داخلي للمملكة الصالية فقط. العبور لا يُسجّل إلا لوثيقة مسجلة وصالحة ودون تعميم نشط.</div><div class=\"grid\">${posts.posts.map(p=>`<div class=\"card\"><h3>${safe(p.name)}</h3><p class=\"muted\">${safe(p.profile)}</p></div>`).join('')}</div><div class=\"grid\"><form class=\"card form\" id=\"borderCheck\"><h3>فحص وثيقة السفر</h3><label class=\"field\">رقم الوثيقة<input class=\"input\" name=\"number\" required></label><button class=\"btn\">فحص</button><p role=\"status\"></p></form><form class=\"card form\" id=\"borderMovement\"><h3>تسجيل عبور</h3><label class=\"field\">المنفذ<select class=\"input\" name=\"post_id\">${options}</select></label><label class=\"field\">رقم الوثيقة<input class=\"input\" name=\"number\" required></label><label class=\"field\">الحركة<select class=\"input\" name=\"direction\"><option value=\"entry\">دخول</option><option value=\"exit\">خروج</option></select></label><label class=\"field\">سبب العبور<input class=\"input\" name=\"purpose\" required maxlength=\"250\"></label><button class=\"btn gold\">تسجيل الحركة</button><p role=\"status\"></p></form><form class=\"card form\" id=\"customsNew\"><h3>إقرار جمركي</h3><label class=\"field\">المنفذ<select class=\"input\" name=\"post_id\">${options}</select></label><label class=\"field\">وصف البضاعة<input class=\"input\" name=\"description\" maxlength=\"500\" required></label><label class=\"field\">الكمية<input class=\"input\" name=\"quantity\" type=\"number\" min=\"1\" max=\"1000000\" required></label><button class=\"btn\">تسجيل الإقرار</button><p role=\"status\"></p></form></div><h2>آخر حركات العبور</h2>${moves.movements.map(m=>`<div class=\"card\"><b>${m.direction==='entry'?'دخول':'خروج'} — ${safe(m.full_name)}</b><p class=\"muted\">${safe(m.post)} · ${safe(m.created_at)} · ${safe(m.number)}</p><p>${safe(m.purpose)}</p></div>`).join('')||'<div class=\"empty\">لا توجد حركات مسجلة.</div>'}<h2>الإقرارات الجمركية</h2>${customs.declarations.map(c=>`<div class=\"card\"><b>${safe(c.description)}</b><p class=\"muted\">${safe(c.post)} · الكمية ${c.quantity} · ${safe(c.created_at)}</p><label class=\"field\">الحالة<select class=\"input customs-status\" data-id=\"${safe(c.id)}\"><option value=\"submitted\" ${c.status==='submitted'?'selected':''}>مقدم</option><option value=\"inspecting\" ${c.status==='inspecting'?'selected':''}>تحت الفحص</option><option value=\"cleared\" ${c.status==='cleared'?'selected':''}>مفسوح</option><option value=\"held\" ${c.status==='held'?'selected':''}>محتجز</option></select></label></div>`).join('')||'<div class=\"empty\">لا توجد إقرارات.</div>'}`);for(const [id,url] of [['borderCheck','/borders/check'],['borderMovement','/borders/movement'],['customsNew','/borders/customs']])document.getElementById(id).onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));if(id==='customsNew')b.quantity=Number(b.quantity);try{const r=await post(url,b);if(id==='borderCheck'){f.querySelector('[role=status]').textContent=`نتيجة الفحص: ${r.result} · ${r.document?.full_name||'غير مسجل'} · المرجع ${r.check_id}`}else await bordersPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.customs-status').forEach(el=>el.onchange=async()=>{try{await post('/borders/customs/status',{id:el.dataset.id,status:el.value})}catch(e){uiNotice(e.message);await bordersPage()}})}\n\nasync function educationPage(){if(!me){location.hash='#/login';return}const [inst,apps,trans]=await Promise.all([api('/education/institutions'),api('/education/applications'),api('/education/transcript')]);const sim=inst.can_manage?await api('/education/bot-enrollments').catch(()=>({enrollments:[]})):{enrollments:[]};const levels={primary:'ابتدائي',middle:'متوسط',secondary:'ثانوي',university:'جامعة'};const status={submitted:'قيد المراجعة',accepted:'مقبول',rejected:'مرفوض'};const rating=n=>n>=90?'ممتاز':n>=85?'جيد جداً':n>=80?'جيد':n>=70?'مقبول':'لم يجتز';\npage('التعليم في المملكة الصالية',`<div class=\"notice\">المدارس والجامعات تُضاف من إدارة المملكة، ولا تُفرض رسوم فعلية حاليًا. قبول الطلب لا يعني خصم رسوم أو إصدار شهادة تلقائيًا. لا يمكن الانتقال إلى مرحلة أعلى دون اجتياز المرحلة السابقة بدرجة موثقة 70 أو أكثر.</div>${inst.can_manage?`<form class=\"card form\" id=\"schoolNew\"><h3>إضافة مدرسة أو جامعة</h3><label class=\"field\">الاسم<input class=\"input\" name=\"name\" required maxlength=\"120\"></label><label class=\"field\">المرحلة<select class=\"input\" name=\"level\">${Object.entries(levels).map(([k,v])=>`<option value=\"${k}\">${v}</option>`).join('')}</select></label><label class=\"field\">القطاع<select class=\"input\" name=\"sector\"><option value=\"public\">حكومي</option><option value=\"private\">خاص</option></select></label><label class=\"field\">السعة<input class=\"input\" type=\"number\" name=\"capacity\" min=\"1\" required></label><label class=\"field\">أقل درجة للقبول<input class=\"input\" type=\"number\" name=\"min_grade\" min=\"0\" max=\"100\" value=\"55\" required></label><label class=\"field\">الرسوم الصالية (0 للحكومي)<input class=\"input\" type=\"number\" name=\"fee\" min=\"0\" value=\"0\" required></label><button class=\"btn gold\">إضافة المؤسسة</button><p role=\"status\"></p></form>`:''}<h2>المدارس والجامعات</h2><label class=\"field\">اختر المرحلة الدراسية<select class=\"input\" id=\"eduStage\"><option value=\"\">— اختر المرحلة أولاً —</option>${Object.entries(levels).map(([k,v])=>`<option value=\"${k}\">${v}</option>`).join('')}</select></label><div class=\"grid\">${inst.institutions.map(i=>`<div class=\"card eduInstitution\" data-stage=\"${safe(i.level)}\" style=\"display:none\"><h3>${safe(i.name)}</h3><p class=\"muted\">${levels[i.level]} · ${i.sector==='public'?'حكومي':'خاص'} · المقاعد ${i.capacity} · الحد الأدنى ${i.min_grade}</p><p>الرسوم: ${i.fee} ريال صالي</p><form class=\"form schoolApply\" data-id=\"${safe(i.id)}\" data-stage=\"${safe(i.level)}\"><p class=\"muted\">الدرجات السابقة يتم التحقق منها آلياً من السجل الدراسي. المدرسة قد ترفض الطلب إذا لم تحقق شرط القبول.</p><button class=\"btn\">تقديم طلب</button><p role=\"status\"></p></form></div>`).join('')||'<div class=\"empty\">لم تُضف مؤسسات تعليمية بعد.</div>'}</div><h2>طلبات القبول</h2>${apps.applications.map(x=>`<div class=\"card\"><b>${safe(x.institution_name)}</b><p class=\"muted\">${levels[x.level]||''} · ${status[x.status]||x.status} · ${safe(x.created_at)}${x.previous_grade!==null&&x.previous_grade!==undefined?' · الدرجة السابقة الموثقة: '+x.previous_grade:''}</p>${inst.can_manage&&x.status==='submitted'?`<button class=\"btn reviewEdu\" data-id=\"${safe(x.id)}\" data-status=\"accepted\">قبول</button> <button class=\"btn reviewEdu\" data-id=\"${safe(x.id)}\" data-status=\"rejected\">رفض</button>`:''}${inst.can_manage&&x.status==='accepted'?`<form class=\"form gradeEdu\" data-id=\"${safe(x.id)}\"><label class=\"field\">الدرجة<input class=\"input\" type=\"number\" name=\"grade\" min=\"0\" max=\"100\" step=\"0.01\" required></label><label><input type=\"checkbox\" name=\"retest\"> اختبار إعادة</label><button class=\"btn\">حفظ الدرجة</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<div class=\"empty\">لا توجد طلبات.</div>'}<h2>السجل الدراسي</h2>${trans.grades.map(x=>`<div class=\"card\"><b>${safe(x.institution_name)}</b><p>الدرجة النهائية: ${x.final_grade} / 100 — ${safe(x.result||rating(x.final_grade))} ${x.retest_grade!==null?'(بعد الإعادة)':''}</p><small>${safe(x.updated_at)}</small></div>`).join('')||'<div class=\"empty\">لا توجد درجات مسجلة.</div>'}${inst.can_manage?`<h2>سجلات طلاب المحاكاة 🤖</h2><p class=\"muted\">آخر 100 قيد دراسي للبوتات، ويمكن للملك وموظفي التعليم الاطلاع عليها.</p>${sim.enrollments.map(x=>`<div class=\"card\"><b>🤖 ${safe(x.student_name||x.citizen_id)}</b><p>${safe(x.institution_name||x.institution_id)} · ${safe(x.status)}</p></div>`).join('')||'<div class=\"empty\">لا توجد قيود محاكاة مسجلة.</div>'}`:''}`);\nconst f=document.getElementById('schoolNew');if(f)f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));for(const k of ['capacity','min_grade','fee'])b[k]=Number(b[k]);try{await post('/education/institutions',b);await educationPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\ndocument.getElementById('eduStage')?.addEventListener('change',e=>{document.querySelectorAll('.eduInstitution').forEach(card=>card.style.display=e.target.value&&card.dataset.stage===e.target.value?'block':'none')});\ndocument.querySelectorAll('.schoolApply').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/education/apply',{institution_id:f.dataset.id,stage:f.dataset.stage});await educationPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\nconst eduNew=document.getElementById('schoolNew');if(eduNew){const fees={primary:18000,middle:22000,secondary:26000,university:30000};const refreshFee=()=>{eduNew.elements.fee.value=eduNew.elements.sector.value==='private'?fees[eduNew.elements.level.value]:0};eduNew.elements.sector.onchange=refreshFee;eduNew.elements.level.onchange=refreshFee;}\ndocument.querySelectorAll('.reviewEdu').forEach(b=>b.onclick=async()=>{try{await post('/education/review',{id:b.dataset.id,status:b.dataset.status});await educationPage()}catch(err){uiNotice(err.message)}});\ndocument.querySelectorAll('.gradeEdu').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f);try{await post('/education/grade',{application_id:f.dataset.id,grade:Number(d.get('grade')),retest:d.has('retest')});await educationPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n}\n\nasync function payrollPage(){if(!me){location.hash='#/login';return}const [mine,resignMine,leaveMine,admin,adminResign,adminLeave]=await Promise.all([api('/payroll/mine'),api('/payroll/resignations/mine'),api('/payroll/leave/mine'),me.role==='king'?api('/payroll/admin'):Promise.resolve(null),me.role==='king'?api('/payroll/resignations/admin'):Promise.resolve(null),me.role==='king'?api('/payroll/leave/admin'):Promise.resolve(null)]);\npage('الرواتب وميزانيات جهات العمل',`<div class=\"notice\">جميع المبالغ بالريال الصالي داخل المحاكاة. الصرف يدوي لكل عقد وشهر، ولا يُكرر راتب الشهر نفسه.</div><h2>عقودي ورواتبي</h2>${mine.contracts.map(c=>`<div class=\"card\"><b>${safe(c.title)} — ${safe(c.employer)}</b><p>${c.salary} ريال صالي شهريًا · ${c.active?'نشط':'منتهي/موقوف'}</p>${c.active?`<form class=\"form resignContract\" data-id=\"${safe(c.id)}\"><label class=\"field\">سبب طلب الاستقالة<textarea class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"1000\" required></textarea></label><button class=\"btn outline\">تقديم استقالة</button><p role=\"status\"></p></form><form class=\"form leaveContract\" data-id=\"${safe(c.id)}\"><label class=\"field\">نوع الإجازة<select class=\"input\" name=\"kind\"><option value=\"annual\">سنوية</option><option value=\"sick\">مرضية</option><option value=\"emergency\">طارئة</option><option value=\"unpaid\">بدون راتب</option></select></label><label class=\"field\">من<input class=\"input\" type=\"date\" name=\"start_date\" required></label><label class=\"field\">إلى<input class=\"input\" type=\"date\" name=\"end_date\" required></label><label class=\"field\">السبب<textarea class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"500\" required></textarea></label><button class=\"btn outline\">طلب إجازة</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد عقود بعد.</p>'}<h2>طلباتي الإدارية</h2>${resignMine.resignations.map(x=>`<div class=\"card\"><b>استقالة — ${safe(x.title)}، ${safe(x.employer)}</b><p>الحالة: ${safe(({submitted:'بانتظار القرار',deferred:'مؤجلة',accepted:'مقبولة',withdrawn:'مسحوبة'})[x.status]||x.status)} · ${safe(x.created_at)}</p>${x.status==='submitted'?'<button class=\"btn outline withdrawResign\" data-id=\"'+safe(x.id)+'\">سحب الاستقالة خلال 7 أيام</button>':''}</div>`).join('')}${leaveMine.leaves.map(x=>`<div class=\"card\"><b>إجازة — ${safe(x.title)}</b><p>${safe(x.start_date)} إلى ${safe(x.end_date)} · ${safe(x.status)}</p></div>`).join('')}${mine.payments.map(p=>`<div class=\"card\">راتب ${safe(p.period)} · ${p.amount} ريال صالي · ${safe(p.employer)}</div>`).join('')||'<p class=\"muted\">لا توجد رواتب مصروفة.</p>'}${admin?`<h2>طلبات الاستقالة</h2>${adminResign.resignations.map(x=>`<div class=\"card\"><b>${safe(x.username)} · ${safe(x.employer)}</b><p>${safe(x.reason)} · ${safe(x.status)}</p>${x.status==='submitted'?`<button class=\"btn resignDecision\" data-id=\"${safe(x.id)}\" data-decision=\"accepted\">قبول الاستقالة</button> <button class=\"btn outline resignDefer\" data-id=\"${safe(x.id)}\">تأجيل مسبب</button>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد طلبات استقالة.</p>'}<h2>طلبات الإجازة</h2>${adminLeave.leaves.map(x=>`<div class=\"card\"><b>${safe(x.username)} · ${safe(x.title)}</b><p>${safe(x.start_date)} إلى ${safe(x.end_date)} · ${safe(x.kind)} · ${safe(x.status)}</p>${x.status==='submitted'?`<button class=\"btn leaveDecision\" data-id=\"${safe(x.id)}\" data-decision=\"approved\">اعتماد الإجازة</button> <button class=\"btn outline leaveDecision\" data-id=\"${safe(x.id)}\" data-decision=\"rejected\">رفض بسبب</button>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد طلبات إجازة.</p>'}<h2>ميزانيات الجهات</h2>${admin.budgets.map(b=>`<div class=\"card\"><b>${safe(b.employer)}</b> · ${b.balance} ريال صالي<form class=\"form fundBudget\" data-employer=\"${safe(b.employer)}\"><label class=\"field\">إضافة ميزانية<input class=\"input\" type=\"number\" name=\"amount\" min=\"1\" max=\"100000000\" required></label><button class=\"btn\">تمويل الجهة</button><p role=\"status\"></p></form></div>`).join('')||'<p class=\"empty\">أنشئ عقدًا لتظهر جهة العمل.</p>'}<h2>طلبات مقبولة تنتظر إنشاء عقد</h2>${admin.accepted.map(a=>`<div class=\"card\"><b>${safe(a.username)} — ${safe(a.title)}</b><p>${safe(a.employer)} · ${a.salary} ريال صالي</p><button class=\"btn createContract\" data-id=\"${safe(a.id)}\">إنشاء عقد وظيفي</button></div>`).join('')||'<p class=\"empty\">لا توجد طلبات مقبولة جديدة.</p>'}<h2>العقود</h2>${admin.contracts.map(c=>`<div class=\"card\"><b>${safe(c.username)} — ${safe(c.title)}</b><p>${safe(c.employer)} · ${c.salary} ريال صالي · ${c.active?'نشط':'موقوف'}</p><button class=\"btn toggleContract\" data-id=\"${safe(c.id)}\" data-active=\"${c.active?'false':'true'}\">${c.active?'إيقاف العقد':'تفعيل العقد'}</button> ${c.active?`<form class=\"form paySalary\" data-id=\"${safe(c.id)}\"><label class=\"field\">شهر الراتب (YYYY-MM)<input class=\"input\" type=\"month\" name=\"period\" required></label><button class=\"btn gold\">صرف الراتب</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد عقود.</p>'}<h2>آخر الرواتب المصروفة</h2>${admin.payments.map(p=>`<div class=\"card\">${safe(p.username)} · ${safe(p.employer)} · ${safe(p.period)} · ${p.amount} ريال صالي</div>`).join('')||'<p class=\"empty\">لا توجد عمليات.</p>'}`:''}`);\nconst action=async(el,url,body)=>{try{await post(url,body);await payrollPage()}catch(e){const status=el.closest('form')?.querySelector('[role=status]');if(status)status.textContent=e.message;else uiNotice(e.message)}};\ndocument.querySelectorAll('.resignContract').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(f,'/payroll/resign',{contract_id:f.dataset.id,reason:new FormData(f).get('reason')})});\ndocument.querySelectorAll('.leaveContract').forEach(f=>f.onsubmit=e=>{e.preventDefault();const form=new FormData(f);action(f,'/payroll/leave/request',{contract_id:f.dataset.id,kind:form.get('kind'),start_date:form.get('start_date'),end_date:form.get('end_date'),reason:form.get('reason')})});\ndocument.querySelectorAll('.withdrawResign').forEach(b=>b.onclick=()=>action(b,'/payroll/resign/withdraw',{id:b.dataset.id}));\ndocument.querySelectorAll('.resignDecision').forEach(b=>b.onclick=()=>action(b,'/payroll/resign/decision',{id:b.dataset.id,decision:b.dataset.decision}));\ndocument.querySelectorAll('.resignDefer').forEach(b=>b.onclick=async()=>{const note=await uiPrompt('أدخل سبب تأجيل الاستقالة (بحد أقصى 60 يومًا)');if(note&&note.trim().length>=5)action(b,'/payroll/resign/decision',{id:b.dataset.id,decision:'deferred',note:note.trim()})});\ndocument.querySelectorAll('.leaveDecision').forEach(b=>b.onclick=async()=>{const note=b.dataset.decision==='rejected'?await uiPrompt('اذكر سبب رفض الإجازة'):'';if(b.dataset.decision==='approved'||note&&note.trim().length>=5)action(b,'/payroll/leave/decision',{id:b.dataset.id,decision:b.dataset.decision,note:note||''})});\ndocument.querySelectorAll('.createContract').forEach(b=>b.onclick=()=>action(b,'/payroll/contract',{application_id:b.dataset.id}));document.querySelectorAll('.toggleContract').forEach(b=>b.onclick=()=>action(b,'/payroll/contract/status',{id:b.dataset.id,active:b.dataset.active==='true'}));document.querySelectorAll('.fundBudget').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(f,'/payroll/fund',{employer:f.dataset.employer,amount:Number(new FormData(f).get('amount'))})});document.querySelectorAll('.paySalary').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(f,'/payroll/pay',{contract_id:f.dataset.id,period:new FormData(f).get('period')})});}\n\nasync function bankAdmin(){if(!me){location.hash='#/login';return}if(me.role!=='king'&&me.role!=='employee'){page('غير مخول','');return}const bank=new URLSearchParams(location.hash.split('?')[1]||'').get('bank')||'saliyah';const [a,h]=await Promise.all([api('/bank-admin/accounts?bank='+bank),api('/bank-admin/history?bank='+bank)]);page('إدارة أرصدة البنوك',`<div class=\"notice\">التحكم اليدوي بأرصدة المحاكاة، بما فيها السالبة، يسجل اسم الموظف والسبب والرصيد السابق والجديد.</div><div class=\"actions\">${[['saliyah','بنك الصالية'],['national','البنك الوطني'],['development','بنك التنمية']].map(([id,n])=>`<a class=\"btn outline\" href=\"#/bank-admin?bank=${id}\">${n}</a>`).join('')}</div><form id=\"balanceForm\" class=\"card form\"><label class=\"field\">الحساب<select name=\"account_id\" class=\"input\">${a.accounts.map(x=>`<option value=\"${safe(x.id)}\">${safe(x.username)} — ${safe(x.balance)} ريال</option>`).join('')}</select></label><label class=\"field\">العملية<select name=\"mode\" class=\"input\"><option value=\"set\">تعيين رصيد محدد (يسمح بالسالب)</option><option value=\"add\">زيادة الرصيد</option><option value=\"subtract\">خصم من الرصيد</option></select></label><label class=\"field\">المبلغ<input class=\"input\" type=\"number\" name=\"amount\" step=\"1\" required></label><label class=\"field\">سبب العملية<input class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"300\" required></label><button class=\"btn gold\" ${a.accounts.length?'':'disabled'}>تسجيل التعديل</button><p role=\"status\"></p></form><h2>سجل تعديلات الأرصدة</h2>${h.operations.map(x=>`<div class=\"card\"><b>${safe(x.actor)} · ${safe(x.mode)}</b><p>من ${safe(x.previous_balance)} إلى ${safe(x.new_balance)} ريال</p><p>${safe(x.reason)}</p><small>${safe(x.created_at)}</small></div>`).join('')||'<p class=\"empty\">لا توجد عمليات.</p>'}`);document.querySelector('#balanceForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);try{await post('/bank-admin/adjust',b);await bankAdmin()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\nasync function installmentsPage(){if(!me){location.hash='#/login';return}const [r,a]=await Promise.all([api('/installments/mine'),api('/banking/accounts')]);page('تابي وتمارا الصالية',`<div class=\"notice\">نظام تقسيط داخلي بالريال الصالي، غير مرتبط بتابي أو تمارا الحقيقيتين. الحد الحالي 5000 ريال لكل خدمة.</div><form id=\"installForm\" class=\"card form\"><h3>إنشاء خطة تقسيط</h3><label class=\"field\">الخدمة<select class=\"input\" name=\"provider\"><option value=\"tabby\">تابي الصالية</option><option value=\"tamara\">تمارا الصالية</option></select></label><label class=\"field\">المتجر<input class=\"input\" name=\"merchant\" required minlength=\"2\"></label><label class=\"field\">المبلغ<input class=\"input\" type=\"number\" name=\"amount\" min=\"4\" max=\"1000000\" step=\"1\" required></label><button class=\"btn\">إنشاء أربعة أقساط</button><p role=\"status\"></p></form><h2>خطط التقسيط</h2>${r.plans.map(x=>`<div class=\"card\"><h3>${x.provider==='tabby'?'تابي الصالية':'تمارا الصالية'} — ${safe(x.merchant)}</h3><p>${safe(x.amount)} ريال · ${safe(x.status)}</p><button class=\"btn outline showDues\" data-id=\"${safe(x.id)}\">عرض الأقساط</button><div id=\"dues-${safe(x.id)}\"></div></div>`).join('')||'<p class=\"empty\">لا توجد خطط.</p>'}`);document.querySelector('#installForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);try{await post('/installments/create',b);await installmentsPage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};document.querySelectorAll('.showDues').forEach(btn=>btn.onclick=async()=>{const r=await api('/installments/schedule?id='+encodeURIComponent(btn.dataset.id));const target=document.getElementById('dues-'+btn.dataset.id);target.innerHTML=r.dues.map(d=>`<div class=\"card\"><b>القسط ${d.installment_number}: ${d.amount} ريال</b><p>الاستحقاق: ${safe(d.due_date)} · ${d.paid_at?'مدفوع':'غير مدفوع'}</p>${d.paid_at?'':`<form class=\"payDue\" data-id=\"${safe(d.id)}\"><select class=\"input\" name=\"account_id\">${a.accounts.map(x=>`<option value=\"${safe(x.id)}\">${safe(x.bank)} — ${x.balance}</option>`).join('')}</select><button class=\"btn\" ${a.accounts.length?'':'disabled'}>سداد</button><p role=\"status\"></p></form>`}</div>`).join('');target.querySelectorAll('.payDue').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/installments/pay',{due_id:f.dataset.id,account_id:new FormData(f).get('account_id')});await installmentsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}})})}\nasync function stateBudgetsPage(){if(!me){location.hash='#/login';return}const r=await api('/state-budgets/list');const labels={submitted:'بانتظار مراجعة المالية',finance_approved:'موافقة المالية — بانتظار الملك',finance_rejected:'مرفوض من المالية',king_approved:'معتمد ملكيًا',king_rejected:'مرفوض ملكيًا'};\npage('ميزانية الدولة واعتماد الجهات',`<div class=\"notice\">هذه شاشة اعتماد مقترحات ميزانيات الوزارات والمحافظات. الاعتماد لا يضيف أموالًا تلقائيًا إلى الحسابات أو ميزانيات الرواتب.</div>${r.can_propose?`<form id=\"stateBudgetNew\" class=\"card form\"><h3>اقتراح ميزانية</h3><label class=\"field\">الجهة<input class=\"input\" name=\"entity_name\" minlength=\"3\" maxlength=\"160\" required></label><label class=\"field\">نوع الجهة<select class=\"input\" name=\"entity_type\"><option value=\"ministry\">وزارة</option><option value=\"governorate\">محافظة</option></select></label><label class=\"field\">السنة المالية<input class=\"input\" type=\"number\" name=\"fiscal_year\" min=\"2026\" max=\"2100\" value=\"${new Date().getFullYear()}\" required></label><label class=\"field\">المبلغ بالريال الصالي<input class=\"input\" type=\"number\" name=\"amount\" min=\"1\" max=\"1000000000\" required></label><label class=\"field\">مبررات الطلب<textarea class=\"input\" name=\"justification\" minlength=\"10\" maxlength=\"2000\" required></textarea></label><button class=\"btn gold\">رفع المقترح</button><p role=\"status\"></p></form>`:''}<h2>سجل مقترحات الميزانيات</h2>${r.requests.map(x=>`<div class=\"card\"><h3>${safe(x.entity_name)}</h3><p>${Number(x.amount).toLocaleString('ar-SA')} ريال صالي · ${safe(x.fiscal_year)} · ${safe(labels[x.status]||x.status)}</p><p class=\"muted\">مقدم الطلب: ${safe(x.requester)} · ${safe(x.created_at)}</p><p>${safe(x.justification)}</p>${x.finance_note?`<p>ملاحظة المالية: ${safe(x.finance_note)}</p>`:''}${x.king_note?`<p>القرار الملكي: ${safe(x.king_note)}</p>`:''}${r.can_review&&x.status==='submitted'?`<form class=\"form financeReview\" data-id=\"${safe(x.id)}\"><label class=\"field\">ملاحظة المراجعة<input class=\"input\" name=\"note\" minlength=\"3\" maxlength=\"1000\" required></label><button class=\"btn\" name=\"status\" value=\"finance_approved\">موافقة المالية</button> <button class=\"btn outline\" name=\"status\" value=\"finance_rejected\">رفض المالية</button><p role=\"status\"></p></form>`:''}${r.can_approve&&x.status==='finance_approved'?`<form class=\"form royalReview\" data-id=\"${safe(x.id)}\"><label class=\"field\">ملاحظة القرار<input class=\"input\" name=\"note\" minlength=\"3\" maxlength=\"1000\" required></label><button class=\"btn gold\" name=\"status\" value=\"king_approved\">اعتماد ملكي</button> <button class=\"btn outline\" name=\"status\" value=\"king_rejected\">رفض ملكي</button><p role=\"status\"></p></form>`:''}<button class=\"btn outline budgetEvents\" data-id=\"${safe(x.id)}\">سجل القرارات</button><div id=\"events-${safe(x.id)}\"></div></div>`).join('')||'<p class=\"empty\">لا توجد مقترحات حتى الآن.</p>'}`);\nconst f=document.getElementById('stateBudgetNew');if(f)f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));b.amount=Number(b.amount);b.fiscal_year=Number(b.fiscal_year);try{await post('/state-budgets/propose',b);await stateBudgetsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\nfor(const [cls,url] of [['financeReview','/state-budgets/review'],['royalReview','/state-budgets/royal-decision']])document.querySelectorAll('.'+cls).forEach(f=>f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));b.id=f.dataset.id;b.status=e.submitter.value;try{await post(url,b);await stateBudgetsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\ndocument.querySelectorAll('.budgetEvents').forEach(b=>b.onclick=async()=>{try{const r=await api('/state-budgets/events?id='+encodeURIComponent(b.dataset.id));document.getElementById('events-'+b.dataset.id).innerHTML=r.events.map(x=>`<p class=\"muted\">${safe(x.created_at)} · ${safe(x.actor)} · ${safe(labels[x.new_status]||x.new_status)} · ${safe(x.note)}</p>`).join('')}catch(e){uiNotice(e.message)}})}\n\n\nasync function courtsPage(){if(!me){location.hash='#/login';return}const r=await api('/courts/list');const labels={filed:'مرفوعة',review:'قيد المراجعة',scheduled:'مجدولة',heard:'نُظرت',judged:'صدر حكم',closed:'مغلقة'};\npage('القضاء والمحاماة',`<p><a class=\"btn outline\" href=\"#/justice16\">الشرطة والبلاغات والاستئناف</a> <a class=\"btn outline\" href=\"#/justice17\">النيابة والأدلة وتنفيذ الأحكام</a> <a class=\"btn outline\" href=\"#/justice18\">مذكرات القضايا</a> <a class=\"btn outline\" href=\"#/justice19\">محاضر الجلسات</a> <a class=\"btn outline\" href=\"#/justice20\">تصحيحات المحاضر</a> <a class=\"btn outline\" href=\"#/justice21\">مرفقات القضايا</a> <a class=\"btn outline\" href=\"#/justice23\">دوائر الاستئناف والنقض</a> <a class=\"btn outline\" href=\"#/justice24\">أوامر تنفيذ الأحكام</a></p><div class=\"notice\">نظام قضايا داخلي للمملكة الصالية؛ لا يمثل محكمة أو ترخيص محاماة حقيقيًا.</div><form id=\"courtFile\" class=\"card form\"><h3>رفع قضية جديدة</h3><label class=\"field\">نوع القضية<select class=\"input\" name=\"kind\"><option value=\"civil\">مدنية</option><option value=\"commercial\">تجارية</option><option value=\"administrative\">إدارية</option><option value=\"family\">أحوال شخصية</option><option value=\"criminal\">جزائية</option></select></label><label class=\"field\">عنوان القضية<input class=\"input\" name=\"title\" required minlength=\"5\" maxlength=\"160\"></label><label class=\"field\">اسم المدعى عليه<input class=\"input\" name=\"defendant_name\" required minlength=\"2\" maxlength=\"160\"></label><label class=\"field\">اسم مستخدم المدعى عليه (اختياري لربط حسابه)<input class=\"input\" name=\"defendant_username\"></label><label class=\"field\">وقائع الدعوى<textarea class=\"input\" name=\"statement\" required minlength=\"10\" maxlength=\"5000\"></textarea></label><button class=\"btn gold\">تسجيل القضية</button><p role=\"status\"></p></form>\n${r.my_lawyer?`<div class=\"card\">حالة طلب المحاماة: <b>${safe(r.my_lawyer.status)}</b></div>`:`<form id=\"lawyerApply\" class=\"card form\"><h3>طلب تسجيل محامٍ</h3><label class=\"field\">الاسم المهني<input class=\"input\" name=\"display_name\" required minlength=\"3\"></label><label class=\"field\">رقم الترخيص الداخلي<input class=\"input\" name=\"license_number\" required minlength=\"4\"></label><button class=\"btn\">إرسال طلب الاعتماد</button><p role=\"status\"></p></form>`}\n<h2>القضايا المسجلة لك</h2>${r.cases.map(c=>`<div class=\"card\"><b>${safe(c.reference)} — ${safe(c.title)}</b><p>${safe(labels[c.status]||c.status)} · ${safe(c.created_at)}</p><button class=\"btn outline caseDetail\" data-id=\"${safe(c.id)}\">فتح ملف القضية</button><div id=\"case-${safe(c.id)}\"></div></div>`).join('')||'<p class=\"empty\">لا توجد قضايا.</p>'}<h2>طلبات التوكيل الواردة</h2><div id=\"counselInvites\"></div>${r.can_manage?'<h2>اعتماد المحامين</h2><div id=\"lawyerPending\"></div>':''}`);\nconst f=document.querySelector('#courtFile');f.onsubmit=async e=>{e.preventDefault();try{const x=await post('/courts/file',Object.fromEntries(new FormData(f)));uiNotice('تم تسجيل القضية: '+x.reference);await courtsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\nconst apply=document.querySelector('#lawyerApply');if(apply)apply.onsubmit=async e=>{e.preventDefault();try{await post('/courts/lawyer/apply',Object.fromEntries(new FormData(apply)));await courtsPage()}catch(err){apply.querySelector('[role=status]').textContent=err.message}};\nconst inv=await api('/courts/counsel/invitations');document.querySelector('#counselInvites').innerHTML=inv.invitations.map(x=>`<form class=\"card invite\" data-case=\"${safe(x.case_id)}\" data-client=\"${safe(x.client_id)}\"><b>${safe(x.reference)} — ${safe(x.title)}</b><div class=\"actions\"><button class=\"btn\" name=\"status\" value=\"accepted\">قبول التوكيل</button><button class=\"btn outline\" name=\"status\" value=\"rejected\">رفض</button></div><p role=\"status\"></p></form>`).join('')||'<p class=\"muted\">لا توجد طلبات.</p>';\ndocument.querySelectorAll('.invite').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/courts/counsel/respond',{case_id:f.dataset.case,client_id:f.dataset.client,status:e.submitter.value});await courtsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\nif(r.can_manage){const pending=await api('/courts/lawyer/pending');document.querySelector('#lawyerPending').innerHTML=pending.lawyers.map(l=>`<form class=\"card approveLawyer\" data-id=\"${safe(l.user_id)}\"><b>${safe(l.display_name)} · ${safe(l.license_number)}</b><button class=\"btn\" name=\"status\" value=\"active\">اعتماد</button><button class=\"btn outline\" name=\"status\" value=\"suspended\">رفض/تعليق</button><p role=\"status\"></p></form>`).join('')||'<p class=\"muted\">لا توجد طلبات.</p>';document.querySelectorAll('.approveLawyer').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/courts/lawyer/approve',{user_id:f.dataset.id,status:e.submitter.value});await courtsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}})}\ndocument.querySelectorAll('.caseDetail').forEach(b=>b.onclick=async()=>{const d=await api('/courts/detail?id='+encodeURIComponent(b.dataset.id)),c=d.case,t=document.getElementById('case-'+b.dataset.id);t.innerHTML=`<div class=\"notice\"><b>الوقائع</b><p>${safe(c.statement)}</p>${c.judgment?`<b>الحكم</b><p>${safe(c.judgment)}</p>`:''}</div><p><a class=\"btn outline\" href=\"#/justice18/${safe(c.id)}\">مذكرات القضية والمرافعات</a> <a class=\"btn outline\" href=\"#/justice19/${safe(c.id)}\">محاضر الجلسات</a> <a class=\"btn outline\" href=\"#/justice20/${safe(c.id)}\">ملحقات المحاضر</a> <a class=\"btn outline\" href=\"#/justice21/${safe(c.id)}\">مرفقات القضية</a></p><h3>الجلسات</h3>${d.hearings.map(h=>`<p>${safe(h.starts_at)} · ${safe(h.location)} · ${safe(h.notes)}</p>`).join('')||'<p>لا توجد جلسات.</p>'}<h3>المحامون</h3>${d.counsel.map(x=>`<p>${safe(x.display_name)} · ${safe(x.status)}</p>`).join('')||'<p>لا يوجد توكيل.</p>'}${d.is_party?`<form class=\"form counselRequest\"><label class=\"field\">طلب توكيل محامٍ<select class=\"input\" name=\"lawyer_id\">${r.lawyers.map(x=>`<option value=\"${safe(x.user_id)}\">${safe(x.display_name)}</option>`).join('')}</select></label><button class=\"btn\" ${r.lawyers.length?'':'disabled'}>إرسال طلب التوكيل</button><p role=\"status\"></p></form>`:''}${d.can_manage?`<form class=\"form courtHearing\"><h3>تحديد جلسة</h3><label class=\"field\">التاريخ والوقت<input class=\"input\" type=\"datetime-local\" name=\"starts_at\" required></label><label class=\"field\">المكان<input class=\"input\" name=\"location\" required minlength=\"3\"></label><label class=\"field\">ملاحظات<input class=\"input\" name=\"notes\"></label><button class=\"btn\">إضافة الجلسة</button><p role=\"status\"></p></form><form class=\"form courtManage\"><h3>قرار المحكمة</h3><label class=\"field\">الحالة<select class=\"input\" name=\"status\">${Object.entries(labels).filter(([k])=>k!=='filed').map(([k,v])=>`<option value=\"${k}\">${v}</option>`).join('')}</select></label><label class=\"field\">ملاحظة القرار<textarea class=\"input\" name=\"note\" required minlength=\"3\"></textarea></label><label class=\"field\">نص الحكم (مطلوب عند اختيار صدر حكم)<textarea class=\"input\" name=\"judgment\"></textarea></label><button class=\"btn gold\">حفظ القرار</button><p role=\"status\"></p></form>`:''}<h3>سجل القضية</h3>${d.events.map(x=>`<p class=\"muted\">${safe(x.created_at)} · ${safe(x.event_type)} · ${safe(x.details)}</p>`).join('')}`;\nfor(const [selector,url] of [['.counselRequest','/courts/counsel/request'],['.courtHearing','/courts/hearing'],['.courtManage','/courts/manage']]){const f=t.querySelector(selector);if(f)f.onsubmit=async e=>{e.preventDefault();try{await post(url,{...Object.fromEntries(new FormData(f)),case_id:b.dataset.id});await courtsPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}}}})}\n\nasync function justice16Page(){if(!me){location.hash='#/login';return}const [reports,appeals]=await Promise.all([api('/justice16/reports'),api('/justice16/appeals')]);\npage('الشرطة والاستئناف',`<div class=\"notice\">جميع البلاغات والاستئنافات داخل المملكة الصالية فقط.</div><form id=\"policeFile\" class=\"card form\"><h3>تسجيل بلاغ</h3><label class=\"field\">النوع<select class=\"input\" name=\"kind\"><option value=\"security\">أمني</option><option value=\"traffic\">مروري</option><option value=\"fraud\">احتيال</option><option value=\"other\">أخرى</option></select></label><label class=\"field\">العنوان<input class=\"input\" name=\"title\" required minlength=\"5\" maxlength=\"150\"></label><label class=\"field\">التفاصيل<textarea class=\"input\" name=\"details\" required minlength=\"10\" maxlength=\"4000\"></textarea></label><button class=\"btn gold\">تسجيل البلاغ</button><p role=\"status\"></p></form><h2>البلاغات</h2>${reports.reports.map(x=>`<div class=\"card\"><b>${safe(x.reference)} · ${safe(x.title)}</b><p>${safe(x.status)} · ${safe(x.created_at)}</p>${reports.can_manage?`<form class=\"form policeUpdate\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"review\">مراجعة</option><option value=\"investigating\">تحقيق</option><option value=\"referred\">إحالة</option><option value=\"closed\">إغلاق</option></select><input class=\"input\" name=\"note\" placeholder=\"ملاحظة الإجراء\" required minlength=\"3\"><button class=\"btn\">حفظ</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"muted\">لا توجد بلاغات.</p>'}<h2>استئناف الأحكام</h2><form id=\"appealFile\" class=\"card form\"><label class=\"field\">معرّف القضية (من ملف القضية)<input class=\"input\" name=\"case_id\" required></label><label class=\"field\">أسباب الاستئناف<textarea class=\"input\" name=\"reason\" required minlength=\"10\"></textarea></label><button class=\"btn\">تقديم الاستئناف</button><p role=\"status\"></p></form>${appeals.appeals.map(x=>`<div class=\"card\"><b>${safe(x.reference)} — ${safe(x.status)}</b><p>${safe(x.reason)}</p>${appeals.can_manage?`<form class=\"form appealReview\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"accepted\">قبول النظر</option><option value=\"rejected\">رفض</option><option value=\"decided\">فصل في الاستئناف</option></select><textarea class=\"input\" name=\"note\" required minlength=\"5\" placeholder=\"تسبيب القرار\"></textarea><button class=\"btn\">اعتماد الإجراء</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"muted\">لا توجد استئنافات.</p>'}`);\nfor(const [sel,url,id] of [['#policeFile','/justice16/reports',false],['#appealFile','/justice16/appeals',false],['.policeUpdate','/justice16/reports/update',true],['.appealReview','/justice16/appeals/review',true]])document.querySelectorAll(sel).forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(f));if(id)b.id=f.dataset.id;const r=await post(url,b);if(r.reference)uiNotice('رقم البلاغ: '+r.reference);await justice16Page()}catch(err){f.querySelector('[role=status]').textContent=err.message}})}\n\nasync function justice17Page(){if(!me){location.hash='#/login';return}const [ex,ref]=await Promise.all([api('/justice17/executions'),api('/justice17/referrals').catch(()=>({referrals:[],judge:false,officer:false}))]);\npage('النيابة والأدلة وتنفيذ الأحكام',`<div class=\"notice\">سجلات قضائية داخلية للمملكة الصالية. الأدلة هنا أوصاف نصية، وليست مرفقات موثقة.</div><h2>ملفات التنفيذ</h2><p><a class=\"btn outline\" href=\"#/justice24\">إدارة التنفيذ عبر الأوامر القضائية</a></p>${ex.executions.map(x=>`<div class=\"card\"><b>${safe(x.reference)} — ${safe(x.status)}</b><p>${safe(x.instructions)}</p><p class=\"muted\">${safe(x.last_note||'')}</p>${false?`<form class=\"form executionUpdate\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"in_progress\">جار التنفيذ</option><option value=\"suspended\">معلق</option><option value=\"completed\">مكتمل</option></select><textarea class=\"input\" name=\"note\" required minlength=\"5\" placeholder=\"ملاحظات التنفيذ\"></textarea><button class=\"btn\">تحديث</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p>لا توجد ملفات تنفيذ.</p>'}${ex.can_manage?`<form id=\"executionOpen\" class=\"card form\"><h3>فتح ملف تنفيذ حكم</h3><input class=\"input\" name=\"case_id\" placeholder=\"معرف القضية المحكوم فيها\" required><textarea class=\"input\" name=\"instructions\" placeholder=\"تعليمات التنفيذ\" minlength=\"10\" required></textarea><button class=\"btn gold\">فتح الملف</button><p role=\"status\"></p></form>`:''}<h2>فهرس الأدلة</h2><form id=\"evidenceSearch\" class=\"card form\"><input class=\"input\" name=\"case_id\" placeholder=\"معرف القضية\" required><button class=\"btn\">عرض الأدلة</button><p role=\"status\"></p><div id=\"evidenceList\"></div></form><form id=\"evidenceAdd\" class=\"card form\"><h3>إضافة وصف دليل لقضية تملك حق الاطلاع عليها</h3><input class=\"input\" name=\"case_id\" placeholder=\"معرف القضية\" required><input class=\"input\" name=\"title\" placeholder=\"عنوان الدليل\" minlength=\"3\" required><textarea class=\"input\" name=\"description\" placeholder=\"وصف الدليل (لا تضع معلومات حساسة حقيقية)\" minlength=\"10\" required></textarea><button class=\"btn\">تسجيل الوصف</button><p role=\"status\"></p></form>${ref.judge||ref.officer?`<h2>إحالات النيابة</h2>${ref.referrals.map(x=>`<div class=\"card\"><b>${safe(x.report_reference)} — ${safe(x.status)}</b><p>${safe(x.summary)}</p>${ref.judge&&['referred','reviewing'].includes(x.status)?`<form class=\"form referralReview\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"reviewing\">قيد المراجعة</option><option value=\"filed_to_court\">أحيلت لقضية</option><option value=\"dismissed\">حفظ الإحالة</option></select><input class=\"input\" name=\"case_id\" placeholder=\"معرف القضية (عند الإحالة للمحكمة)\"><textarea class=\"input\" name=\"note\" required minlength=\"5\" placeholder=\"سبب القرار\"></textarea><button class=\"btn\">حفظ</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p>لا توجد إحالات.</p>'}${ref.officer?`<form id=\"referralNew\" class=\"card form\"><h3>إحالة بلاغ للنيابة</h3><input class=\"input\" name=\"report_id\" placeholder=\"معرف البلاغ قيد التحقيق\" required><textarea class=\"input\" name=\"summary\" required minlength=\"10\" placeholder=\"ملخص الإحالة\"></textarea><button class=\"btn\">إحالة</button><p role=\"status\"></p></form>`:''}`:''}`);\nfor(const [sel,url,hasId] of [['#executionOpen','/justice17/executions',false],['.executionUpdate','/justice17/executions/update',true],['#evidenceAdd','/justice17/evidence',false],['#referralNew','/justice17/referrals',false],['.referralReview','/justice17/referrals/review',true]])document.querySelectorAll(sel).forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(f));if(hasId)b.id=f.dataset.id;await post(url,b);await justice17Page()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\nconst f=document.querySelector('#evidenceSearch');f.onsubmit=async e=>{e.preventDefault();try{const d=await api('/justice17/evidence?case_id='+encodeURIComponent(new FormData(f).get('case_id')));f.querySelector('#evidenceList').innerHTML=d.evidence.map(x=>`<div class=\"card\"><b>${safe(x.title)}</b><p>${safe(x.description)}</p><small>${safe(x.author)} · ${safe(x.created_at)}</small></div>`).join('')||'لا توجد أدلة مسجلة.'}catch(err){f.querySelector('[role=status]').textContent=err.message}}}\n\nasync function justice18Page(){\n if(!me){location.hash='#/login';return}\n page('مذكرات القضايا والمرافعات',`<div class=\"notice\">مذكرات نصية داخلية للقضايا الصالية، لا تتضمن رفع ملفات أو توقيعات قانونية حقيقية.</div>\n <form class=\"card form\" id=\"submissionLookup\"><h3>فتح ملف المذكرات</h3><label class=\"field\">معرف القضية (من صفحة القضاء والمحاماة)<input class=\"input\" name=\"case_id\" required minlength=\"10\"></label><button class=\"btn\">عرض المذكرات</button><p role=\"status\"></p></form><div id=\"submissionArea\"></div>`);\n const f=document.querySelector('#submissionLookup');const initial=(location.hash.split('/')[2]||'');if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);f.onsubmit=async e=>{e.preventDefault();const case_id=new FormData(f).get('case_id');try{\n const r=await api('/justice18/submissions?case_id='+encodeURIComponent(case_id));const el=document.querySelector('#submissionArea');el.innerHTML=`<form class=\"card form\" id=\"submissionNew\"><h3>إيداع مذكرة جديدة</h3><label class=\"field\">نوع المذكرة<select class=\"input\" name=\"kind\"><option value=\"statement\">مذكرة</option><option value=\"response\">رد</option><option value=\"evidence_note\">وصف دليل</option><option value=\"motion\">طلب إجرائي</option></select></label><label class=\"field\">العنوان<input class=\"input\" name=\"title\" minlength=\"5\" maxlength=\"160\" required></label><label class=\"field\">المحتوى<textarea class=\"input\" name=\"body\" minlength=\"10\" maxlength=\"6000\" required></textarea></label><button class=\"btn gold\">إيداع المذكرة</button><p role=\"status\"></p></form><h3>المذكرات</h3>${r.submissions.map(x=>`<div class=\"card\"><b>${safe(x.title)}</b><p class=\"muted\">${safe(x.kind)} · ${safe(x.author)} · ${safe(x.created_at)} · ${safe(x.status)}</p><p style=\"white-space:pre-wrap\">${safe(x.body)}</p>${x.review_note?`<p>ملاحظة المحكمة: ${safe(x.review_note)}</p>`:''}${r.can_review&&x.status==='submitted'?`<form class=\"form submissionReview\" data-id=\"${safe(x.id)}\"><label class=\"field\">ملاحظة المحكمة<input class=\"input\" name=\"note\" minlength=\"3\" maxlength=\"1000\" required></label><button class=\"btn\" name=\"status\" value=\"reviewed\">تمت المراجعة</button> <button class=\"btn outline\" name=\"status\" value=\"returned\">إعادة للتعديل</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد مذكرات.</p>'}`;\n const nf=document.querySelector('#submissionNew');nf.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice18/submissions',{case_id,...Object.fromEntries(new FormData(nf))});f.requestSubmit()}catch(err){nf.querySelector('[role=status]').textContent=err.message}};\n document.querySelectorAll('.submissionReview').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice18/review',{id:form.dataset.id,status:ev.submitter.value,note:new FormData(form).get('note')});f.requestSubmit()}catch(err){form.querySelector('[role=status]').textContent=err.message}});\n }catch(err){f.querySelector('[role=status]').textContent=err.message}};if(initial)f.requestSubmit();\n}\n\nasync function justice19Page(){\n if(!me){location.hash='#/login';return}\n page('محاضر الجلسات القضائية',`<div class=\"notice\">محاضر جلسات داخلية للمملكة الصالية. لا تمثل محاضر محكمة حقيقية.</div><form class=\"card form\" id=\"minutesLookup\"><h3>محاضر قضية</h3><label class=\"field\">معرف القضية<input class=\"input\" name=\"case_id\" minlength=\"10\" required></label><button class=\"btn\">عرض المحاضر</button><p role=\"status\"></p></form><div id=\"minutesArea\"></div>`);\n const f=document.querySelector('#minutesLookup');const initial=location.hash.split('/')[2]||'';if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();const case_id=new FormData(f).get('case_id');try{const r=await api('/justice19/minutes?case_id='+encodeURIComponent(case_id));const area=document.querySelector('#minutesArea');area.innerHTML=`<h3>المحاضر المسجلة</h3>${r.minutes.map(x=>`<div class=\"card\"><b>جلسة ${safe(x.starts_at)} — ${safe(x.location)}</b><p class=\"muted\">حرره: ${safe(x.author)} · ${safe(x.created_at)}</p><h4>الحاضرون</h4><p>${safe(x.attendees)}</p><h4>ملخص الجلسة</h4><p style=\"white-space:pre-wrap\">${safe(x.summary)}</p><h4>الإجراءات التالية</h4><p>${safe(x.next_steps)}</p></div>`).join('')||'<p class=\"empty\">لا توجد محاضر.</p>'}${r.can_manage?`<form class=\"card form\" id=\"minutesNew\"><h3>تسجيل محضر جلسة</h3><label class=\"field\">الجلسة<select class=\"input\" name=\"hearing_id\" required>${r.hearings.filter(h=>!r.minutes.some(m=>m.hearing_id===h.id)).map(h=>`<option value=\"${safe(h.id)}\">${safe(h.starts_at)} — ${safe(h.location)}</option>`).join('')}</select></label><label class=\"field\">الحاضرون<input class=\"input\" name=\"attendees\" minlength=\"2\" maxlength=\"1000\" required></label><label class=\"field\">ملخص الجلسة<textarea class=\"input\" name=\"summary\" minlength=\"10\" maxlength=\"6000\" required></textarea></label><label class=\"field\">الإجراءات التالية<textarea class=\"input\" name=\"next_steps\" minlength=\"3\" maxlength=\"2000\" required></textarea></label><button class=\"btn gold\" ${r.hearings.every(h=>r.minutes.some(m=>m.hearing_id===h.id))?'disabled':''}>حفظ المحضر</button><p role=\"status\"></p></form>`:''}`;\n const n=document.querySelector('#minutesNew');if(n)n.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice19/minutes',Object.fromEntries(new FormData(n)));f.requestSubmit()}catch(err){n.querySelector('[role=status]').textContent=err.message}};\n }catch(err){f.querySelector('[role=status]').textContent=err.message}};if(initial)f.requestSubmit();\n}\n\nasync function justice20Page(){\n if(!me){location.hash='#/login';return}\n page('ملحقات وتصحيحات المحاضر',`<div class=\"notice\">التصحيح يُضاف كسجل جديد ولا يغيّر المحضر الأصلي. نظام قضائي داخلي للمملكة الصالية.</div><form class=\"card form\" id=\"addendaLookup\"><label class=\"field\">معرف القضية<input class=\"input\" name=\"case_id\" required minlength=\"10\"></label><button class=\"btn\">عرض المحاضر وملحقاتها</button><p role=\"status\"></p></form><div id=\"addendaArea\"></div>`);\n const f=document.querySelector('#addendaLookup'),initial=location.hash.split('/')[2]||'';if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();try{const caseId=new FormData(f).get('case_id');const [m,r]=await Promise.all([api('/justice19/minutes?case_id='+encodeURIComponent(caseId)),api('/justice20/addenda?case_id='+encodeURIComponent(caseId))]);const area=document.querySelector('#addendaArea');area.innerHTML=`<h3>الملحقات المسجلة</h3>${r.addenda.map(x=>`<div class=\"card\"><b>تصحيح لمحضر ${safe(x.minute_id)}</b><p class=\"muted\">${safe(x.author)} · ${safe(x.created_at)}</p><p>السبب: ${safe(x.reason)}</p><p style=\"white-space:pre-wrap\">${safe(x.correction)}</p></div>`).join('')||'<p class=\"empty\">لا توجد ملحقات.</p>'}${r.can_manage?`<form class=\"card form\" id=\"addendaNew\"><h3>إضافة ملحق تصحيح</h3><label class=\"field\">المحضر<select class=\"input\" name=\"minute_id\" required>${m.minutes.map(x=>`<option value=\"${safe(x.id)}\">${safe(x.starts_at)} — ${safe(x.id)}</option>`).join('')}</select></label><label class=\"field\">سبب التصحيح<input class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"1000\" required></label><label class=\"field\">نص التصحيح<textarea class=\"input\" name=\"correction\" minlength=\"10\" maxlength=\"6000\" required></textarea></label><button class=\"btn gold\" ${m.minutes.length?'':'disabled'}>حفظ الملحق</button><p role=\"status\"></p></form>`:''}`;\n const n=document.querySelector('#addendaNew');if(n)n.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice20/addenda',Object.fromEntries(new FormData(n)));f.requestSubmit()}catch(err){n.querySelector('[role=status]').textContent=err.message}};\n }catch(err){f.querySelector('[role=status]').textContent=err.message}};if(initial)f.requestSubmit();\n}\n\nasync function justice22Page(){\n if(!me){location.hash='#/login';return}\n page('السجل الزمني الموحد للقضية',`<div class=\"notice\">سجل زمني للمحاكاة القضائية يجمع الإجراءات والمذكرات والجلسات والأدلة والاستئناف والتنفيذ. لا يمثل شهادة قضائية رسمية.</div><form id=\"timelineLookup\" class=\"card form\"><label class=\"field\">معرّف القضية<input class=\"input\" name=\"case_id\" required minlength=\"10\"></label><button class=\"btn gold\">عرض سجل القضية</button><p role=\"status\"></p></form><div id=\"timelineArea\" aria-live=\"polite\"></div>`);\n const f=document.querySelector('#timelineLookup'),initial=location.hash.split('/')[2]||'';\n if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();try{const caseId=new FormData(f).get('case_id');const r=await api('/justice22/timeline?case_id='+encodeURIComponent(caseId));document.querySelector('#timelineArea').innerHTML=`<div class=\"card\"><h3>${safe(r.case.reference)} — ${safe(r.case.title)}</h3><p>الحالة: ${safe(r.case.status)}</p><p class=\"muted\">عدد السجلات المعروضة: ${r.events.length}${r.truncated?' (أحدث 250 سجلًا فقط)':''}</p><div class=\"actions\"><a class=\"btn outline\" href=\"#/justice21/${encodeURIComponent(caseId)}\">مرفقات القضية</a><a class=\"btn outline\" href=\"#/justice19/${encodeURIComponent(caseId)}\">محاضر الجلسات</a></div></div>${r.events.map(x=>`<article class=\"card\"><b>${safe(x.title)}</b><p style=\"white-space:pre-wrap;overflow-wrap:anywhere\">${safe(x.detail)}</p><small class=\"muted\">${safe(x.created_at)} · ${safe(x.source)}</small></article>`).join('')||'<p class=\"empty\">لا توجد إجراءات مسجلة.</p>'}`;f.querySelector('[role=status]').textContent=''}catch(err){document.querySelector('#timelineArea').textContent='';f.querySelector('[role=status]').textContent=err.message}};\n if(initial)f.requestSubmit();\n}\n\nasync function justice24Page(){\n if(!me){location.hash='#/login';return}\n page('أوامر تنفيذ الأحكام',`<div class=\"notice\">أوامر تنفيذ داخل المحاكاة فقط. بدء التنفيذ أو استئنافه أو إكماله يُمنع عند وجود مراجعة مفتوحة أو حكم نقض/إعادة نظر.</div><form id=\"executionLookup\" class=\"card form\"><label class=\"field\">معرّف القضية<input class=\"input\" name=\"case_id\" minlength=\"10\" required></label><button class=\"btn gold\">عرض ملف التنفيذ</button><p role=\"status\"></p></form><div id=\"executionOrders\"></div>`);\n const f=document.querySelector('#executionLookup'),initial=location.hash.split('/')[2]||'';if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();const id=new FormData(f).get('case_id');try{const r=await api('/justice24/orders?case_id='+encodeURIComponent(id)),area=document.querySelector('#executionOrders');area.innerHTML=`${r.execution?`<div class=\"card\"><h3>ملف التنفيذ — ${safe(r.execution.status)}</h3><p>${safe(r.execution.instructions)}</p><p>${safe(r.execution.last_note)}</p>${r.can_manage?`<form id=\"issueExecutionOrder\" class=\"form\"><label class=\"field\">الإجراء<select class=\"input\" name=\"action\"><option value=\"start\">بدء التنفيذ</option><option value=\"suspend\">إيقاف التنفيذ</option><option value=\"resume\">استئناف التنفيذ</option><option value=\"complete\">إكمال التنفيذ</option></select></label><label class=\"field\">سبب الأمر<textarea class=\"input\" name=\"reason\" minlength=\"10\" maxlength=\"4000\" required></textarea></label><button class=\"btn gold\">إصدار أمر التنفيذ</button><p role=\"status\"></p></form>`:''}</div>`:'<div class=\"notice\">لا يوجد ملف تنفيذ لهذه القضية. أنشئه من صفحة النيابة والتنفيذ أولًا.</div>'}<h3>سجل الأوامر</h3>${r.orders.map(x=>`<div class=\"card\"><b>${safe(x.action)}</b><p>${safe(x.reason)}</p><small>${safe(x.issuer)} · ${safe(x.created_at)}</small></div>`).join('')||'<p class=\"muted\">لا توجد أوامر.</p>'}`;\n const order=document.querySelector('#issueExecutionOrder');if(order)order.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice24/orders',{execution_id:r.execution.id,...Object.fromEntries(new FormData(order))});f.requestSubmit()}catch(err){order.querySelector('[role=status]').textContent=err.message}};f.querySelector('[role=status]').textContent='';}catch(err){document.querySelector('#executionOrders').textContent='';f.querySelector('[role=status]').textContent=err.message}};\n if(initial)f.requestSubmit();\n}\n\nasync function justice23Page(){\n if(!me){location.hash='#/login';return}\n page('دوائر الاستئناف والنقض',`<div class=\"notice\">محاكاة قضائية داخلية. قبول الاستئناف يتم من النظام السابق، وفتح ملف المراجعة وإصدار الحكم يتطلب صلاحية appeals مستقلة.</div><form class=\"card form\" id=\"reviewLookup\"><label class=\"field\">معرّف القضية<input class=\"input\" name=\"case_id\" minlength=\"10\" required></label><button class=\"btn gold\">عرض درجات التقاضي</button><p role=\"status\"></p></form><div id=\"reviewArea\"></div>`);\n const f=document.querySelector('#reviewLookup'),initial=location.hash.split('/')[2]||'';if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();const caseId=new FormData(f).get('case_id');try{const r=await api('/justice23/docket?case_id='+encodeURIComponent(caseId));const area=document.querySelector('#reviewArea');area.innerHTML=`<h3>الاستئنافات</h3>${r.appeals.map(x=>`<div class=\"card\"><b>${safe(x.appellant)}</b> — ${safe(x.status)}<p>${safe(x.reason)}</p><small>${safe(x.id)}</small>${r.can_manage&&x.status==='accepted'?`<form class=\"form reviewOpen\" data-id=\"${safe(x.id)}\"><label class=\"field\">الدرجة<select name=\"level\" class=\"input\"><option value=\"appeal\">استئناف</option><option value=\"cassation\">نقض</option></select></label><button class=\"btn\">فتح ملف المراجعة</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد استئنافات.</p>'}<h3>ملفات درجات التقاضي</h3>${r.reviews.map(x=>`<div class=\"card\"><h3>${x.level==='appeal'?'محكمة الاستئناف':'محكمة النقض'} — ${safe(x.status)}</h3><p>الملف: ${safe(x.id)}</p>${x.ruling_id?`<p><b>المنطوق: ${safe(x.outcome)}</b></p><p style=\"white-space:pre-wrap\">${safe(x.reasoning)}</p>`:''}${r.can_manage&&x.status==='open'?`<form class=\"form reviewRule\" data-id=\"${safe(x.id)}\"><label class=\"field\">القرار<select name=\"outcome\" class=\"input\"><option value=\"uphold\">تأييد</option><option value=\"reverse\">نقض الحكم</option><option value=\"remand\">إعادة النظر</option></select></label><label class=\"field\">التسبيب<textarea name=\"reasoning\" class=\"input\" required minlength=\"20\" maxlength=\"8000\"></textarea></label><button class=\"btn gold\">إصدار الحكم</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p class=\"empty\">لا توجد ملفات مراجعة.</p>'}`;\n area.querySelectorAll('.reviewOpen').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice23/open',{appeal_id:form.dataset.id,level:new FormData(form).get('level')});f.requestSubmit()}catch(err){form.querySelector('[role=status]').textContent=err.message}});\n area.querySelectorAll('.reviewRule').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();try{await post('/justice23/rule',{docket_id:form.dataset.id,...Object.fromEntries(new FormData(form))});f.requestSubmit()}catch(err){form.querySelector('[role=status]').textContent=err.message}});\n f.querySelector('[role=status]').textContent='';}catch(err){document.querySelector('#reviewArea').textContent='';f.querySelector('[role=status]').textContent=err.message}};\n if(initial)f.requestSubmit();\n}\n\nasync function serviceDeskPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/service-desk/tickets');\n page('مركز خدمة المواطنين',`<div class=\"notice\">للاستفسارات والملاحظات داخل محاكاة المملكة الصالية، وليس جهة حكومية حقيقية.</div><form id=\"newTicket\" class=\"card form\"><h3>تذكرة جديدة</h3><label class=\"field\">القسم<select class=\"input\" name=\"category\"><option value=\"technical\">دعم فني</option><option value=\"government\">الخدمات الحكومية</option><option value=\"banking\">البنوك</option><option value=\"other\">أخرى</option></select></label><label class=\"field\">العنوان<input class=\"input\" name=\"subject\" minlength=\"5\" maxlength=\"120\" required></label><label class=\"field\">التفاصيل<textarea class=\"input\" name=\"description\" minlength=\"10\" maxlength=\"3000\" required></textarea></label><button class=\"btn gold\">إرسال التذكرة</button><p role=\"status\"></p></form><h2>التذاكر ${r.can_manage?'— لوحة الإدارة':''}</h2>${r.tickets.map(t=>`<div class=\"card\"><b>${safe(t.reference)} — ${safe(t.subject)}</b><p class=\"muted\">${safe(t.owner)} · ${safe(t.category)} · ${safe(t.status)} · ${safe(t.created_at)}</p><p>${safe(t.description)}</p><button class=\"btn outline ticketReplies\" data-id=\"${safe(t.id)}\">عرض المحادثة</button>${r.can_manage?`<form class=\"ticketStatus form\" data-id=\"${safe(t.id)}\"><select class=\"input\" name=\"status\"><option value=\"open\" ${t.status==='open'?'selected':''}>مفتوحة</option><option value=\"reviewing\" ${t.status==='reviewing'?'selected':''}>قيد المراجعة</option><option value=\"closed\" ${t.status==='closed'?'selected':''}>مغلقة</option></select><button class=\"btn\">تحديث الحالة</button><span role=\"status\"></span></form>`:''}<div id=\"ticket-${safe(t.id)}\"></div></div>`).join('')||'<p>لا توجد تذاكر بعد.</p>'}`);\n document.querySelector('#newTicket').onsubmit=async e=>{e.preventDefault();try{await post('/service-desk/tickets',Object.fromEntries(new FormData(e.target)));await serviceDeskPage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n document.querySelectorAll('.ticketStatus').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/service-desk/status',{id:f.dataset.id,...Object.fromEntries(new FormData(f))});await serviceDeskPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n document.querySelectorAll('.ticketReplies').forEach(b=>b.onclick=async()=>{const id=b.dataset.id,el=document.getElementById('ticket-'+id);try{const r=await api('/service-desk/replies?id='+encodeURIComponent(id));el.innerHTML=`<h4>محادثة التذكرة</h4>${r.replies.map(x=>`<div class=\"notice\"><b>${safe(x.author)}</b><p>${safe(x.body)}</p><small>${safe(x.created_at)}</small></div>`).join('')||'<p>لا توجد ردود.</p>'}<form class=\"form replyTicket\"><textarea class=\"input\" name=\"body\" minlength=\"2\" maxlength=\"2000\" required placeholder=\"اكتب ردك\"></textarea><button class=\"btn\">إرسال الرد</button><p role=\"status\"></p></form>`;el.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await post('/service-desk/reply',{id,body:new FormData(e.target).get('body')});b.click()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}catch(err){el.textContent=err.message}});\n}\nasync function healthPage(){\n if(!me){location.hash='#/login';return}\n const [c,a]=await Promise.all([api('/health/clinics'),api('/health/appointments')]);\n page('الصحة والمواعيد الطبية',`<div class=\"notice\">نظام مواعيد افتراضي للمملكة الصالية، وليس خدمة طبية حقيقية. أدخل الموعد بتوقيت UTC.</div>\n <form id=\"healthBook\" class=\"card form\"><h3>حجز موعد</h3><label class=\"field\">المنشأة<select class=\"input\" name=\"clinic_id\" required>${c.clinics.map(x=>`<option value=\"${safe(x.id)}\">${safe(x.name)} — ${safe(x.region)} (${safe(x.specialty)})</option>`).join('')}</select></label><label class=\"field\">التاريخ والوقت (UTC)<input class=\"input\" type=\"datetime-local\" name=\"scheduled_at\" required></label><label class=\"field\">سبب الزيارة<textarea class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"500\" required></textarea></label><button class=\"btn\" ${c.clinics.length?'':'disabled'}>حجز الموعد</button><p role=\"status\"></p></form>\n ${c.can_manage?`<form id=\"healthClinic\" class=\"card form\"><h3>إضافة منشأة صحية</h3><input class=\"input\" name=\"name\" placeholder=\"اسم المنشأة\" required minlength=\"3\"><input class=\"input\" name=\"region\" placeholder=\"المنطقة\" required><input class=\"input\" name=\"specialty\" placeholder=\"التخصص\" required><button class=\"btn\">إضافة</button><p role=\"status\"></p></form>`:''}\n <h2>المواعيد</h2>${a.appointments.map(x=>`<div class=\"card\"><b>${safe(x.clinic)}</b><p>${safe(x.patient)} · ${safe(x.scheduled_at)} UTC · ${safe(x.status)}</p><p>${safe(x.reason)}</p>${x.status==='booked'?(c.can_manage?`<form class=\"healthStatus\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"completed\">تمت الزيارة</option><option value=\"no_show\">لم يحضر</option><option value=\"cancelled\">إلغاء</option></select><button class=\"btn outline\">تحديث</button></form>`:`<button class=\"btn outline healthCancel\" data-id=\"${safe(x.id)}\">إلغاء الموعد</button>`):''}</div>`).join('')||'<p>لا توجد مواعيد.</p>'}`);\n document.querySelector('#healthBook').onsubmit=async e=>{e.preventDefault();try{await post('/health/appointments',Object.fromEntries(new FormData(e.target)));await healthPage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n const f=document.querySelector('#healthClinic');if(f)f.onsubmit=async e=>{e.preventDefault();try{await post('/health/clinics',Object.fromEntries(new FormData(f)));await healthPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\n document.querySelectorAll('.healthCancel').forEach(b=>b.onclick=async()=>{try{await post('/health/cancel',{id:b.dataset.id});await healthPage()}catch(err){uiNotice(err.message)}});\n document.querySelectorAll('.healthStatus').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/health/status',{id:f.dataset.id,status:new FormData(f).get('status')});await healthPage()}catch(err){uiNotice(err.message)}});\n}\nasync function landPage(){\n if(!me){location.hash='#/login';return}\n const [pr,tr]=await Promise.all([api('/land/parcels'),api('/land/transfers')]);\n const labels={pending_buyer:'بانتظار موافقة المشتري',pending_registry:'بانتظار السجل العقاري',approved:'تم نقل الملكية',rejected:'مرفوض',cancelled:'ملغي'};\n page('السجل العقاري والملكية',`<div class=\"actions\"><a href=\"#/my-properties\" class=\"btn gold\">🏡 عقاراتي التي اشتريتها</a><a href=\"#/sim-market\" class=\"btn\">شراء عقار جديد</a></div><p>تسجيل العقارات ونقل الملكية بموافقة الطرفين واعتماد السجل العقاري في المملكة العربية الصالية.</p>\n ${pr.can_manage?`<form class=\"card form\" id=\"landCreate\"><h3>تسجيل عقار جديد</h3><input class=\"input\" name=\"title\" placeholder=\"اسم العقار أو رقم القطعة\" minlength=\"3\" maxlength=\"120\" required><select class=\"input\" name=\"region\"><option>السجادة</option><option>المتجار</option><option>عقار</option></select><textarea class=\"input\" name=\"location\" placeholder=\"وصف موقع العقار\" minlength=\"5\" maxlength=\"240\" required></textarea><input class=\"input\" name=\"owner_username\" placeholder=\"اسم حساب المالك\" required><button class=\"btn\">تسجيل العقار</button></form>`:''}\n <h2>العقارات</h2>${pr.parcels.map(x=>`<div class=\"card\"><h3>${safe(x.title)}</h3><p>${safe(x.region)} · ${safe(x.location)}</p><p>المالك: ${safe(x.owner)}</p><small>المعرّف: ${safe(x.id)}</small>${x.owner_id===me.id?`<form class=\"form landRequest\" data-id=\"${safe(x.id)}\"><input class=\"input\" name=\"buyer_username\" placeholder=\"اسم حساب المشتري\" required><button class=\"btn outline\">طلب نقل الملكية</button></form>`:''}</div>`).join('')||'<p>لا توجد عقارات مسجلة.</p>'}\n <h2>طلبات نقل الملكية</h2>${tr.transfers.map(x=>`<div class=\"card\"><h3>${safe(x.title)}</h3><p>${safe(x.seller)} ← ${safe(x.buyer)}</p><p>${safe(labels[x.status]||x.status)}</p><small>${safe(x.id)}</small><div class=\"actions\">${x.buyer_id===me.id&&x.status==='pending_buyer'?`<button class=\"btn landDecision\" data-id=\"${safe(x.id)}\" data-action=\"accept\">قبول الشراء</button><button class=\"btn outline landDecision\" data-id=\"${safe(x.id)}\" data-action=\"reject\">رفض</button>`:''}${x.seller_id===me.id&&['pending_buyer','pending_registry'].includes(x.status)?`<button class=\"btn outline landDecision\" data-id=\"${safe(x.id)}\" data-action=\"cancel\">إلغاء الطلب</button>`:''}${tr.can_manage&&x.status==='pending_registry'&&x.seller_id!==me.id&&x.buyer_id!==me.id?`<button class=\"btn landDecision\" data-id=\"${safe(x.id)}\" data-action=\"approve\">اعتماد النقل</button>`:''}${tr.can_manage&&x.status==='pending_registry'?`<button class=\"btn outline landDecision\" data-id=\"${safe(x.id)}\" data-action=\"deny\">رفض النقل</button>`:''}</div></div>`).join('')||'<p>لا توجد طلبات نقل.</p>'}`);\n const f=document.querySelector('#landCreate');if(f)f.onsubmit=async e=>{e.preventDefault();try{await post('/land/parcels',Object.fromEntries(new FormData(f)));await landPage()}catch(err){uiNotice(err.message)}};\n document.querySelectorAll('.landRequest').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/land/transfers',{parcel_id:f.dataset.id,...Object.fromEntries(new FormData(f))});await landPage()}catch(err){uiNotice(err.message)}});\n document.querySelectorAll('.landDecision').forEach(b=>b.onclick=async()=>{if(!await uiConfirm('تأكيد هذا الإجراء؟'))return;try{await post('/land/transfers/decision',{id:b.dataset.id,action:b.dataset.action});await landPage()}catch(err){uiNotice(err.message)}});\n}\nasync function commercePage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/commerce/companies');const statuses={pending:'بانتظار المراجعة',approved:'سجل تجاري معتمد',rejected:'مرفوض'};\n page('السجل التجاري والشركات',`<div class=\"notice\">سجل تجاري افتراضي خاص بمحاكاة المملكة الصالية، ولا يمنح ترخيصًا حقيقيًا.</div>\n <form class=\"card form\" id=\"commerceApply\"><h3>طلب تسجيل شركة</h3><label class=\"field\">اسم الشركة<input class=\"input\" name=\"name\" minlength=\"3\" maxlength=\"120\" required></label><label class=\"field\">النشاط<input class=\"input\" name=\"activity\" minlength=\"3\" maxlength=\"120\" required></label><label class=\"field\">المحافظة<select class=\"input\" name=\"region\"><option>السجادة</option><option>المتجار</option><option>عقار</option></select></label><label class=\"field\">الرخصة البلدية (اختياري)<select class=\"input\" name=\"permit_id\"><option value=\"\">بدون ربط</option>${r.permits.map(p=>`<option value=\"${safe(p.id)}\">${safe(p.business_name)} — ${safe(p.region)}</option>`).join('')}</select></label><button class=\"btn gold\">إرسال الطلب</button><p role=\"status\"></p></form>\n <h2>${r.can_manage?'طلبات السجل التجاري':'شركاتي وطلباتي'}</h2>${r.companies.map(c=>`<div class=\"card\"><h3>${safe(c.name)}</h3><p>${safe(c.activity)} · ${safe(c.region)}</p><p>المالك: ${safe(c.owner)} · ${safe(statuses[c.status]||c.status)}</p>${c.review_note?`<p>ملاحظة المراجع: ${safe(c.review_note)}</p>`:''}<small>رقم السجل: ${safe(c.id)}</small>${r.can_manage&&c.status==='pending'&&c.owner_id!==me.id?`<form class=\"form commerceDecision\" data-id=\"${safe(c.id)}\"><label class=\"field\">القرار<select class=\"input\" name=\"status\"><option value=\"approved\">اعتماد</option><option value=\"rejected\">رفض</option></select></label><textarea class=\"input\" name=\"note\" minlength=\"5\" maxlength=\"1000\" placeholder=\"سبب القرار\" required></textarea><button class=\"btn\">حفظ القرار</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p>لا توجد شركات مسجلة.</p>'}`);\n document.querySelector('#commerceApply').onsubmit=async e=>{e.preventDefault();try{await post('/commerce/companies',Object.fromEntries(new FormData(e.target)));await commercePage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n document.querySelectorAll('.commerceDecision').forEach(f=>f.onsubmit=async e=>{e.preventDefault();if(!await uiConfirm('تأكيد قرار السجل التجاري؟'))return;try{await post('/commerce/decision',{id:f.dataset.id,...Object.fromEntries(new FormData(f))});await commercePage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n}\nasync function companyTreasuryPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/commerce/treasury');const options=r.accounts.map(a=>`<option value=\"${safe(a.id)}\">${safe(a.bank)} — ${safe(a.balance)}</option>`).join('');\n page('حسابات الشركات الافتراضية',`<div class=\"notice\">هذه أرصدة افتراضية داخل المملكة فقط؛ لا تمثل أموالًا حقيقية ولا حسابات بنكية مرخصة.</div><div class=\"actions\"><a class=\"btn outline\" href=\"#/commerce\">السجل التجاري</a><a class=\"btn outline\" href=\"#/banking\">حساباتي الشخصية</a></div>\n ${r.companies.map(c=>`<div class=\"card\"><h3>${safe(c.name)}</h3><p>رصيد خزينة الشركة: <b>${c.balance===null?'غير مفعلة':safe(c.balance)}</b></p>${c.balance===null?`<form class=\"treasuryOpen\" data-id=\"${safe(c.id)}\"><button class=\"btn\">تفعيل خزينة الشركة</button><p role=\"status\"></p></form>`:`<form class=\"form treasuryMove\" data-id=\"${safe(c.id)}\"><label class=\"field\">نوع الحركة<select class=\"input\" name=\"kind\"><option value=\"fund\">تمويل الشركة من حسابي</option><option value=\"withdraw\">سحب من الشركة إلى حسابي</option></select></label><label class=\"field\">الحساب الشخصي<select class=\"input\" name=\"account_id\" required>${options}</select></label><label class=\"field\">المبلغ الافتراضي<input class=\"input\" type=\"number\" name=\"amount\" min=\"1\" max=\"1000000\" step=\"1\" required></label><button class=\"btn gold\" ${r.accounts.length?'':'disabled'}>تنفيذ الحركة</button><p role=\"status\"></p></form>`}</div>`).join('')||'<p>ليس لديك شركات معتمدة بعد.</p>'}\n <h2>سجل حركات الخزينة</h2>${r.movements.map(m=>`<div class=\"card\"><b>${safe(m.company_name)}</b><p>${m.kind==='fund'?'تمويل':'سحب'} · ${safe(m.amount)} · ${safe(m.bank)}</p><small>${safe(m.created_at)}</small></div>`).join('')||'<p>لا توجد حركات.</p>'}`);\n document.querySelectorAll('.treasuryOpen').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post('/commerce/treasury/open',{company_id:f.dataset.id});await companyTreasuryPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n document.querySelectorAll('.treasuryMove').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));if(!await uiConfirm('تأكيد حركة الرصيد الافتراضي؟'))return;try{await post('/commerce/treasury/move',{...b,company_id:f.dataset.id,amount:Number(b.amount)});await companyTreasuryPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n}\nasync function commerceBranchesPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/commerce/branches');const statuses={pending:'بانتظار المراجعة',approved:'معتمد',rejected:'مرفوض'};\n page('فروع الشركات',`<p>تسجيل فروع الشركات المعتمدة ومراجعتها لدى وزارة التجارة.</p><div class=\"actions\"><a class=\"btn outline\" href=\"#/commerce\">السجل التجاري</a></div>\n <form class=\"card form\" id=\"branchApply\"><h3>طلب افتتاح فرع</h3><label class=\"field\">الشركة<select class=\"input\" name=\"company_id\" required><option value=\"\">اختر الشركة</option>${r.companies.map(c=>`<option value=\"${safe(c.id)}\">${safe(c.name)}</option>`).join('')}</select></label><label class=\"field\">اسم الفرع<input class=\"input\" name=\"name\" minlength=\"3\" maxlength=\"120\" required></label><label class=\"field\">العنوان<input class=\"input\" name=\"address\" minlength=\"5\" maxlength=\"240\" required></label><label class=\"field\">المحافظة<select class=\"input\" name=\"region\"><option>السجادة</option><option>المتجار</option><option>عقار</option></select></label><label class=\"field\">الرخصة البلدية (اختياري)<select class=\"input\" name=\"permit_id\"><option value=\"\">بدون ربط</option>${r.permits.map(p=>`<option value=\"${safe(p.id)}\">${safe(p.business_name)} — ${safe(p.region)}</option>`).join('')}</select></label><button class=\"btn gold\" ${r.companies.length?'':'disabled'}>إرسال الطلب</button><p role=\"status\"></p></form>\n <h2>${r.can_manage?'طلبات الفروع':'فروعي'}</h2>${r.branches.map(b=>`<div class=\"card\"><h3>${safe(b.name)}</h3><p>${safe(b.company_name)} · ${safe(b.region)} · ${safe(b.address)}</p><p>المالك: ${safe(b.owner)} · ${safe(statuses[b.status]||b.status)}</p>${b.review_note?`<p>ملاحظة: ${safe(b.review_note)}</p>`:''}<small>${safe(b.id)}</small>${r.can_manage&&b.status==='pending'&&b.owner_id!==me.id?`<form class=\"form branchDecision\" data-id=\"${safe(b.id)}\"><select class=\"input\" name=\"status\"><option value=\"approved\">اعتماد</option><option value=\"rejected\">رفض</option></select><textarea class=\"input\" name=\"note\" minlength=\"5\" maxlength=\"1000\" placeholder=\"سبب القرار\" required></textarea><button class=\"btn\">حفظ القرار</button><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p>لا توجد فروع.</p>'}`);\n document.querySelector('#branchApply').onsubmit=async e=>{e.preventDefault();try{await post('/commerce/branches',Object.fromEntries(new FormData(e.target)));await commerceBranchesPage()}catch(err){e.target.querySelector('[role=status]').textContent=err.message}};\n document.querySelectorAll('.branchDecision').forEach(f=>f.onsubmit=async e=>{e.preventDefault();if(!await uiConfirm('تأكيد القرار؟'))return;try{await post('/commerce/branches/decision',{id:f.dataset.id,...Object.fromEntries(new FormData(f))});await commerceBranchesPage()}catch(err){f.querySelector('[role=status]').textContent=err.message}});\n}\nasync function municipalityPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/municipality/permits');\n const labels={pending:'بانتظار المراجعة',needs_changes:'مطلوب تعديل',approved:'معتمدة',rejected:'مرفوضة'};\n page('البلديات والرخص التجارية',`<p>إصدار رخص الأنشطة في المملكة العربية الصالية ومتابعة التفتيش البلدي.</p>\n <form class=\"card form\" id=\"permitApply\"><h3>طلب رخصة نشاط</h3><input class=\"input\" name=\"business_name\" placeholder=\"اسم النشاط التجاري\" minlength=\"3\" maxlength=\"120\" required><input class=\"input\" name=\"activity\" placeholder=\"نوع النشاط\" minlength=\"3\" maxlength=\"120\" required><select class=\"input\" name=\"region\"><option>السجادة</option><option>المتجار</option><option>عقار</option></select><textarea class=\"input\" name=\"location\" placeholder=\"موقع النشاط بالتفصيل\" minlength=\"5\" maxlength=\"240\" required></textarea><button class=\"btn\">تقديم الطلب</button><p role=\"status\"></p></form>\n <h2>الرخص والطلبات</h2>${r.permits.map(x=>`<div class=\"card\"><h3>${safe(x.business_name)}</h3><p>${safe(x.activity)} · ${safe(x.region)} · ${safe(labels[x.status]||x.status)}</p><p>صاحب الطلب: ${safe(x.applicant)} · ${safe(x.location)}</p>${x.review_note?`<p>ملاحظة البلدية: ${safe(x.review_note)}</p>`:''}<p><small>رقم الطلب: ${safe(x.id)}</small></p><button class=\"btn outline inspectView\" data-id=\"${safe(x.id)}\">سجل التفتيش</button><div class=\"inspectionResult\" data-id=\"${safe(x.id)}\"></div>${x.owner_id===me.id&&x.status==='needs_changes'?`<form class=\"form permitResubmit\" data-id=\"${safe(x.id)}\"><textarea class=\"input\" name=\"location\" minlength=\"5\" maxlength=\"240\" required>${safe(x.location)}</textarea><button class=\"btn\">إعادة التقديم</button></form>`:''}${r.can_manage&&['pending','needs_changes'].includes(x.status)?`<form class=\"form permitDecide\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"status\"><option value=\"approved\">اعتماد</option><option value=\"needs_changes\">طلب تعديل</option><option value=\"rejected\">رفض</option></select><textarea class=\"input\" name=\"note\" placeholder=\"سبب القرار\" minlength=\"5\" maxlength=\"1000\" required></textarea><button class=\"btn\">حفظ القرار</button></form>`:''}${r.can_manage&&x.status==='approved'?`<form class=\"form permitInspect\" data-id=\"${safe(x.id)}\"><select class=\"input\" name=\"outcome\"><option value=\"passed\">اجتاز التفتيش</option><option value=\"warning\">إنذار</option><option value=\"failed\">لم يجتز</option></select><textarea class=\"input\" name=\"notes\" minlength=\"5\" maxlength=\"1500\" placeholder=\"ملاحظات المفتش\" required></textarea><button class=\"btn outline\">تسجيل تفتيش</button></form>`:''}</div>`).join('')||'<p>لا توجد رخص بعد.</p>'}`);\n const bind=(selector,url,transform)=>document.querySelectorAll(selector).forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await post(url,transform(f));await municipalityPage()}catch(err){uiNotice(err.message)}});\n bind('#permitApply','/municipality/permits',f=>Object.fromEntries(new FormData(f)));\n bind('.permitDecide','/municipality/decide',f=>({...Object.fromEntries(new FormData(f)),id:f.dataset.id}));\n bind('.permitResubmit','/municipality/resubmit',f=>({...Object.fromEntries(new FormData(f)),id:f.dataset.id}));\n bind('.permitInspect','/municipality/inspections',f=>({...Object.fromEntries(new FormData(f)),permit_id:f.dataset.id}));\n document.querySelectorAll('.inspectView').forEach(b=>b.onclick=async()=>{try{const x=await api('/municipality/inspections?permit_id='+encodeURIComponent(b.dataset.id));const target=[...document.querySelectorAll('.inspectionResult')].find(e=>e.dataset.id===b.dataset.id);target.innerHTML=x.inspections.map(i=>`<p>${safe(i.created_at)} · ${safe(i.outcome)}: ${safe(i.notes)}</p>`).join('')||'<p>لا توجد زيارات تفتيش.</p>'}catch(err){uiNotice(err.message)}});\n}\nasync function companyStaffPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/company/staff');const status={offered:'عرض بانتظار القبول',active:'عقد نشط',declined:'مرفوض',ended:'منتهٍ'};\n page('موظفو الشركات والرواتب',`<p>عقود ورواتب افتراضية من خزائن الشركات، ولا تتضمن أموالًا حقيقية.</p><div class=\"actions\"><a class=\"btn outline\" href=\"#/company-treasury\">خزائن الشركات</a></div>\n <form class=\"card form\" id=\"staffOffer\"><h3>إرسال عرض عمل</h3><select class=\"input\" name=\"company_id\" required><option value=\"\">اختر شركة لها خزينة</option>${r.companies.map(c=>`<option value=\"${safe(c.id)}\">${safe(c.name)} — ${safe(c.balance)}</option>`).join('')}</select><input class=\"input\" name=\"username\" placeholder=\"اسم مستخدم الموظف\" required minlength=\"3\"><input class=\"input\" name=\"position\" placeholder=\"المسمى الوظيفي\" required minlength=\"3\"><input class=\"input\" name=\"salary\" type=\"number\" min=\"1\" max=\"1000000\" placeholder=\"الراتب الشهري الافتراضي\" required><button class=\"btn gold\" ${r.companies.length?'':'disabled'}>إرسال العرض</button><p role=\"status\"></p></form>\n <h2>العروض والعقود</h2>${r.employees.map(e=>`<div class=\"card\"><h3>${safe(e.company_name)} — ${safe(e.position)}</h3><p>الموظف: ${safe(e.employee_name)} · الراتب: ${safe(e.salary)} · ${safe(status[e.status]||e.status)}</p>${e.employee_id===me.id&&e.status==='offered'?`<button class=\"btn staffAct\" data-action=\"respond\" data-status=\"active\" data-id=\"${safe(e.id)}\">قبول العرض</button> <button class=\"btn outline staffAct\" data-action=\"respond\" data-status=\"declined\" data-id=\"${safe(e.id)}\">رفض</button>`:''}${e.status==='active'&&e.owner_id===me.id?`<form class=\"form staffPay\" data-id=\"${safe(e.id)}\"><label>شهر الراتب (YYYY-MM)<input class=\"input\" name=\"period\" type=\"month\" required></label><button class=\"btn\">صرف الراتب من الخزينة</button></form>`:''}${['offered','active'].includes(e.status)?`<button class=\"btn outline staffAct\" data-action=\"end\" data-id=\"${safe(e.id)}\">إنهاء العلاقة</button>`:''}</div>`).join('')||'<p>لا توجد عقود.</p>'}\n <h2>سجل الرواتب</h2>${r.payments.map(p=>`<div class=\"card\"><b>${safe(p.company_name)}</b> · ${safe(p.employee_name)} · ${safe(p.period)} · ${safe(p.amount)}<p><small>${safe(p.created_at)}</small></p></div>`).join('')||'<p>لا توجد دفعات.</p>'}`);\n const send=async(url,body)=>{try{await post(url,body);await companyStaffPage()}catch(e){uiNotice(e.message)}};\n document.querySelector('#staffOffer').onsubmit=e=>{e.preventDefault();send('/company/staff/offer',Object.fromEntries(new FormData(e.target)))};\n document.querySelectorAll('.staffAct').forEach(b=>b.onclick=async()=>{if(await uiConfirm('تأكيد الإجراء؟'))send('/company/staff/'+b.dataset.action,{id:b.dataset.id,status:b.dataset.status})});\n document.querySelectorAll('.staffPay').forEach(f=>f.onsubmit=async e=>{e.preventDefault();if(await uiConfirm('تأكيد صرف الراتب الافتراضي؟'))send('/company/staff/pay',{id:f.dataset.id,period:new FormData(f).get('period')})});\n}\n\nasync function route(){try{if(!data)await refreshData();const path=(location.hash||'#/').slice(2);const [part,id]=path.split('?')[0].split('/');if(!part){home();await loadNationalAlert()}else if(part==='national-alert')await nationalAlertPage();else if(part==='x')await xSaliyah();else if(part==='ministries')showMinistries(new URLSearchParams((id||'').split('?')[1]||path.split('?')[1]||'').get('q')||'');else if(part==='governorates')page('استكشف المحافظات',govCards());else if(part==='gov'){const g=data.governorates.find(x=>x.id===id);page(g?'محافظة '+safe(g.name):'غير موجود',g?`<div class=\"card\"><h3>${safe(g.description)}</h3><p>المحافظ: ${safe(g.governor)}</p></div>`:'<p>المحافظة غير موجودة.</p>')}else if(part==='ministry'){const m=data.ministries[Number(id)];page(m?safe(m.name):'غير موجود',m?`<div class=\"card\"><h3>الوزير</h3><p>${safe(m.minister)}</p><div class=\"notice\">خدمات الموظفين والمدنيين تحتاج إلى تفعيل نظام الصلاحيات الخاص بالوزارة.</div></div>`:'<p>الوزارة غير موجودة.</p>')}else if(part==='services')page('دليل جميع الخدمات',`<p class=\"muted\">جميع أقسام الخدمات الموجودة في البوابة، وقد تتطلب بعض الخدمات تسجيل الدخول أو صلاحية موظف.</p>${serviceCards()}`);else if(part==='service')page(safe(services[Number(id)]?.[0]||'خدمة غير موجودة'),'<div class=\"notice\">لم تُفعّل هذه الخدمة بعد. لا يمكن تقديم طلب من خلالها حاليًا.</div>');else if(part==='news'){await refreshData();page('الأخبار والقرارات',newsCards())}else if(part==='login')login();else if(part==='citizen-register')citizenRegister();else if(part==='ministry-office')await ministryOffice();else if(part==='enforcement')await enforcementPage();else if(part==='ministry-accounts')await ministryAccounts();else if(part==='citizen-profile')await citizenProfile();else if(part==='setup')await setup();else if(part==='recover-owner')await recoverOwner();else if(part==='dashboard')await dashboard();else if(part==='requests')await requests();else if(part==='publish')await publish();else if(part==='registry')await registry();else if(part==='civil')await civil();else if(part==='family-cards')await familyCards();else if(part==='audit')await auditPage();else if(part==='messages')await messages();else if(part==='staff')await staff();else if(part==='banking')await banking();else if(part==='sim-directory')await simDirectoryPage();else if(part==='sim-market')await simMarketPage();else if(part==='my-properties')await myPropertiesPage();else if(part==='cards-atm')await cardsAtm();else if(part==='pos')await posPage();else if(part==='telecom')await telecom();else if(part==='absher')await absherPage();else if(part==='borders')await bordersPage();else if(part==='education')await educationPage();else if(part==='payroll')await payrollPage();else if(part==='state-budgets')await stateBudgetsPage();else if(part==='courts')await courtsPage();else if(part==='justice16')await justice16Page();else if(part==='justice17')await justice17Page();else if(part==='justice18')await justice18Page();else if(part==='justice19')await justice19Page();else if(part==='justice20')await justice20Page();else if(part==='justice21')await justice21Page();else if(part==='justice22')await justice22Page();else if(part==='justice23')await justice23Page();else if(part==='justice24')await justice24Page();else if(part==='service-desk')await serviceDeskPage();else if(part==='health')await healthPage();else if(part==='municipality')await municipalityPage();else if(part==='land')await landPage();else if(part==='commerce')await commercePage();else if(part==='commerce-branches')await commerceBranchesPage();else if(part==='company-treasury')await companyTreasuryPage();else if(part==='company-staff')await companyStaffPage();else if(part==='security')await securityPage();else if(part==='readiness')await readinessPage();else if(part==='bank-admin')await bankAdmin();else if(part==='installments')await installmentsPage();else if(part==='jobs')await jobs();else if(part==='jobs-admin')await jobsAdmin();else page('صفحة غير موجودة','<a href=\"#/\">العودة للرئيسية</a>');window.scrollTo(0,0)}catch(e){page('تعذر تحميل الصفحة',`<p class=\"error\">${safe(e.message)}</p><p>تأكد من إعداد قاعدة بيانات D1 وتطبيق الترحيلات.</p>`)}}\ndocument.querySelector('#menuBtn').onclick=()=>document.querySelector('#nav').classList.toggle('open');addEventListener('hashchange',()=>{document.querySelector('#nav').classList.remove('open');route()});refreshUser().catch(()=>{}).finally(route);\n\nasync function justice21Page(){\n if(!me){location.hash='#/login';return}\n page('مرفقات وأدلة القضايا',`<div class=\"notice\">مرفقات خاصة بالمحاكاة القضائية. لا ترفع وثائق شخصية حقيقية. PDF أو JPG أو PNG أو WebP بحد 5 ميجابايت.</div><form class=\"card form\" id=\"fileLookup\"><label class=\"field\">معرف القضية<input class=\"input\" name=\"case_id\" required minlength=\"10\"></label><button class=\"btn\">فتح المرفقات</button><p role=\"status\"></p></form><div id=\"fileArea\"></div>`);\n const f=document.querySelector('#fileLookup'),initial=location.hash.split('/')[2]||'';if(initial)f.querySelector('[name=case_id]').value=decodeURIComponent(initial);\n f.onsubmit=async e=>{e.preventDefault();const caseId=new FormData(f).get('case_id');try{const r=await api('/justice21/files?case_id='+encodeURIComponent(caseId));const area=document.querySelector('#fileArea');area.innerHTML=`<form class=\"card form\" id=\"fileUpload\"><h3>إضافة مستند للقضية</h3><label class=\"field\">عنوان المستند<input class=\"input\" name=\"title\" minlength=\"3\" maxlength=\"160\" required></label><label class=\"field\">الملف<input class=\"input\" name=\"file\" type=\"file\" accept=\".pdf,.jpg,.jpeg,.png,.webp\" required></label><button class=\"btn gold\">رفع المستند</button><p role=\"status\"></p></form><h3>المرفقات المسجلة</h3>${r.files.map(x=>`<div class=\"card\"><b>${safe(x.title)}</b><p class=\"muted\">${safe(x.filename)} · ${Math.ceil(x.byte_size/1024)} KB · ${safe(x.created_at)}</p><a class=\"btn outline\" href=\"/api/justice21/download?id=${encodeURIComponent(x.id)}\">تنزيل المستند</a></div>`).join('')||'<p class=\"empty\">لا توجد مرفقات.</p>'}`;\n const upload=document.querySelector('#fileUpload');upload.onsubmit=async ev=>{ev.preventDefault();const file=upload.querySelector('[name=file]').files[0];if(!file||file.size>5242880){upload.querySelector('[role=status]').textContent='الحد الأقصى 5 ميجابايت';return}const body=new FormData(upload);try{const response=await fetch('/api/justice21/files?case_id='+encodeURIComponent(caseId),{method:'POST',body,credentials:'same-origin'});const result=await response.json();if(!response.ok)throw Error(result.error||'فشل رفع الملف');f.requestSubmit()}catch(err){upload.querySelector('[role=status]').textContent=err.message}};\n }catch(err){f.querySelector('[role=status]').textContent=err.message}};if(initial)f.requestSubmit();\n}\n\nasync function securityPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/security/sessions');\n page('أمان الحساب والجلسات',`<div class=\"notice\">راقب جلسات الدخول، وألغِ أي جلسة غير معروفة. حماية تسجيل الدخول تحدّ المحاولات المتكررة على اسم المستخدم.</div><div class=\"actions\"><button class=\"btn gold\" id=\"revokeOthers\">تسجيل الخروج من الأجهزة الأخرى</button></div><h2>الجلسات النشطة</h2>${r.sessions.map(x=>`<div class=\"card\"><b>${x.current?'هذا الجهاز':'جلسة أخرى'}</b><p>بداية الجلسة: ${safe(x.created_at)} · تنتهي: ${safe(x.expires_at)}</p><button class=\"btn outline revokeSession\" data-id=\"${safe(x.id)}\">إنهاء الجلسة</button></div>`).join('')||'<p>لا توجد جلسات.</p>'}`);\n document.querySelector('#revokeOthers').onclick=async()=>{if(!await uiConfirm('إنهاء كل الجلسات الأخرى؟'))return;try{await post('/security/revoke-others',{});await securityPage()}catch(e){uiNotice(e.message)}};\n document.querySelectorAll('.revokeSession').forEach(b=>b.onclick=async()=>{if(!await uiConfirm('إنهاء هذه الجلسة؟'))return;try{const r=await post('/security/revoke',{id:b.dataset.id});if(r.selfRevoked){await refreshUser();location.hash='#/login'}else await securityPage()}catch(e){uiNotice(e.message)}});\n}\n\n\nasync function readinessPage(){\n if(!me||me.role!=='king'){page('غير مصرح','هذه الصفحة مخصصة لحساب الملك.');return}\n const r=await api('/admin/readiness');\n const lines=r.checks.map(x=>`<div class=\"card\"><b>${safe(x.label)}</b><p>${x.ok?'متاح · عدد السجلات: '+safe(x.value):'تعذر التحقق: '+safe(x.error)}</p></div>`).join('');\n page('فحص جاهزية الإطلاق',`<div class=\"notice\">هذه لوحة تشخيص للملك فقط. لا تعني النتائج أن الموقع جاهز للإطلاق العام؛ يلزم اختبار أمني وتكاملي على Cloudflare.</div><h2>الربط بالخدمات</h2><div class=\"card\">D1: ${r.bindings.database?'متصل':'غير متصل'} · الأصول: ${r.bindings.assets?'مربوطة':'غير مربوطة'} · R2: ${r.bindings.court_files?'مربوط':'غير مربوط'}</div><h2>فحص الجداول الأساسية</h2>${lines}<div class=\"notice\">الحالة: غير معتمد للإطلاق العام حتى اجتياز اختبارات الصلاحيات والعمليات والنشر الفعلي.</div>`);\n}\n\nasync function enforcementPage(){\n if(!me){location.hash='#/login';return}\n try{\n let autoLift=0,autoLiftError='';\n if(me.role==='king'){\n  try{const sync=await post('/enforcement/reconcile',{});autoLift=Number(sync.lifted||0)}catch(err){autoLiftError=err.message}\n }\n const r=await api('/enforcement/cases');\n const names={1:'الداخلية',3:'العدل',7:'المالية'};\n const statuses={pending:'بانتظار الاعتماد',approved:'معتمدة',rejected:'مرفوضة'};\n const actions={debt:'مطالبة مالية',service_suspension:'طلب إيقاف خدمات',both:'مطالبة مالية وطلب إيقاف خدمات'};\n page('المديونيات وإيقاف الخدمات',`<div class=\"notice\">تُسجل المعاملات بالاسم أو رقم الوثيقة. تُحصّل المديونيات النشطة آليًا من الإيداعات، ويرتفع إيقاف الخدمات المرتبط بالدين عند اكتمال السداد. الإيقاف المستقل لا يُرفع إلا بقرار إداري.</div>${autoLift?`<p role=\"status\" class=\"notice\">رُفع ${autoLift} إيقاف خدمات تلقائيًا بعد التحقق من السداد.</p>`:''}${autoLiftError?`<p role=\"alert\" class=\"notice\">تعذر تحديث الإيقافات تلقائيًا: ${safe(autoLiftError)}</p>`:''}<form id=\"enforcementNew\" class=\"card form\"><h3>فتح معاملة جديدة</h3><label class=\"field\">اسم المستخدم أو رقم الوثيقة<input class=\"input\" name=\"subject_identifier\" placeholder=\"أدخل اسم المستخدم أو رقم الهوية أو الإقامة أو الجواز\" required minlength=\"3\"></label><label class=\"field\">نوع المعاملة<select class=\"input\" name=\"action\" id=\"enforcementAction\"><option value=\"debt\">مطالبة مالية</option><option value=\"service_suspension\">طلب إيقاف خدمات</option><option value=\"both\">مطالبة مالية + طلب إيقاف خدمات</option></select></label><label class=\"field\" id=\"enforcementAmountWrap\">المبلغ بالريال الصالي<input class=\"input\" name=\"amount\" type=\"number\" min=\"0\" max=\"100000000\" value=\"0\" required></label><label class=\"field\">الوزارة المختصة<select class=\"input\" name=\"ministry_id\">${r.ministries.map(id=>`<option value=\"${id}\">${names[id]}</option>`).join('')}</select></label><label class=\"field\">السبب ورقم المعاملة<textarea class=\"input\" name=\"reason\" minlength=\"10\" maxlength=\"500\" required></textarea></label><button class=\"btn gold\">رفع المعاملة للاعتماد</button><p role=\"status\"></p></form><h2>المعاملات المسجلة</h2>${r.cases.map(x=>`<div class=\"card\"><b>${safe(x.subject_username)}</b><p>${safe(x.residency_number||'')} · ${safe(actions[x.action]||'مطالبة مالية')}</p><p>المبلغ: ${safe(x.amount)} ريال صالي</p><p>${safe(x.reason)}</p><p>الحالة: ${safe(statuses[x.status]||x.status)} · الوزارة: ${safe(names[x.ministry_id]||'')}</p>${me.role==='king'&&x.status==='pending'?`<button class=\"btn decisionEnforcement\" data-id=\"${safe(x.id)}\" data-decision=\"approved\">اعتماد</button> <button class=\"btn outline decisionEnforcement\" data-id=\"${safe(x.id)}\" data-decision=\"rejected\">رفض</button>`:''}</div>`).join('')||'<p>لا توجد معاملات.</p>'}<h2>حالة إيقاف الخدمات</h2>${(r.suspensions||[]).map(h=>`<div class=\"card\"><b>${safe(h.subject_username)}</b><p>${safe(h.reason)}</p><p>${h.status==='active'?'إيقاف خدمات نشط':'تم رفع الإيقاف'}</p>${h.case_action==='both'&&h.debt_status==='paid'?'<p>المديونية مسددة بالكامل.</p>':''}${me.role==='king'&&h.status==='active'?`<button type=\"button\" class=\"btn liftEnforcement\" data-id=\"${safe(h.id)}\">رفع الإيقاف</button><form class=\"liftEnforcementForm form\" data-id=\"${safe(h.id)}\" hidden><label class=\"field\">سبب رفع الإيقاف<textarea class=\"input\" name=\"reason\" minlength=\"5\" maxlength=\"500\" required>قرار ملكي برفع إيقاف الخدمات</textarea></label><div class=\"actions\"><button type=\"submit\" class=\"btn gold\">تأكيد رفع الإيقاف</button><button type=\"button\" class=\"btn outline cancelLiftEnforcement\">إلغاء</button></div><p role=\"status\"></p></form>`:''}</div>`).join('')||'<p>لا توجد إيقافات.</p>'}`);\n const form=document.querySelector('#enforcementNew'),action=form.querySelector('#enforcementAction'),amount=form.querySelector('[name=amount]');\n const sync=()=>{const suspended=action.value==='service_suspension';amount.disabled=suspended;amount.required=!suspended;if(suspended)amount.value='0';else amount.min='1'};\n action.onchange=sync;sync();\n form.onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(form));b.amount=Number(b.amount||0);b.ministry_id=Number(b.ministry_id);await post('/enforcement/cases',b);await enforcementPage()}catch(err){form.querySelector('[role=status]').textContent=err.message}};\n app.onsubmit=async e=>{\n  const form=e.target.closest?.('.liftEnforcementForm');if(!form)return;\n  e.preventDefault();const status=form.querySelector('[role=status]');\n  const reason=String(form.querySelector('[name=reason]').value||'').trim();\n  if(reason.length<5){status.textContent='اكتب سببًا لا يقل عن 5 أحرف.';return}\n  const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);\n  status.textContent='جارٍ رفع إيقاف الخدمات...';\n  try{await post('/enforcement/lift',{id:form.dataset.id,reason});await enforcementPage()}\n  catch(err){status.textContent='تعذر رفع الإيقاف: '+err.message;buttons.forEach(b=>b.disabled=false)}\n };\n // Delegated handler: works even when the case cards are re-rendered.\n const decisions=document.querySelectorAll('.decisionEnforcement');\n decisions.forEach(btn=>btn.setAttribute('type','button'));\n app.onclick=async e=>{\n  const target=e.target instanceof Element?e.target:e.target?.parentElement;\n  const lift=target?.closest('.liftEnforcement');\n  if(lift&&app.contains(lift)&&!lift.disabled){\n   e.preventDefault();const form=lift.closest('.card').querySelector('.liftEnforcementForm');\n   form.hidden=!form.hidden;if(!form.hidden)form.querySelector('[name=reason]').focus();return;\n  }\n  const cancel=target?.closest('.cancelLiftEnforcement');\n  if(cancel&&app.contains(cancel)){e.preventDefault();cancel.closest('.liftEnforcementForm').hidden=true;return}\n  const btn=target?.closest('.decisionEnforcement');\n  if(!btn||!app.contains(btn)||btn.disabled)return;\n  e.preventDefault();\n  const id=btn.dataset.id,decision=btn.dataset.decision;\n  const card=btn.closest('.card');\n  let status=card.querySelector('.enforcementDecisionStatus');\n  if(!status){status=document.createElement('p');status.className='enforcementDecisionStatus';status.setAttribute('role','status');card.appendChild(status)}\n  status.textContent='جارٍ '+(decision==='approved'?'اعتماد':'رفض')+' المعاملة...';\n  const buttons=card.querySelectorAll('.decisionEnforcement');\n  buttons.forEach(x=>x.disabled=true);\n  try{\n   const result=await post('/enforcement/decision',{id,decision});\n   status.textContent='تم '+(result.status==='approved'?'اعتماد':'رفض')+' المعاملة بنجاح.';\n   await enforcementPage();\n  }catch(err){\n   status.textContent='فشل تنفيذ القرار: '+err.message;\n   status.style.color='#b42318';\n   buttons.forEach(x=>x.disabled=false);\n  }\n };\n\n }catch(err){page('المديونيات وإيقاف الخدمات','<div class=\"notice\">'+safe(err.message)+'</div>')}\n}\n\nasync function xSaliyah(){\n try{\n  const r=await api('/x/feed');const own=r.profile;app.onclick=null;\n  let earnings=null,bankAccounts=[];\n  if(own){try{earnings=await api('/x/earnings');if(earnings.kind==='person'){const b=await api('/banking/accounts');bankAccounts=b.accounts||[]}}catch{}}\n  let ministryOptions='';\n  if(me&&!own){try{const m=await api('/x/ministries');ministryOptions=m.ministries.map(x=>'<option value=\"'+x.id+'\">'+safe(x.name)+'</option>').join('')}catch{}}\n  page('𝕏 إكس الصالية',`\n  <div class=\"notice\">منصة تواصل داخل المملكة العربية الصالية. الحسابات الحكومية الموثقة تحمل علامة ✓. الإعجابات الآلية محاكاة لجمهور بوتات كبير، تبدأ تدريجياً وتكبر خلال أسابيع وقد تتجاوز مليون إعجاب على المنشور، وليست تفاعلات بشرية. حساب ChatGPT الصالي حساب بوت تعريفي، وليس جهة حكومية، ولا يرد تلقائياً.</div>\n  ${!me?'<div class=\"card\">سجّل الدخول لإنشاء حساب أو التفاعل. <a href=\"#/login\">تسجيل الدخول</a></div>':!own?`<form id=\"xRegister\" class=\"card form\"><h3>إنشاء حساب إكس الصالية</h3><label>نوع الحساب<select class=\"input\" name=\"ministry_id\"><option value=\"\">حساب شخصي</option>${ministryOptions}</select></label><label>اسم المستخدم (إنجليزي)<input class=\"input\" name=\"handle\" minlength=\"3\" maxlength=\"24\" pattern=\"[a-zA-Z0-9_]{3,24}\" required placeholder=\"ziad701\"></label><label>الاسم الظاهر<input class=\"input\" name=\"display_name\" minlength=\"2\" maxlength=\"60\" required placeholder=\"الاسم الظاهر\"></label><button class=\"btn gold\">إنشاء الحساب</button><p class=\"muted\">الحساب الوزاري يُنشأ فقط بصلاحية رسمية ويوثّق تلقائياً.</p></form>`:`<div class=\"card\"><strong>${safe(own.display_name)} ${own.kind==='bot'?'🤖':own.verified?'✓':''}</strong> <span class=\"muted\" dir=\"ltr\">@${safe(own.handle)}</span></div><form id=\"xCompose\" class=\"card form\"><h3>منشور جديد</h3><textarea class=\"input\" name=\"body\" maxlength=\"500\" placeholder=\"وش الجديد؟\"></textarea><label>صورة أو فيديو قصير (حتى 1 ميجابايت)<input class=\"input\" type=\"file\" name=\"media\" accept=\"image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm\"></label><button class=\"btn gold\">نشر</button></form>`}\n  ${earnings?`<section class=\"card\"><h3>⭐ برنامج شهرة الصالية</h3><p>متابعون (يشمل الجمهور الآلي المحاكى): <b>${earnings.stats.followers}</b> / 10 · إعجابات (منها ${earnings.stats.bot_likes} آلية): <b>${earnings.stats.likes}</b> / 20 · إعادات نشر (منها ${earnings.stats.bot_reposts} آلية): <b>${earnings.stats.reposts}</b> / 5</p><p>مكافأة فترة الثلاثة أيام الحالية: <strong>${earnings.amount} ريال صالي افتراضي</strong> (بدون سقف أعلى للأرباح).</p><p class=\"muted\">يمكن صرف المكافأة مرة واحدة كل 3 أيام، والصرف التلقائي متاح بعد اختيار حسابك البنكي وتفعيله، ويمكن إيقافه. تفاعلات الجمهور الآلي المحاكى تمنح نصف قيمة تفاعلات الأشخاص الحقيقيين. لا تُحتسب تفاعلاتك مع نفسك، والحسابات الحكومية والبوتات لا تستلم أرباحاً.</p>${earnings.kind==='person'?`<form id=\"xAutoPay\"><h4>الصرف التلقائي: ${earnings.auto_payout?.enabled?'مفعّل':'متوقف'}</h4><select class=\"input\" name=\"bank_account_id\">${bankAccounts.map(a=>`<option value=\"${safe(a.id)}\" ${earnings.auto_payout?.bank_account_id===a.id?'selected':''}>${safe(a.bank)} · ${safe(a.balance)} ريال</option>`).join('')}</select><button class=\"btn\" name=\"enabled\" value=\"true\" ${bankAccounts.length?'':'disabled'}>تفعيل / تحديث الحساب</button> <button class=\"btn\" name=\"enabled\" value=\"false\">إيقاف الصرف التلقائي</button></form>`:''}${earnings.kind!=='person'?'<p>هذا الحساب غير مؤهل للأرباح.</p>':earnings.paid?`<p>✓ تم صرف مكافأة هذه الفترة.</p>${earnings.paid_receipt?`<div class=\"notice\"><b>إيصال الأرباح:</b> إجمالي ${Number(earnings.paid_receipt.amount).toLocaleString('ar-SA')} ريال · تحصيل الديون ${Number(earnings.paid_receipt.debt_collected).toLocaleString('ar-SA')} ريال · صافي الإيداع ${Number(earnings.paid_receipt.net_credited).toLocaleString('ar-SA')} ريال. البنك: ${safe(earnings.paid_receipt.bank)}.</div>`:''}`:earnings.eligible?`<form id=\"xClaim\"><label>الحساب البنكي لاستلام الأرباح<select class=\"input\" name=\"bank_account_id\" required>${bankAccounts.map(a=>`<option value=\"${safe(a.id)}\">${safe(a.bank)} · ${safe(a.balance)} ريال</option>`).join('')}</select></label><button class=\"btn gold\" ${bankAccounts.length?'':'disabled'}>صرف الأرباح</button></form>`:'<p>اجمع التفاعلات المطلوبة لفتح الأرباح.</p>'}</section>`:''}\n  <section class=\"card\"><h3>🤖 دليل حسابات البوتات</h3><p class=\"muted\">حسابات محاكاة واضحة الهوية، وليست مستخدمين حقيقيين.</p><div id=\"xBotDirectory\">اضغط لعرض الحسابات الآلية.</div><button class=\"btn\" id=\"xLoadBots\">عرض حسابات البوتات</button></section>\n  <h2>آخر المنشورات</h2><div id=\"xFeed\">${r.posts.length?r.posts.map(p=>`<article class=\"card\" style=\"margin-bottom:12px\"><strong>${safe(p.display_name)} ${p.kind==='bot'?'🤖':p.verified?'✓':''}</strong> <span class=\"muted\" dir=\"ltr\">@${safe(p.handle)}</span> <small class=\"muted\">${safe(p.created_at)}</small><p style=\"white-space:pre-wrap;overflow-wrap:anywhere\">${safe(p.body)}</p>${p.media_url?(p.media_type.startsWith(\"image/\")?`<img loading=\"lazy\" src=\"${safe(p.media_url)}\" alt=\"صورة مرفقة\" style=\"max-width:100%;max-height:480px;border-radius:12px;display:block;margin:10px 0\">`:`<video controls preload=\"metadata\" src=\"${safe(p.media_url)}\" style=\"max-width:100%;max-height:480px;border-radius:12px;display:block;margin:10px 0\"></video>`):\"\"}${p.reply_to?'<small class=\"muted\">رد على منشور</small>':''}${p.repost_of?'<small class=\"muted\">إعادة نشر</small>':''}<div style=\"display:flex;gap:8px;flex-wrap:wrap\"><button class=\"btn xLike\" data-id=\"${safe(p.id)}\">♡ ${Number.isFinite(Number(p.likes))?Number(p.likes):0}</button><button class=\"btn xReply\" data-id=\"${safe(p.id)}\">اكتب تعليق</button><button class=\"btn xComments\" data-id=\"${safe(p.id)}\">💬 التعليقات ${p.replies}</button><button class=\"btn xRepost\" data-id=\"${safe(p.id)}\">إعادة نشر</button><button class=\"btn xFollow\" data-handle=\"${safe(p.handle)}\">متابعة</button></div></article>`).join(''):'<div class=\"card\">ما فيه منشورات حتى الآن. كن أول من ينشر!</div>'}</div>`);\n  const loadBots=async(page=1)=>{const area=document.querySelector('#xBotDirectory');try{const data=await api('/x/bot-directory?page='+page);area.innerHTML=data.bots.map(bot=>'<p>🤖 <strong>'+safe(bot.display_name)+'</strong> <span dir=\"ltr\">@'+safe(bot.handle)+'</span> <button class=\"btn xBotProfile\" data-handle=\"'+safe(bot.handle)+'\">الملف والمنشورات</button></p>').join('')+'<p>الصفحة '+data.pagination.page+' من '+(data.pagination.pages||1)+' — إجمالي الحسابات: '+data.pagination.total+'</p><button class=\"btn\" id=\"xBotsPrev\" '+(page<=1?'disabled':'')+'>السابق</button> <button class=\"btn\" id=\"xBotsNext\" '+(page>=data.pagination.pages?'disabled':'')+'>التالي</button>';area.querySelectorAll('.xBotProfile').forEach(btn=>btn.onclick=async()=>{try{const p=await api('/x/profile?handle='+encodeURIComponent(btn.dataset.handle));const detail=document.createElement('div');detail.className='card';detail.innerHTML='<h4>🤖 '+safe(p.profile.display_name)+' <span dir=\"ltr\">@'+safe(p.profile.handle)+'</span></h4><p>'+safe(p.profile.bio||'حساب محاكاة')+'</p><p>متابعون حقيقيون مسجلون: '+Number(p.followers)+'</p><h4>آخر المنشورات</h4>'+(p.posts.length?p.posts.map(post=>'<p>'+safe(post.body)+'</p>').join(''):'<p>لا توجد منشورات.</p>');area.querySelector('#xBotProfileDetail')?.remove();detail.id='xBotProfileDetail';area.append(detail)}catch(err){uiNotice(err.message)}});area.querySelector('#xBotsPrev').onclick=()=>loadBots(page-1);area.querySelector('#xBotsNext').onclick=()=>loadBots(page+1)}catch(err){area.textContent='تعذر عرض حسابات البوتات: '+err.message}};\n  document.querySelector('#xLoadBots').onclick=()=>loadBots(1);\n  const autoForm=document.querySelector('#xAutoPay');if(autoForm)autoForm.addEventListener('click',async e=>{const btn=e.target.closest('button[name=\"enabled\"]');if(!btn)return;e.preventDefault();btn.disabled=true;try{await post('/x/earnings/auto',{enabled:btn.value==='true',bank_account_id:new FormData(autoForm).get('bank_account_id')});await xSaliyah()}catch(err){uiNotice(err.message);btn.disabled=false}});\n  const claim=document.querySelector('#xClaim');if(claim)claim.onsubmit=async e=>{e.preventDefault();const btn=claim.querySelector('button');btn.disabled=true;try{const r=await post('/x/earnings/claim',{bank_account_id:new FormData(claim).get('bank_account_id')});uiNotice('صرف X: '+r.amount+' ريال؛ تحصيل دين: '+(r.debt_collected||0)+' ريال؛ صافي الإيداع: '+(r.net_credited??r.amount)+' ريال.');await xSaliyah()}catch(err){uiNotice(err.message);btn.disabled=false}};\n  const reg=document.querySelector('#xRegister');if(reg)reg.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(reg));if(!b.ministry_id)delete b.ministry_id;b.handle=String(b.handle||'').trim().toLowerCase();b.display_name=String(b.display_name||'').trim();const btn=reg.querySelector('button[type=submit],button');btn.disabled=true;try{await post('/x/account',b);await xSaliyah()}catch(err){uiNotice('تعذر إنشاء الحساب: '+err.message);btn.disabled=false}};\n  const form=document.querySelector('#xCompose');if(form)form.onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(form);const file=fd.get('media');let media=null;if(file&&file.size){if(file.size>1048576)throw Error('الملف أكبر من 1 ميجابايت. اختر صورة أو فيديو أقصر');if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'].includes(file.type))throw Error('نوع الملف غير مدعوم');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('تعذر قراءة الملف'));reader.readAsDataURL(file)});media={type:file.type,data}}await post('/x/post',{body:fd.get('body'),media});await xSaliyah()}catch(err){uiNotice(err.message)}};\n  document.querySelectorAll('.xLike').forEach(b=>b.onclick=async()=>{try{await post('/x/like',{post_id:b.dataset.id});await xSaliyah()}catch(err){uiNotice(err.message)}});\n  document.querySelectorAll('.xReply').forEach(b=>b.onclick=async()=>{const body=await uiPrompt('اكتب ردك (500 حرف كحد أقصى)');if(!body)return;try{await post('/x/post',{body,reply_to:b.dataset.id});await xSaliyah()}catch(err){uiNotice(err.message)}});\n  document.querySelectorAll('.xComments').forEach(b=>b.onclick=async()=>{const article=b.closest('article');let area=article.querySelector('.xRealCommentList');if(area){area.remove();return}area=document.createElement('div');area.className='xRealCommentList';area.style.cssText='margin-top:12px;padding-top:10px;border-top:1px solid #8885';area.textContent='جاري تحميل التعليقات...';article.appendChild(area);try{const r=await api('/x/comments?post_id='+encodeURIComponent(b.dataset.id));area.innerHTML='<h4>💬 التعليقات</h4>'+(r.comments.length?r.comments.map(c=>'<div style=\"margin:10px 0\"><strong>'+safe(c.display_name)+'</strong> '+(c.verified?'✓ ':'')+'<small class=\"muted\" dir=\"ltr\">@'+safe(c.handle)+'</small><p style=\"white-space:pre-wrap;overflow-wrap:anywhere\">'+safe(c.body)+'</p></div>').join(''):'لا توجد تعليقات بعد. كن أول من يعلّق!')}catch(err){area.textContent='تعذر عرض التعليقات: '+err.message}});\n  document.querySelectorAll('.xRepost').forEach(b=>b.onclick=async()=>{try{await post('/x/post',{body:'إعادة نشر',repost_of:b.dataset.id});await xSaliyah()}catch(err){uiNotice(err.message)}});\n  document.querySelectorAll('.xFollow').forEach(b=>b.onclick=async()=>{try{const r=await post('/x/follow',{handle:b.dataset.handle});uiNotice(r.following?'تمت المتابعة':'أُلغيت المتابعة')}catch(err){uiNotice(err.message)}});\n }catch(err){page('إكس الصالية','<div class=\"notice\">'+safe(err.message)+'</div>')}\n}\n\nasync function simDirectoryPage(){\n const kinds=[['citizens','مواطنون افتراضيون'],['companies','شركات البوتات'],['institutions','المدارس والجامعات'],['jobs','وظائف البوتات'],['properties','عقارات البوتات'],['x','حسابات إكس'],['lawyers','موظفو القضاء الآليون'],['banking','الحسابات البنكية الافتراضية'],['shares','المساهمون والأسهم'],['tourists','السياح الافتراضيون']];\n page('سكان ومنشآت المملكة الصالية',`<div class=\"notice\">🤖 هذه كيانات افتراضية داخل محاكاة الدولة، لها أسماء وأرقام مرجعية وشرائح تواصل داخلية لا تعمل خارج المنصة. تستطيع استعراضها والتقديم لوظائفها ومدارسها ومراسلتها. لا توجد بيانات حسابات أو أشخاص حقيقيين هنا.</div><div class=\"card form\"><label class=\"field\">نوع الكيان<select class=\"input\" id=\"simDirType\">${kinds.map(([k,n])=>`<option value=\"${k}\">${n}</option>`).join('')}</select></label><label class=\"field\">البحث بالاسم أو الرقم<input class=\"input\" id=\"simDirSearch\" placeholder=\"اسم، رقم SIM، أو رقم الحساب\"></label><button class=\"btn gold\" id=\"simDirGo\">بحث</button></div><div id=\"simDirItems\"></div><div class=\"actions\"><button class=\"btn\" id=\"simDirPrev\" disabled>السابق</button><span id=\"simDirPage\"></span><button class=\"btn\" id=\"simDirNext\" disabled>التالي</button></div>${me?'<div class=\"card\"><h2>مراسلاتي مع سكان ومنشآت الصالية</h2><p class=\"muted\">يردّ البوت في دورة المحاكاة التالية، والرد موسوم 🤖.</p><div id=\"simDirMessages\">جارٍ التحميل…</div></div>':'<p>سجّل دخولك حتى تستطيع مراسلة هذه الكيانات والتعامل معها.</p>'}<div id=\"simBotPayments\"></div>`);\n const select=document.querySelector('#simDirType'),search=document.querySelector('#simDirSearch'),items=document.querySelector('#simDirItems'),prev=document.querySelector('#simDirPrev'),next=document.querySelector('#simDirNext'),pageNum=document.querySelector('#simDirPage');\n let currentPage=1,lastMore=false,bankAccounts=[];\n if(me){try{bankAccounts=(await api('/banking/accounts')).accounts||[]}catch{}}\n async function loadMessages(){\n  if(!me)return;\n  try{const d=await api('/sim-directory/contacts');const target=document.querySelector('#simDirMessages');if(!target)return;\n   target.innerHTML=(d.messages||[]).map(m=>`<article class=\"card\"><b>SIM-${safe(m.target_type)}-${safe(m.target_id)}</b><p>${safe(m.message)}</p><p class=\"muted\">الحالة: ${m.status==='replied'?'تم الرد':'بانتظار رد البوت'} · ${safe(m.created_at)}</p>${m.bot_reply?`<p>${safe(m.bot_reply)}</p>`:''}</article>`).join('')||'<p>ما عندك مراسلات حتى الآن.</p>';\n  }catch(e){document.querySelector('#simDirMessages').textContent=e.message}\n }\n async function load(){\n  items.textContent='جارٍ تحميل سجلات الصالية…';\n  try{\n   const t=select.value,q=search.value.trim();\n   const d=await api('/sim-directory?type='+encodeURIComponent(t)+'&q='+encodeURIComponent(q)+'&page='+currentPage);\n   lastMore=d.more;pageNum.textContent='الصفحة '+currentPage;prev.disabled=currentPage===1;next.disabled=!lastMore;\n   const labels={simulation_number:'الرقم الصالي',sim_phone_number:'رقم الشريحة الداخلية',sim_operator:'مشغل الشريحة الافتراضي',account_number:'رقم الحساب',name:'الاسم',display_name:'الاسم',company_name:'الشركة',founder_name:'المؤسس',owner_name:'المالك',owner_type:'نوع المالك',occupation:'المهنة',gender:'الجنس',activity:'النشاط',location:'المكان',title:'المسمى',salary:'الراتب',price:'السعر',units:'الأسهم',level:'المرحلة',sector:'القطاع',tuition:'الرسوم',status:'الحالة',created_at:'تاريخ الإنشاء',nationality:'الجنسية',handle:'حساب إكس',bio:'النبذة',kind:'النوع',bank_name:'البنك',role:'الوظيفة',company_id:'رقم الشركة',visit_purpose:'غرض الزيارة',arrival_port:'المنفذ',capital:'رأس المال',active:'نشط',id:'المعرّف الفني',owner_id:'معرف المالك',account_id:'معرف الحساب',institution_id:'معرف المؤسسة'};\n   const display=d.items.map(v=>{\n    const name=v.name||v.company_name||v.title||v.owner_name||v.account_number||v.id;\n    const details=Object.entries(v).filter(([k,val])=>val!=null&&k!=='automated'&&k!=='bio'&&k!=='name'&&k!=='id'&&k!=='display_name').map(([k,val])=>`<p class=\"muted\"><b>${safe(labels[k]||k)}:</b> ${safe(val)}</p>`).join('');\n    return `<article class=\"card\" data-sim-id=\"${safe(v.id)}\"><h3>🤖 ${safe(name)}</h3>${details}${v.bio?`<p>${safe(v.bio)}</p>`:''}<div class=\"actions\">${me?`<button class=\"btn simContact\" data-id=\"${safe(v.id)}\" data-type=\"${safe(t)}\">مراسلة الكيان</button>`:''}${t==='companies'?'<a class=\"btn\" href=\"#/sim-market\">أسهم الشركات</a>':''}${t==='properties'?'<a class=\"btn\" href=\"#/sim-market\">سوق العقارات</a>':''}${me&&t==='institutions'?`<button class=\"btn simApplySchool\" data-id=\"${safe(v.id)}\">التقديم على المؤسسة</button>`:''}${me&&t==='jobs'&&v.status==='open'?`<button class=\"btn simApplyJob\" data-id=\"${safe(v.id)}\">التقديم على الوظيفة</button>`:''}${t==='x'&&v.handle?`<button class=\"btn simXProfile\" data-handle=\"${safe(v.handle)}\">ملف إكس</button>`:''}</div><div class=\"simActionOutput\"></div></article>`;\n   }).join('');\n   items.innerHTML=display||'<p class=\"card\">لا توجد كيانات مطابقة.</p>';\n   items.querySelectorAll('.simContact').forEach(btn=>btn.onclick=()=>{\n    const box=btn.closest('article').querySelector('.simActionOutput');\n    box.innerHTML='<form class=\"form simContactForm\"><label class=\"field\">الرسالة<textarea class=\"input\" name=\"message\" rows=\"3\" minlength=\"5\" maxlength=\"1000\" required></textarea></label><button class=\"btn gold\">إرسال الرسالة</button><p role=\"status\"></p></form>';\n    box.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const msg=e.target.querySelector('textarea').value;await post('/sim-directory/contact',{type:btn.dataset.type,id:btn.dataset.id,message:msg});box.innerHTML='<p>أُرسلت الرسالة إلى الكيان الافتراضي. يظهر الرد بعد دورة المحاكاة التالية.</p>';await loadMessages()}catch(err){e.target.querySelector('[role=status]').textContent=err.message;button.disabled=false}};\n   });\n   items.querySelectorAll('.simApplySchool').forEach(btn=>btn.onclick=async()=>{const box=btn.closest('article').querySelector('.simActionOutput');try{await post('/education/apply',{institution_id:btn.dataset.id});box.textContent='تم إرسال طلب التسجيل إلى المؤسسة'}catch(e){box.textContent=e.message}});\n   items.querySelectorAll('.simApplyJob').forEach(btn=>btn.onclick=()=>{const box=btn.closest('article').querySelector('.simActionOutput');box.innerHTML='<form class=\"form\"><textarea class=\"input\" minlength=\"10\" maxlength=\"2000\" required placeholder=\"اكتب مؤهلاتك وخبراتك\"></textarea><button class=\"btn gold\">إرسال طلب التوظيف</button><p role=\"status\"></p></form>';box.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await post('/jobs/apply',{vacancy_id:btn.dataset.id,statement:e.target.querySelector('textarea').value});box.textContent='تم إرسال طلبك إلى الشركة الافتراضية'}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}});\n   items.querySelectorAll('.simXProfile').forEach(btn=>btn.onclick=async()=>{const box=btn.closest('article').querySelector('.simActionOutput');try{const d=await api('/x/profile?handle='+encodeURIComponent(btn.dataset.handle));box.innerHTML='<pre class=\"card\">'+safe(JSON.stringify(d.profile||d,null,2))+'</pre>'}catch(e){box.textContent=e.message}});\n   const payArea=document.querySelector('#simBotPayments');\n   if(me&&t==='banking')payArea.innerHTML=`<div class=\"card\"><h2>تحويل ريال صالي إلى أحد حسابات البوتات</h2><form class=\"form\" id=\"simPayBot\"><label class=\"field\">حسابك<select class=\"input\" name=\"account_id\">${bankAccounts.map(a=>`<option value=\"${safe(a.id)}\">${safe(a.bank)} · ${Number(a.balance).toLocaleString('ar-SA')} ريال</option>`).join('')}</select></label><label class=\"field\">رقم حساب المستلم<input name=\"recipient_account_number\" class=\"input\" required placeholder=\"SC أو SB\"></label><label class=\"field\">المبلغ<input name=\"amount\" class=\"input\" type=\"number\" min=\"1\" max=\"100000000\" required></label><label class=\"field\">البيان<input name=\"memo\" class=\"input\" maxlength=\"200\"></label><button class=\"btn gold\" ${bankAccounts.length?'':'disabled'}>تحويل</button><p role=\"status\"></p></form></div>`;\n   else payArea.innerHTML='';\n   if(me&&t==='banking'){items.querySelectorAll('article').forEach(card=>{const acc=d.items.find(v=>v.id===card.dataset.simId);if(acc?.account_number){const fill=document.createElement('button');fill.className='btn';fill.textContent='تحويل لهذا الحساب';fill.onclick=()=>{payArea.querySelector('[name=recipient_account_number]').value=acc.account_number;payArea.scrollIntoView({behavior:'smooth'})};card.querySelector('.actions').append(fill)}});const form=payArea.querySelector('form');if(form)form.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);try{await post('/sim-directory/payment',b);e.target.querySelector('[role=status]').textContent='تم التحويل داخل المملكة الصالية بنجاح'}catch(err){e.target.querySelector('[role=status]').textContent=err.message}}}\n  }catch(e){items.textContent=e.message}\n }\n document.querySelector('#simDirGo').onclick=()=>{currentPage=1;load()};\n select.onchange=()=>{currentPage=1;load()};\n search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();currentPage=1;load()}};\n prev.onclick=()=>{if(currentPage>1){currentPage--;load()}};\n next.onclick=()=>{if(lastMore){currentPage++;load()}};\n await Promise.all([load(),loadMessages()]);\n}\nasync function simMarketPage(){\n const [market,properties,banking]=await Promise.allSettled([api('/sim-market'),api('/sim-market/properties'),me?api('/banking/accounts'):Promise.resolve({accounts:[]})]);\n if(properties.status==='rejected')throw properties.reason;\n const d=market.status==='fulfilled'?market.value:{companies:[],portfolio:[],trades:[]};\n const p=properties.value;\n const accounts=banking.status==='fulfilled'?(banking.value.accounts||[]):(d.accounts||[]);\n const accountOptions=accounts.map(a=>`<option value=\"${safe(a.id)}\">${safe(a.bank)} — ${Number(a.balance).toLocaleString('ar-SA')} ريال صالي</option>`).join('');\n page('سوق الأسهم والعقارات في المملكة الصالية',`<div class=\"actions\"><a class=\"btn gold\" href=\"#/my-properties\">🏡 عقاراتي وسندات الملكية</a></div><div class=\"notice\">📈 تداول افتراضي فقط، بالريال الصالي. الأسهم تتداول بين الإنسان والكيانات الآلية باستخدام أرصدة النظام، مع تسجيل الملكية والتحويلات داخل D1.</div><h2>الشركات المدرجة</h2><div class=\"grid\">${d.companies.map(c=>`<article class=\"card\"><h3>🤖 ${safe(c.name)}</h3><p class=\"muted\">رقم التسجيل: ${safe(c.registry_number)}</p><p>${safe(c.activity)} · ${safe(c.location)}</p><p>سعر السهم: <b>${Number(c.unit_price).toLocaleString('ar-SA')} ريال</b></p><p>الأسهم المعروضة: ${Number(c.available_units||0).toLocaleString('ar-SA')}</p><p>قدرة الطرف الآلي على الشراء: ${Number(c.buyback_units||0).toLocaleString('ar-SA')} سهم</p></article>`).join('')||'<p>لا توجد شركات مدرجة بعد.</p>'}</div>${me?`<div class=\"card\"><h2>شراء أو بيع أسهم</h2><form id=\"simStockTrade\" class=\"form\"><label class=\"field\">الشركة<select class=\"input\" name=\"company_id\">${d.companies.map(c=>`<option value=\"${safe(c.id)}\">${safe(c.name)} · ${Number(c.unit_price)} ريال للسهم</option>`).join('')}</select></label><label class=\"field\">العملية<select class=\"input\" name=\"direction\"><option value=\"buy\">شراء من بوت</option><option value=\"sell\">بيع إلى بوت</option></select></label><label class=\"field\">عدد الأسهم<input class=\"input\" name=\"units\" type=\"number\" min=\"1\" max=\"1000\" required value=\"1\"></label><label class=\"field\">حسابك البنكي<select class=\"input\" name=\"account_id\">${accountOptions}</select></label><button class=\"btn gold\" ${accounts.length&&d.companies.length?'':'disabled'}>تنفيذ الصفقة</button><p role=\"status\"></p></form><p class=\"muted\">يتم التحقق من السعر والرصيد وملكية الأسهم مرة ثانية داخل قاعدة البيانات قبل تنفيذ الصفقة.</p></div><h2>محفظة أسهمي</h2><div class=\"grid\">${d.portfolio.map(x=>`<article class=\"card\"><b>${safe(x.company_name)}</b><p>${Number(x.units)} سهم · القيمة التقديرية ${(Number(x.units)*Number(x.unit_price)).toLocaleString('ar-SA')} ريال صالي</p></article>`).join('')||'<p>ما عندك أسهم بعد.</p>'}</div><h2>عمليات تداولي</h2>${d.trades.map(t=>`<div class=\"card\">${t.direction==='buy'?'شراء':'بيع'} ${Number(t.units)} سهم من ${safe(t.company_name)} بسعر ${Number(t.unit_price)} ريال · الطرف الآلي: ${safe(t.counterparty_name)} · ${safe(t.created_at)}</div>`).join('')||'<p>لا توجد صفقات مسجلة.</p>'}`:'<p class=\"card\">سجل دخولك لتداول الأسهم وشراء العقارات.</p>'}<h2>العقارات والوحدات السكنية المعروضة للبيع</h2><div class=\"grid\">${p.listed.map(x=>`<article class=\"card\"><h3>${safe(x.unit_type||x.kind)} — ${safe(x.project_name||x.location)}</h3>${x.project_name?`<p>🏗️ حالة الحي: ${x.construction_status==='completed'?'مكتمل البناء وجاهز للبيع':'قيد البناء'} · الوحدة رقم ${safe(x.unit_number)}</p><p>المساحة: <b>${safe(x.area_sqm)} م²</b> · غرف النوم: <b>${safe(x.bedrooms)}</b> · دورات المياه: <b>${safe(x.bathrooms)}</b> · مواقف السيارات: <b>${safe(x.parking)}</b></p><p>الدور: ${Number(x.floor)===0?'أرضي':safe(x.floor)} · ${safe(x.features)}</p>`:''}<p>الموقع: ${safe(x.location)} · البائع: 🤖 ${safe(x.seller_name)}</p><p>رقم العقار: ${safe(x.registration_number)}</p><p><b>${Number(x.price).toLocaleString('ar-SA')} ريال صالي</b></p>${me?`<form class=\"form simBuyPropertyForm\" data-id=\"${safe(x.id)}\"><label class=\"field\">حسابك البنكي<select class=\"input\" name=\"account_id\" required>${accountOptions}</select></label><button type=\"submit\" class=\"btn gold\" ${accounts.length?'':'disabled'}>شراء هذه الوحدة</button><p role=\"status\"></p></form>`:''}</article>`).join('')||'<p>لا توجد عقارات معروضة للبيع حاليًا.</p>'}</div><h2>سجل شراء البوتات للعقارات</h2><div class=\"notice\">البوتات تقدر تشتري العقارات المعروضة إذا عندها رصيد كافٍ في حسابها الصالي الافتراضي. يسجل النظام المبلغ والملكية تلقائيًا، بدون منح بيوت مجانًا.</div>${(p.botPurchases||[]).map(x=>`<div class=\"card\"><b>${safe(x.buyer_name)}</b> اشترى ${safe(x.kind)} في ${safe(x.location)} مقابل ${Number(x.price).toLocaleString('ar-SA')} ريال صالي <small>${safe(x.created_at)}</small></div>`).join('')||'<p class=\"muted\">ما فيه مشتريات بوتات جديدة مسجلة بعد.</p>'}${me?'<h2>عقاراتي</h2>'+((p.mine||[]).map(x=>`<div class=\"card\">${safe(x.unit_type||x.kind)} · ${safe(x.project_name||x.location)} ${x.unit_number?'· الوحدة '+safe(x.unit_number):''} · رقم الملكية SIM-PR-${safe(x.id)}</div>`).join('')||'<p>لا تملك عقارات افتراضية حاليًا.</p>'):''}`);\n const form=document.querySelector('#simStockTrade');\n if(form)form.onsubmit=async e=>{\n  e.preventDefault();\n  const v=Object.fromEntries(new FormData(form));v.units=Number(v.units);\n  const c=d.companies.find(x=>x.id===v.company_id);\n  const notice=form.querySelector('[role=status]');\n  if(!c?.counterparty_id){notice.textContent='لا يوجد طرف آلي يملك أسهمًا وحسابًا بنكيًا جاهزًا لهذه الشركة';return}\n  const own=(d.portfolio||[]).find(x=>x.company_id===v.company_id);\n  if(v.direction==='buy'&&v.units>Number(c.available_units||0)){notice.textContent='الأسهم المتاحة غير كافية';return}\n  if(v.direction==='sell'&&v.units>Number(own?.units||0)){notice.textContent='لا تملك هذا العدد من الأسهم';return}\n  v.counterparty_id=c.counterparty_id;\n  const button=form.querySelector('button[type=submit],button');button.disabled=true;\n  try{const out=await post('/sim-market/trade',v);uiNotice('تمت الصفقة بقيمة '+out.total+' ريال صالي');await simMarketPage()}\n  catch(err){notice.textContent=err.message;button.disabled=false}\n };\n document.querySelectorAll('.simBuyPropertyForm').forEach(form=>form.onsubmit=async e=>{\n  e.preventDefault();\n  const status=form.querySelector('[role=status]'),btn=form.querySelector('[type=submit]');\n  const accountId=String(new FormData(form).get('account_id')||'');\n  const property=p.listed.find(x=>x.id===form.dataset.id);\n  const account=accounts.find(x=>x.id===accountId);\n  if(!property||!account){status.textContent='اختر العقار والحساب البنكي الصحيح';return}\n  if(Number(account.balance)<Number(property.price)){status.textContent='رصيد الحساب غير كافٍ لشراء هذه الوحدة';return}\n  btn.disabled=true;status.textContent='جارٍ تنفيذ الشراء ونقل الملكية...';\n  try{await post('/sim-market/property/buy',{property_id:property.id,account_id:accountId});uiNotice('تم شراء العقار وتسجيل الملكية باسمك في السجل الافتراضي');location.hash='#/my-properties';if(location.hash==='#/my-properties')await myPropertiesPage()}\n  catch(err){status.textContent=err.message;btn.disabled=false}\n });\n}\n\n\n// The purchase certificate is based on persisted ownership, not the just-submitted form.\n// It works even if stocks or other unrelated market subsystems fail.\nasync function myPropertiesPage(){\n if(!me){location.hash='#/login';return}\n const r=await api('/sim-market/my-properties');\n const homes=r.properties||[];\n page('🏡 عقاراتي وسندات الملكية',`<div class=\"notice\">هذه وثائق ملكية افتراضية تخص المملكة العربية الصالية، وليست صكوكًا رسمية حقيقية. تُقرأ الملكية مباشرة من قاعدة D1.</div><div class=\"actions\"><a class=\"btn gold\" href=\"#/sim-market\">تصفح عقارات للبيع</a><a class=\"btn outline\" href=\"#/land\">السجل العقاري</a></div><h2>عقاراتك المسجلة (${homes.length})</h2><div class=\"grid\">${homes.map(x=>`<article class=\"card\"><h3>${safe(x.unit_type||x.kind)}</h3><p><b>${safe(x.project_name||x.location)}</b></p><p>${safe(x.location)}</p>${x.unit_number?`<p>رقم الوحدة: ${safe(x.unit_number)} · المساحة: ${safe(x.area_sqm)} م²</p><p>غرف النوم: ${safe(x.bedrooms)} · دورات المياه: ${safe(x.bathrooms)} · المواقف: ${safe(x.parking)}</p><p>${safe(x.features)}</p>`:''}<p>رقم سند الملكية الصالي: <b dir=\"ltr\">SIM-PR-${safe(x.id)}</b></p><p>الحالة: <b>مملوك لك</b></p><p>قيمة الشراء: ${Number(x.purchase_price??x.price).toLocaleString('ar-SA')} ريال صالي</p>${x.purchased_at?`<p>تاريخ الشراء: ${safe(x.purchased_at)} (UTC)</p>`:''}</article>`).join('')||'<p class=\"card\">ما عندك عقارات مسجلة بهذا الحساب حاليًا.</p>'}</div>`);\n}\n";
const LIVE_AIRPORT_HTML_SOURCE="<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>مطار الملك زياد | المملكة الصالية</title><style>:root{font-family:system-ui,sans-serif;color:#13362c;background:#f8f6ef}*{box-sizing:border-box}body{margin:0}header{background:#10372c;color:white;padding:20px}main{max-width:1050px;margin:auto;padding:20px}h1{font-size:clamp(27px,6vw,44px)}h2{margin-top:35px}.muted{color:#63746e}.panel{background:white;border:1px solid #dcd5c0;border-radius:14px;padding:20px;margin:15px 0}.gold{color:#a87a25}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:12px}.tag{display:inline-block;padding:5px 10px;background:#e9f1ec;border-radius:20px;font-size:13px}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #eee;text-align:right}a{color:inherit}#countdown{font-size:25px;font-weight:800}button{background:#10372c;color:white;padding:10px 16px;border:0;border-radius:8px}small{display:block;margin-top:10px}</style></head><body><header><a href=\"/\" style=\"color:white\">◇ بوابة المملكة العربية الصالية</a><h1>مطار الملك زياد الدولي</h1><div>السجادة · مشروع إنشاء إلكتروني · محاكاة داخل المملكة</div></header><main><section class=\"panel\"><span class=\"tag\">تُحدد حالة التشغيل من سجلات الرحلات والموظفين</span><h2>العد التنازلي لاكتمال البناء</h2><div id=\"countdown\" aria-live=\"polite\">جارٍ الحساب…</div><p class=\"muted\">بدأ المشروع في 23 نوفمبر 2026 الساعة 2:00 ظهرًا بتوقيت السعودية. المدة أربعة أيام. اكتمال البناء المخطط 27 نوفمبر 2026 الساعة 2:00 ظهرًا؛ الافتتاح مشروط باكتمال الموظفين والاعتماد الملكي.</p><div id=\"stage\" class=\"tag\"></div><small>الإنشاء والتشغيل هنا افتراضيان داخل المملكة الصالية. لا توجد تذاكر أو رحلات طيران حقيقية.</small></section><section class=\"panel\"><h2>حالة التشغيل المباشرة من D1</h2><div id=\"liveAirportStatus\" role=\"status\" aria-live=\"polite\">جاري فحص شروط التشغيل…</div><div id=\"liveFlights\"></div><p class=\"muted\">لا يمكن إصدار حجوزات أو بطاقات صعود قبل اكتمال النظام والتحقق من الوثائق والمدفوعات، حتى لو اكتمل البناء.</p></section><section class=\"panel\" id=\"airportOperations\"><h2>الرحلات وحجوزات المطار</h2><p class=\"muted\">رحلات المملكة الصالية افتراضية فقط، ولا ترتبط بأي شركة طيران حقيقية.</p><div id=\"airportFlights\">جارٍ تحميل الرحلات…</div><div id=\"myTravel\"></div></section><section class=\"panel\" id=\"kingAirportAdmin\" hidden><h2>إدارة مطار الملك زياد — للملك فقط</h2><div id=\"airportAdminInfo\"></div><form id=\"airportStaffForm\" class=\"grid\"><label>معرف الحساب الوطني للموظف<input name=\"employee_user_id\" required></label><label>اسم الموظف<input name=\"name\" required></label><label>التخصص<select name=\"category\" id=\"airportStaffCategory\"></select></label><button>تعيين موظف</button><p role=\"status\"></p></form><form id=\"airportFlightForm\" class=\"grid\"><h3>إنشاء رحلة تجريبية (مسودة)</h3><label>شركة الطيران<select name=\"airline_id\"><option value=\"saliyah-airlines\">الخطوط الصالية</option><option value=\"flyadeal-saliyah\">فلاي أديل الصالية</option></select></label><label>رقم الرحلة<input name=\"number\" required placeholder=\"SY103\"></label><label>الوجهة<select name=\"destination_code\" id=\"airportRouteList\"></select></label><label>الإقلاع (UTC)<input name=\"departure_at\" type=\"datetime-local\" required></label><label>الوصول (UTC)<input name=\"arrival_at\" type=\"datetime-local\" required></label><label>سعر الاقتصادي<input name=\"price_economy\" type=\"number\" min=\"1\" required></label><label>مقاعد اقتصادي<input name=\"seats_economy\" type=\"number\" min=\"1\" max=\"600\" required></label><label>مقاعد أعمال<input name=\"seats_business\" type=\"number\" min=\"0\" max=\"120\" value=\"0\" required></label><button>إنشاء مسودة رحلة</button><p role=\"status\"></p></form><div id=\"airportManageFlights\"></div><button id=\"airportRoyalApproval\">اعتماد الملك المسبق</button><p id=\"airportAdminResult\" role=\"status\"></p></section><h2>المخطط العام ومساحة المطار</h2><div class=\"panel\"><p><strong>المرجع التصميمي: مطار الملك خالد الدولي بالرياض (RUH).</strong> يُعتمد في المحاكاة نطاق أرض يقارب <strong>225 كم²</strong>، مع محاكاة توزيع المرافق وطابع التصميم العام، دون الادعاء بأن مخططات المطار الأصلية منسوخة هندسيًا أو أن البناء مادي.</p><div class=\"grid\"><div><strong>مدرجان متوازيان</strong><p class=\"muted\">تخطيط لاستقبال الطائرات العريضة والضيقة، مع ممرات ربط وساحات انتظار</p></div><div><strong>صالات ركاب متعددة</strong><p class=\"muted\">مرافق للخطوط الصالية وفلاي أديل الصالية والجوازات والجمارك</p></div><div><strong>برج مراقبة ومرافق ATC</strong><p class=\"muted\">مراقبة أرضية وبرجية ومناطق عمليات جوية</p></div><div><strong>قرية شحن وصيانة</strong><p class=\"muted\">مواقف ومناولة للطائرات 747-8F و777 للشحن وحظائر الصيانة</p></div></div><p class=\"muted\">هذا وصف تخطيطي للمشروع، ولا يعني اكتمال نموذج ثلاثي الأبعاد أو محاكاة مدارج قابلة للتشغيل بعد.</p></div><h2>أسطول الطيران المعتمد</h2><div class=\"panel\"><table><thead><tr><th>الناقل</th><th>الفئة</th><th>الطراز</th><th>العدد</th></tr></thead><tbody><tr><td>الخطوط الصالية</td><td>ركاب</td><td>777-300</td><td>10</td></tr><tr><td>الخطوط الصالية</td><td>ركاب</td><td>747-8</td><td>5</td></tr><tr><td>الخطوط الصالية</td><td>ركاب</td><td>A330</td><td>15</td></tr><tr><td>الخطوط الصالية</td><td>ركاب</td><td>A320</td><td>20</td></tr><tr><td>الخطوط الصالية</td><td>شحن</td><td>777-300F (محاكاة)</td><td>5</td></tr><tr><td>الخطوط الصالية</td><td>شحن</td><td>747-8F</td><td>10</td></tr><tr><td>فلاي أديل الصالية</td><td>ركاب فقط</td><td>A320</td><td>25</td></tr></tbody></table><p><strong>الإجمالي: 90 طائرة</strong> — الخطوط الصالية 65 (50 ركاب، 15 شحن)، فلاي أديل 25 ركاب.</p></div><h2>شرط الافتتاح: التوظيف والجاهزية</h2><div class=\"panel\"><p><strong>حالة التشغيل: غير مصرح بالافتتاح</strong></p><p>الانتهاء من البناء وحده لا يفتح المطار. يجب تعيين موظفين مؤهلين والتحقق من أعدادهم، وجدولة الأسطول تدريجيًا، ثم اعتماد الملك للتشغيل.</p><p>الأعداد أدناه أهداف تخطيطية أولية للمحاكاة، وليست موظفين معينين:</p><div id=\"staffTargets\"></div><p class=\"muted\">يُحتسب الموظفون المؤهلون والمعينون من قاعدة بيانات الطيران، وتظل شروط التشغيل ملزمة.</p></div><h2>شركات الطيران الصالية</h2><div class=\"grid\"><div class=\"panel\"><h3>الخطوط الجوية الصالية</h3><p>الناقل الوطني كامل الخدمة: درجة أعمال، ضيافة، رحلات دولية.</p><span class=\"tag\">تجهيز التشغيل</span></div><div class=\"panel\"><h3>فلاي أديل الصالية</h3><p>شركة طيران اقتصادي مستقلة في المحاكاة، بأسعار أساسية وخدمات اختيارية.</p><span class=\"tag\">تجهيز التشغيل</span></div></div><h2>الجوازات والحدود — شروط السفر</h2><div class=\"panel\"><p><strong>لا يسمح بالصعود إلى رحلة دولية بدون جواز سفر صالح وتذكرة مؤكدة.</strong> يخضع المسافر أيضًا لمتطلبات التأشيرة، وصلاحية الإقامة عند الاقتضاء، ومنع السفر، ومتطلبات دولة الوجهة.</p><p>الإجراءات المخططة: التحقق من الوثائق ← تسجيل السفر ← فحص الجوازات ← ختم خروج إلكتروني ← الصعود ← ختم دخول عند العودة. كل حركة تحفظ في سجل المنافذ داخل المحاكاة.</p><p class=\"muted\">تخضع الحجوزات للتحقق من ملكية الجواز وسلامته وسداد السعر، مع إصدار بطاقات الصعود وفحص المنافذ إلكترونيًا بعد استيفاء شروط التشغيل.</p></div><h2>نظام الأسعار والرواتب</h2><div class=\"panel\"><p><strong>الخطوط الصالية:</strong> ناقل كامل الخدمة بدرجات متعددة، الأمتعة والمرونة حسب فئة التذكرة. <strong>فلاي أديل الصالية:</strong> أسعار اقتصادية أساسية وإضافات اختيارية للأمتعة والمقاعد والخدمات.</p><p>الأسعار تتغير حسب المسافة والطلب والموسم وموعد الحجز. الرواتب تختلف حسب المسمى والمؤهلات والخبرة وساعات الطيران، ولا تُعتبر رواتب الشركات السعودية الفعلية معلنة رسميًا بالكامل.</p><table><thead><tr><th>الوظيفة</th><th>نطاق شهري مرجعي تقريبي (ريال صالي)</th></tr></thead><tbody><tr><td>قائد طائرة</td><td>35,000–75,000</td></tr><tr><td>مساعد طيار</td><td>25,000–45,000</td></tr><tr><td>ضيافة جوية</td><td>5,000–12,000</td></tr><tr><td>مهندس صيانة</td><td>12,000–30,000</td></tr><tr><td>خدمات أرضية</td><td>4,000–9,000</td></tr><tr><td>مراقب جوي ATC</td><td>15,000–35,000</td></tr></tbody></table><p class=\"muted\">هذه نطاقات محاكاة مسترشدة ببيانات سوق الطيران السعودي، وليست جداول رواتب رسمية للسعودية أو أديل. صرف الرواتب داخل الدولة يبقى أسبوعيًا أو كل أسبوعين حسب اختيار جهة العمل.</p></div><h2>الوجهات الدولية المخططة</h2><p class=\"muted\">مطار الملك زياد الدولي في السجادة هو المطار الوحيد في المملكة الصالية حاليًا. لا توجد رحلات داخلية جوية إلى المتجار أو عقار؛ السفر بين المحافظات بري.</p><div class=\"panel\" style=\"overflow:auto\"><table><thead><tr><th>الوجهة</th><th>الناقل</th><th>النوع</th></tr></thead><tbody id=\"routes\"></tbody></table></div><h2>الوظائف وفرص الخريجين</h2><div class=\"grid\" id=\"jobs\"></div><p class=\"muted\">هذه شواغر إرشادية؛ تُسجل التعيينات الفعلية بواسطة الملك في لوحة إدارة المطار مع توثيق التأهيل.</p><h2>مراحل المشروع</h2><div class=\"grid\" id=\"steps\"></div></main><script>const start=Date.parse('2026-11-23T11:00:00Z'),end=start+4*86400000;const routes=[['الرياض','الخطوط الصالية','دولية'],['جدة','فلاي أديل الصالية','دولية'],['الدوحة','الخطوط الصالية','دولية'],['دبي','فلاي أديل الصالية','دولية'],['أبوظبي','الخطوط الصالية','دولية'],['الكويت','فلاي أديل الصالية','دولية'],['البحرين','فلاي أديل الصالية','دولية'],['مسقط','الخطوط الصالية','دولية'],['القاهرة','فلاي أديل الصالية','دولية'],['إسطنبول','الخطوط الصالية','دولية'],['لندن هيثرو','الخطوط الصالية','دولية'],['طوكيو ناريتا','الخطوط الصالية','دولية'],['باريس','الخطوط الصالية','دولية'],['فرانكفورت','الخطوط الصالية','دولية']];const staffing=[['مراقبة جوية ATC',45],['تشغيل المطار والبوابات',180],['الخدمات الأرضية والأمتعة',300],['الأمن والسلامة والطوارئ',160],['الصيانة والهندسة',230],['الطيارون',420],['الضيافة الجوية',950],['العمليات والتخطيط',115],['الشحن والمناولة',160]];document.getElementById('staffTargets').innerHTML='<table><thead><tr><th>التخصص</th><th>المطلوب مبدئيًا</th><th>المعين المؤكد</th></tr></thead><tbody>'+staffing.map(x=>'<tr><td>'+x[0]+'</td><td>'+x[1]+'</td><td>لم يتم التحقق</td></tr>').join('')+'</tbody></table><p><strong>الإجمالي المستهدف: '+staffing.reduce((n,x)=>n+x[1],0)+' وظيفة</strong> على مراحل؛ وليس شرط تشغيل 90 طائرة دفعة واحدة.</p>';document.getElementById('routes').innerHTML=routes.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('');const jobs=[['مراقب حركة جوية ATC','برج المراقبة والمقاربة'],['موظف عمليات مطار','تنسيق الرحلات والساحات'],['خدمات أرضية','الأمتعة والمعدات والساحات'],['موظف بوابات','الصعود وخدمة المسافرين'],['موظف تسجيل سفر','الكاونترات وإنهاء الإجراءات'],['طيار متدرب','الخطوط الجوية الصالية'],['طاقم ضيافة','الخطوط الصالية وفلاي أديل'],['فني صيانة طائرات','الهندسة والصيانة'],['مخطط رحلات','العمليات الجوية'],['موظف أمن وسلامة','أمن المطار والطوارئ']];document.getElementById('jobs').innerHTML=jobs.map(j=>'<div class=\"panel\"><b>'+j[0]+'</b><p class=\"muted\">'+j[1]+'</p><span class=\"tag\">فرصة للخريجين المؤهلين</span></div>').join('');const phases=['اليوم الأول: تصميم المطار والمدارج والمباني','اليوم الثاني: تجهيز البرج والصالات والخدمات الأرضية','اليوم الثالث: إعداد الشركات والوظائف والوجهات','اليوم الرابع: اختبارات الأنظمة والاستعداد للافتتاح'];document.getElementById('steps').innerHTML=phases.map((p,i)=>'<div class=\"panel\"><span class=\"gold\">0'+(i+1)+'</span><p>'+p+'</p></div>').join('');function tick(){const left=Math.max(0,end-Date.now()),d=Math.floor(left/86400000),h=Math.floor(left/3600000)%24,m=Math.floor(left/60000)%60,sec=Math.floor(left/1000)%60;document.getElementById('countdown').textContent=left?d+' يوم و '+h+' ساعة و '+m+' دقيقة و '+sec+' ثانية':'اكتمل موعد البناء المخطط — المطار مغلق حتى اكتمال التوظيف والاعتماد';document.getElementById('stage').textContent='مرحلة البناء '+Math.min(4,Math.max(1,Math.floor((Date.now()-start)/86400000)+1))+' من 4'}tick();setInterval(tick,1000);async function loadAirportStatus(){const status=document.getElementById('liveAirportStatus'),flights=document.getElementById('liveFlights');try{const [r,f]=await Promise.all([fetch('/api/aviation/readiness',{cache:'no-store'}),fetch('/api/aviation/flights',{cache:'no-store'})]);if(!r.ok||!f.ok)throw Error('فشل الاتصال بنظام الطيران');const d=await r.json(),list=await f.json();const fields=[['اكتمال البناء',d.construction_complete],['اكتمال التوظيف',d.staff_complete],['اعتماد الملك',d.royal_authorization],['جاهزية شركات الطيران',d.airlines_ready],['وجود رحلات مجدولة',d.scheduled_flights>0]];status.innerHTML='<p><strong>القرار النهائي: '+(d.ready?'شروط التشغيل مكتملة':'المطار مغلق — شروط التشغيل غير مكتملة')+'</strong></p>'+fields.map(x=>'<p>'+x[0]+': '+(x[1]?'✓ مكتمل':'✕ غير مكتمل')+'</p>').join('')+'<h3>الموظفون</h3><table><thead><tr><th>التخصص</th><th>المطلوب</th><th>المعين</th></tr></thead><tbody>'+d.staffing.map(x=>'<tr><td>'+x.label+'</td><td>'+x.required+'</td><td>'+x.active+'</td></tr>').join('')+'</tbody></table>';flights.textContent='الرحلات المجدولة: '+(list.flights||[]).length+' — الحجز: '+(list.bookings_enabled?'مبدئيًا مفتوح، بانتظار تفعيل عمليات الحجز':'غير متاح');}catch(e){status.textContent='تعذر التحقق من الجاهزية المباشرة؛ المطار غير معتمد للتشغيل.'}}loadAirportStatus();\nconst escapeAirport=(v)=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nasync function aviationAPI(path,options){const r=await fetch('/api/aviation/'+path,{cache:'no-store',...options});const data=await r.json();if(!r.ok)throw Error(data.error||'تعذر تنفيذ العملية');return data}\nasync function aviationPost(path,body){return aviationAPI(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}\nasync function refreshAirportOperations(){\n const [flights,meResult,routes]=await Promise.all([aviationAPI('flights'),fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({})),aviationAPI('routes')]);\n const me=meResult.user, target=document.getElementById('airportFlights');let accounts=[];\n if(me){try{accounts=(await fetch('/api/banking/accounts').then(r=>r.json())).accounts||[]}catch(e){}}\n const list=flights.flights||[];\n target.innerHTML=list.length?list.map(f=>'<article class=\"panel\"><b>'+escapeAirport(f.number)+' · '+escapeAirport(f.airline)+'</b><p>'+escapeAirport(f.origin_code)+' ⇢ '+escapeAirport(f.destination_code)+' · '+escapeAirport(f.departure_at)+'</p><p>اقتصادي: '+Number(f.price_economy).toLocaleString('ar-SA')+' ريال صالي</p>'+((flights.bookings_enabled&&me)?'<form class=\"bookFlight\" data-id=\"'+escapeAirport(f.id)+'\"><select name=\"seat_class\"><option value=\"economy\">اقتصادي</option>'+((f.seats_business>0)?'<option value=\"business\">أعمال (السعر 2.4 × الاقتصادي)</option>':'')+'</select><select name=\"bank_account_id\">'+accounts.map(a=>'<option value=\"'+escapeAirport(a.id)+'\">'+escapeAirport(a.bank)+' · '+Number(a.balance).toLocaleString('ar-SA')+'</option>').join('')+'</select><button '+(accounts.length?'':'disabled')+'>حجز الرحلة</button><p role=\"status\"></p></form>':'<p class=\"muted\">الحجز متوقف إلى أن تكتمل شروط التشغيل؛ لا تُخصم أي رسوم.</p>')+'</article>').join(''):'<p class=\"muted\">لا توجد رحلات تشغيل مجدولة.</p>';\n document.querySelectorAll('.bookFlight').forEach(f=>{const key=crypto.randomUUID();f.onsubmit=async e=>{e.preventDefault();const status=f.querySelector('[role=status]');try{const d=new FormData(f),r=await aviationPost('booking',{flight_id:f.dataset.id,seat_class:d.get('seat_class'),bank_account_id:d.get('bank_account_id'),idempotency_key:key});status.textContent='الحجز مؤكد: '+r.reference+' · '+r.amount+' ريال';await refreshAirportOperations()}catch(err){status.textContent=err.message}}});\n const my=document.getElementById('myTravel');\n if(me){try{const [bookings,passes]=await Promise.all([aviationAPI('my-bookings'),aviationAPI('boarding-passes')]);my.innerHTML='<h3>حجوزاتي</h3>'+(bookings.bookings.length?bookings.bookings.map(b=>'<div class=\"panel\"><b>'+escapeAirport(b.reference)+'</b><p>'+escapeAirport(b.flight_number)+' · '+escapeAirport(b.destination_code)+' · '+escapeAirport(b.status)+'</p><button class=\"airCheckin\" data-id=\"'+escapeAirport(b.id)+'\">تسجيل السفر</button><p role=\"status\"></p></div>').join(''):'<p>ليس لديك حجوزات.</p>')+'<h3>بطاقات الصعود</h3>'+(passes.boarding_passes.length?passes.boarding_passes.map(p=>'<div class=\"panel\">'+escapeAirport(p.flight_number)+' · '+escapeAirport(p.seat)+' · '+escapeAirport(p.departure_at)+'</div>').join(''):'<p>لا توجد بطاقات صعود.</p>');my.querySelectorAll('.airCheckin').forEach(b=>b.onclick=async()=>{const status=b.parentElement.querySelector('[role=status]');try{const d=await aviationPost('check-in',{booking_id:b.dataset.id});status.textContent='تم إصدار بطاقة الصعود: '+d.boarding_pass.seat;await refreshAirportOperations()}catch(err){status.textContent=err.message}})}catch(err){my.textContent=err.message}}\n if(me?.role==='king'){\n  const pane=document.getElementById('kingAirportAdmin');pane.hidden=false;\n  const admin=await aviationAPI('admin');\n  document.getElementById('airportAdminInfo').textContent='الاعتماد الملكي: '+(admin.readiness.royal_authorization?'معتمد':'بانتظار اعتماد')+' · إجمالي الموظفين المؤهلين: '+admin.readiness.staffing.reduce((n,x)=>n+x.active,0)+' · المبنى: '+(admin.readiness.construction_complete?'اكتمل':'تحت الإنشاء');\n  document.getElementById('airportStaffCategory').innerHTML=admin.readiness.staffing.map(x=>'<option value=\"'+escapeAirport(x.category)+'\">'+escapeAirport(x.label)+'</option>').join('');\n  document.getElementById('airportRouteList').innerHTML=routes.routes.map(x=>'<option value=\"'+escapeAirport(x.code)+'\">'+escapeAirport(x.name)+'</option>').join('');\n  document.getElementById('airportManageFlights').innerHTML='<h3>إدارة الرحلات</h3>'+admin.flights.map(f=>'<div class=\"panel\"><b>'+escapeAirport(f.number)+' · '+escapeAirport(f.destination_code)+'</b><p>'+escapeAirport(f.status)+'</p><button class=\"airPublishFlight\" data-id=\"'+escapeAirport(f.id)+'\" data-status=\"scheduled\">جدولة</button> <button class=\"airPublishFlight\" data-id=\"'+escapeAirport(f.id)+'\" data-status=\"cancelled\">إلغاء</button><p role=\"status\"></p></div>').join('');\n  pane.querySelectorAll('.airPublishFlight').forEach(b=>b.onclick=async()=>{try{await aviationPost('admin/flight/status',{id:b.dataset.id,status:b.dataset.status});await refreshAirportOperations()}catch(err){b.parentElement.querySelector('[role=status]').textContent=err.message}});\n  document.getElementById('airportStaffForm').onsubmit=async e=>{e.preventDefault();const f=e.target;try{await aviationPost('admin/staff',Object.fromEntries(new FormData(f)));f.querySelector('[role=status]').textContent='تم التعيين';await refreshAirportOperations()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\n  document.getElementById('airportFlightForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));for(const k of ['price_economy','seats_economy','seats_business'])b[k]=Number(b[k]);try{await aviationPost('admin/flight',b);f.querySelector('[role=status]').textContent='تم إنشاء الرحلة';await refreshAirportOperations()}catch(err){f.querySelector('[role=status]').textContent=err.message}};\n  document.getElementById('airportRoyalApproval').onclick=async()=>{try{await aviationPost('authorize',{authorized:true});document.getElementById('airportAdminResult').textContent='تم تسجيل الاعتماد الملكي؛ فتح المطار ما زال مشروطًا بالجاهزية';await refreshAirportOperations()}catch(err){document.getElementById('airportAdminResult').textContent=err.message}};\n }\n}\nrefreshAirportOperations().catch(e=>{document.getElementById('airportFlights').textContent='تعذر تحميل نظام الطيران: '+e.message});\n</script></body></html>";

export default {
 async scheduled(event,env,ctx){
  // Royal authorization: resume conservatively, once every four hours.
  const hour=Math.floor(event.scheduledTime/3600000);
  if(hour%4!==0||new Date(event.scheduledTime).getUTCMinutes()!==0){try{await runSimEmployeeServices(env.DB)}catch(error){console.error('sim_staff_cycle_failed',String(error).slice(0,220))}try{await reconcileEmployeeResignations(env.DB)}catch(error){console.error('resignation_cycle_failed',String(error).slice(0,220))}try{await reconcileAviationPayments(env.DB,env.AVIATION_DB)}catch(error){console.error('aviation_payment_cycle_failed',String(error).slice(0,220))}try{await reconcileAviationCancelledFlights(env.DB,env.AVIATION_DB)}catch(error){console.error('aviation_cancellation_cycle_failed',String(error).slice(0,220))}try{await runSharedCompanySalaryPayments(env.DB)}catch(error){console.error('shared_company_payroll_cycle_failed',String(error).slice(0,220))}return;}
  // A failing subsystem must not prevent other fictional residents from replying.
  const phases=[['government',()=>runSaliyahGovernment(env.DB,env.AVIATION_DB)],['citizen_services',()=>runSimEmployeeServices(env.DB)],['x_bots',()=>generateXBotActivity(env.DB)],['citizen_contacts',()=>runSimContactReplies(env.DB,env.AVIATION_DB)],['creator_rewards',()=>runXCreatorAutoPayouts(env.DB)],['aviation_schedule',()=>ensureAviationRollingSchedule(env.AVIATION_DB)]];
  for(const [label,run] of phases)try{await run()}catch(error){console.error('simulation_phase_failed',label,String(error).slice(0,220))}
 },async fetch(req,env){const u=new URL(req.url);if(req.method==='GET'&&u.pathname==='/app.js')return new Response(LIVE_PORTAL_APP_SOURCE,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}});if(req.method==='GET'&&u.pathname==='/airport.html')return new Response(LIVE_AIRPORT_HTML_SOURCE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff'}});if(u.pathname==='/simulation.html'){if(!env.DB)return new Response('Unavailable',{status:503});const royal=await actor(req,env.DB);if(royal?.role!=='king')return new Response('هذه الصفحة مخصصة للملك فقط',{status:403,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});const asset=await env.ASSETS.fetch(req);const headers=new Headers(asset.headers);headers.set('Cache-Control','no-store, max-age=0');return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers})}if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);try{if(!env.DB)return json({error:'Database binding missing'},503);const db=env.DB;const method=req.method;const path=u.pathname;const user=(path==='/api/auth/login'||path==='/api/setup/king'||path==='/api/setup/status'||path==='/api/setup/recover-owner'||path==='/api/auth/citizen/register')?null:await actor(req,db);if(method!=='GET'&&method!=='HEAD'){const origin=req.headers.get('origin');const site=req.headers.get('sec-fetch-site');if((origin&&origin!==u.origin)||(site&&site!=='same-origin'&&site!=='none'))return json({error:'مصدر الطلب غير مسموح'},403);}


if(path==='/api/national-alert'){
 const alertDb=env.ARCHIVE_DB||db;
 const missing=e=>String(e).includes('no such table: national_alert_history');
 if(method==='GET'){
  const history=u.searchParams.get('history')==='1';
  if(history&&user?.role!=='king')return json({error:'غير مخول'},403);
  try{
   const rows=await alertDb.prepare(history?'SELECT * FROM national_alert_history ORDER BY updated_at DESC LIMIT 100':'SELECT id,title,body,severity,target,expires_at,updated_at FROM national_alert_history WHERE cancelled=0 AND expires_at>? ORDER BY updated_at DESC LIMIT 100').bind(...(history?[]:[Date.now()])).all();
   return json({alerts:rows.results});
  }catch(e){if(missing(e))return json({alerts:[]});throw e}
 }
 if(method==='POST'){
  if(user?.role!=='king')return json({error:'غير مخول'},403);
  const b=await input(req);
  if(!b||!['publish','cancel','delete'].includes(b.action))return json({error:'بيانات غير صالحة'},400);
  if(b.action==='publish'&&!(validText(b.title,1,160)&&validText(b.body,1,3000)&&['info','warning','urgent'].includes(b.severity)&&['all','sajjadah','mutajjar','aqar'].includes(b.target)&&Number.isInteger(b.hours)&&b.hours>=1&&b.hours<=168))return json({error:'بيانات التنبيه غير صالحة'},400);
  if((b.id!=null&&!validText(b.id,1,80))||(['cancel','delete'].includes(b.action)&&!b.id))return json({error:'معرف غير صالح'},400);
  await alertDb.prepare("CREATE TABLE IF NOT EXISTS national_alert_history (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, severity TEXT NOT NULL, target TEXT NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0)").run();
  await alertDb.prepare("CREATE INDEX IF NOT EXISTS national_alert_history_updated ON national_alert_history(updated_at DESC)").run();
  const now=Date.now(),id=b.id||random();
  if(b.action==='delete'){
   // Royal deletion removes the alert from all lists; the audit log retains the action.
   const result=await alertDb.prepare('DELETE FROM national_alert_history WHERE id=?').bind(id).run();
   if(!result.meta.changes)return json({error:'التنبيه غير موجود أو تم حذفه سابقاً'},404);
   if(alertDb!==db){
    try{await db.prepare('DELETE FROM national_alert_history WHERE id=?').bind(id).run()}
    catch(error){console.error('national_alert_mirror_delete_failed',String(error).slice(0,160))}
   }
  }else if(b.action==='cancel'){
   // Expired alerts may be cancelled from history; no time-bound restriction.
   const result=await alertDb.prepare('UPDATE national_alert_history SET cancelled=1,updated_at=? WHERE id=? AND cancelled=0').bind(now,id).run();
   if(!result.meta.changes)return json({error:'التنبيه ملغى أو غير موجود'},409);
   if(alertDb!==db){
    try{await db.prepare('UPDATE national_alert_history SET cancelled=1,updated_at=? WHERE id=? AND cancelled=0').bind(now,id).run()}
    catch(error){console.error('national_alert_mirror_cancel_failed',String(error).slice(0,160))}
   }
  }else if(b.id){
   const result=await alertDb.prepare('UPDATE national_alert_history SET title=?,body=?,severity=?,target=?,expires_at=?,updated_at=? WHERE id=? AND cancelled=0').bind(b.title.trim(),b.body.trim(),b.severity,b.target,now+b.hours*3600000,now,id).run();
   if(!result.meta.changes)return json({error:'التنبيه ملغى أو غير موجود'},409);
  }else{
   await alertDb.prepare('INSERT INTO national_alert_history(id,title,body,severity,target,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,b.title.trim(),b.body.trim(),b.severity,b.target,now+b.hours*3600000,now).run();
  }
  await audit(db,user.id,'national_alert_'+b.action,'national_alert',id,{action:b.action});
  return json({ok:true,id,action:b.action});
 }
 return json({error:'طريقة غير مسموحة'},405);
}


// Supplement the royal register with actual human-facing services as well as bot activity.
const royalActualServiceRecords={
 education:[['طلبات الطلاب الحقيقيين','education_applications'],['درجات الطلاب','education_grades'],['المدارس والجامعات','education_institutions']],
 banking:[['الحسابات البنكية الحقيقية','bank_accounts'],['التحويلات','bank_transfers'],['البطاقات','bank_cards']],
 'bank-admin':[['الحسابات البنكية الحقيقية','bank_accounts'],['التسويات','bank_adjustments']],
 civil:[['المواطنون','citizen_profiles'],['طلبات الأحوال','civil_intake'],['المستندات','documents']],
 commerce:[['الشركات الحقيقية','commerce_companies'],['فروع الشركات','commerce_branches']],
 jobs:[['طلبات التوظيف البشرية','job_applications'],['الوظائف','vacancies']],
 payroll:[['صرف الرواتب الحقيقي','payroll_payments'],['رواتب الشركات','company_salary_payments']],
 courts:[['القضايا الحقيقية','court_cases'],['جلسات المحاكم','court_hearings']],
 security:[['البلاغات الأمنية','police_reports']],
 borders:[['حركات الحدود','border_movements'],['البيانات الجمركية','customs_declarations']],
 land:[['العقارات الحقيقية','land_parcels'],['نقل الملكية','land_transfers']],
 telecom:[['خطوط الاتصالات الحقيقية','telecom_lines'],['عمليات الشحن','telecom_purchases']],
 pos:[['نقاط البيع الحقيقية','pos_merchants'],['المدفوعات','pos_payments']],
 absher:[['المركبات والأصول','absher_assets'],['الطلبات','absher_requests']],
 health:[['العيادات','health_clinics'],['المواعيد','health_appointments']],
 municipality:[['التصاريح','municipal_permits'],['التفتيش','municipal_inspections']],
 installments:[['خطط الأقساط','installment_plans'],['الدفعات','installment_payments']],
 'state-budgets':[['طلبات الميزانية','state_budget_requests'],['حركات الميزانية','state_budget_events']],
 'company-treasury':[['خزائن الشركات','company_treasuries'],['حركات الخزائن','company_treasury_movements']],
 'company-staff':[['العاملون بالشركات','company_employees']]
};
// Role-gated database inventory for the sovereign oversight dashboard.
// Never expose credentials or raw auth/session tables to browsers.
const royalAllSafeTables=['saliyah_sim_employee_decisions','audit_log','requests','request_history','notifications','bank_accounts','bank_transfers','bank_cards','debt_claims','debt_collections','pos_payments','pos_merchants','telecom_lines','telecom_purchases','civil_intake','citizen_profiles','court_cases','court_hearings','education_applications','education_grades','education_institutions','saliyah_sim_citizens','saliyah_sim_companies','saliyah_sim_jobs','saliyah_sim_job_applications','saliyah_sim_bank_accounts','saliyah_sim_bank_transactions','saliyah_sim_identities','saliyah_sim_family_cards','saliyah_sim_enrollments','saliyah_sim_properties','saliyah_sim_property_trades','saliyah_sim_bot_property_purchases','saliyah_sim_border_events','saliyah_sim_incidents','saliyah_sim_trials','saliyah_sim_labor_cases','saliyah_sim_labor_filings','saliyah_sim_life_events','saliyah_projects','x_posts','x_profiles','x_follows','x_likes','x_creator_payouts','state_budget_requests','state_budget_events','bank_adjustments','company_salary_payments','company_employees','commerce_companies','commerce_branches','company_treasuries','company_treasury_movements','border_movements','customs_declarations','family_cards','document_applications','health_appointments','health_clinics','installment_dues','installment_payments','installment_plans','land_parcels','land_transfers','municipal_inspections','municipal_permits','police_reports','service_tickets'];
const royalInventoryTables={
 DB:royalAllSafeTables,
 FINANCE_DB:['saliyah_sim_bank_accounts','saliyah_sim_bank_transactions','saliyah_sim_company_payroll_decisions'],
 SIMULATION_DB:['saliyah_sim_settings','saliyah_sim_business_outcomes','saliyah_sim_education_details','saliyah_sim_institutions'],
 AVIATION_DB:['saliyah_sim_tourists'],
 ARCHIVE_DB:['national_alert_history']
};
// King's read-only identity resolver. Names come from existing fictional people/companies;
// technical identifiers stay in the database for joins and audit integrity.
async function resolveRoyalBotNames(db,rows){
 if(!rows?.length)return rows||[];
 const isReference=key=>key==='id'||key.endsWith('_id')||['partner_a','partner_b','officer','judge'].includes(key);
 const ids=[...new Set(rows.flatMap(row=>Object.entries(row).filter(([key,val])=>isReference(key)&&typeof val==='string'&&val.length>0&&val.length<=160).map(([,val])=>val)))];
 if(!ids.length)return rows;
 const names=new Map();
 // A single indexed lookup per 64 record IDs is cheaper than querying each table separately.
 for(let i=0;i<ids.length;i+=64){
  const chunk=ids.slice(i,i+64);
  const sql='WITH targets(id) AS (VALUES '+chunk.map(()=>'(?)').join(',')+') SELECT t.id,COALESCE(c.name,co.name,l.name,x.display_name,i.name,j.title,ac.name,aco.name,u.username) AS resolved_name FROM targets t LEFT JOIN saliyah_sim_citizens c ON c.id=t.id LEFT JOIN saliyah_sim_companies co ON co.id=t.id LEFT JOIN saliyah_sim_legal_bots l ON l.id=t.id LEFT JOIN x_profiles x ON x.id=t.id LEFT JOIN saliyah_sim_institutions i ON i.id=t.id LEFT JOIN saliyah_sim_jobs j ON j.id=t.id LEFT JOIN saliyah_sim_bank_accounts a ON a.id=t.id LEFT JOIN saliyah_sim_citizens ac ON ac.id=a.owner_id AND a.owner_type=\'citizen\' LEFT JOIN saliyah_sim_companies aco ON aco.id=a.owner_id AND a.owner_type=\'company\' LEFT JOIN users u ON u.id=t.id';
  try{
   const found=await db.prepare(sql).bind(...chunk).all();
   for(const item of found.results)if(item.resolved_name)names.set(item.id,item.resolved_name);
  }catch(error){
   console.error('royal_bot_name_lookup_failed',String(error).slice(0,160));
   // Preserve read-only records even if a name table is missing.
  }
 }
 return rows.map(row=>{
  const named={...row};
  for(const [key,id] of Object.entries(row)){
   if(!isReference(key))continue;
   const name=names.get(id);
   if(name)named[key+'_name']=name;
  }
  return named;
 });
}

const royalServiceRecords={"education":[["المؤسسات التعليمية","saliyah_sim_institutions"],["الطلاب والتسجيل","saliyah_sim_enrollments"],["تفاصيل المؤسسات","saliyah_sim_education_details"]],"banking":[["الحسابات البنكية","saliyah_sim_bank_accounts"],["الحركات المالية","saliyah_sim_bank_transactions"],["تحويلات المواطنين إلى البوتات","saliyah_sim_public_payments"]],"bank-admin":[["الحسابات البنكية","saliyah_sim_bank_accounts"],["الحركات المالية","saliyah_sim_bank_transactions"]],"civil":[["السكان","saliyah_sim_citizens"],["الهويات","saliyah_sim_identities"],["الزواج","saliyah_sim_marriages"],["الأبناء","saliyah_sim_children"]],"registry":[["الهويات","saliyah_sim_identities"]],"family-cards":[["بطاقات العائلة","saliyah_sim_family_cards"]],"commerce":[["الشركات","saliyah_sim_companies"],["ملكية أسهم الشركات","saliyah_sim_shares"],["صفقات المواطنين مع البوتات","saliyah_market_trades"]],"company-treasury":[["الحسابات البنكية","saliyah_sim_bank_accounts"]],"company-staff":[["الوظائف","saliyah_sim_jobs"],["طلبات التوظيف","saliyah_sim_job_applications"]],"jobs":[["الوظائف","saliyah_sim_jobs"],["طلبات التوظيف","saliyah_sim_job_applications"]],"jobs-admin":[["الوظائف","saliyah_sim_jobs"],["طلبات التوظيف","saliyah_sim_job_applications"]],"payroll":[["الحركات المالية","saliyah_sim_bank_transactions"],["قرارات الرواتب","saliyah_sim_company_payroll_decisions"]],"courts":[["القضايا العمالية","saliyah_sim_labor_cases"],["المحاكمات","saliyah_sim_trials"],["المذكرات","saliyah_sim_labor_filings"]],"security":[["البلاغات","saliyah_sim_incidents"]],"borders":[["حركة المنافذ","saliyah_sim_border_events"]],"land":[["العقارات","saliyah_sim_properties"],["الصفقات","saliyah_sim_property_trades"],["شراء المواطن من البوت","saliyah_sim_public_property_trades"],["شراء البوتات","saliyah_sim_bot_property_purchases"]],"state-budgets":[["المشاريع","saliyah_projects"]],"telecom":[["خطوط الاتصالات","telecom_lines"],["عمليات الشحن","telecom_purchases"],["الرسائل","telecom_sms"],["شرائح الكيانات الافتراضية","saliyah_sim_public_phones"],["رسائل البوتات","saliyah_sim_phone_sms"],["المراسلات الآلية","saliyah_sim_public_contacts"]],"pos":[["نقاط البيع","pos_merchants"],["عمليات نقاط البيع","pos_payments"]],"absher":[["أصول أبشر","absher_assets"],["طلبات أبشر","absher_requests"]],"health":[["المواعيد الصحية","health_appointments"],["العيادات","health_clinics"]],"municipality":[["تصاريح البلدية","municipal_permits"],["التفتيش","municipal_inspections"]],"installments":[["خطط الأقساط","installment_plans"],["دفعات الأقساط","installment_payments"],["المستحقات","installment_dues"]]};
// Royal D1 distribution report. Read-only: reconciles legacy payroll authority with finance snapshots.
if(method==='GET'&&path==='/api/admin/royal-audit'){
 if(user?.role!=='king')return json({error:'للملك فقط'},403);
 const types=[
  ['audit_log','سجل الإجراءات'],['requests','الطلبات الحكومية'],['request_history','سجل الطلبات'],
  ['bank_transfers','التحويلات البنكية'],['pos_payments','مدفوعات نقاط البيع'],
  ['saliyah_sim_bank_transactions','حركات البوتات البنكية'],
  ['education_applications','طلبات الدراسة'],['saliyah_sim_job_applications','توظيف البوتات'],
  ['civil_intake','طلبات الأحوال'],['saliyah_sim_labor_cases','قضايا البوتات'],
  ['saliyah_market_trades','تداول الأسهم مع البوتات'],['saliyah_sim_public_payments','تحويلات المواطنين إلى البوتات'],['saliyah_sim_phone_sms','رسائل شرائح البوتات'],['national_alert_history','التنبيهات الوطنية']
 ];
 const rows=await Promise.all(types.map(async([table,label])=>{
  const source=table==='national_alert_history'?(env.ARCHIVE_DB||db):db;
  try{const data=await source.prepare('SELECT * FROM '+table+' ORDER BY rowid DESC LIMIT 20').all();const safeRows=data.results.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!/(password|token|secret|credential|cookie|salt|otp)/i.test(key))));return {type:table,label,rows:safeRows}}
  catch(e){return {type:table,label,rows:[],error:String(e?.message||e).slice(0,140)}}
 }));
 const allRows=rows.flatMap(group=>group.rows);
 const named=await resolveRoyalBotNames(db,allRows);
 let cursor=0;
 for(const group of rows){group.rows=named.slice(cursor,cursor+group.rows.length);cursor+=group.rows.length}
 return json({ok:true,groups:rows,read_only:true});
}
if(method==='GET'&&path==='/api/admin/d1-inventory'){
 if(user?.role!=='king')return json({error:'للملك فقط'},403);
 const sources={DB:db,FINANCE_DB:env.FINANCE_DB,SIMULATION_DB:env.SIMULATION_DB,AVIATION_DB:env.AVIATION_DB,ARCHIVE_DB:env.ARCHIVE_DB};
 const inventories=await Promise.all(Object.entries(royalInventoryTables).map(async([name,tables])=>{
  const source=sources[name];
  if(!source)return {binding:name,error:'القاعدة غير متصلة',tables:[]};
  const entries=await Promise.all(tables.map(async(table)=>{
   try{const row=await source.prepare('SELECT COUNT(*) n FROM '+table).first();return {table,count:Number(row?.n||0)}}
   catch(e){return {table,error:String(e?.message||e).slice(0,140)}}
  }));
  return {binding:name,tables:entries};
 }));
 return json({inventories,bots_paused:true,read_only:true});
}
if(method==='GET'&&path==='/api/admin/d1-distribution'){
 if(user?.role!=='king')return json({error:'للملك فقط'},403);
 const sources=[
  ['DB',db,['saliyah_sim_bank_accounts','saliyah_sim_bank_transactions']],
  ['FINANCE_DB',env.FINANCE_DB,['saliyah_sim_bank_accounts','saliyah_sim_bank_transactions','saliyah_sim_company_payroll_decisions']],
  ['SIMULATION_DB',env.SIMULATION_DB,['saliyah_sim_settings','saliyah_sim_institutions','saliyah_sim_education_details']],
  ['AVIATION_DB',env.AVIATION_DB,['saliyah_sim_tourists']],
  ['ARCHIVE_DB',env.ARCHIVE_DB,['national_alert_history']]
 ];
 const databases=await Promise.all(sources.map(async([binding,connection,tables])=>{
  if(!connection)return {binding,connected:false,tables:{},errors:['missing binding']};
  const entries=await Promise.all(tables.map(async table=>{
   try{const data=await connection.prepare('SELECT COUNT(*) AS n FROM '+table).first();return [table,{count:Number(data?.n||0)}]}
   catch(e){return [table,{error:String(e?.message||e).slice(0,160)}]}
  }));
  return {binding,connected:true,tables:Object.fromEntries(entries),errors:entries.filter(([,v])=>v.error).map(([name])=>name)};
 }));
 const primary=databases[0].tables,finance=databases[1].tables;
 const ledgerTables=['saliyah_sim_bank_accounts','saliyah_sim_bank_transactions'];
 const ledgerMatches=ledgerTables.every(table=>Number.isFinite(primary[table]?.count)&&primary[table].count===finance[table]?.count);
 const ledgerTotals=await Promise.all([db,env.FINANCE_DB].map(async source=>{if(!source)return null;try{return await source.prepare('SELECT COUNT(*) accounts,COALESCE(SUM(balance),0) balance FROM saliyah_sim_bank_accounts').first()}catch{return null}}));
 const ledgerFingerprints=await Promise.all([db,env.FINANCE_DB].map(async source=>{if(!source)return null;try{const accounts=await source.prepare('SELECT COUNT(*) n,COALESCE(SUM(balance),0) total,COALESCE(SUM(length(id)+length(account_number)+length(owner_id)),0) lengths FROM saliyah_sim_bank_accounts').first();const entries=await source.prepare('SELECT COUNT(*) n,COALESCE(SUM(amount),0) total,COALESCE(SUM(length(id)+length(description)),0) lengths FROM saliyah_sim_bank_transactions').first();return {accounts,entries}}catch{return null}}));
 const ledgerFingerprintsMatch=!!(ledgerFingerprints[0]&&ledgerFingerprints[1]&&JSON.stringify(ledgerFingerprints[0])===JSON.stringify(ledgerFingerprints[1]));
 const ledgerBalancesMatch=!!(ledgerTotals[0]&&ledgerTotals[1]&&ledgerTotals[0].accounts===ledgerTotals[1].accounts&&ledgerTotals[0].balance===ledgerTotals[1].balance);
 return json({ok:true,databases,ledger:{matching_record_counts:ledgerMatches,matching_total_balances:ledgerBalancesMatch,matching_aggregate_fingerprints:ledgerFingerprintsMatch,source_totals:ledgerTotals,primary_write_binding:'DB',finance_binding:'FINANCE_DB',note:'تطابق أعداد السجلات لا يضمن تطابق الأرصدة؛ ترحيل صرف الرواتب بالكامل ما زال مطلوباً'},bots_paused:true});
}
if(method==='GET'&&path==='/api/admin/bot-directory'){
 if(user?.role!=='king')return json({error:'للملك فقط'},403);
 const type=u.searchParams.get('type')||'citizens';
 const term=(u.searchParams.get('q')||'').trim().slice(0,80);
 const page=Math.max(1,Math.min(1000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
 const limit=50;
 const types={
  citizens:{source:db,from:'saliyah_sim_citizens c',where:"1=1",search:'c.name LIKE ? OR c.id LIKE ?',select:'c.id,c.name,c.occupation,c.created_at',title:'السكان الآليون'},
  employees:{source:db,from:'saliyah_sim_citizens c',where:"c.id LIKE 'sim-employee-%'",search:'c.name LIKE ? OR c.id LIKE ?',select:'c.id,c.name,c.occupation,c.created_at',title:'الموظفون الآليون'},
  residents:{source:db,from:'saliyah_sim_citizens c',where:"c.id LIKE 'sim-resident-%'",search:'c.name LIKE ? OR c.id LIKE ?',select:'c.id,c.name,c.occupation,c.created_at',title:'المقيمون الآليون'},
  lawyers:{source:db,from:'saliyah_sim_legal_bots c',where:'1=1',search:'c.name LIKE ? OR c.id LIKE ?',select:'c.id,c.name,c.role occupation,c.active status',title:'المحامون الآليون'},
  x:{source:db,from:'x_profiles c',where:"c.kind='bot'",search:'c.display_name LIKE ? OR c.handle LIKE ? OR c.id LIKE ?',select:'c.id,c.display_name name,c.handle,c.bio,c.created_at',title:'حسابات إكس الآلية'},
  companies:{source:db,from:'saliyah_sim_companies c LEFT JOIN saliyah_sim_citizens p ON p.id=c.founder_id',where:'1=1',search:'c.name LIKE ? OR c.id LIKE ? OR p.name LIKE ?',select:'c.id,c.name,c.activity occupation,c.status,p.name founder_name,c.created_at',title:'الشركات التي تديرها الشخصيات الآلية'},
  tourists:{source:env.AVIATION_DB,from:'saliyah_sim_tourists c',where:'1=1',search:'c.name LIKE ? OR c.id LIKE ?',select:'c.id,c.name,c.nationality,c.visa_status status,c.created_at',title:'السياح الآليون'}
 };
 const selected=Object.hasOwn(types,type)?types[type]:null;
 if(!selected)return json({error:'نوع دليل غير معروف'},400);
 if(!selected.source)return json({error:'قاعدة البيانات غير متصلة'},503);
 const count=(selected.search.match(/\?/g)||[]).length;
 const where=selected.where+' AND ('+selected.search+')';
 const params=Array.from({length:count},()=>'%'+term+'%');
 const total=Number((await selected.source.prepare('SELECT COUNT(*) n FROM '+selected.from+' WHERE '+where).bind(...params).first())?.n||0);
 const offset=(page-1)*limit;
 const rows=await selected.source.prepare('SELECT '+selected.select+' FROM '+selected.from+' WHERE '+where+' ORDER BY c.id LIMIT ? OFFSET ?').bind(...params,limit,offset).all();
 return json({type,title:selected.title,rows:rows.results,pagination:{page,pages:Math.ceil(total/limit),total,page_size:limit}});
}

if(method==='GET'&&path==='/api/admin/service-bots'){
 if(user?.role!=='king')return json({error:'للملك فقط'},403);
 const service=u.searchParams.get('service');if(!Object.hasOwn(royalServiceRecords,service)&&!Object.hasOwn(royalActualServiceRecords,service))return json({error:'خدمة غير معروفة'},400);const group=[...(royalServiceRecords[service]||[]),...(royalActualServiceRecords[service]||[])];
 if(!Array.isArray(group))return json({error:'خدمة غير معروفة'},400);
 const index=Number(u.searchParams.get('group')||0),offset=Number(u.searchParams.get('offset')||0);
 if(!Number.isInteger(index)||index<0||!Number.isSafeInteger(offset)||offset<0||offset>100000)return json({error:'صفحة غير صالحة'},400);
 if(!group.length)return json({groups:[],rows:[]});
 if(!group[index])return json({error:'سجل غير معروف'},400);
 const table=group[index][1];
 const queries={
 saliyah_sim_enrollments:'SELECT e.*,c.name citizen_name,i.name institution_name FROM saliyah_sim_enrollments e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id LEFT JOIN saliyah_sim_institutions i ON i.id=e.institution_id ORDER BY e.id LIMIT ? OFFSET ?',
 saliyah_sim_identities:'SELECT e.*,c.name citizen_name FROM saliyah_sim_identities e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id ORDER BY e.id LIMIT ? OFFSET ?',
 saliyah_sim_bank_accounts:"SELECT a.*,COALESCE(c.name,b.name) owner_name FROM saliyah_sim_bank_accounts a LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND c.id=a.owner_id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND b.id=a.owner_id ORDER BY a.id LIMIT ? OFFSET ?",
 saliyah_sim_education_details:'SELECT * FROM saliyah_sim_education_details ORDER BY institution_id LIMIT ? OFFSET ?',
 saliyah_sim_company_payroll_decisions:'SELECT * FROM saliyah_sim_company_payroll_decisions ORDER BY decided_at DESC LIMIT ? OFFSET ?'
 };
 const recordDb=['saliyah_sim_institutions','saliyah_sim_education_details'].includes(table)?(env.SIMULATION_DB||db):db; // All financial records use the authoritative DB ledger until migration is atomic
 try{const query=table==='saliyah_sim_bank_accounts'?'SELECT * FROM saliyah_sim_bank_accounts ORDER BY id LIMIT ? OFFSET ?':table==='saliyah_sim_bank_transactions'?'SELECT * FROM saliyah_sim_bank_transactions ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?':queries[table];const r=await recordDb.prepare(query||('SELECT * FROM '+table+' ORDER BY rowid LIMIT ? OFFSET ?')).bind(26,offset).all();if(table==='saliyah_sim_education_details'){const ids=[...new Set(r.results.map(row=>row.institution_id))];if(ids.length){const institutes=await (env.SIMULATION_DB||db).prepare('SELECT id,name FROM saliyah_sim_institutions WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();const names=new Map(institutes.results.map(x=>[x.id,x.name]));for(const row of r.results)row.institution_name=names.get(row.institution_id)||'مؤسسة افتراضية'}}if(table==='saliyah_sim_bank_transactions'){const ids=[...new Set(r.results.map(row=>row.account_id).filter(Boolean))];if(ids.length){const accounts=await db.prepare('SELECT id,account_number,owner_type,owner_id FROM saliyah_sim_bank_accounts WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();const byId=new Map(accounts.results.map(x=>[x.id,x]));const names=new Map();for(const [type,tableName] of [['citizen','saliyah_sim_citizens'],['company','saliyah_sim_companies']]){const owners=accounts.results.filter(row=>row.owner_type===type).map(row=>row.owner_id);if(owners.length){const people=await db.prepare('SELECT id,name FROM '+tableName+' WHERE id IN ('+owners.map(()=>'?').join(',')+')').bind(...owners).all();for(const person of people.results)names.set(type+':'+person.id,person.name)}}for(const row of r.results){const account=byId.get(row.account_id);row.account_number=account?.account_number||'';row.owner_name=account?(names.get(account.owner_type+':'+account.owner_id)||'مجهول'):'مجهول'}}}if(table==='saliyah_sim_bank_accounts'){const names=new Map();for(const [type,ownerTable] of [['citizen','saliyah_sim_citizens'],['company','saliyah_sim_companies']]){const ids=[...new Set(r.results.filter(row=>row.owner_type===type).map(row=>row.owner_id))];if(ids.length){const owners=await db.prepare('SELECT id,name FROM '+ownerTable+' WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();for(const owner of owners.results)names.set(type+':'+owner.id,owner.name)}}for(const row of r.results)row.owner_name=names.get(row.owner_type+':'+row.owner_id)||'مجهول'}const safeRows=r.results.slice(0,25).map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!/(password|token|secret|credential|cookie|salt|otp)/i.test(key))));const namedRows=await resolveRoyalBotNames(db,safeRows);return json({groups:group.map(x=>x[0]),rows:namedRows,more:r.results.length>25})}catch(e){if(String(e).includes('no such table'))return json({groups:group.map(x=>x[0]),rows:[],unavailable:true});throw e}
}

// X Al-Saliyah: profiles are bound to authenticated accounts; ministry verification
// is granted only for a ministry assignment recorded by the government.
if(method==='GET'&&path==='/api/aviation/tourists'){
 if(!user||user.role!=='king')return json({error:'غير مخول'},403);
 if(!env.AVIATION_DB)return json({error:'قاعدة الطيران غير متصلة'},503);
 const rows=await env.AVIATION_DB.prepare("SELECT id,name,nationality,visa_status,arrival_port,visit_purpose,created_at FROM saliyah_sim_tourists ORDER BY created_at DESC LIMIT 100").all();
 return json({tourists:rows.results});
}

if(path.startsWith('/api/aviation/')){
 const aviationDb=env.AVIATION_DB;
 if(!aviationDb)return json({error:'قاعدة بيانات الطيران غير متصلة'},503);
 if(method==='GET'&&path==='/api/aviation/readiness')return json(await airportReadiness(db,aviationDb));
 
 if(method==='GET'&&path==='/api/aviation/routes')return json({routes:AIRPORT_ROUTE_SEEDS.map(([code,name])=>({code,name})),fleet:AIRPORT_FLEET.map(([airline,aircraft,units,kind])=>({airline,aircraft,units,kind}))});
 if(method==='GET'&&path==='/api/aviation/admin'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const readiness=await airportReadiness(db,aviationDb);
  const [staff,flights,airlines,settings]=await Promise.all([
   aviationDb.prepare("SELECT id,name,category,status,employee_user_id,sim_citizen_id,qualified,training_score,license_number,appointed_at FROM aviation_staff ORDER BY created_at DESC LIMIT 100").all(),
   aviationDb.prepare("SELECT id,number,airline_id,origin_code,destination_code,departure_at,arrival_at,status FROM aviation_flights ORDER BY departure_at LIMIT 100").all(),
   aviationDb.prepare("SELECT id,name,code,kind,enabled FROM aviation_airlines").all(),
   aviationDb.prepare("SELECT key,value FROM aviation_settings WHERE key IN ('opening_authorized','operations_validated')").all()
  ]);
  return json({readiness,staff:staff.results,flights:flights.results,airlines:airlines.results,settings:settings.results});
 }
 if(method==='POST'&&path==='/api/aviation/admin/staff'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.name,3,120)||!AIRPORT_STAFF_TARGETS.some(x=>x[0]===b.category)||typeof b.employee_user_id!=='string'||!validText(b.employee_user_id,10,80))return json({error:'بيانات تعيين الموظف ناقصة'},400);
  const employee=await db.prepare("SELECT id FROM users WHERE id=?").bind(b.employee_user_id).first();
  if(!employee)return json({error:'الموظف غير مسجل في المملكة'},404);
  const existing=await aviationDb.prepare("SELECT id FROM aviation_staff WHERE employee_user_id=? AND category=?").bind(employee.id,b.category).first();
  if(existing)return json({error:'هذا الموظف معين في نفس التخصص'},409);
  const id=random();
  await aviationDb.prepare("INSERT INTO aviation_staff(id,name,category,employee_user_id,status,appointed_at) VALUES(?,?,?,?,'active',CURRENT_TIMESTAMP)").bind(id,b.name.trim(),b.category,employee.id).run();
  await audit(db,user.id,'aviation_staff_appoint','aviation_staff',id,{category:b.category});
  return json({ok:true,id},201);
 }
 if(method==='POST'&&path==='/api/aviation/admin/staff/qualify'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const b=await input(req);
  if(!b||!validText(b.id,10,80)||!Number.isInteger(b.score)||b.score<0||b.score>100||!validText(b.license_number,6,48))return json({error:'بيانات اختبار وتوثيق الموظف غير صالحة'},400);
  const result=await aviationDb.prepare("UPDATE aviation_staff SET qualified=?,training_score=?,license_number=?,training_completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.score>=70?1:0,b.score,b.license_number.trim(),b.id).run();
  if(!result.meta.changes)return json({error:'الموظف غير موجود'},404);
  await audit(db,user.id,'aviation_staff_qualified','aviation_staff',b.id,{qualified:b.score>=70,score:b.score});
  return json({ok:true,qualified:b.score>=70});
 }
 if(method==='POST'&&path==='/api/aviation/admin/staff/status'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['active','inactive'].includes(b.status))return json({error:'طلب غير صالح'},400);
  const r=await aviationDb.prepare("UPDATE aviation_staff SET status=? WHERE id=?").bind(b.status,b.id).run();
  if(!r.meta.changes)return json({error:'الموظف غير موجود'},404);
  await audit(db,user.id,'aviation_staff_status','aviation_staff',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/aviation/admin/flight'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.number,3,12)||!['saliyah-airlines','flyadeal-saliyah'].includes(b.airline_id)||!['RUH','JED','DOH','DXB','AUH','KWI','BAH','MCT','CAI','IST','LHR','NRT','CDG','FRA'].includes(b.destination_code)||typeof b.departure_at!=='string'||typeof b.arrival_at!=='string'||!Number.isFinite(Date.parse(b.departure_at))||!Number.isFinite(Date.parse(b.arrival_at))||Date.parse(b.arrival_at)<=Date.parse(b.departure_at)||!Number.isSafeInteger(b.price_economy)||b.price_economy<1||!Number.isSafeInteger(b.seats_economy)||b.seats_economy<1||b.seats_economy>600||!Number.isSafeInteger(b.seats_business)||b.seats_business<0||b.seats_business>120)return json({error:'بيانات الرحلة غير مكتملة أو غير صحيحة'},400);
  if(Date.parse(b.departure_at)<=Date.now())return json({error:'يجب أن تكون الرحلة مستقبلية'},400);
  const id=random();
  try{await aviationDb.prepare("INSERT INTO aviation_flights(id,airline_id,number,origin_code,destination_code,departure_at,arrival_at,price_economy,seats_economy,seats_business,status) VALUES(?,?,?,'SJD',?,?,?,?,?,?,'draft')").bind(id,b.airline_id,b.number.trim().toUpperCase(),b.destination_code,new Date(b.departure_at).toISOString().replace('T',' ').slice(0,19),new Date(b.arrival_at).toISOString().replace('T',' ').slice(0,19),b.price_economy,b.seats_economy,b.seats_business).run()}catch(e){return json({error:'تعذر إضافة الرحلة أو رقمها مكرر'},409)}
  await audit(db,user.id,'aviation_flight_draft','aviation_flights',id,{});return json({id,status:'draft'},201);
 }
 if(method==='POST'&&path==='/api/aviation/admin/validation'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const readiness=await airportReadiness(db,aviationDb);
  if(!readiness.construction_complete||!readiness.staff_complete||!readiness.airlines_ready||readiness.scheduled_flights<1)return json({error:'لم تكتمل شروط التشغيل لا يمكن اجتياز فحص العمليات',readiness},409);
  // An operational smoke test must explicitly verify live booking/payment/check-in and staff readiness.
  return json({error:'اعتماد فحوصات الدفع والإلغاء والصعود الفعلية غير مكتمل بعد؛ لا يمكن تجاوزها'},409);
 }
 if(method==='POST'&&path==='/api/aviation/admin/flight/status'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['draft','scheduled','cancelled'].includes(b.status))return json({error:'طلب غير صالح'},400);
  const r=await aviationDb.prepare("UPDATE aviation_flights SET status=? WHERE id=? AND status IN ('draft','scheduled') AND departure_at>datetime('now')").bind(b.status,b.id).run();if(!r.meta.changes)return json({error:'الرحلة غير موجودة أو لا يمكن تعديلها'},409);
  if(b.status==='cancelled')await reconcileAviationCancelledFlights(db,aviationDb);
  await audit(db,user.id,'aviation_flight_status','aviation_flights',b.id,{status:b.status});return json({ok:true});
 }

 if(method==='GET'&&path==='/api/aviation/flights'){
  const rows=await aviationDb.prepare("SELECT f.id,f.number,f.origin_code,f.destination_code,f.departure_at,f.arrival_at,f.price_economy,f.seats_economy,f.seats_business,f.status,a.name airline,a.code airline_code FROM aviation_flights f JOIN aviation_airlines a ON a.id=f.airline_id WHERE f.status IN ('scheduled','boarding','departed','arrived') ORDER BY f.departure_at LIMIT 100").all();
  const readiness=await airportReadiness(db,aviationDb);
  return json({flights:rows.results,airport_open:readiness.ready,bookings_enabled:readiness.ready&&readiness.booking_operations_ready});
 }
 if(method==='GET'&&path==='/api/aviation/my-bookings'){
  if(!user)return json({error:'سجل الدخول لعرض حجوزاتك'},401);
  const rows=await aviationDb.prepare("SELECT b.id,b.reference,b.status,b.seat_class,b.price,b.created_at,f.number flight_number,f.departure_at,f.origin_code,f.destination_code FROM aviation_bookings b JOIN aviation_flights f ON f.id=b.flight_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 50").bind(user.id).all();
  return json({bookings:rows.results});
 }
 if(method==='GET'&&path==='/api/aviation/boarding-passes'){
  if(!user)return json({error:'سجل الدخول لعرض بطاقات الصعود'},401);
  const rows=await aviationDb.prepare("SELECT p.id,p.booking_id,p.issued_at,p.seat,b.reference,f.number flight_number,f.destination_code,f.departure_at FROM aviation_boarding_passes p JOIN aviation_bookings b ON b.id=p.booking_id JOIN aviation_flights f ON f.id=b.flight_id WHERE b.user_id=? ORDER BY p.issued_at DESC LIMIT 50").bind(user.id).all();
  return json({boarding_passes:rows.results});
 }
 if(method==='POST'&&path==='/api/aviation/booking'){
  if(!user)return json({error:'سجل الدخول أولاً'},401);
  const readiness=await airportReadiness(db,aviationDb);
  if(!readiness.ready)return json({error:'المطار غير جاهز للحجوزات، شروط التشغيل لم تكتمل'},409);
  const b=await input(req);
  if(!b||!validText(b.flight_id,10,80)||!['economy','business'].includes(b.seat_class)||!validText(b.bank_account_id,10,80)||!validText(b.idempotency_key,12,80))return json({error:'اختر الرحلة والدرجة والحساب البنكي وأعد المحاولة'},400);
  const existing=await aviationDb.prepare("SELECT id,status,reference,payment_status FROM aviation_bookings WHERE user_id=? AND idempotency_key=?").bind(user.id,b.idempotency_key).first();
  if(existing){
   const completed=await completeAviationBooking(db,aviationDb,existing.id,user.id);
   if(completed.ok)return json({ok:true,id:existing.id,reference:existing.reference,status:'confirmed',already_exists:true});
   return json({error:completed.error,reference:existing.reference,booking_id:existing.id},409);
  }
  const f=await aviationDb.prepare("SELECT f.id,f.airline_id,f.departure_at,f.arrival_at,f.seats_economy,f.seats_business,f.price_economy,f.status,a.kind FROM aviation_flights f JOIN aviation_airlines a ON a.id=f.airline_id WHERE f.id=? AND f.status='scheduled'").bind(b.flight_id).first();
  if(!f||Date.parse(f.departure_at.replace(' ','T')+'Z')<Date.now()+2*3600000)return json({error:'الرحلة غير متاحة للحجز'},404);
  if(b.seat_class==='business'&&f.kind!=='full_service')return json({error:'هذه الشركة لا توفر درجة أعمال'},409);
  const capacity=b.seat_class==='business'?Number(f.seats_business):Number(f.seats_economy);
  if(capacity<1)return json({error:'لا توجد مقاعد بهذه الدرجة'},409);
  const passport=await validateAviationPassenger(db,user.id,f.departure_at.slice(0,10));
  if(passport.error)return json({error:passport.error},409);
  const account=await db.prepare("SELECT id,balance FROM bank_accounts WHERE id=? AND user_id=?").bind(b.bank_account_id,user.id).first();
  if(!account)return json({error:'الحساب البنكي لا يخص المستخدم'},403);
  const price=b.seat_class==='business'?Math.round(Number(f.price_economy)*2.4):Number(f.price_economy);
  if(!Number.isSafeInteger(price)||account.balance<price)return json({error:'رصيد الحساب غير كافٍ لسعر التذكرة'},409);
  const id=random(),reference='SY'+id.replace(/-/g,'').slice(0,9).toUpperCase();
  try{
   const reserved=await aviationDb.prepare("INSERT INTO aviation_bookings(id,reference,flight_id,user_id,status,seat_class,price,idempotency_key,passport_number,passenger_name,bank_account_id) SELECT ?,?,?,?,'pending',?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM aviation_bookings WHERE flight_id=? AND seat_class=? AND (status='confirmed' OR status='pending' AND created_at>=datetime('now','-20 minutes')))< ? AND EXISTS(SELECT 1 FROM aviation_flights WHERE id=? AND status='scheduled')").bind(id,reference,f.id,user.id,b.seat_class,price,b.idempotency_key,passport.passport.number,passport.passport.full_name,account.id,f.id,b.seat_class,capacity,f.id).run();
   if(!reserved.meta.changes)return json({error:'المقاعد ممتلئة في هذه الدرجة'},409);
  }catch(e){console.error('aviation_reservation_failed',String(e).slice(0,180));return json({error:'تعذر حجز المقعد أو تكرار طلب الحجز'},409)}
  try{await db.prepare("INSERT INTO aviation_payment_ledger(booking_id,airline_id,user_id,bank_account_id,amount) VALUES(?,?,?,?,?)").bind(id,f.airline_id,user.id,account.id,price).run()}
  catch(e){await aviationDb.prepare("UPDATE aviation_bookings SET status='cancelled' WHERE id=? AND status='pending'").bind(id).run();return json({error:'تعذر خصم سعر التذكرة، تحقق من الرصيد'},409)}
  const completed=await completeAviationBooking(db,aviationDb,id,user.id);
  if(!completed.ok)return json({error:completed.error,reference,booking_id:id},503);
  await audit(db,user.id,'aviation_booking_paid','aviation_bookings',id,{flight_id:f.id,amount:price,account_id:account.id});
  return json({ok:true,id,reference,status:'confirmed',amount:price},201);
 }
 
 if(method==='POST'&&path==='/api/aviation/check-in'){
  if(!user)return json({error:'سجل الدخول أولاً'},401);
  const b=await input(req);if(!b||!validText(b.booking_id,10,80))return json({error:'رقم الحجز مطلوب'},400);
  const row=await aviationDb.prepare("SELECT b.id,b.flight_id,b.user_id,b.seat_class,b.passport_number,b.status,b.payment_status,f.departure_at,f.status flight_status,f.seats_economy,f.seats_business FROM aviation_bookings b JOIN aviation_flights f ON f.id=b.flight_id WHERE b.id=? AND b.user_id=?").bind(b.booking_id,user.id).first();
  if(!row||row.status!=='confirmed'||row.payment_status!=='paid')return json({error:'الحجز غير مؤكد أو لم يُدفع'},409);
  const payment=await db.prepare("SELECT 1 FROM aviation_payment_ledger WHERE booking_id=? AND user_id=? AND status='confirmed'").bind(row.id,user.id).first();
  if(!payment)return json({error:'لا يوجد تأكيد بنكي للحجز'},409);
  const depart=Date.parse(row.departure_at.replace(' ','T')+'Z');
  if(!Number.isFinite(depart)||depart-Date.now()>24*3600000||depart-Date.now()<45*60000||!['scheduled','boarding'].includes(row.flight_status))return json({error:'تسجيل السفر متاح من 24 ساعة إلى 45 دقيقة قبل الإقلاع'},409);
  const pass=await db.prepare("SELECT id,number,expires_at FROM documents WHERE created_by=? AND type='passport' AND number=? AND status='valid' AND expires_at>=?").bind(user.id,row.passport_number,row.departure_at.slice(0,10)).first();
  if(!pass)return json({error:'جواز الحجز غير صالح للسفر'},409);
  const circular=await db.prepare("SELECT 1 FROM circulars WHERE document_id=? AND status='active' AND (expires_at IS NULL OR expires_at>=date('now')) LIMIT 1").bind(pass.id).first();
  if(circular)return json({error:'يمنع التعميم الحالي إكمال تسجيل السفر'},409);
  const already=await aviationDb.prepare("SELECT id,seat,issued_at FROM aviation_boarding_passes WHERE booking_id=?").bind(row.id).first();
  if(already)return json({ok:true,boarding_pass:already,already_issued:true});
  const capacity=row.seat_class==='business'?row.seats_business:row.seats_economy;
  const prefix=row.seat_class==='business'?'B-':'E-';
  const current=await aviationDb.prepare("SELECT COUNT(*) n FROM aviation_boarding_passes WHERE flight_id=? AND seat LIKE ?").bind(row.flight_id,prefix+'%').first();
  if(current.n>=capacity)return json({error:'المقاعد المخصصة لهذه الدرجة غير متاحة'},409);
  const seat=prefix+String(current.n+1).padStart(3,'0'),id=random();
  try{
   const result=await aviationDb.batch([
    aviationDb.prepare("INSERT INTO aviation_boarding_passes(id,booking_id,seat,flight_id) VALUES(?,?,?,?)").bind(id,row.id,seat,row.flight_id),
    aviationDb.prepare("UPDATE aviation_bookings SET checked_in_at=CURRENT_TIMESTAMP WHERE id=? AND checked_in_at IS NULL").bind(row.id)
   ]);
   if(!result[0].meta.changes)return json({error:'تعذر إصدار بطاقة الصعود'},409);
  }catch(e){console.error('aviation_checkin_failed',String(e).slice(0,160));return json({error:'تعارض في المقعد؛ أعد المحاولة'},409)}
  await audit(db,user.id,'aviation_checkin','aviation_boarding_passes',id,{booking_id:row.id,seat});
  return json({ok:true,boarding_pass:{id,seat}},201);
 }
 if(method==='POST'&&path==='/api/aviation/board'){
  if(!user||!(await can('borders')))return json({error:'إتمام الصعود مخصص لموظفي الجوازات'},403);
  const b=await input(req);if(!b||!validText(b.booking_id,10,80))return json({error:'رقم الحجز مطلوب'},400);
  const row=await aviationDb.prepare("SELECT b.id,b.user_id,b.flight_id,b.passport_number,b.payment_status,b.status,p.id pass_id,f.departure_at,f.status flight_status FROM aviation_bookings b JOIN aviation_flights f ON f.id=b.flight_id JOIN aviation_boarding_passes p ON p.booking_id=b.id WHERE b.id=?").bind(b.booking_id).first();
  if(!row||row.status!=='confirmed'||row.payment_status!=='paid')return json({error:'لا توجد بطاقة صعود صالحة'},409);
  const departure=Date.parse(row.departure_at.replace(' ','T')+'Z');
  if(!Number.isFinite(departure)||departure-Date.now()>3*3600000||Date.now()>departure+30*60000||!['scheduled','boarding'].includes(row.flight_status))return json({error:'بوابة الصعود خارج المدة المسموحة'},409);
  const checked=await validateAviationPassenger(db,row.user_id,row.departure_at.slice(0,10));
  if(checked.error||checked.passport.number!==row.passport_number)return json({error:checked.error||'الجواز لا يطابق الحجز'},409);
  const done=await aviationDb.prepare("SELECT id,status,border_movement_id FROM aviation_boarding_events WHERE booking_id=?").bind(row.id).first();
  if(done?.status==='completed')return json({ok:true,border_movement_id:done.border_movement_id,already_boarded:true});
  const eventId=done?.id||random(),movementId='air-exit-'+row.id;
  if(!done)await aviationDb.prepare("INSERT INTO aviation_boarding_events(id,booking_id,flight_id,passport_number) VALUES(?,?,?,?)").bind(eventId,row.id,row.flight_id,row.passport_number).run();
  const border=await db.prepare("SELECT id,post_id,document_id FROM border_movements WHERE id=?").bind(movementId).first();
  if(border&&(border.post_id!=='airport-sjd'||border.document_id!==checked.passport.id))return json({error:'يوجد تعارض في سجل حركة الجواز'},409);
  if(!border)await db.prepare("INSERT INTO border_movements(id,post_id,document_id,direction,purpose,actor_id) VALUES(?,'airport-sjd',?,'exit',?,?)").bind(movementId,checked.passport.id,'رحلة '+row.flight_id,user.id).run();
  await aviationDb.prepare("UPDATE aviation_boarding_events SET status='completed',boarded_at=CURRENT_TIMESTAMP,border_movement_id=? WHERE booking_id=? AND status='pending'").bind(movementId,row.id).run();
  await audit(db,user.id,'aviation_boarding','aviation_boarding_events',eventId,{booking_id:row.id,movement_id:movementId});
  return json({ok:true,border_movement_id:movementId},201);
 }
 if(method==='POST'&&path==='/api/aviation/authorize'){
  if(!user||user.role!=='king')return json({error:'قرار افتتاح المطار للملك فقط'},403);
  const b=await input(req);
  if(!b||typeof b.authorized!=='boolean')return json({error:'قرار غير صالح'},400);
  if(b.authorized){
   const current=await airportReadiness(db,aviationDb);
   if(!current.airlines_ready)return json({error:'لا يمكن اعتماد مطار بدون شركات طيران مسجلة',readiness:current},409);
   // Preapproval is a recorded sovereign decision, never a bypass of operating checks.
  }
  await aviationDb.prepare("UPDATE aviation_settings SET value=? WHERE key='opening_authorized'").bind(b.authorized?'1':'0').run();
  await audit(db,user.id,'airport_authorization','aviation_settings','opening_authorized',{authorized:b.authorized});
  return json({ok:true,authorized:b.authorized,scope:'royal_preapproval_only',airport_open:(await airportReadiness(db,aviationDb)).ready});
 }
 return json({error:'مسار الطيران غير موجود'},404);
}

if(path.startsWith('/api/x/')){
 const profileFor=async()=>user?db.prepare('SELECT * FROM x_profiles WHERE user_id=?').bind(user.id).first():null;
 const creatorStats=profileId=>computeXCreatorStats(db,profileId);

 if(method==='GET'&&path==='/api/x/feed'){
  const rows=await db.prepare("SELECT p.id,p.body,p.reply_to,p.repost_of,p.created_at,a.id profile_id,a.handle,a.display_name,a.kind,a.verified,(SELECT mime_type FROM x_post_media WHERE post_id=p.id) media_type,(SELECT COUNT(*) FROM x_likes l WHERE l.post_id=p.id)+(SELECT COALESCE(CAST((max(0,julianday('now')-julianday(b.created_at))*max(0,julianday('now')-julianday(b.created_at))*1250)+(b.bot_likes*min(1,max(0,julianday('now')-julianday(b.created_at))/3)) AS INTEGER),0) FROM x_bot_reach b WHERE b.post_id=p.id) likes,(SELECT COUNT(*) FROM x_posts r WHERE r.reply_to=p.id) replies FROM x_posts p JOIN x_profiles a ON a.id=p.profile_id WHERE p.reply_to IS NULL ORDER BY p.created_at DESC LIMIT 100").all();
  const own=await profileFor();
  return json({posts:rows.results.map(p=>({...p,media_url:p.media_type?'/api/x/media/'+encodeURIComponent(p.id):null})),profile:own});
 }
 if(method==='GET'&&path.startsWith('/api/x/media/')){
  const postId=decodeURIComponent(path.slice('/api/x/media/'.length));
  if(!/^[a-f0-9-]{36}$/.test(postId))return json({error:'ملف غير موجود'},404);
  const media=await db.prepare('SELECT mime_type,data_base64 FROM x_post_media WHERE post_id=?').bind(postId).first();
  if(!media)return json({error:'ملف غير موجود'},404);
  const binary=atob(media.data_base64);const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Response(bytes,{headers:{'content-type':media.mime_type,'cache-control':'public, max-age=3600','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
 }
 if(method==='GET'&&path==='/api/x/comments'){
  const id=u.searchParams.get('post_id')||'';
  const parent=await db.prepare('SELECT id FROM x_posts WHERE id=?').bind(id).first();
  if(!parent)return json({error:'المنشور غير موجود'},404);
  const rows=await db.prepare("SELECT p.id,p.body,p.created_at,a.handle,a.display_name,a.kind,a.verified FROM x_posts p JOIN x_profiles a ON a.id=p.profile_id WHERE p.reply_to=? ORDER BY p.created_at ASC LIMIT 100").bind(id).all();
  return json({comments:rows.results});
 }
 if(method==='GET'&&path==='/api/admin/x/bot-bank-ledger'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const q=(u.searchParams.get('account_number')||'').trim().slice(0,80);
  const rows=await db.prepare("SELECT l.id,l.account_number,p.display_name,p.handle,l.amount,l.balance_after,l.created_at FROM x_bot_bank_ledger l JOIN x_profiles p ON p.id=l.profile_id WHERE (?='' OR l.account_number=?) ORDER BY l.id DESC LIMIT 100").bind(q,q).all();
  return json({transactions:rows.results,simulated:true});
 }
 if(method==='GET'&&path==='/api/admin/x/bot-bank-accounts'){
  if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
  const page=Math.max(1,Math.min(10000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const size=100;
  const q=(u.searchParams.get('q')||'').trim().slice(0,80);
  const count=await db.prepare("SELECT COUNT(*) n FROM x_bot_bank_accounts a JOIN x_profiles p ON p.id=a.profile_id WHERE p.kind='bot' AND (?='' OR p.handle LIKE ? OR p.display_name LIKE ? OR a.account_number LIKE ?)").bind(q,'%'+q+'%','%'+q+'%','%'+q+'%').first();
  const rows=await db.prepare("SELECT p.handle,p.display_name,a.account_number,a.bank_name,a.balance,a.created_at FROM x_bot_bank_accounts a JOIN x_profiles p ON p.id=a.profile_id WHERE p.kind='bot' AND (?='' OR p.handle LIKE ? OR p.display_name LIKE ? OR a.account_number LIKE ?) ORDER BY p.handle LIMIT ? OFFSET ?").bind(q,'%'+q+'%','%'+q+'%','%'+q+'%',size,(page-1)*size).all();
  return json({accounts:rows.results,pagination:{page,page_size:size,total:Number(count.n),pages:Math.ceil(Number(count.n)/size)},simulated:true});
 }
 if(method==='GET'&&path==='/api/x/bot-directory'){
  const page=Math.max(1,Math.min(10000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const size=30;
  const total=await db.prepare("SELECT COUNT(*) n FROM x_profiles WHERE kind='bot'").first();
  const bots=await db.prepare("SELECT id,handle,display_name,bio,created_at FROM x_profiles WHERE kind='bot' ORDER BY handle LIMIT ? OFFSET ?").bind(size,(page-1)*size).all();
  return json({bots:bots.results,pagination:{page,page_size:size,total:Number(total.n),pages:Math.ceil(Number(total.n)/size)},simulated:true});
 }
 if(method==='GET'&&path==='/api/x/bot-comments'){
  const id=u.searchParams.get('post_id')||'';
  const parent=await db.prepare('SELECT id FROM x_posts WHERE id=?').bind(id).first();
  if(!parent)return json({error:'المنشور غير موجود'},404);
  const rows=await db.prepare("SELECT p.id,p.body,p.created_at,a.id profile_id,a.handle,a.display_name,a.kind,a.verified FROM x_posts p JOIN x_profiles a ON a.id=p.profile_id WHERE a.kind='bot' AND p.id IN (WITH RECURSIVE thread(id) AS (SELECT id FROM x_posts WHERE reply_to=? UNION ALL SELECT child.id FROM x_posts child JOIN thread t ON child.reply_to=t.id) SELECT id FROM thread) ORDER BY p.created_at ASC LIMIT 100").bind(id).all();
  return json({comments:rows.results,simulated:true});
 }
 if(method==='GET'&&path==='/api/x/earnings'){
  if(!user)return json({error:'سجل الدخول أولاً'},401);
  const own=await profileFor();
  if(!own)return json({error:'أنشئ حساب إكس أولاً'},403);
  const stats=await creatorStats(own.id);
  const eligible=own.kind==='person'&&stats.followers>=10&&stats.likes>=20&&stats.reposts>=5;
  const amount=eligible?Math.floor((stats.followers_twice+stats.likes_twice*2+stats.reposts_twice*3)/2):0;
  const period=Math.floor(Date.now()/259200000).toString();
  const paid=await db.prepare('SELECT id,amount,created_at FROM x_creator_payouts WHERE profile_id=? AND period=?').bind(own.id,period).first();
  // Debt collection is intentionally not bypassed; explain the destination of every credit.
  const history=await db.prepare("SELECT p.period,p.amount,p.created_at,p.bank_account_id,a.bank,COALESCE((SELECT SUM(c.amount) FROM debt_collections c WHERE c.bank_account_id=p.bank_account_id AND c.created_at=p.created_at),0) debt_collected FROM x_creator_payouts p JOIN bank_accounts a ON a.id=p.bank_account_id AND a.user_id=p.user_id WHERE p.profile_id=? AND p.user_id=? ORDER BY p.created_at DESC LIMIT 12").bind(own.id,user.id).all();
  const paidReceipt=history.results.find(p=>p.period===period)||null;
  const auto=await db.prepare('SELECT bank_account_id,enabled FROM x_creator_payout_preferences WHERE profile_id=? AND user_id=?').bind(own.id,user.id).first();
  return json({stats,eligible,amount,period,paid:!!paid,paid_receipt:paidReceipt?{amount:paidReceipt.amount,debt_collected:Math.min(paidReceipt.amount,paidReceipt.debt_collected),net_credited:Math.max(0,paidReceipt.amount-paidReceipt.debt_collected),bank:paidReceipt.bank,created_at:paidReceipt.created_at}:null,auto_payout:auto?{enabled:!!auto.enabled,bank_account_id:auto.bank_account_id}:{enabled:false},history:history.results,requirements:{followers:10,likes:20,reposts:5},period_cap:null,unlimited_earnings:true,period_days:3,kind:own.kind});
 }
 if(method==='POST'&&path==='/api/x/earnings/auto'){
  if(!user)return json({error:'سجل الدخول أولاً'},401);
  const own=await profileFor();
  if(!own||own.kind!=='person')return json({error:'للحسابات الشخصية فقط'},403);
  const b=await input(req);
  if(!b||typeof b.enabled!=='boolean')return json({error:'حدد تفعيل الصرف التلقائي أو إيقافه'},400);
  if(b.enabled){
   if(!validText(b.bank_account_id,10,80))return json({error:'اختر حسابك البنكي'},400);
   const account=await db.prepare('SELECT id FROM bank_accounts WHERE id=? AND user_id=?').bind(b.bank_account_id,user.id).first();
   if(!account)return json({error:'الحساب البنكي لا يخصك'},403);
   await db.prepare("INSERT INTO x_creator_payout_preferences(profile_id,user_id,bank_account_id,enabled) VALUES(?,?,?,1) ON CONFLICT(profile_id) DO UPDATE SET bank_account_id=excluded.bank_account_id,user_id=excluded.user_id,enabled=1,updated_at=CURRENT_TIMESTAMP").bind(own.id,user.id,account.id).run();
  }else{
   await db.prepare("UPDATE x_creator_payout_preferences SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE profile_id=? AND user_id=?").bind(own.id,user.id).run();
  }
  return json({ok:true,enabled:b.enabled});
 }
 if(method==='POST'&&path==='/api/x/earnings/claim'){
  if(!user)return json({error:'سجل الدخول أولاً'},401);
  const own=await profileFor();
  if(!own||own.kind!=='person')return json({error:'مكافآت الشهرة للحسابات الشخصية فقط'},403);
  const b=await input(req);
  if(!b||!validText(b.bank_account_id,10,80))return json({error:'اختر حسابك البنكي'},400);
  const account=await db.prepare('SELECT id FROM bank_accounts WHERE id=? AND user_id=?').bind(b.bank_account_id,user.id).first();
  if(!account)return json({error:'الحساب البنكي لا يخصك'},403);
  const stats=await creatorStats(own.id);
  if(stats.followers<10||stats.likes<20||stats.reposts<5)return json({error:'لم تحقق شروط برنامج الشهرة بعد'},403);
  const amount=Math.floor((stats.followers_twice+stats.likes_twice*2+stats.reposts_twice*3)/2);
  const period=Math.floor(Date.now()/259200000).toString();
  const id=random();
  try{await db.prepare('INSERT INTO x_creator_payouts(id,profile_id,user_id,period,followers,likes,reposts,amount,bank_account_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,own.id,user.id,period,stats.followers,stats.likes,stats.reposts,amount,account.id).run();}
  catch{return json({error:'تم صرف مكافأة هذه الدورة مسبقاً أو تعذر إتمام التحويل'},409)}
  await db.prepare("INSERT INTO x_creator_payout_preferences(profile_id,user_id,bank_account_id,enabled) VALUES(?,?,?,1) ON CONFLICT(profile_id) DO UPDATE SET bank_account_id=excluded.bank_account_id,user_id=excluded.user_id,enabled=1,updated_at=CURRENT_TIMESTAMP").bind(own.id,user.id,account.id).run();
  const receipt=await db.prepare("SELECT p.amount,a.bank,COALESCE((SELECT SUM(c.amount) FROM debt_collections c WHERE c.bank_account_id=p.bank_account_id AND c.created_at=p.created_at),0) debt_collected FROM x_creator_payouts p JOIN bank_accounts a ON a.id=p.bank_account_id AND a.user_id=p.user_id WHERE p.id=? AND p.user_id=?").bind(id,user.id).first();
  if(!receipt)return json({error:'تم إنشاء الصرف لكن تعذّر تحميل الإيصال؛ تحقق من سجل الأرباح'},503);
  const debtCollected=Math.min(receipt.amount,Number(receipt.debt_collected)||0);
  await audit(db,user.id,'x_creator_reward','x_creator_payout',id,{amount,period,debt_collected:debtCollected});
  return json({ok:true,amount,period,bank:receipt.bank,debt_collected:debtCollected,net_credited:amount-debtCollected});
 }
 if(method==='GET'&&path==='/api/x/profile'){
  const handle=u.searchParams.get('handle')||'';
  const p=await db.prepare('SELECT id,handle,display_name,bio,kind,verified,created_at FROM x_profiles WHERE handle=?').bind(handle).first();
  if(!p)return json({error:'الحساب غير موجود'},404);
  const posts=await db.prepare('SELECT id,body,created_at,reply_to,repost_of FROM x_posts WHERE profile_id=? ORDER BY created_at DESC LIMIT 100').bind(p.id).all();
  const followers=await db.prepare('SELECT COUNT(*) n FROM x_follows WHERE following_id=?').bind(p.id).first();
  return json({profile:p,posts:posts.results,followers:followers.n});
 }
 if(!user)return json({error:'سجل الدخول لاستخدام إكس الصالية'},401);
 if(method==='GET'&&path==='/api/x/ministries'){
  const rows=await db.prepare('SELECT ministry_id FROM ministry_accounts WHERE user_id=?').bind(user.id).all();
  return json({ministries:user.role==='king'?ministries:rows.results.map(x=>ministries[x.ministry_id]).filter(Boolean)});
 }
 if(method==='POST'&&path==='/api/x/account'){
  const b=await input(req);if(!b)return json({error:'بيانات ناقصة'},400);
  const existing=await profileFor();if(existing)return json({error:'لديك حساب بالفعل'},409);
  const ministryId=b.ministry_id===undefined||b.ministry_id===null?null:Number(b.ministry_id);
  const official=ministryId!==null;
  if(official){
   if(!Number.isInteger(ministryId)||!ministries[ministryId])return json({error:'وزارة غير صحيحة'},400);
   if(user.role!=='king'){
    const allowed=await db.prepare('SELECT ministry_id FROM ministry_accounts WHERE user_id=? AND ministry_id=?').bind(user.id,ministryId).first();
    if(!allowed)return json({error:'لا تملك صلاحية تمثيل هذه الوزارة'},403);
   }
  }
  const handle=official?'ministry_'+ministryId:String(b.handle||'').trim().toLowerCase();
  if(!official && (/^ministry_\\d+$/.test(handle)||['king','government','official','chatgpt_saliyah'].includes(handle)))return json({error:'اسم الحساب محجوز للحسابات الرسمية'},403);
  const displayName=official?ministries[ministryId].name:String(b.display_name||'').trim();
  if(!official && (/وزارة|هيئة حكومية|الديوان الملكي|الملك|الحكومة الصالية/.test(displayName)))return json({error:'الأسماء الحكومية محجوزة للحسابات الرسمية'},403);
  if(!/^[a-z0-9_]{3,24}$/.test(handle)||!validText(displayName,2,60))return json({error:'اسم المستخدم 3–24 حرف إنجليزي أو رقم أو شرطة سفلية، والاسم الظاهر 2–60 حرفاً'},400);
  try{await db.prepare('INSERT INTO x_profiles(id,user_id,handle,display_name,kind,ministry_id,verified) VALUES(?,?,?,?,?,?,?)').bind(random(),user.id,handle,displayName,official?'ministry':'person',ministryId,official?1:0).run();}
  catch{return json({error:'اسم الحساب مستخدم أو لدى الوزارة حساب موثق بالفعل'},409)}
  return json({ok:true,verified:official});
 }
 const own=await profileFor();if(!own)return json({error:'أنشئ حساب إكس الصالية أولاً'},403);
 if(own.kind==='ministry' && user.role!=='king'){
  const assigned=await db.prepare('SELECT ministry_id FROM ministry_accounts WHERE user_id=? AND ministry_id=?').bind(user.id,own.ministry_id).first();
  if(!assigned)return json({error:'انتهت صلاحية إدارة الحساب الوزاري'},403);
 }
 if(method==='POST'&&path==='/api/x/post'){
  const b=await input(req);const hasMedia=!!b?.media;
  if(!b||(String(b.body||'').trim().length===0&&!hasMedia)||String(b.body||'').length>500)return json({error:'اكتب نصاً حتى 500 حرف أو أرفق صورة/فيديو'},400);
  let mediaType=null,mediaData=null;
  if(hasMedia){
   mediaType=String(b.media.type||'');mediaData=String(b.media.data||'');
   if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'].includes(mediaType)||!/^[A-Za-z0-9+/]+={0,2}$/.test(mediaData)||mediaData.length>1400000||mediaData.length%4!==0)return json({error:'نوع الملف غير مدعوم أو حجمه يتجاوز 1 ميجابايت (تخزين D1)'},400);
   try{const bytes=atob(mediaData);if(bytes.length>1048576||bytes.length===0)return json({error:'الحد الأعلى للملف 1 ميجابايت'},413);
    const sig=Array.from(bytes.slice(0,12),c=>c.charCodeAt(0));
    const starts=(a)=>a.every((v,i)=>sig[i]===v);
    const valid=mediaType==='image/jpeg'?starts([255,216,255]):mediaType==='image/png'?starts([137,80,78,71,13,10,26,10]):mediaType==='image/gif'?starts([71,73,70,56]):mediaType==='image/webp'?String.fromCharCode(...sig.slice(0,4))==='RIFF'&&String.fromCharCode(...sig.slice(8,12))==='WEBP':mediaType==='video/mp4'?String.fromCharCode(...sig.slice(4,8))==='ftyp':starts([26,69,223,163]);
    if(!valid)return json({error:'محتوى الملف لا يطابق نوعه'},400);
   }catch{return json({error:'ملف غير صالح'},400)}
  }
  let parent=null;if(b.reply_to){parent=await db.prepare('SELECT id FROM x_posts WHERE id=?').bind(String(b.reply_to)).first();if(!parent)return json({error:'المنشور الأصلي غير موجود'},404)}
  let repost=null;if(b.repost_of){repost=await db.prepare('SELECT id FROM x_posts WHERE id=?').bind(String(b.repost_of)).first();if(!repost)return json({error:'المنشور المراد إعادة نشره غير موجود'},404)}
  const id=random();await db.prepare('INSERT INTO x_posts(id,profile_id,body,reply_to,repost_of) VALUES(?,?,?,?,?)').bind(id,own.id,String(b.body||'').trim(),parent?.id||null,repost?.id||null).run();
  if(mediaType){try{await db.prepare('INSERT INTO x_post_media(post_id,mime_type,data_base64) VALUES(?,?,?)').bind(id,mediaType,mediaData).run()}catch{await db.prepare('DELETE FROM x_posts WHERE id=?').bind(id).run();return json({error:'تعذر حفظ المرفق في قاعدة البيانات'},500)}}
  return json({id,ok:true},201);
 }
 if(method==='POST'&&path==='/api/x/like'){
  const b=await input(req);const p=await db.prepare('SELECT id FROM x_posts WHERE id=?').bind(String(b?.post_id||'')).first();if(!p)return json({error:'المنشور غير موجود'},404);
  const existing=await db.prepare('SELECT post_id FROM x_likes WHERE profile_id=? AND post_id=?').bind(own.id,p.id).first();
  if(existing)await db.prepare('DELETE FROM x_likes WHERE profile_id=? AND post_id=?').bind(own.id,p.id).run();
  else await db.prepare('INSERT INTO x_likes(profile_id,post_id) VALUES(?,?)').bind(own.id,p.id).run();
  return json({liked:!existing});
 }
 if(method==='POST'&&path==='/api/x/follow'){
  const b=await input(req);const target=await db.prepare('SELECT id FROM x_profiles WHERE handle=?').bind(String(b?.handle||'')).first();
  if(!target||target.id===own.id)return json({error:'حساب غير صالح للمتابعة'},400);
  const existing=await db.prepare('SELECT following_id FROM x_follows WHERE follower_id=? AND following_id=?').bind(own.id,target.id).first();
  if(existing)await db.prepare('DELETE FROM x_follows WHERE follower_id=? AND following_id=?').bind(own.id,target.id).run();
  else await db.prepare('INSERT INTO x_follows(follower_id,following_id) VALUES(?,?)').bind(own.id,target.id).run();
  return json({following:!existing});
 }
 return json({error:'مسار غير موجود'},404);
}
if(method==='GET'&&path==='/api/public') {const news=await db.prepare('SELECT id,title,body,kind,created_at FROM news ORDER BY created_at DESC LIMIT 12').all();return json({ministries:ministries.map(m=>botMinisters.find(b=>b.id===m.id)||m),governorates:[{id:'sajjadah',name:'السجادة',governor:'قندس بن زياد بن بندر العمري',description:'العاصمة · مدينة السجادة'},{id:'mutajjar',name:'المتجار',governor:'كوب بن زياد بن بندر العمري',description:'محافظة صناعية وتجارية'},{id:'aqar',name:'عقار',governor:'خرفون بن خروف الخرفي الخرفاني',description:'الأراضي والعقارات'}],news:news.results});}
if(method==='GET'&&path==='/api/setup/status'){const row=await db.prepare("SELECT COUNT(*) n FROM users WHERE role='king'").first();return json({needsSetup:row.n===0});}
if(method==='POST'&&path==='/api/setup/king'){const b=await input(req);if(!env.SETUP_SECRET||!b||b.setup_secret!==env.SETUP_SECRET)return json({error:'رمز التهيئة غير صحيح أو لم يتم إعداده'},403);if(!b||!validText(b.username,3,40)||!validText(b.password,12,128))return json({error:'اسم مستخدم 3-40 حرف وكلمة مرور 12-128 حرف'},400);if(!/^[a-z0-9_]+$/i.test(b.username))return json({error:'اسم المستخدم أحرف إنجليزية وأرقام وشرطة سفلية فقط'},400);const row=await db.prepare('SELECT COUNT(*) n FROM users').first();if(row.n!==0)return json({error:'التهيئة مغلقة'},403);const salt=random(),id=random();try{await db.prepare("INSERT INTO users(id,username,password_hash,salt,role) VALUES (?,?,?,?, 'king')").bind(id,b.username.toLowerCase(),await derive(b.password,salt),salt).run()}catch(err){console.error('setup_king_insert_failed',err instanceof Error?err.message:String(err));return json({error:'تعذر إنشاء الحساب'},409)}await audit(db,id,'setup_king','user',id,{});return json({ok:true});}
if(method==='POST'&&path==='/api/setup/recover-owner'){const b=await input(req);if(!env.SETUP_SECRET||!b||typeof b.setup_secret!=='string'||b.setup_secret!==env.SETUP_SECRET)return json({error:'رمز الاسترداد غير صحيح'},403);if(!validText(b.password,12,128))return json({error:'كلمة المرور يجب أن تكون بين 12 و128 حرفًا'},400);const owner=await db.prepare("SELECT id FROM users WHERE username='king' AND role='king'").first();if(!owner)return json({error:'حساب الملك غير موجود'},404);const salt=random();const digest=await derive(b.password,salt);await db.prepare("UPDATE users SET password_hash=?,salt=? WHERE id=? AND role='king'").bind(digest,salt,owner.id).run();await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(owner.id).run();await db.prepare('DELETE FROM login_throttles').run();await audit(db,owner.id,'recover_owner_credentials','user',owner.id,{});return json({ok:true,message:'تم استرداد حساب الملك. سجّل الدخول بكلمة المرور الجديدة.'});}
if(method==='POST'&&path==='/api/auth/citizen/register'){
 const b=await input(req);
 if(!b||!validText(b.document_number,5,80)||!validText(b.activation_code,16,128)||!validText(b.username,3,40)||!/^[a-z0-9_]+$/i.test(b.username)||!validText(b.password,12,128)||!(b.phone==null||b.phone===''||(/^\\+?[0-9]{7,15}$/.test(b.phone))))return json({error:'تحقق من رقم الهوية ورمز التفعيل واسم المستخدم وكلمة المرور (12 حرفًا على الأقل) والجوال الاختياري'},400);
 const codeHash=await hash(b.activation_code.trim());
 const claim=await db.prepare("SELECT c.id,c.document_id,d.full_name FROM citizen_claims c JOIN documents d ON d.id=c.document_id WHERE d.number=? AND d.type IN ('national_id','residency','passport') AND d.status='valid' AND d.expires_at>=date('now') AND c.token_hash=? AND c.claimed_by IS NULL AND c.expires_at>datetime('now')").bind(b.document_number.trim(),codeHash).first();
 if(!claim)return json({error:'رقم الهوية أو الإقامة أو الجواز أو رمز التفعيل غير صحيح أو منتهي الصلاحية'},403);
 const id=random(),salt=random(),phone=b.phone?.trim()||null;
 try{await db.batch([
 db.prepare("INSERT INTO users(id,username,password_hash,salt,role) VALUES(?,?,?,?,'citizen')").bind(id,b.username.trim().toLowerCase(),await derive(b.password,salt),salt),
 db.prepare('INSERT INTO citizen_profiles(user_id,document_id,phone) VALUES(?,?,?)').bind(id,claim.document_id,phone),
 db.prepare("UPDATE citizen_claims SET claimed_by=?,claimed_at=CURRENT_TIMESTAMP WHERE id=? AND claimed_by IS NULL AND expires_at>datetime('now')").bind(id,claim.id)
 ])}catch{return json({error:'اسم المستخدم مستخدم أو الهوية مرتبطة بحساب آخر'},409)}
 await audit(db,id,'citizen_register','document',claim.document_id,{});
 return json({ok:true,message:'تم إنشاء الحساب؛ يمكنك تسجيل الدخول'},201);
}
if(method==='POST'&&path==='/api/auth/login'){let loginStage='input';try{const b=await input(req);if(!b||!validText(b.username,1,80)||typeof b.password!=='string')return json({error:'بيانات غير صالحة'},400);
 loginStage='throttle';const loginName=b.username.trim().toLowerCase();const loginKey=await hash(loginName);const lock=await db.prepare('SELECT failures,window_start,locked_until FROM login_throttles WHERE login_key=?').bind(loginKey).first();
 if(lock?.locked_until && lock.locked_until>new Date().toISOString())return json({error:'محاولات كثيرة. حاول بعد 15 دقيقة'},429,{'retry-after':'900'});
 loginStage='user_lookup';const found=await db.prepare('SELECT * FROM users WHERE username=?').bind(loginName).first();
 loginStage='password_check';if(!found||await derive(b.password,found.salt)!==found.password_hash){
  const now=new Date(),start=lock?.window_start?new Date(lock.window_start):null;const failures=start&&now-start<15*60*1000?lock.failures+1:1;
  await db.prepare('INSERT INTO login_throttles(login_key,failures,window_start,locked_until) VALUES(?,?,?,?) ON CONFLICT(login_key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until').bind(loginKey,failures,now.toISOString(),failures>=5?new Date(now.getTime()+15*60*1000).toISOString():null).run();
  return json({error:'اسم المستخدم أو كلمة المرور غير صحيحة'},401);
 }
 loginStage='session_creation';await db.prepare('DELETE FROM login_throttles WHERE login_key=?').bind(loginKey).run();const token=random()+random(),expires=new Date(Date.now()+8*3600*1000).toISOString().replace('T',' ').slice(0,19);await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),found.id,expires).run();loginStage='audit';await audit(db,found.id,'login','session',null,{});return json({ok:true,role:found.role},200,{'set-cookie':cookie(req,token,28800)});}catch(err){console.error('login_failure_stage',loginStage,err instanceof Error?err.message:String(err));return json({error:'خطأ داخلي في الخادم',stage:loginStage,code:err instanceof Error?err.name:'RuntimeError'},500);}}
if(method==='POST'&&path==='/api/auth/logout'){const t=(req.headers.get('cookie')||'').match(/saliyah_session=([a-f0-9-]+)/)?.[1];if(t)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(t)).run();return json({ok:true},200,{'set-cookie':cookie(req,'',0)});}
// Ministry accounts are isolated by ministry ID. No cross-ministry service permissions.
// Public directory of REAL fictional entities. Public numbers are stable aliases of the underlying IDs;
// no new 3,000-row backfill and no exposure of personal credentials or bot balances.
if(method==='GET'&&path==='/api/sim-directory'){
 const type=u.searchParams.get('type')||'citizens';
 const page=Math.max(1,Math.min(1000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
 const rawSearch=(u.searchParams.get('q')||'').trim().slice(0,80);
 let search=rawSearch.replace(/^SIM-[A-Z]+-/i,'');
 const phoneTypes=new Set(['citizens','companies','institutions','x','lawyers']);
 if(/^SIM-\d{9}$/i.test(rawSearch)&&phoneTypes.has(type)){
  const match=(await sharedRows(db,"SELECT target_id FROM saliyah_sim_public_phones WHERE target_type=? AND phone_number=? LIMIT 1",[type,rawSearch.toUpperCase()]))[0];
  search=match?.target_id||rawSearch;
 }
 const pattern='%'+search+'%';
 const categories={
  citizens:{code:'C',sql:"SELECT c.id,c.name,c.occupation,c.gender,c.created_at FROM saliyah_sim_citizens c WHERE (?='' OR c.name LIKE ? OR c.id LIKE ?) ORDER BY c.created_at DESC,c.id LIMIT ? OFFSET ?"},
  companies:{code:'CO',sql:"SELECT c.id,c.name,c.activity,c.location,c.capital,c.status,c.created_at,f.name founder_name,b.account_number FROM saliyah_sim_companies c LEFT JOIN saliyah_sim_citizens f ON f.id=c.founder_id LEFT JOIN saliyah_sim_bank_accounts b ON b.owner_type='company' AND b.owner_id=c.id WHERE (?='' OR c.name LIKE ? OR c.id LIKE ?) ORDER BY c.created_at DESC,c.id LIMIT ? OFFSET ?"},
  institutions:{code:'ED',sql:"SELECT i.id,i.name,i.kind,i.status,d.level,d.sector,d.tuition FROM saliyah_sim_institutions i LEFT JOIN saliyah_sim_education_details d ON d.institution_id=i.id WHERE (?='' OR i.name LIKE ? OR i.id LIKE ?) ORDER BY i.created_at DESC,i.id LIMIT ? OFFSET ?"},
  jobs:{code:'JOB',sql:"SELECT j.id,j.title,j.salary,j.status,j.company_id,c.name company_name FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE (?='' OR j.title LIKE ? OR j.id LIKE ? OR c.name LIKE ?) ORDER BY j.created_at DESC,j.id LIMIT ? OFFSET ?",companySearch:true},
  properties:{code:'PR',sql:"SELECT p.id,p.kind,p.location,p.price,p.status,p.created_at,c.name owner_name,p.owner_id FROM saliyah_sim_properties p LEFT JOIN saliyah_sim_citizens c ON c.id=p.owner_id WHERE p.owner_id NOT LIKE 'human:%' AND (?='' OR p.location LIKE ? OR p.id LIKE ?) ORDER BY p.created_at DESC,p.id LIMIT ? OFFSET ?"},
  x:{code:'X',sql:"SELECT p.id,p.handle,p.display_name name,p.bio,p.created_at,b.account_number FROM x_profiles p LEFT JOIN x_bot_bank_accounts b ON b.profile_id=p.id WHERE p.kind='bot' AND (?='' OR p.display_name LIKE ? OR p.handle LIKE ? OR p.id LIKE ?) ORDER BY p.handle LIMIT ? OFFSET ?"},
  lawyers:{code:'LAW',sql:"SELECT l.id,l.name,l.role,l.active FROM saliyah_sim_legal_bots l WHERE (?='' OR l.name LIKE ? OR l.id LIKE ?) ORDER BY l.id LIMIT ? OFFSET ?"},
  banking:{code:'ACC',sql:"SELECT a.id,a.account_number,a.bank_name,a.owner_type,COALESCE(c.name,b.name) owner_name FROM saliyah_sim_bank_accounts a LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND c.id=a.owner_id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND b.id=a.owner_id WHERE (?='' OR a.account_number LIKE ? OR COALESCE(c.name,b.name) LIKE ? OR a.id LIKE ?) ORDER BY a.account_number LIMIT ? OFFSET ?"},
  shares:{code:'SH',sql:"SELECT h.id,h.units,h.company_id,c.name company_name,p.name owner_name,h.owner_id FROM saliyah_sim_shares h JOIN saliyah_sim_companies c ON c.id=h.company_id LEFT JOIN saliyah_sim_citizens p ON p.id=h.owner_id WHERE h.owner_id NOT LIKE 'human:%' AND (?='' OR c.name LIKE ? OR h.id LIKE ?) ORDER BY h.units DESC,h.id LIMIT ? OFFSET ?"},
  projects:{code:'PROJECT',sql:"SELECT p.id,p.title,p.project_type,p.location,p.status,p.description FROM saliyah_projects p WHERE p.proposed_by='bot' AND (?='' OR p.title LIKE ? OR p.id LIKE ?) ORDER BY p.created_at DESC,p.id LIMIT ? OFFSET ?"},
  tourists:{code:'VIS',sql:"SELECT t.id,t.name,t.nationality,t.arrival_port,t.visit_purpose,t.created_at FROM saliyah_sim_tourists t WHERE (?='' OR t.name LIKE ? OR t.id LIKE ?) ORDER BY t.created_at DESC,t.id LIMIT ? OFFSET ?",aviation:true}
 };
 if(!Object.hasOwn(categories,type))return json({error:'تصنيف غير معروف'},400);
 const category=categories[type],source=category.aviation?env.AVIATION_DB:db;
 if(!source)return json({error:'قاعدة الطيران غير متصلة'},503);
 const args=(category.companySearch||type==='x'||type==='banking')?[search,pattern,pattern,pattern,31,(page-1)*30]:[search,pattern,pattern,31,(page-1)*30];
 const r=await source.prepare(category.sql).bind(...args).all();
 const rows=r.results.slice(0,30),phones=new Map();
 const phoneSourceType=phoneTypes.has(type)?type:type==='jobs'?'companies':type==='properties'||type==='shares'?'citizens':null;
 if(phoneSourceType&&rows.length){
  const refs=[...new Set(rows.map(item=>phoneSourceType==='companies'&&type==='jobs'?item.company_id:phoneSourceType==='citizens'&&type==='properties'?item.owner_id:phoneSourceType==='citizens'&&type==='shares'?item.owner_id:item.id).filter(Boolean))];
  if(refs.length){const lookups=await sharedRows(db,'SELECT target_id,phone_number,provider FROM saliyah_sim_public_phones WHERE target_type=? AND target_id IN ('+refs.map(()=>'?').join(',')+')',[phoneSourceType,...refs]);for(const row of lookups)phones.set(row.target_id,row)}
 }
 const items=rows.map(item=>{
  const ref=type==='jobs'?item.company_id:type==='properties'||type==='shares'?item.owner_id:item.id;
  const phone=phones.get(ref);
  return {...item,sim_phone_number:phone?.phone_number||null,sim_operator:phone?.provider||null,simulation_number:'SIM-'+category.code+'-'+item.id,automated:true};
 });
 return json({type,page,more:r.results.length>30,items,simulated:true});
}
if(method==='GET'&&path==='/api/simulation/economy'){
 const [properties,propertyTrades,shares,shareTrades,marriages,lifeEvents]=await Promise.all([
  db.prepare("SELECT p.*,c.name owner_name FROM saliyah_sim_properties p LEFT JOIN saliyah_sim_citizens c ON c.id=p.owner_id ORDER BY p.created_at DESC LIMIT 60").all(),
  db.prepare("SELECT t.*,p.kind property_kind,p.location property_location,s.name seller_name,b.name buyer_name FROM saliyah_sim_property_trades t LEFT JOIN saliyah_sim_properties p ON p.id=t.property_id LEFT JOIN saliyah_sim_citizens s ON s.id=t.seller_id LEFT JOIN saliyah_sim_citizens b ON b.id=t.buyer_id ORDER BY t.created_at DESC LIMIT 60").all(),
  db.prepare("SELECT h.*,c.name company_name,o.name owner_name FROM saliyah_sim_shares h LEFT JOIN saliyah_sim_companies c ON c.id=h.company_id LEFT JOIN saliyah_sim_citizens o ON o.id=h.owner_id ORDER BY h.units DESC LIMIT 60").all(),
  db.prepare("SELECT t.*,c.name company_name,s.name seller_name,b.name buyer_name FROM saliyah_sim_share_trades t LEFT JOIN saliyah_sim_companies c ON c.id=t.company_id LEFT JOIN saliyah_sim_citizens s ON s.id=t.seller_id LEFT JOIN saliyah_sim_citizens b ON b.id=t.buyer_id ORDER BY t.created_at DESC LIMIT 60").all(),
  db.prepare("SELECT m.*,a.name partner_a_name,b.name partner_b_name FROM saliyah_sim_marriages m LEFT JOIN saliyah_sim_citizens a ON a.id=m.partner_a LEFT JOIN saliyah_sim_citizens b ON b.id=m.partner_b ORDER BY m.created_at DESC LIMIT 30").all(),
  db.prepare("SELECT e.*,c.name citizen_name FROM saliyah_sim_life_events e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id ORDER BY e.created_at DESC LIMIT 30").all()
 ]);
 return json({simulation:true,properties:properties.results,property_trades:propertyTrades.results,shareholdings:shares.results,share_trades:shareTrades.results,marriages:marriages.results,life_events:lifeEvents.results});
}
if(method==='GET'&&path==='/api/simulation/security'){
 const [borders,incidents,trials]=await Promise.all([
  db.prepare("SELECT e.id,e.port,e.direction,e.inspection_status,e.created_at,c.name citizen FROM saliyah_sim_border_events e JOIN saliyah_sim_citizens c ON c.id=e.citizen_id ORDER BY e.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT i.id,i.officer,i.allegation,i.status,i.created_at,c.name suspect FROM saliyah_sim_incidents i JOIN saliyah_sim_citizens c ON c.id=i.suspect_id ORDER BY i.created_at DESC LIMIT 50").all(),
  db.prepare("SELECT t.id,t.judge,t.verdict,t.status,t.created_at,i.allegation FROM saliyah_sim_trials t JOIN saliyah_sim_incidents i ON i.id=t.incident_id ORDER BY t.created_at DESC LIMIT 50").all()
 ]);
 return json({simulation:true,border_events:borders.results,police_incidents:incidents.results,trials:trials.results});
}
if(method==='POST'&&path==='/api/admin/simulation/run'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const now=Math.floor(Date.now()/3600000);
 const previous=await (env.SIMULATION_DB||db).prepare("SELECT value FROM saliyah_sim_settings WHERE key='last_manual_run'").first();
 if(previous&&Number(previous.value)===now)return json({error:'تم تشغيل المحاكاة يدويًا هذه الساعة، انتظر الساعة التالية'},429);

 try{await runSaliyahGovernment(db,env.AVIATION_DB);await (env.SIMULATION_DB||db).prepare("INSERT INTO saliyah_sim_settings(key,value) VALUES('last_manual_run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(now)).run();await audit(db,user.id,'simulation_manual_run','simulation',String(now),{hour:now});return json({ok:true,hour:now});}
 catch(e){console.error('simulation_manual_run_failed',e);return json({error:'تعذر إكمال دورة المحاكاة',detail:String(e.message||e).slice(0,250)},500)}
}
if(method==='GET'&&path==='/api/admin/simulation/companies'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const rows=await db.prepare('SELECT * FROM saliyah_sim_companies ORDER BY created_at DESC LIMIT 100').all();
 return json({companies:rows.results});
}
if(method==='POST'&&path==='/api/admin/simulation/companies/decision'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const b=await input(req);
 if(!b||!['approved','rejected'].includes(b.decision)||typeof b.id!=='string')return json({error:'قرار غير صالح'},400);
 const result=await db.prepare("UPDATE saliyah_sim_companies SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_human'").bind(b.decision,user.id,b.id).run();
 if(!result.meta.changes)return json({error:'الشركة غير موجودة أو تمت مراجعتها'},409);
 await audit(db,user.id,'simulation_company_decision','saliyah_sim_company',b.id,{decision:b.decision});
 return json({ok:true,status:b.decision});
}
if(method==='GET'&&path==='/api/admin/simulation/projects'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const rows=await db.prepare("SELECT p.*,h.status construction_status,h.started_at construction_started_at,h.completed_at construction_completed_at,(SELECT COUNT(*) FROM saliyah_housing_units u WHERE u.project_id=p.id) housing_units FROM saliyah_projects p LEFT JOIN saliyah_housing_projects h ON h.project_id=p.id ORDER BY p.created_at DESC LIMIT 100").all();
 return json({projects:rows.results});
}
if(method==='POST'&&path==='/api/admin/simulation/projects/complete'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const b=await input(req);if(!validText(b?.id,5,120))return json({error:'حدد المشروع السكني'},400);
 const project=await db.prepare("SELECT p.id,p.title,h.status FROM saliyah_projects p JOIN saliyah_housing_projects h ON h.project_id=p.id WHERE p.id=? AND p.project_type='housing' AND p.status='approved'").bind(b.id).first();
 if(!project)return json({error:'مشروع سكني معتمد غير موجود'},404);
 if(project.status==='completed'){const count=await db.prepare('SELECT COUNT(*) n FROM saliyah_housing_units WHERE project_id=?').bind(project.id).first();return json({ok:true,status:'completed',units:count?.n||0,already_completed:true})}
 const done=await db.prepare("UPDATE saliyah_housing_projects SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='building'").bind(project.id).run();
 if(!done.meta.changes)return json({error:'حالة البناء تغيرت؛ حدث الصفحة'},409);
 const count=await db.prepare('SELECT COUNT(*) n FROM saliyah_housing_units WHERE project_id=?').bind(project.id).first();
 await audit(db,user.id,'housing_project_completed','saliyah_project',project.id,{units:count?.n||0});
 return json({ok:true,status:'completed',units:count?.n||0});
}
if(method==='POST'&&path==='/api/admin/simulation/projects/decision'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const b=await input(req);
 if(!b||!['approved','rejected'].includes(b.decision)||typeof b.id!=='string')return json({error:'قرار غير صالح'},400);
 const updated=await db.prepare("UPDATE saliyah_projects SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_human'").bind(b.decision,user.id,b.id).run();
 if(!updated.meta.changes)return json({error:'الطلب غير موجود أو تمت مراجعته'},409);
 await audit(db,user.id,'simulation_project_decision','saliyah_project',b.id,{decision:b.decision});
 return json({ok:true,status:b.decision});
}
if(method==='GET'&&path==='/api/admin/simulation/labor-cases'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const rows=await db.prepare("SELECT l.*,c.name company_name,z.name employee_name,j.title job_title FROM saliyah_sim_labor_cases l JOIN saliyah_sim_companies c ON c.id=l.company_id JOIN saliyah_sim_citizens z ON z.id=l.citizen_id JOIN saliyah_sim_jobs j ON j.id=l.job_id ORDER BY l.filed_at DESC,l.id DESC LIMIT 200").all();
 const representation=await db.prepare("SELECT r.case_id,r.side,b.id lawyer_id,b.name lawyer_name FROM saliyah_sim_labor_representation r JOIN saliyah_sim_legal_bots b ON b.id=r.lawyer_id ORDER BY r.case_id,r.side LIMIT 400").all();
 const filings=await db.prepare("SELECT f.id,f.case_id,f.side,f.filing_type,f.body,f.created_at,b.name author_name FROM saliyah_sim_labor_filings f JOIN saliyah_sim_legal_bots b ON b.id=f.author_bot_id ORDER BY f.created_at DESC LIMIT 600").all();
 return json({cases:rows.results,representation:representation.results,filings:filings.results,currency:'ريال صالي'});
}
if(method==='POST'&&path==='/api/admin/simulation/labor-cases/decision'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const b=await input(req);
 if(!b||typeof b.id!=='string'||!['under_review','resolved','rejected'].includes(b.status))return json({error:'بيانات القرار غير صالحة'},400);
 const updated=await db.prepare("UPDATE saliyah_sim_labor_cases SET status=?,resolved_at=CASE WHEN ?='under_review' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id=? AND status IN ('pending','under_review')").bind(b.status,b.status,b.id).run();
 if(!updated.meta.changes)return json({error:'القضية غير موجودة أو أُغلقت'},409);
 await audit(db,user.id,'simulation_labor_case_decision','saliyah_sim_labor_case',b.id,{status:b.status});return json({ok:true,status:b.status});
}
if(method==='GET'&&path==='/api/admin/simulation/banking'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const filter=u.searchParams.get('type')||'all';
 const q=(u.searchParams.get('q')||'').trim().slice(0,80);
 if(!['all','citizen','company'].includes(filter))return json({error:'نوع الحساب غير صحيح'},400);
 const page=Math.max(1,Math.min(10000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
 const pageSize=150;
 const offset=(page-1)*pageSize;
 const accounts=await db.prepare("SELECT a.id,a.account_number,a.bank_name,a.owner_type,a.owner_id,COALESCE(c.name,b.name,'مجهول') owner_name,a.balance,a.status,a.created_at FROM saliyah_sim_bank_accounts a LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND c.id=a.owner_id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND b.id=a.owner_id WHERE (?='all' OR a.owner_type=?) AND (?='' OR a.account_number LIKE ? OR c.name LIKE ? OR b.name LIKE ?) ORDER BY a.created_at DESC,a.id LIMIT ? OFFSET ?").bind(filter,filter,q,'%'+q+'%','%'+q+'%','%'+q+'%',pageSize,offset).all();
 const accountCount=await db.prepare("SELECT COUNT(*) n FROM saliyah_sim_bank_accounts a LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND c.id=a.owner_id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND b.id=a.owner_id WHERE (?='all' OR a.owner_type=?) AND (?='' OR a.account_number LIKE ? OR c.name LIKE ? OR b.name LIKE ?)").bind(filter,filter,q,'%'+q+'%','%'+q+'%','%'+q+'%').first();
 const companies=await db.prepare("SELECT id,name,payroll_weeks FROM saliyah_sim_companies WHERE status='approved' ORDER BY name LIMIT 150").all();
 const totals=await db.prepare("SELECT owner_type,COUNT(*) accounts,SUM(balance) balance FROM saliyah_sim_bank_accounts GROUP BY owner_type").all(); // Keep totals and account detail on the same authoritative ledger until atomic finance migration
 const transactions=await db.prepare("SELECT t.id,t.kind,t.amount,t.description,t.created_at,a.account_number,a.owner_type,COALESCE(c.name,b.name,'مجهول') owner_name FROM saliyah_sim_bank_transactions t JOIN saliyah_sim_bank_accounts a ON a.id=t.account_id LEFT JOIN saliyah_sim_citizens c ON a.owner_type='citizen' AND c.id=a.owner_id LEFT JOIN saliyah_sim_companies b ON a.owner_type='company' AND b.id=a.owner_id ORDER BY t.created_at DESC,t.id DESC LIMIT 100").all();
 return json({accounts:accounts.results,pagination:{page,page_size:pageSize,total:Number(accountCount.n),pages:Math.ceil(Number(accountCount.n)/pageSize)},companies:companies.results,totals:totals.results,transactions:transactions.results,virtual_currency:'ريال صالي',note:'حسابات المحاكاة منفصلة عن الحسابات البنكية الحقيقية'});
}
if(method==='GET'&&path==='/api/admin/simulation/citizens'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const [citizens,identities,companies,jobs,applications,enrollments,marriages,children,events,posts,profiles,projects,latest]=await Promise.all([
  db.prepare("SELECT COUNT(*) n FROM saliyah_sim_citizens").first(),
  db.prepare("SELECT status,COUNT(*) n FROM saliyah_sim_identities GROUP BY status").all(),
  db.prepare("SELECT c.id,c.name,c.activity,c.location,c.capital,c.status,c.founder_id,f.name founder_name,c.created_at FROM saliyah_sim_companies c LEFT JOIN saliyah_sim_citizens f ON f.id=c.founder_id ORDER BY c.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT j.id,j.title,j.salary,j.status,c.name company FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id ORDER BY j.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT a.id,a.status,a.created_at,c.name citizen,j.title job FROM saliyah_sim_job_applications a JOIN saliyah_sim_citizens c ON c.id=a.citizen_id JOIN saliyah_sim_jobs j ON j.id=a.job_id ORDER BY a.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT COUNT(*) n FROM saliyah_sim_enrollments").first(),
  db.prepare("SELECT COUNT(*) n FROM saliyah_sim_marriages").first(),
  db.prepare("SELECT COUNT(*) n FROM saliyah_sim_children").first(),
  db.prepare("SELECT e.id,e.citizen_id,COALESCE(c.name,'مواطن غير مسجل') AS citizen_name,e.kind AS event_type,e.description,e.created_at FROM saliyah_sim_life_events e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id ORDER BY e.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT COUNT(*) n FROM x_posts").first(),
  db.prepare("SELECT COUNT(*) n FROM x_profiles").first(),
  db.prepare("SELECT status,COUNT(*) n FROM saliyah_projects GROUP BY status").all(),
  (env.SIMULATION_DB||db).prepare("SELECT key,value FROM saliyah_sim_settings WHERE key LIKE 'last_%' OR key LIKE 'simulation_health%' ORDER BY key").all()
 ]);
 return json({ok:true,citizens:citizens.n,identities:identities.results,companies:companies.results,jobs:jobs.results,applications:applications.results,enrollments:enrollments.n,marriages:marriages.n,children:children.n,events:events.results,x_posts:posts.n,x_profiles:profiles.n,projects:projects.results,diagnostics:Object.fromEntries(latest.results.map(x=>[x.key,x.value]))});
}
if(method==='GET'&&path==='/api/simulation/diagnostics'){if(!user||user.role!=='king')return json({error:'للملك فقط'},403);const rows=await (env.SIMULATION_DB||db).prepare("SELECT key,value FROM saliyah_sim_settings WHERE key LIKE 'last_%' ORDER BY key").all();return json({ok:true,diagnostics:Object.fromEntries(rows.results.map(x=>[x.key,x.value]))})}
if(method==='GET'&&path==='/api/simulation/status'){
 const [citizens,projects]=await Promise.all([db.prepare('SELECT COUNT(*) n FROM saliyah_sim_citizens').first(),db.prepare('SELECT status,COUNT(*) n FROM saliyah_projects GROUP BY status').all()]);
 const companies=await db.prepare('SELECT status,COUNT(*) n FROM saliyah_sim_companies GROUP BY status').all();const jobs=await db.prepare('SELECT COUNT(*) n FROM saliyah_sim_jobs').first();return json({simulated_citizens:citizens.n,projects:projects.results,companies:companies.results,simulated_jobs:jobs.n,automated_ministries:botMinisters.length,human_ministries:['الخارجية','الداخلية']});
}
if(method==='GET'&&path==='/api/admin/ministries/roster'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const ministers=[...new Set(ministries.map(m=>m.minister))];
 const rows=(await db.prepare('SELECT m.ministry_id,u.username FROM ministry_accounts m JOIN users u ON u.id=m.user_id').all()).results;
 return json({ministers:ministers.map((name,i)=>({id:i,name,username:['kaslan_alomari','qondos_alomari','jeddo_albatreeqi','abu_shakhta','koob_alomari','kharfoon_alkharafi'][i],ministries:ministries.filter(m=>m.minister===name).map(m=>m.name),created:rows.some(r=>ministries[r.ministry_id]?.minister===name)}))});
}
if(method==='POST'&&path==='/api/admin/ministries/provision'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const b=await input(req);
 const ministers=[...new Set(ministries.map(m=>m.minister))];
 if(!b||!Number.isInteger(b.minister_id)||b.minister_id<0||b.minister_id>=ministers.length||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return json({error:'اختر الوزير وكلمة مرور من 12 إلى 128 حرفًا'},400);
 const owned=ministries.filter(m=>m.minister===ministers[b.minister_id]);
 const username=['kaslan_alomari','qondos_alomari','jeddo_albatreeqi','abu_shakhta','koob_alomari','kharfoon_alkharafi'][b.minister_id];
 const existing=await db.prepare('SELECT m.user_id FROM ministry_accounts m WHERE m.ministry_id=?').bind(owned[0].id).first();
 if(existing)return json({error:'حساب هذا الوزير موجود بالفعل؛ لا يمكن استبدال كلمة مروره من شاشة الإنشاء'},409);
 if(await db.prepare('SELECT id FROM users WHERE username=?').bind(username).first())return json({error:'اسم المستخدم موجود بالفعل'},409);
 const id=random(),salt=random();
 await db.prepare("INSERT INTO users(id,username,password_hash,salt,role) VALUES(?,?,?,?,'employee')").bind(id,username,await derive(b.password,salt),salt).run();
 for(const m of owned)await db.prepare('INSERT INTO ministry_accounts(ministry_id,user_id) VALUES(?,?)').bind(m.id,id).run();
 await audit(db,user.id,'provision_minister','user',id,{ministries:owned.map(m=>m.id)});
 return json({created:true,minister:ministers[b.minister_id],username,ministries:owned.map(m=>m.name)});
}
if(method==='GET'&&path==='/api/ministries/accounts'){
 if(!user||user.role!=='king')return json({error:'للملك فقط'},403);
 const r=await db.prepare("SELECT m.ministry_id,u.username,m.user_id,m.created_at FROM ministry_accounts m JOIN users u ON u.id=m.user_id ORDER BY m.ministry_id").all();
 const groups=new Map();for(const x of r.results){if(!groups.has(x.user_id))groups.set(x.user_id,{username:x.username,minister:ministries[x.ministry_id]?.minister,ministries:[]});groups.get(x.user_id).ministries.push(ministries[x.ministry_id]?.name);}
 return json({accounts:[...groups.values()]});
}
if(path.startsWith('/api/ministry-office/')){
 if(!user)return json({error:'يجب تسجيل الدخول'},401);
 const b=method==='POST'?await input(req):null;
 const assigned=user.role==='king'?ministries.map(m=>m.id):(await db.prepare('SELECT ministry_id FROM ministry_accounts WHERE user_id=? ORDER BY ministry_id').bind(user.id).all()).results.map(x=>x.ministry_id);
 const requested=method==='POST'?b?.ministry_id:u.searchParams.get('ministry_id');
 const id=requested==null||requested===''?(assigned.length===1?assigned[0]:NaN):Number(requested);
 if(method==='GET'&&path==='/api/ministry-office/ministries')return json({ministries:assigned.map(i=>ministries[i])});
 if(!assigned.includes(id))return json({error:'الوزارة ليست ضمن صلاحيات حسابك'},403);
 if(!Number.isInteger(id)||id<0||id>=ministries.length)return json({error:'ليس لديك حساب وزارة أو وزارة غير صالحة'},403);
 if(method==='GET'&&path==='/api/ministry-office/profile')return json({ministry:ministries[id],scope:'إدارة طلبات الوزارة ومراسلاتها فقط؛ لا تشمل صلاحيات جهات أخرى أو القرارات السيادية'});
 if(method==='GET'&&path==='/api/ministry-office/actions'){const r=await db.prepare('SELECT id,subject,details,status,created_at FROM ministry_actions WHERE ministry_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();return json({ministry:ministries[id],actions:r.results});
 }
 if(method==='POST'&&path==='/api/ministry-office/actions'){
  if(!b||!validText(b.subject,3,160)||!validText(b.details,0,3000)||!['draft','submitted'].includes(b.status))return json({error:'بيانات المعاملة غير صالحة'},400);
  const recordId=random();await db.prepare('INSERT INTO ministry_actions(id,ministry_id,actor_id,subject,details,status) VALUES(?,?,?,?,?,?)').bind(recordId,id,user.id,b.subject.trim(),b.details.trim(),b.status).run();await audit(db,user.id,'ministry_action','ministry',String(id),{record_id:recordId,status:b.status});return json({id:recordId},201);
 }
 return json({error:'الخدمة غير موجودة'},404);
}
if(method==='GET'&&path==='/api/me')return json({user:user||null});
if(!user)return json({error:'يجب تسجيل الدخول'},401);
if(method==='GET'&&path==='/api/citizen/profile'){
 if(user.role!=='citizen')return json({error:'الخدمة للمواطنين فقط'},403);
 const p=await db.prepare('SELECT p.phone,d.number,d.full_name FROM citizen_profiles p JOIN documents d ON d.id=p.document_id WHERE p.user_id=?').bind(user.id).first();return json({profile:p||null});
}
if(method==='POST'&&path==='/api/citizen/profile/phone'){
 if(user.role!=='citizen')return json({error:'الخدمة للمواطنين فقط'},403);
 const b=await input(req);if(!b||!(b.phone==null||b.phone===''||/^\\+?[0-9]{7,15}$/.test(b.phone)))return json({error:'رقم الجوال يجب أن يكون من 7 إلى 15 رقمًا أو فارغًا'},400);
 const phone=b.phone?.trim()||null;
 const r=await db.prepare('UPDATE citizen_profiles SET phone=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(phone,user.id).run();if(!r.meta.changes)return json({error:'ملف المواطن غير موجود'},404);
 await audit(db,user.id,'citizen_phone_update','user',user.id,{});return json({ok:true});
}
// Phase 33: account session controls.
if(method==='GET'&&path==='/api/security/sessions'){
 const current=(req.headers.get('cookie')||'').match(/(?:^|;\s*)saliyah_session=([a-f0-9-]+)/)?.[1];
 const currentHash=current?await hash(current):'';
 const rows=await db.prepare("SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=? AND expires_at>datetime('now') ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
 return json({sessions:rows.results.map(x=>({id:x.token_hash,created_at:x.created_at,expires_at:x.expires_at,current:x.token_hash===currentHash}))});
}
if(method==='POST'&&path==='/api/security/revoke'){
 const b=await input(req);if(!b||typeof b.id!=='string'||!/^[a-f0-9]{64}$/.test(b.id))return json({error:'جلسة غير صالحة'},400);
 const r=await db.prepare('DELETE FROM sessions WHERE token_hash=? AND user_id=?').bind(b.id,user.id).run();
 if(!r.meta.changes)return json({error:'الجلسة غير موجودة'},404);
 await audit(db,user.id,'revoke_session','session',null,{});
 const current=(req.headers.get('cookie')||'').match(/(?:^|;\s*)saliyah_session=([a-f0-9-]+)/)?.[1];
 return json({ok:true,selfRevoked:!!current&&await hash(current)===b.id},200,!!current&&await hash(current)===b.id?{'set-cookie':cookie(req,'',0)}:{});
}
if(method==='POST'&&path==='/api/security/revoke-others'){
 const current=(req.headers.get('cookie')||'').match(/(?:^|;\s*)saliyah_session=([a-f0-9-]+)/)?.[1];
 if(!current)return json({error:'الجلسة غير موجودة'},401);
 const r=await db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id,await hash(current)).run();
 await audit(db,user.id,'revoke_other_sessions','user',user.id,{count:r.meta.changes});return json({ok:true,count:r.meta.changes});
}


// Active service suspensions prevent starting or modifying optional services across
// banking, telecom, commerce and other citizen-facing modules. Keep authentication,
// read-only access, health, courts, complaints and debt/appeal access available.
if(user && !['GET','HEAD','OPTIONS'].includes(method)){
 const blockedPrefixes=[
  '/api/absher/','/api/commerce/','/api/land/','/api/municipality/',
  '/api/telecom/','/api/banking/','/api/pos/','/api/installments/',
  '/api/education/','/api/company/','/api/citizen/profile/phone',
  '/api/sim-market/','/api/sim-directory/payment','/api/sim-directory/contact'
 ];
 const blockedExact=new Set(['/api/requests','/api/registry/applications','/api/civil/family-cards']);
 const isBlocked=blockedPrefixes.some(prefix=>path.startsWith(prefix))||blockedExact.has(path);
 if(isBlocked){
  const hold=await db.prepare("SELECT id FROM service_suspensions_v2 WHERE subject_user_id=? AND status='active' LIMIT 1").bind(user.id).first();
  if(hold)return json({error:'الخدمات موقوفة بقرار إداري. لا يمكن إصدار حساب بنكي أو رقم اتصال أو تنفيذ خدمة جديدة حتى رفع الإيقاف. يمكنك الاطلاع على بياناتك ومراجعة القرار.',code:'SERVICE_SUSPENDED'},403);
 }
}
if(method==='GET'&&path==='/api/enforcement/my-status'){
 if(!user)return json({error:'تسجيل الدخول مطلوب'},401);
 const r=await db.prepare("SELECT id,reason,created_at,ended_at,status FROM service_suspensions_v2 WHERE subject_user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
 return json({suspensions:r.results,active:r.results.some(x=>x.status==='active')});
}
// Scoped administrative case workflow. Decisions are recorded, not executed against balances or documents.
if(path.startsWith('/api/enforcement/')){
 if(!user)return json({error:'تسجيل الدخول مطلوب'},401);
 const assigned=user.role==='king'?[1,3,7]:(await db.prepare('SELECT ministry_id FROM ministry_accounts WHERE user_id=? AND ministry_id IN (1,3,7)').bind(user.id).all()).results.map(x=>x.ministry_id);
 if(!assigned.length)return json({error:'الخدمة للملك ووزارات الداخلية والعدل والمالية'},403);
 if(method==='GET'&&path==='/api/enforcement/cases'){
  const r=await db.prepare("SELECT e.*,u.username subject_username FROM enforcement_cases_v2 e JOIN users u ON u.id=e.subject_user_id ORDER BY e.created_at DESC LIMIT 100").all();
  const h=await db.prepare("SELECT s.*,u.username subject_username,e.action case_action,d.status debt_status,d.remaining_amount debt_remaining FROM service_suspensions_v2 s JOIN users u ON u.id=s.subject_user_id JOIN enforcement_cases_v2 e ON e.id=s.case_id LEFT JOIN debt_claims d ON d.case_id=s.case_id ORDER BY s.created_at DESC LIMIT 100").all();
  const cases=user.role==='king'?r.results:r.results.filter(x=>assigned.includes(x.ministry_id));
  const suspensions=user.role==='king'?h.results:h.results.filter(x=>assigned.includes(x.ministry_id));
  return json({cases,suspensions,ministries:assigned});
 }
 if(method==='GET'&&path==='/api/enforcement/debts'){
  const rows=await db.prepare("SELECT d.*,u.username subject_username FROM debt_claims d JOIN users u ON u.id=d.subject_user_id ORDER BY d.created_at DESC LIMIT 100").all();
  if(user.role!=='king')return json({error:'سجل التحصيل للملك فقط'},403);
  return json({debts:rows.results});
 }
 if(method==='POST'&&path==='/api/enforcement/cases'){
  const b=await input(req);
  const target=String(b?.subject_identifier||'').trim();
  const action=String(b?.action||'');
  const amount=action==='service_suspension'?0:Number(b?.amount||0);
  if(!validText(target,3,100)||!['debt','service_suspension','both'].includes(action)||!Number.isSafeInteger(amount)||amount<0||amount>100000000||((action==='debt'||action==='both')&&amount===0)||!validText(b?.reason,10,500)||!assigned.includes(Number(b?.ministry_id)))return json({error:'تحقق من اسم المستخدم أو رقم الوثيقة ونوع الإجراء والمبلغ والسبب والوزارة'},400);
  const subject=await db.prepare("SELECT u.id, (SELECT d.id FROM documents d JOIN citizen_profiles p ON p.document_id=d.id WHERE p.user_id=u.id ORDER BY d.created_at DESC LIMIT 1) document_id,(SELECT d.number FROM documents d JOIN citizen_profiles p ON p.document_id=d.id WHERE p.user_id=u.id ORDER BY d.created_at DESC LIMIT 1) document_number FROM users u WHERE lower(u.username)=lower(?) OR EXISTS(SELECT 1 FROM citizen_profiles p JOIN documents d ON d.id=p.document_id WHERE p.user_id=u.id AND (d.number=? OR d.id=?)) LIMIT 1").bind(target,target,target).first();
  if(!subject)return json({error:'لم يُعثر على مستخدم مرتبط بهذا الاسم أو رقم الوثيقة'},404);
  if(subject.id===user.id)return json({error:'لا يمكن فتح قضية على حسابك'},403);
  const id=random();
  try{await db.prepare("INSERT INTO enforcement_cases_v2(id,subject_user_id,document_id,residency_number,amount,reason,ministry_id,created_by,status,action) VALUES(?,?,?,?,?,?,?,?,'pending',?)").bind(id,subject.id,subject.document_id,subject.document_number||target,amount,b.reason.trim(),Number(b.ministry_id),user.id,action).run();}catch{return json({error:'تعذر تسجيل المعاملة. تحقق من تطبيق ترحيلات قاعدة البيانات أو تواصل مع الإدارة'},409)}
  await audit(db,user.id,'enforcement_case_opened','enforcement_case',id,{amount,action,ministry_id:Number(b.ministry_id)});
  return json({id,status:'pending'},201);
 }
 if(method==='POST'&&path==='/api/enforcement/decision'){
  if(user.role!=='king')return json({error:'القرار النهائي للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected'].includes(b.decision))return json({error:'قرار غير صالح'},400);
  const c=await db.prepare("SELECT * FROM enforcement_cases_v2 WHERE id=? AND status='pending'").bind(b.id).first();
  if(!c)return json({error:'القضية غير موجودة أو صدر قرار سابق'},409);
  const updates=[db.prepare("UPDATE enforcement_cases_v2 SET status=?,decided_by=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(b.decision,user.id,b.id)];
  const collect=b.decision==='approved'&&['debt','both'].includes(c.action);
  if(collect){
   const existing=await db.prepare("SELECT id FROM debt_claims WHERE subject_user_id=? AND status='active' LIMIT 1").bind(c.subject_user_id).first();
   if(existing)return json({error:'توجد مطالبة مالية نشطة لهذا المستخدم. أغلقها أو سدّدها أولًا لتجنب التحصيل المكرر'},409);
   updates.push(db.prepare("INSERT INTO debt_claims(id,case_id,subject_user_id,original_amount,remaining_amount,status,created_by) VALUES(?,?,?,?,?,'active',?)").bind(random(),c.id,c.subject_user_id,c.amount,c.amount,user.id));
  }
  const suspend=b.decision==='approved'&&['service_suspension','both'].includes(c.action);
  if(suspend)updates.push(db.prepare("INSERT INTO service_suspensions_v2(id,case_id,subject_user_id,ministry_id,reason,status,created_by) VALUES(?,?,?,?,?,'active',?)").bind(random(),c.id,c.subject_user_id,c.ministry_id,c.reason,user.id));
  try{await db.batch(updates)}catch{return json({error:'تعذر اعتماد القرار. تحقق من جاهزية جداول الإيقاف'},409)}
  await audit(db,user.id,'enforcement_case_decision','enforcement_case',b.id,{decision:b.decision,suspension_activated:suspend,collection_activated:collect});
  return json({status:b.decision,suspension_activated:suspend,collection_activated:collect,note:suspend?'تم تفعيل إيقاف الخدمات الاختيارية المحددة':'تم تسجيل القرار'});
 }
 if(method==='POST'&&path==='/api/enforcement/reconcile'){
  if(user.role!=='king')return json({error:'رفع الإيقاف التلقائي بعد السداد للملك فقط'},403);
  // Keep independent court-ordered suspensions: only "both" cases with a fully paid debt qualify.
  const eligible="FROM service_suspensions_v2 s JOIN enforcement_cases_v2 c ON c.id=s.case_id JOIN debt_claims d ON d.case_id=s.case_id WHERE s.status='active' AND c.action='both' AND d.status='paid' AND d.remaining_amount=0";
  try{
   const statements=[
    db.prepare("INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,details) SELECT lower(hex(randomblob(16))),?,'service_suspension_auto_lifted','service_suspension',s.id,json_object('reason','paid_debt','case_id',s.case_id) "+eligible).bind(user.id),
    db.prepare("UPDATE service_suspensions_v2 SET status='lifted',ended_at=CURRENT_TIMESTAMP,ended_by=?,lift_reason='سداد المديونية بالكامل - رفع آلي' WHERE status='active' AND EXISTS(SELECT 1 FROM enforcement_cases_v2 c JOIN debt_claims d ON d.case_id=c.id WHERE c.id=service_suspensions_v2.case_id AND c.action='both' AND d.status='paid' AND d.remaining_amount=0)").bind(user.id)
   ];
   const outcomes=await db.batch(statements);
   return json({ok:true,lifted:Number(outcomes[1]?.meta?.changes||0)});
  }catch(e){console.error('enforcement_auto_lift_failed',String(e).slice(0,180));return json({error:'تعذر مزامنة الإيقافات مع المديونيات المسددة'},503)}
 }
 if(method==='POST'&&path==='/api/enforcement/lift'){
  if(user.role!=='king')return json({error:'رفع الإيقاف للملك فقط'},403);
  const b=await input(req);if(!validText(b?.id,10,80)||!validText(b?.reason,5,500))return json({error:'حدد الإيقاف وسبب الرفع'},400);
  const r=await db.prepare("UPDATE service_suspensions_v2 SET status='lifted',ended_at=CURRENT_TIMESTAMP,ended_by=?,lift_reason=? WHERE id=? AND status='active'").bind(user.id,b.reason.trim(),b.id).run();
  if(!r.meta.changes)return json({error:'الإيقاف غير موجود أو مرفوع مسبقًا'},409);
  await audit(db,user.id,'service_suspension_lifted','service_suspension',b.id,{reason:b.reason.trim()});
  return json({status:'lifted'});
 }
 return json({error:'المسار غير متاح'},404);
}

const can=async permission=>user.role==='king'||!!(await db.prepare('SELECT 1 FROM staff_permissions WHERE user_id=? AND permission=?').bind(user.id,permission).first());

// Human and bot accounts share ONE D1 transaction boundary for simulated transfers,
// stock purchases and property sales. Database triggers validate and apply mutations atomically.
if(method==='GET'&&path==='/api/sim-market'){
 const companies=await db.prepare("WITH eligible AS (SELECT h.company_id,h.owner_id,h.units,a.balance,ROW_NUMBER() OVER(PARTITION BY h.company_id ORDER BY h.units DESC,h.id) rn FROM saliyah_sim_shares h JOIN saliyah_sim_bank_accounts a ON a.owner_type='citizen' AND a.owner_id=h.owner_id AND a.status='active' WHERE h.units>0) SELECT c.id,c.name,c.activity,c.location,c.capital,c.status,MAX(1,CAST(ROUND(c.capital/1000.0) AS INTEGER)) unit_price,e.owner_id counterparty_id,e.units available_units,e.balance bot_bid_balance FROM saliyah_sim_companies c LEFT JOIN eligible e ON e.company_id=c.id AND e.rn=1 WHERE c.status='approved' ORDER BY c.name LIMIT 100").all();
 const portfolio=user?(await db.prepare("SELECT h.company_id,c.name company_name,h.units,MAX(1,CAST(ROUND(c.capital/1000.0) AS INTEGER)) unit_price FROM saliyah_sim_shares h JOIN saliyah_sim_companies c ON c.id=h.company_id WHERE h.owner_id=? AND h.units>0 ORDER BY c.name").bind('human:'+user.id).all()).results:[];
 const accounts=user?(await db.prepare('SELECT id,bank,balance FROM bank_accounts WHERE user_id=? ORDER BY bank').bind(user.id).all()).results:[];
 const trades=user?(await db.prepare("SELECT t.id,t.company_id,c.name company_name,t.direction,t.units,t.unit_price,t.created_at,b.name counterparty_name FROM saliyah_market_trades t JOIN saliyah_sim_companies c ON c.id=t.company_id LEFT JOIN saliyah_sim_citizens b ON b.id=t.bot_owner_id WHERE t.user_id=? ORDER BY t.created_at DESC,t.id DESC LIMIT 35").bind(user.id).all()).results:[];
 return json({companies:companies.results.map(c=>({...c,bot_bid_balance:undefined,buyback_units:Math.floor(Number(c.bot_bid_balance||0)/Number(c.unit_price)),simulated:true,registry_number:'SIM-CO-'+c.id})),portfolio,accounts,trades,simulated:true});
}
if(method==='POST'&&path==='/api/sim-market/trade'){
 if(!user)return json({error:'سجل الدخول لتداول الأسهم الصالية'},401);
 const b=await input(req);
 if(!b||!['buy','sell'].includes(b.direction)||!validText(b.company_id,5,120)||!validText(b.account_id,10,80)||!validText(b.counterparty_id,5,120)||!Number.isSafeInteger(b.units)||b.units<1||b.units>1000)return json({error:'بيانات صفقة الأسهم غير صالحة'},400);
 const company=await db.prepare("SELECT id,MAX(1,CAST(ROUND(capital/1000.0) AS INTEGER)) unit_price FROM saliyah_sim_companies WHERE id=? AND status='approved'").bind(b.company_id).first();
 if(!company)return json({error:'الشركة غير مدرجة أو غير متاحة'},404);
 const id=random();
 try{await db.prepare('INSERT INTO saliyah_market_trades(id,company_id,user_id,user_account_id,bot_owner_id,direction,units,unit_price) VALUES(?,?,?,?,?,?,?,?)').bind(id,company.id,user.id,b.account_id,b.counterparty_id,b.direction,b.units,company.unit_price).run()}
 catch(e){console.error('sim_stock_trade_rejected',String(e).slice(0,120));return json({error:'تعذرت الصفقة: تأكد من الرصيد والأسهم المتاحة والطرف المقابل، ثم حدّث الأسعار'},409)}
 await audit(db,user.id,'sim_stock_'+b.direction,'saliyah_market_trade',id,{company_id:company.id,units:b.units,unit_price:company.unit_price});
 return json({ok:true,id,units:b.units,unit_price:company.unit_price,total:b.units*company.unit_price,simulated:true},201);
}
if(method==='GET'&&path==='/api/sim-market/my-properties'){
 if(!user)return json({error:'سجل الدخول لعرض عقاراتك'},401);
 const rows=await db.prepare("SELECT p.id,p.kind,p.location,p.price,p.status,p.sold_at,h.unit_number,h.unit_type,h.area_sqm,h.bedrooms,h.bathrooms,h.parking,h.floor,h.features,pr.title project_name,t.price purchase_price,t.created_at purchased_at FROM saliyah_sim_properties p LEFT JOIN saliyah_housing_units h ON h.property_id=p.id LEFT JOIN saliyah_projects pr ON pr.id=h.project_id LEFT JOIN saliyah_sim_public_property_trades t ON t.property_id=p.id AND t.user_id=? WHERE p.owner_id=? ORDER BY p.sold_at DESC,p.id LIMIT 200").bind(user.id,'human:'+user.id).all();
 return json({properties:rows.results,count:rows.results.length,simulated:true});
}
if(method==='GET'&&path==='/api/sim-market/properties'){
 const listed=await db.prepare("SELECT p.id,p.kind,p.location,p.price,p.created_at,p.owner_id,c.name seller_name,h.project_id,h.unit_number,h.unit_type,h.area_sqm,h.bedrooms,h.bathrooms,h.parking,h.floor,h.features,pr.title project_name,build.status construction_status FROM saliyah_sim_properties p JOIN saliyah_sim_citizens c ON c.id=p.owner_id JOIN saliyah_sim_bank_accounts b ON b.owner_type='citizen' AND b.owner_id=p.owner_id AND b.status='active' LEFT JOIN saliyah_housing_units h ON h.property_id=p.id LEFT JOIN saliyah_projects pr ON pr.id=h.project_id LEFT JOIN saliyah_housing_projects build ON build.project_id=h.project_id WHERE p.status='listed' ORDER BY p.created_at DESC,p.id LIMIT 100").all();
 const mine=user?(await db.prepare("SELECT p.id,p.kind,p.location,p.price,p.status,h.unit_number,h.unit_type,h.area_sqm,h.bedrooms,h.bathrooms,h.parking,h.floor,h.features,pr.title project_name FROM saliyah_sim_properties p LEFT JOIN saliyah_housing_units h ON h.property_id=p.id LEFT JOIN saliyah_projects pr ON pr.id=h.project_id WHERE p.owner_id=? ORDER BY p.created_at DESC LIMIT 100").bind('human:'+user.id).all()).results:[];
 const bots=await db.prepare("SELECT t.id,t.price,t.created_at,p.kind,p.location,u.name buyer_name,s.name seller_name FROM saliyah_sim_bot_property_purchases t JOIN saliyah_sim_properties p ON p.id=t.property_id JOIN saliyah_sim_citizens u ON u.id=t.buyer_id JOIN saliyah_sim_citizens s ON s.id=t.seller_id ORDER BY t.created_at DESC LIMIT 20").all();
 return json({listed:listed.results.map(x=>({...x,registration_number:'SIM-PR-'+x.id})),mine,botPurchases:bots.results,simulated:true});
}
if(method==='POST'&&path==='/api/sim-market/property/buy'){
 if(!user)return json({error:'سجل الدخول لشراء العقارات'},401);
 const b=await input(req);
 if(!b||!validText(b.property_id,5,120)||!validText(b.account_id,10,80))return json({error:'بيانات شراء العقار غير صالحة'},400);
 const property=await db.prepare("SELECT id,owner_id,price FROM saliyah_sim_properties WHERE id=? AND status='listed' AND owner_id NOT LIKE 'human:%'").bind(b.property_id).first();
 if(!property)return json({error:'العقار غير معروض للبيع'},404);
 const id=random();
 try{await db.prepare('INSERT INTO saliyah_sim_public_property_trades(id,property_id,user_id,user_account_id,seller_id,price) VALUES(?,?,?,?,?,?)').bind(id,property.id,user.id,b.account_id,property.owner_id,property.price).run()}
 catch{return json({error:'تعذر الشراء؛ تحقق من الرصيد وتوفر العقار ثم أعد المحاولة'},409)}
 await audit(db,user.id,'sim_property_buy','saliyah_sim_public_property_trade',id,{property_id:property.id,price:property.price});
 return json({ok:true,id,property_id:property.id,price:property.price,simulated:true},201);
}
if(method==='POST'&&path==='/api/sim-directory/payment'){
 if(!user)return json({error:'سجل الدخول للتحويل إلى حساب افتراضي'},401);
 const b=await input(req);
 if(!b||!validText(b.account_id,10,80)||!validText(b.recipient_account_number,8,80)||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>100000000||typeof (b.memo??'')!=='string'||String(b.memo??'').length>200)return json({error:'بيانات التحويل غير صالحة'},400);
 const recipient=await db.prepare("SELECT id FROM saliyah_sim_bank_accounts WHERE account_number=? AND status='active'").bind(b.recipient_account_number.trim()).first();
 if(!recipient)return json({error:'حساب البوت غير موجود أو غير نشط'},404);
 const id=random();
 try{await db.prepare('INSERT INTO saliyah_sim_public_payments(id,user_id,from_account_id,recipient_account_id,amount,memo) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.account_id,recipient.id,b.amount,String(b.memo||'').trim()).run()}
 catch{return json({error:'تعذر التحويل؛ تأكد من ملكية الحساب والرصيد'},409)}
 await audit(db,user.id,'sim_bot_payment','saliyah_sim_public_payment',id,{recipient:recipient.id,amount:b.amount});
 return json({ok:true,id,amount:b.amount,simulated:true},201);
}
if(method==='GET'&&path==='/api/sim-directory/contacts'){
 if(!user)return json({error:'سجل الدخول لعرض رسائلك'},401);
 const [messages,payments]=await Promise.all([
  db.prepare('SELECT id,target_type,target_id,message,status,bot_reply,created_at,replied_at FROM saliyah_sim_public_contacts WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 80').bind(user.id).all(),
  db.prepare("SELECT p.id,p.amount,p.memo,p.created_at,a.account_number FROM saliyah_sim_public_payments p JOIN saliyah_sim_bank_accounts a ON a.id=p.recipient_account_id WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 50").bind(user.id).all()
 ]);
 return json({messages:messages.results,payments:payments.results,simulated:true});
}
if(method==='POST'&&path==='/api/sim-directory/contact'){
 if(!user)return json({error:'سجل الدخول لمراسلة السكان والمؤسسات'},401);
 const b=await input(req);
 const sources={
  citizens:"SELECT 1 FROM saliyah_sim_citizens WHERE id=?",
  companies:"SELECT 1 FROM saliyah_sim_companies WHERE id=?",
  institutions:"SELECT 1 FROM saliyah_sim_institutions WHERE id=?",
  jobs:"SELECT 1 FROM saliyah_sim_jobs WHERE id=?",
  x:"SELECT 1 FROM x_profiles WHERE id=? AND kind='bot'",
  lawyers:"SELECT 1 FROM saliyah_sim_legal_bots WHERE id=?",
  properties:"SELECT 1 FROM saliyah_sim_properties WHERE id=? AND owner_id NOT LIKE 'human:%'",
  tourists:"SELECT 1 FROM saliyah_sim_tourists WHERE id=?",
  projects:"SELECT 1 FROM saliyah_projects WHERE id=? AND proposed_by='bot'",
  banking:"SELECT 1 FROM saliyah_sim_bank_accounts WHERE id=?",
  shares:"SELECT 1 FROM saliyah_sim_shares WHERE id=?"
 };
 if(!b||!Object.hasOwn(sources,b.type)||!validText(b.id,5,120)||!validText(b.message,5,1000))return json({error:'الجهة أو الرسالة غير صالحة'},400);
 const source=b.type==='tourists'?env.AVIATION_DB:db;
 if(!source)return json({error:'قاعدة السياح غير متصلة'},503);
 if(!(await source.prepare(sources[b.type]).bind(b.id).first()))return json({error:'الكيان الافتراضي غير موجود'},404);
 const sent=await db.prepare("SELECT COUNT(*) n FROM saliyah_sim_public_contacts WHERE user_id=? AND created_at>=datetime('now','-1 day')").bind(user.id).first();
 if(Number(sent.n)>=20)return json({error:'الحد اليومي 20 رسالة لحماية D1 من الاستنزاف'},429);
 const id=random();
 await db.prepare('INSERT INTO saliyah_sim_public_contacts(id,user_id,target_type,target_id,message) VALUES(?,?,?,?,?)').bind(id,user.id,b.type,b.id,b.message.trim()).run();
 await audit(db,user.id,'sim_contact_send','saliyah_sim_public_contact',id,{type:b.type,target_id:b.id});
 return json({ok:true,id,status:'pending_bot',simulated:true},201);
}


// Phase 36: private deployment readiness diagnostics (king only; read-only).
if(method==='GET'&&path==='/api/admin/readiness'){
 if(user.role!=='king')return json({error:'هذه الصفحة للملك فقط'},403);
 const checks=[];
 const check=async(key,label,sql)=>{
  try{const r=await db.prepare(sql).first();checks.push({key,label,ok:true,value:Number(r?.n??0)});}
  catch(e){checks.push({key,label,ok:false,error:'الجدول غير جاهز أو تعذر الاستعلام'});}
 };
 await check('users','حسابات المستخدمين','SELECT COUNT(*) n FROM users');
 await check('staff','صلاحيات الموظفين','SELECT COUNT(*) n FROM staff_permissions');
 await check('banks','الحسابات البنكية','SELECT COUNT(*) n FROM bank_accounts');
 await check('courts','القضايا القضائية','SELECT COUNT(*) n FROM court_cases');
 await check('companies','الشركات','SELECT COUNT(*) n FROM commerce_companies');
 await check('support','تذاكر خدمة المواطنين','SELECT COUNT(*) n FROM service_tickets');
 await check('audit','سجلات التدقيق','SELECT COUNT(*) n FROM audit_log');
 const structural=async(key,label,sql,expected=1)=>{
  try{const r=await db.prepare(sql).first();const count=Number(r?.n||0);checks.push({key,label,ok:count>=expected,value:count,expected});}
  catch{checks.push({key,label,ok:false,error:'تعذر التحقق من بنية قاعدة البيانات'});}
 };
 await structural('transfer_debit_credit','مشغل تحويل الأموال','SELECT COUNT(*) n FROM sqlite_master WHERE type=\'trigger\' AND name=\'bank_transfer_apply\'');
 await structural('transfer_guard','حماية التحويل من السحب الزائد','SELECT COUNT(*) n FROM sqlite_master WHERE type=\'trigger\' AND name=\'bank_transfer_validate\'');
 await structural('enforcement_actions','حقل أنواع إجراءات المديونيات','SELECT COUNT(*) n FROM pragma_table_info(\'enforcement_cases_v2\') WHERE name=\'action\'');
 await structural('enforcement_zero_amount','دعم إيقاف الخدمات بدون مديونية',"SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='enforcement_cases_v2' AND sql LIKE '%amount>=0%'");
 await structural('enforcement_optional_document','دعم المستخدمين دون وثيقة',"SELECT COUNT(*) n FROM pragma_table_info('enforcement_cases_v2') WHERE name='document_id' AND [notnull]=0");
 await structural('x_auto_payout_preferences','تفضيلات الصرف التلقائي لإكس الصالية',"SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='x_creator_payout_preferences'");
 await structural('x_bot_bank_accounts','الحسابات البنكية الافتراضية للبوتات',"SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='x_bot_bank_accounts'");
 await structural('x_bot_bank_ledger','سجل الحركات البنكية للبوتات',"SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='x_bot_bank_ledger'");
 await structural('x_auto_payout_account_guard','حماية ملكية حساب أرباح إكس',"SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND name='x_creator_payout_preference_ownership'");
 return json({checks,bindings:{database:true,assets:!!env.ASSETS,court_files:!!env.COURT_FILES},
  environment:'فحص بنيوي محدود؛ لا يثبت الأمان أو نجاح العمليات أو جاهزية الإطلاق',
  ready_for_public_launch:false});
}



// Phase 32: private company employment and payroll (fictional balances).
if(path.startsWith('/api/company/staff')){
 if(method==='GET'&&path==='/api/company/staff'){
  const companies=await db.prepare("SELECT c.id,c.name,t.balance FROM commerce_companies c JOIN company_treasuries t ON t.company_id=c.id WHERE c.owner_id=? AND c.status='approved' ORDER BY c.name").bind(user.id).all();
  const rows=await db.prepare("SELECT e.*,c.name company_name,c.owner_id,u.username employee_name FROM company_employees e JOIN commerce_companies c ON c.id=e.company_id JOIN users u ON u.id=e.employee_id WHERE c.owner_id=? OR e.employee_id=? ORDER BY e.created_at DESC LIMIT 150").bind(user.id,user.id).all();
  const payments=await db.prepare("SELECT p.*,e.employee_id,c.name company_name,u.username employee_name FROM company_salary_payments p JOIN company_employees e ON e.id=p.employment_id JOIN commerce_companies c ON c.id=e.company_id JOIN users u ON u.id=e.employee_id WHERE c.owner_id=? OR e.employee_id=? ORDER BY p.created_at DESC LIMIT 100").bind(user.id,user.id).all();
  return json({companies:companies.results,employees:rows.results,payments:payments.results});
 }
 if(method==='POST'&&path==='/api/company/staff/offer'){
  const b=await input(req);const salary=Number(b?.salary);
  if(!b||!validText(b.company_id,10,80)||!validText(b.username,3,40)||!validText(b.position,3,120)||!Number.isSafeInteger(salary)||salary<1||salary>1000000)return json({error:'بيانات عرض العمل غير صالحة'},400);
  const c=await db.prepare("SELECT id FROM commerce_companies WHERE id=? AND owner_id=? AND status='approved' AND EXISTS(SELECT 1 FROM company_treasuries WHERE company_id=?)").bind(b.company_id,user.id,b.company_id).first();
  const target=await db.prepare('SELECT id FROM users WHERE username=?').bind(b.username.toLowerCase()).first();
  if(!c||!target||target.id===user.id)return json({error:'الشركة أو الموظف غير متاح'},400);
  const id=random();try{await db.prepare('INSERT INTO company_employees(id,company_id,employee_id,position,salary) VALUES(?,?,?,?,?)').bind(id,c.id,target.id,b.position.trim(),salary).run()}catch{return json({error:'يوجد عرض أو عقد نشط لهذا الموظف'},409)}
  await audit(db,user.id,'company_offer','employment',id,{company_id:c.id});return json({ok:true,id});
 }
 if(method==='POST'&&path==='/api/company/staff/respond'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['active','declined'].includes(b.status))return json({error:'قرار غير صالح'},400);
  const r=await db.prepare("UPDATE company_employees SET status=?,accepted_at=CASE WHEN ?='active' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND employee_id=? AND status='offered'").bind(b.status,b.status,b.id,user.id).run();
  if(!r.meta.changes)return json({error:'العرض غير موجود أو تمت معالجته'},409);
  await audit(db,user.id,'company_offer_response','employment',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/company/staff/end'){
  const b=await input(req);if(!b||!validText(b.id,10,80))return json({error:'عقد غير صالح'},400);
  const r=await db.prepare("UPDATE company_employees SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('offered','active') AND (employee_id=? OR company_id IN (SELECT id FROM commerce_companies WHERE owner_id=?))").bind(b.id,user.id,user.id).run();
  if(!r.meta.changes)return json({error:'لا يمكن إنهاء العقد'},409);
  await audit(db,user.id,'company_employment_end','employment',b.id,{});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/company/staff/pay'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||typeof b.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.period))return json({error:'الفترة أو العقد غير صالح'},400);
  const e=await db.prepare("SELECT e.salary FROM company_employees e JOIN commerce_companies c ON c.id=e.company_id WHERE e.id=? AND c.owner_id=? AND e.status='active'").bind(b.id,user.id).first();
  if(!e)return json({error:'العقد غير نشط أو غير مخول'},403);
  const id=random();try{await db.prepare('INSERT INTO company_salary_payments(id,employment_id,period,amount,actor_id) VALUES(?,?,?,?,?)').bind(id,b.id,b.period,e.salary,user.id).run()}catch{return json({error:'تعذر صرف الراتب: قد يكون مصروفًا أو الرصيد غير كافٍ أو الموظف بلا حساب بنكي'},409)}
  await audit(db,user.id,'company_salary_paid','employment',b.id,{period:b.period,amount:e.salary});return json({ok:true,id});
 }
}

// Phase 31: fictional company treasury with atomic D1 ledger triggers.
if(path.startsWith('/api/commerce/treasury')){
 if(method==='GET'&&path==='/api/commerce/treasury'){
  const companies=await db.prepare("SELECT c.id,c.name,t.balance FROM commerce_companies c LEFT JOIN company_treasuries t ON t.company_id=c.id WHERE c.owner_id=? AND c.status='approved' ORDER BY c.name").bind(user.id).all();
  const accounts=await db.prepare('SELECT id,bank,balance FROM bank_accounts WHERE user_id=? ORDER BY bank').bind(user.id).all();
  const movements=await db.prepare('SELECT m.id,m.company_id,m.kind,m.amount,m.created_at,c.name company_name,a.bank FROM company_treasury_movements m JOIN commerce_companies c ON c.id=m.company_id JOIN bank_accounts a ON a.id=m.personal_account_id WHERE m.actor_id=? ORDER BY m.created_at DESC LIMIT 100').bind(user.id).all();
  return json({companies:companies.results,accounts:accounts.results,movements:movements.results});
 }
 if(method==='POST'&&path==='/api/commerce/treasury/open'){
  const b=await input(req);if(!b||!validText(b.company_id,10,80))return json({error:'شركة غير صالحة'},400);
  const c=await db.prepare("SELECT id FROM commerce_companies WHERE id=? AND owner_id=? AND status='approved'").bind(b.company_id,user.id).first();if(!c)return json({error:'الشركة غير معتمدة أو ليست ملكك'},403);
  await db.prepare('INSERT OR IGNORE INTO company_treasuries(company_id) VALUES(?)').bind(c.id).run();await audit(db,user.id,'treasury_open','company',c.id,{});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/commerce/treasury/move'){
  const b=await input(req);const amount=Number(b?.amount);
  if(!b||!validText(b.company_id,10,80)||!validText(b.account_id,10,80)||!['fund','withdraw'].includes(b.kind)||!Number.isSafeInteger(amount)||amount<1||amount>1000000)return json({error:'بيانات الحركة غير صالحة'},400);
  const id=random();try{await db.prepare('INSERT INTO company_treasury_movements(id,company_id,personal_account_id,actor_id,kind,amount) VALUES(?,?,?,?,?,?)').bind(id,b.company_id,b.account_id,user.id,b.kind,amount).run()}catch{return json({error:'تعذر التحويل: تحقق من الملكية والرصيد وحساب الشركة'},409)}
  await audit(db,user.id,'treasury_'+b.kind,'treasury_movement',id,{company_id:b.company_id,amount});return json({id},201);
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 30: company branches, with municipal permit checks and independent review.
if(path.startsWith('/api/commerce/branches')){
 const registrar=await can('commerce');
 if(method==='GET'&&path==='/api/commerce/branches'){
  const rows=registrar?await db.prepare('SELECT b.*,c.name company_name,u.username owner FROM commerce_branches b JOIN commerce_companies c ON c.id=b.company_id JOIN users u ON u.id=c.owner_id ORDER BY b.created_at DESC LIMIT 200').all():await db.prepare('SELECT b.*,c.name company_name,u.username owner FROM commerce_branches b JOIN commerce_companies c ON c.id=b.company_id JOIN users u ON u.id=c.owner_id WHERE c.owner_id=? ORDER BY b.created_at DESC LIMIT 100').bind(user.id).all();
  const companies=await db.prepare("SELECT id,name FROM commerce_companies WHERE owner_id=? AND status='approved' ORDER BY name").bind(user.id).all();
  const permits=await db.prepare("SELECT id,business_name,region FROM municipal_permits WHERE owner_id=? AND status='approved' ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
  return json({branches:rows.results,companies:companies.results,permits:permits.results,can_manage:registrar});
 }
 if(method==='POST'&&path==='/api/commerce/branches'){
  const b=await input(req);if(!b||!validText(b.company_id,10,80)||!validText(b.name,3,120)||!validText(b.address,5,240)||!['السجادة','المتجار','عقار'].includes(b.region)||b.permit_id&&!validText(b.permit_id,10,80))return json({error:'بيانات الفرع غير صالحة'},400);
  const company=await db.prepare("SELECT id FROM commerce_companies WHERE id=? AND owner_id=? AND status='approved'").bind(b.company_id,user.id).first();if(!company)return json({error:'الشركة غير معتمدة أو لا تملكها'},403);
  const permit=b.permit_id||null;
  if(permit){const ok=await db.prepare("SELECT 1 FROM municipal_permits WHERE id=? AND owner_id=? AND status='approved' AND region=?").bind(permit,user.id,b.region).first();if(!ok)return json({error:'الرخصة البلدية لا تطابق الفرع'},409)}
  const id=random();try{await db.prepare('INSERT INTO commerce_branches(id,company_id,name,region,address,permit_id) VALUES(?,?,?,?,?,?)').bind(id,b.company_id,b.name.trim(),b.region,b.address.trim(),permit).run()}catch{return json({error:'تعذر تسجيل الفرع أو يوجد فرع بنفس الاسم'},409)}
  await audit(db,user.id,'commerce_branch_apply','commerce_branch',id,{company_id:b.company_id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/commerce/branches/decision'){
  if(!registrar)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected'].includes(b.status)||!validText(b.note,5,1000))return json({error:'بيانات القرار غير صالحة'},400);
  const result=await db.prepare("UPDATE commerce_branches SET status=?,review_note=?,reviewer_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM commerce_companies c WHERE c.id=commerce_branches.company_id AND c.status='approved' AND c.owner_id!=? AND (commerce_branches.permit_id IS NULL OR EXISTS(SELECT 1 FROM municipal_permits p WHERE p.id=commerce_branches.permit_id AND p.owner_id=c.owner_id AND p.region=commerce_branches.region AND p.status='approved'))) ").bind(b.status,b.note.trim(),user.id,b.id,user.id).run();
  if(!result.meta.changes)return json({error:'لا يمكن اتخاذ القرار على هذا الفرع'},409);
  await audit(db,user.id,'commerce_branch_decide','commerce_branch',b.id,{status:b.status});return json({ok:true});
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 29: commercial registration with independent government approval.
if(path.startsWith('/api/commerce/')){
 const registrar=await can('commerce');
 if(method==='GET'&&path==='/api/commerce/companies'){
  const r=registrar?await db.prepare('SELECT c.*,u.username owner FROM commerce_companies c JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC LIMIT 200').all():await db.prepare('SELECT c.*,u.username owner FROM commerce_companies c JOIN users u ON u.id=c.owner_id WHERE c.owner_id=? ORDER BY c.created_at DESC LIMIT 100').bind(user.id).all();
  const permits=await db.prepare("SELECT id,business_name,region FROM municipal_permits WHERE owner_id=? AND status='approved' ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
  return json({companies:r.results,permits:permits.results,can_manage:registrar});
 }
 if(method==='POST'&&path==='/api/commerce/companies'){
  const b=await input(req);if(!b||!validText(b.name,3,120)||!validText(b.activity,3,120)||!['السجادة','المتجار','عقار'].includes(b.region)||b.permit_id&& !validText(b.permit_id,10,80))return json({error:'بيانات الشركة غير صالحة'},400);
  const permit=b.permit_id||null;
  if(permit){const match=await db.prepare("SELECT 1 FROM municipal_permits WHERE id=? AND owner_id=? AND status='approved' AND region=?").bind(permit,user.id,b.region).first();if(!match)return json({error:'الرخصة البلدية غير معتمدة أو ليست ملكك أو لا تطابق المحافظة'},409)}
  const id=random();try{await db.prepare('INSERT INTO commerce_companies(id,owner_id,name,activity,region,permit_id) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.name.trim(),b.activity.trim(),b.region,permit).run()}catch{return json({error:'اسم الشركة مسجل بالفعل أو الطلب غير صالح'},409)}
  await audit(db,user.id,'commerce_company_apply','commerce_company',id,{});return json({id},201);
 }
 if(method==='POST'&&path==='/api/commerce/decision'){
  if(!registrar)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected'].includes(b.status)||!validText(b.note,5,1000))return json({error:'بيانات القرار غير صالحة'},400);
  const r=await db.prepare("UPDATE commerce_companies SET status=?,review_note=?,reviewer_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND owner_id!=? AND (permit_id IS NULL OR EXISTS(SELECT 1 FROM municipal_permits p WHERE p.id=commerce_companies.permit_id AND p.owner_id=commerce_companies.owner_id AND p.region=commerce_companies.region AND p.status='approved'))").bind(b.status,b.note.trim(),user.id,b.id,user.id).run();
  if(!r.meta.changes)return json({error:'لا يمكن اعتماد هذا الطلب؛ تحقق من المالك والرخصة والحالة'},409);
  await audit(db,user.id,'commerce_company_decide','commerce_company',b.id,{status:b.status});return json({ok:true});
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 28: fictional real-estate registry and consent-based title transfers.
if(path.startsWith('/api/land/')){
 const registrar=await can('land');
 if(method==='GET'&&path==='/api/land/parcels'){
  const r=registrar?await db.prepare('SELECT p.*,u.username owner FROM land_parcels p JOIN users u ON u.id=p.owner_id ORDER BY p.created_at DESC LIMIT 200').all():await db.prepare('SELECT p.*,u.username owner FROM land_parcels p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? ORDER BY p.created_at DESC LIMIT 100').bind(user.id).all();
  return json({parcels:r.results,can_manage:registrar});
 }
 if(method==='POST'&&path==='/api/land/parcels'){
  if(!registrar)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.title,3,120)||!['السجادة','المتجار','عقار'].includes(b.region)||!validText(b.location,5,240)||!validText(b.owner_username,3,40))return json({error:'بيانات العقار غير صالحة'},400);
  const owner=await db.prepare('SELECT id FROM users WHERE username=?').bind(b.owner_username.trim().toLowerCase()).first();if(!owner)return json({error:'حساب المالك غير موجود'},404);
  const id=random();await db.prepare('INSERT INTO land_parcels(id,title,region,location,owner_id,created_by) VALUES(?,?,?,?,?,?)').bind(id,b.title.trim(),b.region,b.location.trim(),owner.id,user.id).run();await audit(db,user.id,'land_parcel_register','land_parcel',id,{owner_id:owner.id});return json({id},201);
 }
 if(method==='GET'&&path==='/api/land/transfers'){
  const r=registrar?await db.prepare('SELECT t.*,p.title,s.username seller,b.username buyer FROM land_transfers t JOIN land_parcels p ON p.id=t.parcel_id JOIN users s ON s.id=t.seller_id JOIN users b ON b.id=t.buyer_id ORDER BY t.created_at DESC LIMIT 200').all():await db.prepare('SELECT t.*,p.title,s.username seller,b.username buyer FROM land_transfers t JOIN land_parcels p ON p.id=t.parcel_id JOIN users s ON s.id=t.seller_id JOIN users b ON b.id=t.buyer_id WHERE t.seller_id=? OR t.buyer_id=? ORDER BY t.created_at DESC LIMIT 100').bind(user.id,user.id).all();return json({transfers:r.results,can_manage:registrar});
 }
 if(method==='POST'&&path==='/api/land/transfers'){
  const b=await input(req);if(!b||!validText(b.parcel_id,10,80)||!validText(b.buyer_username,3,40))return json({error:'بيانات النقل غير صالحة'},400);
  const parcel=await db.prepare('SELECT owner_id FROM land_parcels WHERE id=?').bind(b.parcel_id).first();if(!parcel||parcel.owner_id!==user.id)return json({error:'العقار غير موجود أو لا تملكه'},403);
  const buyer=await db.prepare('SELECT id FROM users WHERE username=?').bind(b.buyer_username.trim().toLowerCase()).first();if(!buyer||buyer.id===user.id)return json({error:'المشتري غير موجود أو هو المالك نفسه'},400);
  const id=random();try{await db.prepare('INSERT INTO land_transfers(id,parcel_id,seller_id,buyer_id) VALUES(?,?,?,?)').bind(id,b.parcel_id,user.id,buyer.id).run()}catch{return json({error:'يوجد طلب نقل مفتوح لهذا العقار'},409)}await audit(db,user.id,'land_transfer_request','land_transfer',id,{parcel_id:b.parcel_id,buyer_id:buyer.id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/land/transfers/decision'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['accept','reject','cancel','approve','deny'].includes(b.action))return json({error:'قرار غير صالح'},400);
  const t=await db.prepare('SELECT * FROM land_transfers WHERE id=?').bind(b.id).first();if(!t)return json({error:'الطلب غير موجود'},404);
  let status=null;
  if(b.action==='accept'&&t.buyer_id===user.id&&t.status==='pending_buyer')status='pending_registry';
  if(b.action==='reject'&&t.buyer_id===user.id&&t.status==='pending_buyer')status='rejected';
  if(b.action==='cancel'&&t.seller_id===user.id&&['pending_buyer','pending_registry'].includes(t.status))status='cancelled';
  if(b.action==='approve'&&registrar&&t.status==='pending_registry'&&t.seller_id!==user.id&&t.buyer_id!==user.id)status='approved';
  if(b.action==='deny'&&registrar&&t.status==='pending_registry')status='rejected';
  if(!status)return json({error:'غير مصرح بهذا الإجراء أو انتهت صلاحية الطلب'},403);
  const result=await db.prepare('UPDATE land_transfers SET status=?,reviewed_by=CASE WHEN ? THEN ? ELSE reviewed_by END,reviewed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE reviewed_at END WHERE id=? AND status=?').bind(status,registrar&&['approve','deny'].includes(b.action)?1:0,user.id,registrar&&['approve','deny'].includes(b.action)?1:0,b.id,t.status).run();
  if(!result.meta.changes)return json({error:'تغيرت حالة الطلب، حدّث الصفحة'},409);
  await audit(db,user.id,'land_transfer_'+b.action,'land_transfer',b.id,{status});return json({ok:true,status});
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 27: municipal business permits and inspections (fictional).
if(path.startsWith('/api/municipality/')){
 const staff=await can('municipality');
 if(method==='GET'&&path==='/api/municipality/permits'){
  const r=staff?await db.prepare('SELECT p.*,u.username applicant FROM municipal_permits p JOIN users u ON u.id=p.owner_id ORDER BY p.created_at DESC LIMIT 150').all():await db.prepare('SELECT p.*,u.username applicant FROM municipal_permits p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? ORDER BY p.created_at DESC LIMIT 100').bind(user.id).all();
  return json({permits:r.results,can_manage:staff});
 }
 if(method==='POST'&&path==='/api/municipality/permits'){
  const b=await input(req);if(!b||!validText(b.business_name,3,120)||!validText(b.activity,3,120)||!['السجادة','المتجار','عقار'].includes(b.region)||!validText(b.location,5,240))return json({error:'بيانات طلب الرخصة غير صالحة'},400);
  const id=random();await db.prepare('INSERT INTO municipal_permits(id,owner_id,business_name,activity,region,location) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.business_name.trim(),b.activity.trim(),b.region,b.location.trim()).run();await audit(db,user.id,'municipal_permit_apply','municipal_permit',id,{});return json({id},201);
 }
 if(method==='POST'&&path==='/api/municipality/decide'){
  if(!staff)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected','needs_changes'].includes(b.status)||!validText(b.note,5,1000))return json({error:'قرار أو ملاحظة غير صالحة'},400);
  const r=await db.prepare("UPDATE municipal_permits SET status=?,review_note=?,reviewer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','needs_changes')").bind(b.status,b.note.trim(),user.id,b.id).run();if(!r.meta.changes)return json({error:'الطلب غير موجود أو لا يمكن مراجعته'},409);
  await audit(db,user.id,'municipal_permit_decide','municipal_permit',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/municipality/resubmit'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!validText(b.location,5,240))return json({error:'بيانات غير صالحة'},400);
  const r=await db.prepare("UPDATE municipal_permits SET location=?,status='pending',review_note=NULL,reviewer_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND status='needs_changes'").bind(b.location.trim(),b.id,user.id).run();if(!r.meta.changes)return json({error:'لا يمكن إعادة تقديم الطلب'},409);
  await audit(db,user.id,'municipal_permit_resubmit','municipal_permit',b.id,{});return json({ok:true});
 }
 if(method==='GET'&&path==='/api/municipality/inspections'){
  const id=u.searchParams.get('permit_id');if(!validText(id,10,80))return json({error:'معرّف الرخصة مطلوب'},400);
  const permit=await db.prepare('SELECT owner_id FROM municipal_permits WHERE id=?').bind(id).first();if(!permit)return json({error:'الرخصة غير موجودة'},404);if(!staff&&permit.owner_id!==user.id)return json({error:'غير مصرح'},403);
  const r=await db.prepare('SELECT id,permit_id,outcome,notes,created_at FROM municipal_inspections WHERE permit_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();return json({inspections:r.results});
 }
 if(method==='POST'&&path==='/api/municipality/inspections'){
  if(!staff)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.permit_id,10,80)||!['passed','warning','failed'].includes(b.outcome)||!validText(b.notes,5,1500))return json({error:'بيانات التفتيش غير صالحة'},400);
  const permit=await db.prepare("SELECT id FROM municipal_permits WHERE id=? AND status='approved'").bind(b.permit_id).first();if(!permit)return json({error:'لا يمكن تفتيش رخصة غير معتمدة'},409);
  const id=random();await db.prepare('INSERT INTO municipal_inspections(id,permit_id,inspector_id,outcome,notes) VALUES(?,?,?,?,?)').bind(id,b.permit_id,user.id,b.outcome,b.notes.trim()).run();await audit(db,user.id,'municipal_inspection_create','municipal_inspection',id,{permit_id:b.permit_id,outcome:b.outcome});return json({id},201);
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 26: fictional public healthcare appointment booking.
if(path.startsWith('/api/health/')){
 const staff=await can('health');
 if(method==='GET'&&path==='/api/health/clinics'){
  const r=await db.prepare('SELECT id,name,region,specialty FROM health_clinics WHERE active=1 ORDER BY name LIMIT 100').all();return json({clinics:r.results,can_manage:staff});
 }
 if(method==='POST'&&path==='/api/health/clinics'){
  if(!staff)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.name,3,100)||!validText(b.region,2,80)||!validText(b.specialty,2,80))return json({error:'بيانات المنشأة غير صالحة'},400);
  const id=random();await db.prepare('INSERT INTO health_clinics(id,name,region,specialty) VALUES(?,?,?,?)').bind(id,b.name.trim(),b.region.trim(),b.specialty.trim()).run();await audit(db,user.id,'health_clinic_create','health_clinic',id,{});return json({id},201);
 }
 if(method==='GET'&&path==='/api/health/appointments'){
  const r=staff?await db.prepare('SELECT a.*,c.name clinic,u.username patient FROM health_appointments a JOIN health_clinics c ON c.id=a.clinic_id JOIN users u ON u.id=a.patient_id ORDER BY a.created_at DESC LIMIT 150').all():await db.prepare('SELECT a.*,c.name clinic,u.username patient FROM health_appointments a JOIN health_clinics c ON c.id=a.clinic_id JOIN users u ON u.id=a.patient_id WHERE a.patient_id=? ORDER BY a.created_at DESC LIMIT 100').bind(user.id).all();return json({appointments:r.results,can_manage:staff});
 }
 if(method==='POST'&&path==='/api/health/appointments'){
  const b=await input(req);if(!b||!validText(b.clinic_id,10,80)||!validText(b.reason,5,500)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.scheduled_at||''))return json({error:'بيانات الموعد غير صالحة'},400);
  const when=new Date(b.scheduled_at+':00Z');if(!Number.isFinite(when.getTime())||when.toISOString().slice(0,16)!==b.scheduled_at||when.getTime()<Date.now()+3600000||when.getTime()>Date.now()+90*86400000)return json({error:'اختر موعدًا خلال 90 يومًا وبفاصل ساعة على الأقل (التوقيت UTC)'},400);
  const clinic=await db.prepare('SELECT id FROM health_clinics WHERE id=? AND active=1').bind(b.clinic_id).first();if(!clinic)return json({error:'المنشأة غير متاحة'},404);
  const id=random();try{await db.prepare('INSERT INTO health_appointments(id,clinic_id,patient_id,scheduled_at,reason) VALUES(?,?,?,?,?)').bind(id,b.clinic_id,user.id,b.scheduled_at.replace('T',' ')+':00',b.reason.trim()).run()}catch{return json({error:'هذا الموعد محجوز أو لديك موعد مطابق'},409)}
  await audit(db,user.id,'health_appointment_book','health_appointment',id,{clinic_id:b.clinic_id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/health/cancel'){
  const b=await input(req);if(!b||!validText(b.id,10,80))return json({error:'معرّف غير صالح'},400);
  const r=await db.prepare("UPDATE health_appointments SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND patient_id=? AND status='booked'").bind(b.id,user.id).run();if(!r.meta.changes)return json({error:'الموعد غير موجود أو لا يمكن إلغاؤه'},409);await audit(db,user.id,'health_appointment_cancel','health_appointment',b.id,{});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/health/status'){
  if(!staff)return json({error:'غير مصرح'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['completed','no_show','cancelled'].includes(b.status))return json({error:'حالة غير صالحة'},400);
  const r=await db.prepare("UPDATE health_appointments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='booked'").bind(b.status,b.id).run();if(!r.meta.changes)return json({error:'الموعد غير قابل للتعديل'},409);await audit(db,user.id,'health_appointment_status','health_appointment',b.id,{status:b.status});return json({ok:true});
 }
}

// Phase 25: citizen service desk, with private tickets and staff-only responses.
if(path.startsWith('/api/service-desk/')){
 const manager=await can('requests');
 if(method==='GET'&&path==='/api/service-desk/tickets'){
  const r=manager?await db.prepare('SELECT t.*,u.username owner FROM service_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 150').all():await db.prepare('SELECT t.*,u.username owner FROM service_tickets t JOIN users u ON u.id=t.user_id WHERE t.user_id=? ORDER BY t.created_at DESC LIMIT 100').bind(user.id).all();
  return json({tickets:r.results,can_manage:manager});
 }
 if(method==='POST'&&path==='/api/service-desk/tickets'){
  const b=await input(req);if(!b||!['technical','government','banking','other'].includes(b.category)||!validText(b.subject,5,120)||!validText(b.description,10,3000))return json({error:'بيانات البلاغ غير مكتملة'},400);
  const id=random(),reference='SAL-SRV-'+id.slice(0,8).toUpperCase();await db.prepare('INSERT INTO service_tickets(id,reference,user_id,category,subject,description) VALUES(?,?,?,?,?,?)').bind(id,reference,user.id,b.category,b.subject.trim(),b.description.trim()).run();await audit(db,user.id,'service_ticket_create','service_ticket',id,{reference});return json({id,reference},201);
 }
 if(method==='GET'&&path==='/api/service-desk/replies'){
  const id=u.searchParams.get('id');if(!validText(id,10,80))return json({error:'معرّف غير صالح'},400);
  const t=await db.prepare('SELECT user_id FROM service_tickets WHERE id=?').bind(id).first();if(!t||(t.user_id!==user.id&&!manager))return json({error:'غير موجود أو غير مصرح'},404);
  const r=await db.prepare('SELECT r.id,r.body,r.created_at,u.username author FROM service_ticket_replies r JOIN users u ON u.id=r.author_id WHERE r.ticket_id=? ORDER BY r.created_at,r.id LIMIT 200').bind(id).all();return json({replies:r.results});
 }
 if(method==='POST'&&path==='/api/service-desk/reply'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!validText(b.body,2,2000))return json({error:'الرد غير صالح'},400);
  const t=await db.prepare('SELECT user_id,status FROM service_tickets WHERE id=?').bind(b.id).first();if(!t||(t.user_id!==user.id&&!manager))return json({error:'غير مصرح'},404);if(t.status==='closed')return json({error:'الطلب مغلق'},409);
  const id=random();await db.batch([db.prepare('INSERT INTO service_ticket_replies(id,ticket_id,author_id,body) VALUES(?,?,?,?)').bind(id,b.id,user.id,b.body.trim()),db.prepare('UPDATE service_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.id)]);
  if(manager&&t.user_id!==user.id)await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,t.user_id,'رد جديد على تذكرة الدعم',`وصل رد جديد على التذكرة ${b.id}.`).run();
  await audit(db,user.id,'service_ticket_reply','service_ticket',b.id,{reply_id:id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/service-desk/status'){
  if(!manager)return json({error:'صلاحية إدارة الطلبات مطلوبة'},403);const b=await input(req);if(!b||!validText(b.id,10,80)||!['open','reviewing','closed'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
  const t=await db.prepare('SELECT user_id,status FROM service_tickets WHERE id=?').bind(b.id).first();if(!t)return json({error:'التذكرة غير موجودة'},404);
  await db.batch([db.prepare('UPDATE service_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.status,b.id),db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,t.user_id,'تحديث تذكرة الدعم',`تغيرت حالة التذكرة ${b.id} إلى ${b.status}.`)]);await audit(db,user.id,'service_ticket_status','service_ticket',b.id,{from:t.status,to:b.status});return json({ok:true});
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 24: auditable execution orders; SQL triggers enforce status and review safeguards.
if(path.startsWith('/api/justice24/')){
 const judge=await can('justice');
 if(method==='GET'&&path==='/api/justice24/orders'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80))return json({error:'معرّف القضية غير صالح'},400);
  const allowed=await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(caseId,judge?1:0,user.id,user.id,user.id).first();
  if(!allowed)return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const execution=await db.prepare('SELECT id,status,instructions,last_note,created_at FROM judgment_executions WHERE case_id=?').bind(caseId).first();
  const orders=await db.prepare('SELECT o.id,o.action,o.reason,o.created_at,u.username issuer FROM court_execution_orders o JOIN users u ON u.id=o.issued_by WHERE o.case_id=? ORDER BY o.created_at DESC,o.id DESC LIMIT 200').bind(caseId).all();
  return json({execution,orders:orders.results,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/justice24/orders'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);
  const b=await input(req);if(!b||!validText(b.execution_id,10,80)||!['start','suspend','resume','complete'].includes(b.action)||!validText(b.reason,10,4000))return json({error:'بيانات أمر التنفيذ غير مكتملة'},400);
  const execution=await db.prepare('SELECT case_id FROM judgment_executions WHERE id=?').bind(b.execution_id).first();if(!execution)return json({error:'ملف التنفيذ غير موجود'},404);
  const id=random();try{await db.prepare('INSERT INTO court_execution_orders(id,execution_id,case_id,issued_by,action,reason) VALUES(?,?,?,?,?,?)').bind(id,b.execution_id,execution.case_id,user.id,b.action,b.reason.trim()).run()}catch{return json({error:'تعذر إصدار الأمر؛ تحقق من حالة التنفيذ أو من وجود مراجعة قضائية تمنع الإجراء'},409)}
  await audit(db,user.id,'court_execution_order','court_case',execution.case_id,{order_id:id,action:b.action});return json({id},201);
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 23: independent appeal chamber and immutable rulings for fictional cases.
if(path.startsWith('/api/justice23/')){
 const chamber=await can('appeals');
 const permitted=async caseId=>!!(await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(caseId,chamber?1:0,user.id,user.id,user.id).first());
 if(method==='GET'&&path==='/api/justice23/docket'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80)||!await permitted(caseId))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const appeals=await db.prepare(`SELECT a.id,a.status,a.reason,a.created_at,a.appellant_id,u.username appellant FROM court_appeals a JOIN users u ON u.id=a.appellant_id WHERE a.case_id=? ORDER BY a.created_at DESC`).bind(caseId).all();
  const reviews=await db.prepare(`SELECT r.id,r.appeal_id,r.level,r.status,r.created_at,r.closed_at,r.opened_by,ruling.id ruling_id,ruling.outcome,ruling.reasoning,ruling.created_at ruling_at FROM court_review_dockets r LEFT JOIN court_review_rulings ruling ON ruling.docket_id=r.id WHERE r.case_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(caseId).all();
  return json({appeals:appeals.results,reviews:reviews.results,can_manage:chamber});
 }
 if(method==='POST'&&path==='/api/justice23/open'){
  if(!chamber)return json({error:'صلاحية دائرة الاستئناف مطلوبة'},403);
  const b=await input(req);if(!b||!validText(b.appeal_id,10,80)||!['appeal','cassation'].includes(b.level))return json({error:'بيانات غير صالحة'},400);
  const a=await db.prepare(`SELECT a.id,a.case_id,a.status,c.status case_status FROM court_appeals a JOIN court_cases c ON c.id=a.case_id WHERE a.id=?`).bind(b.appeal_id).first();
  if(!a||a.case_status!=='judged'||a.status!=='accepted')return json({error:'يلزم استئناف مقبول وحكم ابتدائي صادر'},409);
  if(b.level==='cassation'){
   const prior=await db.prepare(`SELECT 1 FROM court_review_dockets r JOIN court_review_rulings j ON j.docket_id=r.id WHERE r.appeal_id=? AND r.level='appeal'`).bind(a.id).first();if(!prior)return json({error:'يلزم حكم استئناف قبل فتح النقض'},409);
  }
  const id=random();try{await db.prepare('INSERT INTO court_review_dockets(id,appeal_id,case_id,level,opened_by) VALUES(?,?,?,?,?)').bind(id,a.id,a.case_id,b.level,user.id).run()}catch{return json({error:'الدائرة لهذه الدرجة مسجلة بالفعل'},409)}
  await audit(db,user.id,'court_review_open','court_case',a.case_id,{docket_id:id,level:b.level});return json({id},201);
 }
 if(method==='POST'&&path==='/api/justice23/rule'){
  if(!chamber)return json({error:'صلاحية دائرة الاستئناف مطلوبة'},403);
  const b=await input(req);if(!b||!validText(b.docket_id,10,80)||!['uphold','reverse','remand'].includes(b.outcome)||!validText(b.reasoning,20,8000))return json({error:'بيانات الحكم غير مكتملة'},400);
  const r=await db.prepare(`SELECT r.id,r.case_id,r.status,r.opened_by FROM court_review_dockets r WHERE r.id=?`).bind(b.docket_id).first();if(!r||r.status!=='open')return json({error:'ملف المراجعة غير مفتوح'},409);
  if(r.opened_by===user.id)return json({error:'يجب أن يصدر الحكم مستخدم قضائي آخر غير فاتح الملف'},403);
  const id=random();try{await db.batch([db.prepare('INSERT INTO court_review_rulings(id,docket_id,outcome,reasoning,issued_by) VALUES(?,?,?,?,?)').bind(id,r.id,b.outcome,b.reasoning.trim(),user.id),db.prepare("UPDATE court_review_dockets SET status='decided',closed_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'").bind(r.id)]);}catch{return json({error:'تعذر إصدار الحكم أو سبق الفصل'},409)}
  await audit(db,user.id,'court_review_ruling','court_case',r.case_id,{docket_id:r.id,ruling_id:id,outcome:b.outcome});return json({id},201);
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 22: unified chronological case docket, with case-level authorization.
if(method==='GET'&&path==='/api/justice22/timeline'){
 const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80))return json({error:'معرف القضية غير صالح'},400);
 const judge=await can('justice');
 const c=await db.prepare(`SELECT c.id,c.reference,c.title,c.status,c.created_at,c.updated_at FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(caseId,judge?1:0,user.id,user.id,user.id).first();
 if(!c)return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
 const sql=`SELECT 'case' source,id,'تسجيل إجراء قضائي' title,event_type||' — '||details detail,created_at FROM court_events WHERE case_id=?
 UNION ALL SELECT 'hearing',id,'جلسة قضائية',location||' — '||COALESCE(notes,''),created_at FROM court_hearings WHERE case_id=?
 UNION ALL SELECT 'minute',m.id,'محضر جلسة',substr(m.summary,1,240),m.created_at FROM court_hearing_minutes m JOIN court_hearings h ON h.id=m.hearing_id WHERE h.case_id=?
 UNION ALL SELECT 'addendum',a.id,'تصحيح محضر',substr(a.reason,1,240),a.created_at FROM court_minutes_addenda a JOIN court_hearing_minutes m ON m.id=a.minute_id JOIN court_hearings h ON h.id=m.hearing_id WHERE h.case_id=?
 UNION ALL SELECT 'submission',id,'مذكرة قضائية',title||' — '||status,created_at FROM court_submissions WHERE case_id=?
 UNION ALL SELECT 'attachment',id,'إيداع مرفق',title,created_at FROM court_attachments WHERE case_id=?
 UNION ALL SELECT 'appeal',id,'استئناف',status||' — '||substr(reason,1,240),created_at FROM court_appeals WHERE case_id=?
 UNION ALL SELECT 'execution',id,'ملف تنفيذ حكم',status||' — '||substr(instructions,1,240),created_at FROM judgment_executions WHERE case_id=?
 UNION ALL SELECT 'evidence',id,'فهرسة دليل',title,created_at FROM justice_evidence WHERE case_id=?
 ORDER BY created_at DESC,source,id LIMIT 250`;
 const r=await db.prepare(sql).bind(...Array(9).fill(caseId)).all();
 return json({case:c,events:r.results,truncated:r.results.length===250});
}

// Phase 42: private small case attachments stored in D1, without R2.
if(path.startsWith('/api/justice21/')){
 const judge=await can('justice');
 const permitted=async id=>!!(await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(id,judge?1:0,user.id,user.id,user.id).first());
 if(method==='GET'&&path==='/api/justice21/files'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80)||!await permitted(caseId))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const r=await db.prepare('SELECT id,title,filename,mime_type,byte_size,sha256,created_at FROM court_attachments WHERE case_id=? ORDER BY created_at DESC LIMIT 100').bind(caseId).all();return json({files:r.results});
 }
 if(method==='POST'&&path==='/api/justice21/files'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80)||!await permitted(caseId))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const length=Number(req.headers.get('content-length'));if(!Number.isFinite(length)||length<1||length>210000)return json({error:'حجم الطلب غير صالح أو يتجاوز 200 كيلوبايت'},413);
  const form=await req.formData();const file=form.get('file'),title=form.get('title');
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!(file instanceof File)||!validText(title,3,160)||file.size<1||file.size>131072||!allowed.includes(file.type))return json({error:'الملف غير مدعوم؛ PDF أو صورة حتى 128 كيلوبايت'},400);
  const bytes=await file.arrayBuffer(),view=new Uint8Array(bytes);
  const isPdf=file.type==='application/pdf'&&String.fromCharCode(...view.slice(0,5))==='%PDF-';
  const isPng=file.type==='image/png'&&[137,80,78,71,13,10,26,10].every((x,i)=>view[i]===x);
  const isJpg=file.type==='image/jpeg'&&view[0]===255&&view[1]===216&&view[2]===255;
  const isWebp=file.type==='image/webp'&&String.fromCharCode(...view.slice(0,4))==='RIFF'&&String.fromCharCode(...view.slice(8,12))==='WEBP';
  if(!(isPdf||isPng||isJpg||isWebp))return json({error:'محتوى الملف لا يطابق نوعه'},400);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const id=random(),key=`d1/${caseId}/${id}`;const filename=(file.name||'file').replace(/[\\/\x00-\x1f]/g,'_').slice(0,180)||'file';
  // Base64 is stored as text to keep D1 bindings portable. Limit each file to 128 KiB.
  let encoded='';for(let i=0;i<view.length;i+=8190)encoded+=btoa(String.fromCharCode(...view.subarray(i,i+8190)));
  await db.batch([
   db.prepare('INSERT INTO court_attachments(id,case_id,uploaded_by,title,filename,mime_type,byte_size,object_key,sha256) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,caseId,user.id,title.trim(),filename,file.type,file.size,key,digest),
   db.prepare('INSERT INTO court_attachment_data(attachment_id,content_base64) VALUES(?,?)').bind(id,encoded)
  ]);
  await audit(db,user.id,'court_attachment_upload','court_case',caseId,{attachment_id:id,sha256:digest,size:file.size});return json({id,sha256:digest},201);
 }
 if(method==='GET'&&path==='/api/justice21/download'){
  const id=u.searchParams.get('id');if(!validText(id,10,80))return json({error:'معرف غير صالح'},400);
  const row=await db.prepare('SELECT * FROM court_attachments WHERE id=?').bind(id).first();if(!row||!await permitted(row.case_id))return json({error:'المرفق غير موجود أو غير مصرح به'},404);
  const stored=await db.prepare('SELECT content_base64 FROM court_attachment_data WHERE attachment_id=?').bind(id).first();if(!stored)return json({error:'الملف غير متاح في قاعدة البيانات'},404);
  const raw=atob(stored.content_base64);const data=Uint8Array.from(raw,c=>c.charCodeAt(0));
  await audit(db,user.id,'court_attachment_download','court_case',row.case_id,{attachment_id:id});
  return new Response(data,{headers:{'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename="court-file-${row.id}.${row.mime_type==='application/pdf'?'pdf':row.mime_type==='image/jpeg'?'jpg':row.mime_type==='image/png'?'png':'webp'}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 20: append-only corrections to court minutes. Original minutes remain immutable.
if(path.startsWith('/api/justice20/')){
 const judge=await can('justice');
 if(method==='GET'&&path==='/api/justice20/addenda'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80))return json({error:'معرف القضية غير صالح'},400);
  const allowed=await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(caseId,judge?1:0,user.id,user.id,user.id).first();
  if(!allowed)return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const rows=await db.prepare(`SELECT a.id,a.minute_id,a.reason,a.correction,a.created_at,u.username author FROM court_minutes_addenda a JOIN court_hearing_minutes m ON m.id=a.minute_id JOIN court_hearings h ON h.id=m.hearing_id JOIN users u ON u.id=a.created_by WHERE h.case_id=? ORDER BY a.created_at,a.id LIMIT 200`).bind(caseId).all();
  return json({addenda:rows.results,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/justice20/addenda'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);
  const b=await input(req);if(!b||!validText(b.minute_id,10,80)||!validText(b.reason,5,1000)||!validText(b.correction,10,6000))return json({error:'بيانات الملحق غير مكتملة'},400);
  const minute=await db.prepare('SELECT h.case_id FROM court_hearing_minutes m JOIN court_hearings h ON h.id=m.hearing_id WHERE m.id=?').bind(b.minute_id).first();if(!minute)return json({error:'المحضر غير موجود'},404);
  const id=random();await db.prepare('INSERT INTO court_minutes_addenda(id,minute_id,created_by,reason,correction) VALUES(?,?,?,?,?)').bind(id,b.minute_id,user.id,b.reason.trim(),b.correction.trim()).run();
  await audit(db,user.id,'court_minutes_addendum','court_case',minute.case_id,{minute_id:b.minute_id,addendum_id:id});return json({id},201);
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 19: hearing minutes with court-only creation and case-scoped reads.
if(path.startsWith('/api/justice19/')){
 const judge=await can('justice');
 const permitted=async id=>!!(await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(id,judge?1:0,user.id,user.id,user.id).first());
 if(method==='GET'&&path==='/api/justice19/minutes'){
  const caseId=u.searchParams.get('case_id');if(!validText(caseId,10,80)||!await permitted(caseId))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const r=await db.prepare(`SELECT m.id,m.hearing_id,m.summary,m.attendees,m.next_steps,m.created_at,h.starts_at,h.location,a.username author FROM court_hearing_minutes m JOIN court_hearings h ON h.id=m.hearing_id JOIN users a ON a.id=m.created_by WHERE h.case_id=? ORDER BY h.starts_at DESC LIMIT 100`).bind(caseId).all();
  const h=await db.prepare('SELECT id,starts_at,location FROM court_hearings WHERE case_id=? ORDER BY starts_at DESC LIMIT 100').bind(caseId).all();return json({minutes:r.results,hearings:h.results,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/justice19/minutes'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);const b=await input(req);
  if(!b||!validText(b.hearing_id,10,80)||!validText(b.summary,10,6000)||!validText(b.attendees,2,1000)||!validText(b.next_steps,3,2000))return json({error:'بيانات المحضر ناقصة'},400);
  const h=await db.prepare('SELECT id,case_id FROM court_hearings WHERE id=?').bind(b.hearing_id).first();if(!h)return json({error:'الجلسة غير موجودة'},404);
  const id=random();try{await db.prepare('INSERT INTO court_hearing_minutes(id,hearing_id,created_by,summary,attendees,next_steps) VALUES(?,?,?,?,?,?)').bind(id,h.id,user.id,b.summary.trim(),b.attendees.trim(),b.next_steps.trim()).run()}catch{return json({error:'يوجد محضر لهذه الجلسة'},409)}
  await audit(db,user.id,'court_hearing_minutes_create','court_case',h.case_id,{minutes_id:id,hearing_id:h.id});return json({id},201);
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 18: written court submissions; access checked per case on every request.
if(path.startsWith('/api/justice18/')){
 const judge=await can('justice');
 const permitted=async id=>db.prepare(`SELECT c.id FROM court_cases c WHERE c.id=? AND (?=1 OR c.plaintiff_id=? OR c.defendant_id=? OR EXISTS (SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(id,judge?1:0,user.id,user.id,user.id).first();
 if(method==='GET'&&path==='/api/justice18/submissions'){
  const id=u.searchParams.get('case_id');if(!validText(id,10,80)||!await permitted(id))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const r=await db.prepare('SELECT s.id,s.kind,s.title,s.body,s.status,s.review_note,s.created_at,s.reviewed_at,a.username author FROM court_submissions s JOIN users a ON a.id=s.author_id WHERE s.case_id=? ORDER BY s.created_at DESC LIMIT 100').bind(id).all();return json({submissions:r.results,can_review:judge});
 }
 if(method==='POST'&&path==='/api/justice18/submissions'){
  const b=await input(req);if(!b||!validText(b.case_id,10,80)||!['statement','response','evidence_note','motion'].includes(b.kind)||!validText(b.title,5,160)||!validText(b.body,10,6000))return json({error:'بيانات المذكرة غير صالحة'},400);
  if(!await permitted(b.case_id))return json({error:'القضية غير موجودة أو غير مصرح بها'},404);
  const id=random();await db.prepare('INSERT INTO court_submissions(id,case_id,author_id,kind,title,body) VALUES(?,?,?,?,?,?)').bind(id,b.case_id,user.id,b.kind,b.title.trim(),b.body.trim()).run();
  await audit(db,user.id,'court_submission_created','court_submission',id,{case_id:b.case_id,kind:b.kind});return json({id,ok:true},201);
 }
 if(method==='POST'&&path==='/api/justice18/review'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['reviewed','returned'].includes(b.status)||!validText(b.note,3,1000))return json({error:'بيانات المراجعة غير صالحة'},400);
  const r=await db.prepare("UPDATE court_submissions SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(b.status,b.note.trim(),user.id,b.id).run();if(!r.meta.changes)return json({error:'المذكرة غير موجودة أو سبق مراجعتها'},409);
  await audit(db,user.id,'court_submission_review','court_submission',b.id,{status:b.status});return json({ok:true});
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 17: prosecution, evidence descriptions and execution orders.
if(path.startsWith('/api/justice17/')){
 const judge=await can('justice'),officer=await can('police');
 const caseAccess=async id=>judge||!!(await db.prepare(`SELECT 1 FROM court_cases c WHERE c.id=? AND (c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(id,user.id,user.id,user.id).first());
 if(method==='GET'&&path==='/api/justice17/referrals'){
  if(!judge&&!officer)return json({error:'صلاحية الشرطة أو القضاء مطلوبة'},403);
  const r=await db.prepare('SELECT r.*,p.reference report_reference,p.title report_title FROM prosecution_referrals r JOIN police_reports p ON p.id=r.report_id ORDER BY r.created_at DESC LIMIT 100').all();return json({referrals:r.results,judge,officer});
 }
 if(method==='POST'&&path==='/api/justice17/referrals'){
  if(!officer)return json({error:'صلاحية الشرطة مطلوبة'},403);const b=await input(req);if(!b||!validText(b.report_id,10,80)||!validText(b.summary,10,2000))return json({error:'بيانات الإحالة ناقصة'},400);
  const report=await db.prepare("SELECT id FROM police_reports WHERE id=? AND status IN ('investigating','referred')").bind(b.report_id).first();if(!report)return json({error:'البلاغ غير مؤهل للإحالة'},409);
  const id=random();try{await db.prepare('INSERT INTO prosecution_referrals(id,report_id,created_by,summary) VALUES(?,?,?,?)').bind(id,b.report_id,user.id,b.summary.trim()).run()}catch{return json({error:'سبق إحالة هذا البلاغ'},409)}
  await audit(db,user.id,'prosecution_referral','police_report',b.report_id,{referral_id:id});return json({id,ok:true},201);
 }
 if(method==='POST'&&path==='/api/justice17/referrals/review'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);const b=await input(req);if(!b||!validText(b.id,10,80)||!['reviewing','filed_to_court','dismissed'].includes(b.status)||!validText(b.note,5,2000))return json({error:'بيانات المراجعة ناقصة'},400);
  if(b.status==='filed_to_court'&&!validText(b.case_id,10,80))return json({error:'معرف القضية مطلوب'},400);
  if(b.status==='filed_to_court'&&!await db.prepare('SELECT id FROM court_cases WHERE id=?').bind(b.case_id).first())return json({error:'القضية غير موجودة'},404);
  const r=await db.prepare("UPDATE prosecution_referrals SET status=?,case_id=?,review_note=?,reviewed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('referred','reviewing')").bind(b.status,b.status==='filed_to_court'?b.case_id:null,b.note.trim(),user.id,b.id).run();if(!r.meta.changes)return json({error:'الإحالة غير موجودة أو انتهت'},409);
  await audit(db,user.id,'prosecution_review','prosecution_referral',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='GET'&&path==='/api/justice17/evidence'){
  const id=u.searchParams.get('case_id');if(!id||!await caseAccess(id))return json({error:'غير مصرح'},403);
  const r=await db.prepare('SELECT e.id,e.title,e.description,e.created_at,u.username author FROM justice_evidence e JOIN users u ON u.id=e.submitted_by WHERE e.case_id=? ORDER BY e.created_at DESC LIMIT 100').bind(id).all();return json({evidence:r.results});
 }
 if(method==='POST'&&path==='/api/justice17/evidence'){
  const b=await input(req);if(!b||!validText(b.case_id,10,80)||!validText(b.title,3,150)||!validText(b.description,10,4000)||!await caseAccess(b.case_id))return json({error:'بيانات الدليل أو الصلاحية غير صحيحة'},403);
  const id=random();await db.prepare('INSERT INTO justice_evidence(id,case_id,submitted_by,title,description) VALUES(?,?,?,?,?)').bind(id,b.case_id,user.id,b.title.trim(),b.description.trim()).run();await audit(db,user.id,'court_evidence_note','court_case',b.case_id,{evidence_id:id});return json({id},201);
 }
 if(method==='GET'&&path==='/api/justice17/executions'){
  const r=judge?await db.prepare('SELECT e.*,c.reference FROM judgment_executions e JOIN court_cases c ON c.id=e.case_id ORDER BY e.created_at DESC LIMIT 100').all():await db.prepare(`SELECT e.*,c.reference FROM judgment_executions e JOIN court_cases c ON c.id=e.case_id WHERE c.plaintiff_id=? OR c.defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')) ORDER BY e.created_at DESC LIMIT 100`).bind(user.id,user.id,user.id).all();return json({executions:r.results,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/justice17/executions'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);const b=await input(req);if(!b||!validText(b.case_id,10,80)||!validText(b.instructions,10,3000))return json({error:'بيانات التنفيذ ناقصة'},400);
  const c=await db.prepare("SELECT id FROM court_cases WHERE id=? AND status IN ('judged','closed')").bind(b.case_id).first();if(!c)return json({error:'لا يوجد حكم مسجل قابل للمتابعة'},409);
  const id=random();try{await db.prepare('INSERT INTO judgment_executions(id,case_id,created_by,instructions) VALUES(?,?,?,?)').bind(id,b.case_id,user.id,b.instructions.trim()).run()}catch{return json({error:'ملف تنفيذ موجود لهذه القضية'},409)}await audit(db,user.id,'execution_open','court_case',b.case_id,{execution_id:id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/justice17/executions/update'){
  return json({error:'تم إيقاف التحديث المباشر. استخدم أوامر التنفيذ القضائي في المرحلة 24.'},410);
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 16: restricted police incident intake and appeals.
if(path.startsWith('/api/justice16/')){
 const judge=await can('justice'),officer=await can('police');
 if(method==='POST'&&path==='/api/justice16/reports'){
  const b=await input(req);if(!b||!['security','traffic','fraud','other'].includes(b.kind)||!validText(b.title,5,150)||!validText(b.details,10,4000))return json({error:'بيانات البلاغ غير صالحة'},400);
  const id=random(),reference='SAL-POL-'+id.slice(0,8).toUpperCase();await db.prepare('INSERT INTO police_reports(id,reference,reporter_id,kind,title,details) VALUES(?,?,?,?,?,?)').bind(id,reference,user.id,b.kind,b.title.trim(),b.details.trim()).run();await audit(db,user.id,'police_report_file','police_report',id,{reference});return json({id,reference},201);
 }
 if(method==='GET'&&path==='/api/justice16/reports'){
  const r=(officer||judge)?await db.prepare('SELECT id,reference,kind,title,status,created_at FROM police_reports ORDER BY created_at DESC LIMIT 100').all():await db.prepare('SELECT id,reference,kind,title,status,created_at FROM police_reports WHERE reporter_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all();return json({reports:r.results,can_manage:officer||judge});
 }
 if(method==='POST'&&path==='/api/justice16/reports/update'){
  if(!officer)return json({error:'صلاحية الشرطة مطلوبة'},403);const b=await input(req);if(!b||!validText(b.id,10,80)||!['review','investigating','referred','closed'].includes(b.status)||!validText(b.note,3,1000))return json({error:'بيانات غير صالحة'},400);
  const r=await db.prepare("UPDATE police_reports SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('closed')").bind(b.status,b.id).run();if(!r.meta.changes)return json({error:'البلاغ غير موجود أو مغلق'},409);
  await db.prepare('INSERT INTO police_report_events(id,report_id,actor_id,status,note) VALUES(?,?,?,?,?)').bind(random(),b.id,user.id,b.status,b.note.trim()).run();await audit(db,user.id,'police_report_update','police_report',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/justice16/appeals'){
  const b=await input(req);if(!b||!validText(b.case_id,10,80)||!validText(b.reason,10,3000))return json({error:'بيانات الاستئناف غير مكتملة'},400);
  const c=await db.prepare("SELECT id FROM court_cases WHERE id=? AND status='judged' AND (plaintiff_id=? OR defendant_id=? OR EXISTS(SELECT 1 FROM court_counsel WHERE case_id=? AND lawyer_id=? AND status='accepted'))").bind(b.case_id,user.id,user.id,b.case_id,user.id).first();if(!c)return json({error:'لا يمكنك استئناف هذه القضية أو لم يصدر حكم'},403);
  const id=random();try{await db.prepare('INSERT INTO court_appeals(id,case_id,appellant_id,reason) VALUES(?,?,?,?)').bind(id,b.case_id,user.id,b.reason.trim()).run()}catch{return json({error:'يوجد استئناف سابق منك لهذه القضية'},409)}await audit(db,user.id,'court_appeal_file','court_appeal',id,{case_id:b.case_id});return json({ok:true,id},201);
 }
 if(method==='GET'&&path==='/api/justice16/appeals'){
  const r=judge?await db.prepare('SELECT a.id,a.case_id,a.status,a.reason,a.created_at,c.reference FROM court_appeals a JOIN court_cases c ON c.id=a.case_id ORDER BY a.created_at DESC LIMIT 100').all():await db.prepare('SELECT a.id,a.case_id,a.status,a.reason,a.created_at,c.reference FROM court_appeals a JOIN court_cases c ON c.id=a.case_id WHERE a.appellant_id=? ORDER BY a.created_at DESC LIMIT 100').bind(user.id).all();return json({appeals:r.results,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/justice16/appeals/review'){
  if(!judge)return json({error:'صلاحية القضاء مطلوبة'},403);const b=await input(req);if(!b||!validText(b.id,10,80)||!['accepted','rejected','decided'].includes(b.status)||!validText(b.note,5,3000))return json({error:'بيانات غير صالحة'},400);
  const r=await db.prepare("UPDATE court_appeals SET status=?,decision_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('submitted','accepted')").bind(b.status,b.note.trim(),user.id,b.id).run();if(!r.meta.changes)return json({error:'الاستئناف غير موجود أو انتهى'},409);await audit(db,user.id,'court_appeal_review','court_appeal',b.id,{status:b.status});return json({ok:true});
 }
 return json({error:'المسار غير موجود'},404);
}

// Phase 15: court case access is enforced on the server; no public docket.
if(path.startsWith('/api/courts/')){
 const judge=await can('justice');
 const involved=async id=>db.prepare(`SELECT c.* FROM court_cases c WHERE c.id=? AND (c.plaintiff_id=? OR c.defendant_id=? OR EXISTS (SELECT 1 FROM court_counsel cc WHERE cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active')))`).bind(id,user.id,user.id,user.id).first();
 const permitted=async id=>judge?db.prepare('SELECT * FROM court_cases WHERE id=?').bind(id).first():involved(id);
 const event=async(id,type,details)=>db.prepare('INSERT INTO court_events(id,case_id,actor_id,event_type,details) VALUES(?,?,?,?,?)').bind(random(),id,user.id,type,details).run();
 if(method==='GET'&&path==='/api/courts/list'){
  const r=judge?await db.prepare('SELECT c.id,c.reference,c.title,c.kind,c.status,c.created_at FROM court_cases c ORDER BY c.created_at DESC LIMIT 100').all():await db.prepare(`SELECT DISTINCT c.id,c.reference,c.title,c.kind,c.status,c.created_at FROM court_cases c LEFT JOIN court_counsel cc ON cc.case_id=c.id AND cc.lawyer_id=? AND cc.status='accepted' AND EXISTS(SELECT 1 FROM court_lawyers cl WHERE cl.user_id=cc.lawyer_id AND cl.status='active') WHERE c.plaintiff_id=? OR c.defendant_id=? OR cc.lawyer_id=? ORDER BY c.created_at DESC LIMIT 100`).bind(user.id,user.id,user.id,user.id).all();
  const lawyers=await db.prepare("SELECT user_id,display_name FROM court_lawyers WHERE status='active' ORDER BY display_name LIMIT 100").all();
  const mine=await db.prepare('SELECT status,license_number FROM court_lawyers WHERE user_id=?').bind(user.id).first();
  return json({cases:r.results,lawyers:lawyers.results,my_lawyer:mine,can_manage:judge});
 }
 if(method==='POST'&&path==='/api/courts/file'){
  const b=await input(req);if(!b||!['civil','commercial','administrative','family','criminal'].includes(b.kind)||!validText(b.title,5,160)||!validText(b.statement,10,5000)||!validText(b.defendant_name,2,160))return json({error:'بيانات القضية غير مكتملة'},400);
  const defendant=b.defendant_username?await db.prepare('SELECT id FROM users WHERE username=?').bind(String(b.defendant_username).trim().toLowerCase()).first():null;
  if(b.defendant_username&&!defendant)return json({error:'حساب المدعى عليه غير موجود'},404);
  if(defendant?.id===user.id)return json({error:'لا يمكن رفع قضية ضد حسابك'},400);
  const id=random(),reference='SAL-CASE-'+Date.now().toString(36).toUpperCase()+'-'+id.slice(0,5).toUpperCase();
  await db.prepare('INSERT INTO court_cases(id,reference,plaintiff_id,defendant_id,defendant_name,kind,title,statement) VALUES(?,?,?,?,?,?,?,?)').bind(id,reference,user.id,defendant?.id||null,b.defendant_name.trim(),b.kind,b.title.trim(),b.statement.trim()).run();await event(id,'filed','تم إيداع القضية');await audit(db,user.id,'court_file','court_case',id,{reference});return json({id,reference},201);
 }
 if(method==='GET'&&path==='/api/courts/detail'){
  const id=u.searchParams.get('id');if(!id)return json({error:'معرف القضية مطلوب'},400);const c=await permitted(id);if(!c)return json({error:'القضية غير موجودة أو لا تملك صلاحية الاطلاع'},404);
  const hearings=await db.prepare('SELECT id,starts_at,location,notes FROM court_hearings WHERE case_id=? ORDER BY starts_at').bind(id).all();
  const counsel=await db.prepare('SELECT cc.lawyer_id,cc.client_id,cc.status,l.display_name FROM court_counsel cc JOIN court_lawyers l ON l.user_id=cc.lawyer_id WHERE cc.case_id=?').bind(id).all();
  const events=await db.prepare('SELECT event_type,details,created_at FROM court_events WHERE case_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();
  return json({case:c,hearings:hearings.results,counsel:counsel.results,events:events.results,can_manage:judge,is_party:c.plaintiff_id===user.id||c.defendant_id===user.id});
 }
 if(method==='POST'&&path==='/api/courts/lawyer/apply'){
  const b=await input(req);if(!b||!validText(b.display_name,3,120)||!validText(b.license_number,4,60))return json({error:'الاسم ورقم ترخيص المحاماة مطلوبان'},400);
  try{await db.prepare('INSERT INTO court_lawyers(user_id,license_number,display_name) VALUES(?,?,?)').bind(user.id,b.license_number.trim(),b.display_name.trim()).run()}catch{return json({error:'طلب المحامي أو رقم الترخيص موجود مسبقًا'},409)}await audit(db,user.id,'lawyer_apply','court_lawyer',user.id,{});return json({ok:true},201);
 }
 if(method==='GET'&&path==='/api/courts/lawyer/pending'){
  if(!judge)return json({error:'غير مخول'},403);const r=await db.prepare("SELECT l.user_id,l.display_name,l.license_number,l.status,u.username FROM court_lawyers l JOIN users u ON u.id=l.user_id WHERE l.status='pending'").all();return json({lawyers:r.results});
 }
 if(method==='POST'&&path==='/api/courts/lawyer/approve'){
  if(!judge)return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.user_id,10,80)||!['active','suspended'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
  const r=await db.prepare("UPDATE court_lawyers SET status=?,approved_by=? WHERE user_id=? AND status IN ('pending','active','suspended')").bind(b.status,user.id,b.user_id).run();if(!r.meta.changes)return json({error:'المحامي غير موجود'},404);await audit(db,user.id,'lawyer_review','court_lawyer',b.user_id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/courts/counsel/request'){
  const b=await input(req);if(!b||!validText(b.case_id,10,80)||!validText(b.lawyer_id,10,80))return json({error:'بيانات التوكيل غير صالحة'},400);
  const c=await involved(b.case_id);if(!c||(c.plaintiff_id!==user.id&&c.defendant_id!==user.id))return json({error:'التوكيل متاح لأطراف القضية فقط'},403);
  const l=await db.prepare("SELECT user_id FROM court_lawyers WHERE user_id=? AND status='active'").bind(b.lawyer_id).first();if(!l)return json({error:'المحامي غير معتمد'},409);
  try{await db.prepare('INSERT INTO court_counsel(case_id,lawyer_id,client_id) VALUES(?,?,?)').bind(b.case_id,b.lawyer_id,user.id).run()}catch{return json({error:'طلب التوكيل مسجل مسبقًا'},409)}await event(b.case_id,'counsel_requested','طلب توكيل محام');return json({ok:true},201);
 }
 if(method==='POST'&&path==='/api/courts/counsel/respond'){
  const b=await input(req);if(!b||!validText(b.case_id,10,80)||!validText(b.client_id,10,80)||!['accepted','rejected'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
  const l=await db.prepare("SELECT 1 FROM court_lawyers WHERE user_id=? AND status='active'").bind(user.id).first();if(!l)return json({error:'المحامي غير معتمد'},403);
  const r=await db.prepare("UPDATE court_counsel SET status=? WHERE case_id=? AND lawyer_id=? AND client_id=? AND status='requested'").bind(b.status,b.case_id,user.id,b.client_id).run();if(!r.meta.changes)return json({error:'لا يوجد طلب توكيل معلق'},404);await event(b.case_id,'counsel_response',b.status);return json({ok:true});
 }
 if(method==='GET'&&path==='/api/courts/counsel/invitations'){
  const r=await db.prepare("SELECT cc.case_id,cc.client_id,c.reference,c.title FROM court_counsel cc JOIN court_cases c ON c.id=cc.case_id WHERE cc.lawyer_id=? AND cc.status='requested'").bind(user.id).all();return json({invitations:r.results});
 }
 if(method==='POST'&&path==='/api/courts/manage'){
  if(!judge)return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.case_id,10,80)||!['review','scheduled','heard','judged','closed'].includes(b.status)||!validText(b.note,3,3000))return json({error:'القرار أو الملاحظات غير صالحة'},400);
  const c=await db.prepare('SELECT status FROM court_cases WHERE id=?').bind(b.case_id).first();if(!c)return json({error:'القضية غير موجودة'},404);const transitions={filed:['review','closed'],review:['scheduled','closed'],scheduled:['heard','closed'],heard:['judged','scheduled','closed'],judged:['closed'],closed:[]};if(!transitions[c.status]?.includes(b.status))return json({error:'انتقال حالة القضية غير مسموح؛ اتبع مراحل النظر والحكم'},409);
  if(b.status==='judged'&&!validText(b.judgment,10,5000))return json({error:'نص الحكم مطلوب'},400);
  const r=await db.prepare("UPDATE court_cases SET status=?,judgment=CASE WHEN ?='judged' THEN ? ELSE judgment END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(b.status,b.status,b.status==='judged'?b.judgment.trim():null,b.case_id,c.status).run();if(!r.meta.changes)return json({error:'تغيرت حالة القضية؛ أعد التحميل'},409);
  await event(b.case_id,b.status,b.note.trim());await audit(db,user.id,'court_decision','court_case',b.case_id,{from:c.status,to:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/courts/hearing'){
  if(!judge)return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.case_id,10,80)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.starts_at||'')||!validText(b.location,3,160))return json({error:'بيانات الجلسة غير صالحة'},400);
  const c=await db.prepare('SELECT id FROM court_cases WHERE id=?').bind(b.case_id).first();if(!c)return json({error:'القضية غير موجودة'},404);
  const id=random();await db.prepare('INSERT INTO court_hearings(id,case_id,starts_at,location,notes,created_by) VALUES(?,?,?,?,?,?)').bind(id,b.case_id,b.starts_at,b.location.trim(),String(b.notes||'').slice(0,1000),user.id).run();await event(b.case_id,'hearing_scheduled',b.starts_at);return json({id},201);
 }
 return json({error:'مسار غير موجود'},404);
}

// Phase 14: customer approves an existing merchant POS request with internal installments.
if(method==='POST'&&path==='/api/installments/checkout'){
 const b=await input(req);
 if(!b||!validText(b.payment_id,10,80)||!['tabby','tamara'].includes(b.provider))return json({error:'بيانات الشراء بالتقسيط غير صالحة'},400);
 const p=await db.prepare("SELECT p.id,p.amount,m.name merchant,m.owner_id,m.account_id FROM pos_payments p JOIN pos_merchants m ON m.id=p.merchant_id WHERE p.id=? AND p.customer_id=? AND p.status='pending' AND p.created_at>=datetime('now','-24 hours')").bind(b.payment_id,user.id).first();
 if(!p)return json({error:'طلب الدفع غير متاح أو انتهت صلاحيته'},409);
 if(p.amount<4||p.amount>5000||p.owner_id===user.id)return json({error:'المبلغ غير مؤهل للتقسيط'},400);
 const planId=random(),settlementId=random();
 const chunks=Array.from({length:4},(_,i)=>Math.floor(p.amount/4)+(i<p.amount%4?1:0));
 const dues=chunks.map((amount,i)=>{const date=new Date();date.setUTCDate(date.getUTCDate()+i*30);return {id:random(),amount,date:date.toISOString().slice(0,10)}});
 try{await db.batch([
  db.prepare("INSERT INTO installment_plans(id,user_id,provider,merchant,amount,status) VALUES(?,?,?,?,?,'active')").bind(planId,user.id,b.provider,p.merchant,p.amount),
  ...dues.map((d,i)=>db.prepare('INSERT INTO installment_dues(id,plan_id,installment_number,amount,due_date) VALUES(?,?,?,?,?)').bind(d.id,planId,i+1,d.amount,d.date)),
  db.prepare('INSERT INTO installment_pos_settlements(id,pos_payment_id,plan_id,provider,amount) VALUES(?,?,?,?,?)').bind(settlementId,p.id,planId,b.provider,p.amount),
  db.prepare('INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)').bind(random(),user.id,'installment_pos_checkout','pos_payment',p.id,JSON.stringify({provider:b.provider,amount:p.amount,plan_id:planId})),
  db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),null,user.id,'تأكيد شراء بالتقسيط',`تم شراء طلب ${p.id} عبر ${b.provider} بقيمة ${p.amount} ريال صالي، على أربعة أقساط.`),
  db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),null,p.owner_id,'إيداع عملية تقسيط',`تم إيداع ${p.amount} ريال صالي من طلب ${p.id} في حساب متجرك.`)
 ])}catch{return json({error:'تعذر إتمام التقسيط؛ تحقق من حدك المتاح أو حالة الطلب'},409)}
 return json({ok:true,plan_id:planId,receipt_id:p.id,dues},201);
}
if(method==='GET'&&path==='/api/installments/settlements'){
 const r=await db.prepare('SELECT s.pos_payment_id,s.plan_id,s.provider,s.amount,s.created_at FROM installment_pos_settlements s JOIN installment_plans p ON p.id=s.plan_id WHERE p.user_id=? ORDER BY s.created_at DESC LIMIT 100').bind(user.id).all();return json({settlements:r.results});
}
// Phase 13: state budget proposals, Finance review and royal approval.
if(path.startsWith('/api/state-budgets/')){
 const king=user.role==='king';
 const finance=king||await can('finance');
 const proposer=king||await can('budget_propose');
 if(method==='GET'&&path==='/api/state-budgets/list'){
  const rows=await db.prepare(`SELECT r.*,u.username requester, f.username finance_reviewer, k.username king_reviewer FROM state_budget_requests r JOIN users u ON u.id=r.requested_by LEFT JOIN users f ON f.id=r.finance_by LEFT JOIN users k ON k.id=r.king_by WHERE (?=1 OR r.requested_by=?) ORDER BY r.created_at DESC LIMIT 200`).bind(finance?1:0,user.id).all();
  return json({requests:rows.results,can_propose:proposer,can_review:finance,can_approve:king});
 }
 if(method==='GET'&&path==='/api/state-budgets/events'){
  const id=u.searchParams.get('id');const r=await db.prepare('SELECT requested_by FROM state_budget_requests WHERE id=?').bind(id).first();if(!r)return json({error:'الطلب غير موجود'},404);if(!finance&&r.requested_by!==user.id)return json({error:'غير مخول'},403);
  const events=await db.prepare('SELECT e.*,u.username actor FROM state_budget_events e JOIN users u ON u.id=e.actor_id WHERE e.request_id=? ORDER BY e.created_at,e.rowid').bind(id).all();return json({events:events.results});
 }
 if(method==='POST'&&path==='/api/state-budgets/propose'){
  if(!proposer)return json({error:'ليس لديك صلاحية اقتراح الميزانيات'},403);
  const b=await input(req);if(!b||!validText(b.entity_name,3,160)||!['ministry','governorate'].includes(b.entity_type)||!Number.isSafeInteger(b.fiscal_year)||b.fiscal_year<2026||b.fiscal_year>2100||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>1000000000||!validText(b.justification,10,2000))return json({error:'بيانات المقترح غير صالحة'},400);
  const id=random();await db.batch([db.prepare('INSERT INTO state_budget_requests(id,entity_name,entity_type,fiscal_year,amount,justification,requested_by) VALUES(?,?,?,?,?,?,?)').bind(id,b.entity_name.trim(),b.entity_type,b.fiscal_year,b.amount,b.justification.trim(),user.id),db.prepare('INSERT INTO state_budget_events(id,request_id,actor_id,previous_status,new_status,note) VALUES(?,?,?,?,?,?)').bind(random(),id,user.id,null,'submitted','تقديم المقترح')]);await audit(db,user.id,'budget_propose','state_budget',id,{amount:b.amount,entity:b.entity_name});return json({id,status:'submitted'},201);
 }
 if(method==='POST'&&path==='/api/state-budgets/review'){
  if(!finance)return json({error:'المراجعة لوزارة المالية فقط'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['finance_approved','finance_rejected'].includes(b.status)||!validText(b.note,3,1000))return json({error:'أدخل القرار وملاحظات المراجعة'},400);
  const old=await db.prepare('SELECT status FROM state_budget_requests WHERE id=?').bind(b.id).first();if(!old)return json({error:'المقترح غير موجود'},404);if(old.status!=='submitted')return json({error:'سبق مراجعة هذا المقترح'},409);
  const change=await db.prepare("UPDATE state_budget_requests SET status=?,finance_by=?,finance_note=?,finance_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(b.status,user.id,b.note.trim(),b.id).run();if(change.meta.changes!==1)return json({error:'تغيرت حالة المقترح؛ أعد التحميل'},409);
  await db.prepare('INSERT INTO state_budget_events(id,request_id,actor_id,previous_status,new_status,note) VALUES(?,?,?,?,?,?)').bind(random(),b.id,user.id,'submitted',b.status,b.note.trim()).run();await audit(db,user.id,'budget_finance_review','state_budget',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/state-budgets/royal-decision'){
  if(!king)return json({error:'الاعتماد النهائي للملك فقط'},403);
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['king_approved','king_rejected'].includes(b.status)||!validText(b.note,3,1000))return json({error:'أدخل القرار الملكي وملاحظاته'},400);
  const old=await db.prepare('SELECT status FROM state_budget_requests WHERE id=?').bind(b.id).first();if(!old)return json({error:'المقترح غير موجود'},404);if(old.status!=='finance_approved')return json({error:'لا يمكن اعتماد مقترح لم توافق عليه المالية'},409);
  const change=await db.prepare("UPDATE state_budget_requests SET status=?,king_by=?,king_note=?,king_at=CURRENT_TIMESTAMP WHERE id=? AND status='finance_approved'").bind(b.status,user.id,b.note.trim(),b.id).run();if(change.meta.changes!==1)return json({error:'تغيرت حالة المقترح؛ أعد التحميل'},409);
  await db.prepare('INSERT INTO state_budget_events(id,request_id,actor_id,previous_status,new_status,note) VALUES(?,?,?,?,?,?)').bind(random(),b.id,user.id,'finance_approved',b.status,b.note.trim()).run();await audit(db,user.id,'budget_royal_decision','state_budget',b.id,{status:b.status});return json({ok:true});
 }
}

// Phase 11: budget-backed payroll (simulated currency).
if(path.startsWith('/api/payroll/')){
 const admin=user.role==='king';
 if(method==='GET'&&path==='/api/payroll/mine'){
  const c=await db.prepare('SELECT id,employer,title,salary,active,created_at FROM employment_contracts WHERE employee_id=? ORDER BY created_at DESC').bind(user.id).all();
  const p=await db.prepare('SELECT p.id,p.period,p.amount,p.created_at,c.employer,c.title FROM payroll_payments p JOIN employment_contracts c ON c.id=p.contract_id WHERE c.employee_id=? ORDER BY p.period DESC LIMIT 100').bind(user.id).all();const botPay=await db.prepare("SELECT p.id,p.period_start period,p.amount,p.created_at,c.employer,c.title FROM shared_company_salary_payments p JOIN employment_contracts c ON c.id=p.contract_id WHERE c.employee_id=? ORDER BY p.period_start DESC LIMIT 100").bind(user.id).all();return json({contracts:c.results,payments:[...p.results,...botPay.results]});
 }
 if(method==='GET'&&path==='/api/payroll/leave/mine'){
  const rows=await db.prepare("SELECT l.id,l.contract_id,l.kind,l.start_date,l.end_date,l.reason,l.status,l.review_note,l.created_at,c.employer,c.title FROM employment_leave_requests l JOIN employment_contracts c ON c.id=l.contract_id WHERE l.employee_id=? ORDER BY l.created_at DESC LIMIT 100").bind(user.id).all();
  return json({leaves:rows.results});
 }
 if(method==='POST'&&path==='/api/payroll/leave/request'){
  const b=await input(req);
  if(!b||!validText(b.contract_id,10,80)||!['annual','sick','unpaid','emergency'].includes(b.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(b.start_date||'')||!/^\d{4}-\d{2}-\d{2}$/.test(b.end_date||'')||b.start_date>b.end_date||!validText(b.reason,5,500))return json({error:'بيانات الإجازة ناقصة أو التواريخ غير صحيحة'},400);
  const days=Math.round((Date.parse(b.end_date+'T00:00:00Z')-Date.parse(b.start_date+'T00:00:00Z'))/86400000)+1;
  if(!Number.isFinite(days)||days<1||days>90)return json({error:'مدة الإجازة غير صالحة (1 إلى 90 يوماً)'},400);
  const c=await db.prepare('SELECT id FROM employment_contracts WHERE id=? AND employee_id=? AND active=1').bind(b.contract_id,user.id).first();
  if(!c)return json({error:'العقد غير نشط أو لا يخص حسابك'},409);
  const clash=await db.prepare("SELECT 1 FROM employment_leave_requests WHERE contract_id=? AND status IN ('submitted','approved') AND start_date<=? AND end_date>=? LIMIT 1").bind(c.id,b.end_date,b.start_date).first();
  if(clash)return json({error:'يوجد طلب إجازة متداخل مع هذه المدة'},409);
  const id=random();
  await db.prepare("INSERT INTO employment_leave_requests(id,contract_id,employee_id,kind,start_date,end_date,reason) VALUES(?,?,?,?,?,?,?)").bind(id,c.id,user.id,b.kind,b.start_date,b.end_date,b.reason.trim()).run();
  await audit(db,user.id,'employment_leave_request','employment_leave_requests',id,{kind:b.kind,start:b.start_date,end:b.end_date});
  return json({id,status:'submitted'},201);
 }
 if(method==='GET'&&path==='/api/payroll/resignations/mine'){
  const rows=await db.prepare("SELECT r.id,r.contract_id,r.status,r.reason,r.created_at,r.defer_until,r.review_note,r.resolved_at,c.employer,c.title FROM employment_resignations r JOIN employment_contracts c ON c.id=r.contract_id WHERE r.employee_id=? ORDER BY r.created_at DESC LIMIT 50").bind(user.id).all();
  return json({resignations:rows.results});
 }
 if(method==='POST'&&path==='/api/payroll/resign'){
  const b=await input(req);if(!b||!validText(b.contract_id,10,80)||!validText(b.reason,5,1000))return json({error:'حدد العقد واكتب سبب الاستقالة'},400);
  const c=await db.prepare('SELECT id,active FROM employment_contracts WHERE id=? AND employee_id=?').bind(b.contract_id,user.id).first();
  if(!c||!c.active)return json({error:'العقد غير نشط أو غير مملوك لك'},409);
  const pending=await db.prepare("SELECT id FROM employment_resignations WHERE contract_id=? AND status IN ('submitted','deferred')").bind(c.id).first();
  if(pending)return json({error:'يوجد طلب استقالة قائم بالفعل'},409);
  const id=random();try{await db.prepare("INSERT INTO employment_resignations(id,contract_id,employee_id,reason) VALUES(?,?,?,?)").bind(id,c.id,user.id,b.reason.trim()).run()}catch{return json({error:'يوجد طلب استقالة قائم أو حدث تعارض'},409)}
  await audit(db,user.id,'employment_resign','employment_resignations',id,{contract_id:c.id});
  return json({id,status:'submitted',review_days:30},201);
 }
 if(method==='POST'&&path==='/api/payroll/resign/withdraw'){
  const b=await input(req);if(!b||!validText(b.id,10,80))return json({error:'رقم الطلب غير صالح'},400);
  const r=await db.prepare("UPDATE employment_resignations SET status='withdrawn',resolved_at=CURRENT_TIMESTAMP WHERE id=? AND employee_id=? AND status='submitted' AND created_at>=datetime('now','-7 days')").bind(b.id,user.id).run();
  if(!r.meta.changes)return json({error:'انتهت مدة السحب أو صدر قرار بشأن الطلب'},409);
  await audit(db,user.id,'employment_resignation_withdraw','employment_resignations',b.id,{});return json({ok:true});
 }
 if(!admin)return json({error:'إدارة الرواتب للملك فقط'},403);
 if(method==='GET'&&path==='/api/payroll/leave/admin'){
  const rows=await db.prepare("SELECT l.*,c.employer,c.title,u.username FROM employment_leave_requests l JOIN employment_contracts c ON c.id=l.contract_id JOIN users u ON u.id=l.employee_id ORDER BY l.created_at DESC LIMIT 150").all();
  return json({leaves:rows.results});
 }
 if(method==='POST'&&path==='/api/payroll/leave/decision'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected'].includes(b.decision))return json({error:'قرار غير صالح'},400);
  const l=await db.prepare("SELECT id,employee_id,status FROM employment_leave_requests WHERE id=? AND status='submitted'").bind(b.id).first();
  if(!l)return json({error:'الطلب غير موجود أو تم البت فيه'},409);
  const note=String(b.note||'').trim().slice(0,500);
  if(b.decision==='rejected'&&!validText(note,5,500))return json({error:'سبب الرفض مطلوب'},400);
  const result=await db.prepare("UPDATE employment_leave_requests SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(b.decision,note,user.id,b.id).run();
  if(!result.meta.changes)return json({error:'تغيرت الحالة؛ حدث الصفحة'},409);
  await db.prepare("INSERT INTO notifications(id,user_id,subject,body) VALUES(?,?,?,?)").bind(random(),l.employee_id,'قرار طلب إجازة','حالة طلب الإجازة: '+b.decision).run();
  await audit(db,user.id,'employment_leave_decision','employment_leave_requests',l.id,{decision:b.decision});return json({ok:true});
 }
 if(method==='GET'&&path==='/api/payroll/resignations/admin'){
  const rows=await db.prepare("SELECT r.*,c.employer,c.title,u.username FROM employment_resignations r JOIN employment_contracts c ON c.id=r.contract_id JOIN users u ON u.id=r.employee_id ORDER BY r.created_at DESC LIMIT 150").all();return json({resignations:rows.results});
 }
 if(method==='POST'&&path==='/api/payroll/resign/decision'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['accepted','deferred'].includes(b.decision))return json({error:'قرار غير صالح'},400);
  const r=await db.prepare("SELECT id,status,contract_id,employee_id,created_at FROM employment_resignations WHERE id=? AND status='submitted'").bind(b.id).first();
  if(!r)return json({error:'الطلب غير موجود أو صدر فيه قرار'},409);
  const note=String(b.note||'').trim().slice(0,500);
  if(b.decision==='deferred'&&!validText(note,5,500))return json({error:'سبب تأجيل الاستقالة مطلوب'},400);
  if(b.decision==='deferred'){
   const r2=await db.prepare("UPDATE employment_resignations SET status='deferred',review_note=?,defer_until=datetime('now','+60 days') WHERE id=? AND status='submitted'").bind(note,r.id).run();
   if(!r2.meta.changes)return json({error:'تغيرت حالة الطلب'},409);
  }else{
   await db.batch([db.prepare("UPDATE employment_resignations SET status='accepted',review_note=?,resolved_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(note,r.id),db.prepare("UPDATE employment_contracts SET active=0 WHERE id=? AND employee_id=?").bind(r.contract_id,r.employee_id)]);
  }
  await audit(db,user.id,'employment_resignation_decision','employment_resignations',r.id,{decision:b.decision});return json({ok:true});
 }
 if(method==='GET'&&path==='/api/payroll/admin'){
  const budgets=await db.prepare('SELECT * FROM employer_budgets ORDER BY employer').all();
  const accepted=await db.prepare("SELECT a.id,a.applicant_id,u.username,v.employer,v.sector,v.title,v.salary FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id JOIN users u ON u.id=a.applicant_id LEFT JOIN employment_contracts c ON c.application_id=a.id WHERE a.status='accepted' AND c.id IS NULL ORDER BY a.created_at DESC LIMIT 100").all();
  const contracts=await db.prepare('SELECT c.*,u.username FROM employment_contracts c JOIN users u ON u.id=c.employee_id ORDER BY c.created_at DESC LIMIT 200').all();
  const payments=await db.prepare('SELECT p.*,c.employer,c.title,u.username FROM payroll_payments p JOIN employment_contracts c ON c.id=p.contract_id JOIN users u ON u.id=c.employee_id ORDER BY p.created_at DESC LIMIT 100').all();const botPay=await db.prepare('SELECT p.id,p.period_start period,p.amount,p.created_at,c.employer,c.title,u.username FROM shared_company_salary_payments p JOIN employment_contracts c ON c.id=p.contract_id JOIN users u ON u.id=c.employee_id ORDER BY p.created_at DESC LIMIT 100').all();return json({budgets:budgets.results,accepted:accepted.results,contracts:contracts.results,payments:[...payments.results,...botPay.results]});
 }
 if(method==='POST'&&path==='/api/payroll/contract'){
  const b=await input(req);if(!b||!validText(b.application_id,10,80))return json({error:'رقم طلب غير صالح'},400);
  const a=await db.prepare("SELECT a.applicant_id,v.employer,v.sector,v.title,v.salary FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id WHERE a.id=? AND a.status='accepted'").bind(b.application_id).first();if(!a)return json({error:'لا يوجد طلب توظيف مقبول'},404);
  const id=random();try{await db.batch([db.prepare('INSERT OR IGNORE INTO employer_budgets(employer,sector) VALUES(?,?)').bind(a.employer,a.sector),db.prepare('INSERT INTO employment_contracts(id,application_id,employee_id,employer,title,salary) VALUES(?,?,?,?,?,?)').bind(id,b.application_id,a.applicant_id,a.employer,a.title,a.salary)]);}catch{return json({error:'عقد موجود أو تعارض في بيانات جهة العمل'},409)}
  await audit(db,user.id,'create_employment_contract','employment_contract',id,{application_id:b.application_id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/payroll/fund'){
  const b=await input(req);if(!b||!validText(b.employer,2,140)||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>100000000)return json({error:'بيانات التمويل غير صالحة'},400);
  const r=await db.prepare('UPDATE employer_budgets SET balance=balance+? WHERE employer=? AND balance<=100000000000-?').bind(b.amount,b.employer.trim(),b.amount).run();if(!r.meta.changes)return json({error:'جهة العمل غير موجودة أو تجاوزت الحد'},404);
  await audit(db,user.id,'fund_employer_budget','employer_budget',b.employer,{amount:b.amount});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/payroll/contract/status'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||typeof b.active!=='boolean')return json({error:'طلب غير صالح'},400);
  if(b.active){const finalResign=await db.prepare("SELECT 1 FROM employment_resignations WHERE contract_id=? AND status='accepted' LIMIT 1").bind(b.id).first();if(finalResign)return json({error:'عقد انتهى بالاستقالة؛ لا يمكن إعادة تفعيله'},409)}const r=await db.prepare('UPDATE employment_contracts SET active=? WHERE id=?').bind(b.active?1:0,b.id).run();if(!r.meta.changes)return json({error:'العقد غير موجود'},404);await audit(db,user.id,'employment_status','employment_contract',b.id,{active:b.active});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/payroll/pay'){
  const b=await input(req);if(!b||!validText(b.contract_id,10,80)||typeof b.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.period))return json({error:'رقم العقد أو الشهر غير صالح'},400);
  const c=await db.prepare('SELECT * FROM employment_contracts WHERE id=? AND active=1').bind(b.contract_id).first();if(!c)return json({error:'العقد غير نشط'},404);
  const acct=await db.prepare("SELECT id FROM bank_accounts WHERE user_id=? ORDER BY CASE bank WHEN 'saliyah' THEN 0 ELSE 1 END LIMIT 1").bind(c.employee_id).first();if(!acct)return json({error:'الموظف يحتاج حسابًا بنكيًا'},409);
  const paid=await db.prepare('SELECT 1 FROM payroll_payments WHERE contract_id=? AND period=?').bind(c.id,b.period).first();if(paid)return json({error:'صرف راتب هذا الشهر مسبقًا'},409);
  const budget=await db.prepare('SELECT balance FROM employer_budgets WHERE employer=?').bind(c.employer).first();if(!budget||budget.balance<c.salary)return json({error:'ميزانية الجهة غير كافية'},409);
  const id=random();try{await db.batch([
   db.prepare('INSERT INTO payroll_payments(id,contract_id,period,amount,bank_account_id,paid_by) VALUES(?,?,?,?,?,?)').bind(id,c.id,b.period,c.salary,acct.id,user.id),
   db.prepare('UPDATE employer_budgets SET balance=balance-? WHERE employer=?').bind(c.salary,c.employer),
   db.prepare('UPDATE bank_accounts SET balance=balance+? WHERE id=?').bind(c.salary,acct.id),
   db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,c.employee_id,'إشعار إيداع راتب',`تم إيداع ${c.salary} ريال صالي عن ${b.period} من ${c.employer}`)
  ]);}catch{return json({error:'تعذر الصرف: تحقق من الرصيد أو عدم تكرار العملية'},409)}
  await audit(db,user.id,'pay_salary','payroll_payment',id,{contract_id:c.id,period:b.period,amount:c.salary});return json({id,amount:c.salary},201);
 }
}

// Phase 10: unified public/bot education admissions and verified academic history.
if(path.startsWith('/api/education/')){
 const manage=await can('education');
 if(method==='GET'&&path==='/api/education/institutions'){
  await syncEducationCatalog(db,env.SIMULATION_DB);
  const r=await db.prepare('SELECT id,name,level,sector,capacity,min_grade,fee,active FROM education_institutions WHERE active=1 OR ?=1 ORDER BY name,level').bind(manage?1:0).all();
  return json({institutions:r.results,can_manage:manage,stages:educationStageNames});
 }
 if(method==='POST'&&path==='/api/education/institutions'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);
  if(!b||!validText(b.name,2,120)||!educationStages.includes(b.level)||!['public','private'].includes(b.sector)||!Number.isInteger(b.capacity)||b.capacity<1||b.capacity>100000||!Number.isFinite(b.min_grade)||b.min_grade<0||b.min_grade>100||!Number.isSafeInteger(b.fee)||b.fee<0||b.fee>100000000)return json({error:'بيانات المؤسسة غير صالحة'},400);
  if(b.sector==='public'&&b.fee!==0)return json({error:'المؤسسة الحكومية بلا رسوم'},400);
  const id=random();await db.prepare('INSERT INTO education_institutions(id,name,level,sector,capacity,min_grade,fee,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.name.trim(),b.level,b.sector,b.capacity,b.min_grade,b.fee,user.id).run();
  await audit(db,user.id,'education_institution_create','institution',id,{name:b.name,level:b.level});return json({id},201);
 }
 if(method==='POST'&&path==='/api/education/apply'){
  const b=await input(req);
  if(!b||!validText(b.institution_id,10,100))return json({error:'اختر مؤسسة ومرحلة دراسية'},400);
  if(b.student_id!==undefined&&b.student_id!==user.id)return json({error:'تقديم ولي الأمر يتطلب ربطاً موثقاً'},403);
  await syncEducationCatalog(db,env.SIMULATION_DB);
  const inst=await db.prepare('SELECT * FROM education_institutions WHERE id=? AND active=1').bind(b.institution_id).first();
  if(!inst)return json({error:'المؤسسة أو المرحلة غير موجودة'},404);
  if(b.stage!==undefined&&b.stage!==inst.level)return json({error:'المرحلة المختارة لا تطابق المؤسسة'},400);
  const stage=educationStages.indexOf(inst.level);
  if(stage<0)return json({error:'مرحلة دراسية غير صالحة'},400);
  let verifiedGrade=null;
  if(stage>0){
   const prior=await db.prepare("SELECT COALESCE(g.retest_grade,g.original_grade) grade FROM education_grades g JOIN education_applications a ON a.id=g.application_id JOIN education_institutions i ON i.id=a.institution_id WHERE a.student_id=? AND a.status='accepted' AND i.level=? AND COALESCE(g.retest_grade,g.original_grade)>=70 ORDER BY g.updated_at DESC LIMIT 1").bind(user.id,educationStages[stage-1]).first();
   if(!prior)return json({error:'لا يمكن التسجيل: يجب إكمال المرحلة السابقة بدرجة 70 على الأقل (بدرجات موثقة في النظام)'},409);
   verifiedGrade=prior.grade;
  }
  const enrolled=await db.prepare("SELECT a.id FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.student_id=? AND a.status='accepted' AND i.level=? LIMIT 1").bind(user.id,inst.level).first();
  if(enrolled)return json({error:'لديك قبول نشط في هذه المرحلة بالفعل'},409);
  const id=random();
  try{await db.prepare('INSERT INTO education_applications(id,institution_id,student_id,previous_grade) VALUES(?,?,?,?)').bind(id,inst.id,user.id,verifiedGrade).run()}catch{return json({error:'سبق تقديم طلب لهذه المؤسسة'},409)}
  let status='submitted';
  if(inst.id.startsWith('sim-')){
   const qualifying=stage===0||verifiedGrade>=inst.min_grade;
   if(qualifying){
    const result=await db.prepare("UPDATE education_applications SET status='accepted',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted' AND (SELECT COUNT(*) FROM education_applications WHERE institution_id=? AND status='accepted') < ?").bind(id,inst.id,inst.capacity).run();
    status=result.meta.changes?'accepted':'rejected';
   }else status='rejected';
   if(status==='rejected')await db.prepare("UPDATE education_applications SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(id).run();
   await audit(db,user.id,'education_automated_review','education_application',id,{institution_id:inst.id,status,previous_grade:verifiedGrade});
  }
  await audit(db,user.id,'education_apply','education_application',id,{institution_id:inst.id,level:inst.level});
  return json({id,status},201);
 }
 if(method==='GET'&&path==='/api/education/applications'){
  const sql="SELECT a.*,i.name institution_name,i.level,i.min_grade FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id";
  const r=manage?await db.prepare(sql+" ORDER BY a.created_at DESC LIMIT 200").all():await db.prepare(sql+" WHERE a.student_id=? ORDER BY a.created_at DESC LIMIT 100").bind(user.id).all();
  return json({applications:r.results});
 }
 if(method==='POST'&&path==='/api/education/review'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);
  if(!b||!validText(b.id,10,80)||!['accepted','rejected'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
  const row=await db.prepare('SELECT a.*,i.capacity,i.min_grade,i.level FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.id=?').bind(b.id).first();
  if(!row)return json({error:'الطلب غير موجود'},404);
  if(row.status!=='submitted')return json({error:'سبقت مراجعة الطلب'},409);
  if(b.status==='accepted'){
   if(row.level!=='primary'&&(row.previous_grade===null||row.previous_grade<Math.max(70,row.min_grade)))return json({error:'الدرجات أقل من الحد المطلوب لهذه المدرسة'},409);
   const r=await db.prepare("UPDATE education_applications SET status='accepted',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted' AND (SELECT COUNT(*) FROM education_applications WHERE institution_id=? AND status='accepted') < ? AND NOT EXISTS (SELECT 1 FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.student_id=? AND a.status='accepted' AND i.level=?)").bind(user.id,b.id,row.institution_id,row.capacity,row.student_id,row.level).run();
   if(!r.meta.changes)return json({error:'اكتملت المقاعد أو سبق قبول الطالب في المرحلة'},409);
  }else{const r=await db.prepare("UPDATE education_applications SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(user.id,b.id).run();if(!r.meta.changes)return json({error:'سبق اعتماد الطلب'},409)}
  await audit(db,user.id,'education_review','education_application',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/education/grade'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);
  if(!b||!validText(b.application_id,10,80)||typeof b.grade!=='number'||b.grade<0||b.grade>100||!Number.isFinite(b.grade)||!(b.retest===undefined||typeof b.retest==='boolean'))return json({error:'درجة غير صالحة'},400);
  const row=await db.prepare("SELECT id FROM education_applications WHERE id=? AND status='accepted'").bind(b.application_id).first();
  if(!row)return json({error:'لا يوجد قبول معتمد'},404);
  const prior=await db.prepare('SELECT * FROM education_grades WHERE application_id=?').bind(b.application_id).first();
  if(b.retest){
   if(!prior||prior.original_grade>=70||prior.retest_grade!==null)return json({error:'إعادة الاختبار متاحة مرة واحدة فقط لمن درجته أقل من 70'},409);
   const x=await db.prepare('UPDATE education_grades SET retest_grade=?,recorded_by=?,updated_at=CURRENT_TIMESTAMP WHERE application_id=? AND retest_grade IS NULL').bind(b.grade,user.id,b.application_id).run();if(!x.meta.changes)return json({error:'تم تسجيل الإعادة مسبقاً'},409);
  }else{
   if(prior)return json({error:'الدرجة الأصلية مسجلة؛ لا يمكن تعديلها أو استبدالها'},409);
   await db.prepare('INSERT INTO education_grades(id,application_id,original_grade,recorded_by) VALUES(?,?,?,?)').bind(random(),b.application_id,b.grade,user.id).run();
  }
  await audit(db,user.id,'education_grade','education_application',b.application_id,{grade:b.grade,retest:!!b.retest});
  return json({ok:true,result:educationRating(b.grade),passed:b.grade>=70});
 }
 if(method==='GET'&&path==='/api/education/transcript'){
  const sql='SELECT g.*,a.student_id,i.name institution_name,i.level FROM education_grades g JOIN education_applications a ON a.id=g.application_id JOIN education_institutions i ON i.id=a.institution_id';
  const r=manage?await db.prepare(sql+' ORDER BY g.updated_at DESC LIMIT 200').all():await db.prepare(sql+' WHERE a.student_id=? ORDER BY g.updated_at DESC').bind(user.id).all();
  return json({grades:r.results.map(x=>({...x,final_grade:x.retest_grade??x.original_grade,result:educationRating(x.retest_grade??x.original_grade),passed:(x.retest_grade??x.original_grade)>=70}))});
 }
 if(method==='GET'&&path==='/api/education/bot-enrollments'){
  if(!manage)return json({error:'غير مخول'},403);
  const rows=await sharedRows(db,"SELECT e.id,e.citizen_id,c.name student_name,i.name institution_name,e.status,e.enrolled_at FROM saliyah_sim_enrollments e LEFT JOIN saliyah_sim_citizens c ON c.id=e.citizen_id LEFT JOIN saliyah_sim_institutions i ON i.id=e.institution_id ORDER BY e.enrolled_at DESC LIMIT 100");
  return json({enrollments:rows});
 }
 return json({error:'مسار غير معروف'},404);
}

// Phase 9: internal border and customs processing (never an external passport check).
if(path.startsWith('/api/borders/')){
 if(!(await can('borders')))return json({error:'صلاحية المنافذ مطلوبة'},403);
 if(method==='GET'&&path==='/api/borders/posts'){
  const posts=await db.prepare('SELECT * FROM border_posts ORDER BY id').all();
  return json({posts:posts.results});
 }
 if(method==='GET'&&path==='/api/borders/movements'){
  const r=await db.prepare('SELECT m.id,m.direction,m.purpose,m.created_at,p.name post,d.type,d.number,d.full_name FROM border_movements m JOIN border_posts p ON p.id=m.post_id JOIN documents d ON d.id=m.document_id ORDER BY m.created_at DESC LIMIT 100').all();return json({movements:r.results});
 }
 if(method==='POST'&&path==='/api/borders/check'){
  const b=await input(req);if(!b||!validText(b.number,3,40))return json({error:'رقم الوثيقة مطلوب'},400);
  const d=await db.prepare('SELECT id,type,number,full_name,nationality,status,expires_at FROM documents WHERE number=?').bind(b.number.trim()).first();
  const circulars=d?(await db.prepare("SELECT id,reference,kind,confidentiality FROM circulars WHERE document_id=? AND status='active' AND (expires_at IS NULL OR expires_at>=date('now'))").bind(d.id).all()).results:[];
  const status=!d?'unregistered':d.status!=='valid'?d.status:d.expires_at<new Date().toISOString().slice(0,10)?'expired':circulars.length?'circular':'valid';
  const checkId=random();await db.prepare('INSERT INTO document_checks(id,document_number,document_id,checked_by,result,reason) VALUES(?,?,?,?,?,?)').bind(checkId,b.number.trim(),d?.id||null,user.id,status,'فحص منفذ حدودي').run();
  await audit(db,user.id,'border_check','document',d?.id||null,{checkId,status});
  return json({check_id:checkId,result:status,document:d,circulars:circulars.map(c=>({reference:c.reference,kind:c.kind,confidentiality:c.confidentiality}))});
 }
 if(method==='POST'&&path==='/api/borders/movement'){
  const b=await input(req);if(!b||!['entry','exit'].includes(b.direction)||!validText(b.post_id,3,30)||!validText(b.number,3,40)||!validText(b.purpose,2,250))return json({error:'بيانات الحركة ناقصة'},400);
  const post=await db.prepare('SELECT id FROM border_posts WHERE id=? AND active=1').bind(b.post_id).first();if(!post)return json({error:'المنفذ غير نشط'},404);
  const d=await db.prepare('SELECT id,status,expires_at FROM documents WHERE number=?').bind(b.number.trim()).first();if(!d||d.status!=='valid'||d.expires_at<new Date().toISOString().slice(0,10))return json({error:'الوثيقة غير صالحة للعبور'},409);
  const circular=await db.prepare("SELECT id FROM circulars WHERE document_id=? AND status='active' AND (expires_at IS NULL OR expires_at>=date('now')) LIMIT 1").bind(d.id).first();if(circular)return json({error:'يوجد تعميم نشط؛ لا يمكن تسجيل العبور'},409);
  const last=await db.prepare('SELECT direction FROM border_movements WHERE document_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(d.id).first();
  if(last?.direction===b.direction)return json({error:'آخر حركة مسجلة من النوع نفسه؛ راجع السجل'},409);
  const id=random();await db.prepare('INSERT INTO border_movements(id,post_id,document_id,direction,purpose,actor_id) VALUES(?,?,?,?,?,?)').bind(id,post.id,d.id,b.direction,b.purpose.trim(),user.id).run();await audit(db,user.id,'border_movement','border_movement',id,{post:post.id,direction:b.direction});return json({id},201);
 }
 if(method==='GET'&&path==='/api/borders/customs'){
  const r=await db.prepare('SELECT c.id,c.description,c.quantity,c.status,c.created_at,p.name post FROM customs_declarations c JOIN border_posts p ON p.id=c.post_id ORDER BY c.created_at DESC LIMIT 100').all();return json({declarations:r.results});
 }
 if(method==='POST'&&path==='/api/borders/customs'){
  const b=await input(req);if(!b||!validText(b.post_id,3,30)||!validText(b.description,3,500)||!Number.isSafeInteger(b.quantity)||b.quantity<1||b.quantity>1000000)return json({error:'بيانات الشحنة غير صالحة'},400);
  const post=await db.prepare('SELECT id FROM border_posts WHERE id=? AND active=1').bind(b.post_id).first();if(!post)return json({error:'المنفذ غير متاح'},404);
  const id=random();await db.prepare('INSERT INTO customs_declarations(id,post_id,description,quantity,actor_id) VALUES(?,?,?,?,?)').bind(id,post.id,b.description.trim(),b.quantity,user.id).run();await audit(db,user.id,'customs_submit','customs_declaration',id,{post:post.id});return json({id},201);
 }
 if(method==='POST'&&path==='/api/borders/customs/status'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['submitted','inspecting','cleared','held'].includes(b.status))return json({error:'حالة غير صالحة'},400);
  const r=await db.prepare('UPDATE customs_declarations SET status=? WHERE id=?').bind(b.status,b.id).run();if(!r.meta.changes)return json({error:'الشحنة غير موجودة'},404);
  await audit(db,user.id,'customs_status','customs_declaration',b.id,{status:b.status});return json({ok:true});
 }
}

// Phase 8: simulated telecom subscriptions and person-to-person SMS.
if(method==='GET'&&path==='/api/telecom/lines'){
 const r=await db.prepare('SELECT id,number,carrier,plan_name,data_mb,data_remaining_mb,expires_at,status,created_at FROM telecom_lines WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all();return json({lines:r.results});
}
if(method==='POST'&&path==='/api/telecom/lines'){
 const b=await input(req);if(!b||!['stc','zain'].includes(b.carrier))return json({error:'اختر شركة اتصال صحيحة'},400);
 const count=await db.prepare('SELECT COUNT(*) n FROM telecom_lines WHERE user_id=?').bind(user.id).first();if(count.n>=3)return json({error:'الحد الأقصى ثلاث شرائح لكل حساب'},409);
 const id=random();let number=null;for(let i=0;i<8;i++){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);const candidate='05'+String(bytes[0]%100000000).padStart(8,'0');try{await db.prepare('INSERT INTO telecom_lines(id,user_id,number,carrier) VALUES(?,?,?,?)').bind(id,user.id,candidate,b.carrier).run();number=candidate;break}catch(e){if(!String(e).includes('UNIQUE'))throw e;}}
 if(!number)return json({error:'تعذر تخصيص رقم، حاول مجددًا'},503);await audit(db,user.id,'telecom_line_issue','telecom_line',id,{carrier:b.carrier});return json({id,number},201);
}
const TELECOM_PRICES={stc_basic:{carrier:'stc',price:3450,mb:1024,days:28},stc_50:{carrier:'stc',price:5750,mb:2048,days:28},stc_120:{carrier:'stc',price:13800,mb:46080,days:28},zain_flex69:{carrier:'zain',price:7935,mb:10240,days:28},zain_flex109:{carrier:'zain',price:12535,mb:35840,days:28}};
if(method==='POST'&&path==='/api/telecom/plan'){
 const b=await input(req);const plan=TELECOM_PRICES[b?.plan];
 if(!plan||!validText(b.line_id,10,80)||!validText(b.account_id,10,80))return json({error:'اختر الباقة والحساب البنكي'},400);
 const line=await db.prepare("SELECT id,carrier FROM telecom_lines WHERE id=? AND user_id=? AND status='active'").bind(b.line_id,user.id).first();
 if(!line||line.carrier!==plan.carrier)return json({error:'الباقة لا تتوافق مع شريحتك'},400);
 const account=await db.prepare("SELECT id,balance,halala FROM bank_accounts WHERE id=? AND user_id=?").bind(b.account_id,user.id).first();
 if(!account)return json({error:'الحساب البنكي غير متاح'},403);
 if(account.balance*100+account.halala<plan.price)return json({error:'الرصيد غير كافٍ'},409);
 const id=random();
 try{await db.batch([
 db.prepare("UPDATE bank_accounts SET balance=CAST(((balance*100+halala)-?)/100 AS INTEGER),halala=((balance*100+halala)-?)%100 WHERE id=? AND user_id=? AND balance*100+halala>=?").bind(plan.price,plan.price,account.id,user.id,plan.price),
 db.prepare("INSERT INTO telecom_purchases(id,line_id,account_id,plan,amount_halala) VALUES(?,?,?,?,?)").bind(id,line.id,account.id,b.plan,plan.price),
 db.prepare("UPDATE telecom_lines SET plan_name=?,data_mb=?,data_remaining_mb=?,expires_at=datetime('now',?) WHERE id=?").bind(b.plan,plan.mb,plan.mb,'+'+plan.days+' days',line.id)
 ])}catch{return json({error:'تعذر إتمام الدفع؛ راجع رصيد الحساب'},409)}
 await audit(db,user.id,'telecom_plan_paid','telecom_line',line.id,{plan:b.plan,amount_halala:plan.price,account_id:account.id});
 return json({ok:true,receipt_id:id,amount_halala:plan.price,data_mb:plan.mb});
}
if(method==='POST'&&path==='/api/telecom/browse'){
 const b=await input(req);if(!b||!validText(b.line_id,10,80))return json({error:'اختر الشريحة'},400);
 const line=await db.prepare("SELECT id,data_remaining_mb FROM telecom_lines WHERE id=? AND user_id=? AND status='active' AND expires_at>datetime('now')").bind(b.line_id,user.id).first();
 if(!line||line.data_remaining_mb<1)return json({error:'لا توجد بيانات متاحة في باقتك'},409);
 const used=1;const r=await db.prepare("UPDATE telecom_lines SET data_remaining_mb=data_remaining_mb-? WHERE id=? AND data_remaining_mb>=?").bind(used,line.id,used).run();
 if(!r.meta.changes)return json({error:'انتهت البيانات'},409);
 await db.prepare("INSERT INTO telecom_usage(id,line_id,kind,units) VALUES(?,?,?,?)").bind(random(),line.id,'browse_mb',used).run();
 return json({ok:true,used_mb:used,remaining_mb:line.data_remaining_mb-used});
}
if(method==='GET'&&path==='/api/telecom/usage'){
 const line=u.searchParams.get('line');const owned=await db.prepare('SELECT id FROM telecom_lines WHERE id=? AND user_id=?').bind(line||'',user.id).first();
 if(!owned)return json({error:'الشريحة لا تخصك'},403);
 const r=await db.prepare('SELECT kind,units,created_at FROM telecom_usage WHERE line_id=? ORDER BY created_at DESC LIMIT 50').bind(line).all();
 return json({usage:r.results});
}
if(method==='GET'&&path==='/api/telecom/sms'){
 const line=u.searchParams.get('line');const owned=await db.prepare('SELECT id FROM telecom_lines WHERE id=? AND user_id=?').bind(line||'',user.id).first();if(!owned)return json({error:'الشريحة لا تخصك'},403);
 const r=await db.prepare('SELECT id,from_number,to_number,body,created_at FROM telecom_sms WHERE from_line_id=? OR to_line_id=? ORDER BY created_at DESC LIMIT 100').bind(line,line).all();
 const botMessages=await sharedRows(db,'SELECT s.contact_id id,s.from_number,s.to_number,c.message body,c.bot_reply,c.status,s.created_at FROM saliyah_sim_phone_sms s JOIN saliyah_sim_public_contacts c ON c.id=s.contact_id WHERE s.from_line_id=? AND c.user_id=? ORDER BY s.created_at DESC LIMIT 100',[line,user.id]);
 return json({messages:[...r.results,...botMessages].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100)});
}
if(method==='POST'&&path==='/api/telecom/sms'){
 const b=await input(req);if(!b||!validText(b.line_id,10,80)||!(/^(?:05[0-9]{8}|SIM-[0-9]{9})$/i.test(b.to_number||''))||!validText(b.body,1,500))return json({error:'رقم المستلم أو نص الرسالة غير صالح'},400);
 const from=await db.prepare("SELECT id,number FROM telecom_lines WHERE id=? AND user_id=? AND status='active'").bind(b.line_id,user.id).first();if(!from)return json({error:'الشريحة غير متاحة'},403);
 if(/^SIM-[0-9]{9}$/i.test(b.to_number)){
  if(!validText(b.body,5,500))return json({error:'رسائل البوتات لا تقل عن 5 أحرف'},400);
  const recipient=await db.prepare('SELECT target_type,target_id FROM saliyah_sim_public_phones WHERE phone_number=?').bind(b.to_number.toUpperCase()).first();
  if(!recipient)return json({error:'رقم الشريحة الافتراضية غير موجود'},404);
  const rate=await db.prepare("SELECT COUNT(*) n FROM saliyah_sim_public_contacts WHERE user_id=? AND created_at>=datetime('now','-1 day')").bind(user.id).first();
  if(Number(rate?.n||0)>=20)return json({error:'الحد اليومي 20 رسالة إلى البوتات'},429);
  const id=random();
  try{await db.batch([
   db.prepare('INSERT INTO saliyah_sim_public_contacts(id,user_id,target_type,target_id,message) VALUES(?,?,?,?,?)').bind(id,user.id,recipient.target_type,recipient.target_id,b.body.trim()),
   db.prepare('INSERT INTO saliyah_sim_phone_sms(contact_id,from_line_id,from_number,to_number) VALUES(?,?,?,?)').bind(id,from.id,from.number,b.to_number.toUpperCase())
  ])}catch{return json({error:'تعذر تسجيل الرسالة في شبكة الصالية الافتراضية'},409)}
  await audit(db,user.id,'telecom_bot_sms','saliyah_sim_public_contact',id,{number:b.to_number.toUpperCase(),target:recipient.target_type});
  return json({id,to_number:b.to_number.toUpperCase(),simulated:true,reply_pending:true},201);
 }
 const to=await db.prepare("SELECT id FROM telecom_lines WHERE number=? AND status='active'").bind(b.to_number).first();if(!to)return json({error:'الرقم غير مسجل في نظام الاتصالات الصالي'},404);
 const id=random();await db.prepare('INSERT INTO telecom_sms(id,from_line_id,to_line_id,from_number,to_number,body) VALUES(?,?,?,?,?,?)').bind(id,from.id,to.id,from.number,b.to_number,b.body.trim()).run();await audit(db,user.id,'telecom_sms_send','telecom_sms',id,{to:b.to_number});return json({id},201);
}
// Phase 7: merchant POS, one-time internal confirmation code, and receipts.
if(method==='POST'&&path==='/api/pos/merchant'){
 const b=await input(req);if(!b||!validText(b.name,3,100)||!validText(b.account_id,10,80))return json({error:'اسم المتجر والحساب مطلوبان'},400);
 const a=await db.prepare('SELECT id FROM bank_accounts WHERE id=? AND user_id=?').bind(b.account_id,user.id).first();if(!a)return json({error:'الحساب لا يخصك'},403);
 const id=random();try{await db.prepare('INSERT INTO pos_merchants(id,owner_id,account_id,name) VALUES(?,?,?,?)').bind(id,user.id,a.id,b.name.trim()).run()}catch{return json({error:'تعذر تسجيل المتجر'},409)}
 await audit(db,user.id,'pos_merchant_create','pos_merchant',id,{});return json({id},201);
}
if(method==='GET'&&path==='/api/pos/merchants'){
 const r=await db.prepare('SELECT m.id,m.name,m.account_id,m.created_at FROM pos_merchants m WHERE owner_id=? ORDER BY created_at DESC').bind(user.id).all();return json({merchants:r.results});
}
if(method==='POST'&&path==='/api/pos/request'){
 const b=await input(req);if(!b||!validText(b.merchant_id,10,80)||!saliyahAccountId(b.customer_iban)||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>1000000||typeof b.description!=='string'||b.description.length>200)return json({error:'بيانات طلب الدفع غير صالحة'},400);
 const m=await db.prepare('SELECT id FROM pos_merchants WHERE id=? AND owner_id=?').bind(b.merchant_id,user.id).first();if(!m)return json({error:'المتجر غير موجود'},404);
 const customer=await db.prepare('SELECT user_id id FROM bank_accounts WHERE id=?').bind(saliyahAccountId(b.customer_iban)).first();if(!customer||customer.id===user.id)return json({error:'المشتري غير موجود أو غير مسموح'},400);
 const id=random();await db.prepare('INSERT INTO pos_payments(id,merchant_id,customer_id,amount,description) VALUES(?,?,?,?,?)').bind(id,m.id,customer.id,b.amount,b.description.trim()).run();
 await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,customer.id,'طلب دفع من متجر صالي',`لديك طلب دفع رقم ${id} بقيمة ${b.amount} ريال صالي. افتح نقاط البيع لمراجعته.`).run();
 await audit(db,user.id,'pos_request','pos_payment',id,{amount:b.amount});return json({id},201);
}
if(method==='GET'&&path==='/api/pos/payments'){
 const r=await db.prepare(`SELECT p.id,p.amount,p.description,p.status,p.created_at,p.paid_at,p.card_id,m.name merchant,m.owner_id,cu.username customer FROM pos_payments p JOIN pos_merchants m ON m.id=p.merchant_id JOIN users cu ON cu.id=p.customer_id WHERE p.customer_id=? OR m.owner_id=? ORDER BY p.created_at DESC LIMIT 100`).bind(user.id,user.id).all();return json({payments:r.results});
}
if(method==='POST'&&path==='/api/pos/authorize'){
 const b=await input(req);if(!b||!validText(b.payment_id,10,80)||!validText(b.account_id,10,80))return json({error:'أدخل رقم الطلب وحسابك البنكي'},400);
 const pay=await db.prepare("SELECT id,amount FROM pos_payments WHERE id=? AND customer_id=? AND status='pending' AND created_at>=datetime('now','-24 hours')").bind(b.payment_id,user.id).first();if(!pay)return json({error:'الطلب غير متاح أو انتهت مهلة الدفع'},404);
 const card=await db.prepare("SELECT c.id,a.balance FROM bank_cards c JOIN bank_accounts a ON a.id=c.account_id WHERE a.id=? AND a.user_id=? AND c.status='active' LIMIT 1").bind(saliyahAccountId(b.account_id),user.id).first();if(!card)return json({error:'الحساب لا يخصك أو ليس له بطاقة نشطة'},403);if(card.balance<pay.amount)return json({error:'الرصيد غير كافٍ'},409);
 const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),digest=await hash(code),id=random();
 await db.batch([db.prepare('DELETE FROM pos_otps WHERE payment_id=?').bind(pay.id),db.prepare("INSERT INTO pos_otps(id,payment_id,card_id,code_hash,expires_at) VALUES(?,?,?,?,datetime('now','+5 minutes'))").bind(id,pay.id,card.id,digest),db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),null,user.id,'رمز تأكيد دفع صالي',`رمز التأكيد: ${code} — صالح لخمس دقائق لطلب ${pay.id}. لا تشاركه مع أحد.`)]);
 await audit(db,user.id,'pos_otp_issued','pos_payment',pay.id,{});return json({ok:true,notice:'أُرسل الرمز إلى الرسائل الحكومية الداخلية'});
}
if(method==='POST'&&path==='/api/pos/confirm'){
 const b=await input(req);if(!b||!validText(b.payment_id,10,80)||typeof b.code!=='string'||!/^[0-9]{6}$/.test(b.code))return json({error:'رقم الطلب أو الرمز غير صالح'},400);
 const otp=await db.prepare("SELECT o.id,o.card_id,o.code_hash,o.attempts FROM pos_otps o JOIN pos_payments p ON p.id=o.payment_id WHERE o.payment_id=? AND p.customer_id=? AND p.status='pending' AND o.expires_at>datetime('now')").bind(b.payment_id,user.id).first();if(!otp)return json({error:'الرمز منتهي أو الطلب غير متاح'},409);
 if(otp.attempts>=5)return json({error:'انتهت محاولات التأكيد'},429);
 if(await hash(b.code)!==otp.code_hash){await db.prepare('UPDATE pos_otps SET attempts=attempts+1 WHERE id=?').bind(otp.id).run();return json({error:'الرمز غير صحيح'},403)}
 const pay=await db.prepare("SELECT p.id,p.amount,p.merchant_id,m.account_id merchant_account FROM pos_payments p JOIN pos_merchants m ON m.id=p.merchant_id WHERE p.id=? AND p.customer_id=? AND p.status='pending'").bind(b.payment_id,user.id).first();
 const card=await db.prepare("SELECT c.id,a.id account_id FROM bank_cards c JOIN bank_accounts a ON a.id=c.account_id WHERE c.id=? AND a.user_id=? AND c.status='active'").bind(otp.card_id,user.id).first();if(!pay||!card||pay.merchant_account===card.account_id)return json({error:'عملية الدفع غير متاحة'},409);
 try{await db.batch([
 db.prepare('UPDATE bank_accounts SET balance=balance-? WHERE id=?').bind(pay.amount,card.account_id),
 db.prepare('UPDATE bank_accounts SET balance=balance+? WHERE id=?').bind(pay.amount,pay.merchant_account),
 db.prepare("UPDATE pos_payments SET status='paid',card_id=?,paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(card.id,pay.id),
 db.prepare('DELETE FROM pos_otps WHERE payment_id=?').bind(pay.id)
 ])}catch{return json({error:'تعذر إتمام الدفع؛ تحقق من الرصيد'},409)}
 await audit(db,user.id,'pos_paid','pos_payment',pay.id,{amount:pay.amount});return json({ok:true,receipt_id:pay.id});
}
if(method==='POST'&&path==='/api/pos/cancel'){
 const b=await input(req);if(!b||!validText(b.payment_id,10,80))return json({error:'رقم طلب غير صالح'},400);
 const r=await db.prepare("UPDATE pos_payments SET status='cancelled' WHERE id=? AND status='pending' AND (customer_id=? OR merchant_id IN (SELECT id FROM pos_merchants WHERE owner_id=?))").bind(b.payment_id,user.id,user.id).run();if(!r.meta.changes)return json({error:'لا يمكن إلغاء الطلب'},409);
 await db.prepare('DELETE FROM pos_otps WHERE payment_id=?').bind(b.payment_id).run();await audit(db,user.id,'pos_cancelled','pos_payment',b.payment_id,{});return json({ok:true});
}

// Phase 6: internal-only cards and ATM cash wallet.
if(method==='GET'&&path==='/api/banking/cards'){
 const r=await db.prepare('SELECT c.id,c.last4,c.status,c.created_at,a.bank,a.id account_id FROM bank_cards c JOIN bank_accounts a ON a.id=c.account_id WHERE a.user_id=? ORDER BY c.created_at DESC').bind(user.id).all();return json({cards:r.results});
}
if(method==='POST'&&path==='/api/banking/cards'){
 const b=await input(req);if(!b||!validText(b.account_id,10,80))return json({error:'حدد الحساب'},400);
 const a=await db.prepare('SELECT id FROM bank_accounts WHERE id=? AND user_id=?').bind(b.account_id,user.id).first();if(!a)return json({error:'الحساب غير موجود'},404);
 const count=await db.prepare('SELECT COUNT(*) n FROM bank_cards WHERE account_id=?').bind(a.id).first();if(count.n>=3)return json({error:'الحد الأقصى ثلاث بطاقات للحساب'},409);
 const id=random(),last4=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
 await db.prepare('INSERT INTO bank_cards(id,account_id,last4) VALUES(?,?,?)').bind(id,a.id,last4).run();await audit(db,user.id,'issue_simulated_card','bank_card',id,{account_id:a.id});return json({id,last4,status:'active'},201);
}
if(method==='POST'&&path==='/api/banking/cards/status'){
 const b=await input(req);if(!b||!validText(b.id,10,80)||!['active','frozen'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
 const r=await db.prepare('UPDATE bank_cards SET status=? WHERE id=? AND account_id IN (SELECT id FROM bank_accounts WHERE user_id=?)').bind(b.status,b.id,user.id).run();if(!r.meta.changes)return json({error:'البطاقة غير موجودة'},404);
 await audit(db,user.id,'card_status','bank_card',b.id,{status:b.status});return json({ok:true});
}
if(method==='GET'&&path==='/api/banking/atm'){
 const w=await db.prepare('SELECT balance FROM cash_wallets WHERE user_id=?').bind(user.id).first();const r=await db.prepare('SELECT id,account_id,kind,amount,created_at FROM atm_operations WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();return json({cash:w?.balance||0,operations:r.results});
}
if(method==='POST'&&path==='/api/banking/atm'){
 const b=await input(req);if(!b||!validText(b.account_id,10,80)||!['withdraw','deposit'].includes(b.kind)||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>1000000)return json({error:'بيانات العملية غير صالحة'},400);
 const a=await db.prepare('SELECT id,balance FROM bank_accounts WHERE id=? AND user_id=?').bind(b.account_id,user.id).first();if(!a)return json({error:'الحساب غير موجود'},404);
 const w=await db.prepare('SELECT balance FROM cash_wallets WHERE user_id=?').bind(user.id).first();if(b.kind==='withdraw'&&a.balance<b.amount)return json({error:'الرصيد البنكي غير كافٍ'},409);if(b.kind==='deposit'&&(w?.balance||0)<b.amount)return json({error:'النقد المتاح غير كافٍ'},409);
 const id=random();try{await db.batch([
 db.prepare('INSERT OR IGNORE INTO cash_wallets(user_id,balance) VALUES(?,0)').bind(user.id),
 db.prepare('UPDATE bank_accounts SET balance=balance+? WHERE id=? AND user_id=? AND balance+?>=0').bind(b.kind==='withdraw'?-b.amount:b.amount,a.id,user.id,b.kind==='withdraw'?-b.amount:b.amount),
 db.prepare('UPDATE cash_wallets SET balance=balance+? WHERE user_id=? AND balance+?>=0').bind(b.kind==='withdraw'?b.amount:-b.amount,user.id,b.kind==='withdraw'?b.amount:-b.amount),
 db.prepare('INSERT INTO atm_operations(id,user_id,account_id,kind,amount) VALUES(?,?,?,?,?)').bind(id,user.id,a.id,b.kind,b.amount)
 ])}catch{return json({error:'تعذرت العملية؛ تحقق من الرصيد'},409)}
 await audit(db,user.id,'atm_'+b.kind,'atm_operation',id,{account_id:a.id,amount:b.amount});return json({ok:true,id},201);
}
// Banking is simulated. Balances are integer Saliyah Riyals, never real money.
if(method==='GET'&&path==='/api/banking/accounts'){
 const rows=await db.prepare('SELECT id,bank,balance,created_at FROM bank_accounts WHERE user_id=? ORDER BY bank').bind(user.id).all();
 return json({accounts:rows.results.map(x=>({...x,iban:saliyahIban(x.id)}))});
}
if(method==='POST'&&path==='/api/banking/accounts'){
 const b=await input(req);if(!b||!['saliyah','national','development'].includes(b.bank))return json({error:'البنك غير صالح'},400);
 const id=random();await db.prepare('INSERT OR IGNORE INTO bank_accounts(id,user_id,bank) VALUES(?,?,?)').bind(id,user.id,b.bank).run();
 const account=await db.prepare('SELECT id,bank,balance FROM bank_accounts WHERE user_id=? AND bank=?').bind(user.id,b.bank).first();
 return json({account:{...account,iban:saliyahIban(account.id)}},201);
}
if(method==='GET'&&path==='/api/banking/transfers'){
 const r=await db.prepare(`SELECT t.id,t.amount,t.memo,t.created_at,t.sender_account,t.recipient_account,sa.bank sender_bank,ra.bank recipient_bank,su.username sender,ru.username recipient FROM bank_transfers t JOIN bank_accounts sa ON sa.id=t.sender_account JOIN bank_accounts ra ON ra.id=t.recipient_account JOIN users su ON su.id=sa.user_id JOIN users ru ON ru.id=ra.user_id WHERE sa.user_id=? OR ra.user_id=? ORDER BY t.created_at DESC LIMIT 100`).bind(user.id,user.id).all();return json({transfers:r.results});
}
if(method==='POST'&&path==='/api/banking/transfer'){
 const b=await input(req);if(!b||!validText(b.from,10,80)||!saliyahAccountId(b.recipient_iban)||!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>100000000||typeof b.memo!=='string'||b.memo.length>200)return json({error:'بيانات التحويل غير صالحة'},400);
 const sender=await db.prepare('SELECT id,balance FROM bank_accounts WHERE id=? AND user_id=?').bind(b.from,user.id).first();if(!sender)return json({error:'الحساب المرسل غير موجود'},404);
 const recipient=await db.prepare('SELECT id,user_id FROM bank_accounts WHERE id=?').bind(saliyahAccountId(b.recipient_iban)).first();if(!recipient)return json({error:'الآيبان أو الحساب المستلم غير موجود'},404);
 if(recipient.id===sender.id)return json({error:'لا يمكن التحويل إلى الحساب نفسه'},400);
 if(sender.balance<b.amount)return json({error:'الرصيد غير كافٍ'},409);
 // Phase 34: the database trigger atomically debits and credits when this ledger row is inserted.
 const id=random();try{await db.prepare('INSERT INTO bank_transfers(id,sender_account,recipient_account,amount,memo) VALUES(?,?,?,?,?)').bind(id,sender.id,recipient.id,b.amount,b.memo.trim()).run();}catch{return json({error:'تعذر إتمام التحويل؛ تحقق من الرصيد وحاول مجددًا'},409)}
 await audit(db,user.id,'bank_transfer','bank_transfer',id,{amount:b.amount,from:sender.id,to:recipient.id});return json({id,ok:true},201);
}
// Phase 12: bank operators can adjust simulated balances, including negative values.
if(path.startsWith('/api/bank-admin/')){
 if(!(await can('banking')))return json({error:'صلاحية إدارة البنك مطلوبة'},403);
 if(method==='GET'&&path==='/api/bank-admin/accounts'){
  const bank=u.searchParams.get('bank');if(!['saliyah','national','development'].includes(bank))return json({error:'اختر البنك'},400);
  const rows=await db.prepare('SELECT a.id,a.bank,a.balance,a.created_at,u.username FROM bank_accounts a JOIN users u ON u.id=a.user_id WHERE a.bank=? ORDER BY u.username LIMIT 200').bind(bank).all();return json({accounts:rows.results});
 }
 if(method==='GET'&&path==='/api/bank-admin/history'){
  const bank=u.searchParams.get('bank');if(!['saliyah','national','development'].includes(bank))return json({error:'اختر البنك'},400);
  const rows=await db.prepare('SELECT j.*,u.username actor FROM bank_adjustments j JOIN bank_accounts a ON a.id=j.account_id JOIN users u ON u.id=j.actor_id WHERE a.bank=? ORDER BY j.created_at DESC LIMIT 200').bind(bank).all();return json({operations:rows.results});
 }
 if(method==='POST'&&path==='/api/bank-admin/adjust'){
  const b=await input(req);if(!b||!validText(b.account_id,10,80)||!['set','add','subtract'].includes(b.mode)||!Number.isSafeInteger(b.amount)||Math.abs(b.amount)>100000000||!validText(b.reason,5,300))return json({error:'المبلغ أو السبب غير صالح'},400);
  const a=await db.prepare('SELECT id,balance,bank,user_id FROM bank_accounts WHERE id=?').bind(b.account_id).first();if(!a)return json({error:'الحساب غير موجود'},404);
  const next=b.mode==='set'?b.amount:a.balance+(b.mode==='add'?Math.abs(b.amount):-Math.abs(b.amount));if(!Number.isSafeInteger(next)||Math.abs(next)>1000000000)return json({error:'الرصيد خارج الحدود المسموحة'},400);
  // Phase 35: one ledger insert atomically validates and applies the administrative balance change.
  const id=random();try{await db.prepare('INSERT INTO bank_adjustments(id,account_id,actor_id,mode,amount,previous_balance,new_balance,reason) VALUES(?,?,?,?,?,?,?,?)').bind(id,a.id,user.id,b.mode,b.amount,a.balance,next,b.reason.trim()).run()}catch{return json({error:'تغيّر الرصيد أو تعذر تحديثه؛ حدّث القائمة وأعد المحاولة'},409)}
  await audit(db,user.id,'bank_balance_adjustment','bank_account',a.id,{bank:a.bank,previous:a.balance,next,mode:b.mode,amount:b.amount,reason:b.reason.trim()});
  await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,a.user_id,'تعديل رصيد حسابك',`تعديل إداري في ${a.bank}: الرصيد السابق ${a.balance}، الرصيد الجديد ${next} ريال صالي. المرجع: ${id}`).run();return json({ok:true,id,previous:a.balance,balance:next});
 }
}
if(method==='POST'&&path==='/api/admin/banking/adjust')return json({error:'استخدم واجهة إدارة البنك الجديدة'},410);
// Buy now, pay later: internal Tabby/Tamara-style installment simulation.
if(path.startsWith('/api/installments/')){
 if(method==='GET'&&path==='/api/installments/mine'){
  const rows=await db.prepare('SELECT * FROM installment_plans WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all();return json({plans:rows.results});
 }
 if(method==='GET'&&path==='/api/installments/schedule'){
  const id=u.searchParams.get('id');const plan=await db.prepare('SELECT id FROM installment_plans WHERE id=? AND user_id=?').bind(id,user.id).first();if(!plan)return json({error:'الخطة غير موجودة'},404);
  const rows=await db.prepare('SELECT id,installment_number,amount,due_date,paid_at FROM installment_dues WHERE plan_id=? ORDER BY installment_number').bind(id).all();return json({dues:rows.results});
 }
 if(method==='POST'&&path==='/api/installments/create'){
  const b=await input(req);if(!b||!['tabby','tamara'].includes(b.provider)||!validText(b.merchant,2,120)||!Number.isSafeInteger(b.amount)||b.amount<4||b.amount>1000000)return json({error:'بيانات التقسيط غير صالحة'},400);
  const active=await db.prepare("SELECT COALESCE(SUM(amount),0) total FROM installment_plans WHERE user_id=? AND provider=? AND status='active'").bind(user.id,b.provider).first();if(active.total+b.amount>5000)return json({error:'تجاوزت حد التقسيط التجريبي 5000 ريال صالي'},409);
  const id=random(),today=new Date();const chunks=Array.from({length:4},(_,i)=>Math.floor(b.amount/4)+(i<b.amount%4?1:0));
  const due=chunks.map((amount,i)=>{const d=new Date(today);d.setUTCDate(d.getUTCDate()+i*30);return {amount,date:d.toISOString().slice(0,10)}});
  await db.batch([db.prepare('INSERT INTO installment_plans(id,user_id,provider,merchant,amount,status) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.provider,b.merchant.trim(),b.amount,'active'),...due.map((d,i)=>db.prepare('INSERT INTO installment_dues(id,plan_id,installment_number,amount,due_date) VALUES(?,?,?,?,?)').bind(random(),id,i+1,d.amount,d.date))]);
  await audit(db,user.id,'create_installment','installment_plan',id,{provider:b.provider,amount:b.amount});return json({id,dues:due},201);
 }
 if(method==='POST'&&path==='/api/installments/pay'){
  const b=await input(req);if(!b||!validText(b.due_id,10,80)||!validText(b.account_id,10,80))return json({error:'البيانات ناقصة'},400);
  const d=await db.prepare('SELECT d.*,p.user_id,p.id plan_id FROM installment_dues d JOIN installment_plans p ON p.id=d.plan_id WHERE d.id=? AND p.user_id=?').bind(b.due_id,user.id).first();if(!d||d.paid_at)return json({error:'القسط غير موجود أو مدفوع'},404);
  const a=await db.prepare('SELECT id,balance FROM bank_accounts WHERE id=? AND user_id=?').bind(b.account_id,user.id).first();if(!a||a.balance<d.amount)return json({error:'الرصيد غير كافٍ'},409);
  const id=random();try{await db.batch([db.prepare('UPDATE bank_accounts SET balance=balance-? WHERE id=? AND balance>=?').bind(d.amount,a.id,d.amount),db.prepare('UPDATE installment_dues SET paid_at=CURRENT_TIMESTAMP,paid_from=? WHERE id=? AND paid_at IS NULL').bind(a.id,d.id),db.prepare('INSERT INTO installment_payments(id,due_id,bank_account_id,amount) VALUES(?,?,?,?)').bind(id,d.id,a.id,d.amount)])}catch{return json({error:'تعذر الدفع'},409)}
  const pending=await db.prepare('SELECT COUNT(*) n FROM installment_dues WHERE plan_id=? AND paid_at IS NULL').bind(d.plan_id).first();if(pending.n===0)await db.prepare("UPDATE installment_plans SET status='paid' WHERE id=?").bind(d.plan_id).run();await audit(db,user.id,'pay_installment','installment_due',d.id,{amount:d.amount});return json({ok:true,id});
 }
}
if(method==='GET'&&path==='/api/messages'){const r=await db.prepare('SELECT m.id,m.subject,m.body,m.read_at,m.created_at,u.username sender FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.recipient_id=? ORDER BY m.created_at DESC LIMIT 100').bind(user.id).all();return json({messages:r.results});}
if(method==='POST'&&path==='/api/messages/read'){const b=await input(req);if(!b||!validText(b.id,10,80))return json({error:'معرف غير صالح'},400);await db.prepare('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE id=? AND recipient_id=?').bind(b.id,user.id).run();return json({ok:true});}
if(method==='POST'&&path==='/api/messages/send'){const b=await input(req);if(!b||!validText(b.recipient,3,80)||!validText(b.subject,3,150)||!validText(b.body,1,3000))return json({error:'بيانات الرسالة غير مكتملة'},400);const to=await db.prepare('SELECT id FROM users WHERE username=?').bind(b.recipient.trim().toLowerCase()).first();if(!to)return json({error:'المستلم غير موجود'},404);const id=random();await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(id,user.id,to.id,b.subject.trim(),b.body.trim()).run();await audit(db,user.id,'send_message','message',id,{recipient:to.id});return json({id},201);}
if(method==='GET'&&path==='/api/admin/staff'){if(user.role!=='king')return json({error:'غير مخول'},403);const r=await db.prepare("SELECT u.id,u.username,u.role,COALESCE(GROUP_CONCAT(p.permission), '') permissions FROM users u LEFT JOIN staff_permissions p ON p.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC").all();return json({staff:r.results});}
if(method==='POST'&&path==='/api/admin/staff'){if(user.role!=='king')return json({error:'غير مخول'},403);const b=await input(req);const allowed=['registry','civil','requests','news','borders','education','banking','justice','police','appeals','health','municipality','land','commerce','finance','budget_propose'];if(!b||!validText(b.username,3,40)||!/^[a-z0-9_]+$/i.test(b.username)||!validText(b.password,12,128)||!Array.isArray(b.permissions)||b.permissions.some(x=>!allowed.includes(x)))return json({error:'بيانات الموظف أو الصلاحيات غير صالحة'},400);const id=random(),salt=random();try{await db.prepare("INSERT INTO users(id,username,password_hash,salt,role) VALUES(?,?,?,?, 'employee')").bind(id,b.username.toLowerCase(),await derive(b.password,salt),salt).run()}catch{return json({error:'اسم المستخدم موجود'},409)}for(const permission of new Set(b.permissions))await db.prepare('INSERT INTO staff_permissions(user_id,permission) VALUES(?,?)').bind(id,permission).run();await audit(db,user.id,'create_employee','user',id,{permissions:b.permissions});return json({id},201);}
if(method==='POST'&&path==='/api/admin/staff/permissions'){if(user.role!=='king')return json({error:'غير مخول'},403);const b=await input(req);const allowed=['registry','civil','requests','news','borders','education','banking','justice','police','appeals','health','municipality','land','commerce','finance','budget_propose'];if(!b||!validText(b.id,10,80)||!Array.isArray(b.permissions)||b.permissions.some(x=>!allowed.includes(x)))return json({error:'صلاحيات غير صالحة'},400);const employee=await db.prepare("SELECT id FROM users WHERE id=? AND role='employee'").bind(b.id).first();if(!employee)return json({error:'الموظف غير موجود'},404);await db.prepare('DELETE FROM staff_permissions WHERE user_id=?').bind(b.id).run();for(const permission of new Set(b.permissions))await db.prepare('INSERT INTO staff_permissions(user_id,permission) VALUES(?,?)').bind(b.id,permission).run();await audit(db,user.id,'update_permissions','user',b.id,{permissions:b.permissions});return json({ok:true});}
if(method==='POST'&&path==='/api/admin/staff/update'){if(user.role!=='king')return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.id,10,80))return json({error:'معرف غير صالح'},400);const target=await db.prepare("SELECT id,username FROM users WHERE id=? AND role='employee'").bind(b.id).first();if(!target)return json({error:'الموظف غير موجود'},404);if(b.username===undefined&&b.password===undefined)return json({error:'لا توجد تعديلات'},400);if(b.username!==undefined&&(!validText(b.username,3,40)||!/^[a-z0-9_]+$/i.test(b.username)))return json({error:'اسم المستخدم غير صالح'},400);if(b.password!==undefined&&!validText(b.password,12,128))return json({error:'كلمة المرور يجب أن تكون 12-128 حرفًا'},400);if(b.username!==undefined&&b.username.trim().toLowerCase()!==target.username){try{await db.prepare("UPDATE users SET username=? WHERE id=?").bind(b.username.trim().toLowerCase(),b.id).run()}catch{return json({error:'اسم المستخدم موجود'},409)}}if(b.password!==undefined){const salt=random();await db.prepare("UPDATE users SET password_hash=?,salt=? WHERE id=?").bind(await derive(b.password,salt),salt,b.id).run()}await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(b.id).run();await audit(db,user.id,'update_employee','user',b.id,{usernameChanged:b.username!==undefined,passwordChanged:b.password!==undefined});return json({ok:true});}
if(method==='GET'&&path==='/api/requests/history'){const id=u.searchParams.get('id');if(!id)return json({error:'رقم الطلب مطلوب'},400);const r=await db.prepare('SELECT user_id FROM requests WHERE id=?').bind(id).first();if(!r)return json({error:'الطلب غير موجود'},404);if(r.user_id!==user.id&&!(await can('requests')))return json({error:'غير مخول'},403);const h=await db.prepare('SELECT old_status,new_status,note,created_at FROM request_history WHERE request_id=? ORDER BY created_at').bind(id).all();return json({history:h.results});}

if(method==='GET'&&path==='/api/requests'){const rows=await can('requests')?await db.prepare('SELECT * FROM requests ORDER BY created_at DESC LIMIT 100').all():await db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all();return json({requests:rows.results});}
if(method==='POST'&&path==='/api/requests'){const b=await input(req);if(!b||!['complaint','suggestion','diwan'].includes(b.kind)||!validText(b.subject,3,150)||!validText(b.description,5,3000))return json({error:'بيانات الطلب غير مكتملة'},400);const id=random();await db.prepare('INSERT INTO requests(id,user_id,kind,subject,description) VALUES(?,?,?,?,?)').bind(id,user.id,b.kind,b.subject.trim(),b.description.trim()).run();await audit(db,user.id,'create_request','request',id,{kind:b.kind});return json({id,status:'pending'},201);}

// All registry actions are restricted to the King until employee roles are explicitly implemented.
if(path.startsWith('/api/registry/')||path.startsWith('/api/civil/')||path==='/api/admin/requests/status'||path==='/api/admin/audit'){
 const required=path.startsWith('/api/registry/')?'registry':path.startsWith('/api/civil/')?'civil':'requests';if(!(await can(required)))return json({error:'غير مخول'},403);
 if(method==='POST'&&path==='/api/registry/citizen-activation'){
 const b=await input(req);const identifier=String(b?.document_id||b?.document_number||'').trim();if(!validText(identifier,3,100))return json({error:'أدخل رقم الهوية أو الإقامة أو الجواز أو معرّف الوثيقة'},400);
 const d=await db.prepare("SELECT id FROM documents WHERE (id=? OR number=?) AND type IN ('national_id','residency','passport') AND status='valid' AND expires_at>=date('now')").bind(identifier,identifier).first();
 if(!d)return json({error:'لم نجد هوية وطنية أو إقامة أو جواز سفر ساريًا بهذا الرقم؛ تأكد من اعتماد إصدار الهوية وتاريخ صلاحيتها'},404);
 const old=await db.prepare('SELECT claimed_by FROM citizen_claims WHERE document_id=?').bind(d.id).first();
 if(old?.claimed_by||await db.prepare('SELECT 1 FROM citizen_profiles WHERE document_id=?').bind(d.id).first())return json({error:'هذه الوثيقة مرتبطة بحساب بالفعل'},409);
 const code=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'').slice(0,8);
 await db.prepare("INSERT INTO citizen_claims(id,document_id,token_hash,expires_at,created_by) VALUES(?,?,?,datetime('now','+14 days'),?) ON CONFLICT(document_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_by=excluded.created_by").bind(random(),d.id,await hash(code),user.id).run();
 await audit(db,user.id,'citizen_activation_issued','document',d.id,{valid_days:14});
 return json({activation_code:code,valid_days:14});
}
if(method==='GET'&&path==='/api/registry/documents'){const r=await db.prepare('SELECT id,type,number,full_name,nationality,issued_at,expires_at,status,phone FROM documents ORDER BY created_at DESC LIMIT 100').all();return json({documents:r.results});}
 if(method==='GET'&&path==='/api/registry/applications'){const r=await db.prepare("SELECT a.*,d.number document_number FROM document_applications a LEFT JOIN documents d ON d.id=a.document_id ORDER BY a.created_at DESC LIMIT 100").all();return json({applications:r.results});}
 if(method==='GET'&&path==='/api/registry/approved-civil'){const r=await db.prepare("SELECT * FROM civil_intake WHERE status='approved' ORDER BY created_at DESC LIMIT 100").all();return json({applications:r.results});}
 if(method==='POST'&&path==='/api/registry/applications'){const b=await input(req);if(!b||!['national_id','residency','passport'].includes(b.type)||!validText(b.full_name,2,160)||!validText(b.nationality,2,80)||!validText(b.issuer,2,120)||!validText(b.birth_place,2,160)||!['male','female'].includes(b.gender)||!validText(b.father_name,2,160)||!validText(b.mother_name,2,160)||!/^\d{4}-\d{2}-\d{2}$/.test(b.birth_date||'')||!Number.isFinite(Date.parse(b.birth_date))||b.birth_date>new Date().toISOString().slice(0,10)||!/^\d{4}-\d{2}-\d{2}$/.test(b.expires_at||''))return json({error:'تحقق من البيانات: الاسم والجنسية وجهة الإصدار ومكان الميلاد واسم الأب والأم (حرفان على الأقل)، والجنس، وتاريخ الميلاد والانتهاء بصيغة YYYY-MM-DD'},400);if(b.civil_intake_id){const c=await db.prepare("SELECT * FROM civil_intake WHERE id=? AND status='approved'").bind(b.civil_intake_id).first();if(!c)return json({error:'طلب الأحوال غير معتمد'},400);if(c.full_name.trim()!==b.full_name.trim()||(c.birth_date&&c.birth_date!==b.birth_date))return json({error:'البيانات لا تطابق طلب الأحوال'},400);const used=await db.prepare("SELECT id FROM document_applications WHERE civil_intake_id=? AND type=? AND status IN ('pending','approved')").bind(b.civil_intake_id,b.type).first();if(used)return json({error:'يوجد طلب وثيقة سابق لنفس الطلب'},409);} const id=random(),reference='DOC-'+Date.now().toString(36).toUpperCase()+'-'+id.slice(0,6).toUpperCase();await db.prepare('INSERT INTO document_applications(id,reference,type,full_name,nationality,birth_date,birth_place,gender,father_name,mother_name,issuer,expires_at,created_by,phone,civil_intake_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,reference,b.type,b.full_name.trim(),b.nationality.trim(),b.birth_date,b.birth_place.trim(),b.gender,b.father_name.trim(),b.mother_name.trim(),b.issuer.trim(),b.expires_at,user.id,b.phone?.trim()||null,b.civil_intake_id||null).run();await audit(db,user.id,'request_document','document_application',id,{reference,type:b.type});return json({id,reference,status:'pending'},201);}
 if(method==='POST'&&path==='/api/registry/applications/decision'){const b=await input(req);if(!b||!validText(b.id,10,80)||!['approved','rejected'].includes(b.decision))return json({error:'قرار غير صالح'},400);const a=await db.prepare("SELECT * FROM document_applications WHERE id=? AND status='pending'").bind(b.id).first();if(!a)return json({error:'الطلب غير موجود أو سبق البت فيه'},409);if(b.decision==='rejected'){const r=await db.prepare("UPDATE document_applications SET status='rejected',decided_by=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(user.id,a.id).run();if(!r.meta.changes)return json({error:'سبق البت في الطلب'},409);await audit(db,user.id,'reject_document','document_application',a.id,{});return json({status:'rejected'});}if(a.expires_at<new Date().toISOString().slice(0,10))return json({error:'تاريخ انتهاء الوثيقة مضى؛ عدّل الطلب قبل اعتماده'},400);const id=random(),number='SAL-'+(a.type==='national_id'?'1':a.type==='residency'?'2':'P')+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,9).toUpperCase();try{await db.batch([db.prepare("INSERT INTO documents(id,type,number,full_name,nationality,birth_date,birth_place,gender,father_name,mother_name,issued_at,expires_at,issuer,created_by,phone) SELECT ?,type,?,full_name,nationality,birth_date,birth_place,gender,father_name,mother_name,date('now'),expires_at,issuer,?,phone FROM document_applications WHERE id=? AND status='pending'").bind(id,number,user.id,a.id),db.prepare("UPDATE document_applications SET status='approved',document_id=?,decided_by=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(id,user.id,a.id)]);}catch{return json({error:'تعذر الاعتماد، أعد المحاولة'},409)}await audit(db,user.id,'approve_document','document_application',a.id,{document_id:id,number});return json({status:'approved',number,document_id:id});}
 if(method==='POST'&&path==='/api/registry/documents/phone'){
 const b=await input(req);if(!b||!validText(b.id,10,80)||!(b.phone==null||b.phone===''||/^\\+?[0-9]{7,15}$/.test(b.phone)))return json({error:'رقم جوال غير صالح'},400);
 const r=await db.prepare('UPDATE documents SET phone=? WHERE id=?').bind(b.phone?.trim()||null,b.id).run();if(!r.meta.changes)return json({error:'الوثيقة غير موجودة'},404);
 await audit(db,user.id,'document_phone_update','document',b.id,{});return json({ok:true});
}
 if(method==='POST'&&path==='/api/registry/documents')return json({error:'يجب تقديم طلب الوثيقة ثم اعتماده لإصدار الرقم'},409);
 if(method==='POST'&&path==='/api/registry/check'){const b=await input(req);if(!b||!validText(b.number,3,40))return json({error:'أدخل رقم الوثيقة'},400);const d=await db.prepare('SELECT * FROM documents WHERE number=?').bind(b.number.trim()).first();let circulars=[];if(d){const r=await db.prepare("SELECT reference,kind,reason,confidentiality FROM circulars WHERE document_id=? AND status='active' AND (expires_at IS NULL OR expires_at >= date('now'))").bind(d.id).all();circulars=r.results}const today=new Date().toISOString().slice(0,10);const result=!d?'unregistered':d.status!=='valid'?d.status:d.expires_at<today?'expired':circulars.length?'circular':'valid';const id=random();await db.prepare('INSERT INTO document_checks(id,document_number,document_id,checked_by,result,reason) VALUES(?,?,?,?,?,?)').bind(id,b.number.trim(),d?.id||null,user.id,result,String(b.reason||'فحص إداري').slice(0,250)).run();await audit(db,user.id,'check_document','document',d?.id||null,{result,check_id:id});return json({check_id:id,result,document:d?{type:d.type,number:d.number,full_name:d.full_name,nationality:d.nationality,expires_at:d.expires_at,status:d.status}:null,circulars});}
 if(method==='POST'&&path==='/api/registry/circulars'){const b=await input(req);if(!b||!validText(b.reference,3,70)||!validText(b.document_number,3,40)||!validText(b.kind,2,70)||!validText(b.reason,3,1000))return json({error:'بيانات التعميم غير مكتملة'},400);const d=await db.prepare('SELECT id FROM documents WHERE number=?').bind(b.document_number.trim()).first();if(!d)return json({error:'الوثيقة غير مسجلة'},404);const id=random();try{await db.prepare('INSERT INTO circulars(id,reference,document_id,kind,reason,confidentiality,expires_at,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.reference.trim(),d.id,b.kind.trim(),b.reason.trim(),b.confidentiality==='public'?'public':'restricted',b.expires_at||null,user.id).run()}catch{return json({error:'رقم التعميم مستخدم مسبقًا'},409)}await audit(db,user.id,'create_circular','circular',id,{reference:b.reference});return json({id},201);}
 if(method==='GET'&&path==='/api/registry/checks'){const r=await db.prepare('SELECT * FROM document_checks ORDER BY created_at DESC LIMIT 100').all();return json({checks:r.results});}
 if(method==='GET'&&path==='/api/civil/family-cards'){const r=await db.prepare("SELECT * FROM family_cards ORDER BY updated_at DESC LIMIT 100").all();const sim=await db.prepare("SELECT f.id,f.number,a.name father_name,b.name mother_name,f.issued_at created_at,(SELECT json_group_array(c.name) FROM saliyah_sim_children c WHERE c.marriage_id=f.marriage_id) children_json FROM saliyah_sim_family_cards f JOIN saliyah_sim_marriages m ON m.id=f.marriage_id JOIN saliyah_sim_citizens a ON a.id=m.partner_a JOIN saliyah_sim_citizens b ON b.id=m.partner_b ORDER BY f.issued_at DESC LIMIT 100").all();return json({cards:r.results.map(x=>({...x,children:JSON.parse(x.children_json||'[]')})),simulated_cards:sim.results.map(x=>({...x,children:JSON.parse(x.children_json||'[]'),simulated:true}))});}
 if(method==='POST'&&path==='/api/civil/family-cards'){const b=await input(req);if(!b||!validText(b.father_name,2,160)||!validText(b.mother_name,2,160)||!Array.isArray(b.children)||b.children.length>10||b.children.some(c=>!validText(c,2,160)))return json({error:'أدخل اسمي الأب والأم وما يصل إلى 10 أبناء'},400);const id=random(),number='FAM-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase(),children=JSON.stringify(b.children.map(x=>x.trim()));await db.batch([db.prepare("INSERT INTO family_cards(id,number,father_name,mother_name,children_json,created_by,phone) VALUES(?,?,?,?,?,?,?)").bind(id,number,b.father_name.trim(),b.mother_name.trim(),children,user.id,b.phone?.trim()||null),db.prepare("INSERT INTO family_card_history(id,family_id,action,new_children_json,actor_id) VALUES(?,?,'issue',?,?)").bind(random(),id,children,user.id)]);await audit(db,user.id,'issue_family_card','family_card',id,{number,fee:0});return json({id,number,fee:0},201);}
 if(method==='POST'&&path==='/api/civil/family-cards/renew'){const b=await input(req);if(!b||!validText(b.id,10,80)||!validText(b.reason,3,300)||!validText(b.father_name,2,160)||!validText(b.mother_name,2,160)||!Array.isArray(b.children)||b.children.length>10||b.children.some(c=>!validText(c,2,160)))return json({error:'بيانات التجديد غير صالحة'},400);const old=await db.prepare("SELECT * FROM family_cards WHERE id=?").bind(b.id).first();if(!old)return json({error:'سجل الأسرة غير موجود'},404);const children=JSON.stringify(b.children.map(x=>x.trim()));if(old.children_json===children&&old.father_name===b.father_name.trim()&&old.mother_name===b.mother_name.trim()&&(old.phone||'')===(b.phone?.trim()||''))return json({error:'لا توجد تغييرات تستدعي التجديد'},409);await db.batch([db.prepare("UPDATE family_cards SET father_name=?,mother_name=?,children_json=?,phone=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.father_name.trim(),b.mother_name.trim(),children,b.phone?.trim()||null,b.id),db.prepare("INSERT INTO family_card_history(id,family_id,action,previous_children_json,new_children_json,reason,actor_id) VALUES(?,?,'renew',?,?,?,?)").bind(random(),b.id,old.children_json,children,b.reason.trim(),user.id)]);await audit(db,user.id,'renew_family_card','family_card',b.id,{reason:b.reason.trim(),fee:0});return json({ok:true,fee:0});}
 if(method==='POST'&&path==='/api/civil/intake'){const b=await input(req);if(!b||!validText(b.full_name,2,160))return json({error:'الاسم الكامل مطلوب'},400);const id=random(),reference='CIV-'+Date.now().toString(36).toUpperCase()+'-'+id.slice(0,5).toUpperCase();await db.prepare('INSERT INTO civil_intake(id,reference,full_name,parent_name,birth_date,details,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,reference,b.full_name.trim(),String(b.parent_name||'').slice(0,160),b.birth_date||null,String(b.details||'').slice(0,2000),user.id).run();await audit(db,user.id,'civil_intake','civil_intake',id,{reference});return json({id,reference,status:'recorded'},201);}
 if(method==='GET'&&path==='/api/civil/intake'){const r=await db.prepare('SELECT * FROM civil_intake ORDER BY created_at DESC LIMIT 100').all();const counts=await db.prepare("SELECT status,COUNT(*) n FROM saliyah_sim_identities GROUP BY status").all();const bots=await db.prepare("SELECT i.id,i.citizen_id,c.name,i.status,i.issued_at,i.expires_at FROM saliyah_sim_identities i JOIN saliyah_sim_citizens c ON c.id=i.citizen_id ORDER BY CASE WHEN i.status='requested' THEN 0 ELSE 1 END,i.id LIMIT 100").all();return json({applications:r.results,bot_identity_counts:counts.results,bot_identity_applications:bots.results});}
 if(method==='POST'&&path==='/api/civil/bot-identities/decision'){
  if(user.role!=='king')return json({error:'هذه الصلاحية للملك فقط'},403);
  const b=await input(req);
  if(!b||!['approved','rejected'].includes(b.decision)||(!b.id&&!b.bulk))return json({error:'قرار غير صالح'},400);
  const note=String(b.note||'').trim().slice(0,500);
  if(b.decision==='rejected'&&!note)return json({error:'سبب الرفض مطلوب'},400);
  const limit=b.bulk?Math.min(100,Math.max(1,Number(b.limit)||50)):1;
  let result;
  if(b.bulk){
   result=b.decision==='approved'
    ?await db.prepare("UPDATE saliyah_sim_identities SET status='issued',issued_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+14 days') WHERE id IN (SELECT id FROM saliyah_sim_identities WHERE status='requested' AND citizen_id LIKE 'sim-resident-%' ORDER BY id LIMIT ?)").bind(limit).run()
    :await db.prepare("UPDATE saliyah_sim_identities SET status='rejected' WHERE id IN (SELECT id FROM saliyah_sim_identities WHERE status='requested' AND citizen_id LIKE 'sim-resident-%' ORDER BY id LIMIT ?)").bind(limit).run();
  }else{
   if(typeof b.id!=='string'||!/^sim-id-resident-\d{4}$/.test(b.id))return json({error:'رقم الطلب غير صالح'},400);
   result=b.decision==='approved'
    ?await db.prepare("UPDATE saliyah_sim_identities SET status='issued',issued_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+14 days') WHERE id=? AND status='requested' AND citizen_id LIKE 'sim-resident-%'").bind(b.id).run()
    :await db.prepare("UPDATE saliyah_sim_identities SET status='rejected' WHERE id=? AND status='requested' AND citizen_id LIKE 'sim-resident-%'").bind(b.id).run();
  }
  const changed=result.meta.changes||0;
  if(changed)await audit(db,user.id,'king_bot_identity_decision','saliyah_sim_identities',b.bulk?'bulk':b.id,{decision:b.decision,changed,note});
  return json({ok:true,changed});
 }
 if(method==='POST'&&path==='/api/civil/intake/decision'){
 const b=await input(req);
 if(!b||!validText(b.id,10,80)||!['reviewing','approved','rejected'].includes(b.decision))return json({error:'قرار غير صالح'},400);
 const note=String(b.note||'').trim().slice(0,1000);
 if(b.decision==='rejected'&&!note)return json({error:'سبب الرفض مطلوب'},400);
 const old=await db.prepare('SELECT id,status FROM civil_intake WHERE id=?').bind(b.id).first();
 if(!old)return json({error:'الطلب غير موجود'},404);
 if(!['recorded','reviewing'].includes(old.status))return json({error:'تم اتخاذ قرار نهائي على الطلب'},409);
 if(old.status===b.decision)return json({error:'الطلب في هذه الحالة بالفعل'},409);
 const result=await db.prepare("UPDATE civil_intake SET status=?,review_note=?,decided_by=?,decided_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('recorded','reviewing')").bind(b.decision,note,user.id,b.id).run();
 if(!result.meta.changes)return json({error:'تغيرت حالة الطلب، حدّث الصفحة'},409);
 await audit(db,user.id,'civil_intake_decision','civil_intake',b.id,{from:old.status,to:b.decision,note});
 return json({ok:true,status:b.decision});
}

 if(method==='POST'&&path==='/api/admin/requests/status'){const b=await input(req);if(!b||!validText(b.id,10,80)||!['pending','reviewing','completed','rejected'].includes(b.status))return json({error:'بيانات غير صالحة'},400);const old=await db.prepare('SELECT status,user_id FROM requests WHERE id=?').bind(b.id).first();if(!old)return json({error:'الطلب غير موجود'},404);await db.prepare('UPDATE requests SET status=? WHERE id=?').bind(b.status,b.id).run();await db.prepare('INSERT INTO request_history(id,request_id,actor_id,old_status,new_status,note) VALUES(?,?,?,?,?,?)').bind(random(),b.id,user.id,old.status,b.status,String(b.note||'').slice(0,1000)).run();await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,old.user_id,'تحديث حالة الطلب',`تم تحديث طلبك ${b.id} إلى ${b.status}`).run();await audit(db,user.id,'update_request_status','request',b.id,{status:b.status});return json({ok:true});}
 if(method==='GET'&&path==='/api/admin/audit'){const r=await db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all();return json({entries:r.results});}
}
if(method==='GET'&&path==='/api/admin/overview'){if(user.role!=='king')return json({error:'غير مخول'},403);const [people,requests,news]=await Promise.all([db.prepare('SELECT COUNT(*) n FROM users').first(),db.prepare('SELECT COUNT(*) n FROM requests').first(),db.prepare('SELECT COUNT(*) n FROM news').first()]);return json({users:people.n,requests:requests.n,news:news.n});}
if(method==='POST'&&path==='/api/admin/news'){if(!(await can('news')))return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.title,3,160)||!validText(b.body,5,6000)||!['news','decree','circular'].includes(b.kind))return json({error:'بيانات النشر غير صالحة'},400);const id=random();await db.prepare('INSERT INTO news(id,title,body,kind,author_id) VALUES(?,?,?,?,?)').bind(id,b.title.trim(),b.body.trim(),b.kind,user.id).run();await audit(db,user.id,'publish','news',id,{kind:b.kind});return json({id},201);}

// Employment service: publicly browsable vacancies; applications require an account.
if(method==='GET'&&path==='/api/jobs'){
 const r=await db.prepare("SELECT id,title,employer,sector,description,salary,status,created_at FROM vacancies WHERE status='open' ORDER BY created_at DESC LIMIT 100").all();const bots=await sharedRows(db,"SELECT j.id,j.title,c.name employer,'private' sector,c.description,j.salary,j.status,j.created_at FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE j.status='open' AND c.status='approved' AND NOT EXISTS(SELECT 1 FROM saliyah_sim_job_applications a WHERE a.job_id=j.id AND a.status='hired') AND NOT EXISTS(SELECT 1 FROM shared_service_applications a WHERE a.service='jobs' AND a.target_id=j.id AND a.status='accepted') ORDER BY j.created_at DESC LIMIT 100");return json({jobs:[...r.results,...bots]});
}
if(method==='GET'&&path==='/api/jobs/mine'){
 if(!user)return json({error:'سجل الدخول أولًا'},401);
 const r=await db.prepare('SELECT a.id,a.vacancy_id,a.status,a.created_at,v.title,v.employer FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id WHERE a.applicant_id=? ORDER BY a.created_at DESC').bind(user.id).all();const bots=await sharedRows(db,"SELECT a.id,a.target_id vacancy_id,a.status,a.created_at,j.title,c.name employer,ec.id contract_id,ec.active contract_active FROM shared_service_applications a JOIN saliyah_sim_jobs j ON j.id=a.target_id JOIN saliyah_sim_companies c ON c.id=j.company_id LEFT JOIN employment_contracts ec ON ec.application_id=a.id WHERE a.service='jobs' AND a.applicant_id=? ORDER BY a.created_at DESC LIMIT 100",[user.id]);return json({applications:[...r.results,...bots]});
}
if(method==='POST'&&path==='/api/jobs/apply'){
 if(!user)return json({error:'سجل الدخول أولًا'},401);
 const b=await input(req);if(!b||!validText(b.vacancy_id,10,80)||!validText(b.statement,10,2000))return json({error:'اختر وظيفة واكتب نبذة عن مؤهلاتك'},400);
 const v=await db.prepare("SELECT id FROM vacancies WHERE id=? AND status='open'").bind(b.vacancy_id).first();if(!v){const bot=(await sharedRows(db,"SELECT j.id FROM saliyah_sim_jobs j JOIN saliyah_sim_companies c ON c.id=j.company_id WHERE j.id=? AND j.status='open' AND c.status='approved' AND NOT EXISTS(SELECT 1 FROM saliyah_sim_job_applications a WHERE a.job_id=j.id AND a.status='hired') AND NOT EXISTS(SELECT 1 FROM shared_service_applications a WHERE a.service='jobs' AND a.target_id=j.id AND a.status='accepted')",[b.vacancy_id]))[0];if(!bot)return json({error:'الوظيفة غير متاحة'},404);const id=random();await db.prepare("CREATE TABLE IF NOT EXISTS shared_service_applications(id TEXT PRIMARY KEY,service TEXT NOT NULL CHECK(service IN ('jobs','education')),target_id TEXT NOT NULL,applicant_id TEXT NOT NULL REFERENCES users(id),statement TEXT,previous_grade REAL,status TEXT NOT NULL DEFAULT 'submitted',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(service,target_id,applicant_id));").run();const result=await db.prepare("INSERT OR IGNORE INTO shared_service_applications(id,service,target_id,applicant_id,statement) VALUES(?,'jobs',?,?,?)").bind(id,bot.id,user.id,b.statement.trim()).run();if(!result.meta.changes)return json({error:'سبق التقديم لهذه الوظيفة'},409);await audit(db,user.id,'apply_bot_company_job','shared_service_applications',id,{job_id:bot.id});return json({id,status:'submitted'},201);}
 const id=random();try{await db.prepare('INSERT INTO job_applications(id,vacancy_id,applicant_id,statement) VALUES(?,?,?,?)').bind(id,v.id,user.id,b.statement.trim()).run()}catch{return json({error:'سبق التقديم لهذه الوظيفة'},409)}
 await audit(db,user.id,'apply_job','job_application',id,{vacancy_id:v.id});return json({id,status:'submitted'},201);
}
if(path.startsWith('/api/admin/jobs')){
 if(!user||user.role!=='king')return json({error:'إدارة الوظائف للملك فقط في هذه المرحلة'},403);
 if(method==='GET'&&path==='/api/admin/jobs/applications'){
  const r=await db.prepare('SELECT a.id,a.status,a.statement,a.created_at,v.title,v.employer,u.username applicant FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id JOIN users u ON u.id=a.applicant_id ORDER BY a.created_at DESC LIMIT 200').all();const bot=await db.prepare("SELECT a.id,a.status,a.statement,a.created_at,j.title,c.name employer,u.username applicant,'bot_company' source FROM shared_service_applications a JOIN saliyah_sim_jobs j ON j.id=a.target_id JOIN saliyah_sim_companies c ON c.id=j.company_id JOIN users u ON u.id=a.applicant_id WHERE a.service='jobs' ORDER BY a.created_at DESC LIMIT 100").all();return json({applications:[...r.results,...bot.results]});
 }
 if(method==='POST'&&path==='/api/admin/jobs'){
  const b=await input(req);if(!b||!validText(b.title,3,140)||!validText(b.employer,2,140)||!validText(b.description,10,3000)||!['government','private','military'].includes(b.sector)||!Number.isSafeInteger(b.salary)||b.salary<0||b.salary>100000000)return json({error:'بيانات الوظيفة غير صالحة'},400);
  const id=random();await db.prepare('INSERT INTO vacancies(id,title,employer,sector,description,salary,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,b.title.trim(),b.employer.trim(),b.sector,b.description.trim(),b.salary,user.id).run();await audit(db,user.id,'publish_vacancy','vacancy',id,{});return json({id},201);
 }
 if(method==='POST'&&path==='/api/admin/jobs/status'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['open','closed'].includes(b.status))return json({error:'طلب غير صالح'},400);
  const r=await db.prepare('UPDATE vacancies SET status=? WHERE id=?').bind(b.status,b.id).run();if(!r.meta.changes)return json({error:'الوظيفة غير موجودة'},404);await audit(db,user.id,'vacancy_status','vacancy',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/admin/jobs/application/status'){
  const b=await input(req);if(!b||!validText(b.id,10,80)||!['submitted','reviewing','accepted','rejected'].includes(b.status))return json({error:'طلب غير صالح'},400);
  const bot=await db.prepare("SELECT applicant_id,status FROM shared_service_applications WHERE service='jobs' AND id=?").bind(b.id).first();
  if(bot){
   const updated=await db.prepare("UPDATE shared_service_applications SET status=? WHERE id=? AND service='jobs' AND status IN ('submitted','reviewing')").bind(b.status,b.id).run();
   if(!updated.meta.changes)return json({error:'صدر قرار نهائي على الطلب'},409);
   const contract=b.status==='accepted'?await ensureBotCompanyContract(db,b.id):null;
   await db.prepare('INSERT INTO notifications(id,user_id,subject,body) VALUES(?,?,?,?)').bind(random(),bot.applicant_id,'تحديث طلب التوظيف','حالة الطلب: '+b.status).run();
   await audit(db,user.id,'bot_job_review','shared_service_applications',b.id,{status:b.status,contract_id:contract?.id||null});
   return json({ok:true,contract});
  }
  const row=await db.prepare('SELECT applicant_id,status FROM job_applications WHERE id=?').bind(b.id).first();if(!row)return json({error:'الطلب غير موجود'},404);
  await db.prepare('UPDATE job_applications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.status,b.id).run();
  await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,row.applicant_id,'تحديث طلب التوظيف',`تغيرت حالة طلب التوظيف ${b.id} إلى ${b.status}`).run();
  await audit(db,user.id,'job_application_status','job_application',b.id,{from:row.status,to:b.status});return json({ok:true});
 }
}
// Absher Al-Saliyah: fictional national-services portal; no real-world registration or permits.
if(method==='POST'&&path==='/api/absher/access'){
 const b=await input(req);
 if(!b||!validText(b.line_id,10,80))return json({error:'اختر شريحة إنترنت صالية'},400);
 const line=await db.prepare("SELECT id,data_remaining_mb FROM telecom_lines WHERE id=? AND user_id=? AND status='active' AND expires_at>datetime('now')").bind(b.line_id,user.id).first();
 if(!line||line.data_remaining_mb<1)return json({error:'انتهت الباقة أو الشريحة غير مفعلة؛ جدّدها لاستخدام أبشر الصالية'},409);
 const used=1;const r=await db.prepare("UPDATE telecom_lines SET data_remaining_mb=data_remaining_mb-1 WHERE id=? AND user_id=? AND data_remaining_mb>=1 AND expires_at>datetime('now')").bind(line.id,user.id).run();
 if(!r.meta.changes)return json({error:'لا توجد بيانات كافية'},409);
 await db.prepare("INSERT INTO telecom_usage(id,line_id,kind,units) VALUES(?,?,?,?)").bind(random(),line.id,'absher_mb',used).run();
 return json({ok:true,used_mb:used,remaining_mb:line.data_remaining_mb-used});
}
if(method==='GET'&&path==='/api/absher/overview'){
 const [assets,requests]=await Promise.all([
 db.prepare('SELECT id,kind,name,identifier,notes,status,created_at FROM absher_assets WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all(),
 db.prepare('SELECT id,service,details,status,created_at FROM absher_requests WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all()
 ]);
 return json({assets:assets.results,requests:requests.results});
}
if(method==='POST'&&path==='/api/absher/asset'){
 const b=await input(req);
 if(!b||!['vehicle','weapon'].includes(b.kind)||!validText(b.name,2,100)||!validText(b.identifier,3,50)||typeof b.notes!=='string'||b.notes.length>500)return json({error:'بيانات التسجيل غير صالحة'},400);
 const id=random();try{await db.prepare('INSERT INTO absher_assets(id,user_id,kind,name,identifier,notes) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.kind,b.name.trim(),b.identifier.trim().toUpperCase(),b.notes.trim()).run()}catch{return json({error:'المعرّف مسجل مسبقًا أو غير صالح'},409)}
 await audit(db,user.id,'absher_asset_requested','absher_asset',id,{kind:b.kind});return json({id,status:'pending'},201);
}
if(method==='POST'&&path==='/api/absher/request'){
 const b=await input(req);
 const allowed=['identity','passport','residency','vehicle_registration','vehicle_transfer','driving_license','weapon_registration','weapon_renewal','travel_permission','civil_record','other'];
 if(!b||!allowed.includes(b.service)||!validText(b.details,5,1000))return json({error:'اختر الخدمة واكتب تفاصيل الطلب'},400);
 const id=random();await db.prepare('INSERT INTO absher_requests(id,user_id,service,details) VALUES(?,?,?,?)').bind(id,user.id,b.service,b.details.trim()).run();
 await audit(db,user.id,'absher_service_requested','absher_request',id,{service:b.service});return json({id,status:'pending'},201);
}
if(method==='GET'&&path==='/api/absher/admin'){
 if(user.role!=='king'&&user.role!=='employee')return json({error:'غير مخول'},403);
 const [assets,requests]=await Promise.all([
 db.prepare("SELECT a.id,a.kind,a.name,a.identifier,a.status,u.username FROM absher_assets a JOIN users u ON u.id=a.user_id WHERE a.status='pending' ORDER BY a.created_at DESC LIMIT 100").all(),
 db.prepare("SELECT a.id,a.service,a.details,a.status,u.username FROM absher_requests a JOIN users u ON u.id=a.user_id WHERE a.status='pending' ORDER BY a.created_at DESC LIMIT 100").all()
 ]);return json({assets:assets.results,requests:requests.results});
}
if(method==='POST'&&path==='/api/absher/decision'){
 if(user.role!=='king'&&user.role!=='employee')return json({error:'غير مخول'},403);
 const b=await input(req);
 if(!b||!['asset','request'].includes(b.kind)||!['approved','rejected'].includes(b.decision)||!validText(b.id,10,80))return json({error:'قرار غير صالح'},400);
 const table=b.kind==='asset'?'absher_assets':'absher_requests';
 const row=await db.prepare('SELECT user_id FROM '+table+" WHERE id=? AND status='pending'").bind(b.id).first();if(!row)return json({error:'الطلب غير موجود أو سبق البت فيه'},409);
 const result=await db.prepare('UPDATE '+table+" SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(b.decision,b.id).run();
 if(!result.meta.changes)return json({error:'سبق البت في الطلب'},409);
 await db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body) VALUES(?,?,?,?,?)').bind(random(),user.id,row.user_id,'قرار أبشر الصالية','حالة الطلب '+b.id+' أصبحت '+b.decision).run();
 await audit(db,user.id,'absher_decision',table,b.id,{decision:b.decision});return json({ok:true});
}
return json({error:'المسار غير موجود'},404);
}catch(e){console.error(e);return json({error:'خطأ داخلي في الخادم'},500)}}};
