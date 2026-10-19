'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createHandler}=require('../lib/http-app');
const {hashPassword}=require('../lib/passwords');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1',lecture='a65c14c2-d9ec-4e2b-b289-2d329048fb32';
const student='13823c35-164a-4c08-bb88-3256f584116a',doctorId='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
test('HTTP lecturer maintenance API enforces role, CSRF, exact URL lecture scope and keeps QR disabled',async()=>{
 const hashed=await hashPassword('strong-security-example-password');
 const admin={id:'318bbc43-5b9e-4df9-9a47-f3eceac579b6',email:'boss@example.test',display_name:'Admin',role:'superadmin',password_hash:hashed,must_change_password:false};
 const doctor={id:doctorId,email:'dr@example.test',display_name:'Doctor',role:'lecturer',password_hash:hashed,must_change_password:false};
 const users=[admin,doctor],session=new Map(),audit=[],q=[];
 let archived=false;
 const query=async(sql,p=[])=>{
  q.push({sql,p});
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.includes('lower(email)=$1 LIMIT 1'))return {rows:users.filter(u=>u.email===p[0])};
  if(sql.startsWith('INSERT INTO auth_sessions')){session.set(p[0],p[1]);return {rows:[]}}
  if(sql.includes('FROM auth_sessions s JOIN app_users')){
   const u=users.find(x=>x.id===session.get(p[0]));return {rows:u?[u]:[]};
  }
  if(sql.startsWith('SELECT l.id,l.course_id,l.title,l.opened_at'))return {rows:[{
   id:lecture,course_id:course,title:'محاضرة اختبار',closed_at:'2026-10-18T19:00:00Z',
   archived_at:archived?'2026-10-19T09:00:00Z':null,course_name:'مقرر اختبار'
  }]};
  if(sql.startsWith('SELECT l.id,l.course_id,l.closed_at,l.archived_at'))return {rows:[
   {id:lecture,course_id:course,closed_at:'2026-10-18T19:00:00Z',archived_at:archived?'2026-10-19T09:00:00Z':null}
  ]};
  if(sql.startsWith('SELECT 1 FROM lecturer_courses'))return {rows:p[0]===doctorId&&p[1]===course?[{yes:1}]:[]};
  if(sql.startsWith('UPDATE lectures SET archived_at=now()')){archived=true;return {rows:[]}};
  if(sql.startsWith('UPDATE lectures SET archived_at=NULL')){archived=false;return {rows:[]}};
  if(sql.startsWith('SELECT 1 FROM enrollments'))return {rows:[{ok:1}]};
  if(sql.startsWith('SELECT status FROM attendance_corrections'))return {rows:[]};
  if(sql.startsWith('INSERT INTO attendance_corrections'))return {rows:[]};
  if(sql.startsWith('INSERT INTO audit_events')){audit.push({sql,p});return {rows:[]}};
  throw Error('Unknown SQL '+sql);
 };
 const pool={query,connect:async()=>({query,release:()=>{}})};
 const server=http.createServer(createHandler(pool,{production:false,attendanceEnabled:false,rosterEnabled:false}));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,{method='GET',cookie,json,origin=base}={}){
  const headers={};if(cookie)headers.cookie=cookie;
  if(method==='POST'){headers.origin=origin;headers['content-type']='application/json'}
  const result=await fetch(base+path,{method,headers,body:json?JSON.stringify(json):undefined});
  return {status:result.status,body:await result.json(),cookie:result.headers.get('set-cookie')};
 }
 const login=async email=>{
  const r=await request('/api/v2/login',{method:'POST',json:{email,password:'strong-security-example-password'}});
  assert.equal(r.status,200);
  return r.cookie.split(';')[0];
 };
 try{
  const bossCookie=await login(admin.email),doctorCookie=await login(doctor.email);
  const listing='/api/v2/lecturer/lecture-records';
  assert.equal((await request(listing)).status,401);
  assert.equal((await request(listing,{cookie:bossCookie})).status,403);
  const list=await request(listing,{cookie:doctorCookie});
  assert.equal(list.status,200);assert.equal(list.body.items.length,1);
  const url=listing+'/'+lecture;
  assert.equal((await request(url+'/archive',{method:'POST',json:{}})).status,401);
  assert.equal((await request(url+'/archive',{method:'POST',cookie:bossCookie,json:{}})).status,403);
  assert.equal((await request(url+'/archive',{method:'POST',cookie:doctorCookie,json:{},origin:'https://bad.example'})).status,403);
  const archivedResponse=await request(url+'/archive',{method:'POST',cookie:doctorCookie,json:{}});
  assert.equal(archivedResponse.status,200);
  assert.equal(archivedResponse.body.archived,true);
  assert.equal((await request(url+'/correct',{method:'POST',cookie:doctorCookie,json:{
   studentId:student,status:'present',reason:'مراجعة مسؤول المقرر'}})).status,409,
   'no corrections permitted while archived');
  const restored=await request(url+'/restore',{method:'POST',cookie:doctorCookie,json:{}});
  assert.equal(restored.status,200);assert.equal(restored.body.archived,false);
  const corrected=await request(url+'/correct',{method:'POST',cookie:doctorCookie,json:{
   lectureId:'5bc34655-6777-419b-9392-5705714f20df',studentId:student,
   status:'present',reason:'تصحيح معتمد من الدكتور'
  }});
  assert.equal(corrected.status,200);
  assert.equal(corrected.body.lectureId,lecture,'body must not override URL-scoped lecture');
  assert.equal(audit.length,3);
  assert.deepEqual(audit.map(a=>a.sql.includes("'attendance.record.correct'")?'correct':a.p[1]),[
   'lecture.archive','lecture.restore','correct'
  ]);
  assert.equal((await request('/api/v2/attendance/checkin')).status,404);
  assert.ok(q.every(x=>!x.sql.includes('DELETE FROM attendances')));
 }finally{await new Promise(done=>server.close(done))}
});
