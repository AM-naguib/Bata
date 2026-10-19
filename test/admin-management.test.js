const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../lib/admin-management');
const boss={id:'3acfa588-9d3e-4db8-9344-80c3addcd303',role:'superadmin'};
const lecturer={id:'b84d2fee-7a80-43ad-882a-8e6ca3eaeace',role:'lecturer'};
const id1='d5da7345-690b-47dc-8587-0b2197413a0b';
const id2='9a8dbc9d-88e8-4fc6-8871-4913d50ecaba';
function fakePool(mode='success'){
 const queries=[];
 const client={query:async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql.startsWith('UPDATE courses SET name='))return {rows:mode==='missing-rename'?[]:[{id:id2,name:params[0],code:null,created_at:'2026-10-19'}]};
  if(sql.includes('RETURNING id,name,code,created_at'))return {rows:[{id:id2,name:params[0],code:null,created_at:'2026-10-19'}]};
  if(sql.includes('RETURNING id,email,display_name'))return {rows:[{id:id1,email:'doctor@example.test',display_name:'Dr Test'}]};
  if(sql.includes("SELECT id,display_name,email FROM app_users")){
   return {rows:mode==='missing-lecturer'?[]:[{id:id1,display_name:'Dr Test',email:'doctor@example.test'}]};
  }
  if(sql.includes('SELECT id FROM app_users')){
   return {rows:mode==='missing-lecturer'?[]:[{id:id1}]};
  }
  if(sql.includes('SELECT id FROM courses')){
   return {rows:mode==='missing-course'?[]:[{id:id2}]};
  }
  if(sql.includes('RETURNING lecturer_id'))return {rows:mode==='missing-assignment'?[]:[{lecturer_id:id1}]};
  return {rows:[]};
 },release:()=>queries.push({sql:'RELEASE'})};
 return {queries,pool:{connect:async()=>client,query:client.query}};
}
test('lecturers and strangers cannot call superadmin management functions or read account catalog',async()=>{
 const {pool,queries}=fakePool();
 for(const method of ['listLecturers','listCourseCatalog','listAssignments']){
  await assert.rejects(service[method](pool,lecturer),e=>e.status===403);
  await assert.rejects(service[method](pool,null),e=>e.status===401);
 }
 await assert.rejects(service.createLecturer(pool,lecturer,{email:'doctor@example.test',displayName:'Dr Test'}),e=>e.status===403);
 await assert.rejects(service.resetLecturerPassword(pool,lecturer,{lecturerId:id1}),e=>e.status===403);
 await assert.rejects(service.resetLecturerPassword(pool,null,{lecturerId:id1}),e=>e.status===401);
 await assert.rejects(service.createCourse(pool,lecturer,{name:'Test Course'}),e=>e.status===403);
 await assert.rejects(service.renameCourse(pool,lecturer,{courseId:id2,name:'Another Name'}),e=>e.status===403);
 await assert.rejects(service.renameCourse(pool,null,{courseId:id2,name:'Another Name'}),e=>e.status===401);
 await assert.rejects(service.createCourse(pool,null,{name:'Test Course'}),e=>e.status===401);
 await assert.rejects(service.assignCourse(pool,lecturer,{lecturerId:id1,courseId:id2}),e=>e.status===403);
 await assert.rejects(service.unassignCourse(pool,lecturer,{lecturerId:id1,courseId:id2}),e=>e.status===403);
 assert.equal(queries.length,0,'deny before ANY database query');
});
test('superadmin sees minimal identity/catalog data, not student or attendance',async()=>{
 const {pool,queries}=fakePool();
 await service.listLecturers(pool,boss);
 await service.listCourseCatalog(pool,boss);
 await service.listAssignments(pool,boss);
 assert.equal(queries.length,3);
 assert.ok(queries.every(q=>!/(students|attendances|enrollments|lectures)/.test(q.sql)));
 assert.ok(queries.every(q=>!q.sql.includes('password_hash')));
});
test('superadmin can create a course by name with an audit event and then assign it to a lecturer',async()=>{
 const {pool,queries}=fakePool();
 const newCourse=await service.createCourse(pool,boss,{name:'  الكيمياء العضوية  '});
 assert.equal(newCourse.id,id2);
 assert.equal(newCourse.name,'الكيمياء العضوية');
 const insert=queries.find(q=>q.sql.includes('INSERT INTO courses('));
 assert.deepEqual(insert.params,['الكيمياء العضوية',boss.id]);
 assert.ok(queries.some(q=>q.sql.includes("'course.create'")));
 assert.ok(queries.some(q=>q.sql==='COMMIT'));
 assert.deepEqual(await service.assignCourse(pool,boss,{lecturerId:id1,courseId:newCourse.id}),{ok:true});
 assert.ok(queries.some(q=>q.sql.includes('INSERT INTO lecturer_courses(')&&q.params[1]===id2));
 assert.ok(!queries.some(q=>/\b(students|enrollments|attendances|lectures)\b/i.test(q.sql)));
});
test('course creation validates name before DB access and does not grant other write powers',async()=>{
 const {pool,queries}=fakePool();
 for(const name of [undefined,null,'','   ','x'.repeat(151),'A\nB']){
  await assert.rejects(service.createCourse(pool,boss,{name}),e=>e.status===400);
 }
 assert.equal(queries.length,0);
});
test('course creation rolls back when catalog insertion or audit insert fails',async()=>{
 let released=false;const sqls=[];
 const client={query:async(sql)=>{
  sqls.push(sql);
  if(sql.startsWith('INSERT INTO courses'))return {rows:[{id:id2,name:'Course'}]};
  if(sql.includes('INSERT INTO audit_events'))throw Error('DB write failed');
  return {rows:[]};
 },release:()=>{released=true}};
 await assert.rejects(service.createCourse({connect:async()=>client},boss,{name:'Course'}),/DB write failed/);
 assert.ok(sqls.includes('ROLLBACK'));
 assert.equal(released,true);
});
test('superadmin can rename a course without touching assignments or attendance',async()=>{
 const {pool,queries}=fakePool();
 const renamed=await service.renameCourse(pool,boss,{courseId:id2,name:'  اسم المقرر الجديد  '});
 assert.equal(renamed.name,'اسم المقرر الجديد');
 assert.equal(renamed.id,id2);
 const update=queries.find(x=>x.sql.startsWith('UPDATE courses SET name='));
 assert.deepEqual(update.params,['اسم المقرر الجديد',id2]);
 assert.ok(queries.some(x=>x.sql.includes("'course.rename'")));
 assert.ok(queries.some(x=>x.sql==='COMMIT'));
 assert.ok(!queries.some(x=>['enrollments','students','attendances','lectures','lecturer_courses'].some(table=>x.sql.includes(table))));
});
test('course rename validates existing ID/name and rolls back absent course',async()=>{
 const {pool,queries}=fakePool();
 for(const req of [
  {courseId:'bad',name:'Anything'},
  {courseId:id2,name:''},
  {courseId:id2,name:'  '},
  {courseId:id2,name:'x'.repeat(151)},
  {courseId:id2,name:'Bad'+String.fromCharCode(10)+'Name'}
 ])await assert.rejects(service.renameCourse(pool,boss,req),e=>e.status===400);
 assert.equal(queries.length,0);
 const missing=fakePool('missing-rename');
 await assert.rejects(service.renameCourse(missing.pool,boss,{courseId:id2,name:'New Name'}),e=>e.status===404);
 assert.ok(missing.queries.some(x=>x.sql==='ROLLBACK'));
});
test('superadmin may create a lecturer with one-time password hash and audit event',async()=>{
 const {pool,queries}=fakePool();
 const created=await service.createLecturer(pool,boss,{email:'doctor@example.test',displayName:'Dr Test'});
 assert.equal(created.email,'doctor@example.test');
 assert.ok(created.initialPassword.length>=12);
 const insert=queries.find(q=>q.sql.includes('INSERT INTO app_users'));
 assert.ok(insert.params[2].startsWith('scrypt:v1:'));
 assert.ok(!insert.params.includes(created.initialPassword));
 assert.ok(queries.some(q=>q.sql.includes('INSERT INTO audit_events')));
 assert.ok(queries.some(q=>q.sql==='COMMIT'));
});
test('superadmin can assign and revoke existing course without accessing academic records',async()=>{
 const {pool,queries}=fakePool();
 assert.deepEqual(await service.assignCourse(pool,boss,{lecturerId:id1,courseId:id2}),{ok:true});
 assert.ok(queries.some(q=>q.sql.includes('ON CONFLICT (lecturer_id,course_id)')));
 assert.deepEqual(await service.unassignCourse(pool,boss,{lecturerId:id1,courseId:id2}),{ok:true});
 assert.ok(queries.some(q=>q.sql.includes('unassigned_at=now()')));
 assert.ok(queries.some(q=>q.sql.includes('INSERT INTO audit_events')));
});
test('reject malformed IDs, unknown lecturer and unknown course; rollback transaction',async()=>{
 const x=fakePool();
 await assert.rejects(service.assignCourse(x.pool,boss,{lecturerId:'bad',courseId:id2}),e=>e.status===400);
 assert.equal(x.queries.length,0);
 const missing=fakePool('missing-lecturer');
 await assert.rejects(service.assignCourse(missing.pool,boss,{lecturerId:id1,courseId:id2}),e=>e.status===404);
 assert.ok(missing.queries.some(q=>q.sql==='ROLLBACK'));
 const noCourse=fakePool('missing-course');
 await assert.rejects(service.assignCourse(noCourse.pool,boss,{lecturerId:id1,courseId:id2}),e=>e.status===404);
 assert.ok(noCourse.queries.some(q=>q.sql==='ROLLBACK'));
 const noAssignment=fakePool('missing-assignment');
 await assert.rejects(service.unassignCourse(noAssignment.pool,boss,{lecturerId:id1,courseId:id2}),e=>e.status===404);
 assert.ok(noAssignment.queries.some(q=>q.sql==='ROLLBACK'));
});


