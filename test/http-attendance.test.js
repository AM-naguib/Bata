'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {createHandler,sha}=require('../lib/http-app');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1',lecture='a65c14c2-d9ec-4e2b-b289-2d329048fb32';
const bossId='318bbc43-5b9e-4df9-9a47-f3eceac579b6',docId='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
const student1='13823c35-164a-4c08-bb88-3256f584116a',student2='31ca620d-4d43-4adc-90fa-9b52699eebc4';
function makeDb(){
 const cookies={
  [sha('a'.repeat(64))]:{id:bossId,role:'superadmin',must_change_password:false},
  [sha('b'.repeat(64))]:{id:docId,role:'lecturer',must_change_password:false}
 };
 const attendance=[],lectures=[],audit=[];
 let assigned=true;
 const query=async(sql,p=[])=>{
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.includes('FROM auth_sessions s JOIN app_users'))return {rows:cookies[p[0]]?[cookies[p[0]]]:[]};
  if(sql.startsWith('SELECT 1 FROM lecturer_courses'))return {rows:assigned&&p[0]===docId&&p[1]===course?[{ok:1}]:[]};
  if(sql.startsWith('SELECT l.id,l.course_id,l.title,l.opened_at'))return {rows:lectures.map(l=>({...l,course_name:'Chemistry',opened_at:new Date()}))};
  if(sql.startsWith('INSERT INTO lectures(')){
   const row={id:lecture,course_id:p[0],created_by:p[1],title:p[2],
    location_lat:p[3],location_lng:p[4],radius_m:p[5],closed_at:null,archived_at:null};
   if(assigned)lectures.push(row);
   return {rows:assigned?[row]:[]};
  }
  if(sql.startsWith('SELECT l.id,l.course_id,l.title,l.closed_at')){
   return {rows:assigned?lectures.filter(l=>l.id===p[0]).map(l=>({...l,course_name:'Chemistry'})):[]};
  }
  if(sql.startsWith('SELECT count(*)::int AS total'))return {rows:[{total:attendance.length}]};
  if(sql.startsWith('UPDATE lectures l SET closed_at')){
   const l=lectures.find(l=>l.id===p[0]&&!l.closed_at);
   if(l)l.closed_at=new Date();
   return {rows:l?[{id:l.id}]:[]};
  }
  if(sql.startsWith('SELECT l.id,l.course_id,l.closed_at,l.archived_at')){
   return {rows:lectures.filter(l=>l.id===p[0]).map(l=>({
    ...l,course_archived:null
   }))};
  }
  if(sql.startsWith('SELECT s.id,s.roll_number,s.full_name FROM students')){
   const students=[
    {id:student1,roll_number:'0072',full_name:'مريم أحمد حسن'},
    {id:student2,roll_number:'0073',full_name:'سارة علي'}
   ];
   return {rows:students.filter(s=>s.roll_number===p[0]&&p[1]===course)};
  }
  if(sql.startsWith('SELECT student_id,device_fingerprint_hash FROM attendances')){
   return {rows:attendance.filter(a=>a.student_id===p[1]||a.device_fingerprint_hash===p[2])};
  }
  if(sql.startsWith('INSERT INTO attendances(')){
   attendance.push({student_id:p[1],device_fingerprint_hash:p[2]});return {rows:[]};
  }
  if(sql.startsWith('INSERT INTO audit_events(')){audit.push(p);return {rows:[]}};
  throw Error('Unexpected SQL: '+sql);
 };
 return {pool:{query,connect:async()=>({query,release(){}})},attendance,lectures,setAssigned:value=>assigned=value};
}
test('HTTP QR workflow: doctor-only lecture, QR link, student full name+seat/GPS check-in, close and access denial',async()=>{
 let now=1700000000000;
 const db=makeDb(),handler=createHandler(db.pool,{
  attendanceEnabled:true,qrSecret:'strong-attendance-qr-signing-secret-test-2026',
  deviceKey:'strong-attendance-device-key-for-tests-2026',
  now:()=>now,production:false
 });
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(p,{method='GET',body,cookie,origin=base}={})=>{
  const h={};if(cookie)h.cookie=cookie;if(body!==undefined)h['content-type']='application/json';
  if(method==='POST'&&origin!==null)h.origin=origin;
  const r=await fetch(base+p,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  const contentType=r.headers.get('content-type')||'';
  const data=contentType.includes('application/json')?await r.json():await r.text();
  return {status:r.status,data,headers:r.headers};
 };
 const boss='sid2='+'a'.repeat(64),doc='sid2='+'b'.repeat(64);
 const form={courseId:course,title:'محاضرة تجريبية',lat:30,lng:31,accuracy:10,radius:100};
 const details=(token)=>({token,studentId:'0072',studentName:'مريم أحمد حسن',
  deviceId:'12345678-1234-1234-1234-123456789012',lat:30,lng:31,accuracy:10});
 try{
  assert.equal((await request('/checkin')).status,200);
  assert.equal((await request('/checkin.js')).status,200);
  assert.equal((await request('/api/v2/lecturer/lectures',{cookie:boss})).status,403);
  assert.equal((await request('/api/v2/lecturer/lectures',{cookie:doc})).status,200);
  assert.equal((await request('/api/v2/lecturer/lectures',{method:'POST',cookie:boss,body:form})).status,403);
  assert.equal((await request('/api/v2/lecturer/lectures',{method:'POST',cookie:doc,origin:'https://evil.test',body:form})).status,403);
  const created=await request('/api/v2/lecturer/lectures',{method:'POST',cookie:doc,body:form});
  assert.equal(created.status,201);assert.equal(created.data.id,lecture);
  const live=await request('/api/v2/lecturer/lectures/'+lecture+'/live',{cookie:doc});
  assert.equal(live.status,200);assert.equal(live.data.closed,false);
  assert.match(live.data.qr,/^data:image\/png;base64,/);
  const token=live.data.token;
  assert.equal((await request('/api/v2/lecturer/lectures/'+lecture+'/live',{cookie:boss})).status,403);
  const wrong=await request('/api/v2/attendance/checkin',{method:'POST',body:{...details(token),studentName:'wrong'}});
  assert.equal(wrong.status,400);assert.equal(db.attendance.length,0);
  const success=await request('/api/v2/attendance/checkin',{method:'POST',body:details(token)});
  assert.equal(success.status,200);assert.equal(success.data.studentName,'مريم أحمد حسن');
  assert.equal(db.attendance.length,1);
  const again=await request('/api/v2/attendance/checkin',{method:'POST',body:details(token)});
  assert.equal(again.status,200);assert.equal(again.data.alreadyRegistered,true);
  assert.equal(db.attendance.length,1);
  const shared=await request('/api/v2/attendance/checkin',{method:'POST',body:{...details(token),studentId:'0073',studentName:'سارة علي'}});
  assert.equal(shared.status,409);
  const count=await request('/api/v2/lecturer/lectures/'+lecture+'/live',{cookie:doc});
  assert.equal(count.data.attendees,1);
  const close=await request('/api/v2/lecturer/lectures/'+lecture+'/close',{method:'POST',cookie:doc,body:{}});
  assert.equal(close.status,200);
  assert.equal((await request('/api/v2/attendance/checkin',{method:'POST',body:details(token)})).status,409);
  const closed=await request('/api/v2/lecturer/lectures/'+lecture+'/live',{cookie:doc});
  assert.equal(closed.data.token,null);assert.equal(closed.data.closed,true);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('student attendance remains disabled until explicitly configured',async()=>{
 const db=makeDb(),server=http.createServer(createHandler(db.pool,{production:false}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/checkin')).status,404);
  assert.equal((await fetch(base+'/api/v2/attendance/checkin',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'})).status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
