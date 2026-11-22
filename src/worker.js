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
const botMinisters=ministries.filter(m=>m.id!==0&&m.id!==1).map(m=>({...m,minister:'الوزير الآلي '+m.name.replace('وزارة ','')+' 🤖',automated:true}));
async function runSaliyahGovernment(db){
 const hour=Math.floor(Date.now()/3600000);
 const plans=[
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
 await db.prepare("INSERT OR IGNORE INTO saliyah_sim_companies(id,founder_id,name,activity,location,description,capital,status) VALUES(?,?,?,?,?,?,?,'pending_human')").bind(companyId,'citizen-'+(hour*3),...venture).run();
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
 }
}
// Clearly labelled simulated activity: bot accounts never impersonate ministries or publish real decrees.
async function generateXBotActivity(db){
 const names=['نواف','سارة','راكان','ليان','فهد','ريم','تركي','جود','ماجد','هيا','بدر','دانة','سلطان','نورة','مشعل','لمى','عبدالله','شهد','فيصل','غلا','خالد','أريج','عمر','رغد','سلمان','مها','يوسف','رنا','طلال','عبير'];
 const topics=[
 'وش رأيكم في تجربة إكس الصالية اليوم؟ 🤖',
 'تذكير من حساب آلي: تابعوا الأخبار الحكومية من الحسابات الرسمية الموثقة فقط.',
 'سؤال للنقاش: وش الخدمة اللي تتمنون إضافتها للبنوك الصالية؟ 🏦',
 'تجربة محاكاة: لو صار عندنا قرار صالي جديد عن الخدمات الإلكترونية، وش أول شيء تتمنونه؟',
 'الهلل الصالي صار موضوع نقاشنا اليوم 💰 وش رأيكم بطريقة الدفع؟',
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
 const botIds=[];
 for(let i=0;i<names.length;i++){
  const handle='saliyah_bot_'+String(i+1).padStart(2,'0');
  const id='x-sim-bot-'+String(i+1).padStart(2,'0');
  await db.prepare("INSERT OR IGNORE INTO x_profiles(id,user_id,handle,display_name,bio,kind,verified) VALUES(?,NULL,?,?,?,'bot',0)").bind(id,handle,names[i]+' 🤖','حساب آلي محاكى للنقاش والترفيه؛ ليس جهة رسمية').run();
  botIds.push(id);
 }
 const now=Math.floor(Date.now()/3600000);
 // Idempotent per hour, safe if the scheduled job is retried.
 for(let i=0;i<18;i++){
  const id='sim-'+now+'-'+i;
  const profile=botIds[(now*7+i*11)%botIds.length];
  const body=topics[(now*3+i*7)%topics.length];
  await db.prepare('INSERT OR IGNORE INTO x_posts(id,profile_id,body) VALUES(?,?,?)').bind(id,profile,body).run();
 }
 const posts=await db.prepare("SELECT id,profile_id FROM x_posts ORDER BY created_at DESC LIMIT 90").all();
 for(let i=0;i<Math.min(180,posts.results.length*3);i++){
  const p=posts.results[(now*13+i*17)%posts.results.length];
  const bot=botIds[(now*5+i*7)%botIds.length];
  if(bot===p.profile_id)continue;
  await db.prepare('INSERT OR IGNORE INTO x_likes(profile_id,post_id) VALUES(?,?)').bind(bot,p.id).run();
 }
}
export default {async scheduled(event,env,ctx){ctx.waitUntil(Promise.all([generateXBotActivity(env.DB),runSaliyahGovernment(env.DB)]))},async fetch(req,env){const u=new URL(req.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);try{if(!env.DB)return json({error:'Database binding missing'},503);const db=env.DB;const method=req.method;const path=u.pathname;const user=(path==='/api/auth/login'||path==='/api/setup/king'||path==='/api/setup/status'||path==='/api/setup/recover-owner'||path==='/api/auth/citizen/register')?null:await actor(req,db);if(method!=='GET'&&method!=='HEAD'){const origin=req.headers.get('origin');const site=req.headers.get('sec-fetch-site');if((origin&&origin!==u.origin)||(site&&site!=='same-origin'&&site!=='none'))return json({error:'مصدر الطلب غير مسموح'},403);}

// X Al-Saliyah: profiles are bound to authenticated accounts; ministry verification
// is granted only for a ministry assignment recorded by the government.
if(path.startsWith('/api/x/')){
 const profileFor=async()=>user?db.prepare('SELECT * FROM x_profiles WHERE user_id=?').bind(user.id).first():null;
 const botReachSQL="SELECT COALESCE(SUM(CAST((max(0,julianday('now')-julianday(created_at))*max(0,julianday('now')-julianday(created_at))*1250)+(bot_likes*min(1,max(0,julianday('now')-julianday(created_at))/3)) AS INTEGER)),0) bot_likes,COALESCE(SUM(CAST((max(0,julianday('now')-julianday(created_at))*max(0,julianday('now')-julianday(created_at))*75)+(bot_reposts*min(1,max(0,julianday('now')-julianday(created_at))/3)) AS INTEGER)),0) bot_reposts FROM x_bot_reach WHERE post_id IN (SELECT id FROM x_posts WHERE profile_id=?)";
 const creatorStats=async profileId=>{
  const real=await db.prepare("SELECT (SELECT COUNT(*) FROM x_follows f WHERE f.following_id=?) followers,(SELECT COUNT(*) FROM x_likes l JOIN x_posts p ON p.id=l.post_id WHERE p.profile_id=? AND l.profile_id<>?) likes,(SELECT COUNT(DISTINCT r.profile_id) FROM x_posts r JOIN x_posts p ON p.id=r.repost_of WHERE p.profile_id=? AND r.profile_id<>?) reposts,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM x_follows f JOIN x_profiles actor ON actor.id=f.follower_id WHERE f.following_id=?) followers_twice,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM x_likes l JOIN x_posts p ON p.id=l.post_id JOIN x_profiles actor ON actor.id=l.profile_id WHERE p.profile_id=? AND l.profile_id<>?) likes_twice,(SELECT COALESCE(SUM(CASE WHEN actor.kind='bot' THEN 1 ELSE 2 END),0) FROM (SELECT DISTINCT r.profile_id FROM x_posts r JOIN x_posts original ON original.id=r.repost_of WHERE original.profile_id=?) rr JOIN x_profiles actor ON actor.id=rr.profile_id WHERE rr.profile_id<>?) reposts_twice").bind(profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId,profileId).first();
  const bots=await db.prepare(botReachSQL).bind(profileId).first();
  const botFollowers=Math.floor(bots.bot_likes/100);
  return {...real,bot_likes:bots.bot_likes,bot_reposts:bots.bot_reposts,bot_followers:botFollowers,followers:real.followers+botFollowers,likes:real.likes+bots.bot_likes,reposts:real.reposts+bots.bot_reposts,followers_twice:real.followers_twice+botFollowers,likes_twice:real.likes_twice+bots.bot_likes,reposts_twice:real.reposts_twice+bots.bot_reposts};
 };

 if(method==='GET'&&path==='/api/x/feed'){
  const rows=await db.prepare("SELECT p.id,p.body,p.reply_to,p.repost_of,p.created_at,a.id profile_id,a.handle,a.display_name,a.kind,a.verified,(SELECT mime_type FROM x_post_media WHERE post_id=p.id) media_type,(SELECT COUNT(*) FROM x_likes l WHERE l.post_id=p.id)+(SELECT COALESCE(CAST((max(0,julianday('now')-julianday(b.created_at))*max(0,julianday('now')-julianday(b.created_at))*1250)+(b.bot_likes*min(1,max(0,julianday('now')-julianday(b.created_at))/3)) AS INTEGER),0) FROM x_bot_reach b WHERE b.post_id=p.id) likes,(SELECT COUNT(*) FROM x_posts r WHERE r.reply_to=p.id) replies FROM x_posts p JOIN x_profiles a ON a.id=p.profile_id ORDER BY p.created_at DESC LIMIT 100").all();
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
 if(method==='GET'&&path==='/api/x/bot-comments'){
  const id=u.searchParams.get('post_id')||'';
  const p=await db.prepare('SELECT p.id,p.body,p.created_at,b.created_at started FROM x_posts p JOIN x_bot_reach b ON b.post_id=p.id WHERE p.id=?').bind(id).first();
  if(!p)return json({error:'المنشور غير موجود أو لا توجد تفاعلات آلية'},404);
  const ageDays=Math.max(0,(Date.now()-Date.parse(p.started.replace(' ','T')+'Z'))/86400000);
  const count=Math.min(30,Math.floor(ageDays*1.8));
  const names=['نواف 🤖','سارة 🤖','راكان 🤖','ليان 🤖','فهد 🤖','ريم 🤖','تركي 🤖','جود 🤖','عبدالله 🤖','شهد 🤖','ماجد 🤖','هيا 🤖'];
  const comments=['طرح جميل 👏','اتفق معك 👍','موضوع يستحق النقاش','أول مرة أشوف هالكلام 👀','واصل النشر 🔥','مثير للاهتمام','وش رأي الباقين؟','أعجبني المنشور ❤️','ننتظر المزيد','مشاركة موفقة','فكرة حلوة','تفاعل قوي هنا 🔥'];
  let hash=0;for(const c of p.id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const items=Array.from({length:count},(_,i)=>({name:names[(hash+i*7)%names.length],body:comments[(hash+i*5)%comments.length],bot:true}));
  return json({comments:items,simulated:true});
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
  const history=await db.prepare('SELECT period,amount,created_at FROM x_creator_payouts WHERE profile_id=? ORDER BY created_at DESC LIMIT 12').bind(own.id).all();
  return json({stats,eligible,amount,period,paid:!!paid,history:history.results,requirements:{followers:10,likes:20,reposts:5},period_cap:null,unlimited_earnings:true,period_days:3,kind:own.kind});
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
  await audit(db,user.id,'x_creator_reward','x_creator_payout',id,{amount,period});
  return json({ok:true,amount,period});
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
 const rows=await db.prepare('SELECT * FROM saliyah_projects ORDER BY created_at DESC LIMIT 100').all();
 return json({projects:rows.results});
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
  '/api/education/','/api/company/','/api/citizen/profile/phone'
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
  const h=await db.prepare("SELECT s.*,u.username subject_username FROM service_suspensions_v2 s JOIN users u ON u.id=s.subject_user_id ORDER BY s.created_at DESC LIMIT 100").all();
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
  const c=await db.prepare('SELECT id,employer,title,salary,active FROM employment_contracts WHERE employee_id=? ORDER BY created_at DESC').bind(user.id).all();
  const p=await db.prepare('SELECT p.id,p.period,p.amount,p.created_at,c.employer,c.title FROM payroll_payments p JOIN employment_contracts c ON c.id=p.contract_id WHERE c.employee_id=? ORDER BY p.period DESC LIMIT 100').bind(user.id).all();return json({contracts:c.results,payments:p.results});
 }
 if(!admin)return json({error:'إدارة الرواتب للملك فقط'},403);
 if(method==='GET'&&path==='/api/payroll/admin'){
  const budgets=await db.prepare('SELECT * FROM employer_budgets ORDER BY employer').all();
  const accepted=await db.prepare("SELECT a.id,a.applicant_id,u.username,v.employer,v.sector,v.title,v.salary FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id JOIN users u ON u.id=a.applicant_id LEFT JOIN employment_contracts c ON c.application_id=a.id WHERE a.status='accepted' AND c.id IS NULL ORDER BY a.created_at DESC LIMIT 100").all();
  const contracts=await db.prepare('SELECT c.*,u.username FROM employment_contracts c JOIN users u ON u.id=c.employee_id ORDER BY c.created_at DESC LIMIT 200').all();
  const payments=await db.prepare('SELECT p.*,c.employer,c.title,u.username FROM payroll_payments p JOIN employment_contracts c ON c.id=p.contract_id JOIN users u ON u.id=c.employee_id ORDER BY p.created_at DESC LIMIT 100').all();return json({budgets:budgets.results,accepted:accepted.results,contracts:contracts.results,payments:payments.results});
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
  const r=await db.prepare('UPDATE employment_contracts SET active=? WHERE id=?').bind(b.active?1:0,b.id).run();if(!r.meta.changes)return json({error:'العقد غير موجود'},404);await audit(db,user.id,'employment_status','employment_contract',b.id,{active:b.active});return json({ok:true});
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

// Phase 10: schools, universities and academic results.
if(path.startsWith('/api/education/')){
 const manage=await can('education');
 if(method==='GET'&&path==='/api/education/institutions'){
  const r=await db.prepare('SELECT id,name,level,sector,capacity,min_grade,fee,active FROM education_institutions WHERE active=1 OR ?=1 ORDER BY created_at DESC').bind(manage?1:0).all();return json({institutions:r.results,can_manage:manage});
 }
 if(method==='POST'&&path==='/api/education/institutions'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);
  if(!b||!validText(b.name,2,120)||!['primary','middle','secondary','university'].includes(b.level)||!['public','private'].includes(b.sector)||!Number.isInteger(b.capacity)||b.capacity<1||b.capacity>100000||!Number.isFinite(b.min_grade)||b.min_grade<0||b.min_grade>100||!Number.isSafeInteger(b.fee)||b.fee<0||b.fee>100000000)return json({error:'بيانات المؤسسة غير صالحة'},400);
  if(b.sector==='public'&&b.fee!==0)return json({error:'المؤسسة الحكومية بلا رسوم'},400);
  const id=random();await db.prepare('INSERT INTO education_institutions(id,name,level,sector,capacity,min_grade,fee,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.name.trim(),b.level,b.sector,b.capacity,b.min_grade,b.fee,user.id).run();await audit(db,user.id,'education_institution_create','institution',id,{name:b.name});return json({id},201);
 }
 if(method==='POST'&&path==='/api/education/apply'){
  const b=await input(req);if(!b||!validText(b.institution_id,10,80)||!(b.previous_grade===null||b.previous_grade===undefined||(typeof b.previous_grade==='number'&&b.previous_grade>=0&&b.previous_grade<=100)))return json({error:'طلب غير صالح'},400);
  const inst=await db.prepare('SELECT * FROM education_institutions WHERE id=? AND active=1').bind(b.institution_id).first();if(!inst)return json({error:'المؤسسة غير موجودة'},404);
  const student=typeof b.student_id==='string'&&b.student_id!==user.id?b.student_id:user.id;
  if(student!==user.id)return json({error:'تقديم ولي الأمر يتطلب ربطًا موثقًا، غير مفعّل بعد'},403);
  if(inst.level!=='primary'&&(b.previous_grade===null||b.previous_grade===undefined||b.previous_grade<inst.min_grade))return json({error:'الدرجة السابقة لا تحقق شروط القبول'},409);
  const id=random();try{await db.prepare('INSERT INTO education_applications(id,institution_id,student_id,previous_grade) VALUES(?,?,?,?)').bind(id,inst.id,user.id,b.previous_grade??null).run()}catch{return json({error:'تم تقديم طلب لهذه المؤسسة سابقًا'},409)}
  await audit(db,user.id,'education_apply','education_application',id,{institution_id:inst.id});return json({id,status:'submitted'},201);
 }
 if(method==='GET'&&path==='/api/education/applications'){
  const r=manage?await db.prepare('SELECT a.*,i.name institution_name,i.level FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id ORDER BY a.created_at DESC LIMIT 200').all():await db.prepare('SELECT a.*,i.name institution_name,i.level FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.student_id=? ORDER BY a.created_at DESC LIMIT 100').bind(user.id).all();return json({applications:r.results});
 }
 if(method==='POST'&&path==='/api/education/review'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.id,10,80)||!['accepted','rejected'].includes(b.status))return json({error:'بيانات غير صالحة'},400);
  const row=await db.prepare('SELECT a.*,i.capacity,i.min_grade,i.level FROM education_applications a JOIN education_institutions i ON i.id=a.institution_id WHERE a.id=?').bind(b.id).first();if(!row)return json({error:'الطلب غير موجود'},404);if(row.status!=='submitted')return json({error:'سبقت مراجعة الطلب'},409);
  if(b.status==='accepted'){
   if(row.level!=='primary'&&(row.previous_grade===null||row.previous_grade<row.min_grade))return json({error:'الدرجة أقل من شرط القبول'},409);
   // Atomic capacity check: the UPDATE only succeeds while accepted count is below capacity.
   const r=await db.prepare("UPDATE education_applications SET status='accepted',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted' AND (SELECT COUNT(*) FROM education_applications WHERE institution_id=? AND status='accepted') < ?").bind(user.id,b.id,row.institution_id,row.capacity).run();if(!r.meta.changes)return json({error:'اكتملت المقاعد أو سبق اعتماد الطلب'},409);
  }else{const r=await db.prepare("UPDATE education_applications SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(user.id,b.id).run();if(!r.meta.changes)return json({error:'سبق اعتماد الطلب'},409)}
  await audit(db,user.id,'education_review','education_application',b.id,{status:b.status});return json({ok:true});
 }
 if(method==='POST'&&path==='/api/education/grade'){
  if(!manage)return json({error:'غير مخول'},403);const b=await input(req);if(!b||!validText(b.application_id,10,80)||typeof b.grade!=='number'||b.grade<0||b.grade>100||!Number.isFinite(b.grade)||!(b.retest===undefined||typeof b.retest==='boolean'))return json({error:'درجة غير صالحة'},400);
  const row=await db.prepare("SELECT id FROM education_applications WHERE id=? AND status='accepted'").bind(b.application_id).first();if(!row)return json({error:'لا يوجد قبول معتمد'},404);
  const prior=await db.prepare('SELECT * FROM education_grades WHERE application_id=?').bind(b.application_id).first();
  if(b.retest){if(!prior||prior.original_grade<55||prior.original_grade>=70||prior.retest_grade!==null)return json({error:'الإعادة متاحة مرة واحدة للدرجات من 55 إلى أقل من 70'},409);await db.prepare('UPDATE education_grades SET retest_grade=?,recorded_by=?,updated_at=CURRENT_TIMESTAMP WHERE application_id=?').bind(b.grade,user.id,b.application_id).run();}
  else{if(prior)return json({error:'الدرجة الأصلية مسجلة؛ استخدم اختبار الإعادة عند الاستحقاق'},409);await db.prepare('INSERT INTO education_grades(id,application_id,original_grade,recorded_by) VALUES(?,?,?,?)').bind(random(),b.application_id,b.grade,user.id).run()}
  await audit(db,user.id,'education_grade','education_application',b.application_id,{grade:b.grade,retest:!!b.retest});return json({ok:true});
 }
 if(method==='GET'&&path==='/api/education/transcript'){
  const r=manage?await db.prepare('SELECT g.*,a.student_id,i.name institution_name FROM education_grades g JOIN education_applications a ON a.id=g.application_id JOIN education_institutions i ON i.id=a.institution_id ORDER BY g.updated_at DESC LIMIT 200').all():await db.prepare('SELECT g.*,a.student_id,i.name institution_name FROM education_grades g JOIN education_applications a ON a.id=g.application_id JOIN education_institutions i ON i.id=a.institution_id WHERE a.student_id=? ORDER BY g.updated_at DESC').bind(user.id).all();return json({grades:r.results.map(x=>({...x,final_grade:x.retest_grade??x.original_grade}))});
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
 const r=await db.prepare('SELECT id,from_number,to_number,body,created_at FROM telecom_sms WHERE from_line_id=? OR to_line_id=? ORDER BY created_at DESC LIMIT 100').bind(line,line).all();return json({messages:r.results});
}
if(method==='POST'&&path==='/api/telecom/sms'){
 const b=await input(req);if(!b||!validText(b.line_id,10,80)||!/^05[0-9]{8}$/.test(b.to_number||'')||!validText(b.body,1,500))return json({error:'رقم المستلم أو نص الرسالة غير صالح'},400);
 const from=await db.prepare("SELECT id,number FROM telecom_lines WHERE id=? AND user_id=? AND status='active'").bind(b.line_id,user.id).first();if(!from)return json({error:'الشريحة غير متاحة'},403);
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
 const b=await input(req);if(!b||!validText(b.merchant_id,10,80)||!validText(b.customer,3,80)||!Number.isSafeInteger(b.amount)||b.amount<1||b.amount>1000000||typeof b.description!=='string'||b.description.length>200)return json({error:'بيانات طلب الدفع غير صالحة'},400);
 const m=await db.prepare('SELECT id FROM pos_merchants WHERE id=? AND owner_id=?').bind(b.merchant_id,user.id).first();if(!m)return json({error:'المتجر غير موجود'},404);
 const customer=await db.prepare('SELECT id FROM users WHERE username=?').bind(b.customer.trim().toLowerCase()).first();if(!customer||customer.id===user.id)return json({error:'المشتري غير موجود أو غير مسموح'},400);
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
 const card=await db.prepare("SELECT c.id,a.balance FROM bank_cards c JOIN bank_accounts a ON a.id=c.account_id WHERE a.id=? AND a.user_id=? AND c.status='active' LIMIT 1").bind(b.account_id.trim(),user.id).first();if(!card)return json({error:'الحساب لا يخصك أو ليس له بطاقة نشطة'},403);if(card.balance<pay.amount)return json({error:'الرصيد غير كافٍ'},409);
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
 return json({accounts:rows.results});
}
if(method==='POST'&&path==='/api/banking/accounts'){
 const b=await input(req);if(!b||!['saliyah','national','development'].includes(b.bank))return json({error:'البنك غير صالح'},400);
 const id=random();await db.prepare('INSERT OR IGNORE INTO bank_accounts(id,user_id,bank) VALUES(?,?,?)').bind(id,user.id,b.bank).run();
 const account=await db.prepare('SELECT id,bank,balance FROM bank_accounts WHERE user_id=? AND bank=?').bind(user.id,b.bank).first();
 return json({account},201);
}
if(method==='GET'&&path==='/api/banking/transfers'){
 const r=await db.prepare(`SELECT t.id,t.amount,t.memo,t.created_at,t.sender_account,t.recipient_account,sa.bank sender_bank,ra.bank recipient_bank,su.username sender,ru.username recipient FROM bank_transfers t JOIN bank_accounts sa ON sa.id=t.sender_account JOIN bank_accounts ra ON ra.id=t.recipient_account JOIN users su ON su.id=sa.user_id JOIN users ru ON ru.id=ra.user_id WHERE sa.user_id=? OR ra.user_id=? ORDER BY t.created_at DESC LIMIT 100`).bind(user.id,user.id).all();return json({transfers:r.results});
}
if(method==='POST'&&path==='/api/banking/transfer'){
 const b=await input(req);if(!b||!validText(b.from,10,80)||!validText(b.recipient,3,80)||!['saliyah','national','development'].includes(b.bank)||!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>100000000||typeof b.memo!=='string'||b.memo.length>200)return json({error:'بيانات التحويل غير صالحة'},400);
 const sender=await db.prepare('SELECT id,balance FROM bank_accounts WHERE id=? AND user_id=?').bind(b.from,user.id).first();if(!sender)return json({error:'الحساب المرسل غير موجود'},404);
 const recipient=await db.prepare('SELECT a.id,a.user_id FROM bank_accounts a JOIN users u ON u.id=a.user_id WHERE u.username=? AND a.bank=?').bind(b.recipient.trim().toLowerCase(),b.bank).first();if(!recipient)return json({error:'حساب المستلم غير موجود في البنك المحدد'},404);
 if(recipient.user_id===user.id)return json({error:'التحويل إلى حسابك غير متاح من هذه الشاشة'},400);
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
 if(method==='GET'&&path==='/api/civil/family-cards'){const r=await db.prepare("SELECT * FROM family_cards ORDER BY updated_at DESC LIMIT 100").all();return json({cards:r.results.map(x=>({...x,children:JSON.parse(x.children_json||'[]')}))});}
 if(method==='POST'&&path==='/api/civil/family-cards'){const b=await input(req);if(!b||!validText(b.father_name,2,160)||!validText(b.mother_name,2,160)||!Array.isArray(b.children)||b.children.length>10||b.children.some(c=>!validText(c,2,160)))return json({error:'أدخل اسمي الأب والأم وما يصل إلى 10 أبناء'},400);const id=random(),number='FAM-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase(),children=JSON.stringify(b.children.map(x=>x.trim()));await db.batch([db.prepare("INSERT INTO family_cards(id,number,father_name,mother_name,children_json,created_by,phone) VALUES(?,?,?,?,?,?,?)").bind(id,number,b.father_name.trim(),b.mother_name.trim(),children,user.id,b.phone?.trim()||null),db.prepare("INSERT INTO family_card_history(id,family_id,action,new_children_json,actor_id) VALUES(?,?,'issue',?,?)").bind(random(),id,children,user.id)]);await audit(db,user.id,'issue_family_card','family_card',id,{number,fee:0});return json({id,number,fee:0},201);}
 if(method==='POST'&&path==='/api/civil/family-cards/renew'){const b=await input(req);if(!b||!validText(b.id,10,80)||!validText(b.reason,3,300)||!validText(b.father_name,2,160)||!validText(b.mother_name,2,160)||!Array.isArray(b.children)||b.children.length>10||b.children.some(c=>!validText(c,2,160)))return json({error:'بيانات التجديد غير صالحة'},400);const old=await db.prepare("SELECT * FROM family_cards WHERE id=?").bind(b.id).first();if(!old)return json({error:'سجل الأسرة غير موجود'},404);const children=JSON.stringify(b.children.map(x=>x.trim()));if(old.children_json===children&&old.father_name===b.father_name.trim()&&old.mother_name===b.mother_name.trim()&&(old.phone||'')===(b.phone?.trim()||''))return json({error:'لا توجد تغييرات تستدعي التجديد'},409);await db.batch([db.prepare("UPDATE family_cards SET father_name=?,mother_name=?,children_json=?,phone=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.father_name.trim(),b.mother_name.trim(),children,b.phone?.trim()||null,b.id),db.prepare("INSERT INTO family_card_history(id,family_id,action,previous_children_json,new_children_json,reason,actor_id) VALUES(?,?,'renew',?,?,?,?)").bind(random(),b.id,old.children_json,children,b.reason.trim(),user.id)]);await audit(db,user.id,'renew_family_card','family_card',b.id,{reason:b.reason.trim(),fee:0});return json({ok:true,fee:0});}
 if(method==='POST'&&path==='/api/civil/intake'){const b=await input(req);if(!b||!validText(b.full_name,2,160))return json({error:'الاسم الكامل مطلوب'},400);const id=random(),reference='CIV-'+Date.now().toString(36).toUpperCase()+'-'+id.slice(0,5).toUpperCase();await db.prepare('INSERT INTO civil_intake(id,reference,full_name,parent_name,birth_date,details,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,reference,b.full_name.trim(),String(b.parent_name||'').slice(0,160),b.birth_date||null,String(b.details||'').slice(0,2000),user.id).run();await audit(db,user.id,'civil_intake','civil_intake',id,{reference});return json({id,reference,status:'recorded'},201);}
 if(method==='GET'&&path==='/api/civil/intake'){const r=await db.prepare('SELECT * FROM civil_intake ORDER BY created_at DESC LIMIT 100').all();return json({applications:r.results});}
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
 const r=await db.prepare("SELECT id,title,employer,sector,description,salary,status,created_at FROM vacancies WHERE status='open' ORDER BY created_at DESC LIMIT 100").all();return json({jobs:r.results});
}
if(method==='GET'&&path==='/api/jobs/mine'){
 if(!user)return json({error:'سجل الدخول أولًا'},401);
 const r=await db.prepare('SELECT a.id,a.vacancy_id,a.status,a.created_at,v.title,v.employer FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id WHERE a.applicant_id=? ORDER BY a.created_at DESC').bind(user.id).all();return json({applications:r.results});
}
if(method==='POST'&&path==='/api/jobs/apply'){
 if(!user)return json({error:'سجل الدخول أولًا'},401);
 const b=await input(req);if(!b||!validText(b.vacancy_id,10,80)||!validText(b.statement,10,2000))return json({error:'اختر وظيفة واكتب نبذة عن مؤهلاتك'},400);
 const v=await db.prepare("SELECT id FROM vacancies WHERE id=? AND status='open'").bind(b.vacancy_id).first();if(!v)return json({error:'الوظيفة غير متاحة'},404);
 const id=random();try{await db.prepare('INSERT INTO job_applications(id,vacancy_id,applicant_id,statement) VALUES(?,?,?,?)').bind(id,v.id,user.id,b.statement.trim()).run()}catch{return json({error:'سبق التقديم لهذه الوظيفة'},409)}
 await audit(db,user.id,'apply_job','job_application',id,{vacancy_id:v.id});return json({id,status:'submitted'},201);
}
if(path.startsWith('/api/admin/jobs')){
 if(!user||user.role!=='king')return json({error:'إدارة الوظائف للملك فقط في هذه المرحلة'},403);
 if(method==='GET'&&path==='/api/admin/jobs/applications'){
  const r=await db.prepare('SELECT a.id,a.status,a.statement,a.created_at,v.title,v.employer,u.username applicant FROM job_applications a JOIN vacancies v ON v.id=a.vacancy_id JOIN users u ON u.id=a.applicant_id ORDER BY a.created_at DESC LIMIT 200').all();return json({applications:r.results});
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
