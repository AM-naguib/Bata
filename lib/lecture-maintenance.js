'use strict';
// Role-scoped academic maintenance that NEVER permanently deletes student,
// lecture or attendance rows. Requires a completed lecturer password change.
const {authorizeCourse}=require('./attendance-v2');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function fail(status,code){const e=new Error(code);e.status=status;throw e}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail(400,'INVALID_ID');return value}
async function verifyLecturer(pool,user,action,courseId){
 if(!user||user.role!=='lecturer'||user.disabled_at||user.must_change_password)fail(403,'FORBIDDEN');
 await authorizeCourse(pool,user,courseId,action);
}
async function listLectureRecords(pool,user){
 if(!user||user.role!=='lecturer'||user.disabled_at||user.must_change_password)fail(403,'FORBIDDEN');
 const r=await pool.query(
  "SELECT l.id,l.course_id,l.title,l.opened_at,l.closed_at,l.archived_at,c.name AS course_name FROM lectures l JOIN lecturer_courses lc ON lc.course_id=l.course_id JOIN courses c ON c.id=l.course_id WHERE lc.lecturer_id=$1 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL ORDER BY l.opened_at DESC,l.id LIMIT 500",
  [user.id]);
 return r.rows;
}
// All writes take a lecture row lock, just like QR check-ins and close actions.
async function scopedLockedLecture(client,user,lectureId,action){
 uuid(lectureId);
 const r=await client.query(
  "SELECT l.id,l.course_id,l.closed_at,l.archived_at FROM lectures l JOIN courses c ON c.id=l.course_id JOIN lecturer_courses lc ON lc.course_id=l.course_id WHERE l.id=$1 AND lc.lecturer_id=$2 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL FOR UPDATE OF l",
  [lectureId,user.id]);
 if(!r.rows.length)fail(404,'LECTURE_NOT_FOUND');
 await authorizeCourse(client,user,r.rows[0].course_id,action);
 return r.rows[0];
}
async function setLectureArchived(pool,user,lectureId,archived){
 uuid(lectureId);
 if(!user||user.role!=='lecturer'||user.disabled_at||user.must_change_password)fail(403,'FORBIDDEN');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const lecture=await scopedLockedLecture(client,user,lectureId,archived?'lecture.archive':'lecture.restore');
  if(!lecture.closed_at)fail(409,'LECTURE_MUST_BE_CLOSED');
  if(Boolean(lecture.archived_at)===archived)fail(409,archived?'LECTURE_ALREADY_ARCHIVED':'LECTURE_NOT_ARCHIVED');
  await client.query(
   archived?'UPDATE lectures SET archived_at=now() WHERE id=$1':
    'UPDATE lectures SET archived_at=NULL WHERE id=$1',
   [lectureId]);
  await client.query(
   "INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,$2,'lecture',$3,$4::jsonb)",
   [user.id,archived?'lecture.archive':'lecture.restore',lectureId,
    JSON.stringify({courseId:lecture.course_id})]);
  await client.query('COMMIT');
  return {ok:true,lectureId,archived};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
async function correctAttendance(pool,user,{lectureId,studentId,status,reason}={}){
 uuid(lectureId);uuid(studentId);
 if(!user||user.role!=='lecturer'||user.disabled_at||user.must_change_password)fail(403,'FORBIDDEN');
 if(!['present','absent'].includes(status))fail(400,'INVALID_CORRECTION_STATUS');
 if(typeof reason!=='string'||reason.trim().length<5||reason.trim().length>500)fail(400,'INVALID_CORRECTION_REASON');
 const note=reason.trim(),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const lecture=await scopedLockedLecture(client,user,lectureId,'attendance.record.correct');
  if(!lecture.closed_at||lecture.archived_at)fail(409,'LECTURE_NOT_EDITABLE');
  // A student must be actively enrolled and must have joined before this lecture closed.
  const enrollment=await client.query(
   "SELECT 1 FROM enrollments WHERE course_id=$1 AND student_id=$2 AND removed_at IS NULL AND enrolled_at<=$3",
   [lecture.course_id,studentId,lecture.closed_at]);
  if(!enrollment.rows.length)fail(404,'STUDENT_NOT_IN_COURSE');
  const previous=await client.query(
   'SELECT status FROM attendance_corrections WHERE lecture_id=$1 AND student_id=$2 FOR UPDATE',
   [lectureId,studentId]);
  const old=previous.rows[0]?.status||null;
  await client.query(
   "INSERT INTO attendance_corrections(lecture_id,student_id,status,reason,corrected_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lecture_id,student_id) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,corrected_by=EXCLUDED.corrected_by,corrected_at=now()",
   [lectureId,studentId,status,note,user.id]);
  await client.query(
   "INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'attendance.record.correct','lecture',$2,$3::jsonb)",
   [user.id,lectureId,JSON.stringify({courseId:lecture.course_id,studentId,from:old,to:status,reason:note})]);
  await client.query('COMMIT');
  return {ok:true,lectureId,studentId,status};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
module.exports={listLectureRecords,setLectureArchived,correctAttendance};
