'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const roster=require('../lib/course-roster');
const {createHandler,sha}=require('../lib/http-app');
const course1='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const course2='5bc34655-6777-419b-9392-5705714f20df';
const doctor='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
const boss='318bbc43-5b9e-4df9-9a47-f3eceac579b6';
const outsider='31ca620d-4d43-4adc-90fa-9b52699eebc4';
const studentUUID='13823c35-164a-4c08-bb88-3256f584116a';
function store(){
 const students=new Map(),enrollments=new Map(),attendanceHistory=[{student_id:studentUUID,lecture_id:'old-attendance'}],audit=[];
 let allowedCourse1=true;let authorized=doctor;
 const sql=async(s,p=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(s))return {rows:[]};
  if(s.includes('FROM lecturer_courses lc JOIN courses c')&&s.includes('FOR SHARE OF lc')){
   return {rows:p[0]===authorized&&(p[1]===course1?allowedCourse1:false)?[{ok:1}]:[]};
  }
  if(s.includes('FROM enrollments e JOIN students s')){
   return {rows:Array.from(students.values()).filter(st=>enrollments.get(st.id+'|'+p[0])===true)};
  }
  if(s.startsWith('INSERT INTO students(')){
   const prev=students.get(p[0]);if(prev)return {rows:[]};
   const student={id:p[0]==='0072'?studentUUID:crypto.randomUUID(),roll_number:p[0],full_name:p[1]};
   students.set(p[0],student);return {rows:[student]};
  }
  if(s.startsWith('SELECT id,roll_number,full_name FROM students WHERE')){
   const v=students.get(p[0]);return {rows:v?[v]:[]};
  }
  if(s.startsWith('INSERT INTO enrollments(')){
   enrollments.set(p[0]+'|'+p[1],true);return {rows:[{student_id:p[0]}]};
  }
  if(s.startsWith('UPDATE enrollments SET removed_at')){
   const key=p[0]+'|'+p[1];if(!enrollments.get(key))return {rows:[]};
   enrollments.set(key,false);return {rows:[{student_id:p[0]}]};
  }
  if(s.startsWith('INSERT INTO audit_events(')){audit.push({sql:s,params:p});return {rows:[]}};
  if(s.includes('FROM auth_sessions s JOIN app_users u')){
   const user=p[0]===sha('a'.repeat(64))?{id:doctor,role:'lecturer',must_change_password:false,disabled_at:null}:
    p[0]===sha('b'.repeat(64))?{id:boss,role:'superadmin',must_change_password:false,disabled_at:null}:
    p[0]===sha('c'.repeat(64))?{id:outsider,role:'lecturer',must_change_password:false,disabled_at:null}:null;
   return {rows:user?[user]:[]};
  }
  throw Error('Unexpected SQL: '+s);
 };
 return {pool:{query:sql,connect:async()=>({query:sql,release(){}})},students,enrollments,attendanceHistory,audit,
  revoke:()=>{allowedCourse1=false},assignCourse2:()=>{authorized=doctor},restore:()=>{allowedCourse1=true}};
}
const lecturer={id:doctor,role:'lecturer'};
test('course roster add/list/remove is scoped, reversible and does not erase historical attendance',async()=>{
 const db=store(),body={studentId:'0072',studentName:'  مريم   أحمد حسن  '};
 const created=await roster.addStudent(db.pool,lecturer,course1,body);
 assert.equal(created.roll_number,'0072');assert.equal(created.full_name,'مريم أحمد حسن');
 assert.equal((await roster.listStudents(db.pool,lecturer,course1)).length,1);
 await assert.rejects(roster.listStudents(db.pool,lecturer,course2),e=>e.status===403);
 await assert.rejects(roster.addStudent(db.pool,lecturer,course2,body),e=>e.status===403);
 assert.equal((await roster.removeStudent(db.pool,lecturer,course1,created.id)).ok,true);
 assert.equal((await roster.listStudents(db.pool,lecturer,course1)).length,0);
 assert.equal(db.attendanceHistory.length,1,'old attendance remains untouched');
 assert.equal((await roster.addStudent(db.pool,lecturer,course1,body)).id,created.id);
 assert.equal((await roster.listStudents(db.pool,lecturer,course1)).length,1);
 assert.equal(db.students.size,1);
 assert.equal(db.audit.filter(x=>x.sql.includes('enrollment.add')).length,2);
 assert.equal(db.audit.filter(x=>x.sql.includes('enrollment.remove')).length,1);
});
test('superadmin, unauthenticated and unassigned doctor cannot read/write student roster',async()=>{
 const db=store();
 for(const user of [null,{id:boss,role:'superadmin'},{id:outsider,role:'lecturer'}]){
  for(const action of [
   ()=>roster.listStudents(db.pool,user,course1),
   ()=>roster.addStudent(db.pool,user,course1,{studentId:'22',studentName:'Test User'}),
   ()=>roster.removeStudent(db.pool,user,course1,studentUUID)
  ])await assert.rejects(action(),e=>e.status===401||e.status===403);
 }
 assert.equal(db.students.size,0);
 await assert.rejects(roster.addStudent(db.pool,lecturer,course1,{studentId:'0072',studentName:'a'.repeat(201)}),e=>e.status===400);
 await assert.rejects(roster.removeStudent(db.pool,lecturer,course1,'bad-uuid'),e=>e.status===400);
 await roster.addStudent(db.pool,lecturer,course1,{studentId:'0072',studentName:'مريم أحمد حسن'});
 await assert.rejects(roster.addStudent(db.pool,lecturer,course1,{studentId:'0072',studentName:'سارة علي'}),e=>e.status===409);
 assert.equal(db.students.size,1);
 db.revoke();
 await assert.rejects(roster.listStudents(db.pool,lecturer,course1),e=>e.status===403);
});
test('HTTP enrollment endpoints are role-scoped and independent of public attendance flag',async()=>{
 const db=store();
 const server=http.createServer(createHandler(db.pool,{rosterEnabled:true,attendanceEnabled:false,production:false}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const req=async(endpoint,{method='GET',body,cookie,origin=base}={})=>{
  const headers={};if(cookie)headers.cookie=cookie;if(body!==undefined)headers['content-type']='application/json';
  if(method==='POST')headers.origin=origin;
  const response=await fetch(base+endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  return {status:response.status,data:await response.json()};
 };
 const root='/api/v2/lecturer/courses/'+course1+'/students';
 const doctorCookie='sid2='+'a'.repeat(64),adminCookie='sid2='+'b'.repeat(64),outsiderCookie='sid2='+'c'.repeat(64);
 try{
  assert.equal((await req(root)).status,401);
  assert.equal((await req(root,{cookie:adminCookie})).status,403);
  assert.equal((await req(root,{cookie:outsiderCookie})).status,403);
  assert.equal((await req(root,{method:'POST',cookie:doctorCookie,origin:'https://evil.invalid',body:{studentId:'0072',studentName:'مريم أحمد حسن'}})).status,403);
  const created=await req(root,{method:'POST',cookie:doctorCookie,body:{studentId:'0072',studentName:'مريم أحمد حسن'}});
  assert.equal(created.status,201);
  const got=await req(root,{cookie:doctorCookie});assert.equal(got.status,200);assert.equal(got.data.items.length,1);
  assert.equal((await req('/api/v2/attendance/checkin',{method:'POST',body:{}})).status,404);
  assert.equal((await req(root+'/remove',{method:'POST',cookie:adminCookie,body:{studentId:created.data.id}})).status,403);
  assert.equal((await req(root+'/remove',{method:'POST',cookie:doctorCookie,body:{studentId:created.data.id}})).status,200);
  assert.equal((await req(root,{cookie:doctorCookie})).data.items.length,0);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
test('roster endpoints stay unavailable when roster feature is off',async()=>{
 const db=store(),server=http.createServer(createHandler(db.pool,{rosterEnabled:false,production:false}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const r=await fetch(base+'/api/v2/lecturer/courses/'+course1+'/students',{signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