test('superadmin resets only an existing lecturer, returns a one-time strong secret, revokes sessions and audits',async()=>{
 const {pool,queries}=fakePool();
 const reset=await service.resetLecturerPassword(pool,boss,{lecturerId:id1});
 assert.equal(reset.ok,true);
 assert.equal(reset.lecturerId,id1);
 assert.equal(reset.displayName,'Dr Test');
 assert.ok(reset.temporaryPassword.length>=24);
 assert.ok(queries.some(q=>q.sql==='BEGIN'));
 const update=queries.find(q=>q.sql.startsWith('UPDATE app_users SET password_hash='));
 assert.ok(update);
 assert.equal(update.params[1],id1);
 assert.match(update.params[0],/^scrypt:v1:/);
 assert.ok(!update.params.includes(reset.temporaryPassword),'never send plaintext secret to database');
 assert.match(update.sql,/must_change_password=true/);
 const revoke=queries.find(q=>q.sql.startsWith('UPDATE auth_sessions SET revoked_at=now()'));
 assert.deepEqual(revoke.params,[id1]);
 const audit=queries.find(q=>q.sql.includes("'lecturer.password.reset'"));
 assert.ok(audit);
 assert.deepEqual(audit.params,[boss.id,id1]);
 assert.ok(!JSON.stringify(queries).includes(reset.temporaryPassword),'secret never written to audit or DB');
 assert.ok(queries.some(q=>q.sql==='COMMIT'));
 assert.ok(!queries.some(q=>/\\b(students|enrollments|attendances|lectures)\\b/i.test(q.sql)));
});
test('reset input and nonexistent doctor fail closed without leaking a password',async()=>{
 const invalid=fakePool();
 for(const id of ['invalid',null,undefined,id1.slice(0,-1)])
  await assert.rejects(service.resetLecturerPassword(invalid.pool,boss,{lecturerId:id}),e=>e.status===400);
 assert.equal(invalid.queries.length,0);
 const missing=fakePool('missing-lecturer');
 await assert.rejects(service.resetLecturerPassword(missing.pool,boss,{lecturerId:id1}),e=>e.status===404);
 assert.ok(missing.queries.some(q=>q.sql==='ROLLBACK'));
 assert.ok(!missing.queries.some(q=>q.sql.startsWith('UPDATE app_users')));
});
test('reset rolls back atomically if audit fails, with no successful response',async()=>{
 const statements=[];
 const client={query:async(sql,params=[])=>{
  statements.push(sql);
  if(sql.startsWith('SELECT id,display_name,email FROM app_users'))
   return {rows:[{id:id1,display_name:'Dr Test',email:'doctor@example.test'}]};
  if(sql.includes("'lecturer.password.reset'"))throw Error('Audit insert unavailable');
  return {rows:[]};
 },release:()=>statements.push('RELEASE')};
 await assert.rejects(
  service.resetLecturerPassword({connect:async()=>client},boss,{lecturerId:id1}),
  /Audit insert unavailable/
 );
 assert.ok(statements.includes('ROLLBACK'));
 assert.ok(!statements.includes('COMMIT'));
 assert.ok(statements.includes('RELEASE'));
});
