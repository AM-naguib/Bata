'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createQrSigner,distanceMeters,recordAttendance,authorizeCourse,createLecture,
 scopedLecture,closeLecture,liveLecture,listLectures}=require('../lib/attendance-v2');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const lecture='a65c14c2-d9ec-4e2b-b289-2d329048fb32';
const doctorId='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
const studentId='13823c35-164a-4c08-bb88-3256f584116a';
const otherStudent='31ca620d-4d43-4adc-90fa-9b52699eebc4';
const teacher={id:doctorId,role:'lecturer',must_change_password:false};
const admin={id:'318bbc43-5b9e-4df9-9a47-f3eceac579b6',role:'superadmin'};
let clock=1700000000000;
const signer=createQrSigner('long-secret-32-characters-at-least!test',()=>clock);
const key='another-long-device-hash-secret-12345678';
const inputs=()=>({token:signer.issue(lecture),studentId:'0072',studentName:'مريم أحمد حسن',
 deviceId:'12345678-1234-1234-1234-123456789012',lat:30,lng:31,accuracy:12});
function fakeDatabase(){
 let open=true,active=true,archived=false;
 const rows=[],queries=[];
 const studentRows=[
  {id:studentId,roll_number:'0072',full_name:'مريم أحمد حسن'},
  {id:otherStudent,roll_number:'0073',full_name:'سارة علي'}
 ];
 const query=async(sql,p=[])=>{
  queries.push({sql,p});
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.startsWith('SELECT l.id,l.course_id,l.closed_at,l.archived_at')){
   return {rows:open?[{id:lecture,course_id:course,closed_at:null,archived_at:null,
    course_archived:archived?new Date():null,location_lat:30,location_lng:31,radius_m:100}]:[]};
  }
  if(sql.startsWith('SELECT s.id,s.roll_number,s.full_name FROM students')){
   return {rows:active?studentRows.filter(r=>r.roll_number===p[0]):[]};
  }
  if(sql.startsWith('SELECT student_id,device_fingerprint_hash FROM attendances')){
   return {rows:rows.filter(r=>r.student_id===p[1]||r.device_fingerprint_hash===p[2])};
  }
  if(sql.startsWith('INSERT INTO attendances(')){
   rows.push({student_id:p[1],device_fingerprint_hash:p[2]});return {rows:[]};
  }
  if(sql.startsWith('SELECT 1 FROM lecturer_courses')){
   return {rows:active&&p[0]===doctorId&&p[1]===course?[{ok:1}]:[]};
  }
  if(sql.startsWith('SELECT l.id,l.course_id,l.title')){
   return {rows:active?[{id:lecture,course_id:course,title:'Test',closed_at:null,archived_at:null,course_name:'Chemistry'}]:[]};
  }
  if(sql.startsWith('SELECT count(*)::int AS total')){
   return {rows:[{total:rows.length}]};
  }
  if(sql.startsWith('UPDATE lectures l SET closed_at')){
   if(!open)return {rows:[]};open=false;return {rows:[{id:lecture}]};
  }
  if(sql.startsWith('INSERT INTO lectures(')){
   return {rows:active?[{id:lecture,course_id:course,title:p[2],closed_at:null}]:[]};
  }
  if(sql.startsWith('SELECT l.id,l.course_id,l.title,l.opened_at')){
   return {rows:active?[{id:lecture,course_id:course,title:'Test',closed_at:null,course_name:'Chemistry'}]:[]};
  }
  throw Error('Unexpected SQL: '+sql);
 };
 const pool={query,connect:async()=>({query,release:()=>{}})};
 return {pool,rows,queries,setOpen:value=>open=value,setActive:value=>active=value};
}
test('HMAC QR token expires and tampering/Unicode fails validation',()=>{
 clock=1700000000000;
 const t=signer.issue(lecture);
 assert.equal(signer.verify(t),lecture);
 assert.equal(signer.verify(t.slice(0,-1)+'💥'),null);
 assert.equal(signer.verify(t.slice(0,-1)+(t.at(-1)==='a'?'b':'a')),null);
 assert.equal(signer.verify('garbage'),null);
 clock+=31000;
 assert.equal(signer.verify(t),lecture,'previous 30-second time slot is tolerated');
 clock+=90000;
 assert.equal(signer.verify(t),null);
 clock=1700000000000;
});
test('GPS distance at same coordinates is zero',()=>{
 assert.equal(distanceMeters(30,31,30,31),0);
 assert.ok(distanceMeters(30,31,31,31)>100000);
});
test('atomic check-in requires matching name/roll and enrollment, GPS, QR and device uniqueness',async()=>{
 clock=1700000000000;const db=fakeDatabase(),form=inputs();
 for(const data of [
  {...form,studentName:'اسم غلط'},
  {...form,studentName:''},
  {...form,studentId:'0073'},
  {...form,accuracy:0},
  {...form,accuracy:-1},
  {...form,lat:999},
  {...form,lng:181},
  {...form,lat:31},
  {...form,deviceId:'bad'},
  {...form,token:'invalid'}
 ])await assert.rejects(recordAttendance(db.pool,data,signer,key),e=>e.status>=400);
 assert.equal(db.rows.length,0);
 const success=await recordAttendance(db.pool,form,signer,key);
 assert.deepEqual(success,{ok:true,alreadyRegistered:false,studentName:'مريم أحمد حسن'});
 assert.equal(db.rows.length,1);
 const retry=await recordAttendance(db.pool,form,signer,key);
 assert.equal(retry.alreadyRegistered,true);assert.equal(db.rows.length,1);
 await assert.rejects(recordAttendance(db.pool,{...form,studentId:'0073',studentName:'سارة علي'},signer,key),
  e=>e.status===409&&e.message==='DEVICE_ALREADY_USED');
 db.setOpen(false);
 await assert.rejects(recordAttendance(db.pool,form,signer,key),e=>e.status===409);
 assert.equal(db.rows.length,1);
});
test('course roster no longer active rejects check-in without recording anything',async()=>{
 const db=fakeDatabase();db.setActive(false);
 await assert.rejects(recordAttendance(db.pool,inputs(),signer,key),e=>e.status===400);
 assert.equal(db.rows.length,0);
});
test('roles and active assignments guard lecturer lecture CRUD; superadmin cannot read or create lectures',async()=>{
 const db=fakeDatabase();
 await assert.rejects(authorizeCourse(db.pool,admin,course,'lecture.create'),e=>e.status===403);
 await assert.rejects(listLectures(db.pool,admin),e=>e.status===403);
 await assert.rejects(createLecture(db.pool,admin,{courseId:course,title:'Test',lat:30,lng:31,accuracy:10,radius:100}),e=>e.status===403);
 const created=await createLecture(db.pool,teacher,{courseId:course,title:'Test',lat:30,lng:31,accuracy:10,radius:100});
 assert.equal(created.id,lecture);
 const live=await liveLecture(db.pool,teacher,lecture,signer);
 assert.equal(live.courseId,course);assert.ok(live.token);
 assert.deepEqual(await closeLecture(db.pool,teacher,lecture),{ok:true});
 db.setActive(false);
 await assert.rejects(scopedLecture(db.pool,teacher,lecture,'lecture.read'),e=>e.status===404);
 await assert.rejects(authorizeCourse(db.pool,teacher,course,'lecture.create'),e=>e.status===403);
});
