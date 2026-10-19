const test=require('node:test');
const assert=require('node:assert/strict');
const {findEnrolledStudent}=require('../lib/student-enrollment');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const student={id:'13823c35-164a-4c08-bb88-3256f584116a',roll_number:'072',full_name:'مريم أحمد حسن'};
test('v2 course enrollment requires BOTH full name and seat number, returns only student internal ID',async()=>{
 let count=0;
 const pool={query:async(sql,args)=>{
  count++;assert.match(sql,/JOIN enrollments/);assert.match(sql,/e.removed_at IS NULL/);
  assert.deepEqual(args,['072',course]);return {rows:[student]};
 }};
 const yes=await findEnrolledStudent(pool,{courseId:course,studentId:'072',studentName:'مريم  أحمد  حسن'});
 assert.deepEqual(yes,{id:student.id});assert.equal(count,1);
 const no=await findEnrolledStudent(pool,{courseId:course,studentId:'072',studentName:'اسم غلط'});
 assert.equal(no,null);assert.equal(count,2);
});
test('no public name lookup and no query for incomplete/malformed data',async()=>{
 const pool={query:async()=>{throw Error('database must not be contacted')}};
 for(const body of [
  {studentId:'072',studentName:'مريم أحمد حسن'},
  {courseId:course,studentId:'072'},
  {courseId:course,studentName:'مريم أحمد حسن'},
  {courseId:course,studentId:'072',studentName:' '},
  {courseId:course,studentId:'x'.repeat(65),studentName:'مريم أحمد حسن'},
  {courseId:'invalid',studentId:'072',studentName:'مريم أحمد حسن'}
 ])assert.equal(await findEnrolledStudent(pool,body),null);
});
test('student must still be enrolled in the specific course',async()=>{
 const pool={query:async()=>({rows:[]})};
 assert.equal(await findEnrolledStudent(pool,{courseId:course,studentId:'072',studentName:'مريم أحمد حسن'}),null);
});
