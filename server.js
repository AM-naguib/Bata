// Attendify - حاضر | بدون أي مكتبات: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000, PASS=process.env.DOCTOR_PASSWORD;
if(typeof PASS!=='string'||PASS.length<12)throw Error('DOCTOR_PASSWORD must be set to a secret of at least 12 characters');
const SECRET=crypto.randomBytes(16).toString('hex');
const SLOT=30000, MAX_ABSENCE=25, MAX_ACC=150, DB=process.env.DB_FILE||'data.json';
const students=JSON.parse(fs.readFileSync(path.join(__dirname,'students.json'),'utf8'));
const byId=Object.fromEntries(students.map(s=>[s.id,s]));
let db={lectures:[],att:[],devices:{}};
try{db=JSON.parse(fs.readFileSync(DB,'utf8'));
  if(!db||!Array.isArray(db.lectures)||!Array.isArray(db.att)||!db.devices||typeof db.devices!=='object'||Array.isArray(db.devices))throw Error('invalid data schema');
}catch(e){if(e.code!=='ENOENT')throw Error('Refusing to start: attendance database is invalid or unreadable', {cause:e})}
const save=()=>{fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB)};
const sig=(l,s)=>crypto.createHmac('sha256',SECRET).update(l+'.'+s).digest('hex').slice(0,16);
const slot=()=>Math.floor(Date.now()/SLOT);
const mkToken=l=>{const s=slot();return l+'.'+s+'.'+sig(l,s)};
const valid=t=>{if(typeof t!=='string')return false;
  const match=/^([a-f0-9]{8})\.([0-9]{1,14})\.([a-f0-9]{16})$/.exec(t);
  if(!match)return false;const [,l,s,g]=match;const age=slot()-Number(s);
  return age>=0&&age<=1&&crypto.timingSafeEqual(Buffer.from(g,'hex'),Buffer.from(sig(l,s),'hex'))};
const dist=(a,b,c,d)=>{const R=6371000,r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const sessions=new Map(), hits=new Map(), loginHits=new Map();
const SESSION_MS=12*60*60*1000;
const limited=(map,key,max,windowMs)=>{const now=Date.now();let h=map.get(key);if(!h||now-h.t>=windowMs){h={t:now,n:0};map.set(key,h)}h.n++;if(map.size>2000)for(const [k,v] of map)if(now-v.t>=windowMs)map.delete(k);return h.n>max};
const json=(res,o,c=200)=>{res.writeHead(c,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const err=(res,m,c=400)=>json(res,{ok:false,error:m},c);
const body=req=>new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e5)req.destroy()});req.on('end',()=>{try{r(JSON.parse(d||'{}'))}catch{r({})}})});
const authed=req=>{const sid=(/sid=([a-f0-9]{32})/.exec(req.headers.cookie||'')||[])[1];const expiry=sessions.get(sid);if(!expiry)return false;if(expiry<=Date.now()){sessions.delete(sid);return false}return true};
const count=id=>db.att.filter(a=>a.l===id).length;

