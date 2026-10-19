'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../lib/lecture-maintenance');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const lecture='a65c14c2-d9ec-4e2b-b289-2d329048fb32';
const student='13823c35-164a-4c08-bb88-3256f584116a';
const doctor={id:'b84d2fee-7a80-43ad-882a-8e6ca3eaeace',role:'lecturer',must_change_password:false};
const admin={id:'318bbc43-5b9e-4df9-9a47-f3eceac579b6',role:'superadmin'};
function fake({assigned=true,closed=true,archived=false,enrolled=true,failAudit=false}={}){
 const q=[],audit=[],corrections=new Map();let isArchived=archived,active=assigned;
 const query=async(sql,p=[])=>{
  q.push({sql,p});
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('SELECT 1 FROM lecturer_courses'))return {rows:active&&p[0]===doctor.id&&p[1]===course?[{yes:1}]:[]};
  if(sql.startsWith('SELECT l.id,l.course_id,l.closed_at,l.archived_at FROM lectures'))return {rows:active&&p[1]===doctor.id?[{
   id:lecture,course_id:course,closed_at:closed?'2026-10-18T19:00:00Z':null,archived_at:isArchived?'2026-10-18T20:00:00Z':null
  }]:[]};
  if(sql.startsWith('SELECT l.id,l.course_id,l.title,l.opened_at'))return {rows:active?[{
   id:lecture,course_id:course,title:'محاضرة تجريبية',closed_at:closed?'2026-10-18':null,
   archived_at:isArchived?'2026-10-18':null
  }]:[]};
  if(sql.startsWith('UPDATE lectures SET archived_at=now()')){isArchived=true;return {rows:[]}};
  if(sql.startsWith('UPDATE lectures SET archived_at=NULL')){isArchived=false;return {rows:[]}};
  if(sql.startsWith('SELECT 1 FROM enrollments'))return {rows:enrolled?[{yes:1}]:[]};
  if(sql.startsWith('SELECT status FROM attendance_corrections'))return {rows:corrections.has(p[0]+p[1])?[{status:corrections.get(p[0]+p[1])}]:[]};
  if(sql.startsWith('INSERT INTO attendance_corrections')){corrections.set(p[0]+p[1],p[2]);return {rows:[]}};
  if(sql.startsWith('INSERT INTO audit_events')){
   if(failAudit)throw Error('audit unavailable');
   audit.push({sql,p});return {rows:[]};
  }
  throw Error('Unexpected SQL: '+sql);
 };
 return {pool:{query,connect:async()=>({query,release:()=>q.push({sql:'RELEASE'})})},
  q,audit,corrections,getArchived:()=>isArchived};
}
test('archive and restore preserve student & attendance data, require closed lecture and emit audit',async()=>{
 const db=fake();
 const result=await service.setLectureArchived(db.pool,doctor,lecture,true);
 assert.deepEqual(result,{ok:true,lectureId:lecture,archived:true});
 assert.equal(db.getArchived(),true);assert.ok(db.q.some(e=>e.sql.includes('FOR UPDATE OF l')));
 assert.equal(db.audit[0].p[1],'lecture.archive');
 assert.ok(!db.q.some(e=>/DELETE|UPDATE attendances|UPDATE students/i.test(e.sql)));
 const restored=await service.setLectureArchived(db.pool,doctor,lecture,false);
 assert.equal(restored.archived,false);assert.equal(db.getArchived(),false);
 assert.equal(db.audit[1].p[1],'lecture.restore');
 assert.equal(db.q.filter(e=>e.sql==='COMMIT').length,2);
});
test('reject archiving open lecture and repeated invalid state, never edit academic data',async()=>{
 const open=fake({closed:false});
 await assert.rejects(service.setLectureArchived(open.pool,doctor,lecture,true),e=>e.status===409);
 assert.ok(open.q.some(q=>q.sql==='ROLLBACK'));
 assert.ok(!open.q.some(q=>q.sql.startsWith('UPDATE lectures')));
 const db=fake({archived:true});
 await assert.rejects(service.setLectureArchived(db.pool,doctor,lecture,true),e=>e.status===409);
 await assert.rejects(service.setLectureArchived(db.pool,doctor,lecture,false).then(
  ()=>service.setLectureArchived(db.pool,doctor,lecture,false)),e=>e.status===409);
});
test('only authorized assigned doctor can list and alter course lectures; admin has zero access',async()=>{
 for(const user of [admin,{...doctor,must_change_password:true},{...doctor,disabled_at:'2026-10-18'}]){
  const db=fake();
  await assert.rejects(service.listLectureRecords(db.pool,user),e=>e.status===403);
  await assert.rejects(service.setLectureArchived(db.pool,user,lecture,true),e=>e.status===403);
  assert.ok(db.q.every(x=>!x.sql.startsWith('UPDATE')));
 }
 const unassigned=fake({assigned:false});
 assert.deepEqual(await service.listLectureRecords(unassigned.pool,doctor),[]);
 await assert.rejects(service.setLectureArchived(unassigned.pool,doctor,lecture,true),e=>e.status===404);
 assert.ok(unassigned.q.every(q=>q.sql==='BEGIN'||q.sql==='ROLLBACK'||q.sql==='RELEASE'||q.sql.startsWith('SELECT')));
});
test('correction stores actor reason and status overlay; changes logged without rewriting QR records',async()=>{
 const db=fake();
 assert.deepEqual(await service.correctAttendance(db.pool,doctor,{lectureId:lecture,studentId:student,status:'present',reason:'تأكيد من الدكتور'}),{
  ok:true,lectureId:lecture,studentId:student,status:'present'
 });
 await service.correctAttendance(db.pool,doctor,{lectureId:lecture,studentId:student,status:'absent',reason:'تعديل لخطأ إدخال'});
 assert.equal(db.corrections.get(lecture+student),'absent');
 assert.equal(db.audit.length,2);
 assert.ok(db.audit.every(x=>x.sql.includes("'attendance.record.correct'")));
 assert.equal(JSON.parse(db.audit[1].p[2]).from,'present');
 assert.equal(JSON.parse(db.audit[1].p[2]).to,'absent');
 assert.ok(db.q.every(x=>!x.sql.includes('DELETE FROM attendances')&&!x.sql.includes('UPDATE attendances')));
});
test('corrections require closed unarchived lecture, actively enrolled student and meaningful reason',async()=>{
 for(const settings of [{closed:false},{archived:true},{enrolled:false},{assigned:false}]){
  const db=fake(settings);
  await assert.rejects(service.correctAttendance(db.pool,doctor,{lectureId:lecture,studentId:student,status:'present',reason:'بعد المراجعة'}),
   e=>e.status>=400);
  assert.ok(db.q.some(x=>x.sql==='ROLLBACK'));
  assert.equal(db.audit.length,0);
 }
 for(const body of [
  {lectureId:'bad',studentId:student,status:'present',reason:'بعد المراجعة'},
  {lectureId:lecture,studentId:'bad',status:'present',reason:'بعد المراجعة'},
  {lectureId:lecture,studentId:student,status:'present',reason:'bad'},
  {lectureId:lecture,studentId:student,status:'yes',reason:'بعد المراجعة'}
 ]){const db=fake();await assert.rejects(service.correctAttendance(db.pool,doctor,body),e=>e.status===400);assert.equal(db.q.length,0)}
 const nope=fake();await assert.rejects(service.correctAttendance(nope.pool,admin,{
  lectureId:lecture,studentId:student,status:'present',reason:'بعد المراجعة'}),e=>e.status===403);
});
test('both archive and correction rollback when audit fails',async()=>{
 for(const task of ['archive','correct']){
  const db=fake({failAudit:true});
  await assert.rejects(task==='archive'
   ?service.setLectureArchived(db.pool,doctor,lecture,true)
   :service.correctAttendance(db.pool,doctor,{lectureId:lecture,studentId:student,status:'present',reason:'تأكيد المراجعة'}),/audit unavailable/);
  assert.ok(db.q.some(x=>x.sql==='ROLLBACK'));
  assert.ok(!db.q.some(x=>x.sql==='COMMIT'));
 }
});
