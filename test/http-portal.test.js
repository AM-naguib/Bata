'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const {createHandler}=require('../lib/http-app');
const {hashPassword}=require('../lib/passwords');
const bossId='13823c35-164a-4c08-bb88-3256f584116a';
function fakeDatabase(bossHash){
 const users=[{id:bossId,email:'superadmin@example.test',display_name:'Main Admin',role:'superadmin',password_hash:bossHash,must_change_password:false,disabled_at:null}];
 const courses=[],assignments=[],sessions=new Map(),audit=[];
 const query=async(sql,p=[])=>{
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql==='SELECT 1 AS ok')return {rows:[{ok:1}]};
  if(sql.includes('SELECT id,email,display_name,role,password_hash,must_change_password')&&sql.includes('lower(email)')){
    return {rows:users.filter(u=>u.email.toLowerCase()===p[0])};
  }
  if(sql.includes('FROM auth_sessions s JOIN app_users')){
   const session=sessions.get(p[0]);const user=users.find(u=>u.id===session?.userId);
   return {rows:session&&!session.revoked&&session.expires>Date.now()&&user&&!user.disabled_at?[user]:[]};
  }
  if(sql.startsWith('INSERT INTO auth_sessions')){sessions.set(p[0],{userId:p[1],expires:new Date(p[2]).getTime(),revoked:false});return {rows:[]};}
  if(sql.startsWith('UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=')){
   if(sessions.has(p[0]))sessions.get(p[0]).revoked=true;return {rows:[]};
  }
  if(sql.startsWith('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=')){
   for(const s of sessions.values())if(s.userId===p[0])s.revoked=true;return {rows:[]};
  }
  if(sql.startsWith('SELECT password_hash FROM app_users')){
   return {rows:users.filter(u=>u.id===p[0]).map(u=>({password_hash:u.password_hash}))};
  }
  if(sql.startsWith('UPDATE app_users SET password_hash=')){
   const user=users.find(u=>u.id===p[1]);if(!user)throw Error('Missing user');
   user.password_hash=p[0];user.must_change_password=sql.includes('must_change_password=true');
   return {rows:[]};
  }
  if(sql.startsWith('SELECT id,email,display_name,disabled_at,created_at FROM app_users')){
   return {rows:users.filter(u=>u.role==='lecturer').map(u=>({id:u.id,email:u.email,display_name:u.display_name,disabled_at:u.disabled_at,created_at:new Date()}))};
  }
  if(sql.startsWith('SELECT id,name,code FROM courses')){
   return {rows:courses.map(c=>({id:c.id,name:c.name,code:null}))};
  }
  if(sql.startsWith('SELECT lecturer_id,course_id,assigned_at FROM lecturer_courses')){
   return {rows:assignments.filter(a=>!a.removed).map(a=>({lecturer_id:a.lecturerId,course_id:a.courseId,assigned_at:new Date()}))};
  }
  if(sql.startsWith('INSERT INTO app_users(')){
   const user={id:crypto.randomUUID(),email:p[0],display_name:p[1],role:'lecturer',password_hash:p[2],must_change_password:true,disabled_at:null};
   users.push(user);return {rows:[{id:user.id,email:user.email,display_name:user.display_name}]};
  }
  if(sql.startsWith('INSERT INTO courses(')){
   const course={id:crypto.randomUUID(),name:p[0],created_by:p[1]};
   courses.push(course);return {rows:[{...course,code:null,created_at:new Date()}]};
  }
  if(sql.startsWith('UPDATE courses SET name=')){
   const course=courses.find(c=>c.id===p[1]);if(!course)return {rows:[]};
   course.name=p[0];return {rows:[{...course,code:null,created_at:new Date()}]};
  }
  if(sql.startsWith('SELECT id,display_name,email FROM app_users WHERE id=')){
   return {rows:users.filter(u=>u.id===p[0]&&u.role==='lecturer'&&!u.disabled_at)
     .map(u=>({id:u.id,display_name:u.display_name,email:u.email}))};
  }
  if(sql.startsWith('SELECT id FROM app_users WHERE id=')){
   return {rows:users.filter(u=>u.id===p[0]&&u.role==='lecturer'&&!u.disabled_at).map(u=>({id:u.id}))};
  }
  if(sql.startsWith('SELECT id FROM courses WHERE id=')){
   return {rows:courses.filter(c=>c.id===p[0]).map(c=>({id:c.id}))};
  }
  if(sql.startsWith('INSERT INTO lecturer_courses(')){
   const row=assignments.find(a=>a.lecturerId===p[0]&&a.courseId===p[1]);
   if(row)row.removed=false;else assignments.push({lecturerId:p[0],courseId:p[1],removed:false});return {rows:[]};
  }
  if(sql.startsWith('UPDATE lecturer_courses SET unassigned_at=')){
   const row=assignments.find(a=>a.lecturerId===p[0]&&a.courseId===p[1]&&!a.removed);
   if(row)row.removed=true;return {rows:row?[{lecturer_id:p[0]}]:[]};
  }
  if(sql.startsWith('SELECT c.id,c.name,c.code FROM lecturer_courses')){
   return {rows:assignments.filter(a=>a.lecturerId===p[0]&&!a.removed).map(a=>courses.find(c=>c.id===a.courseId))};
  }
  if(sql.startsWith('INSERT INTO audit_events(')){
   if(sql.includes("'lecturer.password.reset'")){
    assert.ok(sql.includes("VALUES($1,'lecturer.password.reset','app_user',$2)"),
      'separate UUID and text audit parameters required');
    assert.equal(p.length,2);
    assert.notEqual(p[0],p[1]);
   }
   if(sql.includes("'account.password.change'")){
    // PostgreSQL error 42P08: one $1 parameter cannot simultaneously resolve
    // actor_id UUID and target_id TEXT. Enforce the actual two-parameter contract.
    assert.ok(sql.includes("VALUES($1,'account.password.change','app_user',$2)"),
      'password change audit must bind UUID actor and TEXT target separately');
    assert.equal(p.length,2);
    assert.equal(p[0],p[1]);
   }
   audit.push({sql,parameters:p});return {rows:[]};
  }
  throw Error('Unexpected SQL: '+sql);
 };
 return {users,courses,assignments,audit,pool:{query,connect:async()=>({query,release:()=>{}})}};
}
test('real HTTP role-authenticated portal: administrator creates lecturer/course then lecturer accesses only own assignment',async()=>{
 const data=fakeDatabase(await hashPassword('admin-secret-password-example'));
 const server=http.createServer(createHandler(data.pool,{production:false}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(endpoint,{method='GET',json,cookie,origin=base}={})=>{
  const headers={};
  if(json!==undefined)headers['Content-Type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(method==='POST'&&origin!==null)headers.origin=origin;
  const r=await fetch(base+endpoint,{method,headers,body:json===undefined?undefined:JSON.stringify(json),redirect:'manual'});
  const body=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text();
  return {status:r.status,body,cookie:r.headers.get('set-cookie'),location:r.headers.get('location')};
 };
 try{
  const health=await request('/healthz');assert.equal(health.status,200);assert.equal(health.body.status,'ok');
  const home=await request('/portal');
  assert.equal(home.status,200);assert.match(home.body,/إنشاء مقرر/);
  assert.match(home.body,/id="loginForm"/);
  assert.match(home.body,/data-page="roster"/);
  assert.match(home.body,/data-nav="assignments"/);
  const landing=await request('/');
  assert.equal(landing.status,200);assert.match(landing.body,/href="\/admin"/);
  assert.match(landing.body,/href="\/lecturer"/);
  assert.match(landing.body,/href="\/student"/);
  const adminPage=await request('/admin');
  assert.equal(adminPage.status,200);assert.match(adminPage.body,/id="adminControls"/);
  const lecturerPage=await request('/lecturer');
  assert.equal(lecturerPage.status,200);assert.match(lecturerPage.body,/id="lecturerControls"/);
  const studentGuide=await request('/student');
  assert.equal(studentGuide.status,200);assert.match(studentGuide.body,/تسجيل حضورك/);
  assert.doesNotMatch(studentGuide.body,/type="password"/,'student guide must not request login');
  assert.equal((await request('/checkin')).status,404,'actual check-in remains disabled');
  const css=await request('/app-v2.css');
  assert.equal(css.status,200);assert.match(css.body,/.workspace/);
  assert.equal((await request('/api/report')).status,404,'old academic API must NOT be exposed');
  assert.equal((await request('/api/v2/courses')).status,401);
  const cross=await request('/api/v2/login',{method:'POST',origin:'https://attack.test',json:{email:'superadmin@example.test',password:'admin-secret-password-example'}});
  assert.equal(cross.status,403);
  const noOrigin=await request('/api/v2/login',{method:'POST',origin:null,json:{email:'superadmin@example.test',password:'admin-secret-password-example'}});
  assert.equal(noOrigin.status,403);
  const invalid=await request('/api/v2/login',{method:'POST',json:{email:'superadmin@example.test',password:'wrong-pass'}});
  assert.equal(invalid.status,401);
  const login=await request('/api/v2/login',{method:'POST',json:{email:'superadmin@example.test',password:'admin-secret-password-example'}});
  assert.equal(login.status,200);assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/SameSite=Strict/);
  const bossCookie=login.cookie.split(';')[0];
  const me=await request('/api/v2/me',{cookie:bossCookie});assert.equal(me.body.role,'superadmin');
  const newCourse=await request('/api/v2/courses',{method:'POST',cookie:bossCookie,json:{name:' Organic Chemistry '}});
  assert.equal(newCourse.status,201);assert.equal(newCourse.body.name,'Organic Chemistry');
  const noRename=await request('/api/v2/courses/rename',{method:'POST',cookie:bossCookie,origin:'https://other.example',json:{courseId:newCourse.body.id,name:'Hacked'}});
  assert.equal(noRename.status,403);
  const nameChanged=await request('/api/v2/courses/rename',{method:'POST',cookie:bossCookie,json:{courseId:newCourse.body.id,name:' المقرر الأول (مؤقت) '}});
  assert.equal(nameChanged.status,200);
  assert.equal(nameChanged.body.id,newCourse.body.id);
  assert.equal(nameChanged.body.name,'المقرر الأول (مؤقت)');
  assert.equal((await request('/api/v2/courses',{cookie:bossCookie})).body.items[0].name,'المقرر الأول (مؤقت)');
  const newLecturer=await request('/api/v2/lecturers',{method:'POST',cookie:bossCookie,json:{email:'doctor@example.test',displayName:'Test Lecturer'}});
  assert.equal(newLecturer.status,201);assert.ok(newLecturer.body.initialPassword);
  assert.ok(!JSON.stringify(data.users).includes(newLecturer.body.initialPassword));
  const docId=newLecturer.body.id;
  assert.equal((await request('/api/v2/assignments',{method:'POST',cookie:bossCookie,json:{lecturerId:docId,courseId:newCourse.body.id}})).status,200);
  assert.equal((await request('/api/v2/lecturer/courses',{cookie:bossCookie})).status,403);
  const docLogin=await request('/api/v2/login',{method:'POST',json:{email:'doctor@example.test',password:newLecturer.body.initialPassword}});
  assert.equal(docLogin.status,200);assert.equal(docLogin.body.mustChangePassword,true);
  const docCookie=docLogin.cookie.split(';')[0];
  assert.equal((await request('/api/v2/lecturers',{cookie:docCookie})).status,403);
  assert.equal((await request('/api/v2/courses',{method:'POST',cookie:docCookie,json:{name:'Hacked'}})).status,403);
  assert.equal((await request('/api/v2/courses/rename',{method:'POST',cookie:docCookie,json:{courseId:newCourse.body.id,name:'Hacked'}})).status,403);
  assert.equal((await request('/api/v2/lecturer/courses',{cookie:docCookie})).status,403,'must first change temp password');
  const changed=await request('/api/v2/password',{method:'POST',cookie:docCookie,json:{currentPassword:newLecturer.body.initialPassword,newPassword:'another-strong-secret-password'}});
  assert.equal(changed.status,200);
  assert.ok(data.audit.some(a=>a.sql.includes('account.password.change')),'password change audit must succeed');
  assert.equal((await request('/api/v2/me',{cookie:docCookie})).status,401,'old session invalid after password change');
  const docReLogin=await request('/api/v2/login',{method:'POST',json:{email:'doctor@example.test',password:'another-strong-secret-password'}});
  assert.equal(docReLogin.status,200);
  const doctor=docReLogin.cookie.split(';')[0];
  const mine=await request('/api/v2/lecturer/courses',{cookie:doctor});
  assert.equal(mine.status,200);assert.equal(mine.body.items.length,1);
  assert.equal(mine.body.items[0].id,newCourse.body.id);
  assert.equal(mine.body.items[0].name,'المقرر الأول (مؤقت)');
  // Reset is a superadmin action, not a lecturer self-service or a public endpoint.
  const resetPath='/api/v2/lecturers/password/reset';
  const resetJson={lecturerId:docId};
  assert.equal((await request(resetPath,{method:'POST',json:resetJson})).status,401);
  assert.equal((await request(resetPath,{method:'POST',cookie:doctor,json:resetJson})).status,403);
  assert.equal((await request(resetPath,{method:'GET',cookie:bossCookie})).status,404);
  assert.equal((await request(resetPath,{method:'POST',cookie:bossCookie,origin:'https://evil.example',json:resetJson})).status,403);
  assert.equal((await request(resetPath,{method:'POST',cookie:bossCookie,json:{lecturerId:'not-a-uuid'}})).status,400);
  assert.equal((await request(resetPath,{method:'POST',cookie:bossCookie,json:{lecturerId:bossId}})).status,404,
   'superadmin account must never be a reset target');
  const reset=await request(resetPath,{method:'POST',cookie:bossCookie,json:resetJson});
  assert.equal(reset.status,200);
  assert.ok(reset.body.ok&&reset.body.temporaryPassword.length>=24);
  assert.equal(reset.body.lecturerId,docId);
  assert.notEqual(reset.body.temporaryPassword,'another-strong-secret-password');
  assert.ok(!JSON.stringify(data.users).includes(reset.body.temporaryPassword),
   'plaintext temporary password must not be stored');
  assert.ok(data.audit.some(a=>a.sql.includes('lecturer.password.reset')));
  assert.ok(!JSON.stringify(data.audit).includes(reset.body.temporaryPassword));
  assert.equal((await request('/api/v2/me',{cookie:doctor})).status,401,
   'all old lecturer sessions must be revoked immediately');
  const oldPw=await request('/api/v2/login',{method:'POST',
   json:{email:'doctor@example.test',password:'another-strong-secret-password'}});
  assert.equal(oldPw.status,401);
  const resetLogin=await request('/api/v2/login',{method:'POST',
   json:{email:'doctor@example.test',password:reset.body.temporaryPassword}});
  assert.equal(resetLogin.status,200);
  assert.equal(resetLogin.body.mustChangePassword,true);
  const resetCookie=resetLogin.cookie.split(';')[0];
  assert.equal((await request('/api/v2/lecturer/courses',{cookie:resetCookie})).status,403,
   'doctor must change temporary password before viewing even an assigned course');
  const resetChanged=await request('/api/v2/password',{method:'POST',cookie:resetCookie,
   json:{currentPassword:reset.body.temporaryPassword,newPassword:'after-reset-a-better-password-2026'}});
  assert.equal(resetChanged.status,200);
  assert.equal((await request('/api/v2/me',{cookie:resetCookie})).status,401);
  const afterResetLogin=await request('/api/v2/login',{method:'POST',
   json:{email:'doctor@example.test',password:'after-reset-a-better-password-2026'}});
  assert.equal(afterResetLogin.status,200);
  const newDoctorSession=afterResetLogin.cookie.split(';')[0];
  assert.equal((await request('/api/v2/lecturer/courses',{cookie:newDoctorSession})).status,200);

  assert.equal((await request('/api/v2/assignments/revoke',{method:'POST',cookie:bossCookie,json:{lecturerId:docId,courseId:newCourse.body.id}})).status,200);
  const afterRevoke=await request('/api/v2/lecturer/courses',{cookie:newDoctorSession});
  assert.equal(afterRevoke.status,200);assert.equal(afterRevoke.body.items.length,0);
  assert.equal((await request('/api/v2/logout',{method:'POST',cookie:bossCookie,json:{}})).status,200);
  assert.equal((await request('/api/v2/courses',{cookie:bossCookie})).status,401);
  assert.ok(data.audit.some(a=>a.sql.includes('course.create')));
  assert.ok(data.audit.some(a=>a.sql.includes('lecturer.create')));
  assert.ok(data.audit.some(a=>a.sql.includes('assignment.revoke')));
 }finally{await new Promise(resolve=>server.close(resolve))}
});
