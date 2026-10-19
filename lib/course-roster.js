'use strict';
// Private lecturer-managed course enrollments. Soft removal never deletes attendance history.
const {authorize}=require('./permissions');
const {normalizeSeatNumber,normalizeStudentName}=require('./student-identity');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function failure(status,message){const e=new Error(message);e.status=status;return e}
function validCourse(courseId){if(typeof courseId!=='string'||!UUID.test(courseId))throw failure(400,'INVALID_COURSE');return courseId}
function validInput(body){
 const roll=normalizeSeatNumber(body?.studentId),name=normalizeStudentName(body?.studentName);
 if(!roll||roll.length>64||!name||name.length>200||
    /[\x00-\x1f\x7f]/.test(roll)||/[\x00-\x1f\x7f]/.test(name))
  throw failure(400,'INVALID_STUDENT');
 return {roll,name};
}
// A lock on the lecturer/course assignment protects operations against concurrent revocation.
async function courseAccess(client,user,courseId,action){
 validCourse(courseId);
 const permission=await authorize({principal:user,action,courseId,
  isAssignedToCourse:async(userId,id)=>{
   const assigned=await client.query(
    'SELECT 1 FROM lecturer_courses lc JOIN courses c ON c.id=lc.course_id WHERE lc.lecturer_id=$1 AND lc.course_id=$2 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL FOR SHARE OF lc',
    [userId,id]);
   return assigned.rows.length>0;
  }});
 if(!permission.allowed)throw failure(permission.status,permission.reason);
}
async function transaction(pool,work){
 const client=await pool.connect();
 try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result}
 catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
async function listStudents(pool,user,courseId){
 return transaction(pool,async client=>{
  await courseAccess(client,user,courseId,'enrollment.list');
  const r=await client.query(
   'SELECT s.id,s.roll_number,s.full_name FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.course_id=$1 AND e.removed_at IS NULL ORDER BY s.roll_number,s.id LIMIT 5000',
   [courseId]
  );
  return r.rows;
 });
}
async function addStudent(pool,user,courseId,body){
 validCourse(courseId);
 const {roll,name}=validInput(body);
 return transaction(pool,async client=>{
  await courseAccess(client,user,courseId,'enrollment.add');
  // Multiple courses may share a student. Never overwrite a global name based on one request.
  const inserted=await client.query(
   'INSERT INTO students(roll_number,full_name) VALUES($1,$2) ON CONFLICT (roll_number) DO NOTHING RETURNING id,roll_number,full_name',
   [roll,name]
  );
  let student=inserted.rows[0];
  if(!student){
   const found=await client.query('SELECT id,roll_number,full_name FROM students WHERE roll_number=$1 FOR UPDATE',[roll]);
   student=found.rows[0];
  }
  if(!student||normalizeStudentName(student.full_name)!==name)
   throw failure(409,'STUDENT_DATA_CONFLICT');
  const enrollment=await client.query(
   'INSERT INTO enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT (student_id,course_id) DO UPDATE SET removed_at=NULL RETURNING student_id',
   [student.id,courseId]
  );
  if(!enrollment.rows.length)throw failure(500,'ENROLLMENT_FAILED');
  await client.query(
   "INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'enrollment.add','student',$2,$3::jsonb)",
   [user.id,student.id,JSON.stringify({courseId})]
  );
  return {id:student.id,roll_number:student.roll_number,full_name:student.full_name};
 });
}
async function removeStudent(pool,user,courseId,studentId){
 validCourse(courseId);
 if(typeof studentId!=='string'||!UUID.test(studentId))throw failure(400,'INVALID_STUDENT_ID');
 return transaction(pool,async client=>{
  await courseAccess(client,user,courseId,'enrollment.remove');
  const result=await client.query(
   'UPDATE enrollments SET removed_at=now() WHERE student_id=$1 AND course_id=$2 AND removed_at IS NULL RETURNING student_id',
   [studentId,courseId]
  );
  if(!result.rows.length)throw failure(404,'ACTIVE_ENROLLMENT_NOT_FOUND');
  await client.query(
   "INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'enrollment.remove','student',$2,$3::jsonb)",
   [user.id,studentId,JSON.stringify({courseId})]
  );
  return {ok:true};
 });
}
module.exports={listStudents,addStudent,removeStudent,validInput};
