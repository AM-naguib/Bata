'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {createHandler}=require('../lib/http-app');
const {hashPassword}=require('../lib/passwords');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1',outside='5bc34655-6777-419b-9392-5705714f20df';
const adminId='3acfa588-9d3e-4db8-9344-80c3addcd303',doctorId='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
test('actual HTTP academic report and Excel routes deny admin/anonymous/unassigned and keep check-in disabled',async()=>{
 const secret=await hashPassword('testing-a-long-password-2026');
 const users=[
  {id:adminId,email:'admin@example.test',display_name:'Admin',role:'superadmin',must_change_password:false,password_hash:secret},
  {id:doctorId,email:'doctor@example.test',display_name:'Doctor',role:'lecturer',must_change_password:false,password_hash:secret}
 ];
 const sessions=new Map(),queries=[];
 const pool={query:async(sql,p=[])=>{
  queries.push({sql,p});
  if(sql.includes('lower(email)=$1 LIMIT 1'))return {rows:users.filter(u=>u.email===p[0])};
  if(sql.startsWith('INSERT INTO auth_sessions')){sessions.set(p[0],p[1]);return {rows:[]}};
  if(sql.includes('FROM auth_sessions s JOIN app_users')){const u=users.find(u=>u.id===sessions.get(p[0]));return {rows:u?[u]:[]}};
  if(sql.startsWith('SELECT 1 FROM lecturer_courses'))return {rows:p[0]===doctorId&&p[1]===course?[{n:1}]:[]};
  if(sql.startsWith('SELECT id,name FROM courses'))return {rows:[{id:course,name:'مقرر تجريبي'}]};
  if(sql.startsWith('SELECT s.id,s.roll_number,s.full_name,e.enrolled_at'))return {rows:[
   {id:'13823c35-164a-4c08-bb88-3256f584116a',roll_number:'0001',full_name:'طالبة اختبار',enrolled_at:'2026-01-01T00:00:00Z'}
  ]};
  if(sql.startsWith('SELECT id,title,opened_at,closed_at FROM lectures'))return {rows:[]};
  if(sql.startsWith('SELECT a.student_id,a.lecture_id FROM attendances'))return {rows:[]};
  if(sql.startsWith('SELECT ac.student_id,ac.lecture_id,ac.status FROM attendance_corrections'))return {rows:[]};
  throw Error('Unexpected SQL '+sql);
 }};
 const server=http.createServer(createHandler(pool,{production:false,attendanceEnabled:false,rosterEnabled:false}));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(url,{method='GET',cookie,json}={}){
  const headers={};
  if(cookie)headers.cookie=cookie;
  if(json){headers.origin=base;headers['content-type']='application/json'}
  const r=await fetch(base+url,{method,headers,body:json?JSON.stringify(json):undefined});
  return r;
 }
 const login=async email=>{
  const r=await request('/api/v2/login',{method:'POST',json:{email,password:'testing-a-long-password-2026'}});
  assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
 };
 try{
  const admin=await login('admin@example.test'),lecturer=await login('doctor@example.test');
  const path='/api/v2/lecturer/courses/'+course+'/report';
  assert.equal((await request(path)).status,401);
  const before=queries.length;
  assert.equal((await request(path,{cookie:admin})).status,403);
  assert.equal(queries.slice(before).filter(q=>q.sql.includes('FROM attendances')).length,0);
  assert.equal((await request('/api/v2/lecturer/courses/'+outside+'/report',{cookie:lecturer})).status,403);
  const r=await request(path,{cookie:lecturer});assert.equal(r.status,200);
  const report=await r.json();assert.equal(report.totalStudents,1);
  assert.equal(report.totalLectures,0);assert.equal(report.students[0].percentage,null);
  const excel=await request(path+'.xlsx',{cookie:lecturer});
  assert.equal(excel.status,200);
  assert.match(excel.headers.get('content-type'),/spreadsheetml/);
  assert.match(excel.headers.get('content-disposition'),/attachment/);
  assert.match(excel.headers.get('cache-control'),/no-store/);
  assert.equal(Buffer.from(await excel.arrayBuffer()).subarray(0,2).toString(),'PK');
  assert.equal((await request(path+'.xlsx',{cookie:admin})).status,403);
  assert.equal((await request('/api/v2/attendance/checkin',{cookie:lecturer})).status,404);
 }finally{await new Promise(done=>server.close(done))}
});