function report(){
  const Ls=db.lectures.filter(L=>!L.deletedAt);
  const rows=students.map(s=>{const p=Ls.map(L=>db.att.some(a=>a.l===L.id&&a.s===s.id));
    const n=p.filter(Boolean).length,abs=Ls.length-n;
    return {id:s.id,name:s.name,p,n,abs,pct:Ls.length?Math.round(abs/Ls.length*100):0}});
  return {lectures:Ls.map(L=>({id:L.id,title:L.title,date:L.date,lecturerName:L.lecturerName||'',courseName:L.courseName||''})),rows,max:MAX_ABSENCE};
}
const csv=()=>{const R=report(),q=x=>'"'+String(x).replace(/"/g,'""')+'"';
  const h=['رقم الجلوس','الاسم',...R.lectures.map(L=>(L.courseName?L.courseName+' - ':'')+L.title+(L.lecturerName?' - '+L.lecturerName:'')+' '+L.date),'حضور','غياب','نسبة الغياب %','الحالة'];
  const lines=R.rows.map(r=>[r.id,r.name,...r.p.map(x=>x?'✓':'✗'),r.n,r.abs,r.pct,r.pct>=R.max?'محرومة':'منتظمة']);
  return '\ufeff'+[h,...lines].map(l=>l.map(q).join(',')).join('\r\n')};

async function api(req,res,p){
  const m=req.method;
  if(m==='POST'&&p==='/api/login'){const ip=req.socket.remoteAddress;
    if(limited(loginHits,ip,10,15*60*1000))return err(res,'محاولات تسجيل دخول كثيرة، جرّب لاحقاً',429);
    const b=await body(req);if(b.password!==PASS)return err(res,'كلمة السر غلط',401);
    loginHits.delete(ip);const sid=crypto.randomBytes(16).toString('hex');sessions.set(sid,Date.now()+SESSION_MS);
    res.setHeader('Set-Cookie','sid='+sid+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+(process.env.NODE_ENV==='production'?'; Secure':''));return json(res,{ok:true})}
  if(m==='POST'&&p==='/api/attend'){
    const ip=req.socket.remoteAddress;
    if(limited(hits,ip,40,6e4))return err(res,'محاولات كتير، استني شوية',429);
    const b=await body(req),L=db.lectures.find(x=>x.id===String(b.token||'').split('.')[0]);
    if(!L||!valid(b.token))return err(res,'الـ QR قديم أو غير صالح، امسحي الكود الحالي على الشاشة');
    if(L.closed||L.deletedAt)return err(res,'المحاضرة اتقفلت أو اتحذفت');
    const s=byId[String(b.studentId||'').trim()];if(!s)return err(res,'رقم الجلوس غير موجود');
    const dev=String(b.deviceId||'').slice(0,64);if(!dev)return err(res,'جهاز غير معروف');
    if(db.devices[s.id]&&db.devices[s.id]!==dev)return err(res,'رقم الجلوس ده مسجل على موبايل تاني، كلّمي الدكتور');
    if(db.att.some(a=>a.l===L.id&&a.dev===dev&&a.s!==s.id))return err(res,'الموبايل ده سجّل حضور لطالبة تانية في المحاضرة دي');
    if(db.att.some(a=>a.l===L.id&&a.s===s.id))return json(res,{ok:true,studentName:s.name,message:'حضورك متسجل قبل كده ✔'});
    const {lat,lng,accuracy:acc}=b;
    if(typeof lat!=='number'||!Number.isFinite(lat)||lat < -90||lat > 90||typeof lng!=='number'||!Number.isFinite(lng)||lng < -180||lng > 180)return err(res,'إحداثيات GPS غير صالحة');
    if(typeof acc!=='number'||!Number.isFinite(acc)||acc<=0)return err(res,'دقة GPS غير صالحة');
    if(acc>MAX_ACC)return err(res,'دقة الـ GPS ضعيفة ('+Math.round(acc)+'م)، اطلعي مكان مفتوح أو فعّلي الموقع الدقيق');
    const d=dist(L.lat,L.lng,lat,lng);
    if(d>L.radius)return err(res,'إنتي بره القاعة (بعيد '+Math.round(d)+' متر)');
    db.devices[s.id]=dev;db.att.push({l:L.id,s:s.id,dev,t:Date.now(),d:Math.round(d)});save();
    return json(res,{ok:true,studentName:s.name,message:'تم تسجيل حضورك يا '+s.name.split(' ').slice(0,2).join(' ')+' ✅'})}
  if(!authed(req))return err(res,'غير مصرح',401);
  if(m==='POST'&&p==='/api/logout'){const sid=(/sid=([a-f0-9]{32})/.exec(req.headers.cookie||'')||[])[1];sessions.delete(sid);
    res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));return json(res,{ok:true})}
  let x;
  if(m==='GET'&&p==='/api/lectures')return json(res,db.lectures.filter(L=>!L.deletedAt).map(L=>({...L,count:count(L.id)})).reverse());
  if(m==='GET'&&p==='/api/lectures/deleted')return json(res,db.lectures.filter(L=>!!L.deletedAt).map(L=>({id:L.id,title:L.title,courseName:L.courseName||'',lecturerName:L.lecturerName||'',date:L.date,deletedAt:L.deletedAt})).reverse());
  if(m==='POST'&&p==='/api/lectures'){const b=await body(req);
    if(typeof b.title!=='string'||!b.title.trim()||typeof b.lat!=='number'||!Number.isFinite(b.lat)||b.lat < -90||b.lat > 90||typeof b.lng!=='number'||!Number.isFinite(b.lng)||b.lng < -180||b.lng > 180)return err(res,'اكتبي اسم المحاضرة وحددي موقع القاعة بإحداثيات صحيحة');
    const L={id:crypto.randomBytes(4).toString('hex'),title:String(b.title).trim().slice(0,80),lecturerName:typeof b.lecturerName==='string'?b.lecturerName.trim().slice(0,80):'',courseName:typeof b.courseName==='string'?b.courseName.trim().slice(0,80):'',date:new Date().toLocaleDateString('ar-EG'),lat:+b.lat,lng:+b.lng,radius:Math.max(20,Math.min(500,+b.radius||100)),closed:false};
    db.lectures.push(L);save();return json(res,{ok:true,id:L.id})}
  if(m==='POST'&&(x=/^\/api\/lectures\/([a-f0-9]{8})\/(delete|restore)$/.exec(p))){
    const L=db.lectures.find(L=>L.id===x[1]);if(!L)return err(res,'المحاضرة غير موجودة',404);
    if(x[2]==='delete'){
      if(L.deletedAt)return err(res,'المحاضرة محذوفة بالفعل',409);
      if(db.att.some(a=>a.l===L.id))return err(res,'المحاضرة فيها حضور مسجل؛ ممنوع حذفها قبل مراجعة السجلات',409);
      L.deletedAt=Date.now();L.closed=true;save();return json(res,{ok:true,archived:true})
    }
    if(!L.deletedAt)return err(res,'المحاضرة مش محذوفة',409);
    delete L.deletedAt;L.closed=true;save();return json(res,{ok:true,restored:true})
  }
  if(x=/^\/api\/lectures\/(\w+)\/(live|close|open)$/.exec(p)){const L=db.lectures.find(l=>l.id===x[1]&&!l.deletedAt);if(!L)return err(res,'مش موجودة',404);
    if(x[2]==='live'){if(m!=='GET')return err(res,'Method Not Allowed',405);
      const a=db.att.filter(a=>a.l===L.id).map(a=>({name:byId[a.s]?.name||'طالبة محذوفة',t:a.t}));
      return json(res,{title:L.title,lecturerName:L.lecturerName||'',courseName:L.courseName||'',open:!L.closed,token:mkToken(L.id),secondsLeft:(SLOT-Date.now()%SLOT)/1000,attendees:a,total:students.length})}
    if(m!=='POST')return err(res,'Method Not Allowed',405);
    L.closed=x[2]==='close';save();return json(res,{ok:true})}
  if(m==='POST'&&p==='/api/devices/reset'){const b=await body(req);delete db.devices[b.studentId];save();return json(res,{ok:true})}
  if(m==='GET'&&p==='/api/report')return json(res,report());
  if(m==='GET'&&p==='/api/report.csv'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=attendance.csv'});return res.end(csv())}
  err(res,'مش موجود',404);
}

const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
http.createServer(async(req,res)=>{
  const p=new URL(req.url,'http://x').pathname;
  try{
    if(p.startsWith('/api/'))return await api(req,res,p);
    const f=p==='/'?'student.html':p==='/doctor'?'doctor.html':p.slice(1);
    const fp=path.join(__dirname,'public',f);
    if(!fp.startsWith(path.join(__dirname,'public'))||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);return res.end('404')}
    res.writeHead(200,{'Content-Type':types[path.extname(fp)]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);
  }catch(e){console.error(e);if(!res.headersSent)err(res,'خطأ في السيرفر',500)}
}).listen(PORT,()=>console.log('Attendify on http://localhost:'+PORT+'  | الدكتور: /doctor'));
