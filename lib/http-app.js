'use strict';
// Secure multi-account portal API. Deliberately does NOT expose legacy student/attendance APIs.
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {verifyPassword,hashPassword,validPassword}=require('./passwords');
const {authorize}=require('./permissions');
const admin=require('./admin-management');
const {createAttendanceRouter}=require('./attendance-routes');
const {createRosterRouter}=require('./roster-routes');
const {reportForCourse}=require('./attendance-reports');
const {excelForReport}=require('./report-excel');
const lectureMaintenance=require('./lecture-maintenance');

const SESSION_TTL=12*60*60*1000;
const files=Object.freeze({
  '/': ['index.html','text/html; charset=utf-8'],
  '/portal': ['portal.html','text/html; charset=utf-8'],
  '/admin': ['portal.html','text/html; charset=utf-8'],
  '/lecturer': ['portal.html','text/html; charset=utf-8'],
  '/student': ['student-guide.html','text/html; charset=utf-8'],
  '/app-v2.js': ['app-v2.js','application/javascript; charset=utf-8'],
  '/app-v2.css': ['app-v2.css','text/css; charset=utf-8'],
  '/checkin.js': ['checkin.js','application/javascript; charset=utf-8']
});
function httpError(status,code){const e=new Error(code);e.status=status;return e}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function tokenCookie(token,production,maxAge){
 return 'sid2='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+maxAge+(production?'; Secure':'');
}
function write(res,status,data,headers={}){
 const output=JSON.stringify(data);
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(output),
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(output);
}
function jsonBody(req){
 return new Promise((resolve,reject)=>{
  let buf='',size=0,failed=false;
  req.on('data',chunk=>{
   size+=chunk.length;
   if(size>16384){failed=true;reject(httpError(413,'BODY_TOO_LARGE'));req.destroy();return}
   buf+=chunk;
  });
  req.on('end',()=>{
   if(failed)return;
   try{
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw httpError(415,'JSON_REQUIRED');
    const value=JSON.parse(buf||'{}');
    if(!value||typeof value!=='object'||Array.isArray(value))throw httpError(400,'JSON_OBJECT_REQUIRED');
    resolve(value);
   }catch(e){reject(e.status?e:httpError(400,'INVALID_JSON'))}
  });
  req.on('error',reject);
 });
}
function createHandler(pool,{production=process.env.NODE_ENV==='production',publicOrigin=process.env.PUBLIC_ORIGIN,
 attendanceEnabled=process.env.ATTENDANCE_ENABLED==='1',rosterEnabled=process.env.ROSTER_ENABLED==='1',qrSecret=process.env.ATTENDANCE_QR_SECRET,
 deviceKey=process.env.ATTENDANCE_DEVICE_KEY,now=()=>Date.now()}={}){
 if(!pool||typeof pool.query!=='function')throw Error('PostgreSQL pool required');
 if(production&&(!publicOrigin||!/^https:\/\//.test(publicOrigin)))throw Error('HTTPS PUBLIC_ORIGIN required in production');
 const attendanceRouter=attendanceEnabled?createAttendanceRouter(pool,{secret:qrSecret,deviceKey,now,publicOrigin,principal,jsonBody,write,httpError}):null;
 const rosterRouter=rosterEnabled?createRosterRouter(pool,{principal,jsonBody,write}):null;
 const loginHits=new Map();
 const hit=(key)=>{
  const now=Date.now();
  if(loginHits.size>3000)for(const [k,v] of loginHits)if(now-v.since>900000)loginHits.delete(k);
  let v=loginHits.get(key);
  if(!v||now-v.since>900000){v={since:now,count:0};loginHits.set(key,v)}
  v.count++;return v.count>10;
 };
 async function principal(req){
  const match=/(?:^|;\s*)sid2=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
  if(!match)return null;
  const r=await pool.query(
   "SELECT u.id,u.email,u.display_name,u.role,u.must_change_password,u.disabled_at FROM auth_sessions s JOIN app_users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND u.disabled_at IS NULL",
   [sha(match[1])]
  );
  return r.rows[0]||null;
 }
 function sameOrigin(req){
  const origin=req.headers.origin;
  const expected=publicOrigin||((req.socket.encrypted?'https':'http')+'://'+req.headers.host);
  if(!origin||!expected)return false;
  try{return new URL(origin).origin===new URL(expected).origin}catch{return false}
 }
 async function guard(req,action){
  const user=await principal(req);
  const result=await authorize({principal:user,action,targetUserId:user?.id});
  if(!result.allowed)throw httpError(result.status,result.reason);
  return user;
 }
 return async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  let p;
  try {
   p=new URL(req.url,'http://local').pathname;
   if(req.method==='GET'&&p==='/checkin'){
    if(!attendanceRouter)throw httpError(404,'NOT_FOUND');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return fs.createReadStream(path.join(__dirname,'..','public','checkin.html')).pipe(res);
   }
   if(req.method==='GET'&&p==='/checkin.js'&&!attendanceRouter)throw httpError(404,'NOT_FOUND');
   if(req.method==='GET'&&files[p]){
    const [name,type]=files[p];
    const filename=path.join(__dirname,'..','public',name);
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
    return fs.createReadStream(filename).pipe(res);
   }
   if(req.method==='GET'&&p==='/healthz'){
    try{await pool.query('SELECT 1 AS ok');return write(res,200,{status:'ok'})}
    catch{return write(res,503,{status:'database_unavailable'})}
   }
   if(!p.startsWith('/api/v2/'))throw httpError(404,'NOT_FOUND');
   if(!['GET','POST'].includes(req.method))throw httpError(405,'METHOD_NOT_ALLOWED');
   if(req.method==='POST'&&!sameOrigin(req))throw httpError(403,'ORIGIN_REJECTED');
   const method=req.method, action=p.slice('/api/v2/'.length);
   // Lecture archive/restore and instructor-approved corrections stay available
   // even while public QR attendance is disabled. Every operation is course-scoped.
   if(action==='lecturer/lecture-records'&&method==='GET'){
    const user=await guard(req,'course.assigned.list');
    return write(res,200,{items:await lectureMaintenance.listLectureRecords(pool,user)});
   }
   const maintenance=/^lecturer\\/lecture-records\\/([a-f0-9-]{36})\\/(archive|restore|correct)$/.exec(action);
   if(maintenance&&method==='POST'){
    const user=await guard(req,'course.assigned.list');
    if(maintenance[2]==='correct')
     return write(res,200,await lectureMaintenance.correctAttendance(pool,user,
      {lectureId:maintenance[1],...await jsonBody(req)}));
    return write(res,200,await lectureMaintenance.setLectureArchived(pool,user,
     maintenance[1],maintenance[2]==='archive'));
   }
   // Reports remain available when QR check-in is OFF: only closed lectures
   // count, and academic data is accessible to the assigned lecturer only.
   const reportMatch=/^lecturer\/courses\/([a-f0-9-]{36})\/report(\.xlsx)?$/.exec(action);
   if(reportMatch&&method==='GET'){
    const user=await guard(req,'course.assigned.list');
    const report=await reportForCourse(pool,user,reportMatch[1]);
    if(!reportMatch[2])return write(res,200,report);
    const workbook=excelForReport(report);
    res.writeHead(200,{
     'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'Content-Disposition':'attachment; filename="attendify-'+report.courseId+'.xlsx"',
     'Content-Length':workbook.length,'Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff'
    });
    return res.end(workbook);
   }
   if(/^lecturer\/courses\/[a-f0-9-]{36}\/students(?:\/remove)?$/.test(action)){
    if(!rosterRouter)throw httpError(404,'ROSTER_NOT_ENABLED');
    return await rosterRouter(req,res,action,method);
   }
   if(action.startsWith('attendance/')||action==='lecturer/lectures'||action.startsWith('lecturer/lectures/')){
    if(!attendanceRouter)throw httpError(404,'ATTENDANCE_NOT_ENABLED');
    return await attendanceRouter(req,res,action,method);
   }
   if(method==='POST'&&action==='login'){
    const input=await jsonBody(req);
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    const password=input.password;
    if(!email||email.length>254||typeof password!=='string'||Buffer.byteLength(password)>256)
     throw httpError(400,'INVALID_LOGIN_INPUT');
    const limiter=sha((req.socket.remoteAddress||'unknown')+':'+email);
    if(hit(limiter))throw httpError(429,'TOO_MANY_ATTEMPTS');
    const found=await pool.query(
     "SELECT id,email,display_name,role,password_hash,must_change_password,disabled_at FROM app_users WHERE lower(email)=$1 LIMIT 1",
     [email]
    );
    const account=found.rows[0];
    if(!account||account.disabled_at||!await verifyPassword(password,account.password_hash))
     throw httpError(401,'INVALID_CREDENTIALS');
    loginHits.delete(limiter);
    const raw=crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [sha(raw),account.id,new Date(Date.now()+SESSION_TTL)]);
    return write(res,200,{ok:true,role:account.role,mustChangePassword:account.must_change_password},
      {'Set-Cookie':tokenCookie(raw,production,SESSION_TTL/1000)});
   }
   if(method==='GET'&&action==='me'){
    const user=await principal(req);
    if(!user)throw httpError(401,'AUTH_REQUIRED');
    return write(res,200,{id:user.id,email:user.email,name:user.display_name,
      role:user.role,mustChangePassword:user.must_change_password});
   }
   if(method==='POST'&&action==='logout'){
    const user=await principal(req);
    const token=/(?:^|;\s*)sid2=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
    if(user&&token)await pool.query('UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 AND user_id=$2',
      [sha(token[1]),user.id]);
    return write(res,200,{ok:true},{'Set-Cookie':tokenCookie('',production,0)});
   }
   if(method==='POST'&&action==='password'){
    const user=await guard(req,'profile.password.change.self');
    const b=await jsonBody(req);
    if(typeof b.currentPassword!=='string'||!validPassword(b.newPassword)||b.currentPassword===b.newPassword)
     throw httpError(400,'PASSWORD_REQUIREMENTS');
    const current=await pool.query('SELECT password_hash FROM app_users WHERE id=$1',[user.id]);
    if(!current.rows[0]||!await verifyPassword(b.currentPassword,current.rows[0].password_hash))
     throw httpError(401,'CURRENT_PASSWORD_INVALID');
    const hashed=await hashPassword(b.newPassword);
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await client.query('UPDATE app_users SET password_hash=$1,must_change_password=false,updated_at=now() WHERE id=$2',[hashed,user.id]);
     await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id]);
     await client.query("INSERT INTO audit_events(actor_id,action,target_type,target_id) VALUES($1,'account.password.change','app_user',$2)",[user.id,user.id]);
     await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    return write(res,200,{ok:true,reauthenticate:true},{'Set-Cookie':tokenCookie('',production,0)});
   }
   const actions={
    'lecturers': {GET:'lecturer.list',POST:'lecturer.create'},
    'lecturers/password/reset': {POST:'lecturer.password.reset'},
    'courses': {GET:'course.catalog.list',POST:'course.create'},
    'courses/rename': {POST:'course.rename'},
    'assignments': {GET:'assignment.list',POST:'assignment.grant'},
    'assignments/revoke': {POST:'assignment.revoke'},
    'lecturer/courses': {GET:'course.assigned.list'}
   };
   const act=actions[action]&&actions[action][method];
   if(!act)throw httpError(404,'NOT_FOUND');
   const user=await guard(req,act);
   if(action==='lecturers'&&method==='GET')return write(res,200,{items:await admin.listLecturers(pool,user)});
   if(action==='lecturers'&&method==='POST')return write(res,201,await admin.createLecturer(pool,user,await jsonBody(req)));
   if(action==='lecturers/password/reset'&&method==='POST')
    return write(res,200,await admin.resetLecturerPassword(pool,user,await jsonBody(req)));
   if(action==='courses'&&method==='GET')return write(res,200,{items:await admin.listCourseCatalog(pool,user)});
   if(action==='courses'&&method==='POST')return write(res,201,await admin.createCourse(pool,user,await jsonBody(req)));
   if(action==='courses/rename'&&method==='POST')return write(res,200,await admin.renameCourse(pool,user,await jsonBody(req)));
   if(action==='assignments'&&method==='GET')return write(res,200,{items:await admin.listAssignments(pool,user)});
   if(action==='assignments'&&method==='POST')return write(res,200,await admin.assignCourse(pool,user,await jsonBody(req)));
   if(action==='assignments/revoke'&&method==='POST')return write(res,200,await admin.unassignCourse(pool,user,await jsonBody(req)));
   if(action==='lecturer/courses'&&method==='GET'){
    const r=await pool.query(
      'SELECT c.id,c.name,c.code FROM lecturer_courses lc JOIN courses c ON c.id=lc.course_id WHERE lc.lecturer_id=$1 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL ORDER BY c.name',
      [user.id]
    );
    return write(res,200,{items:r.rows});
   }
   throw httpError(404,'NOT_FOUND');
  }catch(e){
   const status=Number.isInteger(e.status)&&e.status>=400&&e.status<600?e.status:500;
   if(status===500)console.error('Portal request failed',e.code||e.name||'unknown');
   write(res,status,{ok:false,error:status===500?'SERVER_ERROR':e.message});
  }
 };
}
module.exports={createHandler,sha};
