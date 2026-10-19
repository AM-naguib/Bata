'use strict';
// No public ID->name lookup. Only call after a valid course lecture/QR check.
// Unmatched identities return null; never disclose whether roll or name was wrong.
const {normalizeSeatNumber,normalizeStudentName,validStudentIdentity}=require('./student-identity');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
async function findEnrolledStudent(pool,{courseId,studentId,studentName}={}){
 const roll=normalizeSeatNumber(studentId),name=normalizeStudentName(studentName);
 if(!UUID.test(courseId||'')||!roll||!name||roll.length>64||name.length>200)return null;
 const r=await pool.query(
  'SELECT s.id,s.roll_number,s.full_name FROM students s JOIN enrollments e ON e.student_id=s.id WHERE s.roll_number=$1 AND e.course_id=$2 AND e.removed_at IS NULL LIMIT 1',
  [roll,courseId]
 );
 const student=r.rows[0];
 return validStudentIdentity({studentId:roll,studentName:name},student)?{id:student.id}:null;
}
module.exports={findEnrolledStudent};
