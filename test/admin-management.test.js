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
  if(sql.includes('RETURNING id,name,code,created_at'))return {rows:[{id:id2,name:params[0],code:null,created_at:'2026-10-19'}]};
  if(sql.includes('RETURNING id,email,display_name'))return {rows:[{id:id1,email:'doctor@example.test',display_name:'Dr Test'}]};
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
 await assert.rejects(service.createCourse(pool,lecturer,{name:'Test Course'}),e=>e.status===403);
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
 assert.ok(!queries.some(q=>/\\b(students|enrollments|attendances|lectures)\\b/i.test(q.sql)));
});
test('course creation validates name before DB access and does not grant other write powers',async()=>{
 const {pool,queries}=fakePool();
 for(const name of [undefined,null,'','   ','x'.repeat(151),'A\\nB']){
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
test('superadmin can assign and revoke existing course, no course or lecturer creation beyond account creation',async()=>{
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
