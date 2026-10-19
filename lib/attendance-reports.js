'use strict';
// Lecturer-only reports. Closed, non-archived lectures count towards absence.
// Current enrollments are the report cohort; never count pre-enrollment lectures
// against someone who joined later. This module never grants superadmin access.
const {authorizeCourse}=require('./attendance-v2');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function fail(status,code){const e=new Error(code);e.status=status;throw e}
function toTime(x){const t=new Date(x).getTime();return Number.isFinite(t)?t:0}
function iso(x){return new Date(x).toISOString()}
async function reportForCourse(pool,principal,courseId){
 if(typeof courseId!=='string'||!UUID.test(courseId))fail(400,'INVALID_ID');
 await authorizeCourse(pool,principal,courseId,'attendance.read');
 // Course name is administrative metadata, never a list of other courses.
 const c=await pool.query('SELECT id,name FROM courses WHERE id=$1 AND archived_at IS NULL',[courseId]);
 if(!c.rows.length)fail(404,'COURSE_NOT_FOUND');
 // Limit to prevent unbounded personally identifiable data payloads.
 const enrolled=await pool.query(
  'SELECT s.id,s.roll_number,s.full_name,e.enrolled_at FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.course_id=$1 AND e.removed_at IS NULL ORDER BY s.roll_number,s.id LIMIT 5001',
  [courseId]);
 if(enrolled.rows.length>5000)fail(413,'REPORT_TOO_LARGE');
 const lessons=await pool.query(
  'SELECT id,title,opened_at,closed_at FROM lectures WHERE course_id=$1 AND archived_at IS NULL AND closed_at IS NOT NULL ORDER BY closed_at,id LIMIT 1001',
  [courseId]);
 if(lessons.rows.length>1000)fail(413,'REPORT_TOO_LARGE');
 // A single scoped query; never fetch another course's attendance.
 const present=await pool.query(
  'SELECT a.student_id,a.lecture_id FROM attendances a JOIN lectures l ON l.id=a.lecture_id JOIN enrollments e ON e.student_id=a.student_id AND e.course_id=l.course_id WHERE l.course_id=$1 AND l.closed_at IS NOT NULL AND l.archived_at IS NULL AND e.removed_at IS NULL AND e.enrolled_at<=l.closed_at',
  [courseId]);
 const corrections=await pool.query(
  'SELECT ac.student_id,ac.lecture_id,ac.status FROM attendance_corrections ac JOIN lectures l ON l.id=ac.lecture_id JOIN enrollments e ON e.student_id=ac.student_id AND e.course_id=l.course_id WHERE l.course_id=$1 AND l.closed_at IS NOT NULL AND l.archived_at IS NULL AND e.removed_at IS NULL AND e.enrolled_at<=l.closed_at',
  [courseId]);
 const overrides=new Map();
 for(const c of corrections.rows)overrides.set(c.student_id+':'+c.lecture_id,c.status);
 const presentByStudent=new Map();
 for(const record of present.rows){
  if(!presentByStudent.has(record.student_id))presentByStudent.set(record.student_id,new Set());
  presentByStudent.get(record.student_id).add(record.lecture_id);
 }
 const students=enrolled.rows.map(s=>{
  const joined=toTime(s.enrolled_at),recorded=presentByStudent.get(s.id)||new Set();
  let attended=0,eligible=0;
  const lectureStatuses=lessons.rows.map(l=>{
   if(toTime(l.closed_at)<joined)return 'not-enrolled';
   eligible++;
   const override=overrides.get(s.id+':'+l.id);
   if(override==='present'){attended++;return 'present'}
   if(override==='absent')return 'absent';
   if(recorded.has(l.id)){attended++;return 'present'}
   return 'absent';
  });
  const absent=eligible-attended;
  return {id:s.id,rollNumber:s.roll_number,fullName:s.full_name,
   eligible,attended,absent,percentage:eligible?Math.round(attended/eligible*10000)/100:null,
   lectureStatuses};
 });
 const lectures=lessons.rows.map((l,i)=>{
  let presentCount=0,eligible=0;
  for(const s of students){
   if(s.lectureStatuses[i]==='not-enrolled')continue;
   eligible++;if(s.lectureStatuses[i]==='present')presentCount++;
  }
  return {id:l.id,title:l.title,openedAt:iso(l.opened_at),closedAt:iso(l.closed_at),
   eligible,present:presentCount,absent:eligible-presentCount};
 });
 return {courseId,courseName:c.rows[0].name,scope:'closed_non_archived_current_enrollment',
  totalStudents:students.length,totalLectures:lectures.length,students,lectures};
}
module.exports={reportForCourse};
